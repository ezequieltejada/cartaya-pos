import { inject, Injectable, NgZone } from '@angular/core';
import { CapacitorThermalPrinter } from 'capacitor-thermal-printer';

@Injectable({
  providedIn: 'root'
})
export class Printer {
  discoveredPrinters: any[] = [];
  selectedPrinter: any = null;
  selectedAddress: string = '';
  isScanning: boolean = false;

  ngZone = inject(NgZone);

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
  }

  async printSample() {
    if (!this.selectedPrinter) {
      console.error('No printer selected');
      return;
    }

    try {
      console.log('Connecting to printer:', this.selectedPrinter);
      const device = await CapacitorThermalPrinter.connect({ 
        address: this.selectedPrinter.address 
      });
      
      if (device === null) {
        console.error('Failed to connect to printer');
        return;
      }

      console.log('Connected to printer:', device);
      
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
