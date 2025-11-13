import {
    HttpClientTestingModule,
    HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
    Order,
    OrderHistoryResponse
} from '../models/order.model';
import { OrderHistoryService } from './order-history.service';

describe('OrderHistoryService', () => {
  let service: OrderHistoryService;
  let httpMock: HttpTestingController;
  const apiUrl = 'http://localhost:3000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OrderHistoryService],
    });
    service = TestBed.inject(OrderHistoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getOrderHistory', () => {
    it('should fetch orders successfully', (done) => {
      const tenantId = 'tenant-123';
      const posId = 'pos-456';
      const mockOrders: Order[] = [
        {
          orderId: 'order-1',
          status: 'completed',
          totalAmount: 26.0,
          currency: 'USD',
          createdAt: '2024-11-13T12:00:00.000Z',
          items: [
            {
              productId: 'product-1',
              quantity: 2,
              notes: 'No onions',
              priceCentsSnapshot: 1200,
              modifiers: [
                {
                  modifierId: 'modifier-1',
                  name: 'Extra Cheese',
                  priceDeltaCents: 100,
                  priceDelta: 1.00,
                  quantity: 1,
                },
              ],
            },
          ],
        },
      ];

      const mockResponse: OrderHistoryResponse = {
        data: mockOrders,
        pagination: {
          total: 1,
          limit: 50,
          offset: 0,
          hasMore: false,
        },
      };

      service.getOrderHistory(tenantId, posId, 24).subscribe((orders) => {
        expect(orders.length).toBe(1);
        expect(orders[0].orderId).toBe('order-1');
        expect(orders[0].status).toBe('completed');
        expect(orders[0].items.length).toBe(1);
        expect(orders[0].items[0].modifiers.length).toBe(1);
        done();
      });

      const req = httpMock.expectOne((request) =>
        request.url.includes(
          `/api/tenants/${tenantId}/pos/${posId}/orders`
        )
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('limit')).toBe('50');
      expect(req.request.params.get('offset')).toBe('0');
      expect(req.request.withCredentials).toBe(true);
      req.flush(mockResponse);
    });

    it('should handle empty order list', (done) => {
      const tenantId = 'tenant-123';
      const posId = 'pos-456';
      const mockResponse: OrderHistoryResponse = {
        data: [],
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false,
        },
      };

      service.getOrderHistory(tenantId, posId, 24).subscribe((orders) => {
        expect(orders.length).toBe(0);
        done();
      });

      const req = httpMock.expectOne((request) =>
        request.url.includes(
          `/api/tenants/${tenantId}/pos/${posId}/orders`
        )
      );
      req.flush(mockResponse);
    });

    it('should handle 401 Unauthorized error', (done) => {
      const tenantId = 'tenant-123';
      const posId = 'pos-456';

      service.getOrderHistory(tenantId, posId, 24).subscribe(
        () => fail('should have failed with 401 error'),
        (error) => {
          expect(error.message).toContain('Authentication required');
          done();
        }
      );

      const req = httpMock.expectOne((request) =>
        request.url.includes(
          `/api/tenants/${tenantId}/pos/${posId}/orders`
        )
      );
      req.flush(
        { code: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401, statusText: 'Unauthorized' }
      );
    });

    it('should handle 403 Forbidden error', (done) => {
      const tenantId = 'tenant-123';
      const posId = 'pos-456';

      service.getOrderHistory(tenantId, posId, 24).subscribe(
        () => fail('should have failed with 403 error'),
        (error) => {
          expect(error.message).toContain('Access denied');
          done();
        }
      );

      const req = httpMock.expectOne((request) =>
        request.url.includes(
          `/api/tenants/${tenantId}/pos/${posId}/orders`
        )
      );
      req.flush(
        {
          code: 'FORBIDDEN',
          message: 'Access denied. You do not have permission to view orders for this POS.',
        },
        { status: 403, statusText: 'Forbidden' }
      );
    });

    it('should handle 404 Not Found error', (done) => {
      const tenantId = 'tenant-123';
      const posId = 'pos-456';

      service.getOrderHistory(tenantId, posId, 24).subscribe(
        () => fail('should have failed with 404 error'),
        (error) => {
          expect(error.message).toContain('Point of Sale not found');
          done();
        }
      );

      const req = httpMock.expectOne((request) =>
        request.url.includes(
          `/api/tenants/${tenantId}/pos/${posId}/orders`
        )
      );
      req.flush(
        { code: 'NOT_FOUND', message: 'Point of Sale not found' },
        { status: 404, statusText: 'Not Found' }
      );
    });

    it('should handle 500 Internal Server Error', (done) => {
      const tenantId = 'tenant-123';
      const posId = 'pos-456';

      service.getOrderHistory(tenantId, posId, 24).subscribe(
        () => fail('should have failed with 500 error'),
        (error) => {
          expect(error.message).toContain('Server error');
          done();
        }
      );

      const req = httpMock.expectOne((request) =>
        request.url.includes(
          `/api/tenants/${tenantId}/pos/${posId}/orders`
        )
      );
      req.flush(
        {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while listing orders',
        },
        { status: 500, statusText: 'Internal Server Error' }
      );
    });

    it('should include dateFrom and dateTo query parameters', (done) => {
      const tenantId = 'tenant-123';
      const posId = 'pos-456';
      const mockResponse: OrderHistoryResponse = {
        data: [],
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false,
        },
      };

      service.getOrderHistory(tenantId, posId, 24).subscribe(() => {
        done();
      });

      const req = httpMock.expectOne((request) =>
        request.url.includes(
          `/api/tenants/${tenantId}/pos/${posId}/orders`
        )
      );
      expect(req.request.params.has('dateFrom')).toBe(true);
      expect(req.request.params.has('dateTo')).toBe(true);
      expect(req.request.params.get('dateFrom')).toBeTruthy();
      expect(req.request.params.get('dateTo')).toBeTruthy();
      req.flush(mockResponse);
    });

    it('should reject missing tenantId', (done) => {
      service.getOrderHistory('', 'pos-456', 24).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.message).toContain('tenantId and posId are required');
          done();
        }
      );
    });

    it('should reject missing posId', (done) => {
      service.getOrderHistory('tenant-123', '', 24).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.message).toContain('tenantId and posId are required');
          done();
        }
      );
    });

    it('should reject negative hours', (done) => {
      service.getOrderHistory('tenant-123', 'pos-456', -24).subscribe(
        () => fail('should have failed'),
        (error) => {
          expect(error.message).toContain('must be a positive number');
          done();
        }
      );
    });
  });

  describe('getOrderHistoryByDateRange', () => {
    it('should fetch orders with custom date range', (done) => {
      const tenantId = 'tenant-123';
      const posId = 'pos-456';
      const dateFrom = '2024-11-13T00:00:00Z';
      const dateTo = '2024-11-13T23:59:59Z';
      const mockResponse: OrderHistoryResponse = {
        data: [],
        pagination: {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false,
        },
      };

      service
        .getOrderHistoryByDateRange(
          tenantId,
          posId,
          dateFrom,
          dateTo
        )
        .subscribe(() => {
          done();
        });

      const req = httpMock.expectOne((request) =>
        request.url.includes(
          `/api/tenants/${tenantId}/pos/${posId}/orders`
        )
      );
      expect(req.request.params.get('dateFrom')).toBe(dateFrom);
      expect(req.request.params.get('dateTo')).toBe(dateTo);
      req.flush(mockResponse);
    });

    it('should reject missing dateFrom parameter', (done) => {
      service
        .getOrderHistoryByDateRange(
          'tenant-123',
          'pos-456',
          '',
          '2024-11-13T23:59:59Z'
        )
        .subscribe(
          () => fail('should have failed'),
          (error) => {
            expect(error.message).toContain('dateFrom and dateTo are required');
            done();
          }
        );
    });

    it('should reject invalid date format', (done) => {
      service
        .getOrderHistoryByDateRange(
          'tenant-123',
          'pos-456',
          'invalid-date',
          '2024-11-13T23:59:59Z'
        )
        .subscribe(
          () => fail('should have failed'),
          (error) => {
            expect(error.message).toContain('Invalid date format');
            done();
          }
        );
    });
  });

  describe('getOrderHistoryByStatus', () => {
    it('should fetch completed orders', (done) => {
      const tenantId = 'tenant-123';
      const posId = 'pos-456';
      const mockResponse: OrderHistoryResponse = {
        data: [
          {
            orderId: 'order-1',
            status: 'completed',
            totalAmount: 26.0,
            currency: 'USD',
            createdAt: '2024-11-13T12:00:00.000Z',
            items: [],
          },
        ],
        pagination: {
          total: 1,
          limit: 50,
          offset: 0,
          hasMore: false,
        },
      };

      service
        .getOrderHistoryByStatus(tenantId, posId, 'completed', 24)
        .subscribe((orders) => {
          expect(orders[0].status).toBe('completed');
          done();
        });

      const req = httpMock.expectOne((request) =>
        request.url.includes(
          `/api/tenants/${tenantId}/pos/${posId}/orders`
        )
      );
      expect(req.request.params.get('status')).toBe('completed');
      req.flush(mockResponse);
    });

    it('should reject invalid status value', (done) => {
      service
        .getOrderHistoryByStatus(
          'tenant-123',
          'pos-456',
          'invalid-status' as any,
          24
        )
        .subscribe(
          () => fail('should have failed'),
          (error) => {
            expect(error.message).toContain("'received' or 'completed'");
            done();
          }
        );
    });
  });
});
