import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj(
      'AuthService',
      ['login', 'logout', 'checkSession', 'clearSession', 'getCurrentUser', 'getIsAuthenticated'],
      { sessionChecked: signal(true) }
    );

    const routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  it('should allow navigation when user is authenticated', () => {
    authService.getIsAuthenticated.and.returnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    );

    expect(result).toBe(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('should redirect to login when user is not authenticated', () => {
    authService.getIsAuthenticated.and.returnValue(false);
    const urlTree = {} as UrlTree;
    router.createUrlTree.and.returnValue(urlTree);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    );

    expect(result).toEqual(urlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/auth/login']);
  });

  it('should wait for the startup session check before deciding (deep links)', (done) => {
    const sessionChecked = signal(false);
    Object.defineProperty(authService, 'sessionChecked', { value: sessionChecked });
    authService.getIsAuthenticated.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    ) as Observable<boolean | UrlTree>;

    result.subscribe((value) => {
      expect(value).toBeTrue();
      done();
    });

    // Session restored: user is now authenticated
    authService.getIsAuthenticated.and.returnValue(true);
    sessionChecked.set(true);
    TestBed.tick();
  });

  it('should call getIsAuthenticated method', () => {
    authService.getIsAuthenticated.and.returnValue(true);

    TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    );

    expect(authService.getIsAuthenticated).toHaveBeenCalled();
  });
});
