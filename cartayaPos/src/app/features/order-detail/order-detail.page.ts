import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
  LoadingController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, arrowBack, printOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { PosService } from '../../core/services/pos.service';
import { ProductService } from '../../core/services/product.service';
import { TenantService } from '../../core/services/tenant.service';
import { Order, OrderItem, SelectedModifier } from '../../models/order.model';
import { OrderHistoryService } from '../../services/order-history.service';
import { Printer } from '../../services/printer';

@Component({
  selector: 'app-order-detail',
  templateUrl: './order-detail.page.html',
  styleUrls: ['./order-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonTitle,
    IonList,
    IonItem,
    IonLabel,
    IonCard,
    IonCardContent,
    IonSpinner,
  ],
})
export class OrderDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private orderHistoryService = inject(OrderHistoryService);
  private tenantService = inject(TenantService);
  private posService = inject(PosService);
  private productService = inject(ProductService);
  private router = inject(Router);
  private printerService = inject(Printer);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);

  // Reactive state
  order = signal<Order | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  isPrinting = signal(false);

  constructor() {
    addIcons({arrowBack,printOutline,alertCircleOutline});
  }

  ngOnInit(): void {
    this.loadOrder();
  }

  /**
   * Load order details from the backend
   * Fetches the full order data including items and modifiers
   */
  async loadOrder(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const orderId = this.route.snapshot.paramMap.get('orderId');
      const tenantId = this.tenantService.getCurrentTenantId();
      const selectedPos = this.posService.getSelectedPos();

      if (!orderId || !tenantId || !selectedPos) {
        this.error.set('Missing required information to load order details');
        this.isLoading.set(false);
        return;
      }

      // Fetch all orders from last 24 hours and find the matching one
      const orders = await firstValueFrom(
        this.orderHistoryService.getOrderHistory(tenantId, selectedPos.id, 24)
      );

      const foundOrder = orders.find(
        (o) => (o.id || o.orderId) === orderId
      );

      if (!foundOrder) {
        this.error.set('Order not found');
        this.isLoading.set(false);
        return;
      }

      // Enrich order with product names
      const enrichedOrder = await this.enrichOrderWithProductNames(foundOrder, tenantId);
      this.order.set(enrichedOrder);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to load order details';
      this.error.set(errorMsg);
      console.error('Error loading order:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Enrich order items with product names from the product catalog
   * The order history API doesn't include product names, so we fetch them from ProductService
   * This ensures receipts display proper product names instead of generic fallbacks
   *
   * @param order The order to enrich
   * @param tenantId The tenant ID for fetching products
   * @returns Promise<Order> with productName populated for all items
   */
  private async enrichOrderWithProductNames(order: Order, tenantId: string): Promise<Order> {
    try {
      // Fetch all products for this tenant using ProductService
      const products = await firstValueFrom(
        this.productService.fetchProducts(tenantId)
      );

      // Build map of productId -> productName for quick lookup
      const productNameMap = new Map<string, string>();
      products.forEach(product => {
        productNameMap.set(product.id, product.name);
      });

      // Enrich order items with product names
      const enrichedItems = order.items.map(item => ({
        ...item,
        productName: productNameMap.get(item.productId) || item.productName || `Item (${item.productId.substring(0, 8)})`
      }));

      return {
        ...order,
        items: enrichedItems
      };
    } catch (error) {
      console.warn('Failed to enrich order with product names, using fallback:', error);
      // Return order as-is if enrichment fails - receipt will use fallback names
      return order;
    }
  }

  /**
   * Calculate the total for a single order item
   * Formula: (basePrice + Σ(modifier.priceDelta × quantity)) × quantity
   *
   * @param item The order item to calculate total for
   * @returns The calculated subtotal
   */
  getItemTotal(item: OrderItem): number {
    // Use subtotal if available (from draft orders), otherwise calculate from components
    if (item.subtotal !== undefined) {
      return item.subtotal;
    }

    if (item.lineTotal !== undefined) {
      // lineTotal is in cents, convert to decimal
      return item.lineTotal / 100;
    }

    // Calculate from base price and modifiers
    const basePrice = this.getItemBasePrice(item);
    const modifiersTotal = this.getModifierSubtotal(item.modifiers || []);

    return (basePrice + modifiersTotal) * item.quantity;
  }

  /**
   * Get the base price for an item
   * Handles both priceCentsSnapshot (cents) and basePrice (decimal)
   *
   * @param item The order item
   * @returns The base price in decimal format
   */
  getItemBasePrice(item: OrderItem): number {
    if (item.priceCentsSnapshot !== undefined) {
      return item.priceCentsSnapshot / 100;
    }
    return item.basePrice || 0;
  }

  /**
   * Calculate the total for all modifiers on an item
   * Handles both priceDeltaCents (cents) and priceDelta (decimal)
   *
   * @param modifiers Array of modifiers for the item
   * @returns The total modifier price in decimal format
   */
  getModifierSubtotal(modifiers: (SelectedModifier | any)[]): number {
    if (!modifiers || modifiers.length === 0) {
      return 0;
    }

    return modifiers.reduce((sum, mod) => {
      const priceDelta = mod.priceDeltaCents
        ? mod.priceDeltaCents / 100
        : mod.priceDelta || 0;
      return sum + priceDelta * (mod.quantity || 1);
    }, 0);
  }

  /**
   * Navigate back to order history
   */
  goBack(): void {
    this.router.navigate(['/order-history']);
  }

  /**
   * Get the badge color based on order status
   * Used for visual status indication
   *
   * @param status The order status
   * @returns Ionic color value for the badge
   */
  getStatusBadgeColor(status?: string): string {
    switch (status) {
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'warning';
      case 'refunded':
        return 'danger';
      default:
        return 'medium';
    }
  }

  /**
   * Trigger manual print for the historical order
   * Checks printer connection, formats order data, sends to printer
   * Provides user feedback through loading indicator and toast notifications
   */
  async printOrder(): Promise<void> {
    // Check if order is loaded
    if (!this.order()) {
      await this.showError('No order loaded');
      return;
    }

    // Check printer connection first
    if (!this.printerService.isConnected) {
      await this.showError(
        'Printer not connected. Please connect printer in Settings.'
      );
      return;
    }

    this.isPrinting.set(true);
    const loading = await this.loadingCtrl.create({
      message: 'Printing...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      // Format order data for receipt
      const receiptData = this.formatOrderForReceipt(this.order()!);

      // Send to printer
      await this.printerService.printReceipt(receiptData);

      await loading.dismiss();
      await this.showSuccess('Receipt printed successfully');
    } catch (error) {
      await loading.dismiss();
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error occurred';
      await this.showError(`Failed to print receipt: ${errorMsg}`);
      console.error('Print error:', error);
    } finally {
      this.isPrinting.set(false);
    }
  }

  /**
   * Format order data into receipt template for printing
   * Converts Order model to formatted receipt string with REPRINT indicator
   *
   * @param order The order to format
   * @returns Formatted receipt string ready for printer
   */
  private formatOrderForReceipt(order: Order): string {
    const lines: string[] = [];

    // Add reprint indicator
    lines.push('*** REPRINT ***');
    lines.push('');

    // Header
    lines.push('================================');
    lines.push(`Order #: ${order.orderId || order.id}`);
    lines.push(`Date: ${order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}`);
    lines.push(`Status: ${(order.status || 'Received').toUpperCase()}`);
    lines.push('================================');
    lines.push('');

    // Items section
    lines.push('ITEMS:');
    lines.push('');

    for (const item of order.items) {
      // Use enriched productName if available
      const productName = item.productName && item.productName !== 'Unknown Product' 
        ? item.productName 
        : `Item (${item.productId.substring(0, 8)})`;
      const basePrice = this.getItemBasePrice(item);
      const itemTotal = this.getItemTotal(item);

      lines.push(`${productName}`);
      lines.push(`  Qty: ${item.quantity} x ${basePrice.toFixed(2)}`);

      // Add modifiers if present
      // Note: API response includes modifiers with name and priceDeltaCents
      // Each modifier is listed once with its price delta
      if (item.modifiers && item.modifiers.length > 0) {
        for (const modifier of item.modifiers) {
          const modPrice = modifier.priceDeltaCents
            ? modifier.priceDeltaCents / 100
            : modifier.priceDelta || 0;
          lines.push(`  + ${modifier.name}: ${modPrice > 0 ? '+' : ''}${modPrice.toFixed(2)}`);
        }
      }

      lines.push(`  Subtotal: ${itemTotal.toFixed(2)}`);
      lines.push('');
    }

    // Summary section
    lines.push('================================');
    lines.push(`Subtotal:            ${order.totalAmount.toFixed(2)}`);
    lines.push(`Total:               ${order.totalAmount.toFixed(2)}`);
    lines.push(`Currency:            ${order.currency}`);
    lines.push('================================');
    lines.push('');
    lines.push('Thank you for your purchase!');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Display success toast notification
   */
  private async showSuccess(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color: 'success',
      position: 'bottom',
      icon: 'checkmark-circle-outline',
    });
    await toast.present();
  }

  /**
   * Display error toast notification
   */
  private async showError(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      color: 'danger',
      position: 'bottom',
      icon: 'alert-circle-outline',
      buttons: [{ text: 'Dismiss', role: 'cancel' }],
    });
    await toast.present();
  }

  /**
   * Placeholder for print functionality (deprecated)
   * Now handled by printOrder() method
   */
  onPrint(): void {
    this.printOrder();
  }

  /**
   * Retry loading the order after an error
   */
  retryLoadOrder(): void {
    this.loadOrder();
  }
}
