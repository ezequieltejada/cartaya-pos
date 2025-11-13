import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonBadge, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, cloudUploadOutline } from 'ionicons/icons';
import { OrderQueueService } from '../../../core/services/order-queue.service';

@Component({
  selector: 'app-queue-badge',
  standalone: true,
  imports: [CommonModule, IonIcon, IonBadge],
  template: `
    @if (queueService.totalQueueSize() > 0) {
      <button (click)="navigateToQueue()" class="queue-badge-container" [attr.aria-label]="'Queue with ' + queueService.pendingCount() + ' items'">
        <ion-icon [icon]="getIcon()"></ion-icon>
        <ion-badge>{{ queueService.pendingCount() }}</ion-badge>
      </button>
    }
  `,
  styles: [`
    .queue-badge-container {
      position: relative;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      padding: 8px;
      margin: 0;
      
      ion-icon {
        font-size: 24px;
      }
      
      ion-badge {
        position: absolute;
        top: -4px;
        right: -8px;
        font-size: 10px;
        min-width: 16px;
        height: 16px;
        border-radius: 8px;
      }

      &:active {
        opacity: 0.7;
      }
    }
  `],
})
export class QueueBadgeComponent {
  queueService = inject(OrderQueueService);
  private router = inject(Router);
  
  cloudUploadOutline = cloudUploadOutline;
  alertCircleOutline = alertCircleOutline;

  constructor() {
    addIcons({ cloudUploadOutline, alertCircleOutline });
  }

  navigateToQueue(): void {
    this.router.navigate(['/order-queue']);
  }

  /**
   * Get icon based on queue status
   * Red alert icon if out-of-sync orders exist, otherwise upload icon
   */
  getIcon(): string {
    const hasOutOfSync = this.queueService.outOfSyncCount() > 0;
    return hasOutOfSync ? this.alertCircleOutline : this.cloudUploadOutline;
  }
}
