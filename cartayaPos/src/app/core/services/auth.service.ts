import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';
import { ProductService } from './product.service';
import { StorageService } from './storage.service';
import { TenantService } from './tenant.service';

/**
 * Authentication tokens interface
 * Contains access token (short-lived) and refresh token (long-lived)
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Authentication Service
 * Centralized authentication state and session management using Angular Signals
 * Provides reactive authentication state and handles login/logout operations
 * Uses Bearer token authentication for mobile compatibility (iOS doesn't support cookies)
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
  private readonly ACCESS_TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';

  // Writable signals
  readonly currentUser = signal<User | null>(null);
  readonly isLoading = signal(false);
  private readonly accessToken = signal<string | null>(null);
  private readonly refreshToken = signal<string | null>(null);

  // Computed signals
  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  /**
   * Get the current access token
   * Used by HTTP interceptor to add Authorization header
   */
  getAccessToken(): string | null {
    return this.accessToken();
  }

  /**
   * Get the current refresh token
   * Used for token refresh operations
   */
  getRefreshToken(): string | null {
    return this.refreshToken();
  }

  /**
   * Set tokens in memory and storage
   * Stores tokens securely for persistence across app restarts
   */
  private async setTokens(tokens: AuthTokens): Promise<void> {
    this.accessToken.set(tokens.accessToken);
    this.refreshToken.set(tokens.refreshToken);
    await Promise.all([
      this.storageService.set(this.ACCESS_TOKEN_KEY, tokens.accessToken),
      this.storageService.set(this.REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
  }

  /**
   * Load tokens from storage
   * Called on app initialization to restore authentication state
   */
  async loadTokensFromStorage(): Promise<void> {
    try {
      const [accessToken, refreshToken] = await Promise.all([
        this.storageService.get<string>(this.ACCESS_TOKEN_KEY),
        this.storageService.get<string>(this.REFRESH_TOKEN_KEY),
      ]);
      
      if (accessToken && refreshToken) {
        this.accessToken.set(accessToken);
        this.refreshToken.set(refreshToken);
      }
    } catch (error) {
      console.error('Failed to load tokens from storage:', error);
    }
  }

  /**
   * Clear tokens from memory and storage
   */
  private async clearTokens(): Promise<void> {
    this.accessToken.set(null);
    this.refreshToken.set(null);
    await Promise.all([
      this.storageService.remove(this.ACCESS_TOKEN_KEY),
      this.storageService.remove(this.REFRESH_TOKEN_KEY),
    ]);
  }

  /**
   * Log in user with email and password
   * Receives Bearer token from server in the response body
   * Then fetches user's tenants to establish tenant context
   */
  login(email: string, password: string): Observable<User> {
    this.isLoading.set(true);
    return this.httpClient
      .post<{ user: User; token: string; redirect: boolean }>(
        `${this.API_URL}/auth/sign-in/email`,
        { email, password }
      )
      .pipe(
        switchMap(async (response) => {
          const user = response.user;
          const token = response.token;
          
          if (!user) {
            throw new Error('No user in response');
          }
          
          if (!token) {
            throw new Error('No authentication token received');
          }

          this.currentUser.set(user);

          // Store both access and refresh tokens
          // BetterAuth returns a single token that serves both purposes
          await this.setTokens({
            accessToken: token,
            refreshToken: token,
          });
          
          // Store user for later use
          await this.storageService.set('currentUser', user);
          
          return user;
        }),
        switchMap((user) => {
          // After successful login and token storage, fetch user's tenants
          return this.tenantService.fetchUserTenants().pipe(
            map((tenants) => {
              if (tenants.length === 0) {
                console.warn('User has no assigned tenants');
              } else {
                console.log('Tenants fetched successfully:', tenants);
              }
              this.isLoading.set(false);
              return user;
            }),
            catchError((error) => {
              console.error('Failed to fetch tenants after login:', error);
              this.isLoading.set(false);
              // Still return the user even if tenant fetch fails
              return of(user);
            })
          );
        }),
        catchError((error) => {
          this.isLoading.set(false);
          throw error;
        })
      );
  }

  /**
   * Log out user and clear session
   * Clears all product caches and tokens as part of logout process
   */
  logout(): Observable<void> {
    this.isLoading.set(true);
    return this.httpClient.post<void>(`${this.API_URL}/auth/sign-out`, {}).pipe(
      switchMap(async () => {
        // Clear all product caches on logout
        await this.productService.clearCache();
        await this.clearSession();
        this.isLoading.set(false);
        this.router.navigate(['/auth/login']);
      }),
      catchError((error) => {
        return new Observable<void>((observer) => {
          this.clearSession().then(() => {
            this.isLoading.set(false);
            this.router.navigate(['/auth/login']);
            observer.next();
            observer.complete();
          });
        });
      })
    );
  }

  /**
   * Refresh access token using refresh token
   * Called when access token expires (401 error)
   * Returns new tokens from response header and updates storage
   */
  refreshAccessToken(): Observable<AuthTokens> {
    const currentRefreshToken = this.refreshToken();
    
    if (!currentRefreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.httpClient
      .post<void>(
        `${this.API_URL}/auth/refresh-token`,
        { refreshToken: currentRefreshToken },
        { observe: 'response' } // Need full response to access headers
      )
      .pipe(
        tap(async (response) => {
          // Extract Bearer token from response header
          const bearerToken = response.headers.get('set-auth-token');
          
          if (!bearerToken) {
            throw new Error('No authentication token in refresh response');
          }

          await this.setTokens({
            accessToken: bearerToken,
            refreshToken: bearerToken,
          });
        }),
        map((response) => {
          const bearerToken = response.headers.get('set-auth-token')!;
          return {
            accessToken: bearerToken,
            refreshToken: bearerToken,
          };
        }),
        catchError((error) => {
          console.error('Failed to refresh token:', error);
          // If refresh fails, clear session and redirect to login
          this.clearSession();
          this.router.navigate(['/auth/login']);
          return throwError(() => error);
        })
      );
  }

  /**
   * Check if there is an active session
   * Called on app initialization to restore session
   * Uses the stored access token to verify authentication
   * Also fetches user's tenants to establish tenant context
   */
  checkSession(): Observable<User | null> {
    this.isLoading.set(true);
    
    // First, load tokens from storage
    return new Observable<User | null>((observer) => {
      this.loadTokensFromStorage().then(() => {
        const token = this.accessToken();
        
        if (!token) {
          this.isLoading.set(false);
          observer.next(null);
          observer.complete();
          return;
        }

        // Verify session with the backend
        this.httpClient.get<{ user: User | null }>(`${this.API_URL}/auth/get-session`).pipe(
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
        ).subscribe({
          next: (user) => {
            observer.next(user);
            observer.complete();
          },
          error: (err) => {
            observer.error(err);
          }
        });
      }).catch((error) => {
        console.error('Failed to load tokens:', error);
        this.isLoading.set(false);
        observer.next(null);
        observer.complete();
      });
    });
  }

  /**
   * Clear session and local state
   * Called on logout or when session becomes invalid
   * Clears tokens, user data, and tenant selection
   */
  async clearSession(): Promise<void> {
    this.currentUser.set(null);
    await this.clearTokens();
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
