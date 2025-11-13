import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingController, ToastController } from '@ionic/angular/standalone';
import { NetworkService } from '../../core/services/network.service';
import { OrderQueueService } from '../../core/services/order-queue.service';
import { SyncCoordinatorService } from '../../core/services/sync-coordinator.service';
import { OrderQueuePage } from './order-queue.page';

describe('OrderQueuePage', () => {
  let component: OrderQueuePage;
  let fixture: ComponentFixture<OrderQueuePage>;
  let syncCoordinator: jasmine.SpyObj<SyncCoordinatorService>;
  let networkService: jasmine.SpyObj<NetworkService>;

  beforeEach(async () => {
    const queueServiceSpy = jasmine.createSpyObj('OrderQueueService', ['retryAll', 'retryOne', 'remove'], {
      totalQueueSize: jasmine.createSpy().and.returnValue(0),
      pendingCount: jasmine.createSpy().and.returnValue(0),
      outOfSyncCount: jasmine.createSpy().and.returnValue(0),
      queuedOrders: jasmine.createSpy().and.returnValue([]),
    });
    const syncCoordinatorSpy = jasmine.createSpyObj('SyncCoordinatorService', ['syncQueue'], {
      syncState: jasmine.createSpy().and.returnValue({ isSyncing: false, lastSyncAt: null, lastSyncResult: null }),
    });
    const networkServiceSpy = jasmine.createSpyObj('NetworkService', ['getIsOnline'], {
      isOnline: jasmine.createSpy().and.returnValue(true),
    });
    const loadingCtrlSpy = jasmine.createSpyObj('LoadingController', ['create']);
    const toastCtrlSpy = jasmine.createSpyObj('ToastController', ['create']);

    await TestBed.configureTestingModule({
      imports: [OrderQueuePage],
      providers: [
        { provide: OrderQueueService, useValue: queueServiceSpy },
        { provide: SyncCoordinatorService, useValue: syncCoordinatorSpy },
        { provide: NetworkService, useValue: networkServiceSpy },
        { provide: LoadingController, useValue: loadingCtrlSpy },
        { provide: ToastController, useValue: toastCtrlSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderQueuePage);
    component = fixture.componentInstance;
    syncCoordinator = TestBed.inject(SyncCoordinatorService) as jasmine.SpyObj<SyncCoordinatorService>;
    networkService = TestBed.inject(NetworkService) as jasmine.SpyObj<NetworkService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('getStatusColor', () => {
    it('should return warning for pending', () => {
      expect(component.getStatusColor('pending')).toBe('warning');
    });

    it('should return primary for syncing', () => {
      expect(component.getStatusColor('syncing')).toBe('primary');
    });

    it('should return danger for out-of-sync', () => {
      expect(component.getStatusColor('out-of-sync')).toBe('danger');
    });

    it('should return success for synced', () => {
      expect(component.getStatusColor('synced')).toBe('success');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date string', () => {
      const isoDate = '2025-11-13T12:00:00Z';
      const result = component.formatDate(isoDate);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('handleRefresh', () => {
    it('should call syncQueue when online', async () => {
      networkService.getIsOnline.and.returnValue(true);
      const event = { target: { complete: jasmine.createSpy('complete') } };

      await component.handleRefresh(event);

      expect(syncCoordinator.syncQueue).toHaveBeenCalled();
      expect(event.target.complete).toHaveBeenCalled();
    });

    it('should not call syncQueue when offline', async () => {
      networkService.getIsOnline.and.returnValue(false);
      const event = { target: { complete: jasmine.createSpy('complete') } };

      await component.handleRefresh(event);

      expect(syncCoordinator.syncQueue).not.toHaveBeenCalled();
      expect(event.target.complete).toHaveBeenCalled();
    });
  });
});
