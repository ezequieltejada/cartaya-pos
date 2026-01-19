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
 * 
 * Response structure from cartaya-api GET /products/:productId/modifiers
 * 
 * Key fields:
 * - id: Unique modifier identifier
 * - name: Display name shown to users
 * - priceDelta: Price adjustment (positive for add-ons, negative for discounts)
 * - currency: ISO 4217 currency code (must match product currency)
 * - active: Only active modifiers should be displayed/selectable
 * - isDefault: Whether this modifier is automatically included
 * - isRemovable: Whether default modifiers can be removed
 * - includedQuantity: Quantity included in base price (NEW FIELD)
 *   * If customer selects quantity <= includedQuantity, no extra charge applies
 *   * Example: "First 2 cheese slices included" → includedQuantity=2
 *   * If missing or null, defaults to 0 (charge full amount)
 * 
 * @example
 * {
 *   "data": [
 *     {
 *       "id": "mod-cheese",
 *       "name": "Extra Cheese",
 *       "priceDelta": 1.00,
 *       "currency": "USD",
 *       "active": true,
 *       "isDefault": false,
 *       "isRemovable": true,
 *       "includedQuantity": 2,  // First 2 are free, charged from 3rd onwards
 *       "createdAt": "2024-01-01T00:00:00Z",
 *       "updatedAt": "2024-01-15T14:30:00Z"
 *     }
 *   ],
 *   "pagination": { "total": 5, "limit": 100, "offset": 0, "hasMore": false }
 * }
 */
interface ModifiersApiResponse {
  data: {
    id: string;
    name: string;
    priceDelta: number;
    currency: string;
    active: boolean;
    isDefault?: boolean;
    isRemovable?: boolean;
    includedQuantity?: number;
    createdAt?: string;
    updatedAt?: string;
  }[];
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
   * 
   * Implements the following strategy:
   * 1. Make GET request to /api/tenants/:tenantId/products/:productId/modifiers
   * 2. Extract data from paginated response.data
   * 3. Filter to only include active modifiers
   * 4. Map API response to Modifier interface, preserving includedQuantity field
   * 5. Set loading state during request
   * 6. Cache results for offline support
   * 7. Handle errors gracefully (log to console, return empty array)
   * 
   * includedQuantity Handling:
   * - Field is preserved from API response using spread operator: {...modifier}
   * - If includedQuantity is present in API response, it's included in returned Modifiers
   * - If includedQuantity is missing or null, it defaults to undefined in Modifier interface
   * - Default behavior when undefined: treated as 0 in pricing calculations
   * 
   * @param tenantId - Tenant ID from settings service
   * @param productId - Product ID to fetch modifiers for
   * @param posId - Point of Sale ID (used for cache key)
   * @returns Observable of active Modifier[] with includedQuantity field preserved
   * 
   * @example
   * // API response includes includedQuantity
   * modifierService.fetchProductModifiers('tenant-1', 'prod-burger', 'pos-123')
   *   .subscribe(modifiers => {
   *     // modifiers[0] = {
   *     //   id: 'mod-cheese',
   *     //   name: 'Extra Cheese',
   *     //   priceDelta: 1.00,
   *     //   includedQuantity: 2,  // Preserved from API
   *     //   ...
   *     // }
   *   });
   */
  fetchProductModifiers(
    tenantId: string,
    productId: string,
    posId: string
  ): Observable<Modifier[]> {
    this.isLoading.set(true);

    return this.httpClient
      .get(
        `${this.API_URL}/tenants/${tenantId}/products/${productId}/modifiers`,
        {
          params: {
            limit: '100',
          },
        }
      )
      .pipe(
        map((response: any) => {
          // Extract data array from paginated response
          if (!response.data) {
            return [];
          }
          // Filter to only active modifiers and map to full Modifier type
          return response.data
            .filter((modifier: any) => modifier.active)
            .map((modifier: any) => {
              const mappedModifier = {
                ...modifier,
                default: modifier.isDefault,
                isRemovable: modifier.isRemovable,
                createdAt: '', // API doesn't provide these, set defaults
                updatedAt: '',
              } as Modifier;
              return mappedModifier;
            });
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
