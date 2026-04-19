import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
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
});