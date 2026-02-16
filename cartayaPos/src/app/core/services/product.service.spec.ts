import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Product } from '../models/product.model';
import { ProductService } from './product.service';
import { StorageService } from './storage.service';
import { TenantService } from './tenant.service';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;
  let storageService: jasmine.SpyObj<StorageService>;
  let tenantService: jasmine.SpyObj<TenantService>;
  let router: jasmine.SpyObj<Router>;

  const mockProducts: Product[] = [
    {
      id: 'product-1',
      name: 'Cheeseburger',
      sku: 'BURGER-001',
      description: 'Classic burger',
      category: { categoryId: 'cat-1', name: 'Burgers' },
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
      category: { categoryId: 'cat-2', name: 'Sides' },
      active: true,
      defaultPriceId: 'price-2',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'product-3',
      name: 'Coca Cola',
      description: 'Soft drink',
      category: { categoryId: 'cat-3', name: 'Beverages' },
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
      category: { categoryId: 'cat-4', name: 'Sandwiches' },
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
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    tenantServiceSpy.getCurrentTenantId.and.returnValue(tenantId);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ProductService,
        { provide: StorageService, useValue: storageServiceSpy },
        { provide: TenantService, useValue: tenantServiceSpy },
        { provide: Router, useValue: routerSpy },
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
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
  });

  afterEach(() => {
    httpMock.verify();
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
      expect(service.error()).toBeNull();
    });

    it('should have filteredProducts computed signal', () => {
      expect(service.filteredProducts).toBeTruthy();
    });
  });

  // ===== fetchProducts() Tests =====

  describe('fetchProducts()', () => {
    it('should fetch products and update signal', (done) => {
      storageService.get.and.returnValue(Promise.resolve(null));

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
      storageService.get.and.returnValue(Promise.resolve(null));

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
      storageService.get.and.returnValue(Promise.resolve(null));

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

    it('should extract data from response', (done) => {
      storageService.get.and.returnValue(Promise.resolve(null));

      service.fetchProducts(tenantId).subscribe((products) => {
        expect(products).toEqual(mockProducts);
        expect(products.length).toBe(mockProducts.length);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should cache products after successful fetch', (done) => {
      storageService.get.and.returnValue(Promise.resolve(null));
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProducts(tenantId).subscribe(() => {
        expect(storageService.set).toHaveBeenCalled();
        const callArgs = storageService.set.calls.mostRecent().args;
        expect(callArgs[0]).toMatch(/^products_/);
        const cachedData = callArgs[1] as { products: Product[]; tenantId: string; timestamp: number };
        expect(cachedData.products).toEqual(mockProducts);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should return cached products if valid', (done) => {
      const cache = {
        products: mockProducts,
        timestamp: Date.now(),
        tenantId,
      };
      storageService.get.and.returnValue(Promise.resolve(cache));

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
      const expiredCache = {
        products: mockProducts,
        timestamp: Date.now() - 16 * 60 * 1000, // 16 minutes ago (cache TTL is 15 minutes)
        tenantId,
      };
      storageService.get.and.returnValue(Promise.resolve(expiredCache));
      storageService.remove.and.returnValue(Promise.resolve());
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProducts(tenantId).subscribe((products) => {
        expect(products).toEqual(mockProducts);
        done();
      });

      // Verify HTTP request was made despite expired cache
      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should remove expired cache from storage', (done) => {
      const expiredCache = {
        products: mockProducts,
        timestamp: Date.now() - 16 * 60 * 1000,
        tenantId,
      };
      storageService.get.and.returnValue(Promise.resolve(expiredCache));
      storageService.remove.and.returnValue(Promise.resolve());
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProducts(tenantId).subscribe(() => {
        expect(storageService.remove).toHaveBeenCalledWith(
          jasmine.stringMatching(/^products_/)
        );
        done();
      });

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
      storageService.get.and.returnValue(Promise.resolve(null));
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProducts(tenantId).subscribe(() => {
        expect(storageService.set).toHaveBeenCalled();
        const callArgs = storageService.set.calls.mostRecent().args;
        expect(callArgs[0]).toMatch(/^products_/);
        expect(callArgs[1]).toEqual(
          jasmine.objectContaining({
            products: mockProducts,
            tenantId,
            timestamp: jasmine.any(Number),
          })
        );
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should return cached products within TTL', (done) => {
      const cache = {
        products: mockProducts,
        timestamp: Date.now() - 5 * 60 * 1000, // 5 minutes ago (within 15 min TTL)
        tenantId,
      };
      storageService.get.and.returnValue(Promise.resolve(cache));

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
      const expiredCache = {
        products: [],
        timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago (expired)
        tenantId,
      };
      storageService.get.and.returnValue(Promise.resolve(expiredCache));
      storageService.remove.and.returnValue(Promise.resolve());
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.products()).toEqual(mockProducts);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should call clearCache for specific tenant', async () => {
      storageService.remove.and.returnValue(Promise.resolve());

      await service.clearCache(tenantId);

      expect(storageService.remove).toHaveBeenCalledWith(
        jasmine.stringMatching(/^products_/)
      );
    });

    it('should clear all product caches when no tenantId provided', async () => {
      storageService.remove.and.returnValue(Promise.resolve());

      await service.clearCache();

      expect(storageService.remove).toHaveBeenCalled();
    });

    it('should handle malformed cache gracefully', (done) => {
      storageService.get.and.returnValue(Promise.resolve(null));
      storageService.set.and.returnValue(Promise.resolve());

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
      storageService.get.and.returnValue(Promise.resolve(null));

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
      storageService.get.and.returnValue(Promise.resolve(null));

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
      storageService.get.and.returnValue(Promise.resolve(null));

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
      storageService.get.and.returnValue(Promise.resolve(null));

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
      storageService.get.and.returnValue(Promise.resolve(null));

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
      storageService.get.and.returnValue(Promise.resolve(null));

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
      storageService.get.and.returnValue(Promise.resolve(null));

      service.fetchProducts(tenantId).subscribe(() => {
        expect(console.error).toHaveBeenCalled();
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should set error signal with user-friendly message on network error', (done) => {
      storageService.get.and.returnValue(Promise.resolve(null));

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.error()).toBe(
          'No internet connection. Please check your network.'
        );
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.error(new ErrorEvent('Network error'), { status: 0 });
    });

    it('should set error signal with 401 message on unauthorized error', (done) => {
      storageService.get.and.returnValue(Promise.resolve(null));

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.error()).toBe('Session expired. Please log in again.');
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    });

    it('should set error signal with 403 message on forbidden error', (done) => {
      storageService.get.and.returnValue(Promise.resolve(null));

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.error()).toBe(
          'You do not have permission to view products.'
        );
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });
    });

    it('should set error signal with 500 message on server error', (done) => {
      storageService.get.and.returnValue(Promise.resolve(null));

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.error()).toBe('Server error. Please try again later.');
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should set generic error message for other errors', (done) => {
      storageService.get.and.returnValue(Promise.resolve(null));

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.error()).toBe('Failed to load products. Please try again.');
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush('Bad request', { status: 400, statusText: 'Bad Request' });
    });

    it('should redirect to login on 401 error', (done) => {
      storageService.get.and.returnValue(Promise.resolve(null));

      service.fetchProducts(tenantId).subscribe(() => {
        expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    });

    it('should return cached products on error if available', (done) => {
      const cache = {
        products: mockProducts,
        timestamp: Date.now(),
        tenantId,
      };
      storageService.get.and.returnValue(Promise.resolve(cache));

      service.fetchProducts(tenantId, true).subscribe((products) => {
        expect(products).toEqual(mockProducts);
        expect(service.error()).toBeTruthy();
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.error(new ErrorEvent('Network error'), { status: 0 });
    });

    it('should force refresh when forceRefresh parameter is true', (done) => {
      const cache = {
        products: mockProducts,
        timestamp: Date.now(),
        tenantId,
      };
      storageService.get.and.returnValue(Promise.resolve(cache));
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProducts(tenantId, true).subscribe(() => {
        expect(service.products()).toEqual(mockProducts);
        done();
      });

      // Should make API call even with valid cache when forceRefresh is true
      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should clear error signal on successful fetch', (done) => {
      service.error.set('Previous error');
      storageService.get.and.returnValue(Promise.resolve(null));
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.error()).toBeNull();
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
      req.flush(mockApiResponse);
    });

    it('should clear error signal when using valid cache', (done) => {
      service.error.set('Previous error');
      const cache = {
        products: mockProducts,
        timestamp: Date.now(),
        tenantId,
      };
      storageService.get.and.returnValue(Promise.resolve(cache));

      service.fetchProducts(tenantId).subscribe(() => {
        expect(service.error()).toBeNull();
        done();
      });

      httpMock.expectNone((r) =>
        r.url.includes(`/tenants/${tenantId}/products`)
      );
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
      storageService.get.and.returnValue(Promise.resolve(null));
      storageService.set.and.returnValue(Promise.resolve());

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
      storageService.get.and.returnValue(Promise.resolve(null));
      storageService.set.and.returnValue(Promise.resolve());

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

      storageService.get.and.returnValue(Promise.resolve(null));
      storageService.set.and.returnValue(Promise.resolve());

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
  // ===== Category Filtering Tests =====

  describe('Category Filtering', () => {
    beforeEach(() => {
      // Set up products with categories
      service.products.set(mockProducts);
    });

    it('should initialize with all categories selected', () => {
      expect(service.selectedCategoryId).toBe('all');
      expect(service.selectedCategoryIds()).toEqual(['all']);
    });

    it('should set selected category ID', () => {
      service.setSelectedCategoryId('cat-1');
      expect(service.selectedCategoryId).toBe('cat-1');
      expect(service.selectedCategoryIds()).toEqual(['cat-1']);
    });

    it('should reset to all when setting all', () => {
      service.setSelectedCategoryId('cat-1');
      expect(service.selectedCategoryId).toBe('cat-1');
      
      service.setSelectedCategoryId('all');
      expect(service.selectedCategoryId).toBe('all');
      expect(service.selectedCategoryIds()).toEqual(['all']);
    });

    it('should filter products by single category', () => {
      service.setSelectedCategoryId('cat-1');
      const filtered = service.filteredProducts();
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('product-1');
    });

    it('should show all products when all categories selected', () => {
      service.setSelectedCategoryId('all');
      const filtered = service.filteredProducts();
      
      // Should show all products with categories
      expect(filtered.length).toBeGreaterThan(0);
    });

    it('should combine text filter with category filter', () => {
      service.setSelectedCategoryId('cat-3');
      service.setFilterText('cola');
      
      const filtered = service.filteredProducts();
      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Coca Cola');
    });

    it('should return empty when text filter matches but category does not', () => {
      service.setSelectedCategoryId('cat-1');
      service.setFilterText('cola');
      
      const filtered = service.filteredProducts();
      expect(filtered.length).toBe(0);
    });

    it('should handle products with null category', () => {
      const productsWithNull = [
        ...mockProducts,
        {
          id: 'product-5',
          name: 'No Category Product',
          active: true,
          category: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        }
      ];
      service.products.set(productsWithNull);
      
      service.setSelectedCategoryId('cat-1');
      const filtered = service.filteredProducts();
      
      // Should not include product with null category
      expect(filtered.find(p => p.id === 'product-5')).toBeUndefined();
    });
  });
});

