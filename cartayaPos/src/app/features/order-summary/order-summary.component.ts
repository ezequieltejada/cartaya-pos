import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Dialog } from '@capacitor/dialog';
import { AlertController, ToastController } from '@ionic/angular';
import {
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmark, chevronDown, chevronUp, close, pencil, trash } from 'ionicons/icons';
import { OrderService } from '../../core/services/order.service';
import { PosService } from '../../core/services/pos.service';
import { TenantService } from '../../core/services/tenant.service';
import { Printer } from '../../services/printer';

/**
 * OrderSummaryComponent
 * Displays the current order and provides actions for order management
 * Responsive: bottom sheet on mobile, side panel on tablet/desktop
 */
@Component({
  selector: 'app-order-summary',
  templateUrl: './order-summary.component.html',
  styleUrls: ['./order-summary.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonText,
    IonIcon,
    IonSpinner,
  ],
})
export class OrderSummaryComponent implements OnInit, OnDestroy {
  private orderService = inject(OrderService);
  private posService = inject(PosService);
  private tenantService = inject(TenantService);
  private printer = inject(Printer);
  private router = inject(Router);
  private toastController = inject(ToastController);
  private alertController = inject(AlertController);

  // Expose Math.abs for template use
  Math = Math;

  // Reactive data from OrderService (computed signals)
  readonly orderItems = computed(() => this.orderService.orderItems());
  readonly orderTotal = computed(() => this.orderService.orderTotal());
  readonly itemCount = computed(() => this.orderService.itemCount());
  readonly hasItems = computed(() => this.orderService.hasItems());
  readonly isSubmitting = computed(() => this.orderService.isSubmitting());

  constructor() {
    addIcons({ pencil, trash, close, checkmark, chevronUp, chevronDown });
  }

