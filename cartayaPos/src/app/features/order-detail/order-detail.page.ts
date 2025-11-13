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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, arrowBack, printOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { PosService } from '../../core/services/pos.service';
import { TenantService } from '../../core/services/tenant.service';
import { Order, OrderItem, SelectedModifier } from '../../models/order.model';
import { OrderHistoryService } from '../../services/order-history.service';

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
  private router = inject(Router);

  // Reactive state
  order = signal<Order | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);

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

      this.order.set(foundOrder);
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
   * Placeholder for print functionality
   * Can be implemented later with actual printer integration
   */
  onPrint(): void {
    console.log('Print button clicked. Ready for integration with PrinterService');
    // TODO: Integrate with PrinterService when available
  }

  /**
   * Retry loading the order after an error
   */
  retryLoadOrder(): void {
    this.loadOrder();
  }
}
