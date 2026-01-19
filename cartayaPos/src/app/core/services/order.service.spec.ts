import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SelectedModifier } from '../models/order.model';
import { Product } from '../models/product.model';
import { OrderService } from './order.service';
import { StorageService } from './storage.service';

describe('OrderService', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;
  let storageService: jasmine.SpyObj<StorageService>;

  const mockProduct: Product = {
    id: 'prod-1',
    name: 'Cheeseburger',
    sku: 'BURGER-001',
    description: 'Classic cheeseburger',
    active: true,
    defaultPriceId: 'price-1',
    defaultPrice: {
      id: 'price-1',
      amount: 12.99,
      currency: 'EUR',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const mockModifiers: SelectedModifier[] = [
    {
      modifierId: 'mod-1',
      name: 'Extra Cheese',
      priceDelta: 1.0,
      quantity: 1,
    },
    {
      modifierId: 'mod-2',
      name: 'Bacon',
      priceDelta: 2.0,
      quantity: 2,
    },
  ];

  const tenantId = 'tenant-123';
  const posId = 'pos-456';

  beforeEach(() => {
    const storageServiceSpy = jasmine.createSpyObj('StorageService', [
      'set',
      'get',
      'remove',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OrderService,
        { provide: StorageService, useValue: storageServiceSpy },
      ],
    });

    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
    storageService = TestBed.inject(
      StorageService
    ) as jasmine.SpyObj<StorageService>;

    // Default storage mock to resolve immediately without data
    storageService.get.and.returnValue(Promise.resolve(null));
    storageService.set.and.returnValue(Promise.resolve());
    storageService.remove.and.returnValue(Promise.resolve());
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

    it('should initialize orderItems signal with empty array', () => {
      expect(service.orderItems()).toEqual([]);
    });

    it('should initialize currency signal with EUR', () => {
      expect(service.currency()).toBe('EUR');
    });

    it('should initialize isSubmitting signal with false', () => {
      expect(service.isSubmitting()).toBe(false);
    });

    it('should initialize itemCount computed signal to 0', () => {
      expect(service.itemCount()).toBe(0);
    });

    it('should initialize hasItems computed signal to false', () => {
      expect(service.hasItems()).toBe(false);
    });

    it('should initialize orderTotal computed signal to 0', () => {
      expect(service.orderTotal()).toBe(0);
    });
  });

  // ===== addConfiguredProduct() Tests =====

  describe('addConfiguredProduct()', () => {
    it('should add a product with modifiers to the order', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.addConfiguredProduct(mockProduct, mockModifiers);

      setTimeout(() => {
        expect(service.orderItems().length).toBe(1);
        const item = service.orderItems()[0];
        expect(item.productId).toBe(mockProduct.id);
        expect(item.productName).toBe(mockProduct.name);
        expect(item.basePrice).toBe(12.99);
        expect(item.modifiers).toEqual(mockModifiers);
        done();
      }, 10);
    });

    it('should add a product without modifiers to the order', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        expect(service.orderItems().length).toBe(1);
        const item = service.orderItems()[0];
        expect(item.modifiers).toEqual([]);
        expect(item.subtotal).toBe(12.99);
        done();
      }, 10);
    });

    it('should calculate subtotal correctly with modifiers', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      // mockModifiers: Extra Cheese (+1.00 x 1) + Bacon (+2.00 x 2) = 5.00
      // Expected subtotal: 12.99 + 5.00 = 17.99
      service.addConfiguredProduct(mockProduct, mockModifiers);

      setTimeout(() => {
        const item = service.orderItems()[0];
        expect(item.subtotal).toBe(17.99);
        done();
      }, 10);
    });

    it('should calculate subtotal correctly without modifiers', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        const item = service.orderItems()[0];
        expect(item.subtotal).toBe(12.99);
        done();
      }, 10);
    });

    it('should generate unique ID for each item', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.addConfiguredProduct(mockProduct, []);
      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        const items = service.orderItems();
        expect(items[0].id).not.toBe(items[1].id);
        done();
      }, 10);
    });

    it('should update orderItems signal reactively', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      expect(service.itemCount()).toBe(0);

      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        expect(service.itemCount()).toBe(1);
        done();
      }, 10);
    });

    it('should persist to storage after adding item', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.addConfiguredProduct(mockProduct, mockModifiers);

      setTimeout(() => {
        expect(storageService.set).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should log error when product is missing required fields', () => {
      spyOn(console, 'error');
      const invalidProduct = { ...mockProduct, id: undefined } as any;

      service.addConfiguredProduct(invalidProduct, []);

      expect(console.error).toHaveBeenCalled();
    });

    it('should log error when product has no defaultPrice', () => {
      spyOn(console, 'error');
      const invalidProduct = { ...mockProduct, defaultPrice: undefined } as any;

      service.addConfiguredProduct(invalidProduct, []);

      expect(console.error).toHaveBeenCalled();
    });

    it('should log error when product has no defaultPrice.amount', () => {
      spyOn(console, 'error');
      const invalidProduct = {
        ...mockProduct,
        defaultPrice: { id: 'price-1', currency: 'EUR' },
      } as any;

      service.addConfiguredProduct(invalidProduct, []);

      expect(console.error).toHaveBeenCalled();
    });

    it('should handle modifiers with negative price delta (discounts)', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      const discountModifier: SelectedModifier = {
        modifierId: 'mod-discount',
        name: 'Senior Discount',
        priceDelta: -2.0,
        quantity: 1,
      };

      service.addConfiguredProduct(mockProduct, [discountModifier]);

      setTimeout(() => {
        const item = service.orderItems()[0];
        // 12.99 - 2.00 = 10.99
        expect(item.subtotal).toBe(10.99);
        done();
      }, 10);
    });

    it('should handle multiple modifiers of the same type', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      const multipleModifiers: SelectedModifier[] = [
        {
          modifierId: 'mod-cheese',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          quantity: 3,
        },
      ];

      service.addConfiguredProduct(mockProduct, multipleModifiers);

      setTimeout(() => {
        const item = service.orderItems()[0];
        // 12.99 + (1.0 * 3) = 15.99
        expect(item.subtotal).toBe(15.99);
        done();
      }, 10);
    });

    it('should allow adding same product multiple times', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.addConfiguredProduct(mockProduct, []);
      service.addConfiguredProduct(mockProduct, []);
      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        expect(service.itemCount()).toBe(3);
        done();
      }, 10);
    });
  });

  // ===== removeItem() Tests =====

  describe('removeItem()', () => {
    beforeEach((done) => {
      storageService.set.and.returnValue(Promise.resolve());
      service.addConfiguredProduct(mockProduct, mockModifiers);
      setTimeout(() => done(), 10);
    });

    it('should remove an item from the order by ID', (done) => {
      expect(service.itemCount()).toBe(1);
      const itemId = service.orderItems()[0].id;

      service.removeItem(itemId);

      setTimeout(() => {
        expect(service.itemCount()).toBe(0);
        done();
      }, 10);
    });

    it('should not remove items with different IDs', (done) => {
      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        expect(service.itemCount()).toBe(2);
        service.removeItem('non-existent-id');

        setTimeout(() => {
          expect(service.itemCount()).toBe(2);
          done();
        }, 10);
      }, 10);
    });

    it('should persist to storage after removing item', (done) => {
      const itemId = service.orderItems()[0].id;
      storageService.set.and.returnValue(Promise.resolve());

      service.removeItem(itemId);

      setTimeout(() => {
        expect(storageService.set).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should remove order from storage when last item is removed', (done) => {
      const itemId = service.orderItems()[0].id;
      storageService.remove.and.returnValue(Promise.resolve());

      service.removeItem(itemId);

      setTimeout(() => {
        expect(storageService.remove).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should update orderTotal when item is removed', (done) => {
      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        const initialTotal = service.orderTotal();
        const itemId = service.orderItems()[0].id;

        service.removeItem(itemId);

        setTimeout(() => {
          expect(service.orderTotal()).toBeLessThan(initialTotal);
          done();
        }, 10);
      }, 10);
    });

    it('should update itemCount when item is removed', (done) => {
      const initialCount = service.itemCount();
      const itemId = service.orderItems()[0].id;

      service.removeItem(itemId);

      setTimeout(() => {
        expect(service.itemCount()).toBe(initialCount - 1);
        done();
      }, 10);
    });
  });

  // ===== updateItemModifiers() Tests =====

  describe('updateItemModifiers()', () => {
    beforeEach((done) => {
      storageService.set.and.returnValue(Promise.resolve());
      service.addConfiguredProduct(mockProduct, mockModifiers);
      setTimeout(() => done(), 10);
    });

    it('should update modifiers for an existing item', (done) => {
      const itemId = service.orderItems()[0].id;
      const newModifiers: SelectedModifier[] = [
        {
          modifierId: 'mod-3',
          name: 'Lettuce',
          priceDelta: 0.5,
          quantity: 1,
        },
      ];

      service.updateItemModifiers(itemId, newModifiers);

      setTimeout(() => {
        const item = service.orderItems()[0];
        expect(item.modifiers).toEqual(newModifiers);
        done();
      }, 10);
    });

    it('should recalculate subtotal when modifiers are updated', (done) => {
      const itemId = service.orderItems()[0].id;
      const newModifiers: SelectedModifier[] = [
        {
          modifierId: 'mod-3',
          name: 'Just Cheese',
          priceDelta: 1.0,
          quantity: 1,
        },
      ];

      service.updateItemModifiers(itemId, newModifiers);

      setTimeout(() => {
        const item = service.orderItems()[0];
        // 12.99 + 1.00 = 13.99
        expect(item.subtotal).toBe(13.99);
        done();
      }, 10);
    });

    it('should update orderTotal when item modifiers are changed', (done) => {
      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        const initialTotal = service.orderTotal();
        const itemId = service.orderItems()[0].id;
        const newModifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-expensive',
            name: 'Premium Add-on',
            priceDelta: 5.0,
            quantity: 1,
          },
        ];

        service.updateItemModifiers(itemId, newModifiers);

        setTimeout(() => {
          expect(service.orderTotal()).toBeGreaterThan(initialTotal);
          done();
        }, 10);
      }, 10);
    });

    it('should persist to storage after updating modifiers', (done) => {
      const itemId = service.orderItems()[0].id;
      storageService.set.and.returnValue(Promise.resolve());

      service.updateItemModifiers(itemId, []);

      setTimeout(() => {
        expect(storageService.set).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should log error when item not found', () => {
      spyOn(console, 'error');
      service.updateItemModifiers('non-existent-id', []);
      expect(console.error).toHaveBeenCalled();
    });

    it('should allow updating to empty modifiers array', (done) => {
      const itemId = service.orderItems()[0].id;

      service.updateItemModifiers(itemId, []);

      setTimeout(() => {
        const item = service.orderItems()[0];
        expect(item.modifiers).toEqual([]);
        expect(item.subtotal).toBe(12.99);
        done();
      }, 10);
    });

    it('should allow updating to multiple new modifiers', (done) => {
      const itemId = service.orderItems()[0].id;
      const newModifiers: SelectedModifier[] = [
        {
          modifierId: 'mod-1',
          name: 'Lettuce',
          priceDelta: 0.5,
          quantity: 1,
        },
        {
          modifierId: 'mod-2',
          name: 'Tomato',
          priceDelta: 0.5,
          quantity: 1,
        },
        {
          modifierId: 'mod-3',
          name: 'Onion',
          priceDelta: 0.25,
          quantity: 2,
        },
      ];

      service.updateItemModifiers(itemId, newModifiers);

      setTimeout(() => {
        const item = service.orderItems()[0];
        expect(item.modifiers.length).toBe(3);
        // 12.99 + 0.5 + 0.5 + (0.25 * 2) = 14.49
        expect(item.subtotal).toBeCloseTo(14.49, 2);
        done();
      }, 10);
    });
  });

  // ===== clearOrder() Tests =====

  describe('clearOrder()', () => {
    beforeEach((done) => {
      storageService.set.and.returnValue(Promise.resolve());
      service.addConfiguredProduct(mockProduct, mockModifiers);
      service.addConfiguredProduct(mockProduct, []);
      setTimeout(() => done(), 10);
    });

    it('should clear all items from the order', (done) => {
      expect(service.itemCount()).toBe(2);

      service.clearOrder();

      setTimeout(() => {
        expect(service.orderItems()).toEqual([]);
        expect(service.itemCount()).toBe(0);
        done();
      }, 10);
    });

    it('should reset orderTotal to 0', (done) => {
      expect(service.orderTotal()).toBeGreaterThan(0);

      service.clearOrder();

      setTimeout(() => {
        expect(service.orderTotal()).toBe(0);
        done();
      }, 10);
    });

    it('should set hasItems to false', (done) => {
      expect(service.hasItems()).toBe(true);

      service.clearOrder();

      setTimeout(() => {
        expect(service.hasItems()).toBe(false);
        done();
      }, 10);
    });

    it('should remove order from storage', (done) => {
      storageService.remove.and.returnValue(Promise.resolve());

      service.clearOrder();

      setTimeout(() => {
        expect(storageService.remove).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should clear order state even when storage fails', (done) => {
      storageService.remove.and.returnValue(
        Promise.reject(new Error('Storage error'))
      );
      spyOn(console, 'error');

      service.clearOrder();

      setTimeout(() => {
        expect(service.orderItems()).toEqual([]);
        expect(console.error).toHaveBeenCalled();
        done();
      }, 10);
    });
  });

  // ===== submitOrder() Tests =====

  describe('submitOrder()', () => {
    beforeEach((done) => {
      storageService.set.and.returnValue(Promise.resolve());
      service.addConfiguredProduct(mockProduct, mockModifiers);
      setTimeout(() => done(), 10);
    });

    it('should set isSubmitting to true during submission', () => {
      expect(service.isSubmitting()).toBe(false);

      service.submitOrder(posId, tenantId).subscribe();

      expect(service.isSubmitting()).toBe(true);

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );
      req.flush({ orderId: 'order-1', status: 'received', createdAt: new Date().toISOString(), items: [], totalAmount: 17.99, currency: 'EUR' });
    });

    it('should POST to correct API endpoint', (done) => {
      storageService.remove.and.returnValue(Promise.resolve());

      service.submitOrder(posId, tenantId).subscribe(() => {
        expect(service.isSubmitting()).toBe(false);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );
      expect(req.request.method).toBe('POST');
      req.flush({ orderId: 'order-1', status: 'received', createdAt: new Date().toISOString(), items: [], totalAmount: 17.99, currency: 'EUR' });
    });

    it('should construct correct request payload', (done) => {
      storageService.remove.and.returnValue(Promise.resolve());

      service.submitOrder(posId, tenantId).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );

      const payload = req.request.body;
      expect(payload.items).toBeDefined();
      expect(payload.items.length).toBe(1);
      expect(payload.items[0].productId).toBe(mockProduct.id);
      expect(payload.items[0].quantity).toBe(1);
      expect(payload.items[0].modifiers).toBeDefined();
      expect(payload.totalAmount).toBe(service.orderTotal());
      expect(payload.currency).toBe(service.currency());

      req.flush({ orderId: 'order-1', status: 'received', createdAt: new Date().toISOString(), items: [], totalAmount: 17.99, currency: 'EUR' });
    });

    it('should map modifiers correctly in payload', (done) => {
      storageService.remove.and.returnValue(Promise.resolve());

      service.submitOrder(posId, tenantId).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );

      const payload = req.request.body;
      const modifiers = payload.items[0].modifiers;
      expect(modifiers.length).toBe(2);
      expect(modifiers[0].modifierId).toBe('mod-1');
      expect(modifiers[0].quantity).toBe(1);
      expect(modifiers[1].modifierId).toBe('mod-2');
      expect(modifiers[1].quantity).toBe(2);

      req.flush({ orderId: 'order-1', status: 'received', createdAt: new Date().toISOString(), items: [], totalAmount: 17.99, currency: 'EUR' });
    });

    it('should clear order on successful submission', (done) => {
      storageService.remove.and.returnValue(Promise.resolve());

      expect(service.itemCount()).toBe(1);

      service.submitOrder(posId, tenantId).subscribe(() => {
        setTimeout(() => {
          expect(service.itemCount()).toBe(0);
          done();
        }, 10);
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );
      req.flush({ orderId: 'order-1', status: 'received', createdAt: new Date().toISOString(), items: [], totalAmount: 17.99, currency: 'EUR' });
    });

    it('should set isSubmitting to false after success', (done) => {
      storageService.remove.and.returnValue(Promise.resolve());

      service.submitOrder(posId, tenantId).subscribe(() => {
        expect(service.isSubmitting()).toBe(false);
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );
      req.flush({ orderId: 'order-1', status: 'received', createdAt: new Date().toISOString(), items: [], totalAmount: 17.99, currency: 'EUR' });
    });

    it('should set isSubmitting to false on error', (done) => {
      service.submitOrder(posId, tenantId).subscribe(
        () => {
          fail('should have errored');
        },
        () => {
          expect(service.isSubmitting()).toBe(false);
          done();
        }
      );

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should not clear order on submission error', (done) => {
      expect(service.itemCount()).toBe(1);

      service.submitOrder(posId, tenantId).subscribe(
        () => {
          fail('should have errored');
        },
        () => {
          setTimeout(() => {
            expect(service.itemCount()).toBe(1);
            done();
          }, 10);
        }
      );

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should log error on submission failure', (done) => {
      spyOn(console, 'error');

      service.submitOrder(posId, tenantId).subscribe(
        () => {
          fail('should have errored');
        },
        () => {
          expect(console.error).toHaveBeenCalled();
          done();
        }
      );

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );
      req.error(new ErrorEvent('Network error'));
    });

    it('should handle 500 server error', (done) => {
      service.submitOrder(posId, tenantId).subscribe(
        () => {
          fail('should have errored');
        },
        () => {
          expect(service.isSubmitting()).toBe(false);
          done();
        }
      );

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });

    it('should return Observable with SubmitOrderResponse', (done) => {
      storageService.remove.and.returnValue(Promise.resolve());

      service.submitOrder(posId, tenantId).subscribe((response) => {
        expect(response.orderId).toBe('order-1');
        expect(response.status).toBe('received');
        expect(response.totalAmount).toBe(17.99);
        expect(response.currency).toBe('EUR');
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );
      req.flush({ orderId: 'order-1', status: 'received', createdAt: new Date().toISOString(), items: [], totalAmount: 17.99, currency: 'EUR' });
    });

    it('should submit order with multiple items', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      storageService.remove.and.returnValue(Promise.resolve());

      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        expect(service.itemCount()).toBe(2);

        service.submitOrder(posId, tenantId).subscribe(() => {
          done();
        });

        const req = httpMock.expectOne((r) =>
          r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
        );

        const payload = req.request.body;
        expect(payload.items.length).toBe(2);
        req.flush({ orderId: 'order-1', status: 'received', createdAt: new Date().toISOString(), items: [], totalAmount: 30.98, currency: 'EUR' });
      }, 10);
    });
  });

  // ===== Computed Signals Tests =====

  describe('Computed Signals', () => {
    beforeEach((done) => {
      storageService.set.and.returnValue(Promise.resolve());
      done();
    });

    describe('orderTotal', () => {
      it('should calculate total as 0 for empty order', () => {
        expect(service.orderTotal()).toBe(0);
      });

      it('should calculate total for single item with modifiers', (done) => {
        service.addConfiguredProduct(mockProduct, mockModifiers);

        setTimeout(() => {
          // 12.99 + (1.00 * 1) + (2.00 * 2) = 17.99
          expect(service.orderTotal()).toBe(17.99);
          done();
        }, 10);
      });

      it('should calculate total for multiple items', (done) => {
        service.addConfiguredProduct(mockProduct, mockModifiers);
        service.addConfiguredProduct(mockProduct, []);

        setTimeout(() => {
          // (12.99 + 5.00) + 12.99 = 30.98
          expect(service.orderTotal()).toBeCloseTo(30.98, 2);
          done();
        }, 10);
      });

      it('should update total when item is removed', (done) => {
        service.addConfiguredProduct(mockProduct, mockModifiers);
        service.addConfiguredProduct(mockProduct, []);

        setTimeout(() => {
          const initialTotal = service.orderTotal();
          const itemId = service.orderItems()[0].id;

          service.removeItem(itemId);

          setTimeout(() => {
            expect(service.orderTotal()).toBe(12.99);
            expect(service.orderTotal()).toBeLessThan(initialTotal);
            done();
          }, 10);
        }, 10);
      });

      it('should react to modifier updates', (done) => {
        service.addConfiguredProduct(mockProduct, []);

        setTimeout(() => {
          const initialTotal = service.orderTotal();
          const itemId = service.orderItems()[0].id;

          service.updateItemModifiers(itemId, mockModifiers);

          setTimeout(() => {
            expect(service.orderTotal()).toBeGreaterThan(initialTotal);
            done();
          }, 10);
        }, 10);
      });
    });

    describe('itemCount', () => {
      it('should return 0 for empty order', () => {
        expect(service.itemCount()).toBe(0);
      });

      it('should increment when item is added', (done) => {
        service.addConfiguredProduct(mockProduct, []);

        setTimeout(() => {
          expect(service.itemCount()).toBe(1);
          service.addConfiguredProduct(mockProduct, []);

          setTimeout(() => {
            expect(service.itemCount()).toBe(2);
            done();
          }, 10);
        }, 10);
      });

      it('should decrement when item is removed', (done) => {
        service.addConfiguredProduct(mockProduct, []);
        service.addConfiguredProduct(mockProduct, []);

        setTimeout(() => {
          expect(service.itemCount()).toBe(2);
          const itemId = service.orderItems()[0].id;

          service.removeItem(itemId);

          setTimeout(() => {
            expect(service.itemCount()).toBe(1);
            done();
          }, 10);
        }, 10);
      });

      it('should be 0 after clearOrder', (done) => {
        service.addConfiguredProduct(mockProduct, []);

        setTimeout(() => {
          expect(service.itemCount()).toBe(1);
          service.clearOrder();

          setTimeout(() => {
            expect(service.itemCount()).toBe(0);
            done();
          }, 10);
        }, 10);
      });
    });

    describe('hasItems', () => {
      it('should be false for empty order', () => {
        expect(service.hasItems()).toBe(false);
      });

      it('should be true when order has items', (done) => {
        service.addConfiguredProduct(mockProduct, []);

        setTimeout(() => {
          expect(service.hasItems()).toBe(true);
          done();
        }, 10);
      });

      it('should be false after clearOrder', (done) => {
        service.addConfiguredProduct(mockProduct, []);

        setTimeout(() => {
          expect(service.hasItems()).toBe(true);
          service.clearOrder();

          setTimeout(() => {
            expect(service.hasItems()).toBe(false);
            done();
          }, 10);
        }, 10);
      });

      it('should be false after removing all items', (done) => {
        service.addConfiguredProduct(mockProduct, []);

        setTimeout(() => {
          const itemId = service.orderItems()[0].id;
          service.removeItem(itemId);

          setTimeout(() => {
            expect(service.hasItems()).toBe(false);
            done();
          }, 10);
        }, 10);
      });
    });
  });

  // ===== Storage Persistence Tests =====

  describe('Storage Persistence', () => {
    it('should load order from storage on initialization', async () => {
      const storedOrder = {
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productName: 'Burger',
            basePrice: 10.0,
            modifiers: [],
            subtotal: 10.0,
          },
        ],
        currency: 'EUR',
        timestamp: Date.now(),
      };

      storageService.get.and.returnValue(Promise.resolve(storedOrder));

      // Create a new service instance to trigger initialization
      const newService = TestBed.inject(OrderService);

      // Wait for async load
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(newService.orderItems().length).toBe(1);
    });

    it('should restore currency from storage', async () => {
      const storedOrder = {
        items: [],
        currency: 'EUR',
        timestamp: Date.now(),
      };

      storageService.get.and.returnValue(Promise.resolve(storedOrder));

      const newService = TestBed.inject(OrderService);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(newService.currency()).toBe('EUR');
    });

    it('should handle missing storage gracefully', async () => {
      storageService.get.and.returnValue(Promise.resolve(null));

      const newService = TestBed.inject(OrderService);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(newService.orderItems().length).toBe(0);
    });

    it('should handle storage load error gracefully', async () => {
      spyOn(console, 'error');
      storageService.get.and.returnValue(
        Promise.reject(new Error('Storage error'))
      );

      const newService = TestBed.inject(OrderService);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(newService.orderItems().length).toBe(0);
      expect(console.error).toHaveBeenCalled();
    });

    it('should handle storage save error gracefully', (done) => {
      spyOn(console, 'error');
      storageService.set.and.returnValue(
        Promise.reject(new Error('Storage error'))
      );

      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        expect(console.error).toHaveBeenCalled();
        expect(service.itemCount()).toBe(1);
        done();
      }, 10);
    });

    it('should not prevent order operations if storage fails', (done) => {
      storageService.set.and.returnValue(
        Promise.reject(new Error('Storage error'))
      );

      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        expect(service.itemCount()).toBe(1);
        expect(service.orderItems()[0].productId).toBe(mockProduct.id);
        done();
      }, 10);
    });
  });

  // ===== includedQuantity Pricing Tests =====

  describe('Pricing with includedQuantity', () => {
    describe('Single modifier scenarios', () => {
      it('should charge zero when selected quantity equals includedQuantity', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-cheese',
            name: 'Extra Cheese',
            priceDelta: 1.0,
            quantity: 2,
            includedQuantity: 2, // Exactly included amount
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // billableQty = max(0, 2-2) = 0
          // charge = $1.00 × 0 = $0.00
          // subtotal = $12.99 + $0.00 = $12.99
          expect(item.subtotal).toBe(12.99);
          done();
        }, 10);
      });

      it('should charge zero when selected quantity is less than includedQuantity', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-cheese',
            name: 'Extra Cheese',
            priceDelta: 1.0,
            quantity: 1,
            includedQuantity: 2, // More included than selected
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // billableQty = max(0, 1-2) = 0
          // charge = $1.00 × 0 = $0.00
          // subtotal = $12.99 + $0.00 = $12.99
          expect(item.subtotal).toBe(12.99);
          done();
        }, 10);
      });

      it('should charge for excess when selected quantity exceeds includedQuantity', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-cheese',
            name: 'Extra Cheese',
            priceDelta: 1.0,
            quantity: 3,
            includedQuantity: 2, // First 2 included, charge for the 3rd
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // billableQty = max(0, 3-2) = 1
          // charge = $1.00 × 1 = $1.00
          // subtotal = $12.99 + $1.00 = $13.99
          expect(item.subtotal).toBe(13.99);
          done();
        }, 10);
      });

      it('should charge full amount when includedQuantity is zero', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-cheese',
            name: 'Extra Cheese',
            priceDelta: 1.0,
            quantity: 3,
            includedQuantity: 0, // No quantity included
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // billableQty = max(0, 3-0) = 3
          // charge = $1.00 × 3 = $3.00
          // subtotal = $12.99 + $3.00 = $15.99
          expect(item.subtotal).toBe(15.99);
          done();
        }, 10);
      });

      it('should handle undefined includedQuantity as zero', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-cheese',
            name: 'Extra Cheese',
            priceDelta: 1.0,
            quantity: 2,
            // includedQuantity is undefined
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // includedQuantity ?? 0 = 0
          // billableQty = max(0, 2-0) = 2
          // charge = $1.00 × 2 = $2.00
          // subtotal = $12.99 + $2.00 = $14.99
          expect(item.subtotal).toBe(14.99);
          done();
        }, 10);
      });

      it('should calculate correctly with large includedQuantity values', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-sauce',
            name: 'Premium Sauce',
            priceDelta: 0.5,
            quantity: 150,
            includedQuantity: 100, // First 100 included
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // billableQty = max(0, 150-100) = 50
          // charge = $0.50 × 50 = $25.00
          // subtotal = $12.99 + $25.00 = $37.99
          expect(item.subtotal).toBeCloseTo(37.99, 2);
          done();
        }, 10);
      });
    });

    describe('Multiple modifiers with includedQuantity', () => {
      it('should calculate correctly with mixed included/non-included modifiers', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-cheese',
            name: 'Extra Cheese',
            priceDelta: 1.0,
            quantity: 3,
            includedQuantity: 2, // First 2 included, charge for 1
          },
          {
            modifierId: 'mod-bacon',
            name: 'Bacon',
            priceDelta: 2.0,
            quantity: 1,
            includedQuantity: 0, // No included, charge for 1
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // charge1 = $1.00 × (3-2) = $1.00
          // charge2 = $2.00 × (1-0) = $2.00
          // subtotal = $12.99 + $1.00 + $2.00 = $15.99
          expect(item.subtotal).toBe(15.99);
          done();
        }, 10);
      });

      it('should calculate correctly when all modifiers have included quantities', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-1',
            name: 'Modifier 1',
            priceDelta: 0.5,
            quantity: 2,
            includedQuantity: 1,
          },
          {
            modifierId: 'mod-2',
            name: 'Modifier 2',
            priceDelta: 0.75,
            quantity: 2,
            includedQuantity: 2, // Exact match, no charge
          },
          {
            modifierId: 'mod-3',
            name: 'Modifier 3',
            priceDelta: 1.0,
            quantity: 4,
            includedQuantity: 3,
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // charge1 = $0.50 × (2-1) = $0.50
          // charge2 = $0.75 × (2-2) = $0.00
          // charge3 = $1.00 × (4-3) = $1.00
          // subtotal = $12.99 + $0.50 + $0.00 + $1.00 = $14.49
          expect(item.subtotal).toBeCloseTo(14.49, 2);
          done();
        }, 10);
      });

      it('should calculate correctly with no modifiers having included quantities', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-1',
            name: 'Mod 1',
            priceDelta: 1.0,
            quantity: 2,
            includedQuantity: 0,
          },
          {
            modifierId: 'mod-2',
            name: 'Mod 2',
            priceDelta: 1.0,
            quantity: 2,
            includedQuantity: 0,
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // charge1 = $1.00 × 2 = $2.00
          // charge2 = $1.00 × 2 = $2.00
          // subtotal = $12.99 + $2.00 + $2.00 = $16.99
          expect(item.subtotal).toBe(16.99);
          done();
        }, 10);
      });
    });

    describe('Negative prices with includedQuantity', () => {
      it('should apply discount correctly with includedQuantity', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-discount',
            name: 'Senior Discount',
            priceDelta: -2.0,
            quantity: 1,
            includedQuantity: 0,
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // charge = -$2.00 × (1-0) = -$2.00
          // subtotal = $12.99 - $2.00 = $10.99
          expect(item.subtotal).toBe(10.99);
          done();
        }, 10);
      });

      it('should handle negative price with included quantity not charged', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-credit',
            name: 'Store Credit',
            priceDelta: -1.0,
            quantity: 1,
            includedQuantity: 2, // More included than selected, so no charge
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // charge = -$1.00 × (1-2) = -$1.00 × 0 = $0.00 (due to max(0, ...))
          // subtotal = $12.99 + $0.00 = $12.99
          expect(item.subtotal).toBe(12.99);
          done();
        }, 10);
      });
    });

    describe('Floating-point precision with includedQuantity', () => {
      it('should handle cent-level prices correctly', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-precise',
            name: 'Precise Price',
            priceDelta: 0.33, // Could cause floating-point issues
            quantity: 3,
            includedQuantity: 1,
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // charge = $0.33 × (3-1) = $0.33 × 2 = $0.66
          // subtotal = $12.99 + $0.66 = $13.65
          expect(item.subtotal).toBeCloseTo(13.65, 2);
          done();
        }, 10);
      });

      it('should handle multiple modifiers with fractional prices', (done) => {
        storageService.set.and.returnValue(Promise.resolve());
        const modifiers: SelectedModifier[] = [
          {
            modifierId: 'mod-1',
            name: 'Mod 1',
            priceDelta: 0.49,
            quantity: 2,
            includedQuantity: 1,
          },
          {
            modifierId: 'mod-2',
            name: 'Mod 2',
            priceDelta: 0.51,
            quantity: 2,
            includedQuantity: 1,
          },
        ];

        service.addConfiguredProduct(mockProduct, modifiers);

        setTimeout(() => {
          const item = service.orderItems()[0];
          // charge1 = $0.49 × (2-1) = $0.49
          // charge2 = $0.51 × (2-1) = $0.51
          // subtotal = $12.99 + $0.49 + $0.51 = $13.99
          expect(item.subtotal).toBeCloseTo(13.99, 2);
          done();
        }, 10);
      });
    });
  });

  // ===== Edge Cases =====

  describe('Edge Cases', () => {
    it('should handle products with zero base price', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      const freeProduct = { ...mockProduct, defaultPrice: { id: 'price-1', amount: 0, currency: 'EUR' } };

      service.addConfiguredProduct(freeProduct, mockModifiers);

      setTimeout(() => {
        const item = service.orderItems()[0];
        // 0 + (1.00 * 1) + (2.00 * 2) = 5.00
        expect(item.subtotal).toBe(5.0);
        done();
      }, 10);
    });

    it('should handle products with very large prices', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      const expensiveProduct = { ...mockProduct, defaultPrice: { id: 'price-1', amount: 999999.99, currency: 'EUR' } };

      service.addConfiguredProduct(expensiveProduct, mockModifiers);

      setTimeout(() => {
        const item = service.orderItems()[0];
        expect(item.subtotal).toBeCloseTo(1000004.99, 2);
        done();
      }, 10);
    });

    it('should handle empty order submission', (done) => {
      storageService.remove.and.returnValue(Promise.resolve());

      service.submitOrder(posId, tenantId).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne((r) =>
        r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
      );

      const payload = req.request.body;
      expect(payload.items).toEqual([]);
      expect(payload.totalAmount).toBe(0);

      req.flush({ orderId: 'order-1', status: 'received', createdAt: new Date().toISOString(), items: [], totalAmount: 0, currency: 'EUR' });
    });

    it('should handle modifiers with zero quantity', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      const zeroQtyModifier: SelectedModifier = {
        modifierId: 'mod-zero',
        name: 'Test',
        priceDelta: 10.0,
        quantity: 0,
      };

      service.addConfiguredProduct(mockProduct, [zeroQtyModifier]);

      setTimeout(() => {
        const item = service.orderItems()[0];
        // 12.99 + (10.00 * 0) = 12.99
        expect(item.subtotal).toBe(12.99);
        done();
      }, 10);
    });

    it('should handle very large modifier quantities', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      const largeQtyModifier: SelectedModifier = {
        modifierId: 'mod-large',
        name: 'Test',
        priceDelta: 1.0,
        quantity: 1000,
      };

      service.addConfiguredProduct(mockProduct, [largeQtyModifier]);

      setTimeout(() => {
        const item = service.orderItems()[0];
        // 12.99 + (1.00 * 1000) = 1012.99
        expect(item.subtotal).toBe(1012.99);
        done();
      }, 10);
    });
  });

  // ===== Integration Tests =====

  describe('Integration', () => {
    it('should complete a full order lifecycle', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      storageService.remove.and.returnValue(Promise.resolve());

      // Add items
      service.addConfiguredProduct(mockProduct, mockModifiers);

      setTimeout(() => {
        expect(service.hasItems()).toBe(true);
        expect(service.itemCount()).toBe(1);
        const totalBefore = service.orderTotal();

        // Add another item
        service.addConfiguredProduct(mockProduct, []);

        setTimeout(() => {
          expect(service.itemCount()).toBe(2);
          expect(service.orderTotal()).toBeGreaterThan(totalBefore);

          // Update modifiers on first item
          const firstItemId = service.orderItems()[0].id;
          service.updateItemModifiers(firstItemId, []);

          setTimeout(() => {
            expect(service.orderTotal()).toBeLessThan(totalBefore);

            // Remove second item
            const secondItemId = service.orderItems()[1].id;
            service.removeItem(secondItemId);

            setTimeout(() => {
              expect(service.itemCount()).toBe(1);

              // Submit order
              service.submitOrder(posId, tenantId).subscribe(() => {
                expect(service.hasItems()).toBe(false);
                expect(service.itemCount()).toBe(0);
                done();
              });

              const req = httpMock.expectOne((r) =>
                r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
              );
              req.flush({ orderId: 'order-1', status: 'received', createdAt: new Date().toISOString(), items: [], totalAmount: 12.99, currency: 'EUR' });
            }, 10);
          }, 10);
        }, 10);
      }, 10);
    });

    it('should handle concurrent operations correctly', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      service.addConfiguredProduct(mockProduct, []);
      service.addConfiguredProduct(mockProduct, mockModifiers);
      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        expect(service.itemCount()).toBe(3);
        const expectedTotal = 12.99 + 17.99 + 12.99;
        expect(service.orderTotal()).toBeCloseTo(expectedTotal, 2);
        done();
      }, 20);
    });

    it('should maintain order consistency across operations', (done) => {
      storageService.set.and.returnValue(Promise.resolve());

      // Add multiple items with different configurations
      const mods1: SelectedModifier[] = [{ modifierId: 'm1', name: 'Extra', priceDelta: 1.0, quantity: 1 }];
      const mods2: SelectedModifier[] = [{ modifierId: 'm2', name: 'Premium', priceDelta: 5.0, quantity: 2 }];

      service.addConfiguredProduct(mockProduct, mods1);
      service.addConfiguredProduct(mockProduct, mods2);
      service.addConfiguredProduct(mockProduct, []);

      setTimeout(() => {
        const items = service.orderItems();
        expect(items[0].subtotal).toBe(13.99); // 12.99 + 1.00
        expect(items[1].subtotal).toBe(22.99); // 12.99 + (5.00 * 2)
        expect(items[2].subtotal).toBe(12.99); // 12.99 + 0

        const total = service.orderTotal();
        expect(total).toBeCloseTo(49.97, 2);
        done();
      }, 20);
    });
  });

  // ===== Order Submission Integration Tests with includedQuantity =====

  describe('Order Submission with includedQuantity', () => {
    it('should submit order with correct totalAmount calculated using includedQuantity', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      storageService.remove.and.returnValue(Promise.resolve());

      // Add item with modifiers that have includedQuantity
      const modifiers: SelectedModifier[] = [
        {
          modifierId: 'mod-cheese',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          quantity: 3,
          includedQuantity: 2, // First 2 included, 3rd charged
        },
      ];

      service.addConfiguredProduct(mockProduct, modifiers);

      setTimeout(() => {
        // Order total should be: 12.99 + (1.0 × (3-2)) = 12.99 + 1.00 = 13.99
        expect(service.orderTotal()).toBe(13.99);

        // Submit order
        service.submitOrder(posId, tenantId).subscribe(() => {
          expect(service.orderItems().length).toBe(0); // Order cleared after submission
          done();
        });

        const req = httpMock.expectOne((r) =>
          r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
        );

        // Verify submission payload
        const payload = req.request.body;
        expect(payload.totalAmount).toBe(13.99); // Correct total with includedQuantity
        expect(payload.items.length).toBe(1);
        expect(payload.items[0].modifiers[0].quantity).toBe(3); // Selected quantity
        expect(payload.items[0].modifiers[0].modifierId).toBe('mod-cheese');

        req.flush({
          orderId: 'order-1',
          status: 'received',
          createdAt: new Date().toISOString(),
          items: [],
          totalAmount: 13.99,
          currency: 'EUR',
        });
      }, 10);
    });

    it('should submit order with multiple items having different includedQuantity values', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      storageService.remove.and.returnValue(Promise.resolve());

      // Item 1: Modifier with includedQuantity=2, selected=3 → charge for 1
      const mods1: SelectedModifier[] = [
        {
          modifierId: 'mod-1',
          name: 'Sauce 1',
          priceDelta: 0.5,
          quantity: 3,
          includedQuantity: 2,
        },
      ];

      // Item 2: Modifier with includedQuantity=0, selected=2 → charge for 2
      const mods2: SelectedModifier[] = [
        {
          modifierId: 'mod-2',
          name: 'Sauce 2',
          priceDelta: 0.75,
          quantity: 2,
          includedQuantity: 0,
        },
      ];

      service.addConfiguredProduct(mockProduct, mods1);
      service.addConfiguredProduct(mockProduct, mods2);

      setTimeout(() => {
        // Item 1: 12.99 + (0.5 × (3-2)) = 12.99 + 0.50 = 13.49
        // Item 2: 12.99 + (0.75 × (2-0)) = 12.99 + 1.50 = 14.49
        // Total: 13.49 + 14.49 = 27.98
        expect(service.orderTotal()).toBeCloseTo(27.98, 2);

        service.submitOrder(posId, tenantId).subscribe(() => {
          done();
        });

        const req = httpMock.expectOne((r) =>
          r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
        );

        const payload = req.request.body;
        expect(payload.totalAmount).toBeCloseTo(27.98, 2);
        expect(payload.items.length).toBe(2);

        req.flush({
          orderId: 'order-1',
          status: 'received',
          createdAt: new Date().toISOString(),
          items: [],
          totalAmount: 27.98,
          currency: 'EUR',
        });
      }, 10);
    });

    it('should calculate and submit order where includedQuantity covers all selected quantity', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      storageService.remove.and.returnValue(Promise.resolve());

      // Modifier with includedQuantity=5, selected=3 → no charge (all included)
      const modifiers: SelectedModifier[] = [
        {
          modifierId: 'mod-bundle',
          name: 'Bundle Deal',
          priceDelta: 2.0,
          quantity: 3,
          includedQuantity: 5, // More than selected
        },
      ];

      service.addConfiguredProduct(mockProduct, modifiers);

      setTimeout(() => {
        // 12.99 + (2.0 × (3-5)) = 12.99 + (2.0 × 0) = 12.99
        expect(service.orderTotal()).toBe(12.99);

        service.submitOrder(posId, tenantId).subscribe(() => {
          done();
        });

        const req = httpMock.expectOne((r) =>
          r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
        );

        const payload = req.request.body;
        expect(payload.totalAmount).toBe(12.99);
        expect(payload.items[0].modifiers[0].quantity).toBe(3);

        req.flush({
          orderId: 'order-1',
          status: 'received',
          createdAt: new Date().toISOString(),
          items: [],
          totalAmount: 12.99,
          currency: 'EUR',
        });
      }, 10);
    });

    it('should handle order submission with mixed included/non-included modifiers', (done) => {
      storageService.set.and.returnValue(Promise.resolve());
      storageService.remove.and.returnValue(Promise.resolve());

      // Multiple modifiers with different includedQuantity values
      const modifiers: SelectedModifier[] = [
        {
          modifierId: 'mod-1',
          name: 'Modifier 1',
          priceDelta: 1.0,
          quantity: 2,
          includedQuantity: 1,
        },
        {
          modifierId: 'mod-2',
          name: 'Modifier 2',
          priceDelta: 0.5,
          quantity: 2,
          includedQuantity: 2, // Exact match, no charge
        },
        {
          modifierId: 'mod-3',
          name: 'Modifier 3',
          priceDelta: 1.5,
          quantity: 3,
          includedQuantity: 0,
        },
      ];

      service.addConfiguredProduct(mockProduct, modifiers);

      setTimeout(() => {
        // charge1 = 1.0 × (2-1) = 1.00
        // charge2 = 0.5 × (2-2) = 0.00
        // charge3 = 1.5 × (3-0) = 4.50
        // Total: 12.99 + 1.00 + 0.00 + 4.50 = 18.49
        expect(service.orderTotal()).toBeCloseTo(18.49, 2);

        service.submitOrder(posId, tenantId).subscribe(() => {
          done();
        });

        const req = httpMock.expectOne((r) =>
          r.url.includes(`/tenants/${tenantId}/pos/${posId}/orders`)
        );

        const payload = req.request.body;
        expect(payload.totalAmount).toBeCloseTo(18.49, 2);
        expect(payload.items[0].modifiers.length).toBe(3);

        req.flush({
          orderId: 'order-1',
          status: 'received',
          createdAt: new Date().toISOString(),
          items: [],
          totalAmount: 18.49,
          currency: 'EUR',
        });
      }, 10);
    });
  });
});
