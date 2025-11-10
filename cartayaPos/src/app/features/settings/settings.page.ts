import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  bluetoothOutline,
  checkmarkCircle,
  radioButtonOff,
  radioButtonOn,
} from 'ionicons/icons';
import { Printer } from '../../services/printer';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonBackButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonButton,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonSpinner,
    IonBadge,
  ],
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit, OnDestroy {
  private router = inject(Router);
  protected printerService = inject(Printer);

  constructor() {
    // Register ionicons
    addIcons({
      bluetoothOutline,
      radioButtonOn,
      radioButtonOff,
      checkmarkCircle,
    });
  }

  ngOnInit(): void {
    // Load persisted printer on component init
    this.printerService.loadPersistedPrinter();
  }

  ngOnDestroy(): void {
    // Clean up service state when leaving the page
    this.printerService.cleanup();
  }

  // Getters for template binding
  get discoveredPrinters() {
    return this.printerService.discoveredPrinters;
  }

  get selectedPrinter() {
    return this.printerService.selectedPrinter;
  }

  get selectedAddress() {
    return this.printerService.selectedAddress;
  }

  get isScanning() {
    return this.printerService.isScanning;
  }

  get isConnected() {
    return this.printerService.isConnected;
  }

  get connectionStatus(): string {
    if (this.isConnected && this.selectedPrinter) {
      return 'Connected';
    } else if (this.selectedPrinter && !this.isConnected) {
      return 'Selected (Not Connected)';
    }
    return 'No printer selected';
  }

  get statusColor(): string {
    if (!this.selectedPrinter) {
      return 'medium';
    }
    return this.isConnected ? 'success' : 'medium';
  }

  // Component methods
  async scanForPrinters(): Promise<void> {
    await this.printerService.scanForPrinters();
  }

  selectPrinter(address: string): void {
    this.printerService.selectPrinter(address);
  }

  async connectToPrinter(): Promise<void> {
    if (this.selectedPrinter) {
      await this.printerService.connect();
    }
  }

  async disconnectFromPrinter(): Promise<void> {
    await this.printerService.disconnect();
  }

  goBack(): void {
    this.router.navigate(['/products']);
  }
}