  ngOnInit(): void {
    // Component initialization if needed
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  /**
   * Shows cancel order confirmation modal
   * Uses native Dialog plugin on iOS/Android, falls back to Ionic AlertController on web
   */
  async showCancelConfirmation(): Promise<void> {
    try {
      const { value } = await Dialog.confirm({
        title: 'Cancel Order',
        message: 'Are you sure? This will clear all items.',
        okButtonTitle: 'Yes',
        cancelButtonTitle: 'No',
      });

      if (value) {
        await this.cancelOrder();
      }
    } catch (error) {
      // Fallback to Ionic AlertController if Dialog is not available
      console.warn('Dialog plugin not available, using Ionic AlertController:', error);
      const alert = await this.alertController.create({
        header: 'Cancel Order',
        message: 'Are you sure? This will clear all items.',
        buttons: [
          {
            text: 'No',
            role: 'cancel',
          },
          {
            text: 'Yes',
            role: 'destructive',
            handler: async () => {
              await this.cancelOrder();
            },
          },
        ],
      });

      await alert.present();
    }
  }

  /**
   * Cancels the current order and clears it
   */
  private async cancelOrder(): Promise<void> {
    this.orderService.clearOrder();
    this.showToast('Order cancelled', 'bottom');
    
    // Navigate back to products page
    await this.router.navigate(['/products']);
  }

  /**
   * Shows cash order confirmation modal with order summary
   * Uses native Dialog plugin on iOS/Android, falls back to Ionic AlertController on web
   */
  async showCashConfirmation(): Promise<void> {
    const total = this.orderTotal().toFixed(2);
    const itemsText = this.orderItems()
      .map((item) => `${item.productName} - $${item.subtotal.toFixed(2)}`)
      .join('\n');

    try {
      const { value } = await Dialog.confirm({
        title: 'Complete Order',
        message: `Items:\n${itemsText}\n\nTotal: $${total}`,
        okButtonTitle: 'Confirm',
        cancelButtonTitle: 'Cancel',
      });

      if (value) {
        await this.cashOrder();
      }
    } catch (error) {
      // Fallback to Ionic AlertController if Dialog is not available
      console.warn('Dialog plugin not available, using Ionic AlertController:', error);
      const alert = await this.alertController.create({
        header: 'Complete Order',
        message: `Items:\n${itemsText}\n\nTotal: $${total}`,
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
          },
          {
            text: 'Confirm',
            handler: async () => {
              await this.cashOrder();
            },
          },
        ],
      });

      await alert.present();
    }
  }

  /**
   * Submits the order and prints receipt
   */
  private async cashOrder(): Promise<void> {
    const posId = this.posService.getSelectedPos()?.id;
    const tenantId = this.tenantService.getCurrentTenantId();

    if (!posId || !tenantId) {
      this.showToast('Please select PoS and Tenant', 'top');
      return;
    }

    // Subscribe to order submission
    this.orderService.submitOrder(posId, tenantId).subscribe({
      next: async (response) => {
        try {
          // Print receipt
          await this.printReceipt(response);
          this.showToast('Order completed!', 'top');
          // Navigate to products page after successful order
          await this.router.navigate(['/products']);
        } catch (error) {
          console.error('Error printing receipt:', error);
          this.showToast('Order saved but print failed', 'top');
          // Navigate to products even if printing failed
          await this.router.navigate(['/products']);
        }
      },
      error: (error) => {
        console.error('Order submission failed:', error);
        this.showToast('Order failed. Please try again.', 'top');
      },
    });
  }

  /**
   * Prints the receipt using PrinterService
   */
  private async printReceipt(response: any): Promise<void> {
    // Format receipt content
    const receiptContent = this.formatReceipt(response);

    // For now, just log the receipt (actual printing depends on PrinterService implementation)
    console.log('Receipt to print:', receiptContent);

    // In a real implementation, you would call:
    // await this.printer.printReceipt(receiptContent);
  }

  /**
   * Formats order response for receipt printing
   */
  private formatReceipt(response: any): string {
    let receipt = '========== RECEIPT ==========\n';

    if (response.items && response.items.length > 0) {
      response.items.forEach((item: any) => {
        receipt += `\n${item.productId}\n`;
        receipt += `Qty: 1\n`;
        receipt += `Total: $${item.lineTotal.toFixed(2)}\n`;
        if (item.appliedModifiers) {
          item.appliedModifiers.forEach((mod: any) => {
            receipt += `  - ${mod.name}: +$${mod.priceDelta.toFixed(2)}\n`;
          });
        }
      });
    }

    receipt += `\n=============================\n`;
    receipt += `Total: $${response.totalAmount.toFixed(2)}\n`;
    receipt += `Date: ${new Date().toLocaleString()}\n`;
    receipt += `=============================\n`;

    return receipt;
  }

  /**
   * Navigates to modifiers page to edit an item
   */
  async editItem(itemId: string): Promise<void> {
    const item = this.orderItems().find((i) => i.id === itemId);
    if (!item) return;

    // Navigate to modifiers page with item context
    await this.router.navigate(['/products', item.productId, 'modifiers'], {
      state: {
        itemId: item.id,
        selectedModifiers: item.modifiers,
        isEditing: true,
      },
    });
  }

  /**
   * Removes an item from the order
   */
  async removeItem(itemId: string): Promise<void> {
    this.orderService.removeItem(itemId);
    this.showToast('Item removed', 'bottom');
    // Menu will be closed automatically by the effect watching hasItems
  }

  /**
   * Shows a toast notification
   */
  private async showToast(message: string, position: 'top' | 'middle' | 'bottom'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position,
    });
    await toast.present();
  }

  /**
   * Tracks items by their ID for better change detection
   */
  trackByItemId(index: number, item: any): string {
    return item.id;
  }

  /**
   * Formats modifier price delta with sign and currency
   * @param priceDelta The price change (positive for add-ons, negative for discounts)
   * @returns Formatted string like "+$1.50" or "-$0.50"
   */
  formatModifierPrice(priceDelta: number): string {
    const sign = priceDelta >= 0 ? '+' : '';
    return `${sign}$${Math.abs(priceDelta).toFixed(2)}`;
  }
}
