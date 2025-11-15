import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
    IonBadge,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCol,
    IonContent,
    IonFab,
    IonFabButton,
    IonGrid,
    IonHeader,
    IonIcon,
    IonMenuButton,
    IonRow,
    IonSearchbar,
    IonSpinner,
    IonTitle,
    IonToolbar,
    ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { alertCircleOutline, cartOutline, refreshOutline, searchOutline, settingsOutline } from 'ionicons/icons';
import { Pos } from '../../core/models/pos.model';
import { Product } from '../../core/models/product.model';
import { AuthService } from '../../core/services/auth.service';
import { ModifierService } from '../../core/services/modifier.service';
import { OrderService } from '../../core/services/order.service';
import { PosService } from '../../core/services/pos.service';
import { ProductService } from '../../core/services/product.service';
import { SettingsService } from '../../core/services/settings.service';
import { TenantService } from '../../core/services/tenant.service';
import { Printer } from '../../services/printer';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ProductCardComponent } from './components/product-card/product-card.component';

/**
 * ProductCatalogPage Component
 *
 * Displays products in a responsive Ionic grid with loading and empty states.
 * Manages product fetching on initialization and handles responsive grid layout.
 *
 * Responsible for:
 * - Fetching products using ProductService
 * - Managing loading state during product fetch
 * - Displaying products in a responsive grid layout
 * - Showing loading spinner and empty state
 * - Displaying PoS info in header
 *
 * Grid Layout:
 * - 2 columns on mobile (size="6")
 * - 3 columns on tablet (sizeMd="4")
 * - 4 columns on desktop (sizeLg="3")
 */
@Component({
  selector: 'app-product-catalog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ScrollingModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButtons,
    IonMenuButton,
    IonButton,
    IonIcon,
    IonBadge,
    IonGrid,
    IonRow,
    IonCol,
    IonSpinner,
    IonSearchbar,
    IonCard,
    IonCardContent,
    IonFab,
    IonFabButton,
    PageHeaderComponent,
    ProductCardComponent,
  ],
  templateUrl: './product-catalog.page.html',
  styleUrls: ['./product-catalog.page.scss'],
})
export class ProductCatalogPage implements OnInit {
  private productService = inject(ProductService);
  private tenantService = inject(TenantService);
  private settingsService = inject(SettingsService);
  private posService = inject(PosService);
  private router = inject(Router);
  private toastController = inject(ToastController);
  private modifierService = inject(ModifierService);
  protected printerService = inject(Printer);
  orderService = inject(OrderService);
  private authService = inject(AuthService);

  constructor() {
    // Register ionicons for printer unavailable message
    addIcons({alertCircleOutline,refreshOutline,settingsOutline,searchOutline,cartOutline});
  }

  /**
   * Computed signal for reactive cart item count
   */
  itemCount = computed(() => this.orderService.itemCount());

  searchQuery = '';
  private modifierCheckCache = new Map<string, boolean>();

  ngOnInit(): void {
    this.checkPosSelection();
    this.loadTenantSettings();
    this.loadProducts();
  }

  /**
   * Load tenant settings (currency, timezone)
   * This must happen early so that OrderService can use the correct currency
   */
  private loadTenantSettings(): void {
    const tenantId = this.tenantService.getCurrentTenantId();

    if (!tenantId) {
      console.warn('No tenant selected when attempting to load settings');
      return;
    }

    this.settingsService.fetchTenantSettings(tenantId).subscribe({
      error: (error) => {
        console.error('Failed to load tenant settings:', error);
        // Continue anyway - OrderService will use fallback values
      },
    });
  }

  /**
   * Check if a POS is selected, redirect to selection if not
   */
  private checkPosSelection(): void {
    const selectedPos = this.posService.getSelectedPos();
    if (!selectedPos) {
      this.router.navigate(['/pos-selection']);
      return;
    }
  }

  /**
   * Fetch products for the current tenant
   * Clears cache when PoS changes to force fresh data
   * Products will be displayed once loading is complete
   * Uses fetchProductsWithPrices to fetch prices in batches
   */
  private async loadProducts(): Promise<void> {
    const tenantId = this.tenantService.getCurrentTenantId();

    if (!tenantId) {
      console.error('No tenant selected. Redirecting to tenant selection.');
      this.router.navigate(['/']);
      return;
    }

    // Clear cache to force fresh data on PoS switch
    await this.productService.clearCache(tenantId);
    
    this.productService.fetchProductsWithPrices(tenantId).subscribe({
      next: () => {
        // Products are updated in the signal
      },
      error: () => {
        // Error is handled in the service
      },
    });
  }

