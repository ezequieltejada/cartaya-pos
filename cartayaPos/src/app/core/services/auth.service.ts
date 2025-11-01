import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';
import { ProductService } from './product.service';
import { StorageService } from './storage.service';
import { TenantService } from './tenant.service';

/**
 * Authentication Service
 * Centralized authentication state and session management using Angular Signals
 * Provides reactive authentication state and handles login/logout operations
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private httpClient = inject(HttpClient);
  private router = inject(Router);
  private storageService = inject(StorageService);
  private tenantService = inject(TenantService);
  private productService = inject(ProductService);

  private readonly API_URL = `${environment.apiUrl}/api`;

  // Writable signals
  readonly currentUser = signal<User | null>(null);
  readonly isLoading = signal(false);

  // Computed signals
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /**
   * Log in user with email and password
   * Sets session cookie and stores user in signal
   * Then fetches user's tenants to establish tenant context
   */
  login(email: string, password: string): Observable<User> {
    this.isLoading.set(true);
    return this.httpClient
      .post<{ user: User }>(`${this.API_URL}/auth/sign-in/email`, {
        email,
        password,
      })
      .pipe(
        tap(async (response) => {
          this.currentUser.set(response.user);
          // Store user for later use
          await this.storageService.set('currentUser', response.user);
        }),
        tap(() => {
          // After successful login, fetch user's tenants
          this.tenantService.fetchUserTenants().subscribe({
            next: (tenants) => {
              if (tenants.length === 0) {
                console.warn('User has no assigned tenants');
              } else {
                console.log('Tenants fetched successfully:', tenants);
              }
              this.isLoading.set(false);
            },
            error: (error) => {
              console.error('Failed to fetch tenants after login:', error);
              this.isLoading.set(false);
            },
          });
        }),
        map((response) => response.user),
        catchError((error) => {
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  /**
   * Log out user and clear session
   * Clears all product caches as part of logout process
   */
  logout(): Observable<void> {
    this.isLoading.set(true);
    return this.httpClient.post<void>(`${this.API_URL}/auth/sign-out`, {}).pipe(
      tap(async () => {
        // Clear all product caches on logout
        await this.productService.clearCache();
        this.clearSession();
        this.isLoading.set(false);
        this.router.navigate(['/auth/login']);
      }),
      catchError((error) => {
        this.clearSession();
        this.isLoading.set(false);
        this.router.navigate(['/auth/login']);
        return of(undefined);
      })
    );
  }

  /**
   * Check if there is an active session
   * Called on app initialization to restore session
   * Also fetches user's tenants to establish tenant context
   */
  checkSession(): Observable<User | null> {
    this.isLoading.set(true);
    return this.httpClient.get<{ user: User | null }>(`${this.API_URL}/auth/get-session`).pipe(
      tap((response) => {
        if (response.user) {
          this.currentUser.set(response.user);
          // Fetch tenants for the authenticated user
          this.tenantService.fetchUserTenants().subscribe({
            next: () => {
              this.isLoading.set(false);
            },
            error: () => {
              this.isLoading.set(false);
            },
          });
        } else {
          this.isLoading.set(false);
        }
      }),
      map((response): User | null => response.user ?? null),
      catchError(() => {
        this.currentUser.set(null);
        this.isLoading.set(false);
        return of(null);
      })
    );
  }

  /**
   * Clear session and local state
   * Called on logout or when session becomes invalid
   */
  async clearSession(): Promise<void> {
    this.currentUser.set(null);
    await this.tenantService.clearSelection();
    await this.storageService.clear();
  }

  /**
   * Get current user (for component access)
   */
  getCurrentUser(): User | null {
    return this.currentUser();
  }

  /**
   * Check if authenticated (for guards and interceptors)
   */
  getIsAuthenticated(): boolean {
    return this.isAuthenticated();
  }
}
