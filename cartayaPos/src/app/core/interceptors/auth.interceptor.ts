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
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

/**
 * HTTP Interceptor for authentication
 * - Adds withCredentials to all API requests to send session cookies
 * - Intercepts 401 responses and redirects to login
 * - Clears auth state on session expiration
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastController = inject(ToastController);

  // Add credentials to all requests (enables session cookies)
  const authReq = req.clone({
    withCredentials: true,
  });

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Session expired or invalid
        authService.clearSession();

        // Show toast notification and redirect
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

        router.navigate(['/auth/login']);
      }

      return throwError(() => error);
    })
  );
};
