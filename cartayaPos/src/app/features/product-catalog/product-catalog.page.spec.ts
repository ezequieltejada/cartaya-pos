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
} from '@ionic/angular/standalone';
import { of, throwError } from 'rxjs';
import { Pos } from '../../core/models/pos.model';
import { Product } from '../../core/models/product.model';
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

  const mockProducts: Product[] = [
    {
      id: '1',
      name: 'Product 1',
      sku: 'SKU001',
      description: 'Test product 1',
      category: 'Electronics',
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
      category: 'Electronics',
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
    it('should handle product selection', () => {
      spyOn(console, 'log');

      component.onProductTap(mockProducts[0]);

      expect(console.log).toHaveBeenCalledWith(
        'Product selected:',
        mockProducts[0]
      );
    });

    it('should handle product tap for any product', () => {
      spyOn(console, 'log');
      const product = mockProducts[1];

      component.onProductTap(product);

      expect(console.log).toHaveBeenCalledWith('Product selected:', product);
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
});
