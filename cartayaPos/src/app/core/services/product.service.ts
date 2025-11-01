import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, from, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';
import { StorageService } from './storage.service';
import { TenantService } from './tenant.service';

/**
 * Cache metadata for storing product cache with TTL
 */
interface ProductCache {
  products: Product[];
  timestamp: number;
  tenantId: string;
}

/**
 * Product Service
 * Manages product state and API interactions
 * Follows the established pattern from PosService and TenantService
 */
@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private httpClient = inject(HttpClient);
  private storageService = inject(StorageService);
  private tenantService = inject(TenantService);

  private readonly API_URL = `${environment.apiUrl}/api`;
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  // Writable signals
  readonly products = signal<Product[]>([]);
  readonly filterText = signal<string>('');
  readonly isLoading = signal(false);

  // Computed signal for filtered products
  readonly filteredProducts = computed(() => {
    const query = this.filterText().toLowerCase();
    if (!query) return this.products();

    return this.products().filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query)
    );
  });

  /**
   * Get cache key for a tenant
   * @param tenantId - Tenant ID
   * @returns Cache key string
   */
  private getCacheKey(tenantId: string): string {
    return `products_${tenantId}`;
  }

  /**
   * Get products from cache if valid (not expired)
   * Checks cache validity using TTL metadata
   * Returns null if cache miss or expired
   * @param tenantId - Tenant ID to get cache for
   * @returns Promise resolving to cached products or null
   */
  private async getCache(tenantId: string): Promise<Product[] | null> {
    try {
      const key = this.getCacheKey(tenantId);
      const cached = await this.storageService.get<ProductCache>(key);

      if (!cached) return null;

      const age = Date.now() - cached.timestamp;
      if (age > this.CACHE_TTL) {
        await this.storageService.remove(key);
        return null;
      }

      return cached.products;
    } catch (e) {
      console.debug('Failed to retrieve product cache:', e);
      return null;
    }
  }

  /**
   * Save products to cache with timestamp
   * Stores products with TTL metadata for later validation
   * @param tenantId - Tenant ID to save cache for
   * @param products - Products to cache
   * @returns Promise resolving when cache is saved
   */
  private async setCache(tenantId: string, products: Product[]): Promise<void> {
    try {
      const key = this.getCacheKey(tenantId);
      const cache: ProductCache = {
        products,
        timestamp: Date.now(),
        tenantId,
      };
      await this.storageService.set(key, cache);
    } catch (e) {
      console.debug('Failed to save product cache:', e);
    }
  }

  /**
   * Clear cache for specific tenant or all product caches
   * If tenantId provided, clears cache for that tenant only
   * Otherwise clears all product caches from storage
   * @param tenantId - Optional tenant ID to clear cache for
   * @returns Promise resolving when cache is cleared
   */
  async clearCache(tenantId?: string): Promise<void> {
    try {
      if (tenantId) {
        const key = this.getCacheKey(tenantId);
        await this.storageService.remove(key);
      } else {
        // Clear all product caches - we use localStorage directly for iteration
        // since StorageService doesn't provide keys() method
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('products_')) {
            keys.push(key);
          }
        }
        for (const key of keys) {
          await this.storageService.remove(key);
        }
      }
    } catch (e) {
      console.debug('Failed to clear product cache:', e);
    }
  }

  /**
   * Fetch products from API
   * Implements caching strategy:
   * 1. Check cache first (return immediately if valid)
   * 2. Make API call if cache miss or expired
   * 3. Cache results for subsequent calls
   * Uses RxJS switchMap pattern to chain async operations
   * @param tenantId - Optional tenant ID (uses current tenant if not provided)
   * @returns Observable of fetched products
   */
  fetchProducts(tenantId?: string): Observable<Product[]> {
    // If no tenantId is provided, use the currently selected tenant
    const activeTenantId = tenantId || this.tenantService.getCurrentTenantId();

    if (!activeTenantId) {
      console.error('No tenant ID available for fetching products');
      return of([]);
    }

    this.isLoading.set(true);

    // Convert async getCache to Observable using from()
    return from(this.getCache(activeTenantId)).pipe(
      switchMap((cachedProducts) => {
        if (cachedProducts) {
          // Return cached data immediately (no loading spinner)
          this.products.set(cachedProducts);
          this.isLoading.set(false);
          return of(cachedProducts);
        }

        // Fetch from API
        return this.httpClient
          .get<{ data: Product[] }>(
            `${this.API_URL}/tenants/${activeTenantId}/products`,
            {
              params: {
                active: 'true',
                limit: '100',
              },
            }
          )
          .pipe(
            tap(async (response) => {
              this.products.set(response.data);
              await this.setCache(activeTenantId, response.data);
              this.isLoading.set(false);
            }),
            map((response): Product[] => response.data),
            catchError(() => {
              this.isLoading.set(false);
              console.error('Failed to fetch products');
              return of([]);
            })
          );
      })
    );
  }

  /**
   * Set filter text and trigger filtered products recomputation
   * @param query - Search query string
   */
  setFilterText(query: string): void {
    this.filterText.set(query);
  }
}
