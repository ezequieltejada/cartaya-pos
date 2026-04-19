import { Component, computed, inject, Input } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonButtons, IonHeader, IonIcon, IonMenuButton, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeCircle, print, warning } from 'ionicons/icons';
import { Printer, PrinterStatus } from '../../../services/printer';
import { NetworkStatusComponent } from '../network-status/network-status.component';

type PrinterStatusUi = {
  state: PrinterStatus;
  primary: string;
  primaryColor: string;
  badge: string | null;
  badgeColor: string | null;
  label: string;
};

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonButtons, IonButton, IonIcon, IonMenuButton, IonTitle, NetworkStatusComponent],
  template: `
    <ion-header>
      <!-- Main Toolbar with menu button and title -->
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
        <ng-content select="[slot='end']"></ng-content>
        <ion-buttons slot="end">
          <ion-button
            fill="clear"
            size="small"
            (click)="openPrinterSettings()"
            [attr.aria-label]="printerStatusUi().label"
            [title]="printerStatusUi().label">
            <span class="printer-status-icon" aria-hidden="true">
              <ion-icon
                class="printer-status-primary"
                [name]="printerStatusUi().primary"
                [color]="printerStatusUi().primaryColor">
              </ion-icon>
              @if (printerStatusUi().badge; as badge) {
                <ion-icon
                  class="printer-status-badge"
                  [name]="badge"
                  [color]="printerStatusUi().badgeColor || undefined">
                </ion-icon>
              }
            </span>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      
      <!-- Secondary toolbar for search bars (explicitly wrapped in toolbar) -->
      <ion-toolbar>
        <ng-content select="[slot='secondary']"></ng-content>
      </ion-toolbar>
      
      <!-- Network Status Banner (appears last, can be closed) -->
      <app-network-status></app-network-status>
    </ion-header>
  `,
  styles: [`
    .printer-status-icon {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.5rem;
      height: 1.5rem;
    }

    .printer-status-primary {
      font-size: 1.2rem;
    }

    .printer-status-badge {
      position: absolute;
      right: -0.2rem;
      bottom: -0.15rem;
      font-size: 0.8rem;
      background: var(--ion-color-light, #fff);
      border-radius: 999px;
    }
  `],
})
export class PageHeaderComponent {
  private readonly router = inject(Router);
  private readonly printerService = inject(Printer);

  @Input() title: string = '';

  protected readonly printerStatusUi = computed<PrinterStatusUi>(() => {
    switch (this.printerService.status()) {
      case 'connected':
        return {
          state: 'connected',
          primary: 'print',
          primaryColor: 'success',
          badge: null,
          badgeColor: null,
          label: 'Printer connected',
        };
      case 'found-not-connected':
        return {
          state: 'found-not-connected',
          primary: 'print',
          primaryColor: 'warning',
          badge: 'warning',
          badgeColor: 'warning',
          label: 'Printer found but not connected',
        };
      default:
        return {
          state: 'not-found',
          primary: 'print',
          primaryColor: 'danger',
          badge: 'close-circle',
          badgeColor: 'danger',
          label: 'Printer not found',
        };
    }
  });

  constructor() {
    addIcons({ closeCircle, print, warning });
  }

  protected openPrinterSettings(): void {
    this.router.navigate(['/settings']);
  }
}
