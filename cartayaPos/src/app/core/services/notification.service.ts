import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  cloudOfflineOutline,
  cloudUploadOutline,
  informationCircleOutline,
  printOutline,
  warningOutline,
} from 'ionicons/icons';

export type NotificationKind = 'success' | 'error' | 'warning' | 'info';

export interface NotificationAction {
  text: string;
  handler: () => void;
}

export interface NotificationOptions {
  /** Auto-dismiss time in ms. Omit for the kind's default; `0` keeps it until dismissed. */
  duration?: number;
  /** Toasts sit at the top by default so they never cover the sticky bottom bars. */
  position?: 'top' | 'middle' | 'bottom';
  /** Replaces any visible notification with the same id (e.g. the persistent "offline" notice). */
  id?: string;
  /** Overrides the default icon of the kind. */
  icon?: string;
  /** Label for the dismiss button. Pass an already translated string; omit for no button. */
  dismissText?: string;
  /** Optional call to action ("Retry", "Go to settings"). */
  action?: NotificationAction;
}

const DEFAULTS: Record<NotificationKind, { color: string; icon: string; duration: number }> = {
  success: { color: 'success', icon: 'checkmark-circle-outline', duration: 2000 },
  error: { color: 'danger', icon: 'alert-circle-outline', duration: 4000 },
  warning: { color: 'warning', icon: 'warning-outline', duration: 3000 },
  info: { color: 'medium', icon: 'information-circle-outline', duration: 3000 },
};

/**
 * Single entry point for user notifications. Everything is shown as an Ionic toast,
 * styled once in `src/theme/variables.scss` (class `cartaya-toast`).
 * Callers pass already translated messages.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly toastController = inject(ToastController);
  private readonly visible = new Map<string, HTMLIonToastElement>();

  constructor() {
    // Toast icons are referenced by name, so they must be registered once.
    addIcons({
      alertCircleOutline,
      checkmarkCircleOutline,
      cloudOfflineOutline,
      cloudUploadOutline,
      informationCircleOutline,
      printOutline,
      warningOutline,
    });
  }

  success(message: string, options: NotificationOptions = {}): Promise<void> {
    return this.show(message, 'success', options);
  }

  error(message: string, options: NotificationOptions = {}): Promise<void> {
    return this.show(message, 'error', options);
  }

  warning(message: string, options: NotificationOptions = {}): Promise<void> {
    return this.show(message, 'warning', options);
  }

  info(message: string, options: NotificationOptions = {}): Promise<void> {
    return this.show(message, 'info', options);
  }

  async show(
    message: string,
    kind: NotificationKind = 'info',
    options: NotificationOptions = {}
  ): Promise<void> {
    const defaults = DEFAULTS[kind];
    if (options.id) {
      await this.dismiss(options.id);
    }

    const buttons: { text: string; role?: string; handler?: () => void }[] = [];
    if (options.action) {
      buttons.push({ text: options.action.text, handler: options.action.handler });
    }
    if (options.dismissText) {
      buttons.push({ text: options.dismissText, role: 'cancel' });
    }

    const toast = await this.toastController.create({
      message,
      duration: options.duration ?? defaults.duration,
      position: options.position ?? 'top',
      color: defaults.color,
      icon: options.icon ?? defaults.icon,
      cssClass: `cartaya-toast cartaya-toast--${kind}`,
      ...(buttons.length > 0 ? { buttons } : {}),
    });

    if (options.id && toast) {
      this.visible.set(options.id, toast);
      toast.onDidDismiss?.()?.then(() => {
        if (this.visible.get(options.id as string) === toast) {
          this.visible.delete(options.id as string);
        }
      });
    }
    await toast?.present();
  }

  /** Dismisses the notification registered with `id`, if it is still visible. */
  async dismiss(id: string): Promise<void> {
    const toast = this.visible.get(id);
    if (!toast) {
      return;
    }
    this.visible.delete(id);
    await toast.dismiss();
  }
}
