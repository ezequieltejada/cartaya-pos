import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TenantSettings } from '../models/tenant-settings.model';

/**
 * Settings Service
 * Manages tenant settings including timezone and currency
 * Fetches settings from the backend and provides them to other services
 */
@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private httpClient = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api`;

  // Writable signals
  readonly tenantSettings = signal<TenantSettings | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // Computed signals
  readonly currency = computed(() => this.tenantSettings()?.currency ?? 'EUR');
  readonly timezone = computed(() => this.tenantSettings()?.timezone ?? 'UTC');

  /**
   * Fetch tenant settings from the backend
   * @param tenantId The tenant ID for which to fetch settings
   * @returns Observable with tenant settings
   */
  fetchTenantSettings(tenantId: string): Observable<TenantSettings> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.httpClient
      .get<TenantSettings>(`${this.API_URL}/tenants/${tenantId}/settings`)
      .pipe(
        tap((settings) => {
          this.tenantSettings.set(settings);
          this.isLoading.set(false);
        }),
        catchError((error) => {
          this.isLoading.set(false);
          const errorMessage = error?.error?.message || 'Failed to fetch tenant settings';
          this.error.set(errorMessage);
          console.error('Failed to fetch tenant settings:', error);
          throw error;
        })
      );
  }

  /**
   * Get the current tenant currency
   * Returns cached value or 'EUR' as fallback
   */
  getCurrentCurrency(): string {
    return this.currency();
  }

  /**
   * Get the current tenant timezone
   * Returns cached value or 'UTC' as fallback
   */
  getCurrentTimezone(): string {
    return this.timezone();
  }

  /**
   * Get the full settings object
   */
  getSettings(): TenantSettings | null {
    return this.tenantSettings();
  }

  /**
   * Clear cached settings
   */
  clearSettings(): void {
    this.tenantSettings.set(null);
    this.error.set(null);
  }
}
