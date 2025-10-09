import { Component, inject } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonSpinner, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { Printer } from '../services/printer';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonList, IonItem, IonLabel, IonIcon, IonSpinner],
})
export class HomePage {
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
