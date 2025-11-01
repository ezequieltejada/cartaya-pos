import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Functional Auth Guard
 * Protects routes requiring authentication
 * Redirects to login if not authenticated
 */
export const authGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getIsAuthenticated()) {
    return true;
  }

  // Redirect to login page
  return router.createUrlTree(['/auth/login']);
};
