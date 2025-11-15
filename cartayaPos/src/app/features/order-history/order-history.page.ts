import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton, IonContent, IonIcon,
  IonItem,
  IonLabel,
  IonList, IonRefresher,
  IonRefresherContent,
  IonSpinner, RefresherEventDetail
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronDownCircleOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { PosService } from '../../core/services/pos.service';
import { TenantService } from '../../core/services/tenant.service';
import { Order } from '../../models/order.model';
import { OrderHistoryService } from '../../services/order-history.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonButton,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    PageHeaderComponent,
  ],
  templateUrl: './order-history.page.html',
  styleUrls: ['./order-history.page.scss'],
})
export class OrderHistoryPage implements OnInit {
  private orderHistoryService = inject(OrderHistoryService);
  private posService = inject(PosService);
  private tenantService = inject(TenantService);
  private router = inject(Router);

  // Reactive state using signals
  orders = signal<Order[]>([]);
  isLoading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    addIcons({ chevronDownCircleOutline });
  }

  ngOnInit(): void {
    this.loadOrders();
  }

  /**
   * Load order history from the backend
   * Called on page init and when user pulls to refresh
   * Handles loading, error, and empty states
   */
  async loadOrders(event?: CustomEvent<RefresherEventDetail>): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const tenantId = this.tenantService.getCurrentTenantId();
      const selectedPos = this.posService.getSelectedPos();

      if (!tenantId || !selectedPos) {
        this.error.set('Tenant or POS information is missing');
        this.isLoading.set(false);
        return;
      }

      // Fetch orders from the last 24 hours
      const orders = await firstValueFrom(
        this.orderHistoryService.getOrderHistory(tenantId, selectedPos.id)
      );

      // Filter out orders without createdAt and sort in reverse chronological order (newest first)
      const filteredOrders = orders
        .filter(order => !!order.createdAt)
        .sort(
          (a, b) =>
            new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime()
        );

      this.orders.set(filteredOrders);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to load order history';
      this.error.set(errorMsg);
      console.error('Error loading orders:', err);
    } finally {
      this.isLoading.set(false);

      // Complete the refresh event if it exists
      if (event?.target) {
        (event.target as any).complete();
      }
    }
  }

  async onRefresh(event: CustomEvent<RefresherEventDetail>): Promise<void> {
    await this.loadOrders(event);
  }

  /**
   * Navigate to order detail view
   * @param order The order to view details for
   */
  openOrderDetail(order: Order): void {
    const orderId = order.id || order.orderId;
    if (orderId) {
      this.router.navigate(['/order-history', orderId]);
    }
  }

  /**
   * Retry loading orders after an error
   */
  retryLoadOrders(): void {
    this.loadOrders();
  }

  /**
   * Get the status badge color based on order status
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
}
