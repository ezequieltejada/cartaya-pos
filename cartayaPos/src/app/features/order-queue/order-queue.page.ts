import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  IonButton, IonContent, IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSpinner, LoadingController,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronDownCircleOutline, cloudOfflineOutline, refreshOutline, syncOutline, trashOutline } from 'ionicons/icons';
import { NetworkService } from '../../core/services/network.service';
import { LoggerService } from '../../core/services/logger.service';
import { OrderQueueService, QueuedOrder } from '../../core/services/order-queue.service';
import { SyncCoordinatorService } from '../../core/services/sync-coordinator.service';
import { shortOrderRef } from '../../core/utils/order-ref';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-order-queue',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    PageHeaderComponent,
    MoneyPipe,
  ],
  templateUrl: './order-queue.page.html',
  styleUrls: ['./order-queue.page.scss'],
})
export class OrderQueuePage {
  queueService = inject(OrderQueueService);
  syncCoordinator = inject(SyncCoordinatorService);
  networkService = inject(NetworkService);
  private loadingCtrl = inject(LoadingController);
  private notifications = inject(NotificationService);
  private translate = inject(TranslateService);
  private readonly log = inject(LoggerService).scope('order-queue');

  readonly shortRef = shortOrderRef;

  /** Translated reason of the last failed sync (from the stored code, not English text). */
  errorText(order: QueuedOrder): string | null {
    if (order.errorCode === 'SERVER_UNREACHABLE') {
      return this.translate.instant('AUTH.ERRORS.SERVER_UNREACHABLE');
    }
    if (order.errorCode) {
      return this.translate.instant(`API_ERRORS.${order.errorCode}`, order.errorParams ?? {});
    }
    return order.error;
  }

  // Icons
  refreshOutline = refreshOutline;
  syncOutline = syncOutline;
  trashOutline = trashOutline;

  constructor() {
    addIcons({ refreshOutline, syncOutline, trashOutline, chevronDownCircleOutline, cloudOfflineOutline });
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
      this.showToast(this.translate.instant('ORDER_QUEUE.CANNOT_RETRY_OFFLINE'), 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: this.translate.instant('ORDER_QUEUE.RETRYING_ALL'),
      spinner: 'crescent',
    });
    await loading.present();

    try {
      const result = await this.queueService.retryAll();
      await loading.dismiss();

      if (result.successful === result.total) {
        this.showToast(
          this.translate.instant('ORDER_QUEUE.ALL_SYNCED', { count: result.successful }),
          'success'
        );
      } else {
        this.showToast(
          this.translate.instant('ORDER_QUEUE.PARTIAL_SYNCED', {
            successful: result.successful,
            total: result.total,
          }),
          result.successful > 0 ? 'warning' : 'danger'
        );
      }
    } catch (error) {
      await loading.dismiss();
      this.showToast(this.translate.instant('ORDER_QUEUE.RETRY_FAILED'), 'danger');
      this.log.error('Retry all failed', error);
    }
  }

  /**
   * Retry single order
   */
  async retryOne(order: QueuedOrder): Promise<void> {
    if (!this.networkService.getIsOnline()) {
      this.showToast(this.translate.instant('ORDER_QUEUE.CANNOT_RETRY_OFFLINE'), 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: this.translate.instant('ORDER_QUEUE.RETRYING_ONE'),
      spinner: 'crescent',
    });
    await loading.present();

    try {
      const success = await this.queueService.retryOne(order.id);
      await loading.dismiss();

      if (success) {
        this.showToast(this.translate.instant('ORDER_QUEUE.ORDER_SYNCED'), 'success');
      } else {
        this.showToast(this.translate.instant('ORDER_QUEUE.RETRY_FAILED'), 'danger');
      }
    } catch (error) {
      await loading.dismiss();
      this.showToast(this.translate.instant('ORDER_QUEUE.RETRY_FAILED'), 'danger');
      this.log.error('Retry one failed', error);
    }
  }

  /**
   * Remove order from queue
   */
  async removeOrder(order: QueuedOrder): Promise<void> {
    try {
      await this.queueService.remove(order.id);
      this.showToast(this.translate.instant('ORDER_QUEUE.ORDER_REMOVED'), 'success');
    } catch (error) {
      this.showToast(this.translate.instant('ORDER_QUEUE.REMOVE_FAILED'), 'danger');
      this.log.error('Remove failed', error);
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

  /** Badge variant: pending/syncing neutral, failed danger, synced success. */
  statusClass(status: QueuedOrder['status']): 'neutral' | 'danger' | 'success' {
    switch (status) {
      case 'out-of-sync':
        return 'danger';
      case 'synced':
        return 'success';
      default:
        return 'neutral';
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
  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const kind = color === 'danger' ? 'error' : color;
    await this.notifications[kind](message);
  }
}
