import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
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
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

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
   * Fetch products from API
   * Checks cache first before making API call
   * Updates products signal on success
   * @param tenantId - Tenant ID to fetch products for
   * @returns Observable of fetched products
   */
  fetchProducts(tenantId?: string): Observable<Product[]> {
    this.isLoading.set(true);

    // If no tenantId is provided, use the currently selected tenant
    const activeTenantId = tenantId || this.tenantService.getCurrentTenantId();

    if (!activeTenantId) {
      this.isLoading.set(false);
      console.error('No tenant ID available for fetching products');
      return of([]);
    }

    // Check cache first
    const cachedProducts = this.getFromCache(activeTenantId);
    if (cachedProducts) {
      this.products.set(cachedProducts);
      this.isLoading.set(false);
      return of(cachedProducts);
    }

    return this.httpClient
      .get<{ data: Product[] }>(
        `${this.API_URL}/tenants/${activeTenantId}/products`,
        {
          params: {
            active: 'true',
            limit: '100',
            offset: '0',
          },
        }
      )
      .pipe(
        tap((response) => {
          this.products.set(response.data);
          this.saveToCache(activeTenantId, response.data);
          this.isLoading.set(false);
        }),
        map((response): Product[] => response.data),
        catchError((error) => {
          this.isLoading.set(false);
          console.error('Failed to fetch products:', error);
          return of([]);
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

  /**
   * Clear cache for all tenants
   */
  clearCache(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('products_')) {
          keys.push(key);
        }
      }

      for (const key of keys) {
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.debug('Failed to clear product cache:', e);
    }
  }

  /**
   * Get products from cache if valid (not expired)
   * @param tenantId - Tenant ID to get cache for
   * @returns Cached products or null if cache is invalid/expired
   */
  private getFromCache(tenantId: string): Product[] | null {
    try {
      const cacheKey = this.getCacheKey(tenantId);
      const cached = localStorage.getItem(cacheKey);

      if (!cached) return null;

      const cache: ProductCache = JSON.parse(cached);
      const now = Date.now();
      const age = now - cache.timestamp;

      // Check if cache is still valid (not expired)
      if (age > this.CACHE_TTL_MS) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return cache.products;
    } catch (e) {
      console.debug('Failed to retrieve product cache:', e);
      return null;
    }
  }

  /**
   * Save products to cache with timestamp
   * @param tenantId - Tenant ID to save cache for
   * @param products - Products to cache
   */
  private saveToCache(tenantId: string, products: Product[]): void {
    try {
      const cacheKey = this.getCacheKey(tenantId);
      const cache: ProductCache = {
        products,
        timestamp: Date.now(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cache));
    } catch (e) {
      console.debug('Failed to save product cache:', e);
    }
  }

  /**
   * Generate cache key for a tenant
   * @param tenantId - Tenant ID
   * @returns Cache key string
   */
  private getCacheKey(tenantId: string): string {
    return `products_${tenantId}`;
  }
}