  /**
   * Get all products from the ProductService signal
   */
  get products(): Product[] {
    return this.productService.filteredProducts();
  }

  /**
   * Get loading state from ProductService signal
   */
  get isLoading(): boolean {
    return this.productService.isLoading();
  }

  /**
   * Get the currently selected PoS location
   */
  get selectedPos(): Pos | null {
    return this.posService.getSelectedPos();
  }

  /**
   * Get error message from ProductService signal
   */
  get errorMessage(): string | null {
    return this.productService.error();
  }

  /**
   * Get current user for menu display
   */
  get currentUser(): any {
    return this.authService.getCurrentUser();
  }

  /**
   * Get printer availability status
   * Returns true if printer is available, false if unavailable/disconnected
   */
  get isPrinterUnavailable(): boolean {
    return this.printerService.isConnected && !this.printerService.printerAvailable();
  }

  /**
   * Handle search input with debouncing
   * Updates the ProductService filter text to trigger filtered products recomputation
   * @param event - The ionInput event from IonSearchbar
   */
  onSearchInput(event: any): void {
    const query = event.target.value || '';
    this.productService.setFilterText(query);
  }

  /**
   * Clear the search query and reset the filter
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.productService.setFilterText('');
  }

  /**
   * Retry fetching products after an error
   * Forces refresh from API, bypassing cache
   * Uses fetchProductsWithPrices to include price data
   */
  retry(): void {
    const tenantId = this.tenantService.getCurrentTenantId();
    if (tenantId) {
      this.productService.fetchProductsWithPrices(tenantId, true).subscribe();
    }
  }

  /**
   * Handle product selection
   * Checks if product has modifiers and either navigates to ModifiersPage
   * or adds directly to order
   * @param product - The selected product
   */
  async onProductTap(product: Product): Promise<void> {
    // Log for analytics (future)
    console.log('Product selected:', product.id, product.name);

    // Check if product has modifiers
    const hasModifiers = await this.checkProductModifiers(product);

    if (hasModifiers) {
      // Navigate to modifiers page with product data via route state
      this.router.navigate(['/products', product.id, 'modifiers'], {
        state: { product },
      });
    } else {
      // Add directly to order without modifiers
      this.orderService.addConfiguredProduct(product, []);
      await this.showSuccessToast(`"${product.name}" added to order`);
    }
  }

  /**
   * Check if product has modifiers
   * Uses API call to fetch modifiers for the product, with caching
   * Returns true if product has any active modifiers
   * Returns false if no modifiers, API error, or product is invalid
   * @param product - Product to check
   * @returns true if product has modifiers
   */
  private async checkProductModifiers(product: Product): Promise<boolean> {
    // Check cache first to avoid repeated API calls
    if (this.modifierCheckCache.has(product.id)) {
      return this.modifierCheckCache.get(product.id) || false;
    }

    try {
      const tenantId = this.tenantService.getCurrentTenantId();
      const pos = this.posService.getSelectedPos();

      if (!tenantId || !pos) {
        console.warn('Cannot check modifiers: missing tenantId or PoS');
        return false;
      }

      // Fetch modifiers from API
      const modifiers = await this.modifierService
        .fetchProductModifiers(tenantId, product.id, pos.id)
        .toPromise();

      // Determine if product has modifiers
      const hasModifiers = (modifiers?.length ?? 0) > 0;

      // Cache the result
      this.modifierCheckCache.set(product.id, hasModifiers);

      return hasModifiers;
    } catch (error) {
      console.error(
        `Failed to check modifiers for product ${product.id}:`,
        error
      );
      // On error, assume no modifiers to allow graceful degradation
      this.modifierCheckCache.set(product.id, false);
      return false;
    }
  }

  /**
   * Show success toast when product is added to order
   * @param message - Success message to display
   */
  private async showSuccessToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      position: 'bottom',
      color: 'success',
      icon: 'checkmark-circle-outline',
    });
    await toast.present();
  }

  /**
   * Navigate to the cart page
   */
  navigateToCart(): void {
    this.router.navigate(['/cart']);
  }

  /**
   * Handle logout
   */
  logout(): void {
    this.authService.logout().subscribe();
  }

  /**
   * Navigate to products page
   */
  navigateToProducts(): void {
    this.router.navigate(['/products']);
  }

  /**
   * Navigate to settings page
   */
  navigateToSettings(): void {
    this.router.navigate(['/settings']);
  }
}
