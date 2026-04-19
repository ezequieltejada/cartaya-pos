import { computed, inject, Injectable, NgZone, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { CapacitorThermalPrinter } from 'capacitor-thermal-printer';

/**
 * Minimum Android version that requires the new BLUETOOTH_SCAN / BLUETOOTH_CONNECT
 * runtime permissions (Android 12, as reported by Device.getInfo().osVersion).
 * Note: this is the Android *version* number (12), not the API level (31).
 */
const ANDROID_12_VERSION = 12;

export type PrinterStatus = 'connected' | 'found-not-connected' | 'not-found';

@Injectable({
  providedIn: 'root'
})
export class Printer {
  // Storage keys for persisting printer selection and connection state
  private readonly STORAGE_KEY = 'selected_printer';
  private readonly CONNECTION_STATE_KEY = 'printer_connection_state';
  private readonly selectedPrinterState = signal<any>(null);
  private readonly connectedState = signal(false);

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

  constructor() {
    console.log('PRINTER_DEBUG: Printer service constructed');
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
      const connected = await CapacitorThermalPrinter.isConnected();
      this.isConnected = connected;

      if (!connected) {
        return false;
      }
    } catch (error) {
      console.warn('PRINTER_DEBUG: isConnected() check failed, falling back to cached state', error);
    }

    if (!expectedAddress) {
      return true;
    }

    const activeAddress = this.selectedPrinter?.address || this.selectedAddress;
    return !activeAddress || activeAddress === expectedAddress;
  }

  private async connectOrThrow(address: string): Promise<void> {
    this.clearConnectionError();

    if (!address) {
      this.isConnected = false;
      throw this.createConnectionError('No printer address provided for the Bluetooth connection attempt.');
    }

    if (await this.hasActiveConnection(address)) {
      console.log(`PRINTER_DEBUG: Reusing existing printer connection for address=${address}`);
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

      console.log(`PRINTER_DEBUG: Calling CapacitorThermalPrinter.connect({ address: ${address} })`);
      const device = await CapacitorThermalPrinter.connect({ address });

      if (device === null) {
        this.isConnected = false;
        throw this.createConnectionError(this.buildInterruptedConnectionMessage(address));
      }

      console.log(`PRINTER_DEBUG: Connected successfully to device name=${device.name} address=${device.address}`);
      this.isConnected = true;
      this.printerAvailable.set(true);
      this.clearConnectionError();

      if (!this.selectedPrinter || this.selectedPrinter.address !== device.address) {
        this.selectedPrinter = device;
        this.selectedAddress = device.address;
      }
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
      console.log(`PRINTER_DEBUG: Android OS version string="${info.osVersion}" parsed major=${major}`);
      return isNaN(major) ? 0 : major;
    } catch (err) {
      console.warn('PRINTER_DEBUG: Could not read device OS version', err);
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
      console.log('PRINTER_DEBUG: Not on Android – skipping permission check');
      return true;
    }

    console.log(`PRINTER_DEBUG: Checking Bluetooth permissions for Android ${androidVersion}`);
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
    console.log('PRINTER_DEBUG: Modern BT permissions (BLUETOOTH_SCAN/BLUETOOTH_CONNECT) will be requested by the OS on first scan/connect');
    return true;
  }

  /**
   * Check / request ACCESS_FINE_LOCATION for BT discovery on Android ≤ 11.
   */
  private async requestLegacyLocationPermission(): Promise<boolean> {
    console.log('PRINTER_DEBUG: Checking location permission (Android ≤ 11)');

    if (!('permissions' in navigator)) {
      // No Permissions API – assume granted (older WebView)
      console.log('PRINTER_DEBUG: navigator.permissions not available, assuming location granted');
      return true;
    }

    try {
      const status = await (navigator.permissions as any).query({ name: 'geolocation' });
      console.log(`PRINTER_DEBUG: Location permission status before request: ${status.state}`);

      if (status.state === 'denied') {
        this.permissionError =
          'Location permission is required for Bluetooth discovery on this Android version. ' +
          'Please grant Location permission in app settings.';
        console.warn('PRINTER_DEBUG: Location permission denied – cannot scan');
        return false;
      }

      // 'granted' or 'prompt' – let the OS handle it on first scan
      return true;
    } catch (err) {
      console.warn('PRINTER_DEBUG: Error querying location permission', err);
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
      console.warn('PRINTER_DEBUG: connect() called with no printer selected');
      return false;
    }

    console.log(`PRINTER_DEBUG: Attempting connect to address=${this.selectedPrinter.address} name=${this.selectedPrinter.name}`);

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
    console.log(`PRINTER_DEBUG: connectByAddress called with address=${address}`);
    this.clearConnectionError();

    if (!address) {
      this.connectionError = 'No printer address provided for the Bluetooth connection attempt.';
      console.warn('PRINTER_DEBUG: connectByAddress – no address provided');
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
      console.log(`PRINTER_DEBUG: disconnect() called, manualDisconnect=${manualDisconnect}`);
      await CapacitorThermalPrinter.disconnect();
      this.isConnected = false;
      this.clearConnectionError();
      this.userManuallyDisconnected = manualDisconnect;
      console.log('PRINTER_DEBUG: Disconnected from printer');
    } catch (error) {
      console.error('PRINTER_DEBUG: disconnect() – caught exception:', error);
      this.isConnected = false;
      this.userManuallyDisconnected = manualDisconnect;
    }
  }

  // ---------------------------------------------------------------------------
  // Scan
  // ---------------------------------------------------------------------------

  async scanForPrinters() {
    console.log('PRINTER_DEBUG: scanForPrinters() entered');
    this.permissionError = null;
    this.clearConnectionError();

    const permissionsOk = await this.ensureBluetoothPermissions();
    if (!permissionsOk) {
      console.warn(`PRINTER_DEBUG: scanForPrinters – permission check failed: ${this.permissionError}`);
      // permissionError is already set; caller / template can surface it
      return;
    }

    this.isScanning = true;
    this.discoveredPrinters = [];

    console.log('PRINTER_DEBUG: Starting scan (active BT discovery)');

    try {
      // Set up listener for discovered devices
      const listenerHandle = await CapacitorThermalPrinter.addListener('discoverDevices', async (data) => {
        const devices = data.devices || [];
        console.log(`PRINTER_DEBUG: discoverDevices event received – raw payload: ${JSON.stringify(data)}`);
        console.log(`PRINTER_DEBUG: ${devices.length} device(s) surfaced to JS layer`);
        devices.forEach((d: any, i: number) => {
          console.log(`PRINTER_DEBUG:   device[${i}] name="${d.name}" address="${d.address}"`);
        });

        this.ngZone.run(() => {
          this.discoveredPrinters = devices;
          this.isScanning = false;
        });

        // Stop scanning once devices are found
        try {
          await CapacitorThermalPrinter.stopScan();
          console.log('PRINTER_DEBUG: stopScan() called after device discovery');
        } catch (stopErr) {
          console.error('PRINTER_DEBUG: Error stopping scan after device discovery:', stopErr);
        }

        // Remove this listener to avoid duplicate callbacks on the next scan
        try {
          listenerHandle.remove();
          console.log('PRINTER_DEBUG: discoverDevices listener removed');
        } catch (removeErr) {
          console.warn('PRINTER_DEBUG: Could not remove discoverDevices listener:', removeErr);
        }
      });

      // Start scanning
      console.log('PRINTER_DEBUG: Calling CapacitorThermalPrinter.startScan()');
      await CapacitorThermalPrinter.startScan();
      console.log('PRINTER_DEBUG: startScan() returned (scan in progress)');

      // Add timeout to stop scanning if no devices found within 10 seconds
      setTimeout(async () => {
        if (this.isScanning) {
          console.log('PRINTER_DEBUG: Scan timeout (10 s) reached – no devices found, stopping scan');
          try {
            await CapacitorThermalPrinter.stopScan();
          } catch (error) {
            console.error('PRINTER_DEBUG: Error stopping scan on timeout:', error);
          }
          this.ngZone.run(() => { this.isScanning = false; });
        }
      }, 10000);
    } catch (error) {
      const permErr = this.extractPermissionError(error);
      if (permErr) {
        this.permissionError = permErr;
        console.error(`PRINTER_DEBUG: scanForPrinters – permission error: ${permErr}`);
      } else {
        console.error('PRINTER_DEBUG: scanForPrinters – caught exception:', error);
      }
      this.ngZone.run(() => { this.isScanning = false; });
    }
  }

  // ---------------------------------------------------------------------------
  // Selection / storage
  // ---------------------------------------------------------------------------

  selectPrinter(address: string) {
    console.log(`PRINTER_DEBUG: selectPrinter called with address=${address}`);
    this.selectedAddress = address;
    this.selectedPrinter = this.discoveredPrinters.find(p => p.address === address) || null;
    this.printerAvailable.set(true);
    this.clearConnectionError();
    console.log(`PRINTER_DEBUG: selectedPrinter=${JSON.stringify(this.selectedPrinter)}`);

    // Reset manual disconnection flag when user selects a printer
    this.userManuallyDisconnected = false;

    // Persist selection to localStorage
    if (this.selectedPrinter) {
      this.savePrinterToStorage(this.selectedPrinter);
    }
  }

  /**
   * Clear the selected printer (remove selection)
   */
  clearPrinterSelection(): void {
    console.log('PRINTER_DEBUG: clearPrinterSelection()');
    this.selectedPrinter = null;
    this.selectedAddress = '';
    this.printerAvailable.set(true);
    this.clearConnectionError();
    this.userManuallyDisconnected = false;

    // Remove from localStorage
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('PRINTER_DEBUG: Printer selection cleared from localStorage');
    } catch (error) {
      console.error('PRINTER_DEBUG: Error clearing printer from localStorage:', error);
    }
  }

  /**
   * Load persisted printer from localStorage
   */
  loadPersistedPrinter(): void {
    console.log('PRINTER_DEBUG: loadPersistedPrinter()');
    try {
      const savedPrinterJson = localStorage.getItem(this.STORAGE_KEY);
      if (savedPrinterJson) {
        const savedPrinter = JSON.parse(savedPrinterJson);
        this.selectedPrinter = savedPrinter;
        this.selectedAddress = savedPrinter.address || '';
        this.printerAvailable.set(true);
        console.log(`PRINTER_DEBUG: Loaded persisted printer: name="${savedPrinter.name}" address="${savedPrinter.address}"`);
      } else {
        console.log('PRINTER_DEBUG: No persisted printer found in localStorage');
      }
    } catch (error) {
      console.error('PRINTER_DEBUG: Error loading persisted printer from localStorage:', error);
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
      console.log(`PRINTER_DEBUG: Printer saved to localStorage: ${JSON.stringify(printerData)}`);
    } catch (error) {
      console.error('PRINTER_DEBUG: Error saving printer to localStorage:', error);
    }
  }

  /**
   * Clean up listeners and state
   * NOTE: Does NOT disconnect printer - connection persists across page navigation
   * Printer only disconnects on manual disconnect or app close
   */
  cleanup(): void {
    try {
      console.log('PRINTER_DEBUG: cleanup() called');
      this.isScanning = false;
      this.discoveredPrinters = [];
      // Do NOT disconnect the printer here - connection should persist
    } catch (error) {
      console.error('PRINTER_DEBUG: Error during cleanup:', error);
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
      console.log(`PRINTER_DEBUG: checkPrinterAvailability address=${this.selectedPrinter.address}`);

      // The actual availability check would depend on the Capacitor plugin capabilities
      // For now, we'll set printerAvailable to true as default
      this.printerAvailable.set(true);
      return true;
    } catch (error) {
      console.error('PRINTER_DEBUG: checkPrinterAvailability – error:', error);
      this.printerAvailable.set(false);
      return false;
    }
  }

  /**
   * Set printer as unavailable (called when device goes out of range or turns off)
   */
  setPrinterUnavailable(): void {
    this.printerAvailable.set(false);
    console.warn('PRINTER_DEBUG: Printer marked as unavailable');
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
    console.log('PRINTER_DEBUG: Manual disconnection flag reset');
  }

  async printSample() {
    if (!this.selectedPrinter) {
      console.warn('PRINTER_DEBUG: printSample() – no printer selected');
      return;
    }

    try {
      await this.connectOrThrow(this.selectedPrinter.address);

      console.log('PRINTER_DEBUG: printSample() – connected, sending print job');

      await CapacitorThermalPrinter.begin()
        .align('center')
        .text('Hello from Ionic!\n')
        .text('PT-210 Test Print\n')
        .qr('https://www.goojprt.com')
        .cutPaper()
        .write();

      console.log('PRINTER_DEBUG: printSample() – print completed successfully');
    } catch (error) {
      console.error('PRINTER_DEBUG: printSample() – error:', error);
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

      console.log('PRINTER_DEBUG: printReceipt() – sending receipt');

      await CapacitorThermalPrinter.begin()
        .text(receiptContent)
        .cutPaper()
        .write();

      console.log('PRINTER_DEBUG: printReceipt() – receipt printed successfully');
    } catch (error) {
      console.error('PRINTER_DEBUG: printReceipt() – error:', error);
      throw error;
    }
  }
}
