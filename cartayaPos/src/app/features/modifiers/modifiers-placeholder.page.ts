import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
} from '@ionic/angular/standalone';

/**
 * Modifiers Placeholder Page
 *
 * Temporary placeholder for the modifiers feature which is under development.
 * Displays a simple message that the feature is coming soon.
 * Users can navigate back to products using the back button or button link.
 *
 * This component will be replaced with the actual modifiers selection screen
 * when the feature is fully implemented.
 */
@Component({
  selector: 'app-modifiers-placeholder',
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonButton,
    RouterModule,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/products"></ion-back-button>
        </ion-buttons>
        <ion-title>Product Modifiers</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <h2>Modifiers Feature</h2>
      <p>This feature is under development.</p>
      <p>You will be able to select modifiers for products here.</p>
      <ion-button expand="block" routerLink="/products">
        Back to Products
      </ion-button>
    </ion-content>
  `,
})
export class ModifiersPlaceholderPage {}
