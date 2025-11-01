import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let toastController: jasmine.SpyObj<ToastController>;

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', [
      'login',
      'logout',
      'checkSession',
      'clearSession',
      'getCurrentUser',
      'getIsAuthenticated',
    ]);

    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    const toastSpy = jasmine.createSpyObj('ToastController', ['create']);
    const mockToast = jasmine.createSpyObj('Toast', ['present']);
    toastSpy.create.and.returnValue(Promise.resolve(mockToast));

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ToastController, useValue: toastSpy },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    toastController = TestBed.inject(ToastController) as jasmine.SpyObj<ToastController>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should add withCredentials to requests', () => {
    httpClient.get('/test').subscribe();

    const req = httpMock.expectOne('/test');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
  });

  it('should handle 401 errors by clearing session', (done) => {
    authService.clearSession.and.returnValue(Promise.resolve());

    httpClient.get('/test').subscribe(
      () => {
        fail('should have errored');
      },
      () => {
        expect(authService.clearSession).toHaveBeenCalled();
        done();
      }
    );

    const req = httpMock.expectOne('/test');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
  });

  it('should redirect to login on 401 error', (done) => {
    authService.clearSession.and.returnValue(Promise.resolve());

    httpClient.get('/test').subscribe(
      () => {
        fail('should have errored');
      },
      () => {
        expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
        done();
      }
    );

    const req = httpMock.expectOne('/test');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
  });

  it('should show toast notification on 401 error', (done) => {
    authService.clearSession.and.returnValue(Promise.resolve());

    httpClient.get('/test').subscribe(
      () => {
        fail('should have errored');
      },
      () => {
        // Give async operations time to complete
        setTimeout(() => {
          expect(toastController.create).toHaveBeenCalled();
          done();
        }, 100);
      }
    );

    const req = httpMock.expectOne('/test');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
  });

  it('should pass through non-401 errors', (done) => {
    httpClient.get('/test').subscribe(
      () => {
        fail('should have errored');
      },
      (error: HttpErrorResponse) => {
        expect(error.status).toBe(500);
        expect(authService.clearSession).not.toHaveBeenCalled();
        done();
      }
    );

    const req = httpMock.expectOne('/test');
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
  });

  it('should allow successful requests to pass through', (done) => {
    const testData = { message: 'success' };

    httpClient.get('/test').subscribe((data) => {
      expect(data).toEqual(testData);
      done();
    });

    const req = httpMock.expectOne('/test');
    expect(req.request.withCredentials).toBe(true);
    req.flush(testData);
  });
});
