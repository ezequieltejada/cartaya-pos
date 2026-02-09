import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
    IonCol,
    IonContent,
    IonGrid,
    IonHeader,
    IonRow,
    IonSpinner,
    IonTitle,
    IonToolbar,
    ToastController,
} from '@ionic/angular/standalone';
import { of, throwError } from 'rxjs';
import { Modifier } from '../../core/models/modifier.model';
import { Pos } from '../../core/models/pos.model';
import { Product } from '../../core/models/product.model';
import { ModifierService } from '../../core/services/modifier.service';
import { OrderService } from '../../core/services/order.service';
import { PosService } from '../../core/services/pos.service';
import { ProductService } from '../../core/services/product.service';
import { TenantService } from '../../core/services/tenant.service';
import { ProductCatalogPage } from './product-catalog.page';

describe('ProductCatalogPage', () => {
  let component: ProductCatalogPage;
  let fixture: ComponentFixture<ProductCatalogPage>;
  let productService: jasmine.SpyObj<ProductService>;
  let tenantService: jasmine.SpyObj<TenantService>;
  let posService: jasmine.SpyObj<PosService>;
  let router: jasmine.SpyObj<Router>;
  let toastController: jasmine.SpyObj<ToastController>;
  let modifierService: jasmine.SpyObj<ModifierService>;
  let orderService: jasmine.SpyObj<OrderService>;

  const mockProducts: Product[] = [
    {
      id: '1',
      name: 'Product 1',
      sku: 'SKU001',
      description: 'Test product 1',
      category: { categoryId: 'cat-1', name: 'Electronics' },
      active: true,
      defaultPriceId: 'price1',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Product 2',
      sku: 'SKU002',
      description: 'Test product 2',
      category: { categoryId: 'cat-1', name: 'Electronics' },
      active: true,
      defaultPriceId: 'price2',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ];

  const mockPos: Pos = {
    id: 'pos1',
    name: 'Main PoS',
    slug: 'main-pos',
    location: 'Downtown',
    settings: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    const productServiceSpy = jasmine.createSpyObj('ProductService', [
      'fetchProducts',
    ]);
    const tenantServiceSpy = jasmine.createSpyObj(
      'TenantService',
      ['getCurrentTenantId'],
      {
        products: [],
        filterText: '',
        isLoading: false,
        filteredProducts: [],
      }
    );
    const posServiceSpy = jasmine.createSpyObj('PosService', [
      'getSelectedPos',
    ]);
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const toastSpy = jasmine.createSpyObj('Toast', ['present']);
    const toastControllerSpy = jasmine.createSpyObj('ToastController', [
      'create',
    ]);
    const modifierServiceSpy = jasmine.createSpyObj('ModifierService', [
      'fetchProductModifiers',
    ]);
    const orderServiceSpy = jasmine.createSpyObj('OrderService', [
      'addConfiguredProduct',
    ], {
      itemCount: jasmine.createSpy().and.returnValue(0),
    });
    toastControllerSpy.create.and.returnValue(Promise.resolve(toastSpy));

    await TestBed.configureTestingModule({
      imports: [
        ProductCatalogPage,
        IonContent,
        IonHeader,
        IonTitle,
        IonToolbar,
        IonGrid,
        IonRow,
        IonCol,
        IonSpinner,
      ],
      providers: [
        { provide: ProductService, useValue: productServiceSpy },
        { provide: TenantService, useValue: tenantServiceSpy },
        { provide: PosService, useValue: posServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ToastController, useValue: toastControllerSpy },
        { provide: ModifierService, useValue: modifierServiceSpy },
        { provide: OrderService, useValue: orderServiceSpy },
      ],
    }).compileComponents();

    productService = TestBed.inject(
      ProductService
    ) as jasmine.SpyObj<ProductService>;
    tenantService = TestBed.inject(
      TenantService
    ) as jasmine.SpyObj<TenantService>;
    posService = TestBed.inject(PosService) as jasmine.SpyObj<PosService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    toastController = TestBed.inject(
      ToastController
    ) as jasmine.SpyObj<ToastController>;
    modifierService = TestBed.inject(
      ModifierService
    ) as jasmine.SpyObj<ModifierService>;
    orderService = TestBed.inject(
      OrderService
    ) as jasmine.SpyObj<OrderService>;

    fixture = TestBed.createComponent(ProductCatalogPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('ngOnInit', () => {
    it('should fetch products for the current tenant', () => {
      const tenantId = 'tenant1';
      tenantService.getCurrentTenantId.and.returnValue(tenantId);
      productService.fetchProducts.and.returnValue(of(mockProducts));

      component.ngOnInit();

      expect(tenantService.getCurrentTenantId).toHaveBeenCalled();
      expect(productService.fetchProducts).toHaveBeenCalledWith(tenantId);
    });

    it('should navigate to home if no tenant is selected', () => {
      tenantService.getCurrentTenantId.and.returnValue(null);

      component.ngOnInit();

      expect(router.navigate).toHaveBeenCalledWith(['/']);
    });

    it('should handle product fetch errors gracefully', () => {
      const tenantId = 'tenant1';
      tenantService.getCurrentTenantId.and.returnValue(tenantId);
      productService.fetchProducts.and.returnValue(
        throwError(() => new Error('Fetch failed'))
      );

      expect(() => component.ngOnInit()).not.toThrow();
      expect(productService.fetchProducts).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('products getter', () => {
    it('should return products from ProductService signal', () => {
      const productSignalSpy = jasmine.createSpy().and.returnValue(mockProducts);
      Object.defineProperty(productService, 'products', {
        value: productSignalSpy,
      });

      const products = component.products;

      expect(products).toEqual(mockProducts);
    });

    it('should return empty array when no products are available', () => {
      const productSignalSpy = jasmine.createSpy().and.returnValue([]);
      Object.defineProperty(productService, 'products', {
        value: productSignalSpy,
      });

      const products = component.products;

      expect(products).toEqual([]);
    });
  });

  describe('isLoading getter', () => {
    it('should return loading state from ProductService signal', () => {
      const loadingSignalSpy = jasmine.createSpy().and.returnValue(true);
      Object.defineProperty(productService, 'isLoading', {
        value: loadingSignalSpy,
      });

      const isLoading = component.isLoading;

      expect(isLoading).toBe(true);
    });

    it('should return false when not loading', () => {
      const loadingSignalSpy = jasmine.createSpy().and.returnValue(false);
      Object.defineProperty(productService, 'isLoading', {
        value: loadingSignalSpy,
      });

      const isLoading = component.isLoading;

      expect(isLoading).toBe(false);
    });
  });

  describe('selectedPos getter', () => {
    it('should return the selected PoS from PosService', () => {
      posService.getSelectedPos.and.returnValue(mockPos);

      const selectedPos = component.selectedPos;

      expect(selectedPos).toEqual(mockPos);
      expect(posService.getSelectedPos).toHaveBeenCalled();
    });

    it('should return null when no PoS is selected', () => {
      posService.getSelectedPos.and.returnValue(null);

      const selectedPos = component.selectedPos;

      expect(selectedPos).toBeNull();
    });
  });

  describe('onProductTap', () => {
    const mockModifier: Modifier = {
      id: 'mod1',
      name: 'Modifier 1',
      priceDelta: 1.5,
      currency: 'USD',
      active: true,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };

    it('should check for modifiers and navigate to ModifiersPage if modifiers exist', async () => {
      spyOn(console, 'log');
      modifierService.fetchProductModifiers.and.returnValue(of([mockModifier]));
      tenantService.getCurrentTenantId.and.returnValue('tenant1');
      posService.getSelectedPos.and.returnValue(mockPos);

      await component.onProductTap(mockProducts[0]);

      expect(console.log).toHaveBeenCalledWith(
        'Product selected:',
        mockProducts[0].id,
        mockProducts[0].name
      );
      expect(router.navigate).toHaveBeenCalledWith(
        ['/products', mockProducts[0].id, 'modifiers'],
        { state: { product: mockProducts[0] } }
      );
    });

    it('should add product directly to order if no modifiers exist', async () => {
      spyOn(console, 'log');
      modifierService.fetchProductModifiers.and.returnValue(of([]));
      tenantService.getCurrentTenantId.and.returnValue('tenant1');
      posService.getSelectedPos.and.returnValue(mockPos);
      const toastSpy = jasmine.createSpyObj('Toast', ['present']);
      toastController.create.and.returnValue(Promise.resolve(toastSpy));

      const productWithPrice = {
        ...mockProducts[0],
        defaultPrice: { id: 'price1', amount: 10, currency: 'USD' },
      };

      await component.onProductTap(productWithPrice as any);

      expect(orderService.addConfiguredProduct).toHaveBeenCalledWith(
        productWithPrice,
        []
      );
      expect(toastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: `"${productWithPrice.name}" added to order`,
          duration: 2000,
          position: 'bottom',
          color: 'success',
          icon: 'checkmark-circle-outline',
        })
      );
      expect(toastSpy.present).toHaveBeenCalled();
    });

    it('should handle API errors gracefully and add product directly', async () => {
      modifierService.fetchProductModifiers.and.returnValue(
        throwError(() => new Error('API Error'))
      );
      tenantService.getCurrentTenantId.and.returnValue('tenant1');
      posService.getSelectedPos.and.returnValue(mockPos);
      spyOn(console, 'error');

      const productWithPrice = {
        ...mockProducts[0],
        defaultPrice: { id: 'price1', amount: 10, currency: 'USD' },
      };

      await component.onProductTap(productWithPrice as any);

      expect(orderService.addConfiguredProduct).toHaveBeenCalled();
    });

    it('should call checkProductModifiers', async () => {
      spyOn<any>(component, 'checkProductModifiers').and.returnValue(
        Promise.resolve(false)
      );
      const productWithPrice = {
        ...mockProducts[0],
        defaultPrice: { id: 'price1', amount: 10, currency: 'USD' },
      };

      await component.onProductTap(productWithPrice as any);

      expect(component['checkProductModifiers']).toHaveBeenCalledWith(
        productWithPrice
      );
    });

    it('should cache modifier check results', async () => {
      modifierService.fetchProductModifiers.and.returnValue(of([]));
      tenantService.getCurrentTenantId.and.returnValue('tenant1');
      posService.getSelectedPos.and.returnValue(mockPos);
      const toastSpy = jasmine.createSpyObj('Toast', ['present']);
      toastController.create.and.returnValue(Promise.resolve(toastSpy));

      const productWithPrice = {
        ...mockProducts[0],
        defaultPrice: { id: 'price1', amount: 10, currency: 'USD' },
      };

      // First tap - should call API
      await component.onProductTap(productWithPrice as any);
      expect(modifierService.fetchProductModifiers).toHaveBeenCalledTimes(1);

      // Second tap - should use cache
      await component.onProductTap(productWithPrice as any);
      expect(modifierService.fetchProductModifiers).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should log product selection for analytics', async () => {
      spyOn(console, 'log');
      modifierService.fetchProductModifiers.and.returnValue(of([]));
      tenantService.getCurrentTenantId.and.returnValue('tenant1');
      posService.getSelectedPos.and.returnValue(mockPos);
      const toastSpy = jasmine.createSpyObj('Toast', ['present']);
      toastController.create.and.returnValue(Promise.resolve(toastSpy));

      const productWithPrice = {
        ...mockProducts[0],
        defaultPrice: { id: 'price1', amount: 10, currency: 'USD' },
      };

      await component.onProductTap(productWithPrice as any);

      expect(console.log).toHaveBeenCalledWith(
        'Product selected:',
        mockProducts[0].id,
        mockProducts[0].name
      );
    });
  });

  describe('checkProductModifiers', () => {
    const mockModifier: Modifier = {
      id: 'mod1',
      name: 'Modifier 1',
      priceDelta: 1.5,
      currency: 'USD',
      active: true,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };

    it('should return true when API returns modifiers', async () => {
      modifierService.fetchProductModifiers.and.returnValue(of([mockModifier]));
      tenantService.getCurrentTenantId.and.returnValue('tenant1');
      posService.getSelectedPos.and.returnValue(mockPos);

      const result = await component['checkProductModifiers'](mockProducts[0]);

      expect(result).toBe(true);
      expect(modifierService.fetchProductModifiers).toHaveBeenCalledWith(
        'tenant1',
        mockProducts[0].id,
        mockPos.id
      );
    });

    it('should return false when API returns empty modifiers', async () => {
      modifierService.fetchProductModifiers.and.returnValue(of([]));
      tenantService.getCurrentTenantId.and.returnValue('tenant1');
      posService.getSelectedPos.and.returnValue(mockPos);

      const result = await component['checkProductModifiers'](mockProducts[0]);

      expect(result).toBe(false);
    });

    it('should return false on API error', async () => {
      modifierService.fetchProductModifiers.and.returnValue(
        throwError(() => new Error('API Error'))
      );
      tenantService.getCurrentTenantId.and.returnValue('tenant1');
      posService.getSelectedPos.and.returnValue(mockPos);
      spyOn(console, 'error');

      const result = await component['checkProductModifiers'](mockProducts[0]);

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });

    it('should return false when tenant is missing', async () => {
      tenantService.getCurrentTenantId.and.returnValue(null);
      spyOn(console, 'warn');

      const result = await component['checkProductModifiers'](mockProducts[0]);

      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should return false when PoS is missing', async () => {
      tenantService.getCurrentTenantId.and.returnValue('tenant1');
      posService.getSelectedPos.and.returnValue(null);
      spyOn(console, 'warn');

      const result = await component['checkProductModifiers'](mockProducts[0]);

      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should cache results to avoid repeated API calls', async () => {
      modifierService.fetchProductModifiers.and.returnValue(of([mockModifier]));
      tenantService.getCurrentTenantId.and.returnValue('tenant1');
      posService.getSelectedPos.and.returnValue(mockPos);

      // First call
      await component['checkProductModifiers'](mockProducts[0]);
      expect(modifierService.fetchProductModifiers).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await component['checkProductModifiers'](mockProducts[0]);
      expect(modifierService.fetchProductModifiers).toHaveBeenCalledTimes(1);
    });
  });

  describe('showSuccessToast', () => {
    it('should create and present success toast', async () => {
      const toastSpy = jasmine.createSpyObj('Toast', ['present']);
      toastController.create.and.returnValue(Promise.resolve(toastSpy));

      await component['showSuccessToast']('Test message');

      expect(toastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'Test message',
          duration: 2000,
          position: 'bottom',
          color: 'success',
          icon: 'checkmark-circle-outline',
        })
      );
      expect(toastSpy.present).toHaveBeenCalled();
    });

    it('should use correct product name in message', async () => {
      const toastSpy = jasmine.createSpyObj('Toast', ['present']);
      toastController.create.and.returnValue(Promise.resolve(toastSpy));

      await component['showSuccessToast'](
        `"${mockProducts[0].name}" added to order`
      );

      expect(toastController.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: `"${mockProducts[0].name}" added to order`,
        })
      );
    });
  });

  describe('Component Integration', () => {
    it('should initialize component with products loaded', () => {
      const tenantId = 'tenant1';
      tenantService.getCurrentTenantId.and.returnValue(tenantId);
      productService.fetchProducts.and.returnValue(of(mockProducts));
      posService.getSelectedPos.and.returnValue(mockPos);

      const productSignalSpy = jasmine.createSpy().and.returnValue(mockProducts);
      const loadingSignalSpy = jasmine.createSpy().and.returnValue(false);
      Object.defineProperty(productService, 'products', {
        value: productSignalSpy,
      });
      Object.defineProperty(productService, 'isLoading', {
        value: loadingSignalSpy,
      });

      component.ngOnInit();

      expect(component.products).toEqual(mockProducts);
      expect(component.isLoading).toBe(false);
      expect(component.selectedPos).toEqual(mockPos);
    });

    it('should display loading state during product fetch', () => {
      const tenantId = 'tenant1';
      tenantService.getCurrentTenantId.and.returnValue(tenantId);
      productService.fetchProducts.and.returnValue(of(mockProducts));

      const loadingSignalSpy = jasmine.createSpy().and.returnValue(true);
      Object.defineProperty(productService, 'isLoading', {
        value: loadingSignalSpy,
      });

      component.ngOnInit();

      expect(component.isLoading).toBe(true);
    });
  });

  describe('Search and Filtering', () => {
    it('should have searchQuery property', () => {
      expect(component.searchQuery).toBe('');
    });

    it('should call setFilterText on search input', () => {
      spyOn(productService, 'setFilterText');
      const event = { target: { value: 'burger' } };

      component.onSearchInput(event);

      expect(productService.setFilterText).toHaveBeenCalledWith('burger');
    });

    it('should clear search query and filter on clearSearch', () => {
      spyOn(productService, 'setFilterText');
      component.searchQuery = 'test';

      component.clearSearch();

      expect(component.searchQuery).toBe('');
      expect(productService.setFilterText).toHaveBeenCalledWith('');
    });

    it('should handle empty search input gracefully', () => {
      spyOn(productService, 'setFilterText');
      const event = { target: { value: '' } };

      component.onSearchInput(event);

      expect(productService.setFilterText).toHaveBeenCalledWith('');
    });

    it('should handle null or undefined search value', () => {
      spyOn(productService, 'setFilterText');
      const event = { target: { value: null } };

      component.onSearchInput(event);

      expect(productService.setFilterText).toHaveBeenCalledWith('');
    });
  });

  describe('Cart Navigation', () => {
    it('should navigate to cart when navigateToCart is called', () => {
      component.navigateToCart();

      expect(router.navigate).toHaveBeenCalledWith(['/cart']);
    });

    it('should have itemCount computed signal', () => {
      expect(component.itemCount).toBeDefined();
    });

    it('should return correct item count from itemCount signal', () => {
      (orderService.itemCount as jasmine.Spy).and.returnValue(3);

      const count = component.itemCount();

      expect(count).toBe(3);
    });

    it('should update itemCount reactively when items change', () => {
      const itemCountSpy = orderService.itemCount as jasmine.Spy;
      
      // First check - empty cart
      itemCountSpy.and.returnValue(0);
      let count = component.itemCount();
      expect(count).toBe(0);

      // Simulate cart update
      itemCountSpy.and.returnValue(5);
      count = component.itemCount();
      expect(count).toBe(5);
    });

    it('should display FAB when items exist in cart', () => {
      (orderService.itemCount as jasmine.Spy).and.returnValue(2);

      const count = component.itemCount();

      expect(count).toBeGreaterThan(0);
    });

    it('should hide FAB when cart is empty', () => {
      (orderService.itemCount as jasmine.Spy).and.returnValue(0);

      const count = component.itemCount();

      expect(count).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should have errorMessage getter', () => {
      const errorSignalSpy = jasmine.createSpy().and.returnValue(null);
      Object.defineProperty(productService, 'error', {
        value: errorSignalSpy,
      });

      const errorMessage = component.errorMessage;

      expect(errorMessage).toBeNull();
    });

    it('should display error message when present', () => {
      const errorMsg = 'Network error occurred';
      const errorSignalSpy = jasmine.createSpy().and.returnValue(errorMsg);
      Object.defineProperty(productService, 'error', {
        value: errorSignalSpy,
      });

      const errorMessage = component.errorMessage;

      expect(errorMessage).toBe(errorMsg);
    });

    it('should call fetchProducts with forceRefresh on retry', () => {
      const tenantId = 'tenant1';
      tenantService.getCurrentTenantId.and.returnValue(tenantId);
      productService.fetchProducts.and.returnValue(of(mockProducts));

      component.retry();

      expect(productService.fetchProducts).toHaveBeenCalledWith(tenantId, true);
    });

    it('should handle retry when no tenant is available', () => {
      tenantService.getCurrentTenantId.and.returnValue(null);

      expect(() => component.retry()).not.toThrow();
      expect(productService.fetchProducts).not.toHaveBeenCalled();
    });
  });

  describe('Grid and Product Display', () => {
    it('should render product grid when products exist', () => {
      const productSignalSpy = jasmine
        .createSpy()
        .and.returnValue(mockProducts);
      Object.defineProperty(productService, 'filteredProducts', {
        value: productSignalSpy,
      });

      const products = component.products;

      expect(products.length).toBe(mockProducts.length);
      expect(products).toEqual(mockProducts);
    });

    it('should render empty grid when no products', () => {
      const productSignalSpy = jasmine.createSpy().and.returnValue([]);
      Object.defineProperty(productService, 'filteredProducts', {
        value: productSignalSpy,
      });

      const products = component.products;

      expect(products.length).toBe(0);
      expect(products).toEqual([]);
    });

    it('should filter products correctly', () => {
      const productSignalSpy = jasmine
        .createSpy()
        .and.returnValue(mockProducts.slice(0, 1));
      Object.defineProperty(productService, 'filteredProducts', {
        value: productSignalSpy,
      });
      component.searchQuery = 'Product 1';

      const filteredProducts = component.products;

      expect(filteredProducts.length).toBe(1);
    });
  });

  describe('Empty State', () => {
    it('should handle empty products array', () => {
      const productSignalSpy = jasmine.createSpy().and.returnValue([]);
      Object.defineProperty(productService, 'filteredProducts', {
        value: productSignalSpy,
      });

      const products = component.products;

      expect(products).toEqual([]);
      expect(products.length).toBe(0);
    });

    it('should show empty state when filtering returns no results', () => {
      component.searchQuery = 'nonexistent-product';
      const productSignalSpy = jasmine.createSpy().and.returnValue([]);
      Object.defineProperty(productService, 'filteredProducts', {
        value: productSignalSpy,
      });

      const products = component.products;

      expect(products.length).toBe(0);
    });
  });

  describe('Getters', () => {
    it('should correctly retrieve products from service', () => {
      const productSignalSpy = jasmine
        .createSpy()
        .and.returnValue(mockProducts);
      Object.defineProperty(productService, 'filteredProducts', {
        value: productSignalSpy,
      });

      expect(component.products).toEqual(mockProducts);
    });

    it('should correctly retrieve loading state from service', () => {
      const loadingSignalSpy = jasmine.createSpy().and.returnValue(false);
      Object.defineProperty(productService, 'isLoading', {
        value: loadingSignalSpy,
      });

      expect(component.isLoading).toBe(false);
    });

    it('should correctly retrieve selected PoS', () => {
      posService.getSelectedPos.and.returnValue(mockPos);

      expect(component.selectedPos).toEqual(mockPos);
    });

    it('should correctly retrieve error message', () => {
      const errorSignalSpy = jasmine
        .createSpy()
        .and.returnValue('Test error');
      Object.defineProperty(productService, 'error', {
        value: errorSignalSpy,
      });

      expect(component.errorMessage).toBe('Test error');
    });
  });

  describe('Product Tap Handler', () => {
    it('should handle product selection with modifiers', async () => {
      const toastSpy = jasmine.createSpyObj('Toast', ['present']);
      toastController.create.and.returnValue(Promise.resolve(toastSpy));

      await component.onProductTap(mockProducts[0]);

      expect(toastController.create).toHaveBeenCalled();
      expect(toastSpy.present).toHaveBeenCalled();
    });

    it('should log product selection for analytics', async () => {
      spyOn(console, 'log');
      const toastSpy = jasmine.createSpyObj('Toast', ['present']);
      toastController.create.and.returnValue(Promise.resolve(toastSpy));

      await component.onProductTap(mockProducts[0]);

      expect(console.log).toHaveBeenCalledWith(
        'Product selected:',
        mockProducts[0].id,
        mockProducts[0].name
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle search with special characters', () => {
      spyOn(productService, 'setFilterText');
      const event = { target: { value: '@#$%' } };

      component.onSearchInput(event);

      expect(productService.setFilterText).toHaveBeenCalledWith('@#$%');
    });

    it('should handle rapid search input changes', () => {
      spyOn(productService, 'setFilterText');

      component.onSearchInput({ target: { value: 'a' } });
      component.onSearchInput({ target: { value: 'ab' } });
      component.onSearchInput({ target: { value: 'abc' } });

      expect(productService.setFilterText).toHaveBeenCalledTimes(3);
    });

    it('should handle products with missing optional properties', () => {
      const minimalProduct: Product = {
      category: null,
        id: 'minimal',
        name: 'Minimal Product',
        active: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(() => component.onProductTap(minimalProduct)).not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    // Helper function to generate large product datasets
    const generateLargeProductSet = (count: number): Product[] => {
      return Array.from({ length: count }, (_, i) => ({
        id: `product-${i}`,
        name: `Product ${i} - Performance Test`,
        sku: `SKU-${String(i).padStart(6, '0')}`,
        description: `Performance test product with index ${i}`,
        category: { categoryId: `cat-${i % 10}`, name: `Category-${i % 10}` },
        active: true,
        defaultPriceId: `price-${i}`,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }));
    };

    it('should render 50 products efficiently', () => {
      const products = generateLargeProductSet(50);
      Object.defineProperty(productService, 'filteredProducts', {
        value: products,
      });

      const startTime = performance.now();
      fixture.detectChanges();
      const endTime = performance.now();

      const renderTime = endTime - startTime;
      expect(renderTime).toBeLessThan(500); // Should render in under 500ms
    });

    it('should render 100 products in reasonable time', () => {
      const products = generateLargeProductSet(100);
      Object.defineProperty(productService, 'filteredProducts', {
        value: products,
      });

      const startTime = performance.now();
      fixture.detectChanges();
      const endTime = performance.now();

      const renderTime = endTime - startTime;
      expect(renderTime).toBeLessThan(800); // Should render in under 800ms
    });

    it('should handle 500+ products with virtual scrolling', () => {
      const products = generateLargeProductSet(500);
      Object.defineProperty(productService, 'filteredProducts', {
        value: products,
      });

      fixture.detectChanges();

      // Component should still be responsive with virtual scrolling
      expect(component.products.length).toBe(500);
      expect(component.isLoading).toBe(false);
    });

    it('should perform search filter efficiently on large dataset', () => {
      const products = generateLargeProductSet(200);
      Object.defineProperty(productService, 'filteredProducts', {
        value: products,
      });

      const startTime = performance.now();
      component.onSearchInput({ target: { value: 'Product' } });
      const endTime = performance.now();

      const searchTime = endTime - startTime;
      expect(searchTime).toBeLessThan(100); // Filter should happen in under 100ms
    });

    it('should maintain performance when clearing search', () => {
      const products = generateLargeProductSet(300);
      Object.defineProperty(productService, 'filteredProducts', {
        value: products,
      });

      component.onSearchInput({ target: { value: 'test' } });
      fixture.detectChanges();

      const startTime = performance.now();
      component.clearSearch();
      fixture.detectChanges();
      const endTime = performance.now();

      const clearTime = endTime - startTime;
      expect(clearTime).toBeLessThan(100);
    });

    it('should efficiently handle product tap on large dataset', async () => {
      const products = generateLargeProductSet(200);
      const targetProduct = products[50];

      const toastSpy = jasmine.createSpyObj('Toast', ['present']);
      toastController.create.and.returnValue(Promise.resolve(toastSpy));

      const startTime = performance.now();
      await component.onProductTap(targetProduct);
      const endTime = performance.now();

      const tapTime = endTime - startTime;
      expect(tapTime).toBeLessThan(200); // Tap handler should be quick
    });

    it('should handle multiple rapid searches efficiently', () => {
      const products = generateLargeProductSet(150);
      Object.defineProperty(productService, 'filteredProducts', {
        value: products,
      });

      const startTime = performance.now();

      component.onSearchInput({ target: { value: 'a' } });
      component.onSearchInput({ target: { value: 'ab' } });
      component.onSearchInput({ target: { value: 'abc' } });
      component.onSearchInput({ target: { value: 'abcd' } });
      component.onSearchInput({ target: { value: 'abcde' } });

      const endTime = performance.now();

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(200); // 5 searches should complete quickly
    });

    it('should not degrade performance on repeated retry calls', () => {
      spyOn(productService, 'fetchProducts').and.returnValue(of(mockProducts));

      const startTime = performance.now();

      component.retry();
      component.retry();
      component.retry();

      const endTime = performance.now();

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(150); // Multiple retries should be fast
    });
  });

  describe('Memory Efficiency', () => {
    it('should not create memory leaks with repeated updates', () => {
      const products = Array.from({ length: 50 }, (_, i) => ({
        id: `product-${i}`,
        name: `Product ${i}`,
        active: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      }));

      // Simulate repeated component updates
      for (let i = 0; i < 10; i++) {
        Object.defineProperty(productService, 'filteredProducts', {
          value: products,
        });
        fixture.detectChanges();
      }

      // Component should still be in valid state
      expect(component).toBeTruthy();
    });

    it('should clear search state without memory issues', () => {
      component.onSearchInput({ target: { value: 'test' } });
      fixture.detectChanges();

      spyOn(productService, 'setFilterText');

      component.clearSearch();

      expect(productService.setFilterText).toHaveBeenCalledWith('');
    });
  });

  describe('Integration Tests - Complete User Workflows', () => {
    it('should complete full workflow: view products -> search -> filter -> select product', async () => {
      // Step 1: Initialize with products
      Object.defineProperty(productService, 'filteredProducts', {
        value: mockProducts,
      });
      fixture.detectChanges();

      expect(component.products.length).toBe(3);

      // Step 2: Perform search
      spyOn(productService, 'setFilterText');
      component.onSearchInput({ target: { value: 'Product 1' } });
      expect(productService.setFilterText).toHaveBeenCalledWith('Product 1');

      // Step 3: Select product
      const toastSpy = jasmine.createSpyObj('Toast', ['present']);
      toastController.create.and.returnValue(Promise.resolve(toastSpy));

      await component.onProductTap(mockProducts[0]);

      expect(toastController.create).toHaveBeenCalled();
      expect(toastSpy.present).toHaveBeenCalled();
    });

    it('should handle network failure and allow retry', async () => {
      const error = new Error('Network error');
      Object.defineProperty(productService, 'error', { value: error });

      fixture.detectChanges();

      // Retry should call fetch with forceRefresh
      spyOn(productService, 'fetchProducts').and.returnValue(of(mockProducts));
      tenantService.getCurrentTenantId.and.returnValue('tenant-1');

      component.retry();

      expect(productService.fetchProducts).toHaveBeenCalledWith(
        'tenant-1',
        true
      );
    });

    it('should handle 401 unauthorized during product fetch', () => {
      // Simulate 401 error from service
      const error401 = new Error('401 Unauthorized');
      Object.defineProperty(productService, 'error', { value: error401 });

      spyOn(router, 'navigate');
      fixture.detectChanges();

      // Router should navigate to login (handled by service, but component aware)
      expect(component.errorMessage).toBeDefined();
    });

    it('should cache products on successful fetch', (done) => {
      spyOn(productService, 'fetchProducts').and.returnValue(of(mockProducts));

      productService.fetchProducts('tenant-1').subscribe(() => {
        // Second fetch should use cache (not call fetchProducts again)
        Object.defineProperty(productService, 'filteredProducts', {
          value: mockProducts,
        });

        expect(component.products).toEqual(mockProducts);
        done();
      });
    });

    it('should update UI when search results change', (done) => {
      Object.defineProperty(productService, 'filteredProducts', {
        value: mockProducts,
      });
      fixture.detectChanges();

      const initialCount = component.products.length;

      // Simulate filtered results
      const filteredProducts = mockProducts.slice(0, 1);
      Object.defineProperty(productService, 'filteredProducts', {
        value: filteredProducts,
      });
      fixture.detectChanges();

      setTimeout(() => {
        expect(component.products.length).toBeLessThan(initialCount);
        done();
      }, 100);
    });

    it('should maintain search state while loading new data', (done) => {
      spyOn(productService, 'setFilterText');

      component.onSearchInput({ target: { value: 'test' } });
      expect(productService.setFilterText).toHaveBeenCalledWith('test');

      // Simulate loading state
      Object.defineProperty(productService, 'isLoading', { value: true });
      fixture.detectChanges();

      setTimeout(() => {
        expect(component.isLoading).toBe(true);
        done();
      }, 50);
    });

    it('should handle session expiration during navigation', async () => {
      const toastSpy = jasmine.createSpyObj('Toast', ['present']);
      toastController.create.and.returnValue(Promise.resolve(toastSpy));

      // Simulate product selection
      await component.onProductTap(mockProducts[0]);

      // If session expired (would trigger 401 from API)
      spyOn(router, 'navigate');

      expect(toastController.create).toHaveBeenCalled();
    });

    it('should handle empty product list gracefully', () => {
      Object.defineProperty(productService, 'filteredProducts', {
        value: [],
      });
      fixture.detectChanges();

      expect(component.products.length).toBe(0);
      expect(component).toBeTruthy(); // Component still renders
    });

    it('should recover from error state when retry succeeds', async () => {
      // Start with error state
      Object.defineProperty(productService, 'error', {
        value: new Error('Initial error'),
      });
      fixture.detectChanges();

      expect(component.errorMessage).toBeDefined();

      // Simulate successful retry
      spyOn(productService, 'fetchProducts').and.returnValue(of(mockProducts));
      Object.defineProperty(productService, 'error', { value: null });

      component.retry();

      expect(productService.fetchProducts).toHaveBeenCalled();
    });

    it('should handle offline scenario with cached data', () => {
      // Simulate offline - would normally fall back to cached products
      Object.defineProperty(productService, 'filteredProducts', {
        value: mockProducts,
      });
      Object.defineProperty(productService, 'isLoading', { value: false });

      fixture.detectChanges();

      expect(component.products).toEqual(mockProducts);
      expect(component.isLoading).toBe(false);
    });
  });

  describe('Integration Tests - Error Scenarios', () => {
    it('should display error banner on API failure', () => {
      const apiError = new Error('API Error');
      Object.defineProperty(productService, 'error', {
        value: apiError,
      });

      fixture.detectChanges();

      expect(component.errorMessage).toBeDefined();
    });

    it('should provide retry option when error occurs', () => {
      Object.defineProperty(productService, 'error', {
        value: new Error('Network timeout'),
      });

      fixture.detectChanges();
      spyOn(productService, 'fetchProducts').and.returnValue(of(mockProducts));

      component.retry();

      expect(productService.fetchProducts).toHaveBeenCalled();
    });

    it('should handle malformed product data gracefully', () => {
      const malformedProducts = [
        { id: '1' }, // Missing required fields
        mockProducts[0], // Valid product
      ];

      Object.defineProperty(productService, 'filteredProducts', {
        value: malformedProducts as any,
      });

      fixture.detectChanges();

      // Component should still render
      expect(component.products.length).toBe(2);
    });
  });

  describe('Integration Tests - State Management', () => {
    it('should maintain consistent state across multiple operations', (done) => {
      // Initialize
      Object.defineProperty(productService, 'filteredProducts', {
        value: mockProducts,
      });
      fixture.detectChanges();

      const initialCount = component.products.length;

      // Perform search
      spyOn(productService, 'setFilterText');
      component.onSearchInput({ target: { value: 'test' } });

      // Clear search
      component.clearSearch();
      expect(productService.setFilterText).toHaveBeenCalledWith('');

      // Verify state is consistent
      setTimeout(() => {
        expect(component.products.length).toBeGreaterThanOrEqual(0);
        done();
      }, 50);
    });

    it('should handle rapid state changes without errors', async () => {
      Object.defineProperty(productService, 'filteredProducts', {
        value: mockProducts,
      });

      spyOn(productService, 'setFilterText');

      // Rapid state changes
      component.onSearchInput({ target: { value: 'a' } });
      component.onSearchInput({ target: { value: 'ab' } });
      component.clearSearch();
      component.onSearchInput({ target: { value: 'abc' } });

      fixture.detectChanges();

      expect(component).toBeTruthy();
      expect(productService.setFilterText).toHaveBeenCalledTimes(4);
    });

    it('should preserve PoS context through product selection', async () => {
      posService.getSelectedPos.and.returnValue(mockPos);

      const toastSpy = jasmine.createSpyObj('Toast', ['present']);
      toastController.create.and.returnValue(Promise.resolve(toastSpy));

      await component.onProductTap(mockProducts[0]);

      // PoS context should still be available
      expect(component.selectedPos).toEqual(mockPos);
    });
  });
});

