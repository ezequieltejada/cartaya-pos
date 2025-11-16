import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  IonBadge,
  IonButton, IonContent, IonIcon,
  IonItem,
  IonLabel,
  IonList, IonRefresher,
  IonRefresherContent,
  IonSpinner, LoadingController,
  ToastController
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
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
    TranslateModule,
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
    PageHeaderComponent,
  ],
  templateUrl: './order-queue.page.html',
  styleUrls: ['./order-queue.page.scss'],
})
export class OrderQueuePage {
  queueService = inject(OrderQueueService);
  syncCoordinator = inject(SyncCoordinatorService);
  networkService = inject(NetworkService);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private translate = inject(TranslateService);

  // Icons
  refreshOutline = refreshOutline;
  syncOutline = syncOutline;
  trashOutline = trashOutline;

  constructor() {
    addIcons({ refreshOutline, syncOutline, trashOutline, chevronDownCircleOutline });
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
   * Get translated status text
   */
  getTranslatedStatus(status: QueuedOrder['status']): string {
    const statusKey = `ORDER_QUEUE.STATUS.${status.toUpperCase().replace('-', '_')}`;
    return this.translate.instant(statusKey);
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
