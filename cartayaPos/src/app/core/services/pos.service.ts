import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Pos } from '../models/pos.model';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { TenantService } from './tenant.service';
import { LoggerService } from './logger.service';

/**
 * Point of Sale (PoS) Service
 * Manages PoS location selection and retrieval
 */
@Injectable({
  providedIn: 'root',
})
export class PosService {
  private httpClient = inject(HttpClient);
  private storageService = inject(StorageService);
  private tenantService = inject(TenantService);
  private authService = inject(AuthService);
  private readonly log = inject(LoggerService).scope('pos');

  private readonly API_URL = `${environment.apiUrl}/api`;

  // Writable signals
  readonly availablePos = signal<Pos[]>([]);
  readonly selectedPos = signal<Pos | null>(null);
  readonly isLoading = signal(false);

  /**
   * Storage key for the PoS selection, scoped to the current user
   * so another user on the same device does not see the previous
   * user's selection. Returns null when no user is logged in.
   */
  private getSelectedPosKey(): string | null {
    const userId = this.authService.getCurrentUser()?.id;
    return userId ? `selectedPos:${userId}` : null;
  }

  /**
   * Fetch available PoS locations for the current tenant
   * Uses the tenant ID from TenantService instead of user ID
   * This fixes the issue where the wrong tenant ID was being used in API calls
   */
  fetchAvailablePos(tenantId?: string): Observable<Pos[]> {
    this.isLoading.set(true);
    
    // If no tenantId is provided, use the currently selected tenant
    const activeTenantId = tenantId || this.tenantService.getCurrentTenantId();
    
    if (!activeTenantId) {
      this.isLoading.set(false);
      this.log.error('No tenant ID available for fetching PoS locations');
      return of([]);
    }

    return this.httpClient
      .get<{ data: Pos[] }>(`${this.API_URL}/tenants/${activeTenantId}/pos`)
      .pipe(
        tap((response) => {
          this.availablePos.set(response.data);
          this.isLoading.set(false);
        }),
        map((response): Pos[] => response.data),
        catchError((error) => {
          this.isLoading.set(false);
          this.log.error('Failed to fetch PoS locations', error);
          return of([]);
        })
      );
  }

  /**
   * Select a PoS location
   * Persists selection to storage
   */
  async selectPos(pos: Pos): Promise<void> {
    this.selectedPos.set(pos);
    const key = this.getSelectedPosKey();
    if (!key) {
      return;
    }
    await this.storageService.set(key, pos);
  }

  /**
   * Clear PoS selection
   */
  async clearSelection(): Promise<void> {
    this.selectedPos.set(null);
    const key = this.getSelectedPosKey();
    if (!key) {
      return;
    }
    await this.storageService.remove(key);
  }

  /**
   * Get currently selected PoS
   */
  getSelectedPos(): Pos | null {
    return this.selectedPos();
  }

  /**
   * Restore selected PoS from storage
   * Should be called after StorageService has been initialized
   */
  async restoreSelectedPos(): Promise<void> {
    try {
      const key = this.getSelectedPosKey();
      if (!key) {
        return;
      }
      const pos = await this.storageService.get<Pos>(key);
      if (pos) {
        this.selectedPos.set(pos);
      }
    } catch (e) {
      this.log.trace('Failed to restore selected PoS', { error: String(e) });
    }
  }
}
