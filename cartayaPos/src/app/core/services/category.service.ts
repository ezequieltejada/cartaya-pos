import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, from, map, of, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category } from '../models/category.model';
import { Product } from '../models/product.model';
import { StorageService } from './storage.service';
import { TenantService } from './tenant.service';

/**
 * Cache metadata for storing category cache with TTL
 */
interface CategoryCache {
  categories: Category[];
  timestamp: number;
  tenantId: string;
}

/**
 * Category Service
 * Manages category state and API interactions
 * Follows the established pattern from ProductService
 */
@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private httpClient = inject(HttpClient);
  private storageService = inject(StorageService);
  private tenantService = inject(TenantService);

  private readonly API_URL = `${environment.apiUrl}/api`;
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  // Writable signals
  readonly categories = signal<Category[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Alphabetically sorted categories computed signal
  readonly sortedCategories = computed(() =>
    [...this.categories()].sort((a, b) => a.name.localeCompare(b.name))
  );

  /**
   * Get user-friendly error message based on HTTP error
   * @param error - HTTP error object
   * @returns User-friendly error message
   */
  private getErrorMessage(error: unknown): string {
    if (error.status === 0) {
      return 'No internet connection. Please check your network.';
    } else if (error.status === 401) {
      return 'Session expired. Please log in again.';
    } else if (error.status === 403) {
      return 'You do not have permission to view categories.';
    } else if (error.status >= 500) {
      return 'Server error. Please try again later.';
    } else {
      return 'Failed to load categories. Please try again.';
    }
  }

  /**
   * Get cache key for a tenant
   * @param tenantId - Tenant ID
   * @returns Cache key string
   */
  private getCacheKey(tenantId: string): string {
    return `categories_${tenantId}`;
  }

  /**
   * Get categories from cache if valid (not expired)
   * @param tenantId - Tenant ID to get cache for
   * @returns Promise resolving to cached categories or null
   */
  private async getCache(tenantId: string): Promise<Category[] | null> {
    try {
      const key = this.getCacheKey(tenantId);
      const cached = await this.storageService.get<CategoryCache>(key);

      if (!cached) return null;

      const age = Date.now() - cached.timestamp;
      if (age > this.CACHE_TTL) {
        await this.storageService.remove(key);
        return null;
      }

      return cached.categories;
    } catch (e) {
      console.debug('Failed to retrieve category cache:', e);
      return null;
    }
  }

  /**
   * Save categories to cache with timestamp
   * @param tenantId - Tenant ID to save cache for
   * @param categories - Categories to cache
   * @returns Promise resolving when cache is saved
   */
  private async setCache(tenantId: string, categories: Category[]): Promise<void> {
    try {
      const key = this.getCacheKey(tenantId);
      const cache: CategoryCache = {
        categories,
        timestamp: Date.now(),
        tenantId,
      };
      await this.storageService.set(key, cache);
    } catch (e) {
      console.debug('Failed to save category cache:', e);
    }
  }

  /**
   * Clear cache for specific tenant or all category caches
   * @param tenantId - Optional tenant ID to clear cache for
   * @returns Promise resolving when cache is cleared
   */
  async clearCache(tenantId?: string): Promise<void> {
    try {
      if (tenantId) {
        const key = this.getCacheKey(tenantId);
        await this.storageService.remove(key);
      } else {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('categories_')) {
            keys.push(key);
          }
        }
        for (const key of keys) {
          await this.storageService.remove(key);
        }
      }
    } catch (e) {
      console.debug('Failed to clear category cache:', e);
    }
  }

  /**
   * Fetch categories from API
   * Implements caching strategy:
   * 1. Check cache first (return immediately if valid)
   * 2. Make API call if cache miss or expired
   * 3. Cache results for subsequent calls
   * 4. Handle errors gracefully with user-friendly messages
   * 5. Return cached categories if available on error
   * @param tenantId - Optional tenant ID (uses current tenant if not provided)
   * @param forceRefresh - Force refresh from API, bypassing cache
   * @returns Observable of fetched categories
   */
  fetchCategories(tenantId?: string, forceRefresh = false): Observable<Category[]> {
    const activeTenantId = tenantId || this.tenantService.getCurrentTenantId();

    if (!activeTenantId) {
      console.error('No tenant ID available for fetching categories');
      return of([]);
    }

    this.isLoading.set(true);

    return from(this.getCache(activeTenantId)).pipe(
      switchMap((cachedCategories) => {
        if (!forceRefresh && cachedCategories) {
          this.categories.set(cachedCategories);
          this.isLoading.set(false);
          this.error.set(null);
          return of(cachedCategories);
        }

        return this.httpClient
          .get<{ data: Category[] }>(
            `${this.API_URL}/tenants/${activeTenantId}/categories`
          )
          .pipe(
            tap(async (response) => {
              this.categories.set(response.data);
              await this.setCache(activeTenantId, response.data);
              this.isLoading.set(false);
              this.error.set(null);
            }),
            map((response): Category[] => response.data),
            catchError((error) => {
              console.error('Failed to fetch categories:', error);
              this.isLoading.set(false);

              const errorMessage = this.getErrorMessage(error);
              this.error.set(errorMessage);

              if (cachedCategories) {
                this.categories.set(cachedCategories);
                return of(cachedCategories);
              }

              this.categories.set([]);
              return of([]);
            })
          );
      })
    );
  }

  /**
   * Get product count for a specific category
   * @param categoryId - Category ID
   * @param products - Array of products to count
   * @returns Number of products in the category
   */
  getCategoryProductCount(categoryId: string, products: Product[]): number {
    return products.filter((p) => p.category?.categoryId === categoryId).length;
  }
}
