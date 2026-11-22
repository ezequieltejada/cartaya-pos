import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let component: LoginPage;
  let router: { navigate: jasmine.Spy };
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    router = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
    };

    authService = jasmine.createSpyObj('AuthService', ['login'], {
      isLoading: () => false,
    });
    authService.login.and.returnValue(of({ id: 'user-1' } as any));

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: authService },
        {
          provide: ToastController,
          useValue: jasmine.createSpyObj('ToastController', ['create']),
        },
        {
          provide: TranslateService,
          useValue: jasmine.createSpyObj('TranslateService', ['instant']),
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new LoginPage());
    component.ngOnInit();
  });

  it('navigates to pos selection with replaceUrl after a successful login', async () => {
    component.loginForm.setValue({
      email: 'cashier@example.com',
      password: 'password123',
    });

    await component.onLogin();

    expect(router.navigate).toHaveBeenCalledWith(['/pos-selection'], {
      replaceUrl: true,
    });
  });

  describe('login errors', () => {
    it('maps the INVALID_CREDENTIALS code to its API_ERRORS key', () => {
      const error = new HttpErrorResponse({ status: 401, error: { code: 'INVALID_CREDENTIALS', message: 'English' } });
      expect(LoginPage.errorKeyFor(error, true)).toBe('API_ERRORS.INVALID_CREDENTIALS');
    });

    it('maps network failure / CORS rejection (status 0) to server unreachable', () => {
      expect(LoginPage.errorKeyFor(new HttpErrorResponse({ status: 0 }), true)).toBe(
        'AUTH.ERRORS.SERVER_UNREACHABLE'
      );
    });

    it('maps being offline to server unreachable', () => {
      expect(LoginPage.errorKeyFor(new Error('x'), false)).toBe('AUTH.ERRORS.SERVER_UNREACHABLE');
    });

    it('maps errors without a known code to UNKNOWN_ERROR', () => {
      expect(LoginPage.errorKeyFor(new HttpErrorResponse({ status: 500 }), true)).toBe(
        'API_ERRORS.UNKNOWN_ERROR'
      );
    });

    it('shows the error inline and keeps the form on a wrong password', async () => {
      authService.login.and.returnValue(
        throwError(() => new HttpErrorResponse({ status: 401, error: { code: 'INVALID_CREDENTIALS' } }))
      );
      component.loginForm.setValue({ email: 'a@b.com', password: 'wrongpass1' });

      await component.onLogin();

      expect(component.errorKey()).toBe('API_ERRORS.INVALID_CREDENTIALS');
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe('form reset', () => {
    it('clears email and password when the page is shown again (e.g. after logout)', () => {
      component.loginForm.setValue({ email: 'owner@example.com', password: 'secret-pass1' });

      component.ionViewWillEnter();

      expect(component.loginForm.value).toEqual({ email: '', password: '' });
    });

    it('clears the form after a successful login', async () => {
      component.loginForm.setValue({ email: 'cashier@example.com', password: 'password123' });

      await component.onLogin();

      expect(component.loginForm.value).toEqual({ email: '', password: '' });
    });
  });
});
