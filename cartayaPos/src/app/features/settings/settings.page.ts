import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonButton, IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent, IonIcon,
  IonItem,
  IonLabel,
  IonList, IonSpinner
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  bluetoothOutline,
  checkmarkCircle,
  closeCircleOutline,
  radioButtonOff,
  radioButtonOn
} from 'ionicons/icons';
import { OrderHistoryService } from '../../services/order-history.service';
import { Printer } from '../../services/printer';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonContent,
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
    PageHeaderComponent,
  ],
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage implements OnInit, OnDestroy {
  private router = inject(Router);
  protected printerService = inject(Printer);
  protected orderHistoryService = inject(OrderHistoryService);
  private translate = inject(TranslateService);

  // Properties for testing order history service
  orderHistory: any[] = [];
  isLoadingOrders = false;
  orderHistoryError: string | null = null;

  constructor() {
    // Register ionicons
    addIcons({bluetoothOutline,checkmarkCircle,closeCircleOutline,radioButtonOn,radioButtonOff,});
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
      return this.translate.instant('SETTINGS.CONNECTED');
    } else if (this.selectedPrinter && !this.isConnected) {
      return this.translate.instant('SETTINGS.SELECTED_NOT_CONNECTED');
    }
    return this.translate.instant('SETTINGS.NO_PRINTER_SELECTED');
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

  clearPrinterSelection(): void {
    this.printerService.clearPrinterSelection();
  }

  goBack(): void {
    this.router.navigate(['/products']);
  }

  /**
   * Test method to fetch order history
   * This is temporary for testing purposes - can be removed once integrated into real components
   */
  async testFetchOrderHistory(): Promise<void> {
    this.isLoadingOrders = true;
    this.orderHistoryError = null;
    this.orderHistory = [];

    try {
      // TODO: Replace these test values with actual tenant and POS IDs from user context
      const tenantId = 'test-tenant-id';
      const posId = 'test-pos-id';

      this.orderHistoryService.getOrderHistory(tenantId, posId, 24).subscribe(
        (orders) => {
          console.log('Order history fetched successfully:', orders);
          this.orderHistory = orders;
          this.isLoadingOrders = false;
        },
        (error) => {
          console.error('Error fetching order history:', error);
          this.orderHistoryError = error.message;
          this.isLoadingOrders = false;
        }
      );
    } catch (error: any) {
      console.error('Exception while fetching order history:', error);
      this.orderHistoryError = error.message;
      this.isLoadingOrders = false;
    }
  }
}
