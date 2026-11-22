import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular, ToastController } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { Modifier } from '../../core/models/modifier.model';
import { Pos } from '../../core/models/pos.model';
import { Product } from '../../core/models/product.model';
import { AuthService } from '../../core/services/auth.service';
import { CategoryService } from '../../core/services/category.service';
import { ModifierService } from '../../core/services/modifier.service';
import { OrderService } from '../../core/services/order.service';
import { PosService } from '../../core/services/pos.service';
import { ProductService } from '../../core/services/product.service';
import { SettingsService } from '../../core/services/settings.service';
import { TenantService } from '../../core/services/tenant.service';
import { Printer } from '../../services/printer';
import { ProductCatalogPage } from './product-catalog.page';

describe('ProductCatalogPage', () => {
  let component: ProductCatalogPage;
  let fixture: ComponentFixture<ProductCatalogPage>;

  let productService: jasmine.SpyObj<ProductService>;
  let categoryService: jasmine.SpyObj<CategoryService>;
  let tenantService: jasmine.SpyObj<TenantService>;
  let settingsService: jasmine.SpyObj<SettingsService>;
  let posService: jasmine.SpyObj<PosService>;
  let authService: jasmine.SpyObj<AuthService>;
  let modifierService: jasmine.SpyObj<ModifierService>;
  let orderService: jasmine.SpyObj<OrderService>;
  let router: jasmine.SpyObj<Router>;
  let toast: { present: jasmine.Spy };
  let toastController: jasmine.SpyObj<ToastController>;
  let printer: { isConnected: boolean; printerAvailable: ReturnType<typeof signal<boolean>> };

  const productsSig = signal<Product[]>([]);
  const filteredSig = signal<Product[]>([]);
  const loadingSig = signal(false);
  const errorSig = signal<string | null>(null);
  const sortedCategoriesSig = signal<{ id: string; name: string }[]>([]);
  const itemCountSig = signal(0);

  const product = (id: string, categoryId: string | null = 'cat-1'): Product => ({
    id,
    name: `Product ${id}`,
    category: categoryId ? { categoryId, name: categoryId } : null,
    active: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  });
  const mockPos = { id: 'pos-1', name: 'Main PoS' } as Pos;

  beforeEach(async () => {
    productsSig.set([]);
    filteredSig.set([]);
    loadingSig.set(false);
    errorSig.set(null);
    sortedCategoriesSig.set([]);
    itemCountSig.set(0);

    productService = Object.assign(
      jasmine.createSpyObj('ProductService', [
        'clearCache',
        'fetchProductsWithPrices',
        'setFilterText',
        'setSelectedCategoryId',
      ]),
      {
        products: productsSig,
        filteredProducts: filteredSig,
        isLoading: loadingSig,
        error: errorSig,
        selectedCategoryId: 'all',
      }
    ) as unknown as jasmine.SpyObj<ProductService>;
    productService.clearCache.and.resolveTo();
    productService.fetchProductsWithPrices.and.returnValue(of([]));

    categoryService = Object.assign(
      jasmine.createSpyObj('CategoryService', ['fetchCategories']),
      { sortedCategories: sortedCategoriesSig }
    ) as unknown as jasmine.SpyObj<CategoryService>;
    categoryService.fetchCategories.and.returnValue(of([]));

    tenantService = jasmine.createSpyObj('TenantService', ['getCurrentTenantId']);
    tenantService.getCurrentTenantId.and.returnValue('tenant-1');
    settingsService = jasmine.createSpyObj('SettingsService', ['loadTenantSettings']);
    posService = jasmine.createSpyObj('PosService', ['getSelectedPos']);
    posService.getSelectedPos.and.returnValue(mockPos);
    authService = jasmine.createSpyObj('AuthService', ['getCurrentUser', 'logout']);
    authService.logout.and.returnValue(of(undefined));
    modifierService = jasmine.createSpyObj('ModifierService', ['fetchProductModifiers']);
    modifierService.fetchProductModifiers.and.returnValue(of([]));
    orderService = Object.assign(jasmine.createSpyObj('OrderService', ['addConfiguredProduct']), {
      itemCount: itemCountSig,
    }) as unknown as jasmine.SpyObj<OrderService>;
    router = jasmine.createSpyObj('Router', ['navigate']);
    toast = { present: jasmine.createSpy('present').and.resolveTo() };
    toastController = jasmine.createSpyObj('ToastController', ['create']);
    toastController.create.and.resolveTo(toast as never);
    printer = { isConnected: false, printerAvailable: signal(true) };

    await TestBed.configureTestingModule({
      imports: [ProductCatalogPage, TranslateModule.forRoot()],
      providers: [
        provideIonicAngular(),
        { provide: ProductService, useValue: productService },
        { provide: CategoryService, useValue: categoryService },
        { provide: TenantService, useValue: tenantService },
        { provide: SettingsService, useValue: settingsService },
        { provide: PosService, useValue: posService },
        { provide: AuthService, useValue: authService },
        { provide: ModifierService, useValue: modifierService },
        { provide: OrderService, useValue: orderService },
        { provide: Router, useValue: router },
        { provide: ToastController, useValue: toastController },
        { provide: Printer, useValue: printer },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCatalogPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should load the tenant settings, categories and fresh products', async () => {
      component.ngOnInit();
      await fixture.whenStable();

      expect(settingsService.loadTenantSettings).toHaveBeenCalledWith('tenant-1');
      expect(categoryService.fetchCategories).toHaveBeenCalledWith('tenant-1');
      expect(productService.clearCache).toHaveBeenCalledWith('tenant-1');
      expect(productService.fetchProductsWithPrices).toHaveBeenCalledWith('tenant-1');
    });

    it('should go to the PoS selection when no PoS is selected', () => {
      posService.getSelectedPos.and.returnValue(null);

      component.ngOnInit();

      expect(router.navigate).toHaveBeenCalledWith(['/pos-selection']);
    });

    it('should go home without fetching when no tenant is selected', async () => {
      spyOn(console, 'warn');
      spyOn(console, 'error');
      tenantService.getCurrentTenantId.and.returnValue(null);

      component.ngOnInit();
      await fixture.whenStable();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
      expect(productService.fetchProductsWithPrices).not.toHaveBeenCalled();
      expect(settingsService.loadTenantSettings).not.toHaveBeenCalled();
    });

    it('should not break when loading the products fails (the service reports the error)', async () => {
      productService.fetchProductsWithPrices.and.returnValue(throwError(() => new Error('boom')));

      component.ngOnInit();
      await fixture.whenStable();

      expect(productService.fetchProductsWithPrices).toHaveBeenCalled();
    });
  });

  describe('state from the services', () => {
    it('should expose the filtered products, loading state and error message', () => {
      filteredSig.set([product('1')]);
      loadingSig.set(true);
      errorSig.set('API_ERRORS.MISSING_PERMISSIONS');

      expect(component.products.length).toBe(1);
      expect(component.isLoading).toBeTrue();
      expect(component.errorMessage).toBe('API_ERRORS.MISSING_PERMISSIONS');
    });

    it('should expose the selected PoS and the selected category', () => {
      expect(component.selectedPos).toBe(mockPos);
      expect(component.selectedCategoryId).toBe('all');
    });

    it('should count the cart items reactively', () => {
      expect(component.itemCount()).toBe(0);
      itemCountSig.set(3);
      expect(component.itemCount()).toBe(3);
    });

    it('should report an unavailable printer only when it was connected and disappeared', () => {
      expect(component.isPrinterUnavailable).toBeFalse();

      printer.isConnected = true;
      printer.printerAvailable.set(false);

      expect(component.isPrinterUnavailable).toBeTrue();
    });

    it('should list the categories alphabetically with their product counts', () => {
      sortedCategoriesSig.set([
        { id: 'cat-1', name: 'Burgers' },
        { id: 'cat-2', name: 'Drinks' },
      ]);
      productsSig.set([product('1', 'cat-1'), product('2', 'cat-1'), product('3', 'cat-2'), product('4', null)]);

      expect(component.categoriesWithCount()).toEqual([
        { id: 'cat-1', name: 'Burgers', productCount: 2 },
        { id: 'cat-2', name: 'Drinks', productCount: 1 },
      ]);
    });
  });

  describe('search and category filter', () => {
    it('should filter by the typed text', () => {
      component.onSearchInput({ target: { value: 'burger' } });

      expect(productService.setFilterText).toHaveBeenCalledWith('burger');
    });

    it('should treat an empty or missing value as no filter', () => {
      component.onSearchInput({ target: { value: '' } });
      component.onSearchInput({ target: { value: null } });

      expect(productService.setFilterText.calls.allArgs()).toEqual([[''], ['']]);
    });

    it('should clear the search text and the filter', () => {
      component.searchQuery = 'burger';

      component.clearSearch();

      expect(component.searchQuery).toBe('');
      expect(productService.setFilterText).toHaveBeenCalledWith('');
    });

    it('should select a category', () => {
      component.onCategoryChange({ detail: { value: 'cat-2' } });

      expect(productService.setSelectedCategoryId).toHaveBeenCalledWith('cat-2');
    });
  });

  describe('retry', () => {
    it('should force a refresh from the API', () => {
      component.retry();

      expect(productService.fetchProductsWithPrices).toHaveBeenCalledWith('tenant-1', true);
    });

    it('should do nothing without a tenant', () => {
      tenantService.getCurrentTenantId.and.returnValue(null);

      component.retry();

      expect(productService.fetchProductsWithPrices).not.toHaveBeenCalled();
    });
  });

  describe('onProductTap', () => {
    const burger = product('burger');
    const modifier = { id: 'mod-1' } as Modifier;

    beforeEach(() => {
      spyOn(console, 'log');
      spyOn(console, 'debug');
    });

    it('should open the modifiers page when the product has modifiers', async () => {
      modifierService.fetchProductModifiers.and.returnValue(of([modifier]));

      await component.onProductTap(burger);

      expect(modifierService.fetchProductModifiers).toHaveBeenCalledWith('tenant-1', 'burger', 'pos-1');
      expect(router.navigate).toHaveBeenCalledWith(['/products', 'burger', 'modifiers'], { state: { product: burger } });
      expect(orderService.addConfiguredProduct).not.toHaveBeenCalled();
    });

    it('should add the product directly and confirm with a toast when it has no modifiers', async () => {
      await component.onProductTap(burger);

      expect(orderService.addConfiguredProduct).toHaveBeenCalledWith(burger, []);
      expect(toastController.create).toHaveBeenCalledWith(jasmine.objectContaining({ color: 'success' }));
      expect(toast.present).toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should add the product directly when checking the modifiers fails', async () => {
      spyOn(console, 'error');
      modifierService.fetchProductModifiers.and.returnValue(throwError(() => new Error('offline')));

      await component.onProductTap(burger);

      expect(orderService.addConfiguredProduct).toHaveBeenCalledWith(burger, []);
    });

    it('should add the product directly when the PoS or tenant is missing', async () => {
      spyOn(console, 'warn');
      posService.getSelectedPos.and.returnValue(null);

      await component.onProductTap(burger);

      expect(modifierService.fetchProductModifiers).not.toHaveBeenCalled();
      expect(orderService.addConfiguredProduct).toHaveBeenCalledWith(burger, []);
    });

    it('should not ask the API again for a product it already checked', async () => {
      await component.onProductTap(burger);
      await component.onProductTap(burger);

      expect(modifierService.fetchProductModifiers).toHaveBeenCalledTimes(1);
    });
  });

  describe('navigation', () => {
    it('should navigate to the cart, products and settings pages', () => {
      component.navigateToCart();
      component.navigateToProducts();
      component.navigateToSettings();

      expect(router.navigate.calls.allArgs().map((args) => (args[0] as string[]).join(''))).toEqual(['/cart', '/products', '/settings']);
    });

    it('should log out through the auth service', () => {
      component.logout();

      expect(authService.logout).toHaveBeenCalled();
    });
  });
});
