import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline } from 'ionicons/icons';
import { NetworkService } from '../../../core/services/network.service';

@Component({
  selector: 'app-network-status',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    @if (!networkService.isOnline()) {
      <div class="network-banner warning">
        <ion-icon [icon]="cloudOfflineOutline"></ion-icon>
        <div>
          <strong>You're offline</strong>
          <p>Orders will be queued and synced when back online</p>
        </div>
      </div>
    }
  `,
  styles: [`
    .network-banner {
      position: sticky;
      top: 0;
      z-index: 1000;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      
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
  
  constructor() {
    addIcons({ cloudOfflineOutline });
  }
}
