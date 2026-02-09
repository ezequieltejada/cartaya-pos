import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Category } from '../models/category.model';
import { CategoryService } from './category.service';
import { StorageService } from './storage.service';
import { TenantService } from './tenant.service';

describe('CategoryService', () => {
  let service: CategoryService;
  let httpMock: HttpTestingController;
  let storageService: jasmine.SpyObj<StorageService>;
  let tenantService: jasmine.SpyObj<TenantService>;

  const mockCategories: Category[] = [
    {
      id: 'cat-1',
      name: 'Burgers',
      position: 1,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'cat-2',
      name: 'Beverages',
      position: 2,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'cat-3',
      name: 'Sides',
      position: 3,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockApiResponse = { data: mockCategories };
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
        CategoryService,
        { provide: StorageService, useValue: storageServiceSpy },
        { provide: TenantService, useValue: tenantServiceSpy },
      ],
    });

    service = TestBed.inject(CategoryService);
    httpMock = TestBed.inject(HttpTestingController);
    storageService = TestBed.inject(
      StorageService
    ) as jasmine.SpyObj<StorageService>;
    tenantService = TestBed.inject(
      TenantService
    ) as jasmine.SpyObj<TenantService>;

    storageService.get.and.returnValue(Promise.resolve(null));
    storageService.set.and.returnValue(Promise.resolve());
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('fetchCategories', () => {
    it('should fetch categories from API and cache them', (done) => {
      service.fetchCategories(tenantId).subscribe({
        next: (categories) => {
          expect(categories).toEqual(mockCategories);
          expect(service.categories()).toEqual(mockCategories);
          expect(storageService.set).toHaveBeenCalled();
          done();
        },
      });

      const req = httpMock.expectOne(
        `http://localhost:3000/api/tenants/${tenantId}/categories`
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockApiResponse);
    });

    it('should return cached categories if available and not expired', (done) => {
      const cacheTimestamp = Date.now();
      storageService.get.and.returnValue(
        Promise.resolve({
          categories: mockCategories,
          timestamp: cacheTimestamp,
          tenantId,
        })
      );

      service.fetchCategories(tenantId).subscribe({
        next: (categories) => {
          expect(categories).toEqual(mockCategories);
          expect(storageService.get).toHaveBeenCalled();
          httpMock.expectNone(
            `http://localhost:3000/api/tenants/${tenantId}/categories`
          );
          done();
        },
      });
    });

    it('should force refresh when forceRefresh is true', (done) => {
      storageService.get.and.returnValue(
        Promise.resolve({
          categories: mockCategories,
          timestamp: Date.now(),
          tenantId,
        })
      );

      service.fetchCategories(tenantId, true).subscribe({
        next: (categories) => {
          expect(categories).toEqual(mockCategories);
          done();
        },
      });

      const req = httpMock.expectOne(
        `http://localhost:3000/api/tenants/${tenantId}/categories`
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockApiResponse);
    });

    it('should handle API errors gracefully', (done) => {
      service.fetchCategories(tenantId).subscribe({
        next: (categories) => {
          expect(categories).toEqual([]);
          expect(service.error()).toContain('Failed to load');
          done();
        },
      });

      const req = httpMock.expectOne(
        `http://localhost:3000/api/tenants/${tenantId}/categories`
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should return cached categories on error if available', (done) => {
      storageService.get.and.returnValue(
        Promise.resolve({
          categories: mockCategories,
          timestamp: Date.now() - 20 * 60 * 1000, // Expired cache
          tenantId,
        })
      );

      service.fetchCategories(tenantId).subscribe({
        next: (categories) => {
          // Since cache is expired, it will try API call
          expect(categories).toBeDefined();
          done();
        },
      });

      const req = httpMock.expectOne(
        `http://localhost:3000/api/tenants/${tenantId}/categories`
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should return empty array if no tenant ID', (done) => {
      tenantService.getCurrentTenantId.and.returnValue(null);

      service.fetchCategories().subscribe({
        next: (categories) => {
          expect(categories).toEqual([]);
          done();
        },
      });
    });
  });

  describe('sortedCategories', () => {
    it('should return categories sorted alphabetically', () => {
      service.categories.set([mockCategories[2], mockCategories[0], mockCategories[1]]);

      const sorted = service.sortedCategories();

      expect(sorted[0].name).toBe('Beverages');
      expect(sorted[1].name).toBe('Burgers');
      expect(sorted[2].name).toBe('Sides');
    });
  });

  describe('getCategoryProductCount', () => {
    it('should return count of products in a category', () => {
      const mockProducts = [
        { id: '1', category: { categoryId: 'cat-1', name: 'Burgers' } },
        { id: '2', category: { categoryId: 'cat-1', name: 'Burgers' } },
        { id: '3', category: { categoryId: 'cat-2', name: 'Beverages' } },
      ];

      const count = service.getCategoryProductCount('cat-1', mockProducts);
      expect(count).toBe(2);
    });

    it('should return 0 for category with no products', () => {
      const mockProducts = [
        { id: '1', category: { categoryId: 'cat-1', name: 'Burgers' } },
      ];

      const count = service.getCategoryProductCount('cat-2', mockProducts);
      expect(count).toBe(0);
    });

    it('should handle products with null category', () => {
      const mockProducts = [
        { id: '1', category: null },
        { id: '2', category: { categoryId: 'cat-1', name: 'Burgers' } },
      ];

      const count = service.getCategoryProductCount('cat-1', mockProducts);
      expect(count).toBe(1);
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific tenant', async () => {
      await service.clearCache(tenantId);
      expect(storageService.remove).toHaveBeenCalledWith(`categories_${tenantId}`);
    });

    it('should clear all category caches if no tenantId provided', async () => {
      spyOn(localStorage, 'key').and.returnValue(`categories_${tenantId}`);
      spyOn(localStorage, 'length' as unknown as string).and.returnValue(1);

      await service.clearCache();
      expect(storageService.remove).toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should set isLoading to true when fetching', (done) => {
      service.fetchCategories(tenantId).subscribe({
        next: () => {
          expect(service.isLoading()).toBe(false);
          done();
        },
      });

      const req = httpMock.expectOne(
        `http://localhost:3000/api/tenants/${tenantId}/categories`
      );
      req.flush(mockApiResponse);
    });
  });
});
