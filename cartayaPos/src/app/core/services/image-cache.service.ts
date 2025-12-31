import { Injectable, inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';

/**
 * Image Cache Service
 * Manages offline image caching using IndexedDB when available (native apps)
 * Falls back to direct blob fetching with browser HTTP caching (web)
 *
 * Responsibilities:
 * - Cache product images in IndexedDB for offline access (native)
 * - Return cached ObjectURLs for efficient memory usage
 * - Clear cache on logout or tenant switch
 * - Handle image loading errors gracefully
 *
 * Design:
 * - ObjectURL Map persists across component lifecycle (singleton service)
 * - On native: IndexedDB stores actual image blobs
 * - On web: Relies on browser HTTP cache (max-age=1 year from server)
 * - Fetch from cache first, then network if needed
 * - All ObjectURLs revoked on clearCache() call
 */
@Injectable({
  providedIn: 'root',
})
export class ImageCacheService {
  private platform = inject(Platform);
  private objectUrls = new Map<string, string>();
  private isInitialized = false;
  private db: any = null;
  private isNativeApp = false;

  constructor() {
    this.isNativeApp = this.platform.is('capacitor');
    if (this.isNativeApp) {
      this.initDatabase();
    }
  }

  /**
   * Initialize the IndexedDB database (native apps only)
   * Falls back gracefully if IndexedDB is not available
   */
  private async initDatabase(): Promise<void> {
    if (!this.isNativeApp || this.isInitialized) {
      return;
    }

    try {
      const { openDB } = await import('idb');
      this.db = await openDB('cartaya-image-cache', 1, {
        upgrade(db: any) {
          if (!db.objectStoreNames.contains('image-cache')) {
            db.createObjectStore('image-cache');
          }
        },
      });
      this.isInitialized = true;
    } catch (e) {
      console.debug('IndexedDB not available, using HTTP cache only:', e);
      this.isNativeApp = false;
    }
  }

  /**
   * Get image URL for a product image
   * Returns cached ObjectURL if available, otherwise fetches and caches from network
   * Falls back to null on network/cache errors
   *
   * @param tenantId - Tenant ID (for cache key only, not used in URL construction)
   * @param productId - Product ID (for cache key only, not used in URL construction)
   * @param filename - Full image path from API (tenantId/productId/filename)
   * @returns Promise resolving to ObjectURL string or null
   */
  async getImageUrl(
    tenantId: string,
    productId: string,
    filename: string
  ): Promise<string | null> {
    try {
      const key = `${tenantId}/${productId}/${filename}`;

      // Return existing ObjectURL if available
      if (this.objectUrls.has(key)) {
        return this.objectUrls.get(key)!;
      }

      // Check IndexedDB cache (native apps only)
      if (this.isNativeApp && this.db) {
        const cached = await this.db.get('image-cache', key);
        if (cached) {
          return this.createObjectUrl(key, cached.blob);
        }
      }

      // Fetch from network using the full filename path
      // filename already contains: tenantId/productId/actualFilename
      const url = `${environment.apiUrl}/media/pictures/${filename}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`Failed to fetch image ${filename}: ${response.status}`);
        return null;
      }

      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 'image/jpeg';

      // Store in IndexedDB cache (native apps only)
      if (this.isNativeApp && this.db) {
        try {
          await this.db.put('image-cache', {
            key,
            blob,
            contentType,
            cachedAt: Date.now(),
          });
        } catch (e) {
          console.debug('Failed to cache image in IndexedDB:', e);
        }
      }

      return this.createObjectUrl(key, blob);
    } catch (error) {
      console.warn(`Error getting image URL for ${filename}:`, error);
      return null;
    }
  }

  /**
   * Create ObjectURL from blob and track it
   * Reuses existing URL if already created
   *
   * @param key - Cache key
   * @param blob - Image blob
   * @returns ObjectURL string
   */
  private createObjectUrl(key: string, blob: Blob): string {
    if (this.objectUrls.has(key)) {
      return this.objectUrls.get(key)!;
    }

    const url = URL.createObjectURL(blob);
    this.objectUrls.set(key, url);
    return url;
  }

  /**
   * Preload images for multiple products in parallel
   * Fetches and caches the main image for each product
   * Non-blocking - errors are logged but don't throw
   *
   * @param tenantId - Tenant ID
   * @param products - Products to preload images for
   */
  async preloadProductImages(tenantId: string, products: Product[]): Promise<void> {
    const preloadPromises = products
      .map((product) => {
        // Find the main picture or use first picture
        const mainPicture = product.pictures?.find((p) => p.isMain) || product.pictures?.[0];
        if (!mainPicture) {
          return null;
        }
        return this.getImageUrl(tenantId, product.id, mainPicture.filename);
      })
      .filter((p) => p !== null) as Promise<string | null>[];

    // Wait for all preloads, but don't throw on individual failures
    await Promise.all(
      preloadPromises.map((p) =>
        p.catch((error) => {
          console.debug('Image preload failed (non-blocking):', error);
          return null;
        })
      )
    );
  }

  /**
   * Clear all cached images and revoke ObjectURLs
   * Called on logout or tenant switch
   * Safe to call multiple times
   */
  async clearCache(): Promise<void> {
    try {
      // Revoke all ObjectURLs to free memory
      for (const url of this.objectUrls.values()) {
        URL.revokeObjectURL(url);
      }
      this.objectUrls.clear();

      // Clear IndexedDB
      if (this.isNativeApp && this.db) {
        await this.db.clear('image-cache');
      }

      console.debug('Image cache cleared');
    } catch (error) {
      console.warn('Error clearing image cache:', error);
    }
  }

  /**
   * Get current cache size for debugging/monitoring
   * @returns Promise resolving to approximate cache size in bytes
   */
  async getCacheSize(): Promise<number> {
    try {
      if (!this.isNativeApp || !this.db) {
        return 0;
      }

      const allCached = await this.db.getAll('image-cache');
      return allCached.reduce((sum: number, item: any) => sum + item.blob.size, 0);
    } catch (error) {
      console.warn('Error getting cache size:', error);
      return 0;
    }
  }
}
