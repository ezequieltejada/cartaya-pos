import { computed, inject, Injectable, InjectionToken, NgZone, OnDestroy, signal } from '@angular/core';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { CapacitorThermalPrinter } from 'capacitor-thermal-printer';
import { LoggerService } from '../core/services/logger.service';
import { CAPACITOR_APP } from '../core/tokens/capacitor-app.token';

/**
 * The thermal printer plugin is injected so specs can provide a fake: Capacitor
 * plugin objects are proxies, which jasmine cannot spy on.
 */
export const THERMAL_PRINTER = new InjectionToken<typeof CapacitorThermalPrinter>('THERMAL_PRINTER', {
  providedIn: 'root',
  factory: () => CapacitorThermalPrinter,
});

/**
 * Minimum Android version that requires the new BLUETOOTH_SCAN / BLUETOOTH_CONNECT
 * runtime permissions (Android 12, as reported by Device.getInfo().osVersion).
 * Note: this is the Android *version* number (12), not the API level (31).
 */
const ANDROID_12_VERSION = 12;
const CONNECTION_STATUS_POLL_INTERVAL_MS = 2000;

export type PrinterStatus = 'connected' | 'found-not-connected' | 'not-found';

type PrinterDevice = {
  name: string;
  address: string;
};

@Injectable({
  providedIn: 'root'
})
export class Printer implements OnDestroy {
  // Storage keys for persisting printer selection and connection state
  private readonly STORAGE_KEY = 'selected_printer';
  private readonly CONNECTION_STATE_KEY = 'printer_connection_state';
  private readonly selectedPrinterState = signal<any>(null);
  private readonly connectedState = signal(false);
  private connectionListenersReady: Promise<void> | null = null;
  private appStateListenerReady: Promise<void> | null = null;
  private connectedListenerHandle: PluginListenerHandle | null = null;
  private disconnectedListenerHandle: PluginListenerHandle | null = null;
  private appStateListenerHandle: PluginListenerHandle | null = null;
  private connectionStatusPollTimer: ReturnType<typeof setInterval> | null = null;

  // Public properties
  discoveredPrinters: any[] = [];

  get selectedPrinter(): any {
    return this.selectedPrinterState();
  }

  set selectedPrinter(printer: any) {
    this.selectedPrinterState.set(printer);
  }

  selectedAddress: string = '';
  isScanning: boolean = false;

  get isConnected(): boolean {
    return this.connectedState();
  }

  set isConnected(connected: boolean) {
    this.connectedState.set(connected);

    if (connected) {
      this.startConnectionStatusPolling();
    } else {
      this.stopConnectionStatusPolling();
    }
  }

  /**
   * Populated with a human-readable message when a permission check or request
   * fails.  Components can watch this to surface an error in the UI instead of
   * silently showing "no printers found".
   */
  permissionError: string | null = null;
  connectionError: string | null = null;

  // Track if user manually disconnected from the printer
  // If true, the app should NOT attempt to reconnect automatically
  // If false, the app should attempt to reconnect if a printer is selected
  private userManuallyDisconnected: boolean = false;

  // Signal for tracking printer availability status
  printerAvailable = signal<boolean>(true);
  readonly status = computed<PrinterStatus>(() => {
    const selectedPrinter = this.selectedPrinterState();

    if (!selectedPrinter || !this.printerAvailable()) {
      return 'not-found';
    }

    return this.connectedState() ? 'connected' : 'found-not-connected';
  });

  ngZone = inject(NgZone);
  private readonly thermal = inject(THERMAL_PRINTER);
  private readonly capApp = inject(CAPACITOR_APP);
  private readonly log = inject(LoggerService).scope('printer');

  constructor() {
    this.log.trace('Printer service constructed');
  }

  ngOnDestroy(): void {
    void this.removeConnectionListeners();
  }

  private async ensureNativeLifecycleReady(): Promise<void> {
    await Promise.all([
      this.initializeConnectionListeners(),
      this.initializeAppStateListener(),
    ]);
  }

  private async initializeConnectionListeners(): Promise<void> {
    if (this.connectionListenersReady) {
      return this.connectionListenersReady;
    }

    this.connectionListenersReady = this.registerConnectionListeners();
    return this.connectionListenersReady;
  }

