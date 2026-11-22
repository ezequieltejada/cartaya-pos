import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandlerFn,
    HttpInterceptorFn,
    HttpRequest
} from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
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
  const injector = inject(Injector);

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
        return handle401Error(authReq, next, authService, router, toastController, injector);
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
  toastController: ToastController,
  injector: Injector
): Observable<HttpEvent<unknown>> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    const refreshToken = authService.getRefreshToken();

    if (!refreshToken) {
      // No refresh token available, clear session
      isRefreshing = false;
      authService.clearSession();
      showSessionExpiredToast(toastController, injector);
      router.navigate(['/auth/login'], { replaceUrl: true });
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
        showSessionExpiredToast(toastController, injector);
        router.navigate(['/auth/login'], { replaceUrl: true });
        
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
function showSessionExpiredToast(toastController: ToastController, injector: Injector): void {
  toastController
    .create({
      message: injector.get(TranslateService).instant('API_ERRORS.SESSION_EXPIRED'),
      duration: 3000,
      position: 'bottom',
      color: 'warning',
    })
    .then((toast) => {
      toast.present();
    });
}
