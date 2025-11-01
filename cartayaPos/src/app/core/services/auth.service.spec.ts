import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let storageService: jasmine.SpyObj<StorageService>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(() => {
    const storageSpy = jasmine.createSpyObj('StorageService', ['set', 'get', 'remove', 'clear']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService, { provide: StorageService, useValue: storageSpy }],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    storageService = TestBed.inject(StorageService) as jasmine.SpyObj<StorageService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('login', () => {
    it('should set currentUser signal on successful login', (done) => {
      const credentials = { email: 'test@example.com', password: 'password123' };
      storageService.set.and.returnValue(Promise.resolve());

      service.login(credentials.email, credentials.password).subscribe((user) => {
        expect(user).toEqual(mockUser);
        expect(service.currentUser()).toEqual(mockUser);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/sign-in/email`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(credentials);
      req.flush({ user: mockUser });
    });

    it('should call storage service to persist user ID', (done) => {
      const credentials = { email: 'test@example.com', password: 'password123' };
      storageService.set.and.returnValue(Promise.resolve());

      service.login(credentials.email, credentials.password).subscribe(() => {
        expect(storageService.set).toHaveBeenCalledWith('lastTenantId', mockUser.id);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/sign-in/email`);
      req.flush({ user: mockUser });
    });

    it('should set isLoading signal during login', (done) => {
      const credentials = { email: 'test@example.com', password: 'password123' };
      storageService.set.and.returnValue(Promise.resolve());

      expect(service.isLoading()).toBe(false);

      const subscription = service.login(credentials.email, credentials.password).subscribe(() => {
        expect(service.isLoading()).toBe(false);
        subscription.unsubscribe();
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/sign-in/email`);
      req.flush({ user: mockUser });
    });

    it('should throw error on failed login', (done) => {
      const credentials = { email: 'test@example.com', password: 'wrongpassword' };
      storageService.set.and.returnValue(Promise.resolve());

      service.login(credentials.email, credentials.password).subscribe(
        () => {
          fail('should have failed');
        },
        (error) => {
          expect(error.status).toBe(401);
          expect(service.isLoading()).toBe(false);
          done();
        }
      );

      const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/sign-in/email`);
      req.flush('Invalid credentials', { status: 401, statusText: 'Unauthorized' });
    });
  });

  describe('checkSession', () => {
    it('should return current user if session is valid', (done) => {
      service.checkSession().subscribe((user) => {
        expect(user).toEqual(mockUser);
        expect(service.currentUser()).toEqual(mockUser);
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/get-session`);
      expect(req.request.method).toBe('GET');
      req.flush({ user: mockUser });
    });

    it('should return null if session is invalid', (done) => {
      service.checkSession().subscribe((user) => {
        expect(user).toBeNull();
        expect(service.currentUser()).toBeNull();
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/get-session`);
      req.flush({ user: null });
    });

    it('should handle network errors gracefully', (done) => {
      service.checkSession().subscribe((user) => {
        expect(user).toBeNull();
        expect(service.currentUser()).toBeNull();
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/get-session`);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('logout', () => {
    it('should clear session and call storage service', (done) => {
      service.currentUser.set(mockUser);
      storageService.clear.and.returnValue(Promise.resolve());

      service.logout().subscribe(() => {
        expect(service.currentUser()).toBeNull();
        expect(storageService.clear).toHaveBeenCalled();
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/sign-out`);
      expect(req.request.method).toBe('POST');
      req.flush({});
    });

    it('should clear session even if logout request fails', (done) => {
      service.currentUser.set(mockUser);
      storageService.clear.and.returnValue(Promise.resolve());

      service.logout().subscribe(() => {
        expect(service.currentUser()).toBeNull();
        done();
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/api/auth/sign-out`);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('clearSession', () => {
    it('should clear currentUser signal and storage', async () => {
      service.currentUser.set(mockUser);
      storageService.clear.and.returnValue(Promise.resolve());

      await service.clearSession();

      expect(service.currentUser()).toBeNull();
      expect(storageService.clear).toHaveBeenCalled();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when user is logged in', () => {
      service.currentUser.set(mockUser);
      expect(service.isAuthenticated()).toBe(true);
    });

    it('should return false when user is not logged in', () => {
      service.currentUser.set(null);
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', () => {
      service.currentUser.set(mockUser);
      expect(service.getCurrentUser()).toEqual(mockUser);
    });

    it('should return null if no user', () => {
      service.currentUser.set(null);
      expect(service.getCurrentUser()).toBeNull();
    });
  });

  describe('getIsAuthenticated', () => {
    it('should return true if authenticated', () => {
      service.currentUser.set(mockUser);
      expect(service.getIsAuthenticated()).toBe(true);
    });

    it('should return false if not authenticated', () => {
      service.currentUser.set(null);
      expect(service.getIsAuthenticated()).toBe(false);
    });
  });
});
