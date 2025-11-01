import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Modifier } from '../models/modifier.model';
import { StorageService } from './storage.service';

/**
 * Cache metadata for storing modifiers with TTL
 */
interface ModifierCache {
  modifiers: Modifier[];
  timestamp: number;
  productId: string;
}

/**
 * API Response format for modifiers endpoint
 */
interface ModifiersApiResponse {
  data: Modifier[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * ModifierService
 * Manages modifier state and API interactions
 * Provides functionality to fetch modifiers for products and cache them locally
 * Follows the established pattern from ProductService
 */
@Injectable({
  providedIn: 'root',
})
export class ModifierService {
  private httpClient = inject(HttpClient);
  private storageService = inject(StorageService);

  private readonly API_URL = `${environment.apiUrl}/api`;

  /**
   * Signal to track loading state during API requests
   * true when fetching modifiers from API, false otherwise
   */
  readonly isLoading = signal(false);

  /**
   * Get cache key for modifiers of a specific POS location
   * Cache is keyed by POS ID to support per-location modifier caching
   * @param posId - Point of Sale ID
   * @returns Cache key string
   */
  private getCacheKey(posId: string): string {
    return `modifiers_${posId}`;
  }

  /**
   * Get modifiers from cache if they exist and are valid
   * Checks for cache expiration (no TTL for MVP, cache indefinitely)
   * Returns null if cache miss or parse error occurs
   * @param posId - Point of Sale ID
   * @returns Promise resolving to cached modifiers or null
   */
  private async getModifiersCache(posId: string): Promise<Modifier[] | null> {
    try {
      const key = this.getCacheKey(posId);
      const cached = await this.storageService.get<Modifier[]>(key);
      return cached || null;
    } catch (e) {
      console.debug('Failed to retrieve modifiers cache:', e);
      return null;
    }
  }

  /**
   * Save modifiers to cache for offline support
   * Stores modifiers indefinitely (MVP strategy)
   * Manual invalidation or app restart clears cache
   * @param posId - Point of Sale ID
   * @param modifiers - Modifiers to cache
   * @returns Promise resolving when cache is saved
   */
  async cacheModifiers(posId: string, modifiers: Modifier[]): Promise<void> {
    try {
      const key = this.getCacheKey(posId);
      await this.storageService.set(key, modifiers);
    } catch (e) {
      console.debug('Failed to save modifiers cache:', e);
    }
  }

  /**
   * Retrieve cached modifiers from storage
   * Returns null if cache doesn't exist or parse fails
   * This is a public wrapper around getModifiersCache
   * @param posId - Point of Sale ID
   * @returns Promise resolving to cached modifiers or null
   */
  async getCachedModifiers(posId: string): Promise<Modifier[] | null> {
    return this.getModifiersCache(posId);
  }

  /**
   * Fetch modifiers for a specific product from the backend API
   * Implements strategy:
   * 1. Make GET request to /api/tenants/:tenantId/products/:productId/modifiers
   * 2. Extract data from paginated response.data
   * 3. Filter to only include active modifiers
   * 4. Set loading state during request
   * 5. Cache results for offline support
   * 6. Handle errors gracefully (log to console, return empty array)
   * @param tenantId - Tenant ID
   * @param productId - Product ID to fetch modifiers for
   * @param posId - Point of Sale ID (used for caching)
   * @returns Observable of active modifiers for the product
   */
  fetchProductModifiers(
    tenantId: string,
    productId: string,
    posId: string
  ): Observable<Modifier[]> {
    this.isLoading.set(true);

    return this.httpClient
      .get<ModifiersApiResponse>(
        `${this.API_URL}/tenants/${tenantId}/products/${productId}/modifiers`,
        {
          params: {
            limit: '100',
          },
        }
      )
      .pipe(
        map((response) => {
          // Extract data array from paginated response
          if (!response.data) {
            return [];
          }
          // Filter to only active modifiers
          return response.data.filter((modifier) => modifier.active);
        }),
        tap(async (modifiers) => {
          // Cache modifiers for offline support
          await this.cacheModifiers(posId, modifiers);
          this.isLoading.set(false);
        }),
        catchError((error) => {
          console.error(
            `Failed to fetch modifiers for product ${productId}:`,
            error
          );
          this.isLoading.set(false);
          // Return empty array on error for graceful degradation
          return of([]);
        })
      );
  }
}
