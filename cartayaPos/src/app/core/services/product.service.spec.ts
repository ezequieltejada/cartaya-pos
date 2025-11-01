import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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
      id: 'product-1',
      name: 'Cheeseburger',
      sku: 'BURGER-001',
      description: 'Classic burger',
      category: 'Burgers',
      active: true,
      defaultPriceId: 'price-1',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'product-2',
      name: 'French Fries',
      sku: 'FRIES-001',
      description: 'Crispy fries',
      category: 'Sides',
      active: true,
      defaultPriceId: 'price-2',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'product-3',
      name: 'Coca Cola',
      description: 'Soft drink',
      category: 'Beverages',
      active: true,
      defaultPriceId: 'price-3',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'product-4',
      name: 'Grilled Chicken Sandwich',
      sku: 'CHICKEN-001',
      description: 'Juicy grilled chicken',
      category: 'Sandwiches',
      active: false,
      defaultPriceId: 'price-4',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockApiResponse = { data: mockProducts };
  const tenantId = 'tenant-123';

  beforeEach(() => {
    const storageServiceSpy = jasmine.createSpyObj('StorageService', [
      'set',
      'get',
      'remove',
      'clear',
    ]);
    const tenantServiceSpy = jasmine.createSpyObj('TenantService', [
      'getCurrentTenantId',
    ]);
    tenantServiceSpy.getCurrentTenantId.and.returnValue(tenantId);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ProductService,
        { provide: StorageService, useValue: storageServiceSpy },
        { provide: TenantService, useValue: tenantServiceSpy },
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
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  // ===== Service Creation =====

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have dependencies injected correctly', () => {
      expect(service['httpClient']).toBeTruthy();
      expect(service['storageService']).toBeTruthy();
      expect(service['tenantService']).toBeTruthy();
    });

    it('should initialize signals with correct default values', () => {
      expect(service.products()).toEqual([]);
      expect(service.filterText()).toEqual('');
      expect(service.isLoading()).toBe(false);
    });

    it('should have filteredProducts computed signal', () => {
      expect(service.filteredProducts).toBeTruthy();
    });
  });

  // ===== fetchProducts() Tests =====

  describe('fetchProducts()', () => {
    it('should fetch products and update signal', (done) => {
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
      req.flush(mockApiResponse);
    });

    it('should set isLoading during fetch', (done) => {
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
      req.flush(mockApiResponse);
    });

    it('should use currently selected tenant when no tenantId provided', (done) => {
      service.fetchProducts().subscribe(() => {
        expect(tenantService.getCurrentTenantId).toHaveBeenCalled();
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should return empty array when no tenant ID available', (done) => {
      tenantService.getCurrentTenantId.and.returnValue(null);

      service.fetchProducts().subscribe((products) => {
        expect(products).toEqual([]);
        expect(service.isLoading()).toBe(false);
        done();
      });
    });

    it('should extract data from paginated response', (done) => {
      const paginatedResponse = {
        data: mockProducts,
        pagination: {
          total: mockProducts.length,
          limit: 100,
          offset: 0,
          hasMore: false,
        },
      };

      service.fetchProducts(tenantId).subscribe((products) => {
        expect(products).toEqual(mockProducts);
        expect(products.length).toBe(mockProducts.length);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(paginatedResponse);
    });

    it('should cache products after successful fetch', (done) => {
      service.fetchProducts(tenantId).subscribe(() => {
        const cacheKey = `products_${tenantId}`;
        const cached = localStorage.getItem(cacheKey);

        expect(cached).toBeTruthy();
        const cacheData = JSON.parse(cached!);
        expect(cacheData.products).toEqual(mockProducts);
        expect(cacheData.timestamp).toBeTruthy();
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should return cached products if valid', (done) => {
      // Pre-populate cache
      const cacheKey = `products_${tenantId}`;
      const cache = {
        products: mockProducts,
        timestamp: Date.now(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cache));

      service.fetchProducts(tenantId).subscribe((products) => {
        expect(products).toEqual(mockProducts);
        expect(service.isLoading()).toBe(false);
        // No HTTP request should be made
        done();
      });

      // Verify no HTTP request was made
      httpMock.expectNone((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
    });

    it('should make API call if cache expired', (done) => {
      // Pre-populate cache with old timestamp (expired)
      const cacheKey = `products_${tenantId}`;
      const expiredCache = {
        products: mockProducts,
        timestamp: Date.now() - 16 * 60 * 1000, // 16 minutes ago (cache TTL is 15 minutes)
      };
      localStorage.setItem(cacheKey, JSON.stringify(expiredCache));

      service.fetchProducts(tenantId).subscribe((products) => {
        expect(products).toEqual(mockProducts);
        done();
      });

      // Verify HTTP request was made despite cache
      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });
  });

  // ===== Filtering Tests =====

  describe('Filtering', () => {
    beforeEach(() => {
      service.products.set(mockProducts);
    });

    it('should filter by product name (case-insensitive)', () => {
      service.setFilterText('burger');
      expect(service.filteredProducts()).toContain(mockProducts[0]);
      expect(service.filteredProducts().length).toBe(1);

      service.setFilterText('CHEESEBURGER');
      expect(service.filteredProducts()).toContain(mockProducts[0]);

      service.setFilterText('chEEseBURger');
      expect(service.filteredProducts()).toContain(mockProducts[0]);
    });

    it('should filter by SKU (case-insensitive)', () => {
      service.setFilterText('burger-001');
      expect(service.filteredProducts()).toContain(mockProducts[0]);

      service.setFilterText('FRIES-001');
      expect(service.filteredProducts()).toContain(mockProducts[1]);
    });

    it('should return all products when filter is empty', () => {
      service.setFilterText('');
      expect(service.filteredProducts().length).toBe(mockProducts.length);
      expect(service.filteredProducts()).toEqual(mockProducts);
    });

    it('should handle products without SKU gracefully', () => {
      service.setFilterText('coca');
      // Product 3 has no SKU but should still be found by name
      expect(service.filteredProducts()).toContain(mockProducts[2]);
    });

    it('should return empty array when no products match filter', () => {
      service.setFilterText('nonexistent');
      expect(service.filteredProducts().length).toBe(0);
    });

    it('should update filterText signal', () => {
      expect(service.filterText()).toBe('');
      service.setFilterText('test');
      expect(service.filterText()).toBe('test');
    });

    it('should filter across multiple products', () => {
      service.setFilterText('chicken');
      const filtered = service.filteredProducts();
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Grilled Chicken Sandwich');
    });

    it('should match partial product names', () => {
      service.setFilterText('fren');
      expect(service.filteredProducts()).toContain(mockProducts[1]);
    });
  });

  // ===== Caching Tests =====

  describe('Caching', () => {
    it('should cache products after successful fetch', (done) => {
      service.fetchProducts(tenantId).subscribe(() => {
        const cacheKey = `products_${tenantId}`;
        const cached = localStorage.getItem(cacheKey);

        expect(cached).toBeTruthy();
        const { products, timestamp } = JSON.parse(cached!);
        expect(products).toEqual(mockProducts);
        expect(timestamp).toBeTruthy();
        expect(typeof timestamp).toBe('number');
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should return cached products within TTL', (done) => {
      const cacheKey = `products_${tenantId}`;
      const cache = {
        products: mockProducts,
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago (within 15 min TTL)
      };
      localStorage.setItem(cacheKey, JSON.stringify(cache));

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.products()).toEqual(mockProducts);
        // No HTTP request should be made for valid cache
        done();
      });

      httpMock.expectNone((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
    });

    it('should make new API call after TTL expired', (done) => {
      const cacheKey = `products_${tenantId}`;
      const expiredCache = {
        products: [],
        timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago (expired)
      };
      localStorage.setItem(cacheKey, JSON.stringify(expiredCache));

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.products()).toEqual(mockProducts);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should clear cache on clearCache() call', () => {
      // Set multiple cache entries
      const cache1 = { products: mockProducts, timestamp: Date.now() };
      const cache2 = { products: mockProducts, timestamp: Date.now() };

      localStorage.setItem(`products_tenant-1`, JSON.stringify(cache1));
      localStorage.setItem(`products_tenant-2`, JSON.stringify(cache2));
      localStorage.setItem('other_key', 'other_value');

      expect(localStorage.getItem(`products_tenant-1`)).toBeTruthy();
      expect(localStorage.getItem(`products_tenant-2`)).toBeTruthy();
      expect(localStorage.getItem('other_key')).toBeTruthy();

      service.clearCache();

      expect(localStorage.getItem(`products_tenant-1`)).toBeNull();
      expect(localStorage.getItem(`products_tenant-2`)).toBeNull();
      expect(localStorage.getItem('other_key')).toBe('other_value'); // Should not be cleared
    });

    it('should remove expired cache when attempting to retrieve', (done) => {
      const cacheKey = `products_${tenantId}`;
      const expiredCache = {
        products: [],
        timestamp: Date.now() - 20 * 60 * 1000,
      };
      localStorage.setItem(cacheKey, JSON.stringify(expiredCache));

      expect(localStorage.getItem(cacheKey)).toBeTruthy();

      service.fetchProducts(tenantId).subscribe(() => {
        // After fetch, expired cache should have been removed
        expect(localStorage.getItem(cacheKey)).toBeNull();
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should handle malformed cache gracefully', (done) => {
      const cacheKey = `products_${tenantId}`;
      localStorage.setItem(cacheKey, 'invalid json {]');

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.products()).toEqual(mockProducts);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });
  });

  // ===== Error Handling Tests =====

  describe('Error Handling', () => {
    it('should emit empty array on network error', (done) => {
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

    it('should not crash on 404 error', (done) => {
      service.fetchProducts(tenantId).subscribe((products) => {
        expect(products).toEqual([]);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });
    });

    it('should not crash on 500 error', (done) => {
      service.fetchProducts(tenantId).subscribe((products) => {
        expect(products).toEqual([]);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should set isLoading to false on error', (done) => {
      expect(service.isLoading()).toBe(false);

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.isLoading()).toBe(false);
        done();
      });

      expect(service.isLoading()).toBe(true);

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should handle malformed API response gracefully', (done) => {
      service.fetchProducts(tenantId).subscribe((products) => {
        // Should return empty array even with malformed response
        expect(Array.isArray(products)).toBe(true);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      // Send malformed response (missing 'data' property)
      req.flush({ malformed: [] });
    });

    it('should not crash on null response data', (done) => {
      service.fetchProducts(tenantId).subscribe((products) => {
        // Should handle null data gracefully
        expect(Array.isArray(products)).toBe(true);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush({ data: null });
    });

    it('should log errors to console', (done) => {
      spyOn(console, 'error');

      service.fetchProducts(tenantId).subscribe(() => {
        expect(console.error).toHaveBeenCalled();
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.error(new ErrorEvent('Network error'));
    });
  });

  // ===== Computed Signals Tests =====

  describe('Computed Signals', () => {
    it('should update filteredProducts when products signal changes', () => {
      service.setFilterText('burger');
      service.products.set(mockProducts);

      expect(service.filteredProducts()).toContain(mockProducts[0]);
      expect(service.filteredProducts().length).toBe(1);
    });

    it('should update filteredProducts when filterText signal changes', () => {
      service.products.set(mockProducts);

      service.setFilterText('');
      expect(service.filteredProducts().length).toBe(mockProducts.length);

      service.setFilterText('fries');
      expect(service.filteredProducts().length).toBe(1);
      expect(service.filteredProducts()[0].name).toBe('French Fries');
    });

    it('should reactively update when both signals change', () => {
      service.products.set([mockProducts[0], mockProducts[1]]);
      service.setFilterText('burger');
      expect(service.filteredProducts().length).toBe(1);

      service.products.set(mockProducts);
      expect(service.filteredProducts().length).toBe(1);

      service.setFilterText('');
      expect(service.filteredProducts().length).toBe(mockProducts.length);
    });
  });

  // ===== Integration Tests =====

  describe('Integration', () => {
    it('should complete full fetch and filter workflow', (done) => {
      service.fetchProducts(tenantId).subscribe(() => {
        // After fetch, products should be loaded
        expect(service.products().length).toBe(mockProducts.length);

        // Filter products
        service.setFilterText('burger');
        expect(service.filteredProducts().length).toBe(1);
        expect(service.filteredProducts()[0].name).toBe('Cheeseburger');

        // Clear filter
        service.setFilterText('');
        expect(service.filteredProducts().length).toBe(mockProducts.length);

        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should handle cache and filter operations together', (done) => {
      // First fetch
      service.fetchProducts(tenantId).subscribe(() => {
        service.setFilterText('sandwich');
        expect(service.filteredProducts().length).toBe(1);

        // Second fetch should use cache
        service.fetchProducts(tenantId).subscribe(() => {
          expect(service.products().length).toBe(mockProducts.length);
          expect(service.filteredProducts().length).toBe(1); // Filter still active
          done();
        });

        // No new HTTP request should be made
        httpMock.expectNone((r) =>
          r.url.includes(`/tenants/${tenantId}/products`)
        );
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should handle multiple tenant product fetches', (done) => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';
      const tenant1Products = [mockProducts[0], mockProducts[1]];
      const tenant2Products = [mockProducts[2], mockProducts[3]];

      // Fetch for tenant 1
      service.fetchProducts(tenant1).subscribe(() => {
        expect(service.products()).toEqual(tenant1Products);

        // Fetch for tenant 2
        service.fetchProducts(tenant2).subscribe(() => {
          expect(service.products()).toEqual(tenant2Products);
          done();
        });

        const req2 = httpMock.expectOne((r) =>
          r.url.includes(`/tenants/${tenant2}/products`)
        );
        req2.flush({ data: tenant2Products });
      });

      const req1 = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenant1}/products`)
      );
      req1.flush({ data: tenant1Products });
    });
  });
});