  private async initializeAppStateListener(): Promise<void> {
    if (this.appStateListenerReady) {
      return this.appStateListenerReady;
    }

    this.appStateListenerReady = this.registerAppStateListener();
    return this.appStateListenerReady;
  }

  private async registerConnectionListeners(): Promise<void> {
    try {
      this.connectedListenerHandle = await this.thermal.addListener('connected', (device) => {
        this.handleNativeConnected(device);
      });

      this.disconnectedListenerHandle = await this.thermal.addListener('disconnected', () => {
        this.handleNativeDisconnected();
      });

      this.log.trace('Printer connection listeners registered');
    } catch (error) {
      this.log.error('Failed to register printer connection listeners', error);
      this.connectionListenersReady = null;
    }
  }

  private async registerAppStateListener(): Promise<void> {
    try {
      this.appStateListenerHandle = await this.capApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          void this.refreshConnectionStatus('app-resume');
        }
      });

      this.log.trace('Printer app state listener registered');
    } catch (error) {
      this.log.error('Failed to register printer app state listener', error);
      this.appStateListenerReady = null;
    }
  }

  private async removeConnectionListeners(): Promise<void> {
    const handles = [this.connectedListenerHandle, this.disconnectedListenerHandle, this.appStateListenerHandle];

    this.connectedListenerHandle = null;
    this.disconnectedListenerHandle = null;
    this.appStateListenerHandle = null;
    this.connectionListenersReady = null;
    this.appStateListenerReady = null;
    this.stopConnectionStatusPolling();

    await Promise.all(handles.map(async (handle) => {
      if (!handle) {
        return;
      }

      try {
        await handle.remove();
      } catch (error) {
        this.log.warn('Failed to remove printer listener', error);
      }
    }));
  }

  private handleNativeConnected(device: PrinterDevice): void {
    this.ngZone.run(() => {
      this.log.trace('native connected event received', { address: device.address });
      this.printerAvailable.set(true);
      this.clearConnectionError();
      this.userManuallyDisconnected = false;

      if (!this.selectedPrinter || this.selectedPrinter.address !== device.address) {
        this.selectedPrinter = device;
        this.savePrinterToStorage(device);
      }

      this.selectedAddress = device.address;
      this.isConnected = true;
    });
  }

  private handleNativeDisconnected(): void {
    this.ngZone.run(() => {
      this.handleDetectedDisconnection('native-event');
    });
  }

  private startConnectionStatusPolling(): void {
    if (this.connectionStatusPollTimer !== null) {
      return;
    }

    if (!this.selectedPrinter?.address && !this.selectedAddress) {
      return;
    }

    this.connectionStatusPollTimer = setInterval(() => {
      void this.refreshConnectionStatus('poll');
    }, CONNECTION_STATUS_POLL_INTERVAL_MS);
  }

  private stopConnectionStatusPolling(): void {
    if (this.connectionStatusPollTimer === null) {
      return;
    }

    clearInterval(this.connectionStatusPollTimer);
    this.connectionStatusPollTimer = null;
  }

  private async refreshConnectionStatus(source: 'poll' | 'app-resume'): Promise<void> {
    if (!this.isConnected || (!this.selectedPrinter?.address && !this.selectedAddress)) {
      return;
    }

    try {
      const connected = await this.thermal.isConnected();

      this.ngZone.run(() => {
        if (connected) {
          this.printerAvailable.set(true);
          return;
        }

        this.handleDetectedDisconnection(source);
      });
    } catch (error) {
      this.log.warn('connection status probe failed', { source, error });
    }
  }

  private handleDetectedDisconnection(source: 'active-check' | 'app-resume' | 'native-event' | 'poll'): void {
    this.log.warn('printer connection lost', { source });
    this.isConnected = false;
    this.printerAvailable.set(true);
    this.clearConnectionError();

    if (!this.selectedAddress && this.selectedPrinter?.address) {
      this.selectedAddress = this.selectedPrinter.address;
    }
  }

  private clearConnectionError(): void {
    this.connectionError = null;
  }

  private createConnectionError(message: string, cause?: unknown): Error {
    this.connectionError = message;

    const error = new Error(message) as Error & { cause?: unknown };
    if (cause !== undefined) {
      error.cause = cause;
    }

    return error;
  }

  private describePrinter(address: string): string {
    const printerName = this.selectedPrinter?.name;
    return printerName ? `"${printerName}" (${address})` : address;
  }

  private buildInterruptedConnectionMessage(address: string): string {
    return [
      `Failed to connect to printer ${this.describePrinter(address)}.`,
      'The native Bluetooth connection was interrupted before the printer became ready.',
      'Verify that the printer is powered on, nearby, and still paired, then reconnect from Settings.'
    ].join(' ');
  }

  private buildUnexpectedConnectionMessage(address: string, error: unknown): string {
    const details = error instanceof Error ? error.message : String(error);

    if (!details || details === '[object Object]') {
      return `Failed to connect to printer ${this.describePrinter(address)}.`;
    }

    return `Failed to connect to printer ${this.describePrinter(address)}. ${details}`;
  }

  private async hasActiveConnection(expectedAddress?: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const connected = await this.thermal.isConnected();

      if (!connected) {
        this.handleDetectedDisconnection('active-check');
        return false;
      }

      this.isConnected = true;
    } catch (error) {
      this.log.warn('isConnected() check failed, falling back to cached state', error);
    }

    if (!expectedAddress) {
      return true;
    }

    const activeAddress = this.selectedPrinter?.address || this.selectedAddress;
    return !activeAddress || activeAddress === expectedAddress;
  }

  private async connectOrThrow(address: string): Promise<void> {
    await this.ensureNativeLifecycleReady();
    this.clearConnectionError();

    if (!address) {
      this.isConnected = false;
      throw this.createConnectionError('No printer address provided for the Bluetooth connection attempt.');
    }

    if (await this.hasActiveConnection(address)) {
      this.log.trace('reusing existing printer connection', { address });
      return;
    }

    const permissionsOk = await this.ensureBluetoothPermissions();
    if (!permissionsOk) {
      this.isConnected = false;
      throw this.createConnectionError(
        this.permissionError || 'Bluetooth permissions are required before connecting to a printer.'
      );
    }

    try {
      this.userManuallyDisconnected = false;

      this.log.trace('calling thermal printer connect', { address });
      const device = await this.thermal.connect({ address });

      if (device === null) {
        this.isConnected = false;
        throw this.createConnectionError(this.buildInterruptedConnectionMessage(address));
      }

      if (!this.selectedPrinter || this.selectedPrinter.address !== device.address) {
        this.selectedPrinter = device;
        this.selectedAddress = device.address;
      }

      this.log.trace('connected successfully', { name: device.name, address: device.address });
      this.isConnected = true;
      this.printerAvailable.set(true);
      this.clearConnectionError();
    } catch (error) {
      this.isConnected = false;

      if (error instanceof Error && error.message === this.connectionError) {
        throw error;
      }

      const permErr = this.extractPermissionError(error);
      if (permErr) {
        this.permissionError = permErr;
        throw this.createConnectionError(permErr, error);
      }

      throw this.createConnectionError(this.buildUnexpectedConnectionMessage(address, error), error);
    }
  }

  // ---------------------------------------------------------------------------
  // Permission helpers
  // ---------------------------------------------------------------------------

  /**
   * Returns the numeric Android major-version (e.g. 12, 13, 14) or 0 when not
   * running on Android / not a native platform.
   */
  private async getAndroidMajorVersion(): Promise<number> {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return 0;
    }
    try {
      const info = await Device.getInfo();
      const major = parseInt(info.osVersion, 10);
      this.log.trace('android OS version parsed', { osVersion: info.osVersion, major });
      return isNaN(major) ? 0 : major;
    } catch (err) {
      this.log.warn('Could not read device OS version', err);
      return 0;
    }
  }

  /**
   * Ensure the necessary Bluetooth (and, on older Android, location) runtime
   * permissions are granted before attempting a scan or connect.
   *
   * Returns `true` when all required permissions are available, `false`
   * otherwise.  When returning `false` it also sets `permissionError` with a
   * human-readable description.
   */
  async ensureBluetoothPermissions(): Promise<boolean> {
    const androidVersion = await this.getAndroidMajorVersion();

    // Not on Android – nothing to check on iOS or web.
    if (androidVersion === 0) {
      this.log.trace('Not on Android – skipping permission check');
      return true;
    }

    this.log.trace('checking bluetooth permissions', { androidVersion });
    this.permissionError = null;

    if (androidVersion >= ANDROID_12_VERSION) {
      // Android 12+: need BLUETOOTH_SCAN + BLUETOOTH_CONNECT
      return this.requestModernBluetoothPermissions();
    } else {
      // Android 11 and below: need location for BT discovery
      return this.requestLegacyLocationPermission();
    }
  }

  /**
   * On Android 12+ the thermal printer plugin triggers the OS permission dialog
   * itself when startScan() / connect() is called.  There is no JS-accessible
   * checkPermissions() / requestPermissions() on this plugin, so we return true
   * and let the scan/connect catch block handle "permission denied" errors.
   */
  private async requestModernBluetoothPermissions(): Promise<boolean> {
    this.log.trace('Modern BT permissions (BLUETOOTH_SCAN/BLUETOOTH_CONNECT) will be requested by the OS on first scan/connect');
    return true;
  }

  /**
   * Check / request ACCESS_FINE_LOCATION for BT discovery on Android ≤ 11.
   */
  private async requestLegacyLocationPermission(): Promise<boolean> {
    this.log.trace('Checking location permission (Android ≤ 11)');

    if (!('permissions' in navigator)) {
      // No Permissions API – assume granted (older WebView)
      this.log.trace('navigator.permissions not available, assuming location granted');
      return true;
    }

    try {
      const status = await (navigator.permissions as any).query({ name: 'geolocation' });
      this.log.trace('location permission status before request', { state: status.state });

      if (status.state === 'denied') {
        this.permissionError =
          'Location permission is required for Bluetooth discovery on this Android version. ' +
          'Please grant Location permission in app settings.';
        this.log.warn('Location permission denied – cannot scan');
        return false;
      }

      // 'granted' or 'prompt' – let the OS handle it on first scan
      return true;
    } catch (err) {
      this.log.warn('Error querying location permission', err);
      return true; // Optimistic – let scan attempt proceed
    }
  }

  /**
   * Inspect a caught error and determine whether it indicates a permission
   * denial.  Returns a user-facing message or `null` if not a permission error.
   */
  private extractPermissionError(error: unknown): string | null {
    if (!error) return null;
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();
    if (
      lower.includes('permission') ||
      lower.includes('denied') ||
      lower.includes('security') ||
      lower.includes('bluetooth is not enabled') ||
      lower.includes('bluetooth off')
    ) {
      return `Bluetooth permission error: ${msg}`;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------

  /**
   * Connect to the selected printer
   * @returns Promise<boolean> - true if connection successful, false otherwise
   */
  async connect(): Promise<boolean> {
    this.clearConnectionError();

    if (!this.selectedPrinter) {
      this.connectionError = 'No printer selected';
      this.log.warn('connect() called with no printer selected');
      return false;
    }

    this.log.trace('attempting connect', { address: this.selectedPrinter.address, name: this.selectedPrinter.name });

    try {
      await this.connectOrThrow(this.selectedPrinter.address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Connect directly to a printer by its Bluetooth MAC address, bypassing the
   * need to scan first.  Useful when the printer's address is already known.
   *
   * @param address - Bluetooth MAC address (e.g. "AA:BB:CC:DD:EE:FF")
   * @returns Promise<boolean> - true if connection successful, false otherwise
   */
  async connectByAddress(address: string): Promise<boolean> {
    this.log.trace('connectByAddress called', { address });
    this.clearConnectionError();

    if (!address) {
      this.connectionError = 'No printer address provided for the Bluetooth connection attempt.';
      this.log.warn('connectByAddress – no address provided');
      return false;
    }

    try {
      await this.connectOrThrow(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Disconnect from the currently connected printer
   * @param manualDisconnect - If true, marks this as a manual user disconnection.
   *                           If false, indicates device disconnection (will attempt reconnect on next order).
   */
  async disconnect(manualDisconnect: boolean = true): Promise<void> {
    try {
      await this.ensureNativeLifecycleReady();
      this.log.trace('disconnect() called', { manualDisconnect });
      await this.thermal.disconnect();
      this.isConnected = false;
      this.clearConnectionError();
      this.userManuallyDisconnected = manualDisconnect;
      this.log.trace('Disconnected from printer');
    } catch (error) {
      this.log.error('disconnect() – caught exception', error);
      this.isConnected = false;
      this.userManuallyDisconnected = manualDisconnect;
    }
  }

  // ---------------------------------------------------------------------------
  // Scan
  // ---------------------------------------------------------------------------

  async scanForPrinters() {
    await this.ensureNativeLifecycleReady();
    this.log.trace('scanForPrinters() entered');
    this.permissionError = null;
    this.clearConnectionError();

    const permissionsOk = await this.ensureBluetoothPermissions();
    if (!permissionsOk) {
      this.log.warn('scanForPrinters – permission check failed', { permissionError: this.permissionError });
      // permissionError is already set; caller / template can surface it
      return;
    }

    this.isScanning = true;
    this.discoveredPrinters = [];

    this.log.trace('Starting scan (active BT discovery)');

    try {
      // Set up listener for discovered devices
      const listenerHandle = await this.thermal.addListener('discoverDevices', async (data) => {
        const devices = data.devices || [];
        this.log.trace('discoverDevices event received', { payload: data });
        this.log.trace('devices surfaced to JS layer', { count: devices.length });
        devices.forEach((d: any, i: number) => {
          this.log.trace('device found', { index: i, name: d.name, address: d.address });
        });

        this.ngZone.run(() => {
          this.discoveredPrinters = devices;
          this.isScanning = false;
        });

        // Stop scanning once devices are found
        try {
          await this.thermal.stopScan();
          this.log.trace('stopScan() called after device discovery');
        } catch (stopErr) {
          this.log.error('Error stopping scan after device discovery', stopErr);
        }

        // Remove this listener to avoid duplicate callbacks on the next scan
        try {
          listenerHandle.remove();
          this.log.trace('discoverDevices listener removed');
        } catch (removeErr) {
          this.log.warn('Could not remove discoverDevices listener', removeErr);
        }
      });

      // Start scanning
      this.log.trace('Calling CapacitorThermalPrinter.startScan()');
      await this.thermal.startScan();
      this.log.trace('startScan() returned (scan in progress)');

      // Add timeout to stop scanning if no devices found within 10 seconds
      setTimeout(async () => {
        if (this.isScanning) {
          this.log.trace('Scan timeout (10 s) reached – no devices found, stopping scan');
          try {
            await this.thermal.stopScan();
          } catch (error) {
            this.log.error('Error stopping scan on timeout', error);
          }
          this.ngZone.run(() => { this.isScanning = false; });
        }
      }, 10000);
    } catch (error) {
      const permErr = this.extractPermissionError(error);
      if (permErr) {
        this.permissionError = permErr;
        this.log.error('scanForPrinters – permission error', permErr);
      } else {
        this.log.error('scanForPrinters – caught exception', error);
      }
      this.ngZone.run(() => { this.isScanning = false; });
    }
  }

  // ---------------------------------------------------------------------------
  // Selection / storage
  // ---------------------------------------------------------------------------

  selectPrinter(address: string) {
    this.log.trace('selectPrinter called', { address });
    this.selectedAddress = address;
    this.selectedPrinter = this.discoveredPrinters.find(p => p.address === address) || null;
    this.printerAvailable.set(true);
    this.clearConnectionError();
    this.log.trace('selected printer set', { printer: this.selectedPrinter });

    // Reset manual disconnection flag when user selects a printer
    this.userManuallyDisconnected = false;

    // Persist selection to localStorage
    if (this.selectedPrinter) {
      this.savePrinterToStorage(this.selectedPrinter);
    }

    if (this.isConnected) {
      this.startConnectionStatusPolling();
    }
  }

  /**
   * Clear the selected printer (remove selection)
   */
  clearPrinterSelection(): void {
    this.log.trace('clearPrinterSelection()');
    this.selectedPrinter = null;
    this.selectedAddress = '';
    this.printerAvailable.set(true);
    this.clearConnectionError();
    this.userManuallyDisconnected = false;
    this.stopConnectionStatusPolling();

    // Remove from localStorage
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.log.trace('Printer selection cleared from localStorage');
    } catch (error) {
      this.log.error('Error clearing printer from localStorage', error);
    }
  }

  /**
   * Load persisted printer from localStorage
   */
  loadPersistedPrinter(): void {
    this.log.trace('loadPersistedPrinter()');
    try {
      const savedPrinterJson = localStorage.getItem(this.STORAGE_KEY);
      if (savedPrinterJson) {
        const savedPrinter = JSON.parse(savedPrinterJson);
        this.selectedPrinter = savedPrinter;
        this.selectedAddress = savedPrinter.address || '';
        this.printerAvailable.set(true);
        this.log.trace('loaded persisted printer', { name: savedPrinter.name, address: savedPrinter.address });
      } else {
        this.log.trace('No persisted printer found in localStorage');
      }
    } catch (error) {
      this.log.error('Error loading persisted printer from localStorage', error);
    }
  }

  /**
   * Save printer to localStorage
   * @param printer - The printer object to save
   */
  private savePrinterToStorage(printer: any): void {
    try {
      const printerData = {
        name: printer.name,
        address: printer.address
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(printerData));
      this.log.trace('printer saved to localStorage', { printer: printerData });
    } catch (error) {
      this.log.error('Error saving printer to localStorage', error);
    }
  }

  /**
   * Clean up listeners and state
   * NOTE: Does NOT disconnect printer - connection persists across page navigation
   * Printer only disconnects on manual disconnect or app close
   */
  cleanup(): void {
    try {
      this.log.trace('cleanup() called');
      this.isScanning = false;
      this.discoveredPrinters = [];
      // Do NOT disconnect the printer here - connection should persist
    } catch (error) {
      this.log.error('Error during cleanup', error);
    }
  }

  /**
   * Check if the connected printer is still available/responding
   * This method attempts to verify the printer connection is still valid
   * If the printer is unavailable, sets printerAvailable signal to false
   * @returns Promise<boolean> - true if printer is available, false otherwise
   */
  async checkPrinterAvailability(): Promise<boolean> {
    if (!this.isConnected || !this.selectedPrinter) {
      // Not connected, so availability check doesn't apply
      this.printerAvailable.set(true);
      return true;
    }

    try {
      this.log.trace('checkPrinterAvailability', { address: this.selectedPrinter.address });

      // The actual availability check would depend on the Capacitor plugin capabilities
      // For now, we'll set printerAvailable to true as default
      this.printerAvailable.set(true);
      return true;
    } catch (error) {
      this.log.error('checkPrinterAvailability – error', error);
      this.printerAvailable.set(false);
      return false;
    }
  }

  /**
   * Set printer as unavailable (called when device goes out of range or turns off)
   */
  setPrinterUnavailable(): void {
    this.printerAvailable.set(false);
    this.log.warn('Printer marked as unavailable');
  }

  /**
   * Reset printer availability status (called when returning to settings or after reconnection)
   */
  resetPrinterAvailability(): void {
    if (this.isConnected) {
      this.printerAvailable.set(true);
    }
  }

  /**
   * Check if the user manually disconnected from the printer
   * @returns boolean - true if user manually disconnected, false otherwise
   */
  isUserManuallyDisconnected(): boolean {
    return this.userManuallyDisconnected;
  }

  /**
   * Reset the manual disconnection flag (called when user selects a printer in settings)
   */
  resetManualDisconnectionFlag(): void {
    this.userManuallyDisconnected = false;
    this.log.trace('Manual disconnection flag reset');
  }

  async printSample() {
    if (!this.selectedPrinter) {
      this.log.warn('printSample() – no printer selected');
      return;
    }

    try {
      await this.connectOrThrow(this.selectedPrinter.address);

      this.log.trace('printSample() – connected, sending print job');

      await this.thermal.begin()
        .align('center')
        .text('Hello from Ionic!\n')
        .text('PT-210 Test Print\n')
        .qr('https://www.goojprt.com')
        .cutPaper()
        .write();

      this.log.trace('printSample() – print completed successfully');
    } catch (error) {
      this.log.error('printSample() – error', error);
    }
  }

  /**
   * Print a receipt with the given content
   * @param receiptContent - The formatted receipt content to print
   */
  async printReceipt(receiptContent: string): Promise<void> {
    if (!this.selectedPrinter) {
      throw new Error('No printer selected');
    }

    try {
      await this.connectOrThrow(this.selectedPrinter.address);

      this.log.trace('printReceipt() – sending receipt');

      await this.thermal.begin()
        .text(receiptContent)
        .cutPaper()
        .write();

      this.log.trace('printReceipt() – receipt printed successfully');
    } catch (error) {
      this.log.error('printReceipt() – error', error);
      throw error;
    }
  }
}
