import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonRow,
    IonSpinner,
    IonTitle,
    IonToolbar,
} from '@ionic/angular/standalone';
import { Pos } from '../../core/models/pos.model';
import { Product } from '../../core/models/product.model';
import { PosService } from '../../core/services/pos.service';
import { ProductService } from '../../core/services/product.service';
import { TenantService } from '../../core/services/tenant.service';

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
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonGrid,
    IonRow,
    IonCol,
    IonSpinner,
  ],
  templateUrl: './product-catalog.page.html',
  styleUrls: ['./product-catalog.page.scss'],
})
export class ProductCatalogPage implements OnInit {
  private productService = inject(ProductService);
  private tenantService = inject(TenantService);
  private posService = inject(PosService);
  private router = inject(Router);

  ngOnInit(): void {
    this.loadProducts();
  }

  /**
   * Fetch products for the current tenant
   * Products will be displayed once loading is complete
   */
  private loadProducts(): void {
    const tenantId = this.tenantService.getCurrentTenantId();

    if (!tenantId) {
      console.error('No tenant selected. Redirecting to tenant selection.');
      this.router.navigate(['/']);
      return;
    }

    this.productService.fetchProducts(tenantId).subscribe({
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
    return this.productService.products();
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
   * Handle product selection
   * This will be used for future implementation of product detail view
   * @param product - The selected product
   */
  onProductTap(product: Product): void {
    // TODO: Implement product detail navigation
    console.log('Product selected:', product);
  }
}
