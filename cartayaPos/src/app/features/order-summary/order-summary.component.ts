import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import {
    IonButton,
    IonIcon,
    IonSpinner,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { add, checkmark, chevronDown, chevronUp, close, pencil, pencilOutline, remove, trash, trashOutline } from 'ionicons/icons';
import { SelectedModifier } from '../../models/order.model';
import { LoggerService } from '../../core/services/logger.service';
import { MoneyService } from '../../core/services/money.service';
import { MAX_LINE_QUANTITY, OrderService } from '../../core/services/order.service';
import { PosService } from '../../core/services/pos.service';
import { ProductService } from '../../core/services/product.service';
import { SettingsService } from '../../core/services/settings.service';
import { TenantService } from '../../core/services/tenant.service';
import { parseApiError, translateLoadError } from '../../core/utils/api-error';
import { Printer } from '../../services/printer';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { NotificationService } from '../../core/services/notification.service';

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
    MoneyPipe,
    TranslateModule,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
})
export class OrderSummaryComponent {
  private readonly log = inject(LoggerService).scope('order-summary');
  private orderService = inject(OrderService);
  private posService = inject(PosService);
  private tenantService = inject(TenantService);
  private productService = inject(ProductService);
  private settingsService = inject(SettingsService);
  private moneyService = inject(MoneyService);
  private printer = inject(Printer);
  private router = inject(Router);
  private notifications = inject(NotificationService);
  private alertController = inject(AlertController);
  private translate = inject(TranslateService);

  // Expose Math.abs for template use
  Math = Math;

  readonly maxLineQuantity = MAX_LINE_QUANTITY;

  // Reactive data from OrderService (computed signals)
  readonly orderItems = computed(() => {
    const items = this.orderService.orderItems();
    // DEBUG: Step 4 - Order Summary Display
    items.forEach((item, index) => {
      this.log.trace('Order item to display', {
        index,
        itemId: item.id,
        productName: item.productName,
        basePrice: item.basePrice,
        subtotal: item.subtotal,
        modifiersCount: item.modifiers.length,
      });
    });
    return items;
  });
  readonly orderTotal = computed(() => this.orderService.orderTotal());
  readonly itemCount = computed(() => this.orderService.itemCount());
  readonly hasItems = computed(() => this.orderService.hasItems());
  readonly isSubmitting = computed(() => this.orderService.isSubmitting());

  private isShowingCancelConfirmation = false;
  private isShowingCashConfirmation = false;

  constructor() {
    addIcons({ pencil, pencilOutline, trash, trashOutline, close, checkmark, chevronUp, chevronDown, add, remove });
  }

