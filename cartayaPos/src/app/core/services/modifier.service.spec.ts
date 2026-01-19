import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Modifier } from '../models/modifier.model';
import { ModifierService } from './modifier.service';
import { StorageService } from './storage.service';

describe('ModifierService', () => {
  let service: ModifierService;
  let httpMock: HttpTestingController;
  let storageService: jasmine.SpyObj<StorageService>;

  const mockModifiers: Modifier[] = [
    {
      id: 'mod-1',
      name: 'Extra Cheese',
      priceDelta: 1.0,
      currency: 'USD',
      active: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'mod-2',
      name: 'Add Bacon',
      priceDelta: 2.0,
      currency: 'USD',
      active: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'mod-3',
      name: 'No Onions',
      priceDelta: 0.0,
      currency: 'USD',
      active: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'mod-4',
      name: 'Inactive Modifier',
      priceDelta: 1.5,
      currency: 'USD',
      active: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockApiResponse = {
    data: mockModifiers,
    pagination: {
      total: 4,
      limit: 100,
      offset: 0,
      hasMore: false,
    },
  };

  const tenantId = 'tenant-123';
  const productId = 'product-456';
  const posId = 'pos-789';

  beforeEach(() => {
    const storageServiceSpy = jasmine.createSpyObj('StorageService', [
      'set',
      'get',
      'remove',
      'clear',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ModifierService,
        { provide: StorageService, useValue: storageServiceSpy },
      ],
    });

    service = TestBed.inject(ModifierService);
    httpMock = TestBed.inject(HttpTestingController);
    storageService = TestBed.inject(
      StorageService
    ) as jasmine.SpyObj<StorageService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  // ===== Service Creation =====

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have HttpClient injected', () => {
      expect(service['httpClient']).toBeTruthy();
    });

    it('should have StorageService injected', () => {
      expect(service['storageService']).toBeTruthy();
    });

    it('should initialize isLoading signal with false', () => {
      expect(service.isLoading()).toBe(false);
    });
  });

  // ===== fetchProductModifiers() Tests =====

  describe('fetchProductModifiers()', () => {
    it('should fetch modifiers from API and update loading state', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers).toEqual(mockModifiers.filter((m) => m.active));
        expect(service.isLoading()).toBe(false);
        done();
      });

      expect(service.isLoading()).toBe(true);

      const req = httpMock.expectOne((r) =>
        r.url.includes(
          `/tenants/${tenantId}/products/${productId}/modifiers`
        )
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('limit')).toBe('100');
      req.flush(mockApiResponse);
    });

    it('should set isLoading to true during fetch', (done) => {
      expect(service.isLoading()).toBe(false);
      storageService.set.and.returnValue(Promise.resolve());

      const subscription = service.fetchProductModifiers(tenantId, productId, posId).subscribe(() => {
        expect(service.isLoading()).toBe(false);
        subscription.unsubscribe();
        done();
      });

      expect(service.isLoading()).toBe(true);

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(mockApiResponse);
    });

    it('should extract data from paginated API response', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers).toEqual(mockModifiers.filter((m) => m.active));
        expect(modifiers.length).toBe(3); // Only active modifiers
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(mockApiResponse);
    });

    it('should filter out inactive modifiers', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        const inactiveModifier = modifiers.find((m) => !m.active);
        expect(inactiveModifier).toBeUndefined();
        expect(modifiers.every((m) => m.active)).toBe(true);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(mockApiResponse);
    });

    it('should return empty array when API returns empty data', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers).toEqual([]);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush({ data: [], pagination: { total: 0, limit: 100, offset: 0, hasMore: false } });
    });

    it('should return empty array when API returns null data', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers).toEqual([]);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush({ data: null, pagination: { total: 0, limit: 100, offset: 0, hasMore: false } });
    });

    it('should cache modifiers after successful fetch', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProductModifiers(tenantId, productId, posId).subscribe(() => {
        expect(storageService.set).toHaveBeenCalled();
        const callArgs = storageService.set.calls.mostRecent().args;
        expect(callArgs[0]).toMatch(/^modifiers_/);
        const cachedData = callArgs[1] as Modifier[];
        expect(cachedData).toEqual(mockModifiers.filter((m) => m.active));
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(mockApiResponse);
    });

    it('should handle network error gracefully', (done) => {
      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers).toEqual([]);
        expect(service.isLoading()).toBe(false);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should handle 404 error gracefully', (done) => {
      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers).toEqual([]);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });
    });

    it('should handle 500 error gracefully', (done) => {
      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers).toEqual([]);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should log errors to console on API error', (done) => {
      spyOn(console, 'error');

      service.fetchProductModifiers(tenantId, productId, posId).subscribe(() => {
        expect(console.error).toHaveBeenCalled();
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should set isLoading to false on error', (done) => {
      service.fetchProductModifiers(tenantId, productId, posId).subscribe(() => {
        expect(service.isLoading()).toBe(false);
        done();
      });

      expect(service.isLoading()).toBe(true);

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.error(new ErrorEvent('Network error'));
    });
  });

  // ===== cacheModifiers() Tests =====

  describe('cacheModifiers()', () => {
    it('should cache modifiers to storage', async () => {
      storageService.set.and.returnValue(Promise.resolve());

      await service.cacheModifiers(posId, mockModifiers);

      expect(storageService.set).toHaveBeenCalled();
      const callArgs = storageService.set.calls.mostRecent().args;
      expect(callArgs[0]).toMatch(/^modifiers_/);
      expect(callArgs[1]).toEqual(mockModifiers);
    });

    it('should use correct cache key format', async () => {
      storageService.set.and.returnValue(Promise.resolve());

      await service.cacheModifiers(posId, mockModifiers);

      const callArgs = storageService.set.calls.mostRecent().args;
      expect(callArgs[0]).toBe(`modifiers_${posId}`);
    });

    it('should handle storage service errors gracefully', async () => {
      storageService.set.and.returnValue(
        Promise.reject(new Error('Storage error'))
      );
      spyOn(console, 'debug');

      // Should not throw error
      await service.cacheModifiers(posId, mockModifiers);

      expect(console.debug).toHaveBeenCalled();
    });

    it('should cache empty array', async () => {
      storageService.set.and.returnValue(Promise.resolve());

      await service.cacheModifiers(posId, []);

      const callArgs = storageService.set.calls.mostRecent().args;
      expect(callArgs[1]).toEqual([]);
    });

    it('should overwrite existing cache', async () => {
      storageService.set.and.returnValue(Promise.resolve());

      const firstBatch = mockModifiers.slice(0, 2);
      const secondBatch = mockModifiers.slice(2);

      await service.cacheModifiers(posId, firstBatch);
      await service.cacheModifiers(posId, secondBatch);

      expect(storageService.set).toHaveBeenCalledTimes(2);
      const lastCallArgs = storageService.set.calls.mostRecent().args;
      expect(lastCallArgs[1]).toEqual(secondBatch);
    });
  });

  // ===== getCachedModifiers() Tests =====

  describe('getCachedModifiers()', () => {
    it('should retrieve cached modifiers from storage', async () => {
      storageService.get.and.returnValue(Promise.resolve(mockModifiers));

      const cached = await service.getCachedModifiers(posId);

      expect(cached).toEqual(mockModifiers);
      expect(storageService.get).toHaveBeenCalledWith(`modifiers_${posId}`);
    });

    it('should return null when cache is not found', async () => {
      storageService.get.and.returnValue(Promise.resolve(null));

      const cached = await service.getCachedModifiers(posId);

      expect(cached).toBeNull();
    });

    it('should return null on storage service error', async () => {
      storageService.get.and.returnValue(
        Promise.reject(new Error('Storage error'))
      );
      spyOn(console, 'debug');

      const cached = await service.getCachedModifiers(posId);

      expect(cached).toBeNull();
      expect(console.debug).toHaveBeenCalled();
    });

    it('should use correct cache key', async () => {
      storageService.get.and.returnValue(Promise.resolve(mockModifiers));

      await service.getCachedModifiers(posId);

      expect(storageService.get).toHaveBeenCalledWith(`modifiers_${posId}`);
    });
  });

  // ===== Caching Integration Tests =====

  describe('Caching Integration', () => {
    it('should cache modifiers during fetch and retrieve via getCachedModifiers', async () => {
      storageService.set.and.returnValue(Promise.resolve());
      const activeModifiers = mockModifiers.filter((m) => m.active);

      let cachedModifiers: Modifier[] | null = null;

      service.fetchProductModifiers(tenantId, productId, posId).subscribe(() => {
        // After fetch, modifiers should be cached
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(mockApiResponse);

      // Get cached modifiers
      storageService.get.and.returnValue(Promise.resolve(activeModifiers));
      cachedModifiers = await service.getCachedModifiers(posId);

      expect(cachedModifiers).toEqual(activeModifiers);
    });

    it('should cache only active modifiers', async () => {
      storageService.set.and.returnValue(Promise.resolve());
      const activeModifiers = mockModifiers.filter((m) => m.active);

      service.fetchProductModifiers(tenantId, productId, posId).subscribe(() => {
        // Verify cached data
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(mockApiResponse);

      const callArgs = storageService.set.calls.mostRecent().args;
      expect(callArgs[1]).toEqual(activeModifiers);
    });
  });

  // ===== Loading State Tests =====

  describe('Loading State', () => {
    it('should transition loading state from false to true to false', (done) => {
      const states: boolean[] = [];

      expect(service.isLoading()).toBe(false);
      states.push(service.isLoading());

      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProductModifiers(tenantId, productId, posId).subscribe(() => {
        states.push(service.isLoading());
        expect(states).toEqual([false, true, false]);
        done();
      });

      states.push(service.isLoading());

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(mockApiResponse);
    });

    it('should keep loading state false on error until completion', (done) => {
      const states: boolean[] = [];

      expect(service.isLoading()).toBe(false);
      states.push(service.isLoading());

      service.fetchProductModifiers(tenantId, productId, posId).subscribe(() => {
        states.push(service.isLoading());
        expect(states).toEqual([false, true, false]);
        done();
      });

      states.push(service.isLoading());

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.error(new ErrorEvent('Network error'));
    });
  });

  // ===== Edge Cases =====

  describe('Edge Cases', () => {
    it('should handle modifiers with zero price delta', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      const modsWithZeroDelta = mockModifiers.filter((m) => m.active);

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        const zeroModifier = modifiers.find((m) => m.priceDelta === 0);
        expect(zeroModifier).toBeDefined();
        expect(zeroModifier?.name).toBe('No Onions');
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(mockApiResponse);
    });

    it('should handle modifiers with negative price delta (discounts)', (done) => {
      const modsWithDiscount = [
        {
          ...mockModifiers[0],
          priceDelta: -0.5,
          name: 'Senior Discount',
        },
      ];
      const responseWithDiscount = {
        data: modsWithDiscount,
        pagination: mockApiResponse.pagination,
      };

      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        const discountModifier = modifiers.find((m) => m.priceDelta < 0);
        expect(discountModifier).toBeDefined();
        expect(discountModifier?.priceDelta).toBe(-0.5);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(responseWithDiscount);
    });

    it('should handle large numbers of modifiers', (done) => {
      const largeModifierSet = Array.from({ length: 100 }, (_, i) => ({
        id: `mod-${i}`,
        name: `Modifier ${i}`,
        priceDelta: i * 0.1,
        currency: 'USD',
        active: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }));

      const responseWithLargeSet = {
        data: largeModifierSet,
        pagination: { total: 100, limit: 100, offset: 0, hasMore: false },
      };

      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers.length).toBe(100);
        expect(modifiers[0].name).toBe('Modifier 0');
        expect(modifiers[99].name).toBe('Modifier 99');
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(responseWithLargeSet);
    });

    it('should handle special characters in modifier names', (done) => {
      const specialModifiers = [
        {
          ...mockModifiers[0],
          name: 'Extra Cheese & Bacon!',
        },
        {
          ...mockModifiers[1],
          name: "No Onions (Premium)",
        },
      ];

      const responseWithSpecial = {
        data: specialModifiers,
        pagination: mockApiResponse.pagination,
      };

      storageService.set.and.returnValue(Promise.resolve());

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers[0].name).toBe('Extra Cheese & Bacon!');
        expect(modifiers[1].name).toBe("No Onions (Premium)");
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(responseWithSpecial);
    });
  });

  // ===== Integration Tests =====

  describe('Integration', () => {
    it('should complete full fetch and cache workflow', async () => {
      storageService.set.and.returnValue(Promise.resolve());
      storageService.get.and.returnValue(
        Promise.resolve(mockModifiers.filter((m) => m.active))
      );

      // Fetch modifiers
      let fetchedModifiers: Modifier[] = [];
      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        fetchedModifiers = modifiers;
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(mockApiResponse);

      // Get cached modifiers
      const cachedModifiers = await service.getCachedModifiers(posId);

      expect(fetchedModifiers.length).toBe(3);
      expect(cachedModifiers?.length).toBe(3);
      if (cachedModifiers) {
        expect(fetchedModifiers).toEqual(cachedModifiers);
      }
    });

    it('should handle multiple concurrent fetch requests', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      // Make multiple concurrent requests
      service.fetchProductModifiers(tenantId, 'prod-1', posId).subscribe((modifiers) => {
        expect(modifiers).toEqual(mockModifiers.filter((m) => m.active));
      });

      service.fetchProductModifiers(tenantId, 'prod-2', posId).subscribe((modifiers) => {
        expect(modifiers).toEqual(mockModifiers.filter((m) => m.active));
      });

      service.fetchProductModifiers(tenantId, 'prod-3', posId).subscribe(() => {
        done();
      });

      // Respond to all requests
      const reqs = httpMock.match((r) =>
        r.url.includes('/modifiers')
      );
      expect(reqs.length).toBe(3);

      reqs.forEach((req) => {
        req.flush(mockApiResponse);
      });
    });
  });

  // ===== includedQuantity API Response Handling =====

  describe('includedQuantity API Response Handling', () => {
    it('should preserve includedQuantity from API response', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      const apiResponseWithIncluded = {
        data: [
          {
            id: 'mod-cheese',
            name: 'Extra Cheese',
            priceDelta: 1.0,
            currency: 'USD',
            active: true,
            includedQuantity: 2, // KEY: includedQuantity in API response
            isDefault: false,
            isRemovable: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        pagination: {
          total: 1,
          limit: 100,
          offset: 0,
          hasMore: false,
        },
      };

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers.length).toBe(1);
        expect(modifiers[0].id).toBe('mod-cheese');
        expect(modifiers[0].includedQuantity).toBe(2); // VERIFY: includedQuantity preserved
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(apiResponseWithIncluded);
    });

    it('should handle missing includedQuantity as undefined', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      const apiResponseWithoutIncluded = {
        data: [
          {
            id: 'mod-bacon',
            name: 'Add Bacon',
            priceDelta: 2.0,
            currency: 'USD',
            active: true,
            // includedQuantity is missing
            isDefault: false,
            isRemovable: true,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        pagination: {
          total: 1,
          limit: 100,
          offset: 0,
          hasMore: false,
        },
      };

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers.length).toBe(1);
        expect(modifiers[0].includedQuantity).toBeUndefined();
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(apiResponseWithoutIncluded);
    });

    it('should filter inactive modifiers and preserve includedQuantity for active ones', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      const mixedResponse = {
        data: [
          {
            id: 'mod-1',
            name: 'Active with included',
            priceDelta: 1.0,
            currency: 'USD',
            active: true,
            includedQuantity: 3,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'mod-2',
            name: 'Inactive (should filter)',
            priceDelta: 2.0,
            currency: 'USD',
            active: false,
            includedQuantity: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'mod-3',
            name: 'Active without included',
            priceDelta: 1.5,
            currency: 'USD',
            active: true,
            // includedQuantity missing
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        pagination: {
          total: 3,
          limit: 100,
          offset: 0,
          hasMore: false,
        },
      };

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        // Should only get 2 active modifiers
        expect(modifiers.length).toBe(2);
        expect(modifiers[0].id).toBe('mod-1');
        expect(modifiers[0].includedQuantity).toBe(3); // Preserved
        expect(modifiers[1].id).toBe('mod-3');
        expect(modifiers[1].includedQuantity).toBeUndefined(); // Missing in original
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(mixedResponse);
    });

    it('should cache includedQuantity correctly', async () => {
      storageService.set.and.returnValue(Promise.resolve());
      storageService.get.and.returnValue(Promise.resolve(null));

      const apiResponseWithIncluded = {
        data: [
          {
            id: 'mod-cheese',
            name: 'Extra Cheese',
            priceDelta: 1.0,
            currency: 'USD',
            active: true,
            includedQuantity: 2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        pagination: {
          total: 1,
          limit: 100,
          offset: 0,
          hasMore: false,
        },
      };

      // Fetch modifiers (will cache them)
      service.fetchProductModifiers(tenantId, productId, posId).subscribe();

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(apiResponseWithIncluded);

      // Wait for async cache operation
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify caching called with correct data
      expect(storageService.set).toHaveBeenCalled();
      const cacheCall = storageService.set.calls.mostRecent();
      expect(cacheCall).toBeTruthy();

      // The cached data should include includedQuantity
      const cachedData = cacheCall?.args[1];
      expect(cachedData).toEqual(
        jasmine.arrayContaining([
          jasmine.objectContaining({
            id: 'mod-cheese',
            includedQuantity: 2,
          }),
        ])
      );
    });

    it('should handle multiple modifiers with different includedQuantity values', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      const complexResponse = {
        data: [
          {
            id: 'mod-1',
            name: 'Sauce 1',
            priceDelta: 0.5,
            currency: 'USD',
            active: true,
            includedQuantity: 1,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'mod-2',
            name: 'Sauce 2',
            priceDelta: 0.75,
            currency: 'USD',
            active: true,
            includedQuantity: 2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'mod-3',
            name: 'Premium Topping',
            priceDelta: 1.5,
            currency: 'USD',
            active: true,
            includedQuantity: 0,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
        pagination: {
          total: 3,
          limit: 100,
          offset: 0,
          hasMore: false,
        },
      };

      service.fetchProductModifiers(tenantId, productId, posId).subscribe((modifiers) => {
        expect(modifiers.length).toBe(3);
        // Verify each modifier has correct includedQuantity
        expect(modifiers[0].includedQuantity).toBe(1);
        expect(modifiers[1].includedQuantity).toBe(2);
        expect(modifiers[2].includedQuantity).toBe(0);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/products/${productId}/modifiers`)
      );
      req.flush(complexResponse);
    });
  });
});
