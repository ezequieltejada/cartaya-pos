import { inject, Injectable, NgZone, signal } from '@angular/core';
import { CapacitorThermalPrinter } from 'capacitor-thermal-printer';

@Injectable({
  providedIn: 'root'
})
export class Printer {
  // Storage keys for persisting printer selection and connection state
  private readonly STORAGE_KEY = 'selected_printer';
  private readonly CONNECTION_STATE_KEY = 'printer_connection_state';

  // Public properties
  discoveredPrinters: any[] = [];
  selectedPrinter: any = null;
  selectedAddress: string = '';
  isScanning: boolean = false;
  isConnected: boolean = false;
  
  // Track if user manually disconnected from the printer
  // If true, the app should NOT attempt to reconnect automatically
  // If false, the app should attempt to reconnect if a printer is selected
  private userManuallyDisconnected: boolean = false;
  
  // Signal for tracking printer availability status
  printerAvailable = signal<boolean>(true);

  ngZone = inject(NgZone);

  /**
   * Connect to the selected printer
   * @returns Promise<boolean> - true if connection successful, false otherwise
   */
  async connect(): Promise<boolean> {
    if (!this.selectedPrinter) {
      console.error('No printer selected');
      return false;
    }

    try {
      console.log('Connecting to printer:', this.selectedPrinter);
      // Reset manual disconnection flag when user attempts to connect
      // This allows reconnection after manual disconnect
      this.userManuallyDisconnected = false;
      
      const device = await CapacitorThermalPrinter.connect({ 
        address: this.selectedPrinter.address 
      });
      
      if (device === null) {
        console.error('Failed to connect to printer');
        this.isConnected = false;
        return false;
      }

      console.log('Connected to printer:', device);
      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('Error connecting to printer:', error);
      this.isConnected = false;
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
      console.log('Disconnecting from printer, manual disconnect:', manualDisconnect);
      await CapacitorThermalPrinter.disconnect();
      this.isConnected = false;
      this.userManuallyDisconnected = manualDisconnect;
      console.log('Disconnected from printer');
    } catch (error) {
      console.error('Error disconnecting from printer:', error);
      this.isConnected = false;
      this.userManuallyDisconnected = manualDisconnect;
    }
  }

  async scanForPrinters() {
    this.isScanning = true;
    this.discoveredPrinters = [];
    
    try {
      // Set up listener for discovered devices
      CapacitorThermalPrinter.addListener('discoverDevices', async (devices) => {
        this.ngZone.run(() => {
          console.log('Found devices:', devices);
          this.discoveredPrinters = devices.devices || [];
          this.isScanning = false;
        });
        // Stop scanning once devices are found
        try {
          await CapacitorThermalPrinter.stopScan();
        } catch (error) {
          console.error('Error stopping scan after device discovery:', error);
        }
      });
      
      // Start scanning
      await CapacitorThermalPrinter.startScan();

      // Add timeout to stop scanning if no devices found within 10 seconds
      setTimeout(async () => {
        if (this.isScanning) {
          console.log('Scan timeout reached, stopping scan');
          try {
            await CapacitorThermalPrinter.stopScan();
          } catch (error) {
            console.error('Error stopping scan:', error);
          }
          this.isScanning = false;
        }
      }, 10000);
    } catch (error) {
      console.error('Error scanning for printers:', error);
      this.isScanning = false;
    }
  }

  selectPrinter(address: string) {
    console.log('Printer selected with address:', address);
    this.selectedAddress = address;
    this.selectedPrinter = this.discoveredPrinters.find(p => p.address === address) || null;
    console.log('Selected printer:', this.selectedPrinter);
    
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
    console.log('Clearing printer selection');
    this.selectedPrinter = null;
    this.selectedAddress = '';
    this.userManuallyDisconnected = false;
    
    // Remove from localStorage
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('Printer selection cleared from localStorage');
    } catch (error) {
      console.error('Error clearing printer from localStorage:', error);
    }
  }

  /**
   * Load persisted printer from localStorage
   */
  loadPersistedPrinter(): void {
    try {
      const savedPrinterJson = localStorage.getItem(this.STORAGE_KEY);
      if (savedPrinterJson) {
        const savedPrinter = JSON.parse(savedPrinterJson);
        this.selectedPrinter = savedPrinter;
        this.selectedAddress = savedPrinter.address || '';
        console.log('Loaded persisted printer:', this.selectedPrinter);
      }
    } catch (error) {
      console.error('Error loading persisted printer from localStorage:', error);
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
      console.log('Printer saved to localStorage:', printerData);
    } catch (error) {
      console.error('Error saving printer to localStorage:', error);
    }
  }

  /**
   * Clean up listeners and state
   * NOTE: Does NOT disconnect printer - connection persists across page navigation
   * Printer only disconnects on manual disconnect or app close
   */
  cleanup(): void {
    try {
      console.log('Cleaning up Printer service');
      this.isScanning = false;
      this.discoveredPrinters = [];
      // Do NOT disconnect the printer here - connection should persist
    } catch (error) {
      console.error('Error during cleanup:', error);
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
      console.log('Checking printer availability:', this.selectedPrinter.address);
      
      // Try to get printer info - if this fails, printer is unavailable
      // This is a simple check; in a real scenario, you might ping the device
      // For now, we assume the printer is still available unless explicitly informed otherwise
      // In a production environment, you'd implement a proper health check here
      
      // The actual availability check would depend on the Capacitor plugin capabilities
      // For now, we'll set printerAvailable to true as default
      this.printerAvailable.set(true);
      return true;
    } catch (error) {
      console.error('Error checking printer availability:', error);
      this.printerAvailable.set(false);
      return false;
    }
  }

  /**
   * Set printer as unavailable (called when device goes out of range or turns off)
   */
  setPrinterUnavailable(): void {
    this.printerAvailable.set(false);
    console.warn('Printer marked as unavailable');
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
    console.log('Manual disconnection flag reset');
  }

  async printSample() {
    if (!this.selectedPrinter) {
      console.error('No printer selected');
      return;
    }

    try {
      // Use the new connect method
      const connected = await this.connect();
      
      if (!connected) {
        console.error('Failed to connect to printer');
        return;
      }

      console.log('Connected to printer, sending print job');
      
      await CapacitorThermalPrinter.begin()
        .align('center')
        .text('Hello from Ionic!\n')
        .text('PT-210 Test Print\n')
        .qr('https://www.goojprt.com')
        .cutPaper()
        .write();
        
      console.log('Print completed successfully');
    } catch (error) {
      console.error('Error printing:', error);
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
      const connected = await this.connect();
      
      if (!connected) {
        throw new Error('Failed to connect to printer');
      }

      console.log('Printing receipt');
      
      await CapacitorThermalPrinter.begin()
        .text(receiptContent)
        .cutPaper()
        .write();
        
      console.log('Receipt printed successfully');
    } catch (error) {
      console.error('Error printing receipt:', error);
      throw error;
    }
  }
}
