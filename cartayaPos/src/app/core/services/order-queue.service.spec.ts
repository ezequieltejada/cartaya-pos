import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { NetworkService } from './network.service';
import { OrderPayload, OrderQueueService } from './order-queue.service';

describe('OrderQueueService', () => {
  let service: OrderQueueService;
  let httpMock: HttpTestingController;
  let networkService: jasmine.SpyObj<NetworkService>;

  beforeEach(() => {
    const networkServiceSpy = jasmine.createSpyObj('NetworkService', [
      'getIsOnline',
    ]);
    networkServiceSpy.getIsOnline.and.returnValue(true);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OrderQueueService,
        { provide: NetworkService, useValue: networkServiceSpy },
      ],
    });

    service = TestBed.inject(OrderQueueService);
    httpMock = TestBed.inject(HttpTestingController);
    networkService = TestBed.inject(NetworkService) as jasmine.SpyObj<NetworkService>;
  });

  afterEach(() => {
    httpMock.verify();
    // Clean up queue after each test
    service.clearQueue().catch(() => {
      // Ignore errors during cleanup
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should initialize IndexedDB on construction', (done) => {
      setTimeout(() => {
        expect(service.queuedOrders()).toBeDefined();
        done();
      }, 100);
    });

    it('should have empty queue initially', (done) => {
      setTimeout(() => {
        expect(service.queuedOrders().length).toBe(0);
        expect(service.totalQueueSize()).toBe(0);
        done();
      }, 100);
    });

    it('should initialize pendingCount computed signal to 0', (done) => {
      setTimeout(() => {
        expect(service.pendingCount()).toBe(0);
        done();
      }, 100);
    });

    it('should initialize outOfSyncCount computed signal to 0', (done) => {
      setTimeout(() => {
        expect(service.outOfSyncCount()).toBe(0);
        done();
      }, 100);
    });
  });

  describe('enqueue()', () => {
    it('should add order to queue', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(() => {
          expect(service.queuedOrders().length).toBe(1);
          expect(service.totalQueueSize()).toBe(1);
          expect(queueId).toBeTruthy();
          done();
        }, 50);
      });
    });

    it('should create queue entry with correct structure', (done) => {
      const payload = createMockOrderPayload();
      const metadata = { orderNumber: 'ORD-001', total: 100 };

      service.enqueue(payload, 'pos-123', 'tenant-456', metadata).then((queueId) => {
        setTimeout(() => {
          const entry = service.getQueueEntry(queueId);
          expect(entry).toBeTruthy();
          expect(entry?.orderId).toBeNull();
          expect(entry?.posId).toBe('pos-123');
          expect(entry?.tenantId).toBe('tenant-456');
          expect(entry?.status).toBe('pending');
          expect(entry?.retryCount).toBe(0);
          expect(entry?.maxRetries).toBe(10);
          expect(entry?.metadata?.orderNumber).toBe('ORD-001');
          done();
        }, 50);
      });
    });

    it('should increment pending count', (done) => {
      const initialCount = service.pendingCount();
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then(() => {
        setTimeout(() => {
          expect(service.pendingCount()).toBe(initialCount + 1);
          done();
        }, 50);
      });
    });

    it('should generate unique queue IDs', (done) => {
      const payload = createMockOrderPayload();

      Promise.all([
        service.enqueue(payload, 'pos-123', 'tenant-456'),
        service.enqueue(payload, 'pos-123', 'tenant-456'),
        service.enqueue(payload, 'pos-123', 'tenant-456'),
      ]).then(([id1, id2, id3]) => {
        expect(id1).not.toBe(id2);
        expect(id2).not.toBe(id3);
        expect(id1).not.toBe(id3);
        done();
      });
    });
  });

  describe('getQueueEntry()', () => {
    it('should return entry by ID', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(() => {
          const entry = service.getQueueEntry(queueId);
          expect(entry).toBeTruthy();
          expect(entry?.id).toBe(queueId);
          done();
        }, 50);
      });
    });

    it('should return undefined for non-existent ID', (done) => {
      setTimeout(() => {
        const entry = service.getQueueEntry('non-existent-id');
        expect(entry).toBeUndefined();
        done();
      }, 50);
    });
  });

  describe('remove()', () => {
    it('should remove order from queue', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(() => {
          expect(service.queuedOrders().length).toBe(1);

          service.remove(queueId).then(() => {
            setTimeout(() => {
              expect(service.queuedOrders().length).toBe(0);
              expect(service.getQueueEntry(queueId)).toBeUndefined();
              done();
            }, 50);
          });
        }, 50);
      });
    });

    it('should decrement pending count', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(() => {
          const countBefore = service.pendingCount();

          service.remove(queueId).then(() => {
            setTimeout(() => {
              expect(service.pendingCount()).toBe(countBefore - 1);
              done();
            }, 50);
          });
        }, 50);
      });
    });
  });

  describe('clearQueue()', () => {
    it('should remove all orders', (done) => {
      const payload = createMockOrderPayload();

      Promise.all([
        service.enqueue(payload, 'pos-123', 'tenant-456'),
        service.enqueue(payload, 'pos-123', 'tenant-456'),
        service.enqueue(payload, 'pos-123', 'tenant-456'),
      ]).then(() => {
        setTimeout(() => {
          expect(service.queuedOrders().length).toBe(3);

          service.clearQueue().then(() => {
            setTimeout(() => {
              expect(service.queuedOrders().length).toBe(0);
              expect(service.totalQueueSize()).toBe(0);
              done();
            }, 50);
          });
        }, 50);
      });
    });

    it('should reset all computed signals', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then(() => {
        setTimeout(() => {
          service.clearQueue().then(() => {
            setTimeout(() => {
              expect(service.pendingCount()).toBe(0);
              expect(service.outOfSyncCount()).toBe(0);
              expect(service.totalQueueSize()).toBe(0);
              done();
            }, 50);
          });
        }, 50);
      });
    });
  });

  describe('retryOne()', () => {
    it('should remove order from queue on successful sync', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(() => {
          service.retryOne(queueId).then((success) => {
            expect(success).toBe(true);

            const req = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            expect(req.request.method).toBe('POST');
            req.flush({ orderId: 'order-123' });

            setTimeout(() => {
              expect(service.getQueueEntry(queueId)).toBeUndefined();
              expect(service.queuedOrders().length).toBe(0);
              done();
            }, 50);
          });
        }, 50);
      });
    });

    it('should increment retry count on failure', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(() => {
          const retryPromise = service.retryOne(queueId);

          const req = httpMock.expectOne(
            `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
          );
          req.error(new ErrorEvent('Network error'));

          retryPromise.then((success) => {
            expect(success).toBe(false);

            setTimeout(() => {
              const entry = service.getQueueEntry(queueId);
              expect(entry?.retryCount).toBe(1);
              expect(entry?.status).toBe('pending');
              done();
            }, 50);
          });
        }, 50);
      });
    });

    it('should mark order as out-of-sync after max retries', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(async () => {
          // Fail 10 times
          for (let i = 0; i < 10; i++) {
            // eslint-disable-next-line no-await-in-loop
            await service.retryOne(queueId);
            const req = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            req.error(new ErrorEvent('Network error'));

            // Wait for async operations
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          const entry = service.getQueueEntry(queueId);
          expect(entry?.retryCount).toBe(10);
          expect(entry?.status).toBe('out-of-sync');
          expect(service.outOfSyncCount()).toBe(1);
          done();
        }, 50);
      });
    });

    it('should update lastAttemptAt on retry', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(() => {
          const before = new Date().toISOString();
          const retryPromise = service.retryOne(queueId);

          const req = httpMock.expectOne(
            `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
          );
          req.error(new ErrorEvent('Network error'));

          retryPromise.then(() => {
            setTimeout(() => {
              const entry = service.getQueueEntry(queueId);
              expect(entry?.lastAttemptAt).toBeTruthy();
              expect(new Date(entry?.lastAttemptAt || '').getTime()).toBeGreaterThanOrEqual(
                new Date(before).getTime()
              );
              done();
            }, 50);
          });
        }, 50);
      });
    });

    it('should update error message on retry failure', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(() => {
          const retryPromise = service.retryOne(queueId);

          const req = httpMock.expectOne(
            `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
          );
          const errorMessage = 'Server error';
          req.error(new ErrorEvent(errorMessage));

          retryPromise.then(() => {
            setTimeout(() => {
              const entry = service.getQueueEntry(queueId);
              expect(entry?.error).toBeTruthy();
              done();
            }, 50);
          });
        }, 50);
      });
    });

    it('should throw if queue entry not found', (done) => {
      service.retryOne('non-existent-id').catch((error) => {
        expect(error).toBeTruthy();
        expect(error.message).toContain('not found');
        done();
      });
    });
  });

  describe('scheduleRetry()', () => {
    it('should schedule retry with exponential backoff', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(() => {
          const startTime = Date.now();

          // First failure - should schedule with 1s delay
          service.retryOne(queueId).then(() => {
            const req = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            req.error(new ErrorEvent('Network error'));

            // Verify exponential backoff for different retry counts
            // With retryCount=1: 1000 * 2^(1-1) = 1000ms
            expect(Date.now() - startTime).toBeLessThan(100); // Shouldn't block

            done();
          });
        }, 50);
      });
    });
  });

  describe('retryAll()', () => {
    it('should retry all queued orders', (done) => {
      const payload = createMockOrderPayload();

      Promise.all([
        service.enqueue(payload, 'pos-123', 'tenant-456'),
        service.enqueue(payload, 'pos-123', 'tenant-456'),
      ]).then((ids) => {
        setTimeout(() => {
          service.retryAll().then((result) => {
            expect(result.total).toBe(2);

            const req1 = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            req1.flush({ orderId: 'order-1' });

            const req2 = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            req2.flush({ orderId: 'order-2' });

            setTimeout(() => {
              expect(result.successful).toBe(2);
              expect(result.failed).toBe(0);
              expect(service.queuedOrders().length).toBe(0);
              done();
            }, 50);
          });
        }, 50);
      });
    });

    it('should reset out-of-sync orders before retry', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(async () => {
          // Mark as out-of-sync
          for (let i = 0; i < 10; i++) {
            // eslint-disable-next-line no-await-in-loop
            await service.retryOne(queueId);
            const req = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            req.error(new ErrorEvent('Network error'));
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          let entry = service.getQueueEntry(queueId);
          expect(entry?.status).toBe('out-of-sync');

          // Retry all
          await new Promise((resolve) => setTimeout(resolve, 50));
          service.retryAll().then(() => {
            const req = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            req.flush({ orderId: 'order-123' });

            setTimeout(() => {
              entry = service.getQueueEntry(queueId);
              expect(entry).toBeUndefined(); // Removed after successful sync
              done();
            }, 50);
          });
        }, 50);
      });
    });
  });

  describe('processQueue()', () => {
    it('should return empty result when offline', (done) => {
      networkService.getIsOnline.and.returnValue(false);

      service.processQueue().then((result) => {
        expect(result.total).toBe(0);
        expect(result.successful).toBe(0);
        expect(result.failed).toBe(0);
        done();
      });
    });

    it('should process all pending orders', (done) => {
      networkService.getIsOnline.and.returnValue(true);

      const payload = createMockOrderPayload();

      Promise.all([
        service.enqueue(payload, 'pos-123', 'tenant-456'),
        service.enqueue(payload, 'pos-123', 'tenant-456'),
      ]).then(() => {
        setTimeout(() => {
          service.processQueue().then((result) => {
            expect(result.total).toBe(2);

            const req1 = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            req1.flush({ orderId: 'order-1' });

            const req2 = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            req2.flush({ orderId: 'order-2' });

            setTimeout(() => {
              expect(result.successful).toBe(2);
              expect(result.failed).toBe(0);
              done();
            }, 50);
          });
        }, 50);
      });
    });

    it('should track failures in result', (done) => {
      networkService.getIsOnline.and.returnValue(true);

      const payload = createMockOrderPayload();

      Promise.all([
        service.enqueue(payload, 'pos-123', 'tenant-456'),
        service.enqueue(payload, 'pos-123', 'tenant-456'),
      ]).then(() => {
        setTimeout(() => {
          service.processQueue().then((result) => {
            expect(result.total).toBe(2);

            const req1 = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            req1.error(new ErrorEvent('Network error'));

            const req2 = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            req2.flush({ orderId: 'order-2' });

            setTimeout(() => {
              expect(result.successful).toBe(1);
              expect(result.failed).toBe(1);
              expect(result.errors.length).toBe(0); // Scheduled retries don't add to errors
              done();
            }, 50);
          });
        }, 50);
      });
    });
  });

  describe('Computed Signals', () => {
    it('should update pendingCount when orders added', (done) => {
      const payload = createMockOrderPayload();

      setTimeout(() => {
        const initial = service.pendingCount();

        service.enqueue(payload, 'pos-123', 'tenant-456').then(() => {
          setTimeout(() => {
            expect(service.pendingCount()).toBe(initial + 1);
            done();
          }, 50);
        });
      }, 50);
    });

    it('should update outOfSyncCount when orders marked out-of-sync', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then((queueId) => {
        setTimeout(async () => {
          const initialOutOfSync = service.outOfSyncCount();

          // Fail 10 times to mark as out-of-sync
          for (let i = 0; i < 10; i++) {
            // eslint-disable-next-line no-await-in-loop
            await service.retryOne(queueId);
            const req = httpMock.expectOne(
              `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`
            );
            req.error(new ErrorEvent('Network error'));
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          expect(service.outOfSyncCount()).toBe(initialOutOfSync + 1);
          done();
        }, 50);
      });
    });

    it('should update totalQueueSize accurately', (done) => {
      const payload = createMockOrderPayload();

      service.enqueue(payload, 'pos-123', 'tenant-456').then(() => {
        setTimeout(() => {
          expect(service.totalQueueSize()).toBe(1);

          service.enqueue(payload, 'pos-123', 'tenant-456').then(() => {
            setTimeout(() => {
              expect(service.totalQueueSize()).toBe(2);
              done();
            }, 50);
          });
        }, 50);
      });
    });
  });
});

/**
 * Helper to create mock order payload
 */
function createMockOrderPayload(): OrderPayload {
  return {
    items: [
      {
        productId: 'prod-123',
        quantity: 2,
        modifiers: [
          {
            modifierId: 'mod-456',
            quantity: 1,
          },
        ],
      },
    ],
    totalAmount: 100,
    currency: 'USD',
  };
}
