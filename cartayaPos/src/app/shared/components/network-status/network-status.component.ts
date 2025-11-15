import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { close, cloudOfflineOutline } from 'ionicons/icons';
import { NetworkService } from '../../../core/services/network.service';

@Component({
  selector: 'app-network-status',
  standalone: true,
  imports: [CommonModule, IonIcon, IonButton],
  template: `
    @if (!networkService.isOnline() && isVisible()) {
      <div class="network-banner warning">
        <div class="banner-content">
          <ion-icon [icon]="cloudOfflineOutline"></ion-icon>
          <div>
            <strong>You're offline</strong>
            <p>Orders will be queued and synced when back online</p>
          </div>
        </div>
        <button class="close-button" (click)="closeBanner()" aria-label="Close banner">
          <ion-icon [icon]="closeIcon"></ion-icon>
        </button>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }

    .network-banner {
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
      box-sizing: border-box;
      
      .banner-content {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
      }
      
      ion-icon {
        font-size: 24px;
        flex-shrink: 0;
      }
      
      p {
        margin: 4px 0 0;
        font-size: 12px;
        opacity: 0.9;
      }
      
      strong {
        display: block;
        margin-bottom: 4px;
      }

      .close-button {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        color: inherit;
        
        ion-icon {
          font-size: 20px;
          margin: 0;
        }
        
        &:hover {
          opacity: 0.7;
        }
      }

      &.warning {
        background-color: var(--ion-color-warning);
        color: var(--ion-color-warning-contrast);
      }
    }
  `],
})
export class NetworkStatusComponent {
  networkService = inject(NetworkService);
  cloudOfflineOutline = cloudOfflineOutline;
  closeIcon = close;
  isVisible = signal(true);
  
  constructor() {
    addIcons({ cloudOfflineOutline, close });
  }

  closeBanner(): void {
    this.isVisible.set(false);
  }
}
