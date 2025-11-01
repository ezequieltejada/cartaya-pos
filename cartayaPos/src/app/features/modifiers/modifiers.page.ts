import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFab,
    IonFabButton,
    IonHeader,
    IonIcon,
    IonItem,
    IonItemDivider,
    IonLabel,
    IonList,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
    ToastController,
} from '@ionic/angular/standalone';
import { add, checkmark, remove } from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { Modifier } from '../../core/models/modifier.model';
import { SelectedModifier } from '../../core/models/order.model';
import { Product } from '../../core/models/product.model';
import { ModifierService } from '../../core/services/modifier.service';
import { OrderService } from '../../core/services/order.service';
import { PosService } from '../../core/services/pos.service';
import { TenantService } from '../../core/services/tenant.service';

/**
 * ModifiersPage
 * Displays a list of available modifiers for a product and allows users to
 * select modifiers with quantity controls before adding the product to order.
 *
 * Route: /products/:productId/modifiers
 * Receives productId as route parameter and optionally product via navigation state
 */
@Component({
  selector: 'app-modifiers',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonSpinner,
    IonText,
    IonFab,
    IonFabButton,
    IonItemDivider,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/products"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ product()?.name }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Loading State -->
      <div *ngIf="isLoading()" class="loading-container">
        <ion-spinner></ion-spinner>
        <p>Loading modifiers...</p>
      </div>

      <!-- Error State -->
      <div *ngIf="error() && !isLoading()" class="error-container">
        <ion-text color="danger">
          <h2>Unable to Load Modifiers</h2>
          <p>{{ error() }}</p>
        </ion-text>
        <ion-button expand="block" (click)="retryFetchModifiers()">
          Retry
        </ion-button>
        <ion-button expand="block" fill="outline" (click)="addWithoutModifiers()">
          Continue Without Modifiers
        </ion-button>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading() && !error() && modifiersList().length === 0" class="empty-state">
        <ion-text>
          <h2>No Modifiers Available</h2>
          <p>This product doesn't have any customization options.</p>
        </ion-text>
        <ion-button expand="block" (click)="addWithoutModifiers()">
          Add to Order
        </ion-button>
      </div>

      <!-- Modifiers List -->
      <ion-list *ngIf="!isLoading() && !error() && modifiersList().length > 0">
        <ion-item-divider>
          <ion-label>Select Modifiers</ion-label>
        </ion-item-divider>

        <ion-item
          *ngFor="let modifier of modifiersList()"
          class="modifier-item"
        >
          <ion-label>
            <h2>{{ modifier.name }}</h2>
            <p [class.positive]="modifier.priceDelta > 0" [class.negative]="modifier.priceDelta < 0">
              {{ formatPriceDelta(modifier.priceDelta, modifier.currency) }}
            </p>
          </ion-label>

          <div slot="end" class="quantity-controls">
            <ion-button
              fill="outline"
              size="small"
              [disabled]="(selectedModifiers().get(modifier.id) || 0) === 0"
              (click)="decrementModifier(modifier.id)"
              [attr.aria-label]="'Decrease ' + modifier.name"
            >
              <ion-icon slot="icon-only" [icon]="remove"></ion-icon>
            </ion-button>

            <span class="quantity-display" [attr.aria-live]="'polite'">
              {{ selectedModifiers().get(modifier.id) || 0 }}
            </span>

            <ion-button
              fill="outline"
              size="small"
              (click)="incrementModifier(modifier.id)"
              [attr.aria-label]="'Increase ' + modifier.name"
            >
              <ion-icon slot="icon-only" [icon]="add"></ion-icon>
            </ion-button>
          </div>
        </ion-item>
      </ion-list>
    </ion-content>

    <!-- Floating Action Button (FAB) -->
    <ion-fab
      *ngIf="!isLoading() && !error() && modifiersList().length > 0"
      slot="fixed"
      vertical="bottom"
      horizontal="end"
    >
      <ion-fab-button
        (click)="confirmSelection()"
        [attr.aria-label]="'Confirm selection and add to order'"
      >
        <ion-icon [icon]="checkmarkIcon"></ion-icon>
      </ion-fab-button>
    </ion-fab>
  `,
  styles: [
    `
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 300px;
        gap: 16px;
      }

      .error-container {
        padding: 24px 0;
        text-align: center;
      }

      .empty-state {
        padding: 24px 0;
        text-align: center;
      }

      .modifier-item {
        --padding-start: 16px;
        --padding-end: 8px;
      }

      .quantity-controls {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: fit-content;
      }

      .quantity-display {
        min-width: 32px;
        text-align: center;
        font-weight: 600;
        font-size: 18px;
      }

      ion-button {
        --padding-start: 8px;
        --padding-end: 8px;
        min-width: 44px;
        min-height: 44px;
      }

      .positive {
        color: var(--ion-color-success, #2dd36f);
      }

      .negative {
        color: var(--ion-color-warning, #ffc409);
      }

      ion-fab-button {
        --padding-start: 0;
        --padding-end: 0;
        width: 56px;
        height: 56px;
        --box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }
    `,
  ],
})
export class ModifiersPage implements OnInit, OnDestroy {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private modifierService = inject(ModifierService);
  private orderService = inject(OrderService);
  private tenantService = inject(TenantService);
  private posService = inject(PosService);
  private toastController = inject(ToastController);

  private destroy$ = new Subject<void>();

  // State signals
  readonly modifiersList = signal<Modifier[]>([]);
  readonly selectedModifiers = signal<Map<string, number>>(new Map());
  readonly product = signal<Product | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Icons
  readonly add = add;
  readonly remove = remove;
  readonly checkmarkIcon = checkmark;

  ngOnInit(): void {
    this.initializePage();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialize the page by extracting route params, fetching modifiers,
   * and setting up component state
   */
  private initializePage(): void {
    // Extract productId from route parameters
    const productId = this.activatedRoute.snapshot.paramMap.get('productId');
    if (!productId) {
      this.error.set('Invalid product ID');
      return;
    }

    // Try to get product from navigation state (passed from product catalog)
    const navigation = this.router.getCurrentNavigation();
    const navigationExtras = navigation?.extras.state;
    if (navigationExtras?.['product']) {
      this.product.set(navigationExtras['product']);
    }

    // Fetch modifiers
    this.fetchModifiers(productId);
  }

  /**
   * Fetch modifiers for the selected product
   * @param productId Product ID to fetch modifiers for
   */
  private fetchModifiers(productId: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    const tenantId = this.tenantService.getSelectedTenant()?.id;
    const posId = this.posService.getSelectedPos()?.id;

    if (!tenantId || !posId) {
      this.error.set('Tenant or POS configuration missing');
      this.isLoading.set(false);
      return;
    }

    this.modifierService
      .fetchProductModifiers(tenantId, productId, posId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (modifiers) => {
          this.modifiersList.set(modifiers);
          this.isLoading.set(false);
          if (modifiers.length === 0) {
            // No modifiers is not necessarily an error, but inform user
            console.log('No modifiers available for this product');
          }
        },
        error: (err) => {
          console.error('Error fetching modifiers:', err);
          this.error.set('Failed to load modifiers. Please try again.');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * Retry fetching modifiers after an error
   */
  retryFetchModifiers(): void {
    const productId = this.activatedRoute.snapshot.paramMap.get('productId');
    if (productId) {
      this.fetchModifiers(productId);
    }
  }

  /**
   * Increment the quantity for a specific modifier
   * @param modifierId Modifier ID to increment
   */
  incrementModifier(modifierId: string): void {
    const current = this.selectedModifiers().get(modifierId) || 0;
    const updated = new Map(this.selectedModifiers());
    updated.set(modifierId, current + 1);
    this.selectedModifiers.set(updated);
  }

  /**
   * Decrement the quantity for a specific modifier
   * Minimum quantity is 0 (button is disabled at 0)
   * @param modifierId Modifier ID to decrement
   */
  decrementModifier(modifierId: string): void {
    const current = this.selectedModifiers().get(modifierId) || 0;
    if (current === 0) return;

    const updated = new Map(this.selectedModifiers());
    updated.set(modifierId, current - 1);
    this.selectedModifiers.set(updated);
  }

  /**
   * Format price delta as currency with + or - sign
   * @param delta Price delta value
   * @param currency Currency code
   * @returns Formatted currency string
   */
  formatPriceDelta(delta: number, currency: string): string {
    try {
      const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        signDisplay: 'always',
      } as any);
      return formatter.format(delta);
    } catch (e) {
      // Fallback formatting if currency is invalid
      const sign = delta > 0 ? '+' : '';
      return `${sign}$${delta.toFixed(2)}`;
    }
  }

  /**
   * Confirm modifier selection and add the configured product to order
   * Builds SelectedModifier[] from the selectedModifiers Map,
   * calls OrderService.addConfiguredProduct(), and navigates back
   */
  confirmSelection(): void {
    const product = this.product();
    if (!product) {
      console.error('Product not set');
      return;
    }

    // Build SelectedModifier array from Map (only include quantities > 0)
    const selectedModifiers: SelectedModifier[] = [];
    this.selectedModifiers().forEach((quantity, modifierId) => {
      if (quantity > 0) {
        const modifier = this.modifiersList().find((m) => m.id === modifierId);
        if (modifier) {
          selectedModifiers.push({
            modifierId: modifier.id,
            name: modifier.name,
            priceDelta: modifier.priceDelta,
            quantity,
          });
        }
      }
    });

    // Add configured product to order
    this.orderService.addConfiguredProduct(product, selectedModifiers);

    // Show success toast
    this.showSuccessToast();

    // Navigate back to product catalog
    this.router.navigate(['/products']);
  }

  /**
   * Add product to order without any modifiers
   * Used when no modifiers are available or user skips modifier selection
   */
  addWithoutModifiers(): void {
    const product = this.product();
    if (!product) {
      console.error('Product not set');
      return;
    }

    // Add configured product with empty modifiers array
    this.orderService.addConfiguredProduct(product, []);

    // Show success toast
    this.showSuccessToast();

    // Navigate back to product catalog
    this.router.navigate(['/products']);
  }

  /**
   * Show success toast notification when item is added to order
   */
  private async showSuccessToast(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Item added to order',
      duration: 2000,
      position: 'bottom',
      color: 'success',
      buttons: [
        {
          text: 'Close',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }
}
