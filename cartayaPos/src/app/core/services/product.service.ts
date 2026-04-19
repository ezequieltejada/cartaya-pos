import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, forkJoin, from, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';
import { ImageCacheService } from './image-cache.service';
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
 * Cache metadata for storing price cache with TTL
 */
interface PriceCache {
  prices: Record<string, { id: string; amount: number; currency: string }>;
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
  private router = inject(Router);
  private imageCacheService = inject(ImageCacheService);

  private readonly API_URL = `${environment.apiUrl}/api`;
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private readonly PRICE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes (aggressive caching)

  // Writable signals
  readonly products = signal<Product[]>([]);
  readonly filterText = signal<string>('');
  readonly selectedCategoryIds = signal<string[]>(['all']);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // UI-facing getter for single category selection (for now)
  get selectedCategoryId(): string {
    const ids = this.selectedCategoryIds();
    return ids.length === 1 && ids[0] === 'all' ? 'all' : ids[0];
  }

  /**
   * Set selected category ID
   * Updates internal array-based selection for future multi-select support
   * @param categoryId - Category ID to select ('all' to show all categories)
   */
  setSelectedCategoryId(categoryId: string): void {
    this.selectedCategoryIds.set(categoryId === 'all' ? ['all'] : [categoryId]);
  }

  // Computed signal for filtered products
  readonly filteredProducts = computed(() => {
    let filtered = this.products();

    // Text filter
    const query = this.filterText().toLowerCase();
    if (query) {
      filtered = filtered.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.sku?.toLowerCase().includes(query)
      );
    }

    // Category filter
    const categoryIds = this.selectedCategoryIds();
    if (!categoryIds.includes('all')) {
      filtered = filtered.filter(
        (product) =>
          product.category && categoryIds.includes(product.category.categoryId)
      );
    }

    return filtered;
  });

  /**
   * Get user-friendly error message based on HTTP error
   * Maps HTTP status codes to appropriate user messages
   * @param error - HTTP error object
   * @returns User-friendly error message
   */
  private getErrorMessage(error: any): string {
    if (error.status === 0) {
      return 'No internet connection. Please check your network.';
    } else if (error.status === 401) {
      return 'Session expired. Please log in again.';
    } else if (error.status === 403) {
      return 'You do not have permission to view products.';
    } else if (error.status >= 500) {
      return 'Server error. Please try again later.';
    } else {
      return 'Failed to load products. Please try again.';
    }
  }

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
   * 4. Handle errors gracefully with user-friendly messages
   * 5. Return cached products if available on error
   * Uses RxJS switchMap pattern to chain async operations
   * @param tenantId - Optional tenant ID (uses current tenant if not provided)
   * @param forceRefresh - Force refresh from API, bypassing cache
   * @returns Observable of fetched products
   */
  fetchProducts(tenantId?: string, forceRefresh = false): Observable<Product[]> {
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
        // If forceRefresh is true, skip cache and go directly to API
        if (!forceRefresh && cachedProducts) {
          // Return cached data immediately (no loading spinner)
          this.products.set(cachedProducts);
          this.isLoading.set(false);
          this.error.set(null);
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
              this.error.set(null);
            }),
            map((response): Product[] => response.data),
            catchError((error) => {
              console.error('Failed to fetch products:', error);
              this.isLoading.set(false);

              // Set user-friendly error message
              const errorMessage = this.getErrorMessage(error);
              this.error.set(errorMessage);

              // Handle 401 Unauthorized - redirect to login
              if (error.status === 401) {
                this.router.navigate(['/auth/login'], { replaceUrl: true });
                return of([]);
              }

              // Return cached products if available, otherwise empty array
              if (cachedProducts) {
                this.products.set(cachedProducts);
                return of(cachedProducts);
              }

              this.products.set([]);
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

  /**
   * Get price cache key for a tenant
   * @param tenantId - Tenant ID
   * @returns Cache key string
   */
  private getPriceCacheKey(tenantId: string): string {
    return `prices_${tenantId}`;
  }

  /**
   * Get prices from cache if valid (not expired)
   * @param tenantId - Tenant ID
   * @returns Promise resolving to cached prices or null
   */
  private async getPriceCache(tenantId: string): Promise<PriceCache | null> {
    try {
      const key = this.getPriceCacheKey(tenantId);
      const cached = await this.storageService.get<PriceCache>(key);

      if (!cached) return null;

      const age = Date.now() - cached.timestamp;
      if (age > this.PRICE_CACHE_TTL) {
        await this.storageService.remove(key);
        return null;
      }

      return cached;
    } catch (e) {
      console.debug('Failed to retrieve price cache:', e);
      return null;
    }
  }

  /**
   * Save prices to cache with timestamp
   * @param tenantId - Tenant ID
   * @param prices - Record of priceId -> price object
   * @returns Promise resolving when cache is saved
   */
  private async setPriceCache(
    tenantId: string,
    prices: Record<string, { id: string; amount: number; currency: string }>
  ): Promise<void> {
    try {
      const key = this.getPriceCacheKey(tenantId);
      const cache: PriceCache = {
        prices,
        timestamp: Date.now(),
        tenantId,
      };
      await this.storageService.set(key, cache);
    } catch (e) {
      console.debug('Failed to save price cache:', e);
    }
  }

  /**
   * Fetch price for a specific product
   * Makes individual API call to get price details
   * @param tenantId - Tenant ID
   * @param productId - Product ID
   * @param priceId - Price ID to fetch
   * @returns Observable of price object
   */
  private fetchPrice(
    tenantId: string,
    productId: string,
    priceId: string
  ): Observable<{ id: string; amount: number; currency: string } | null> {
    return this.httpClient
      .get<{ id: string; amount: number; currency: string; validFrom: string | null; validTo: string | null }>(
        `${this.API_URL}/tenants/${tenantId}/products/${productId}/prices/${priceId}`
      )
      .pipe(
        map((price) => ({
          id: price.id,
          amount: price.amount,
          currency: price.currency,
        })),
        catchError((error) => {
          console.warn(`Failed to fetch price for product ${productId}:`, error);
          return of(null);
        })
      );
  }

  /**
   * Fetch prices for multiple products in parallel
   * Uses forkJoin to make all requests concurrently, then caches results
   * @param tenantId - Tenant ID
   * @param productPriceMap - Map of productId -> priceId
   * @returns Observable of record mapping priceId -> price object
   */
  private fetchPricesBatch(
    tenantId: string,
    productPriceMap: Map<string, string>
  ): Observable<Record<string, { id: string; amount: number; currency: string }>> {
    if (productPriceMap.size === 0) {
      return of({});
    }

    const priceRequests: Record<
      string,
      Observable<{ id: string; amount: number; currency: string } | null>
    > = {};

    productPriceMap.forEach((priceId, productId) => {
      priceRequests[priceId] = this.fetchPrice(tenantId, productId, priceId);
    });

    return forkJoin(priceRequests).pipe(
      map((results: Record<string, { id: string; amount: number; currency: string } | null>) => {
        // Filter out null values (failed requests)
        const validPrices: Record<string, { id: string; amount: number; currency: string }> =
          {};
        for (const [priceId, price] of Object.entries(results)) {
          if (price) {
            validPrices[priceId] = price;
          }
        }
        return validPrices;
      })
    );
  }

  /**
   * Merge fetched prices with products
   * Associates price objects with products based on defaultPriceId
   * @param products - Products to merge prices into
   * @param pricesMap - Map of priceId -> price object
   * @returns Products with embedded price data
   */
  private mergeProductsWithPrices(
    products: Product[],
    pricesMap: Record<string, { id: string; amount: number; currency: string }>
  ): Product[] {
    return products.map((product) => {
      if (product.defaultPriceId && pricesMap[product.defaultPriceId]) {
        return {
          ...product,
          defaultPrice: pricesMap[product.defaultPriceId],
        };
      }
      return product;
    });
  }

  /**
   * Fetch pictures for a single product
   * @param tenantId - Tenant ID
   * @param productId - Product ID
   * @returns Observable of picture array
   */
  private fetchProductPictures(
    tenantId: string,
    productId: string
  ): Observable<any[]> {
    return this.httpClient
      .get<{ pictures: any[] }>(
        `${this.API_URL}/tenants/${tenantId}/products/${productId}/pictures`
      )
      .pipe(
        map((response) => response.pictures || []),
        catchError((error) => {
          console.debug(`Failed to fetch pictures for product ${productId}:`, error);
          return of([]);
        })
      );
  }

  /**
   * Fetch pictures for multiple products in parallel
   * @param tenantId - Tenant ID
   * @param products - Products to fetch pictures for
   * @returns Observable of record mapping productId -> pictures array
   */
  private fetchPicturesBatch(
    tenantId: string,
    products: Product[]
  ): Observable<Record<string, any[]>> {
    if (products.length === 0) {
      return of({});
    }

    const pictureRequests: Record<string, Observable<any[]>> = {};

    products.forEach((product) => {
      pictureRequests[product.id] = this.fetchProductPictures(tenantId, product.id);
    });

    return forkJoin(pictureRequests);
  }

  /**
   * Merge fetched pictures with products
   * @param products - Products to merge pictures into
   * @param picturesMap - Map of productId -> pictures array
   * @returns Products with embedded pictures data
   */
  private mergeProductsWithPictures(
    products: Product[],
    picturesMap: Record<string, any[]>
  ): Product[] {
    return products.map((product) => ({
      ...product,
      pictures: picturesMap[product.id] || [],
    }));
  }

  /**
   * Fetch products with prices and pictures
   * Implements three-stage loading:
   * 1. Fetch products from API or cache
   * 2. Batch fetch prices for all products in parallel
   * 3. Batch fetch pictures for all products in parallel
   * 4. Merge prices and pictures with products
   * 5. Cache prices aggressively for future use
   * 6. Preload images to IndexedDB for offline availability
   * This approach solves the N+1 problem by batching requests
   * @param tenantId - Optional tenant ID (uses current tenant if not provided)
   * @param forceRefresh - Force refresh from API, bypassing cache
   * @returns Observable of products with embedded prices and pictures
   */
  fetchProductsWithPrices(tenantId?: string, forceRefresh = false): Observable<Product[]> {
    const activeTenantId = tenantId || this.tenantService.getCurrentTenantId();

    if (!activeTenantId) {
      console.error('No tenant ID available for fetching products');
      return of([]);
    }

    this.isLoading.set(true);

    return this.fetchProducts(activeTenantId, forceRefresh).pipe(
      switchMap((products) => {
        // Fetch pictures for all products in parallel
        return this.fetchPicturesBatch(activeTenantId, products).pipe(
          map((picturesMap) => ({
            products: this.mergeProductsWithPictures(products, picturesMap),
            activeTenantId,
          }))
        );
      }),
      switchMap(({ products: productsWithPictures, activeTenantId }) => {
        // Build map of productId -> priceId for products with prices
        const productPriceMap = new Map<string, string>();
        productsWithPictures.forEach((product) => {
          if (product.defaultPriceId) {
            productPriceMap.set(product.id, product.defaultPriceId);
          }
        });

        // If no products have prices, return products with pictures as-is
        if (productPriceMap.size === 0) {
          this.isLoading.set(false);
          return of(productsWithPictures);
        }

        // Fetch prices in batch
        return from(this.getPriceCache(activeTenantId)).pipe(
          switchMap((priceCache) => {
            // Check which prices are already cached
            const cachedPrices: Record<string, { id: string; amount: number; currency: string }> = priceCache?.prices || {};
            const uncachedPriceMap = new Map<string, string>();

            productPriceMap.forEach((priceId, productId) => {
              if (!cachedPrices[priceId]) {
                uncachedPriceMap.set(productId, priceId);
              }
            });

            // If all prices are cached, use them
            if (uncachedPriceMap.size === 0) {
              const mergedProducts = this.mergeProductsWithPrices(productsWithPictures, cachedPrices);
              this.isLoading.set(false);
              return of(mergedProducts);
            }

            // Fetch missing prices and merge with cached prices
            return this.fetchPricesBatch(activeTenantId, uncachedPriceMap).pipe(
              tap(async (fetchedPrices) => {
                // Combine cached and newly fetched prices
                const allPrices = { ...cachedPrices, ...fetchedPrices };
                // Cache the new prices
                await this.setPriceCache(activeTenantId, allPrices);
              }),
              map((fetchedPrices) => {
                const allPrices = { ...cachedPrices, ...fetchedPrices };
                return this.mergeProductsWithPrices(productsWithPictures, allPrices);
              }),
              tap(() => {
                this.isLoading.set(false);
              }),
              catchError((error) => {
                console.error('Failed to fetch prices:', error);
                this.isLoading.set(false);
                // Return products with pictures but without prices on error
                return of(productsWithPictures);
              })
            );
          })
        );
      }),
      tap((productsWithPricesAndPictures) => {
        // Update products signal with enriched data
        this.products.set(productsWithPricesAndPictures);
      }),
      tap((productsWithPricesAndPictures) => {
        // Preload images for offline availability
        const activeTenantId = this.tenantService.getCurrentTenantId();
        if (activeTenantId) {
          this.imageCacheService
            .preloadProductImages(activeTenantId, productsWithPricesAndPictures)
            .catch((error) => {
              console.debug('Image preloading failed (non-blocking):', error);
            });
        }
      })
    );
  }

  /**
   * Format price with currency symbol and proper locale formatting
   * Uses Intl.NumberFormat for locale-aware currency formatting
   * Handles different currency symbol placements (USD: $12.99, EUR: 12,99 €)
   * @param amount - Price amount
   * @param currency - Currency code (e.g., 'USD', 'EUR')
   * @returns Formatted price string with currency symbol
   */
  formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}
