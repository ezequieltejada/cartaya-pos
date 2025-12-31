import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Tenant } from '../models/tenant.model';
import { ImageCacheService } from './image-cache.service';
import { StorageService } from './storage.service';

/**
 * Tenant Service
 * Manages tenant/organization selection and retrieval
 * Handles multi-tenant context for the current user
 */
@Injectable({
  providedIn: 'root',
})
export class TenantService {
  private httpClient = inject(HttpClient);
  private storageService = inject(StorageService);
  private imageCacheService = inject(ImageCacheService);

  private readonly API_URL = `${environment.apiUrl}/api`;

  // Writable signals
  readonly userTenants = signal<Tenant[]>([]);
  readonly selectedTenant = signal<Tenant | null>(null);
  readonly isLoading = signal(false);

  /**
   * Fetch user's available tenants
   * Called after successful login to get the list of tenants the user belongs to
   */
  fetchUserTenants(): Observable<Tenant[]> {
    this.isLoading.set(true);
    return this.httpClient
      .get<{ data: Tenant[] }>(`${this.API_URL}/tenants`)
      .pipe(
        tap((response) => {
          this.userTenants.set(response.data);
          
          // If no tenant is selected, select the first one
          if (response.data.length > 0 && !this.selectedTenant()) {
            this.selectTenant(response.data[0]);
          }
          
          this.isLoading.set(false);
        }),
        map((response): Tenant[] => response.data),
        catchError((error) => {
          this.isLoading.set(false);
          console.error('Failed to fetch user tenants:', error);
          return of([]);
        })
      );
  }

  /**
   * Select a tenant
   * Persists selection to storage and clears image cache
   * (Images from one tenant should not appear when switching to another)
   */
  async selectTenant(tenant: Tenant): Promise<void> {
    this.selectedTenant.set(tenant);
    await this.storageService.set('selectedTenant', tenant);
    // Clear image cache when switching tenants to prevent stale images
    await this.imageCacheService.clearCache();
  }

  /**
   * Get the current active tenant ID
   * Used for API calls that need tenant context
   */
  getCurrentTenantId(): string | null {
    return this.selectedTenant()?.id ?? null;
  }

  /**
   * Get currently selected tenant
   */
  getSelectedTenant(): Tenant | null {
    return this.selectedTenant();
  }

  /**
   * Clear tenant selection
   */
  async clearSelection(): Promise<void> {
    this.selectedTenant.set(null);
    await this.storageService.remove('selectedTenant');
  }

  /**
   * Restore selected tenant from storage
   * Should be called after StorageService has been initialized
   */
  async restoreSelectedTenant(): Promise<void> {
    try {
      const tenant = await this.storageService.get<Tenant>('selectedTenant');
      if (tenant) {
        this.selectedTenant.set(tenant);
      }
    } catch (e) {
      console.debug('Failed to restore selected tenant:', e);
    }
  }
}