  /**
   * Shows an Ionic confirmation alert and resolves to true when the user accepts.
   * (Ionic alerts instead of native dialogs so they can be styled, translated
   * and driven by automated tests.)
   */
  private async confirm(options: {
    header: string;
    message: string;
    confirmText: string;
    cancelText: string;
    destructive?: boolean;
  }): Promise<boolean> {
    const alert = await this.alertController.create({
      header: options.header,
      message: options.message,
      cssClass: 'order-confirm-alert',
      buttons: [
        { text: options.cancelText, role: 'cancel' },
        {
          text: options.confirmText,
          role: options.destructive ? 'destructive' : 'confirm',
        },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm' || role === 'destructive';
  }

  /**
   * Shows cancel order confirmation
   */
  async showCancelConfirmation(): Promise<void> {
    if (this.isShowingCancelConfirmation) return;
    this.isShowingCancelConfirmation = true;

    try {
      const accepted = await this.confirm({
        header: this.translate.instant('ORDER_SUMMARY.CANCEL_CONFIRMATION'),
        message: this.translate.instant('ORDER_SUMMARY.CANCEL_MESSAGE'),
        confirmText: this.translate.instant('COMMON.BUTTONS.YES'),
        cancelText: this.translate.instant('COMMON.BUTTONS.NO'),
        destructive: true,
      });
      if (accepted) {
        await this.cancelOrder();
      }
    } finally {
      this.isShowingCancelConfirmation = false;
    }
  }

  /**
   * Cancels the current order and clears it
   */
  private async cancelOrder(): Promise<void> {
    this.orderService.clearOrder();
    this.showToast('ORDER_SUMMARY.CANCEL_ORDER');
    
    // Navigate back to products page
    await this.router.navigate(['/products']);
  }

  /**
   * Shows order confirmation with an order summary
   */
  async showCashConfirmation(): Promise<void> {
    if (this.isShowingCashConfirmation) return;
    this.isShowingCashConfirmation = true;

    const itemsText = this.orderItems()
      .map((item) => {
        const qty = item.quantity > 1 ? `${item.quantity} × ` : '';
        return `${qty}${item.productName} - ${this.moneyService.format(item.subtotal ?? 0)}`;
      })
      .join('\n');

    const message = `${this.translate.instant('ORDER_SUMMARY.ITEMS_LABEL')}:\n${itemsText}\n\n${this.translate.instant('ORDER_SUMMARY.TOTAL')}: ${this.moneyService.format(this.orderTotal())}`;

    try {
      const accepted = await this.confirm({
        header: this.translate.instant('ORDER_SUMMARY.COMPLETE_ORDER'),
        message,
        confirmText: this.translate.instant('COMMON.BUTTONS.CONFIRM'),
        cancelText: this.translate.instant('COMMON.BUTTONS.CANCEL'),
      });
      if (accepted) {
        await this.cashOrder();
      }
    } finally {
      this.isShowingCashConfirmation = false;
    }
  }

  /**
   * Submits the order and prints receipt
   * Handles three scenarios:
   * 1. No printer selected: notify user and don't attempt to print
   * 2. Printer selected but manually disconnected: notify user and don't attempt to reconnect
   * 3. Printer selected and disconnected for other reasons: attempt to reconnect and print
   */
  private async cashOrder(): Promise<void> {
    const posId = this.posService.getSelectedPos()?.id;
    const tenantId = this.tenantService.getCurrentTenantId();

    if (!posId || !tenantId) {
      this.showToast('ORDER_SUMMARY.SELECT_POS_TENANT');
      return;
    }

    // Check if a printer is selected
    if (!this.printer.selectedPrinter) {
      this.showToast('ORDER_SUMMARY.NO_PRINTER_SELECTED');
      // Continue with order submission even without printer
      this.submitOrderWithoutPrinter(posId, tenantId);
      return;
    }

    // Check if user manually disconnected from the printer
    if (this.printer.isUserManuallyDisconnected()) {
      this.showToast('ORDER_SUMMARY.PRINTER_DISCONNECTED');
      // Continue with order submission even without printer
      this.submitOrderWithoutPrinter(posId, tenantId);
      return;
    }

    // Printer is selected and was not manually disconnected
    // Try to print if disconnected (device disconnection), or just print if already connected
    this.submitOrderAndPrint(posId, tenantId);
  }

  /**
   * Submits order without attempting to print
   */
  private submitOrderWithoutPrinter(posId: string, tenantId: string): void {
    this.orderService.submitOrder(posId, tenantId).subscribe({
      next: async () => {
        try {
          this.showToast('ORDER_SUMMARY.ORDER_COMPLETED_NO_PRINT');
          // Navigate to products page after successful order
          await this.router.navigate(['/products']);
        } catch (error) {
          this.log.error('Error after order submission', error);
          this.showToast('COMMON.ERRORS.GENERIC');
          await this.router.navigate(['/products']);
        }
      },
      error: (error) => {
        void this.handleSubmitError(error);
      },
    });
  }

  /**
   * Submits order and attempts to print receipt
   */
  private submitOrderAndPrint(posId: string, tenantId: string): void {
    this.orderService.submitOrder(posId, tenantId).subscribe({
      next: async (response) => {
        try {
          // Print receipt (will attempt to reconnect if necessary)
          await this.printReceipt(response);
          this.showToast('ORDER_SUMMARY.ORDER_COMPLETED');
          // Navigate to products page after successful order
          await this.router.navigate(['/products']);
        } catch (error) {
          this.log.error('Error printing receipt', error);
          this.showToast('ORDER_SUMMARY.PRINT_FAILED');
          // Navigate to products even if printing failed
          await this.router.navigate(['/products']);
        }
      },
      error: (error) => {
        void this.handleSubmitError(error);
      },
    });
  }

  /**
   * Prints the receipt using PrinterService
   */
  private async printReceipt(response: any): Promise<void> {
    // Format receipt content
    const receiptContent = this.formatReceipt(response);

    await this.printer.printReceipt(receiptContent);
  }

  /**
   * Formats order response for receipt printing
   */
  private formatReceipt(response: any): string {
    let receipt = '';

    if (response.items && response.items.length > 0) {
      response.items.forEach((item: any) => {
        receipt += `${item.name}\n`;
        if (item.appliedModifiers) {
          item.appliedModifiers.forEach((mod: any) => {
            receipt += ` - ${mod.name}\n`;
          });
        }
        const formattedAmount = this.moneyService.format(item.lineTotal);
        receipt += `Subtotal ------------ ${formattedAmount}\n\n`;
      });
    }

    const formattedTotal = this.moneyService.format(response.totalAmount);
    receipt += `------  Total: ${formattedTotal} ------\n`;
    receipt += `Date: ${new Date().toLocaleString()}\n`;

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
   * Removes an item from the order after asking for confirmation
   */
  async removeItem(itemId: string): Promise<void> {
    const item = this.orderItems().find((i) => i.id === itemId);
    if (!item) return;

    const accepted = await this.confirm({
      header: this.translate.instant('ORDER_SUMMARY.REMOVE_ITEM_TITLE'),
      message: this.translate.instant('ORDER_SUMMARY.REMOVE_ITEM_MESSAGE', { name: item.productName }),
      confirmText: this.translate.instant('COMMON.BUTTONS.DELETE'),
      cancelText: this.translate.instant('COMMON.BUTTONS.CANCEL'),
      destructive: true,
    });
    if (!accepted) return;

    this.orderService.removeItem(itemId);
    this.showToast('ORDER_SUMMARY.ITEM_REMOVED');
  }

  /**
   * Changes the quantity of a cart line by the given step (never below 1;
   * removing a line is done with the trash button).
   */
  changeQuantity(itemId: string, step: number): void {
    const item = this.orderItems().find((i) => i.id === itemId);
    if (!item) return;
    this.orderService.setItemQuantity(itemId, item.quantity + step);
  }

  /**
   * Explains why an order was rejected by the backend, keyed on the API error
   * `code` (translated under API_ERRORS.*), and applies the matching recovery.
   * Rejected orders (4xx) are not network failures and are never queued; the
   * cart is kept so the user can fix it and retry.
   */
  private async handleSubmitError(error: unknown): Promise<void> {
    const { code, params } = parseApiError(error);
    this.log.error('Order submission failed', undefined, { code, params });
    const message = translateLoadError(this.translate, error);

    const alert = await this.alertController.create({
      header: this.translate.instant('ORDER_SUMMARY.ERRORS.TITLE'),
      message,
      buttons: [{ text: this.translate.instant('COMMON.BUTTONS.OK'), role: 'cancel' }],
    });
    await alert.present();
    await alert.onDidDismiss();

    switch (code) {
      case 'POS_NOT_ASSIGNED':
      case 'POS_NOT_FOUND':
        // The PoS is unusable for this user: forget it and let them pick
        // another one. The cart is kept (it lives in OrderService / storage).
        await this.posService.clearSelection();
        await this.router.navigate(['/pos-selection']);
        break;
      case 'CURRENCY_MISMATCH':
      case 'TOTAL_MISMATCH':
      case 'PRICE_NOT_FOUND':
        this.refreshPrices();
        break;
      case 'PRODUCT_NOT_FOUND':
      case 'PRODUCT_INACTIVE':
        this.removeLinesWhere((item) => item.productId === params['productId']);
        break;
      case 'MODIFIER_NOT_FOUND':
      case 'MODIFIER_INACTIVE':
      case 'MODIFIER_NOT_ATTACHED':
        this.removeLinesWhere((item) =>
          (item.modifiers ?? []).some((m) => m.modifierId === params['modifierId'])
        );
        break;
      default:
        break;
    }
  }

  /** Reloads catalog prices and tenant currency after a price/currency rejection. */
  private refreshPrices(): void {
    const tenantId = this.tenantService.getCurrentTenantId();
    if (!tenantId) return;
    this.settingsService.loadTenantSettings(tenantId);
    this.productService.fetchProductsWithPrices(tenantId, true).subscribe({
      error: (err) => this.log.error('Failed to refresh prices', err),
    });
  }

  /** Removes the cart lines rejected by the backend (ids come from error params). */
  private removeLinesWhere(
    predicate: (item: { productId: string; modifiers?: SelectedModifier[] }) => boolean
  ): void {
    this.orderItems()
      .filter((item) => predicate(item) && item.id)
      .forEach((item) => this.orderService.removeItem(item.id as string));
  }

  /**
   * Shows a toast notification
   */
  private async showToast(messageKey: string): Promise<void> {
    const message = this.translate.instant(messageKey);
    const warnings = [
      'ORDER_SUMMARY.SELECT_POS_TENANT',
      'ORDER_SUMMARY.NO_PRINTER_SELECTED',
      'ORDER_SUMMARY.PRINTER_DISCONNECTED',
      'ORDER_SUMMARY.ORDER_COMPLETED_NO_PRINT',
    ];
    const errors = ['COMMON.ERRORS.GENERIC', 'ORDER_SUMMARY.PRINT_FAILED'];
    if (messageKey === 'ORDER_SUMMARY.ORDER_COMPLETED') {
      await this.notifications.success(message);
    } else if (warnings.includes(messageKey)) {
      await this.notifications.warning(message);
    } else if (errors.includes(messageKey)) {
      await this.notifications.error(message);
    } else {
      await this.notifications.info(message);
    }
  }

  /**
   * Tracks items by their ID for better change detection
   */
  trackByItemId(index: number, item: any): string {
    return item.id;
  }

   /**
     * Calculates the actual billable charge for a modifier
     * 
     * Formula:
     *   billableQuantity = max(0, selectedQuantity - includedQuantity)
     *   charge = billableQuantity × priceDelta
     * 
     * The includedQuantity field allows for "bundled" quantities where customers
     * only pay for quantities exceeding the included amount (e.g., "first 2 sauces free").
     * 
     * @param modifier The modifier with quantity, includedQuantity, and priceDelta
     * @returns The actual billable charge (can be 0 if all units are included)
     */
    calculateModifierCharge(modifier: SelectedModifier): number {
      const includedQuantity = modifier.includedQuantity ?? 0;
      const billableQuantity = Math.max(0, modifier.quantity - includedQuantity);
      return billableQuantity * modifier.priceDelta;
    }

    /**
     * Formats modifier pricing for display
     * 
     * Shows:
     * - "(included)" when the modifier's billableQuantity = 0 (no charge)
     * - "(-$X.XX)" or "(+$X.XX)" with proper currency symbol when there is an actual charge
     * 
     * The priceDelta shown reflects the actual cost after accounting for includedQuantity.
     * This ensures users see accurate pricing info in the order summary.
     * 
     * @param modifier The modifier with quantity, includedQuantity, and priceDelta
     * @returns Formatted string like "(included)", "(+€1.50)", or "(-$0.50)"
     */
    formatModifierPrice(modifier: SelectedModifier): string {
      const charge = this.calculateModifierCharge(modifier);
      
      // If billableQuantity is 0, show "(included)"
      if (charge === 0) {
        return '(included)';
      }
      
      // Otherwise, show the actual charge with sign and tenant currency
      return `(${this.moneyService.format(charge, { signed: true })})`;
    }

    /**
     * Get items with debug logging
     * DEBUG: Step 4 - Order Summary Display
     */
    get displayItems(): any[] {
      const items = this.orderItems();
      items.forEach((item, index) => {
        this.log.trace('Order item to display', {
          index,
          itemId: item.id,
          productName: item.productName,
          basePrice: item.basePrice,
          subtotal: item.subtotal,
          modifiersCount: item.modifiers.length,
        });
      });
      return items;
    }
}
