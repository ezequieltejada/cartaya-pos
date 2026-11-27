import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
} from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { add, checkmark, remove } from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { Modifier } from '../../core/models/modifier.model';
import { SelectedModifier } from '../../core/models/order.model';
import { Product } from '../../core/models/product.model';
import { MenuService } from '../../core/services/menu.service';
import { MoneyService } from '../../core/services/money.service';
import { ModifierService } from '../../core/services/modifier.service';
import { OrderService } from '../../core/services/order.service';
import { PosService } from '../../core/services/pos.service';
import { ProductService } from '../../core/services/product.service';
import { TenantService } from '../../core/services/tenant.service';
import { NotificationService } from '../../core/services/notification.service';

/**
 * Default maximum quantity per modifier when the modifier does not define
 * its own limit.
 */
export const DEFAULT_MAX_MODIFIER_QUANTITY = 10;

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
    TranslateModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/products" [text]="'MODIFIERS.BACK_BUTTON' | translate"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'MODIFIERS.TITLE' | translate }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <main class="mods">
        <!-- Product summary -->
        <header class="mods__product" *ngIf="product() as p">
          <div class="mods__product-text">
            <h1 class="type-display mods__name">{{ p.name }}</h1>
            <p class="type-body-sm mods__description" *ngIf="p.description">{{ p.description }}</p>
          </div>
        </header>

        <!-- Loading State -->
        <div *ngIf="isLoading()" class="mods__state" role="status">
          <ion-spinner></ion-spinner>
          <p class="type-body">{{ 'MODIFIERS.LOADING' | translate }}</p>
        </div>

        <!-- Error State -->
        <div *ngIf="error() && !isLoading()" class="mods__state" role="alert">
          <h2 class="type-heading mods__error-title">{{ 'MODIFIERS.ERROR_TITLE' | translate }}</h2>
          <p class="type-body mods__muted">{{ error() }}</p>
          <ion-button expand="block" (click)="retryFetchModifiers()">
            {{ 'MODIFIERS.RETRY_BUTTON' | translate }}
          </ion-button>
          <ion-button expand="block" fill="outline" (click)="addWithoutModifiers()">
            {{ 'MODIFIERS.CONTINUE_WITHOUT' | translate }}
          </ion-button>
        </div>

        <!-- Empty State -->
        <div *ngIf="!isLoading() && !error() && modifiersList().length === 0" class="mods__state">
          <h2 class="type-heading">{{ 'MODIFIERS.NO_MODIFIERS' | translate }}</h2>
          <p class="type-body mods__muted">{{ 'MODIFIERS.NO_MODIFIERS_MESSAGE' | translate }}</p>
          <ion-button expand="block" (click)="addWithoutModifiers()">
            {{ 'MODIFIERS.ADD_TO_ORDER' | translate }}
          </ion-button>
        </div>

        <!-- Modifiers list -->
        <section *ngIf="!isLoading() && !error() && modifiersList().length > 0" class="mods__section">
          <h2 class="type-label mods__section-title">{{ 'MODIFIERS.SELECT_LABEL' | translate }}</h2>

          <ul class="mods__list">
            <li
              *ngFor="let modifier of modifiersList()"
              class="mod"
              [class.mod--active]="(selectedModifiers().get(modifier.id) || 0) > 0"
            >
              <div class="mod__info">
                <span class="type-title mod__name">{{ modifier.name }}</span>
                <span class="type-body-sm mod__price" [class.mod__price--negative]="modifier.priceDelta < 0">
                  {{ formatPriceDelta(modifier.priceDelta) }}
                </span>
                <span class="type-body-sm mod__included" *ngIf="getIncludedQuantityText(modifier)">
                  {{ getIncludedQuantityText(modifier) }}
                </span>
                <span class="type-body-sm mod__breakdown" aria-live="polite" *ngIf="getQuantityBreakdown(modifier)">
                  {{ getQuantityBreakdown(modifier) }}
                </span>
              </div>

              <div class="stepper" role="group" [attr.aria-label]="modifier.name">
                <button
                  type="button"
                  class="stepper__btn"
                  [disabled]="isDecrementDisabled(modifier)"
                  (click)="decrementModifier(modifier.id)"
                  [attr.aria-label]="('MODIFIERS.DECREASE' | translate) + ' ' + modifier.name"
                >
                  <ion-icon [icon]="remove" aria-hidden="true"></ion-icon>
                </button>
                <span class="stepper__value type-price" aria-live="polite">{{ selectedModifiers().get(modifier.id) || 0 }}</span>
                <button
                  type="button"
                  class="stepper__btn"
                  [disabled]="isIncrementDisabled(modifier)"
                  (click)="incrementModifier(modifier.id)"
                  [attr.aria-label]="('MODIFIERS.INCREASE' | translate) + ' ' + modifier.name"
                >
                  <ion-icon [icon]="add" aria-hidden="true"></ion-icon>
                </button>
              </div>
            </li>
          </ul>
        </section>
      </main>
    </ion-content>

    <!-- Sticky confirm bar -->
    <footer class="mods__bar" *ngIf="!isLoading() && !error() && modifiersList().length > 0">
      <div class="mods__total">
        <span class="type-label mods__muted">{{ 'MODIFIERS.TOTAL_LABEL' | translate }}</span>
        <span class="type-price mods__total-value">{{ formatAmount(totalAmount()) }}</span>
      </div>
      <ion-button class="mods__confirm" (click)="confirmSelection()">
        <ion-icon slot="start" [icon]="checkmarkIcon"></ion-icon>
        {{ 'MODIFIERS.CONFIRM_BUTTON' | translate }}
      </ion-button>
    </footer>
  `,
  styleUrl: './modifiers.page.scss',
})
export class ModifiersPage implements OnInit, OnDestroy {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  private modifierService = inject(ModifierService);
  private orderService = inject(OrderService);
  private productService = inject(ProductService);
  private tenantService = inject(TenantService);
  private posService = inject(PosService);
  private notifications = inject(NotificationService);
  private menuService = inject(MenuService);
  private translate = inject(TranslateService);
  private moneyService = inject(MoneyService);

  private destroy$ = new Subject<void>();

  // State signals
  readonly modifiersList = signal<Modifier[]>([]);
  readonly selectedModifiers = signal<Map<string, number>>(new Map());
  readonly product = signal<Product | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly isEditing = signal<boolean>(false);
  readonly editingItemId = signal<string | null>(null);

  // Icons
  readonly add = add;
  readonly remove = remove;
  readonly checkmarkIcon = checkmark;

  /** Base price + modifier charges (priceDelta x quantity above the included amount). */
  readonly totalAmount = computed(() => {
    const base = this.product()?.defaultPrice?.amount ?? 0;
    const extras = this.modifiersList().reduce((sum, modifier) => {
      const qty = this.selectedModifiers().get(modifier.id) || 0;
      const billable = Math.max(0, qty - (modifier.includedQuantity ?? 0));
      return sum + modifier.priceDelta * billable;
    }, 0);
    return base + extras;
  });

  formatAmount(amount: number): string {
    return this.moneyService.format(amount);
  }

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
    // Check if POS is selected
    const selectedPos = this.posService.getSelectedPos();
    if (!selectedPos) {
      this.router.navigate(['/pos-selection']);
      return;
    }

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

    // Extract editing state if present
    if (navigationExtras?.['isEditing']) {
      this.isEditing.set(true);
      if (navigationExtras['itemId']) {
        this.editingItemId.set(navigationExtras['itemId']);
      }
      if (navigationExtras['selectedModifiers']) {
        // Convert SelectedModifier[] to Map<string, number>
        const modifierMap = new Map<string, number>();
        navigationExtras['selectedModifiers'].forEach((mod: any) => {
          modifierMap.set(mod.modifierId, mod.quantity);
        });
        this.selectedModifiers.set(modifierMap);
      }
    }

    // If editing and no product in navigation state, fetch product by ID
    if (this.isEditing() && !this.product()) {
      this.fetchProductForEditing(productId);
    }

    // Fetch modifiers
    this.fetchModifiers(productId);
  }

  /**
   * Fetch product by ID when editing (product not passed in navigation state)
   * @param productId Product ID to fetch
   */
  private fetchProductForEditing(productId: string): void {
    // Get products from ProductService
    const products = this.productService.filteredProducts();
    const product = products.find(p => p.id === productId);

    if (product) {
      this.product.set(product);
    } else {
      // If not in filtered products, try to fetch from API
      this.productService.fetchProducts().subscribe({
        next: (fetchedProducts) => {
          const foundProduct = fetchedProducts.find(p => p.id === productId);
          if (foundProduct) {
            this.product.set(foundProduct);
          } else {
            this.error.set('Product not found');
          }
        },
        error: () => {
          this.error.set('Failed to load product');
        }
      });
    }
  }
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
          this.initializeDefaultModifiers(modifiers);
          this.isLoading.set(false);
        },
        error: () => {
          this.error.set('Failed to load modifiers. Please try again.');
          this.isLoading.set(false);
        },
      });
  }

  /**
   * Initialize default modifiers with quantity 1
   * @param modifiers List of modifiers to check for defaults
   */
  private initializeDefaultModifiers(modifiers: Modifier[]): void {
    // Don't override existing selections when editing
    if (this.isEditing()) {
      return;
    }

    const defaultSelections = new Map<string, number>();

    modifiers.forEach((modifier) => {
      if (modifier.default) {
        defaultSelections.set(modifier.id, 1);
      }
    });

    this.selectedModifiers.set(defaultSelections);
  }

  /**
   * Retry fetching modifiers
   */
  retryFetchModifiers(): void {
    const productId = this.activatedRoute.snapshot.paramMap.get('productId');
    if (productId) {
      this.fetchModifiers(productId);
    }
  }
  isDecrementDisabled(modifier: Modifier): boolean {
    const current = this.selectedModifiers().get(modifier.id) || 0;

    // Always disabled if quantity is 0
    if (current === 0) return true;

    // For non-removable default modifiers, disabled if quantity is 1
    if (modifier.default && modifier.isRemovable === false && current <= 1) {
      return true;
    }

    return false;
  }

  /**
   * Maximum selectable quantity for a modifier: the modifier's own limit
   * when the API provides one, otherwise DEFAULT_MAX_MODIFIER_QUANTITY.
   */
  getMaxQuantity(modifier: Modifier): number {
    const max = modifier.maxQuantity;
    return typeof max === 'number' && max > 0 ? max : DEFAULT_MAX_MODIFIER_QUANTITY;
  }

  isIncrementDisabled(modifier: Modifier): boolean {
    const current = this.selectedModifiers().get(modifier.id) || 0;
    return current >= this.getMaxQuantity(modifier);
  }

  /**
   * Increment the quantity for a specific modifier (capped at its maximum)
   * @param modifierId Modifier ID to increment
   */
  incrementModifier(modifierId: string): void {
    const current = this.selectedModifiers().get(modifierId) || 0;
    const modifier = this.modifiersList().find((m) => m.id === modifierId);
    if (modifier && current >= this.getMaxQuantity(modifier)) {
      return;
    }
    const updated = new Map(this.selectedModifiers());
    updated.set(modifierId, current + 1);
    this.selectedModifiers.set(updated);
  }

  /**
   * Decrement the quantity for a specific modifier
   * Minimum quantity is 0 for regular modifiers, 1 for non-removable default modifiers
   * @param modifierId Modifier ID to decrement
   */
  decrementModifier(modifierId: string): void {
    const current = this.selectedModifiers().get(modifierId) || 0;
    if (current === 0) return;

    // Find the modifier to check if it's a non-removable default
    const modifier = this.modifiersList().find((m) => m.id === modifierId);
    const isNonRemovableDefault = modifier?.default && modifier.isRemovable === false;

    // Don't allow going below 1 for non-removable default modifiers
    if (isNonRemovableDefault && current <= 1) {
      return;
    }

    const updated = new Map(this.selectedModifiers());
    updated.set(modifierId, current - 1);
    this.selectedModifiers.set(updated);
  }

  /**
   * Format price delta as currency with + or - sign
   * @param delta Price delta value
   * Always uses the tenant's currency via the shared formatter
   * @returns Formatted currency string
   */
  formatPriceDelta(delta: number): string {
    return this.moneyService.format(delta, { signed: true });
  }

  /**
   * Get text describing the included quantity for a modifier
   * Shows "First N included" when includedQuantity > 0
   * Returns empty string when includedQuantity is 0 or undefined (to hide from UI)
   * 
   * @param modifier The modifier to get included quantity text for
   * @returns Human-readable text like "First 2 included" or empty string
   * 
   * @example
   * modifier with includedQuantity=2 → "First 2 included"
   * modifier with includedQuantity=1 → "First 1 included"
   * modifier with includedQuantity=0 or undefined → "" (hidden)
   */
  getIncludedQuantityText(modifier: Modifier): string {
    const includedQty = modifier.includedQuantity ?? 0;
    if (includedQty === 0) {
      return ''; // Don't show when nothing is included
    }
    
    if (includedQty === 1) {
      return 'First 1 included'; // Singular form
    }
    
    return `First ${includedQty} included`; // Plural form
  }

  /**
   * Get quantity breakdown text showing included vs billable quantity
   * Shows only when user has selected > 0 quantity
   * 
   * Examples:
   * - If selected=1, included=2 → "1 included" (all included)
   * - If selected=2, included=2 → "2 included" (all included)
   * - If selected=3, included=2 → "2 included + 1 extra" (partial charge)
   * - If selected=4, included=2, price=$1 each → "2 included + 2 extra ($2.00)"
   * 
   * @param modifier The modifier to calculate breakdown for
   * @returns Breakdown text or empty string if quantity is 0
   */
  getQuantityBreakdown(modifier: Modifier): string {
    const selectedQty = this.selectedModifiers().get(modifier.id) || 0;
    
    if (selectedQty === 0) {
      return ''; // No breakdown when quantity is 0
    }
    
    const includedQty = modifier.includedQuantity ?? 0;
    
    // If all selected quantity is included (selected <= included)
    if (selectedQty <= includedQty) {
      if (selectedQty === 1) {
        return '1 included'; // Singular
      }
      return `${selectedQty} included`; // Plural
    }
    
    // If some quantity is not included (selected > included)
    const billableQty = selectedQty - includedQty;
    const charge = modifier.priceDelta * billableQty;
    const chargeFormatted = this.moneyService.format(charge);
    
    if (includedQty === 0) {
      // No included quantity, show all as extra (charged)
      return `${selectedQty} × ${this.formatPriceDelta(modifier.priceDelta)}`;
    }
    
    if (billableQty === 1) {
      // Singular form for billable quantity
      return `${includedQty} included + 1 extra (${chargeFormatted})`;
    }
    
    // Plural form for billable quantity
    return `${includedQty} included + ${billableQty} extra (${chargeFormatted})`;
  }

  /**
   * Confirm modifier selection and add/update the configured product to order
   * Builds SelectedModifier[] from the selectedModifiers Map,
   * calls OrderService.addConfiguredProduct() for new items or updateItemModifiers() for editing,
   * and navigates back
   */
   async confirmSelection(): Promise<void> {
     const product = this.product();
     if (!product) {
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
                // Preserve includedQuantity from Modifier for pricing calculations
                // Default to 0 if undefined (means no quantity is included in base price)
                includedQuantity: modifier.includedQuantity ?? 0,
              });
            }
        }
      });

     if (this.isEditing() && this.editingItemId()) {
       // Update existing item modifiers
       this.orderService.updateItemModifiers(this.editingItemId()!, selectedModifiers);
     } else {
       // Add new configured product to order
       this.orderService.addConfiguredProduct(product, selectedModifiers);
     }

     // Show success toast
     this.showSuccessToast();

     // Open order summary menu before navigating back
     await this.menuService.openMenu('order-summary-menu');

     // Navigate back to product catalog (or stay on order summary for editing)
     this.router.navigate(['/products']);
   }

  /**
   * Add product to order without any modifiers
   * Used when no modifiers are available or user skips modifier selection
   */
  async addWithoutModifiers(): Promise<void> {
    const product = this.product();
    if (!product) {
      return;
    }

    // Add configured product with empty modifiers array
    this.orderService.addConfiguredProduct(product, []);

    // Show success toast
    this.showSuccessToast();

    // Open order summary menu before navigating back
    await this.menuService.openMenu('order-summary-menu');

    // Navigate back to product catalog
    this.router.navigate(['/products']);
  }

  /**
   * Show success toast notification when item is added/updated in order
   */
  private async showSuccessToast(): Promise<void> {
    const messageKey = this.isEditing() ? 'MODIFIERS.ITEM_UPDATED' : 'MODIFIERS.ITEM_ADDED';
    const message = this.translate.instant(messageKey);
    await this.notifications.success(message);
  }
}
