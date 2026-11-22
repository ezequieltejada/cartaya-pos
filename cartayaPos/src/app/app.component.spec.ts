import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MenuController, Platform } from '@ionic/angular/standalone';
import { signal } from '@angular/core';
import type { App } from '@capacitor/app';
import { TranslateService } from '@ngx-translate/core';
import { of, Subscription } from 'rxjs';
import { AppComponent } from './app.component';
import { CAPACITOR_APP } from './core/tokens/capacitor-app.token';
import { AuthService } from './core/services/auth.service';
import { LanguageService } from './core/services/language.service';
import { OrderQueueService } from './core/services/order-queue.service';
import { PosService } from './core/services/pos.service';
import { SettingsService } from './core/services/settings.service';
import { StorageService } from './core/services/storage.service';
import { SyncCoordinatorService } from './core/services/sync-coordinator.service';
import { TenantService } from './core/services/tenant.service';
import { Printer } from './services/printer';

describe('AppComponent', () => {
  let component: AppComponent;
  let router: { navigate: jasmine.Spy; url: string };
  let platform: jasmine.SpyObj<Platform> & {
    backButton: { subscribeWithPriority: jasmine.Spy };
  };
  let menuController: jasmine.SpyObj<MenuController>;
  let authService: jasmine.SpyObj<AuthService>;
  let syncCoordinator: jasmine.SpyObj<SyncCoordinatorService>;
  let capApp: jasmine.SpyObj<typeof App>;

  beforeEach(() => {
    router = {
      navigate: jasmine.createSpy('navigate').and.resolveTo(true),
      url: '/products',
    };

    platform = Object.assign(
      jasmine.createSpyObj('Platform', ['ready', 'is']),
      {
        backButton: {
          subscribeWithPriority: jasmine
            .createSpy('subscribeWithPriority')
            .and.returnValue(new Subscription()),
        },
      }
    );
    platform.ready.and.resolveTo();
    platform.is.and.callFake((target: string) => target === 'android');

    menuController = jasmine.createSpyObj('MenuController', ['isOpen', 'close']);
    menuController.isOpen.and.resolveTo(false);
    menuController.close.and.resolveTo(true);

    authService = jasmine.createSpyObj(
      'AuthService',
      ['loadTokensFromStorage', 'checkSession', 'logout'],
      { sessionChecked: signal(false) }
    );
    authService.loadTokensFromStorage.and.resolveTo();
    authService.checkSession.and.returnValue(of(null));
    authService.logout.and.returnValue(of(void 0));

    capApp = jasmine.createSpyObj('App', ['exitApp']);
    syncCoordinator = jasmine.createSpyObj('SyncCoordinatorService', [
      'initialize',
      'destroy',
    ]);

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: Platform, useValue: platform },
        { provide: MenuController, useValue: menuController },
        { provide: AuthService, useValue: authService },
        {
          provide: StorageService,
          useValue: jasmine.createSpyObj('StorageService', ['init']),
        },
        {
          provide: LanguageService,
          useValue: jasmine.createSpyObj('LanguageService', ['init']),
        },
        {
          provide: TenantService,
          useValue: jasmine.createSpyObj('TenantService', [
            'restoreSelectedTenant',
            'getCurrentTenantId',
          ]),
        },
        {
          provide: SettingsService,
          useValue: jasmine.createSpyObj('SettingsService', ['loadTenantSettings']),
        },
        {
          provide: PosService,
          useValue: jasmine.createSpyObj('PosService', ['restoreSelectedPos']),
        },
        { provide: SyncCoordinatorService, useValue: syncCoordinator },
        { provide: CAPACITOR_APP, useValue: capApp },
        {
          provide: Printer,
          useValue: jasmine.createSpyObj('Printer', ['loadPersistedPrinter']),
        },
        {
          provide: OrderQueueService,
          useValue: jasmine.createSpyObj(
            'OrderQueueService',
            ['pendingCount', 'totalQueueSize'],
            {
              pendingCount: () => 0,
              totalQueueSize: () => 0,
            }
          ),
        },
        {
          provide: TranslateService,
          useValue: jasmine.createSpyObj('TranslateService', ['instant']),
        },
      ],
    });

    const storageService = TestBed.inject(
      StorageService
    ) as jasmine.SpyObj<StorageService>;
    storageService.init.and.resolveTo();

    const languageService = TestBed.inject(
      LanguageService
    ) as jasmine.SpyObj<LanguageService>;
    languageService.init.and.resolveTo();

    const tenantService = TestBed.inject(
      TenantService
    ) as jasmine.SpyObj<TenantService>;
    tenantService.restoreSelectedTenant.and.resolveTo();
    tenantService.getCurrentTenantId.and.returnValue('tenant-1');

    const posService = TestBed.inject(PosService) as jasmine.SpyObj<PosService>;
    posService.restoreSelectedPos.and.resolveTo();

    component = TestBed.runInInjectionContext(() => new AppComponent());
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('navigates from the login page to products with replaceUrl when the session is valid', async () => {
    router.url = '/auth/login';
    authService.checkSession.and.returnValue(of({ id: 'user-1' } as any));

    await component.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(['/products'], {
      replaceUrl: true,
    });
    expect(authService.sessionChecked()).toBeTrue();
  });

  it('keeps a deep link (e.g. /cart) when the session is valid', async () => {
    router.url = '/cart';
    authService.checkSession.and.returnValue(of({ id: 'user-1' } as any));

    await component.ngOnInit();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(authService.sessionChecked()).toBeTrue();
  });

  it('loads the tenant settings once the session is valid', async () => {
    authService.checkSession.and.returnValue(of({ id: 'user-1' } as any));

    await component.ngOnInit();

    const settings = TestBed.inject(SettingsService) as jasmine.SpyObj<SettingsService>;
    expect(settings.loadTenantSettings).toHaveBeenCalledWith('tenant-1');
  });

  it('navigates to login with replaceUrl when there is no session', async () => {
    authService.checkSession.and.returnValue(of(null));

    await component.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      replaceUrl: true,
    });
    expect(authService.sessionChecked()).toBeTrue();
  });

  it('exits the app when Android back is pressed on the product catalog root', async () => {
    const exitAppSpy = capApp.exitApp.and.resolveTo();
    const processNextHandler = jasmine.createSpy('processNextHandler');
    router.url = '/products';

    await (component as any).handleBackButton(processNextHandler);

    expect(exitAppSpy).toHaveBeenCalled();
    expect(processNextHandler).not.toHaveBeenCalled();
  });

  it('delegates the back button when the current route is not the product catalog root', async () => {
    const exitAppSpy = capApp.exitApp.and.resolveTo();
    const processNextHandler = jasmine.createSpy('processNextHandler');
    router.url = '/cart';

    await (component as any).handleBackButton(processNextHandler);

    expect(exitAppSpy).not.toHaveBeenCalled();
    expect(processNextHandler).toHaveBeenCalled();
  });
});
