import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
    HttpClientTestingModule,
    HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastController } from '@ionic/angular/standalone';
import { NetworkService } from '../services/network.service';
import { OrderQueueService } from '../services/order-queue.service';
import { offlineInterceptor } from './offline.interceptor';

describe('OfflineInterceptor', () => {
  let httpClient: HttpClient;
  let httpMock: HttpTestingController;
  let queueService: jasmine.SpyObj<OrderQueueService>;
  let networkService: jasmine.SpyObj<NetworkService>;
  let toastController: jasmine.SpyObj<ToastController>;

  const ORDER_URL =
    'http://localhost:3000/api/tenants/tenant-1/pos/pos-1/orders';
  const ORDER_PAYLOAD = {
    items: [{ productId: 'prod-1', quantity: 1, modifiers: [] }],
    totalAmount: 12.99,
    currency: 'USD',
  };

  beforeEach(() => {
    const queueServiceSpy = jasmine.createSpyObj('OrderQueueService', [
      'enqueue',
    ]);
    const networkServiceSpy = jasmine.createSpyObj('NetworkService', [
      'getIsOnline',
    ]);
    const toastControllerSpy = jasmine.createSpyObj('ToastController', [
      'create',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideHttpClient(withInterceptors([offlineInterceptor])),
        { provide: OrderQueueService, useValue: queueServiceSpy },
        { provide: NetworkService, useValue: networkServiceSpy },
        { provide: ToastController, useValue: toastControllerSpy },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    queueService = TestBed.inject(
      OrderQueueService
    ) as jasmine.SpyObj<OrderQueueService>;
    networkService = TestBed.inject(
      NetworkService
    ) as jasmine.SpyObj<NetworkService>;
    toastController = TestBed.inject(
      ToastController
    ) as jasmine.SpyObj<ToastController>;

    // Default: online
    networkService.getIsOnline.and.returnValue(true);

    // Mock toast
    toastController.create.and.returnValue(
      Promise.resolve({ present: jasmine.createSpy() } as any)
    );
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Order Request Identification', () => {
    it('should intercept order POST requests', () => {
      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe();

      const req = httpMock.expectOne(ORDER_URL);
      expect(req.request.method).toBe('POST');
      req.flush({ orderId: 'order-1' });
    });

    it('should NOT intercept non-order requests on network error', (done) => {
      const nonOrderUrl =
        'http://localhost:3000/api/tenants/tenant-1/products';

      httpClient.post(nonOrderUrl, {}).subscribe(
        () => fail('Should error'),
        (error) => {
          expect(queueService.enqueue).not.toHaveBeenCalled();
          done();
        }
      );

      const req = httpMock.expectOne(nonOrderUrl);
      req.error(new ErrorEvent('Network error'));
    });

    it('should NOT intercept specific order endpoints like /orders/{id}', (done) => {
      const specificOrderUrl =
        'http://localhost:3000/api/tenants/tenant-1/pos/pos-1/orders/order-123';

      httpClient.post(specificOrderUrl, {}).subscribe(
        () => fail('Should error'),
        (error) => {
          expect(queueService.enqueue).not.toHaveBeenCalled();
          done();
        }
      );

      const req = httpMock.expectOne(specificOrderUrl);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('Queueing Logic', () => {
    it('should queue order on network error', (done) => {
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        (response: any) => {
          expect(response.status).toBe('queued');
          expect(queueService.enqueue).toHaveBeenCalledWith(
            ORDER_PAYLOAD,
            'pos-1',
            'tenant-1',
            jasmine.objectContaining({ total: 12.99 })
          );
          done();
        },
        () => fail('Should not error')
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Network error'));
    });

    it('should queue order when offline', (done) => {
      networkService.getIsOnline.and.returnValue(false);
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        (response: any) => {
          expect(response.status).toBe('queued');
          expect(queueService.enqueue).toHaveBeenCalled();
          done();
        },
        () => fail('Should not error')
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Network error'));
    });

    it('should queue order on 500 server error', (done) => {
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        (response: any) => {
          expect(response.status).toBe('queued');
          expect(queueService.enqueue).toHaveBeenCalled();
          done();
        },
        () => fail('Should not error')
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.flush('Server error', {
        status: 500,
        statusText: 'Internal Server Error',
      });
    });

    it('should queue order on 502 Bad Gateway', (done) => {
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        (response: any) => {
          expect(response.status).toBe('queued');
          expect(queueService.enqueue).toHaveBeenCalled();
          done();
        },
        () => fail('Should not error')
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.flush('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    });

    it('should queue order on 504 Gateway Timeout', (done) => {
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        (response: any) => {
          expect(response.status).toBe('queued');
          expect(queueService.enqueue).toHaveBeenCalled();
          done();
        },
        () => fail('Should not error')
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.flush('Gateway Timeout', {
        status: 504,
        statusText: 'Gateway Timeout',
      });
    });

    it('should queue order on 408 Request Timeout', (done) => {
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        (response: any) => {
          expect(response.status).toBe('queued');
          expect(queueService.enqueue).toHaveBeenCalled();
          done();
        },
        () => fail('Should not error')
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.flush('Request Timeout', {
        status: 408,
        statusText: 'Request Timeout',
      });
    });

    it('should queue order on 0 status (network error)', (done) => {
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        (response: any) => {
          expect(response.status).toBe('queued');
          expect(queueService.enqueue).toHaveBeenCalled();
          done();
        },
        () => fail('Should not error')
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Unknown Error'));
    });
  });

  describe('Error Filtering (Non-Queue-Worthy)', () => {
    it('should NOT queue order on 400 Bad Request', (done) => {
      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        () => fail('Should error'),
        (error) => {
          expect(error.status).toBe(400);
          expect(queueService.enqueue).not.toHaveBeenCalled();
          done();
        }
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.flush('Bad request', { status: 400, statusText: 'Bad Request' });
    });

    it('should NOT queue order on 401 Unauthorized', (done) => {
      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        () => fail('Should error'),
        (error) => {
          expect(error.status).toBe(401);
          expect(queueService.enqueue).not.toHaveBeenCalled();
          done();
        }
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });
    });

    it('should NOT queue order on 403 Forbidden', (done) => {
      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        () => fail('Should error'),
        (error) => {
          expect(error.status).toBe(403);
          expect(queueService.enqueue).not.toHaveBeenCalled();
          done();
        }
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });
    });

    it('should NOT queue order on 404 Not Found', (done) => {
      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        () => fail('Should error'),
        (error) => {
          expect(error.status).toBe(404);
          expect(queueService.enqueue).not.toHaveBeenCalled();
          done();
        }
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });
    });

    it('should NOT queue order on 422 Unprocessable Entity', (done) => {
      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        () => fail('Should error'),
        (error) => {
          expect(error.status).toBe(422);
          expect(queueService.enqueue).not.toHaveBeenCalled();
          done();
        }
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.flush('Unprocessable Entity', {
        status: 422,
        statusText: 'Unprocessable Entity',
      });
    });
  });

  describe('Synthetic Response', () => {
    it('should return synthetic 202 Accepted response when queueing', (done) => {
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe((response: any) => {
        expect(response.status).toBe(202);
        expect(response.statusText).toBe('Queued');
        expect(response.body.status).toBe('queued');
        expect(response.body.message).toContain('queued for sync');
        expect(response.body.orderId).toContain('queued-');
        done();
      });

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Network error'));
    });

    it('should preserve order data in synthetic response', (done) => {
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe((response: any) => {
        expect(response.body.items).toEqual(ORDER_PAYLOAD.items);
        expect(response.body.totalAmount).toBe(ORDER_PAYLOAD.totalAmount);
        expect(response.body.currency).toBe(ORDER_PAYLOAD.currency);
        expect(response.body.createdAt).toBeDefined();
        done();
      });

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Network error'));
    });

    it('should handle missing items in payload', (done) => {
      const payloadWithoutItems = { totalAmount: 10.0, currency: 'USD' };
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, payloadWithoutItems).subscribe((response: any) => {
        expect(response.body.items).toEqual([]);
        done();
      });

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('Queue Metadata', () => {
    it('should extract total and itemCount metadata', (done) => {
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      const payload = {
        items: [
          { productId: 'prod-1', quantity: 2, modifiers: [] },
          { productId: 'prod-2', quantity: 1, modifiers: [] },
        ],
        totalAmount: 25.5,
        currency: 'USD',
      };

      httpClient.post(ORDER_URL, payload).subscribe(() => {
        expect(queueService.enqueue).toHaveBeenCalledWith(
          payload,
          'pos-1',
          'tenant-1',
          {
            total: 25.5,
            itemCount: 2,
          }
        );
        done();
      });

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Network error'));
    });

    it('should handle payload with no items', (done) => {
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      const payload = { items: [], totalAmount: 10.0, currency: 'USD' };

      httpClient.post(ORDER_URL, payload).subscribe(() => {
        expect(queueService.enqueue).toHaveBeenCalledWith(
          payload,
          'pos-1',
          'tenant-1',
          {
            total: 10.0,
            itemCount: 0,
          }
        );
        done();
      });

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('URL Parsing', () => {
    it('should correctly extract tenantId and posId from URL', (done) => {
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(() => {
        expect(queueService.enqueue).toHaveBeenCalledWith(
          ORDER_PAYLOAD,
          'pos-1',
          'tenant-1',
          jasmine.any(Object)
        );
        done();
      });

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Network error'));
    });

    it('should handle different URL formats', (done) => {
      const customUrl =
        'http://api.example.com/api/tenants/TENANT-ABC-123/pos/POS-XYZ-789/orders';
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(customUrl, ORDER_PAYLOAD).subscribe(() => {
        expect(queueService.enqueue).toHaveBeenCalledWith(
          ORDER_PAYLOAD,
          'POS-XYZ-789',
          'TENANT-ABC-123',
          jasmine.any(Object)
        );
        done();
      });

      const req = httpMock.expectOne(customUrl);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('Toast Notification', () => {
    it('should show toast notification when order queued', (done) => {
      const mockToast = { present: jasmine.createSpy('present') };
      toastController.create.and.returnValue(
        Promise.resolve(mockToast as any)
      );
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(() => {
        // Give async operations time to complete
        setTimeout(() => {
          expect(toastController.create).toHaveBeenCalledWith(
            jasmine.objectContaining({
              message: jasmine.stringContaining('queued for sync'),
              position: 'bottom',
              color: 'warning',
            })
          );
          expect(mockToast.present).toHaveBeenCalled();
          done();
        }, 10);
      });

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Network error'));
    });

    it('should include dismiss button in toast', (done) => {
      const mockToast = { present: jasmine.createSpy('present') };
      toastController.create.and.returnValue(
        Promise.resolve(mockToast as any)
      );
      queueService.enqueue.and.returnValue(Promise.resolve('queue-1'));

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(() => {
        setTimeout(() => {
          const createCall = toastController.create.calls.mostRecent();
          const createArgs = createCall?.args[0] as any;
          expect(createArgs?.buttons).toBeDefined();
          const buttons = createArgs?.buttons as any[];
          expect(buttons?.[0]?.text).toBe('Dismiss');
          done();
        }, 10);
      });

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('Successful Requests', () => {
    it('should pass through successful order submissions', () => {
      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe((response: any) => {
        expect(response.orderId).toBe('order-123');
        expect(queueService.enqueue).not.toHaveBeenCalled();
      });

      const req = httpMock.expectOne(ORDER_URL);
      req.flush({ orderId: 'order-123' });
    });
  });

  describe('Queue Failure Handling', () => {
    it('should handle queue service enqueue failure gracefully', (done) => {
      queueService.enqueue.and.returnValue(
        Promise.reject(new Error('DB Error'))
      );

      httpClient.post(ORDER_URL, ORDER_PAYLOAD).subscribe(
        () => fail('Should error'),
        (error) => {
          expect(error).toBeDefined();
          done();
        }
      );

      const req = httpMock.expectOne(ORDER_URL);
      req.error(new ErrorEvent('Network error'));
    });
  });
});
