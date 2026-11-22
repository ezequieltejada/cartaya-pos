import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
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
      imports: [HttpClientTestingModule, TranslateModule.forRoot()],
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
    storageService.remove.and.returnValue(Promise.resolve());
  });

  afterEach(() => {
    httpMock.verify();
  });

  const categoriesUrl = `${environment.apiUrl}/api/tenants/${tenantId}/categories`;

  /** The service reads the cache (a promise) before calling the API, so let it settle. */
  const flushAsync = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  describe('fetchCategories', () => {
    it('should fetch categories from API and cache them', async () => {
      const result = firstValueFrom(service.fetchCategories(tenantId));
      await flushAsync();

      const req = httpMock.expectOne(categoriesUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockApiResponse);

      expect(await result).toEqual(mockCategories);
      await flushAsync();
      expect(service.categories()).toEqual(mockCategories);
      expect(storageService.set).toHaveBeenCalled();
    });

    it('should return cached categories if available and not expired', async () => {
      storageService.get.and.returnValue(
        Promise.resolve({ categories: mockCategories, timestamp: Date.now(), tenantId })
      );

      const categories = await firstValueFrom(service.fetchCategories(tenantId));

      expect(categories).toEqual(mockCategories);
      expect(storageService.get).toHaveBeenCalled();
      httpMock.expectNone(categoriesUrl);
    });

    it('should force refresh when forceRefresh is true', async () => {
      storageService.get.and.returnValue(
        Promise.resolve({ categories: mockCategories, timestamp: Date.now(), tenantId })
      );

      const result = firstValueFrom(service.fetchCategories(tenantId, true));
      await flushAsync();

      const req = httpMock.expectOne(categoriesUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockApiResponse);

      expect(await result).toEqual(mockCategories);
    });

    it('should translate API errors by code and return an empty list', async () => {
      spyOn(console, 'error');
      const result = firstValueFrom(service.fetchCategories(tenantId));
      await flushAsync();

      httpMock
        .expectOne(categoriesUrl)
        .flush({ code: 'MISSING_PERMISSIONS', message: 'English' }, { status: 403, statusText: 'Forbidden' });

      expect(await result).toEqual([]);
      expect(service.error()).toBe('API_ERRORS.MISSING_PERMISSIONS');
    });

    it('should show the unreachable-server message when there is no response', async () => {
      spyOn(console, 'error');
      const result = firstValueFrom(service.fetchCategories(tenantId));
      await flushAsync();

      httpMock.expectOne(categoriesUrl).error(new ProgressEvent('error'));

      expect(await result).toEqual([]);
      expect(service.error()).toBe('AUTH.ERRORS.SERVER_UNREACHABLE');
    });

    it('should return an empty list on error when the cache is expired', async () => {
      spyOn(console, 'error');
      storageService.get.and.returnValue(
        Promise.resolve({
          categories: mockCategories,
          timestamp: Date.now() - 20 * 60 * 1000, // Expired cache
          tenantId,
        })
      );

      const result = firstValueFrom(service.fetchCategories(tenantId));
      await flushAsync();

      httpMock.expectOne(categoriesUrl).error(new ProgressEvent('error'));

      // The expired cache entry was dropped, so there is nothing to fall back to
      expect(await result).toEqual([]);
      expect(storageService.remove).toHaveBeenCalledWith(`categories_${tenantId}`);
    });

    it('should return empty array if no tenant ID', async () => {
      spyOn(console, 'error');
      tenantService.getCurrentTenantId.and.returnValue(null);

      expect(await firstValueFrom(service.fetchCategories())).toEqual([]);
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
        { id: '1', name: 'Product 1', category: { categoryId: 'cat-1', name: 'Burgers' }, active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        { id: '2', name: 'Product 2', category: { categoryId: 'cat-1', name: 'Burgers' }, active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        { id: '3', name: 'Product 3', category: { categoryId: 'cat-2', name: 'Beverages' }, active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      ];

      const count = service.getCategoryProductCount('cat-1', mockProducts);
      expect(count).toBe(2);
    });

    it('should return 0 for category with no products', () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', category: { categoryId: 'cat-1', name: 'Burgers' }, active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      ];

      const count = service.getCategoryProductCount('cat-2', mockProducts);
      expect(count).toBe(0);
    });

    it('should handle products with null category', () => {
      const mockProducts = [
        { id: '1', name: 'Product 1', category: null, active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
        { id: '2', name: 'Product 2', category: { categoryId: 'cat-1', name: 'Burgers' }, active: true, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
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
      localStorage.setItem(`categories_${tenantId}`, '{}');
      try {
        await service.clearCache();
        expect(storageService.remove).toHaveBeenCalledWith(`categories_${tenantId}`);
      } finally {
        localStorage.removeItem(`categories_${tenantId}`);
      }
    });
  });

  describe('loading state', () => {
    it('should be loading while fetching and idle afterwards', async () => {
      const result = firstValueFrom(service.fetchCategories(tenantId));
      expect(service.isLoading()).toBe(true);
      await flushAsync();

      httpMock.expectOne(categoriesUrl).flush(mockApiResponse);
      await result;
      await flushAsync();

      expect(service.isLoading()).toBe(false);
    });
  });
});
