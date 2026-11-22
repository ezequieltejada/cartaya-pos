import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { NetworkService } from './network.service';
import { OrderPayload, OrderQueueService } from './order-queue.service';

const ORDER_URL = `${environment.apiUrl}/api/tenants/tenant-456/pos/pos-123/orders`;

/** Lets pending IndexedDB / promise work finish. */
const settle = (ms = 20) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function createMockOrderPayload(): OrderPayload {
  return {
    items: [{ productId: 'prod-123', quantity: 2, modifiers: [{ modifierId: 'mod-456', quantity: 1 }] }],
    totalAmount: 100,
    currency: 'USD',
  };
}

describe('OrderQueueService', () => {
  let service: OrderQueueService;
  let httpMock: HttpTestingController;
  let networkService: jasmine.SpyObj<NetworkService>;
  let scheduleRetrySpy: jasmine.Spy;

  /** Waits for the IndexedDB connection the constructor opens asynchronously. */
  async function waitForDb(): Promise<void> {
    const internals = service as unknown as { db: unknown };
    for (let i = 0; i < 100 && !internals.db; i++) {
      await settle(10);
    }
    expect(internals.db).withContext('IndexedDB should open').toBeTruthy();
    // The constructor also loads the persisted queue once the DB is open
    await settle(50);
  }

  /** Puts a queue entry into a given state without going through ten failed syncs. */
  async function seed(queueId: string, updates: Record<string, unknown>): Promise<void> {
    await (service as unknown as { updateOrder: (id: string, u: Record<string, unknown>) => Promise<void> })
      .updateOrder(queueId, updates);
  }

  /**
   * Runs a retry that needs one HTTP round trip: the service reads the queue
   * entry first, so give it a moment to issue the request before answering.
   */
  async function answerOrderRequest(
    action: Promise<unknown>,
    respond: (req: TestRequest) => void
  ): Promise<void> {
    respond(await nextOrderRequest());
    await action;
  }

  /** Waits (up to 2s) for the next order POST to reach the HTTP backend. */
  async function nextOrderRequest(): Promise<TestRequest> {
    for (let i = 0; i < 200; i++) {
      const [req] = httpMock.match(ORDER_URL);
      if (req) {
        return req;
      }
      await settle(10);
    }
    throw new Error('No order request was sent');
  }

  const originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;

  beforeEach(async () => {
    // Real IndexedDB writes can be slow on some browsers/CI machines
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
    const networkServiceSpy = jasmine.createSpyObj('NetworkService', ['getIsOnline']);
    networkServiceSpy.getIsOnline.and.returnValue(true);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        OrderQueueService,
        { provide: NetworkService, useValue: networkServiceSpy },
      ],
    });

    service = TestBed.inject(OrderQueueService);
    httpMock = TestBed.inject(HttpTestingController);
    networkService = TestBed.inject(NetworkService) as jasmine.SpyObj<NetworkService>;

    // Backoff timers would fire real requests after the test finished
    scheduleRetrySpy = spyOn(service as unknown as { scheduleRetry: () => void }, 'scheduleRetry');
    spyOn(console, 'log');
    spyOn(console, 'error');
    spyOn(console, 'warn');

    await waitForDb();
    await service.clearQueue();
  });

  afterEach(async () => {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
    httpMock.verify();
    await service.clearQueue().catch(() => undefined);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should start with an empty queue and zeroed counters', () => {
      expect(service.queuedOrders().length).toBe(0);
      expect(service.totalQueueSize()).toBe(0);
      expect(service.pendingCount()).toBe(0);
      expect(service.outOfSyncCount()).toBe(0);
    });
  });

  describe('enqueue()', () => {
    it('should add the order to the queue', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');

      expect(queueId).toBeTruthy();
      expect(service.queuedOrders().length).toBe(1);
      expect(service.totalQueueSize()).toBe(1);
    });

    it('should create the queue entry with the correct structure', async () => {
      const metadata = { orderNumber: 'ORD-001', total: 100 };
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456', metadata);

      const entry = service.getQueueEntry(queueId);
      expect(entry?.orderId).toBeNull();
      expect(entry?.posId).toBe('pos-123');
      expect(entry?.tenantId).toBe('tenant-456');
      expect(entry?.status).toBe('pending');
      expect(entry?.retryCount).toBe(0);
      expect(entry?.maxRetries).toBe(10);
      expect(entry?.metadata?.orderNumber).toBe('ORD-001');
    });

    it('should increment the pending count', async () => {
      await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');

      expect(service.pendingCount()).toBe(1);
    });

    it('should generate unique queue IDs', async () => {
      const payload = createMockOrderPayload();
      const ids = await Promise.all([
        service.enqueue(payload, 'pos-123', 'tenant-456'),
        service.enqueue(payload, 'pos-123', 'tenant-456'),
        service.enqueue(payload, 'pos-123', 'tenant-456'),
      ]);

      expect(new Set(ids).size).toBe(3);
    });
  });

  describe('getQueueEntry()', () => {
    it('should return the entry by ID', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');

      expect(service.getQueueEntry(queueId)?.id).toBe(queueId);
    });

    it('should return undefined for a non-existent ID', () => {
      expect(service.getQueueEntry('non-existent-id')).toBeUndefined();
    });
  });

  describe('remove()', () => {
    it('should remove the order from the queue and decrement the pending count', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');
      expect(service.pendingCount()).toBe(1);

      await service.remove(queueId);

      expect(service.queuedOrders().length).toBe(0);
      expect(service.getQueueEntry(queueId)).toBeUndefined();
      expect(service.pendingCount()).toBe(0);
    });
  });

  describe('clearQueue()', () => {
    it('should remove all orders and reset every computed signal', async () => {
      const payload = createMockOrderPayload();
      await Promise.all([
        service.enqueue(payload, 'pos-123', 'tenant-456'),
        service.enqueue(payload, 'pos-123', 'tenant-456'),
        service.enqueue(payload, 'pos-123', 'tenant-456'),
      ]);
      expect(service.queuedOrders().length).toBe(3);

      await service.clearQueue();

      expect(service.queuedOrders().length).toBe(0);
      expect(service.pendingCount()).toBe(0);
      expect(service.outOfSyncCount()).toBe(0);
      expect(service.totalQueueSize()).toBe(0);
    });
  });

  describe('retryOne()', () => {
    it('should remove the order from the queue on successful sync', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');

      const retry = service.retryOne(queueId);
      await answerOrderRequest(retry, (req) => {
        expect(req.request.method).toBe('POST');
        req.flush({ orderId: 'order-123' });
      });

      expect(await retry).toBeTrue();
      expect(service.getQueueEntry(queueId)).toBeUndefined();
      expect(service.queuedOrders().length).toBe(0);
    });

    it('should increment the retry count and keep the order pending on failure', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');

      const retry = service.retryOne(queueId);
      await answerOrderRequest(retry, (req) => req.error(new ProgressEvent('error')));

      expect(await retry).toBeFalse();
      const entry = service.getQueueEntry(queueId);
      expect(entry?.retryCount).toBe(1);
      expect(entry?.status).toBe('pending');
      expect(scheduleRetrySpy).toHaveBeenCalledWith(queueId, 1);
    });

    it('should update lastAttemptAt', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');
      const before = Date.now();

      const retry = service.retryOne(queueId);
      await answerOrderRequest(retry, (req) => req.error(new ProgressEvent('error')));

      const entry = service.getQueueEntry(queueId);
      expect(new Date(entry?.lastAttemptAt ?? '').getTime()).toBeGreaterThanOrEqual(before);
    });

    it('should store the error code and params instead of English text', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');

      const retry = service.retryOne(queueId);
      await answerOrderRequest(retry, (req) =>
        req.flush(
          { code: 'CURRENCY_MISMATCH', message: 'English text', params: { expected: 'EUR' } },
          { status: 422, statusText: 'Unprocessable Entity' }
        )
      );

      const entry = service.getQueueEntry(queueId);
      expect(entry?.errorCode).toBe('CURRENCY_MISMATCH');
      expect(entry?.errorParams).toEqual({ expected: 'EUR' });
      expect(entry?.error).toBeNull();
    });

    it('should store SERVER_UNREACHABLE when there is no response', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');

      const retry = service.retryOne(queueId);
      await answerOrderRequest(retry, (req) => req.error(new ProgressEvent('error')));

      expect(service.getQueueEntry(queueId)?.errorCode).toBe('SERVER_UNREACHABLE');
    });

    it('should mark the order out-of-sync on 401 without scheduling a retry', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');

      const retry = service.retryOne(queueId);
      await answerOrderRequest(retry, (req) =>
        req.flush({ code: 'SESSION_EXPIRED' }, { status: 401, statusText: 'Unauthorized' })
      );

      const entry = service.getQueueEntry(queueId);
      expect(entry?.status).toBe('out-of-sync');
      expect(entry?.errorCode).toBe('SESSION_EXPIRED');
      expect(scheduleRetrySpy).not.toHaveBeenCalled();
    });

    it('should mark the order out-of-sync after the maximum number of retries', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');

      await seed(queueId, { retryCount: 9 });

      const retry = service.retryOne(queueId);
      await answerOrderRequest(retry, (req) => req.error(new ProgressEvent('error')));

      const entry = service.getQueueEntry(queueId);
      expect(entry?.retryCount).toBe(10);
      expect(entry?.status).toBe('out-of-sync');
      expect(service.outOfSyncCount()).toBe(1);
    });

    it('should reject when the queue entry does not exist', async () => {
      await expectAsync(service.retryOne('non-existent-id')).toBeRejectedWithError(/not found/);
    });
  });

  describe('scheduleRetry()', () => {
    it('should retry with exponential backoff without blocking', () => {
      scheduleRetrySpy.and.callThrough();
      jasmine.clock().install();
      try {
        const retryOne = spyOn(service, 'retryOne').and.returnValue(Promise.resolve(true));

        (service as unknown as { scheduleRetry: (id: string, n: number) => void }).scheduleRetry('q-1', 3);

        jasmine.clock().tick(3999); // 1000 * 2^(3-1) = 4000ms
        expect(retryOne).not.toHaveBeenCalled();
        jasmine.clock().tick(1);
        expect(retryOne).toHaveBeenCalledWith('q-1');
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('should cap the delay at 16 seconds', () => {
      scheduleRetrySpy.and.callThrough();
      jasmine.clock().install();
      try {
        const retryOne = spyOn(service, 'retryOne').and.returnValue(Promise.resolve(true));

        (service as unknown as { scheduleRetry: (id: string, n: number) => void }).scheduleRetry('q-1', 9);

        jasmine.clock().tick(16000);
        expect(retryOne).toHaveBeenCalledWith('q-1');
      } finally {
        jasmine.clock().uninstall();
      }
    });
  });

  describe('processQueue() / retryAll()', () => {
    /** Answers the sequential order requests one by one. */
    async function answerAll(
      action: Promise<unknown>,
      responses: Array<(req: TestRequest) => void>
    ): Promise<void> {
      for (const respond of responses) {
        respond(await nextOrderRequest());
      }
      await action;
    }

    it('should return an empty result when offline', async () => {
      networkService.getIsOnline.and.returnValue(false);

      const result = await service.processQueue();

      expect(result).toEqual(jasmine.objectContaining({ total: 0, successful: 0, failed: 0 }));
    });

    it('should process all pending orders', async () => {
      const payload = createMockOrderPayload();
      await service.enqueue(payload, 'pos-123', 'tenant-456');
      await service.enqueue(payload, 'pos-123', 'tenant-456');

      const processing = service.processQueue();
      await answerAll(processing, [
        (req) => req.flush({ orderId: 'order-1' }),
        (req) => req.flush({ orderId: 'order-2' }),
      ]);

      const result = await processing;
      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(service.queuedOrders().length).toBe(0);
    });

    it('should track failures in the result', async () => {
      const payload = createMockOrderPayload();
      await service.enqueue(payload, 'pos-123', 'tenant-456');
      await service.enqueue(payload, 'pos-123', 'tenant-456');

      const processing = service.processQueue();
      await answerAll(processing, [
        (req) => req.error(new ProgressEvent('error')),
        (req) => req.flush({ orderId: 'order-2' }),
      ]);

      const result = await processing;
      expect(result.total).toBe(2);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(0); // Scheduled retries don't add to errors
    });

    it('should retry all queued orders', async () => {
      const payload = createMockOrderPayload();
      await service.enqueue(payload, 'pos-123', 'tenant-456');
      await service.enqueue(payload, 'pos-123', 'tenant-456');

      const retrying = service.retryAll();
      await answerAll(retrying, [
        (req) => req.flush({ orderId: 'order-1' }),
        (req) => req.flush({ orderId: 'order-2' }),
      ]);

      const result = await retrying;
      expect(result.total).toBe(2);
      expect(result.successful).toBe(2);
      expect(service.queuedOrders().length).toBe(0);
    });

    it('should reset out-of-sync orders (and their error) before retrying', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');
      await seed(queueId, { status: 'out-of-sync', retryCount: 10, errorCode: 'SERVER_UNREACHABLE' });
      expect(service.getQueueEntry(queueId)?.status).toBe('out-of-sync');
      expect(service.getQueueEntry(queueId)?.errorCode).toBe('SERVER_UNREACHABLE');

      const retrying = service.retryAll();
      await answerAll(retrying, [(req) => req.flush({ orderId: 'order-123' })]);

      await retrying;
      expect(service.getQueueEntry(queueId)).toBeUndefined(); // Removed after successful sync
    });
  });

  describe('Computed Signals', () => {
    it('should update totalQueueSize accurately', async () => {
      const payload = createMockOrderPayload();
      await service.enqueue(payload, 'pos-123', 'tenant-456');
      expect(service.totalQueueSize()).toBe(1);

      await service.enqueue(payload, 'pos-123', 'tenant-456');
      expect(service.totalQueueSize()).toBe(2);
    });

    it('should update outOfSyncCount when orders are marked out-of-sync', async () => {
      const queueId = await service.enqueue(createMockOrderPayload(), 'pos-123', 'tenant-456');
      expect(service.outOfSyncCount()).toBe(0);

      await seed(queueId, { status: 'out-of-sync', retryCount: 10 });

      expect(service.outOfSyncCount()).toBe(1);
      expect(service.pendingCount()).toBe(0);
    });
  });
});
