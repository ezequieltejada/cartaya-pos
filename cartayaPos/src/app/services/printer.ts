import { inject, Injectable, NgZone } from '@angular/core';
import { CapacitorThermalPrinter } from 'capacitor-thermal-printer';

@Injectable({
  providedIn: 'root'
})
export class Printer {
  // Storage key for persisting printer selection
  private readonly STORAGE_KEY = 'selected_printer';

  // Public properties
  discoveredPrinters: any[] = [];
  selectedPrinter: any = null;
  selectedAddress: string = '';
  isScanning: boolean = false;
  isConnected: boolean = false;

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
   */
  async disconnect(): Promise<void> {
    try {
      console.log('Disconnecting from printer');
      await CapacitorThermalPrinter.disconnect();
      this.isConnected = false;
      console.log('Disconnected from printer');
    } catch (error) {
      console.error('Error disconnecting from printer:', error);
      this.isConnected = false;
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
    
    // Persist selection to localStorage
    if (this.selectedPrinter) {
      this.savePrinterToStorage(this.selectedPrinter);
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
   */
  cleanup(): void {
    try {
      console.log('Cleaning up Printer service');
      this.isScanning = false;
      this.discoveredPrinters = [];
      if (this.isConnected) {
        this.disconnect();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
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
}
