import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';
import { AuthService } from './auth.service';
import { ImageCacheService } from './image-cache.service';
import { ProductService } from './product.service';
import { StorageService } from './storage.service';
import { TenantService } from './tenant.service';

const API = `${environment.apiUrl}/api`;

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let storageService: jasmine.SpyObj<StorageService>;
  let tenantService: jasmine.SpyObj<TenantService>;
  let productService: jasmine.SpyObj<ProductService>;
  let imageCacheService: jasmine.SpyObj<ImageCacheService>;
  let router: jasmine.SpyObj<Router>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  /** Lets the async work that follows an HTTP response (storage writes, ...) finish. */
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  beforeEach(() => {
    storageService = jasmine.createSpyObj('StorageService', ['set', 'get', 'remove', 'clear']);
    storageService.set.and.returnValue(Promise.resolve());
    storageService.get.and.returnValue(Promise.resolve(null));
    storageService.remove.and.returnValue(Promise.resolve());
    storageService.clear.and.returnValue(Promise.resolve());

    tenantService = jasmine.createSpyObj('TenantService', ['fetchUserTenants', 'clearSelection']);
    tenantService.fetchUserTenants.and.returnValue(of([{ id: 'tenant-1' }]) as never);
    tenantService.clearSelection.and.returnValue(Promise.resolve());

    productService = jasmine.createSpyObj('ProductService', ['clearCache']);
    productService.clearCache.and.returnValue(Promise.resolve());
    imageCacheService = jasmine.createSpyObj('ImageCacheService', ['clearCache']);
    imageCacheService.clearCache.and.returnValue(Promise.resolve());
    router = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        { provide: StorageService, useValue: storageService },
        { provide: TenantService, useValue: tenantService },
        { provide: ProductService, useValue: productService },
        { provide: ImageCacheService, useValue: imageCacheService },
        { provide: Router, useValue: router },
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    const credentials = { email: 'test@example.com', password: 'password123' };

    it('should set the current user and persist the tokens and user', async () => {
      const result = firstValueFrom(service.login(credentials.email, credentials.password));

      const req = httpMock.expectOne(`${API}/auth/sign-in/email`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      req.flush({ user: mockUser, token: 'token-1' });

      expect(await result).toEqual(mockUser);
      expect(service.currentUser()).toEqual(mockUser);
      expect(service.getAccessToken()).toBe('token-1');
      expect(storageService.set).toHaveBeenCalledWith('access_token', 'token-1');
      expect(storageService.set).toHaveBeenCalledWith('refresh_token', 'token-1');
      expect(storageService.set).toHaveBeenCalledWith('currentUser', mockUser);
    });

    it('should load the user tenants after signing in', async () => {
      const result = firstValueFrom(service.login(credentials.email, credentials.password));
      httpMock.expectOne(`${API}/auth/sign-in/email`).flush({ user: mockUser, token: 'token-1' });

      await result;

      expect(tenantService.fetchUserTenants).toHaveBeenCalled();
    });

    it('should still sign in when loading the tenants fails', async () => {
      spyOn(console, 'error');
      tenantService.fetchUserTenants.and.returnValue(throwError(() => new Error('tenants down')));

      const result = firstValueFrom(service.login(credentials.email, credentials.password));
      httpMock.expectOne(`${API}/auth/sign-in/email`).flush({ user: mockUser, token: 'token-1' });

      expect(await result).toEqual(mockUser);
      expect(service.isLoading()).toBeFalse();
    });

    it('should be loading until the sign-in finishes', async () => {
      expect(service.isLoading()).toBeFalse();

      const result = firstValueFrom(service.login(credentials.email, credentials.password));
      expect(service.isLoading()).toBeTrue();

      httpMock.expectOne(`${API}/auth/sign-in/email`).flush({ user: mockUser, token: 'token-1' });
      await result;

      expect(service.isLoading()).toBeFalse();
    });

    it('should propagate the API error and stop loading on a failed sign-in', async () => {
      const result = firstValueFrom(service.login(credentials.email, 'wrong-pass')).catch((e) => e);

      httpMock
        .expectOne(`${API}/auth/sign-in/email`)
        .flush({ code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });

      const error = await result;
      expect(error.status).toBe(401);
      expect(error.error.code).toBe('INVALID_CREDENTIALS');
      expect(service.isLoading()).toBeFalse();
      expect(service.currentUser()).toBeNull();
    });

    it('should fail when the API returns no token', async () => {
      const result = firstValueFrom(service.login(credentials.email, credentials.password)).catch((e) => e);

      httpMock.expectOne(`${API}/auth/sign-in/email`).flush({ user: mockUser });

      expect((await result).message).toBe('No authentication token received');
      expect(service.isLoading()).toBeFalse();
    });
  });

  describe('checkSession', () => {
    it('should return null without calling the API when there is no stored token', async () => {
      const user = await firstValueFrom(service.checkSession());

      expect(user).toBeNull();
      httpMock.expectNone(`${API}/auth/get-session`);
      expect(service.isLoading()).toBeFalse();
    });

    describe('with a stored token', () => {
      beforeEach(() => {
        storageService.get.and.callFake(((key: string) =>
          Promise.resolve(key === 'access_token' || key === 'refresh_token' ? 'stored-token' : null)) as never);
      });

      it('should return the current user when the session is valid', async () => {
        const result = firstValueFrom(service.checkSession());
        await settle();

        httpMock.expectOne(`${API}/auth/get-session`).flush({ user: mockUser });

        expect(await result).toEqual(mockUser);
        expect(service.currentUser()).toEqual(mockUser);
        expect(tenantService.fetchUserTenants).toHaveBeenCalled();
      });

      it('should return null when the session is invalid', async () => {
        const result = firstValueFrom(service.checkSession());
        await settle();

        httpMock.expectOne(`${API}/auth/get-session`).flush({ user: null });

        expect(await result).toBeNull();
        expect(service.currentUser()).toBeNull();
        expect(service.isLoading()).toBeFalse();
      });

      it('should handle network errors gracefully', async () => {
        const result = firstValueFrom(service.checkSession());
        await settle();

        httpMock.expectOne(`${API}/auth/get-session`).error(new ProgressEvent('error'));

        expect(await result).toBeNull();
        expect(service.currentUser()).toBeNull();
        expect(service.isLoading()).toBeFalse();
      });
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      service.currentUser.set(mockUser);
    });

    it('should clear caches and the session and go to the login page', async () => {
      const result = firstValueFrom(service.logout());

      httpMock.expectOne(`${API}/auth/sign-out`).flush(null);
      await result;

      expect(productService.clearCache).toHaveBeenCalled();
      expect(imageCacheService.clearCache).toHaveBeenCalled();
      expect(storageService.clear).toHaveBeenCalled();
      expect(service.currentUser()).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { replaceUrl: true });
      expect(service.isLoading()).toBeFalse();
    });

    it('should clear the session even if the logout request fails', async () => {
      const result = firstValueFrom(service.logout());

      httpMock.expectOne(`${API}/auth/sign-out`).flush({}, { status: 500, statusText: 'Server Error' });
      await result;

      expect(storageService.clear).toHaveBeenCalled();
      expect(service.currentUser()).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { replaceUrl: true });
    });
  });

  describe('clearSession', () => {
    it('should clear the user, tokens, tenant selection and storage', async () => {
      service.currentUser.set(mockUser);

      await service.clearSession();

      expect(service.currentUser()).toBeNull();
      expect(service.getAccessToken()).toBeNull();
      expect(storageService.remove).toHaveBeenCalledWith('access_token');
      expect(storageService.remove).toHaveBeenCalledWith('refresh_token');
      expect(tenantService.clearSelection).toHaveBeenCalled();
      expect(storageService.clear).toHaveBeenCalled();
    });
  });

  describe('authentication state', () => {
    it('should be authenticated when a user is logged in', () => {
      service.currentUser.set(mockUser);

      expect(service.isAuthenticated()).toBeTrue();
      expect(service.getIsAuthenticated()).toBeTrue();
      expect(service.getCurrentUser()).toEqual(mockUser);
    });

    it('should not be authenticated when no user is logged in', () => {
      expect(service.isAuthenticated()).toBeFalse();
      expect(service.getIsAuthenticated()).toBeFalse();
      expect(service.getCurrentUser()).toBeNull();
    });
  });
});
