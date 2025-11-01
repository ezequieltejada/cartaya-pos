import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { User } from '../models/user.model';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let mockUser: User;

  beforeEach(() => {
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'login',
      'logout',
      'checkSession',
      'clearSession',
      'getCurrentUser',
      'getIsAuthenticated',
    ]);

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

  it('should call getIsAuthenticated method', () => {
    authService.getIsAuthenticated.and.returnValue(true);

    TestBed.runInInjectionContext(() =>
      authGuard({} as any, {} as any)
    );

    expect(authService.getIsAuthenticated).toHaveBeenCalled();
  });
});
