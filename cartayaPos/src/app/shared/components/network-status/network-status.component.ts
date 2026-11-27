import { Component, effect, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { NetworkService } from '../../../core/services/network.service';
import { NotificationService } from '../../../core/services/notification.service';

const OFFLINE_NOTICE_ID = 'network-offline';

/**
 * Renders nothing. While the device is offline it keeps a persistent warning toast
 * (through NotificationService) and dismisses it as soon as the connection is back.
 */
@Component({
  selector: 'app-network-status',
  standalone: true,
  template: '',
})
export class NetworkStatusComponent {
  readonly networkService = inject(NetworkService);
  private readonly notifications = inject(NotificationService);
  private readonly translate = inject(TranslateService);

  constructor() {
    effect(() => {
      if (this.networkService.isOnline()) {
        void this.notifications.dismiss(OFFLINE_NOTICE_ID);
        return;
      }
      void this.notifications.warning(
        `${this.translate.instant('COMMON.NETWORK.OFFLINE_TITLE')}. ${this.translate.instant('COMMON.NETWORK.OFFLINE_MESSAGE')}`,
        {
          id: OFFLINE_NOTICE_ID,
          duration: 0,
          icon: 'cloud-offline-outline',
          dismissText: this.translate.instant('COMMON.NETWORK.DISMISS'),
        }
      );
    });
  }
}
