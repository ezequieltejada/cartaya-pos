import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Platform } from '@ionic/angular';
import { Subject } from 'rxjs';
import { NetworkService, NetworkStatus } from './network.service';
import { OrderQueueService, RetryResult } from './order-queue.service';
import { SyncCoordinatorService } from './sync-coordinator.service';

describe('SyncCoordinatorService', () => {
  let service: SyncCoordinatorService;
  let queueService: jasmine.SpyObj<OrderQueueService>;
  let networkService: jasmine.SpyObj<NetworkService>;
  let networkChanges$: Subject<NetworkStatus>;

  beforeEach(() => {
    networkChanges$ = new Subject<NetworkStatus>();

    const queueServiceSpy = jasmine.createSpyObj('OrderQueueService', [
      'processQueue',
      'pendingCount',
      'outOfSyncCount',
    ]);
    const networkServiceSpy = jasmine.createSpyObj('NetworkService', [
      'onNetworkChange',
      'getIsOnline',
      'checkNetworkStatus',
    ]);
    const platformSpy = jasmine.createSpyObj('Platform', ['is']);

    queueServiceSpy.pendingCount.and.returnValue(0);
    queueServiceSpy.outOfSyncCount.and.returnValue(0);
    networkServiceSpy.onNetworkChange.and.returnValue(networkChanges$.asObservable());
    networkServiceSpy.getIsOnline.and.returnValue(true);
    platformSpy.is.and.returnValue(false); // Not mobile by default

    TestBed.configureTestingModule({
      providers: [
        SyncCoordinatorService,
        { provide: OrderQueueService, useValue: queueServiceSpy },
        { provide: NetworkService, useValue: networkServiceSpy },
        { provide: Platform, useValue: platformSpy },
      ],
    });

    service = TestBed.inject(SyncCoordinatorService);
    queueService = TestBed.inject(OrderQueueService) as jasmine.SpyObj<OrderQueueService>;
    networkService = TestBed.inject(NetworkService) as jasmine.SpyObj<NetworkService>;
  });

  afterEach(() => {
    service.destroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize once', () => {
      service.initialize();
      service.initialize(); // Second call should be ignored
      expect(networkService.onNetworkChange).toHaveBeenCalledTimes(1);
    });

    it('should set up network listener', () => {
      service.initialize();
      expect(networkService.onNetworkChange).toHaveBeenCalled();
    });

    it('should not trigger initial sync if queue is empty', fakeAsync(() => {
      queueService.pendingCount.and.returnValue(0);
      queueService.outOfSyncCount.and.returnValue(0);

      service.initialize();
      tick();

      expect(queueService.processQueue).not.toHaveBeenCalled();
    }));

    it('should trigger initial sync if queue has pending items', fakeAsync(() => {
      queueService.pendingCount.and.returnValue(5);
      queueService.outOfSyncCount.and.returnValue(0);
      queueService.processQueue.and.returnValue(
        Promise.resolve({
          total: 5,
          successful: 5,
          failed: 0,
          errors: [],
        })
      );

      service.initialize();
      tick();

      expect(queueService.processQueue).toHaveBeenCalled();
    }));

    it('should not trigger initial sync if offline', fakeAsync(() => {
      networkService.getIsOnline.and.returnValue(false);
      queueService.pendingCount.and.returnValue(5);

      service.initialize();
      tick();

      expect(queueService.processQueue).not.toHaveBeenCalled();
    }));
  });

  describe('syncQueue()', () => {
    beforeEach(() => {
      service.initialize();
      queueService.pendingCount.and.returnValue(5);
      queueService.outOfSyncCount.and.returnValue(0);
      queueService.processQueue.and.returnValue(
        Promise.resolve({
          total: 5,
          successful: 5,
          failed: 0,
          errors: [],
        })
      );
    });

    it('should sync when online and queue has items', async () => {
      await service.syncQueue();
      expect(queueService.processQueue).toHaveBeenCalled();
    });

    it('should not sync when offline', async () => {
      networkService.getIsOnline.and.returnValue(false);
      await service.syncQueue();
      expect(queueService.processQueue).not.toHaveBeenCalled();
    });

    it('should not sync when queue is empty', async () => {
      queueService.pendingCount.and.returnValue(0);
      queueService.outOfSyncCount.and.returnValue(0);
      await service.syncQueue();
      expect(queueService.processQueue).not.toHaveBeenCalled();
    });

    it('should update sync state during sync', fakeAsync(() => {
      expect(service.isSyncing()).toBe(false);

      service.syncQueue();
      tick();

      expect(service.isSyncing()).toBe(true);

      tick(100); // Allow promise to resolve

      expect(service.isSyncing()).toBe(false);
    }));

    it('should store last sync result', async () => {
      await service.syncQueue();
      const result = service.getLastSyncResult();
      expect(result).toBeTruthy();
      expect(result?.successful).toBe(5);
    });

    it('should store last sync timestamp', async () => {
      await service.syncQueue();
      const timestamp = service.getLastSyncAt();
      expect(timestamp).toBeTruthy();
    });

    it('should not sync if already syncing', fakeAsync(() => {
      service.syncQueue();
      tick();

      expect(service.isSyncing()).toBe(true);

      // Try to sync again - should be skipped
      service.syncQueue();

      expect(queueService.processQueue).toHaveBeenCalledTimes(1);
    }));

    it('should handle sync errors', async () => {
      queueService.processQueue.and.returnValue(Promise.reject(new Error('Sync failed')));

      await service.syncQueue();

      const result = service.getLastSyncResult();
      expect(result).toBeTruthy();
    });
  });

  describe('network change listener', () => {
    beforeEach(() => {
      service.initialize();
      queueService.pendingCount.and.returnValue(5);
      queueService.outOfSyncCount.and.returnValue(0);
      queueService.processQueue.and.returnValue(
        Promise.resolve({
          total: 5,
          successful: 5,
          failed: 0,
          errors: [],
        })
      );
    });

    it('should trigger sync when network connected', fakeAsync(() => {
      networkChanges$.next({
        connected: true,
        connectionType: 'wifi',
        timestamp: new Date().toISOString(),
      });

      tick(2100); // Throttle delay + processing

      expect(queueService.processQueue).toHaveBeenCalled();
    }));

    it('should not trigger sync when network disconnected', fakeAsync(() => {
      networkChanges$.next({
        connected: false,
        connectionType: 'none',
        timestamp: new Date().toISOString(),
      });

      tick(2100);

      expect(queueService.processQueue).not.toHaveBeenCalled();
    }));

    it('should throttle network events', fakeAsync(() => {
      queueService.processQueue.calls.reset();

      // Send multiple connected events
      networkChanges$.next({
        connected: true,
        connectionType: 'wifi',
        timestamp: new Date().toISOString(),
      });
      tick(500);
      networkChanges$.next({
        connected: true,
        connectionType: 'wifi',
        timestamp: new Date().toISOString(),
      });
      tick(500);
      networkChanges$.next({
        connected: true,
        connectionType: 'wifi',
        timestamp: new Date().toISOString(),
      });

      tick(2100);

      // Should only process once due to throttle
      expect(queueService.processQueue).toHaveBeenCalledTimes(1);
    }));
  });

  describe('manualSync()', () => {
    beforeEach(() => {
      service.initialize();
      queueService.pendingCount.and.returnValue(3);
      queueService.outOfSyncCount.and.returnValue(0);
      queueService.processQueue.and.returnValue(
        Promise.resolve({
          total: 3,
          successful: 2,
          failed: 1,
          errors: [],
        })
      );
    });

    it('should return sync result', async () => {
      const result = await service.manualSync();
      expect(result.total).toBe(3);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('should return empty result if sync fails', async () => {
      queueService.processQueue.and.returnValue(Promise.reject(new Error('Failed')));

      const result = await service.manualSync();
      expect(result).toBeTruthy();
    });
  });

  describe('isSyncing()', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should return false initially', () => {
      expect(service.isSyncing()).toBe(false);
    });

    it('should return true during sync', fakeAsync(() => {
      queueService.pendingCount.and.returnValue(5);
      queueService.outOfSyncCount.and.returnValue(0);
      queueService.processQueue.and.returnValue(
        Promise.resolve({
          total: 5,
          successful: 5,
          failed: 0,
          errors: [],
        })
      );

      service.syncQueue();
      tick();

      expect(service.isSyncing()).toBe(true);
    }));
  });

  describe('getLastSyncResult()', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should return null initially', () => {
      expect(service.getLastSyncResult()).toBeNull();
    });

    it('should return result after sync', async () => {
      queueService.pendingCount.and.returnValue(5);
      queueService.outOfSyncCount.and.returnValue(0);
      const expectedResult: RetryResult = {
        total: 5,
        successful: 5,
        failed: 0,
        errors: [],
      };
      queueService.processQueue.and.returnValue(Promise.resolve(expectedResult));

      await service.syncQueue();

      expect(service.getLastSyncResult()).toEqual(expectedResult);
    });
  });

  describe('getLastSyncAt()', () => {
    beforeEach(() => {
      service.initialize();
    });

    it('should return null initially', () => {
      expect(service.getLastSyncAt()).toBeNull();
    });

    it('should return timestamp after sync', async () => {
      const before = new Date();

      queueService.pendingCount.and.returnValue(5);
      queueService.outOfSyncCount.and.returnValue(0);
      queueService.processQueue.and.returnValue(
        Promise.resolve({
          total: 5,
          successful: 5,
          failed: 0,
          errors: [],
        })
      );

      await service.syncQueue();
      const after = new Date();

      const timestamp = service.getLastSyncAt();
      expect(timestamp).toBeTruthy();

      const syncTime = new Date(timestamp!);
      expect(syncTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(syncTime.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('destroy()', () => {
    it('should clean up subscriptions', () => {
      service.initialize();
      expect(service.isSyncing).toBeDefined();

      service.destroy();
      expect(service.isSyncing()).toBe(false);
    });
  });

  describe('ngOnDestroy()', () => {
    it('should call destroy on component destruction', () => {
      spyOn(service, 'destroy');
      service.ngOnDestroy();
      expect(service.destroy).toHaveBeenCalled();
    });
  });

  describe('periodic sync', () => {
    it('should trigger periodic sync only when online and queue has items', fakeAsync(() => {
      service.initialize();
      queueService.pendingCount.and.returnValue(5);
      queueService.outOfSyncCount.and.returnValue(0);
      queueService.processQueue.and.returnValue(
        Promise.resolve({
          total: 5,
          successful: 5,
          failed: 0,
          errors: [],
        })
      );

      // Fast-forward 5 minutes
      tick(5 * 60 * 1000);

      expect(queueService.processQueue).toHaveBeenCalled();
    }));

    it('should not trigger periodic sync when offline', fakeAsync(() => {
      service.initialize();
      queueService.pendingCount.and.returnValue(5);
      queueService.outOfSyncCount.and.returnValue(0);
      networkService.getIsOnline.and.returnValue(false);

      // Fast-forward 5 minutes
      tick(5 * 60 * 1000);

      expect(queueService.processQueue).not.toHaveBeenCalled();
    }));

    it('should not trigger periodic sync when queue is empty', fakeAsync(() => {
      service.initialize();
      queueService.pendingCount.and.returnValue(0);
      queueService.outOfSyncCount.and.returnValue(0);

      // Fast-forward 5 minutes
      tick(5 * 60 * 1000);

      expect(queueService.processQueue).not.toHaveBeenCalled();
    }));
  });

  describe('sync state signal', () => {
    it('should update sync state signal', async () => {
      service.initialize();
      queueService.pendingCount.and.returnValue(5);
      queueService.outOfSyncCount.and.returnValue(0);
      queueService.processQueue.and.returnValue(
        Promise.resolve({
          total: 5,
          successful: 5,
          failed: 0,
          errors: [],
        })
      );

      const syncState = service.syncState();
      expect(syncState.isSyncing).toBe(false);
      expect(syncState.lastSyncAt).toBeNull();
      expect(syncState.lastSyncResult).toBeNull();

      await service.syncQueue();

      const updatedState = service.syncState();
      expect(updatedState.isSyncing).toBe(false);
      expect(updatedState.lastSyncAt).toBeTruthy();
      expect(updatedState.lastSyncResult).toBeTruthy();
    });
  });
});
