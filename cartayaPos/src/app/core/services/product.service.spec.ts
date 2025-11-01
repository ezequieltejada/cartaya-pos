import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';
import { ProductService } from './product.service';
import { StorageService } from './storage.service';
import { TenantService } from './tenant.service';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;
  let storageService: jasmine.SpyObj<StorageService>;
  let tenantService: jasmine.SpyObj<TenantService>;

  const mockProducts: Product[] = [
    {
      id: 'prod-1',
      name: 'Laptop Computer',
      sku: 'LAPTOP-001',
      description: 'High-performance laptop',
      category: 'Electronics',
      active: true,
      defaultPriceId: 'price-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'prod-2',
      name: 'Wireless Mouse',
      sku: 'MOUSE-002',
      description: 'Ergonomic wireless mouse',
      category: 'Accessories',
      active: true,
      defaultPriceId: 'price-2',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'prod-3',
      name: 'USB-C Cable',
      sku: 'CABLE-003',
      description: 'Premium USB-C charging cable',
      category: 'Cables',
      active: true,
      defaultPriceId: 'price-3',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    const storageSpy = jasmine.createSpyObj('StorageService', [
      'set',
      'get',
      'remove',
      'clear',
    ]);
    const tenantSpy = jasmine.createSpyObj('TenantService', [
      'getCurrentTenantId',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ProductService,
        { provide: StorageService, useValue: storageSpy },
        { provide: TenantService, useValue: tenantSpy },
      ],
    });

    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
    storageService = TestBed.inject(
      StorageService
    ) as jasmine.SpyObj<StorageService>;
    tenantService = TestBed.inject(
      TenantService
    ) as jasmine.SpyObj<TenantService>;

    tenantService.getCurrentTenantId.and.returnValue('tenant-123');
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('fetchProducts', () => {
    it('should fetch products and update signal', (done) => {
      const tenantId = 'tenant-123';

      service.fetchProducts(tenantId).subscribe((products) => {
        expect(products).toEqual(mockProducts);
        expect(service.products()).toEqual(mockProducts);
        expect(service.isLoading()).toBe(false);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('active')).toBe('true');
      expect(req.request.params.get('limit')).toBe('100');
      expect(req.request.params.get('offset')).toBe('0');

      req.flush({ data: mockProducts });
    });

    it('should set isLoading during fetch', (done) => {
      const tenantId = 'tenant-123';

      expect(service.isLoading()).toBe(false);

      const subscription = service.fetchProducts(tenantId).subscribe(() => {
        expect(service.isLoading()).toBe(false);
        subscription.unsubscribe();
        done();
      });

      expect(service.isLoading()).toBe(true);

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush({ data: mockProducts });
    });

    it('should use current tenant ID when none provided', (done) => {
      service.fetchProducts().subscribe(() => {
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes('/tenants/tenant-123/products')
      );
      req.flush({ data: mockProducts });
    });

    it('should return empty array when no tenant ID', (done) => {
      tenantService.getCurrentTenantId.and.returnValue(null);

      service.fetchProducts().subscribe((products) => {
        expect(products).toEqual([]);
        expect(service.isLoading()).toBe(false);
        done();
      });

      httpMock.expectNone((r) => r.url.includes('/products'));
    });

    it('should handle fetch errors gracefully', (done) => {
      const tenantId = 'tenant-123';

      service.fetchProducts(tenantId).subscribe((products) => {
        expect(products).toEqual([]);
        expect(service.isLoading()).toBe(false);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should cache products after successful fetch', (done) => {
      const tenantId = 'tenant-123';

      service.fetchProducts(tenantId).subscribe(() => {
        // Verify cache was saved
        const cached = localStorage.getItem('products_tenant-123');
        expect(cached).toBeTruthy();

        const cacheData = JSON.parse(cached!);
        expect(cacheData.products).toEqual(mockProducts);
        expect(cacheData.timestamp).toBeDefined();
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush({ data: mockProducts });
    });

    it('should return cached products without making API call', (done) => {
      const tenantId = 'tenant-123';
      const cache = {
        products: mockProducts,
        timestamp: Date.now(),
      };
      localStorage.setItem('products_tenant-123', JSON.stringify(cache));

      service.fetchProducts(tenantId).subscribe((products) => {
        expect(products).toEqual(mockProducts);
        expect(service.products()).toEqual(mockProducts);
        expect(service.isLoading()).toBe(false);
        done();
      });

      httpMock.expectNone((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
    });

    it('should ignore expired cache and make API call', (done) => {
      const tenantId = 'tenant-123';
      const expiredCache = {
        products: [],
        timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago
      };
      localStorage.setItem('products_tenant-123', JSON.stringify(expiredCache));

      service.fetchProducts(tenantId).subscribe((products) => {
        expect(products).toEqual(mockProducts);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush({ data: mockProducts });
    });
  });

  describe('setFilterText', () => {
    it('should update filterText signal', () => {
      const query = 'laptop';
      service.setFilterText(query);
      expect(service.filterText()).toBe(query);
    });

    it('should trigger filteredProducts recomputation', () => {
      service.products.set(mockProducts);
      service.setFilterText('wireless');

      const filtered = service.filteredProducts();
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Wireless Mouse');
    });

    it('should clear filter when setting empty string', () => {
      service.products.set(mockProducts);
      service.setFilterText('laptop');
      expect(service.filteredProducts().length).toBe(1);

      service.setFilterText('');
      expect(service.filteredProducts()).toEqual(mockProducts);
    });
  });

  describe('filteredProducts computed signal', () => {
    beforeEach(() => {
      service.products.set(mockProducts);
    });

    it('should return all products when filter is empty', () => {
      service.setFilterText('');
      expect(service.filteredProducts()).toEqual(mockProducts);
    });

    it('should filter by product name (case-insensitive)', () => {
      service.setFilterText('laptop');
      expect(service.filteredProducts().length).toBe(1);
      expect(service.filteredProducts()[0].name).toBe('Laptop Computer');
    });

    it('should filter by SKU (case-insensitive)', () => {
      service.setFilterText('mouse-002');
      expect(service.filteredProducts().length).toBe(1);
      expect(service.filteredProducts()[0].sku).toBe('MOUSE-002');
    });

    it('should filter by partial name match', () => {
      service.setFilterText('cable');
      expect(service.filteredProducts().length).toBe(1);
      expect(service.filteredProducts()[0].name).toBe('USB-C Cable');
    });

    it('should be case-insensitive for name search', () => {
      service.setFilterText('LAPTOP');
      expect(service.filteredProducts().length).toBe(1);
      expect(service.filteredProducts()[0].name).toBe('Laptop Computer');
    });

    it('should be case-insensitive for SKU search', () => {
      service.setFilterText('laptop-001');
      expect(service.filteredProducts().length).toBe(1);
      expect(service.filteredProducts()[0].sku).toBe('LAPTOP-001');
    });

    it('should return empty array when no matches', () => {
      service.setFilterText('nonexistent');
      expect(service.filteredProducts().length).toBe(0);
    });

    it('should match products with special characters in query', () => {
      service.setFilterText('usb-c');
      expect(service.filteredProducts().length).toBe(1);
      expect(service.filteredProducts()[0].name).toBe('USB-C Cable');
    });
  });

  describe('clearCache', () => {
    it('should remove all product cache entries from localStorage', () => {
      localStorage.setItem('products_tenant-1', JSON.stringify({ products: [] }));
      localStorage.setItem('products_tenant-2', JSON.stringify({ products: [] }));
      localStorage.setItem('other_key', JSON.stringify({ data: [] }));

      service.clearCache();

      expect(localStorage.getItem('products_tenant-1')).toBeNull();
      expect(localStorage.getItem('products_tenant-2')).toBeNull();
      expect(localStorage.getItem('other_key')).toBeTruthy();
    });

    it('should handle empty cache gracefully', () => {
      localStorage.clear();
      expect(() => service.clearCache()).not.toThrow();
    });

    it('should not throw error on invalid cache data', () => {
      localStorage.setItem('products_tenant-1', 'invalid json');
      expect(() => service.clearCache()).not.toThrow();
    });
  });

  describe('signals', () => {
    it('should initialize products signal with empty array', () => {
      expect(service.products()).toEqual([]);
    });

    it('should initialize filterText signal with empty string', () => {
      expect(service.filterText()).toBe('');
    });

    it('should initialize isLoading signal with false', () => {
      expect(service.isLoading()).toBe(false);
    });

    it('should update products signal', () => {
      service.products.set(mockProducts);
      expect(service.products()).toEqual(mockProducts);
    });

    it('should update filterText signal', () => {
      service.filterText.set('search term');
      expect(service.filterText()).toBe('search term');
    });

    it('should update isLoading signal', () => {
      service.isLoading.set(true);
      expect(service.isLoading()).toBe(true);

      service.isLoading.set(false);
      expect(service.isLoading()).toBe(false);
    });
  });

  describe('API endpoint validation', () => {
    it('should use correct API endpoint format', (done) => {
      const tenantId = 'test-tenant';

      service.fetchProducts(tenantId).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne((r) => {
        const expectedUrl = `${environment.apiUrl}/api/tenants/${tenantId}/products`;
        return r.url === expectedUrl;
      });

      req.flush({ data: mockProducts });
    });
  });
});
