import { Component, Input } from '@angular/core';
import { IonButtons, IonHeader, IonMenuButton, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { NetworkStatusComponent } from '../network-status/network-status.component';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonButtons, IonMenuButton, IonTitle, NetworkStatusComponent],
  template: `
    <ion-header>
      <!-- Main Toolbar with menu button and title -->
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>{{ title }}</ion-title>
        <ng-content select="[slot='end']"></ng-content>
      </ion-toolbar>
      
      <!-- Secondary toolbar for search bars (explicitly wrapped in toolbar) -->
      <ion-toolbar>
        <ng-content select="[slot='secondary']"></ng-content>
      </ion-toolbar>
      
      <!-- Network Status Banner (appears last, can be closed) -->
      <app-network-status></app-network-status>
    </ion-header>
  `,
})
export class PageHeaderComponent {
  @Input() title: string = '';
}
