import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { MenuController, Platform } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { of, Subscription } from 'rxjs';
import { AppComponent } from './app.component';
import { AuthService } from './core/services/auth.service';
import { LanguageService } from './core/services/language.service';
import { OrderQueueService } from './core/services/order-queue.service';
import { PosService } from './core/services/pos.service';
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

    authService = jasmine.createSpyObj('AuthService', [
      'loadTokensFromStorage',
      'checkSession',
      'logout',
    ]);
    authService.loadTokensFromStorage.and.resolveTo();
    authService.checkSession.and.returnValue(of(null));
    authService.logout.and.returnValue(of(void 0));

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
          ]),
        },
        {
          provide: PosService,
          useValue: jasmine.createSpyObj('PosService', ['restoreSelectedPos']),
        },
        { provide: SyncCoordinatorService, useValue: syncCoordinator },
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

    const posService = TestBed.inject(PosService) as jasmine.SpyObj<PosService>;
    posService.restoreSelectedPos.and.resolveTo();

    component = TestBed.runInInjectionContext(() => new AppComponent());
  });

  it('should create the app', () => {
    expect(component).toBeTruthy();
  });

  it('navigates to products with replaceUrl when the session is valid', async () => {
    authService.checkSession.and.returnValue(of({ id: 'user-1' } as any));

    await component.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(['/products'], {
      replaceUrl: true,
    });
  });

  it('navigates to login with replaceUrl when there is no session', async () => {
    authService.checkSession.and.returnValue(of(null));

    await component.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      replaceUrl: true,
    });
  });

  it('exits the app when Android back is pressed on the product catalog root', async () => {
    const exitAppSpy = spyOn(App, 'exitApp').and.resolveTo();
    const processNextHandler = jasmine.createSpy('processNextHandler');
    router.url = '/products';

    await (component as any).handleBackButton(processNextHandler);

    expect(exitAppSpy).toHaveBeenCalled();
    expect(processNextHandler).not.toHaveBeenCalled();
  });

  it('delegates the back button when the current route is not the product catalog root', async () => {
    const exitAppSpy = spyOn(App, 'exitApp').and.resolveTo();
    const processNextHandler = jasmine.createSpy('processNextHandler');
    router.url = '/cart';

    await (component as any).handleBackButton(processNextHandler);

    expect(exitAppSpy).not.toHaveBeenCalled();
    expect(processNextHandler).toHaveBeenCalled();
  });
});
