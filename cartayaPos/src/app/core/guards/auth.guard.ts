import { toObservable } from '@angular/core/rxjs-interop';
import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Functional Auth Guard
 * Protects routes requiring authentication
 * Redirects to login if not authenticated.
 *
 * On a fresh page load the session is restored asynchronously, so the guard
 * waits for the startup session check before deciding. This keeps deep links
 * (/cart, /order-history, ...) working for authenticated users.
 */
export const authGuard: CanActivateFn = (): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const decide = (): boolean | UrlTree =>
    authService.getIsAuthenticated() ? true : router.createUrlTree(['/auth/login']);

  // Already authenticated (e.g. just logged in): no need to wait
  if (authService.getIsAuthenticated() || authService.sessionChecked()) {
    return decide();
  }

  return toObservable(authService.sessionChecked).pipe(
    filter((checked) => checked),
    take(1),
    map(() => decide())
  );
};
