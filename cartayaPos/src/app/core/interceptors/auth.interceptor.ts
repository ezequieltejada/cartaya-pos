import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandlerFn,
    HttpInterceptorFn,
    HttpRequest
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * Flag to track if token refresh is in progress
 * Prevents multiple simultaneous refresh requests
 */
let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

/**
 * HTTP Interceptor for authentication
 * - Adds Authorization: Bearer <token> header to all API requests
 * - Intercepts 401 responses and attempts token refresh
 * - Clears auth state on session expiration
 * - Supports iOS mobile apps (no cookie dependency)
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastController = inject(ToastController);

  // Skip auth header for auth endpoints (login, refresh, etc.)
  const isAuthEndpoint = req.url.includes('/auth/sign-in') || 
                         req.url.includes('/auth/sign-up') ||
                         req.url.includes('/auth/refresh-token');

  // Clone request with Authorization header if token exists
  let authReq = req;
  const token = authService.getAccessToken();

  if (token && !isAuthEndpoint) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthEndpoint) {
        // Access token expired, attempt to refresh
        return handle401Error(authReq, next, authService, router, toastController);
      }

      return throwError(() => error);
    })
  );
};

/**
 * Handle 401 errors by attempting to refresh the access token
 * Uses a queue system to prevent multiple refresh requests
 */
function handle401Error(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router,
  toastController: ToastController
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const refreshToken = authService.getRefreshToken();

    if (!refreshToken) {
      // No refresh token available, clear session
      isRefreshing = false;
      authService.clearSession();
      showSessionExpiredToast(toastController);
      router.navigate(['/auth/login']);
      return throwError(() => new Error('No refresh token available'));
    }

    return authService.refreshAccessToken().pipe(
      switchMap((tokens) => {
        isRefreshing = false;
        refreshTokenSubject.next(tokens.accessToken);
        
        // Retry original request with new token
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });
        
        return next(authReq);
      }),
      catchError((error) => {
        isRefreshing = false;
        refreshTokenSubject.next(null);
        
        // Refresh failed, clear session and redirect
        authService.clearSession();
        showSessionExpiredToast(toastController);
        router.navigate(['/auth/login']);
        
        return throwError(() => error);
      })
    );
  } else {
    // Token refresh in progress, wait for new token
    return refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => {
        // Retry request with new token
        const authReq = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        return next(authReq);
      })
    );
  }
}

/**
 * Show toast notification for session expiration
 */
function showSessionExpiredToast(toastController: ToastController): void {
  toastController
    .create({
      message: 'Session expired. Please log in again.',
      duration: 3000,
      position: 'bottom',
      color: 'warning',
    })
    .then((toast) => {
      toast.present();
    });
}
