import { Component, inject } from '@angular/core';
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonSpinner } from '@ionic/angular/standalone';
import { Printer } from '../services/printer';

@Component({
  selector: 'app-printer-test',
  templateUrl: './printer-test.component.html',
  styleUrls: ['./printer-test.component.scss'],
  imports: [IonButton, IonList, IonItem, IonLabel, IonIcon, IonSpinner],
})
export class PrinterTestComponent {
  private printer = inject(Printer);

  get discoveredPrinters() {
    return this.printer.discoveredPrinters;
  }

  get selectedPrinter() {
    return this.printer.selectedPrinter;
  }

  get selectedAddress() {
    return this.printer.selectedAddress;
  }

  get isScanning() {
    return this.printer.isScanning;
  }

  get isPrintButtonEnabled() {
    return !!this.selectedPrinter;
  }

  async scanForPrinters() {
    await this.printer.scanForPrinters();
  }

  selectPrinter(address: string) {
    this.printer.selectPrinter(address);
  }

  async printSample() {
    await this.printer.printSample();
  }
}
