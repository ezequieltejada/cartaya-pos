import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TenantSettings } from '../models/tenant-settings.model';
import { UserSettings } from '../models/user.model';
import { parseApiError } from '../utils/api-error';

/**
 * Settings Service
 * Manages tenant settings including timezone and currency
 * Fetches settings from the backend and provides them to other services
 * Also manages user-specific settings (language preferences, etc.)
 */
@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private httpClient = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api`;

  // Writable signals
  readonly tenantSettings = signal<TenantSettings | null>(null);
  readonly userSettings = signal<UserSettings | null>(null);
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
          this.cacheSettings(tenantId, settings);
        }),
        catchError((error) => {
          this.isLoading.set(false);
          // Store the stable API error code; screens translate it via API_ERRORS.*
          this.error.set(parseApiError(error).code);
          console.error('Failed to fetch tenant settings:', error);
          throw error;
        })
      );
  }

  /**
   * Load tenant settings: show the cached copy immediately (so the right
   * currency is used even when offline), then refresh from the backend.
   */
  loadTenantSettings(tenantId: string): void {
    const cached = this.readCachedSettings(tenantId);
    if (cached) {
      this.tenantSettings.set(cached);
    }
    this.fetchTenantSettings(tenantId).subscribe({
      error: () => {
        // Keep cached/fallback values; error is already logged and stored
      },
    });
  }

  private cacheKey(tenantId: string): string {
    return `tenantSettings:${tenantId}`;
  }

  private cacheSettings(tenantId: string, settings: TenantSettings): void {
    try {
      localStorage.setItem(this.cacheKey(tenantId), JSON.stringify(settings));
    } catch {
      // Storage unavailable - non-fatal
    }
  }

  private readCachedSettings(tenantId: string): TenantSettings | null {
    try {
      const raw = localStorage.getItem(this.cacheKey(tenantId));
      return raw ? (JSON.parse(raw) as TenantSettings) : null;
    } catch {
      return null;
    }
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

  /**
   * Get the current user's language preference
   * Returns the language code from user settings or null if not set
   */
  getUserLanguage(): string | null {
    return this.userSettings()?.preferredLanguage ?? null;
  }

  /**
   * Set user language preference
   * Sends PATCH request to backend to update user settings
   * Updates local state on success, logs error and continues on failure
   * @param language The language code to set ('en' | 'es' | 'ca')
   * @returns Observable that completes when request finishes
   */
  setUserLanguage(language: string): Observable<UserSettings> {
    return this.httpClient
      .patch<UserSettings>(`${this.API_URL}/users/me/settings`, { preferredLanguage: language })
      .pipe(
        tap((settings) => {
          const currentSettings = this.userSettings() ?? {};
          this.userSettings.set({ ...currentSettings, preferredLanguage: settings.preferredLanguage });
        }),
        catchError((error) => {
          console.error('Failed to update user language preference:', error);
          throw error;
        })
      );
  }

  /**
   * Fetch user settings from the backend
   * Retrieves the current user's settings including language preference
   * @returns Observable with user settings
   */
  fetchUserSettings(): Observable<UserSettings> {
    return this.httpClient
      .get<UserSettings>(`${this.API_URL}/users/me/settings`)
      .pipe(
        tap((settings) => {
          this.userSettings.set(settings);
        }),
        catchError((error) => {
          console.error('Failed to fetch user settings:', error);
          throw error;
        })
      );
  }

  /**
   * Get the full user settings object
   */
  getUserSettings(): UserSettings | null {
    return this.userSettings();
  }
}
