import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonMenuButton,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  LoadingController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronDownCircleOutline, refreshOutline, syncOutline, trashOutline } from 'ionicons/icons';
import { NetworkService } from '../../core/services/network.service';
import { OrderQueueService, QueuedOrder } from '../../core/services/order-queue.service';
import { SyncCoordinatorService } from '../../core/services/sync-coordinator.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-order-queue',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonButtons,
    IonMenuButton,
    PageHeaderComponent,
  ],
  templateUrl: './order-queue.page.html',
  styleUrls: ['./order-queue.page.scss'],
})
export class OrderQueuePage implements OnInit {
  queueService = inject(OrderQueueService);
  syncCoordinator = inject(SyncCoordinatorService);
  networkService = inject(NetworkService);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);

  // Icons
  refreshOutline = refreshOutline;
  syncOutline = syncOutline;
  trashOutline = trashOutline;

  constructor() {
    addIcons({ refreshOutline, syncOutline, trashOutline, chevronDownCircleOutline });
  }

  ngOnInit(): void {
    // Queue already loaded by service
  }

  /**
   * Pull-to-refresh handler
   */
  async handleRefresh(event: any): Promise<void> {
    if (this.networkService.getIsOnline()) {
      await this.syncCoordinator.syncQueue();
    }
    event.target.complete();
  }

  /**
   * Retry all queued orders
   */
  async retryAll(): Promise<void> {
    if (!this.networkService.getIsOnline()) {
      this.showToast('Cannot retry while offline', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Retrying all orders...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      const result = await this.queueService.retryAll();
      await loading.dismiss();

      if (result.successful === result.total) {
        this.showToast(`All ${result.successful} orders synced!`, 'success');
      } else {
        this.showToast(
          `${result.successful}/${result.total} orders synced`,
          result.successful > 0 ? 'warning' : 'danger'
        );
      }
    } catch (error) {
      await loading.dismiss();
      this.showToast('Retry failed', 'danger');
      console.error('Retry all failed:', error);
    }
  }

  /**
   * Retry single order
   */
  async retryOne(order: QueuedOrder): Promise<void> {
    if (!this.networkService.getIsOnline()) {
      this.showToast('Cannot retry while offline', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Retrying order...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      const success = await this.queueService.retryOne(order.id);
      await loading.dismiss();

      if (success) {
        this.showToast('Order synced successfully!', 'success');
      } else {
        this.showToast('Retry failed', 'danger');
      }
    } catch (error) {
      await loading.dismiss();
      this.showToast('Retry failed', 'danger');
      console.error('Retry one failed:', error);
    }
  }

  /**
   * Remove order from queue
   */
  async removeOrder(order: QueuedOrder): Promise<void> {
    try {
      await this.queueService.remove(order.id);
      this.showToast('Order removed from queue', 'success');
    } catch (error) {
      this.showToast('Failed to remove order', 'danger');
      console.error('Remove failed:', error);
    }
  }

  /**
   * Get status color for badge
   */
  getStatusColor(status: QueuedOrder['status']): string {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'syncing':
        return 'primary';
      case 'out-of-sync':
        return 'danger';
      case 'synced':
        return 'success';
      default:
        return 'medium';
    }
  }

  /**
   * Format timestamp
   */
  formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleString();
  }

  /**
   * Show toast notification
   */
  private async showToast(message: string, color: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
