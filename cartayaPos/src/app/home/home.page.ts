import { Component } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { CapacitorThermalPrinter } from 'capacitor-thermal-printer';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButton],
})
export class HomePage {
  constructor() {}

  async printSample() {
    await CapacitorThermalPrinter.startScan();
    // Listen to devices
    CapacitorThermalPrinter.addListener('discoverDevices', (devices) => {
      console.log('Found devices:', devices);
      // Choose your PT-210 by address or name
      const myPrinter = devices.devices.find(d => d.name?.includes('PT-210'));
      if (myPrinter) {
        CapacitorThermalPrinter.connect({ address: myPrinter.address }).then(async () => {
          await CapacitorThermalPrinter.begin()
            .align('center')
            .text('Hello from Ionic!\n')
            .text('PT-210 Test Print\n')
            .qr('https://www.goojprt.com')
            .cutPaper()
            .write();
        });
      }
    });
  }
}
