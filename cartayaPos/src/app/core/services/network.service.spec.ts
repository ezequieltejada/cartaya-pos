import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Platform } from '@ionic/angular';
import { NetworkService, NetworkStatus } from './network.service';

describe('NetworkService', () => {
  let service: NetworkService;
  let platformSpy: jasmine.SpyObj<Platform>;

  beforeEach(() => {
    const platformMock = jasmine.createSpyObj('Platform', ['is']);

    TestBed.configureTestingModule({
      providers: [NetworkService, { provide: Platform, useValue: platformMock }],
    });

    service = TestBed.inject(NetworkService);
    platformSpy = TestBed.inject(Platform) as jasmine.SpyObj<Platform>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Browser Environment', () => {
    beforeEach(() => {
      platformSpy.is.and.returnValue(false); // Not capacitor
    });

    it('should initialize with navigator.onLine state', () => {
      const expectedState = navigator.onLine;
      expect(service.getIsOnline()).toBe(expectedState);
    });

    it('should have isOnline signal as readonly', () => {
      const isOnlineSignal = service.isOnline;
      expect(isOnlineSignal).toBeDefined();
      expect(typeof isOnlineSignal()).toBe('boolean');
    });

    it('should have connectionType signal as readonly', () => {
      const connectionTypeSignal = service.connectionType;
      expect(connectionTypeSignal).toBeDefined();
      expect(['wifi', '4g', '3g', 'none', 'unknown']).toContain(
        connectionTypeSignal()
      );
    });

    it('should have networkQuality computed signal', () => {
      const networkQuality = service.networkQuality;
      expect(networkQuality).toBeDefined();
      expect(['offline', 'excellent', 'good', 'poor']).toContain(networkQuality());
    });

    it('should update isOnline signal to true on window online event', fakeAsync(() => {
      window.dispatchEvent(new Event('online'));
      tick();

      expect(service.getIsOnline()).toBe(true);
      expect(service.isOnline()).toBe(true);
    }));

    it('should update isOnline signal to false on window offline event', fakeAsync(() => {
      window.dispatchEvent(new Event('offline'));
      tick();

      expect(service.getIsOnline()).toBe(false);
      expect(service.isOnline()).toBe(false);
    }));

    it('should update connectionType to wifi on online event', fakeAsync(() => {
      window.dispatchEvent(new Event('online'));
      tick();

      expect(service.getConnectionType()).toBe('wifi');
    }));

    it('should update connectionType to none on offline event', fakeAsync(() => {
      window.dispatchEvent(new Event('offline'));
      tick();

      expect(service.getConnectionType()).toBe('none');
    }));
  });

  describe('Observable', () => {
    let onLine: jasmine.Spy;

    beforeEach(() => {
      platformSpy.is.and.returnValue(false);
      // The stream starts from navigator.onLine, so pin it for deterministic tests
      onLine = spyOnProperty(navigator, 'onLine', 'get');
    });

    it('should emit the initial state first', () => {
      onLine.and.returnValue(true);
      const statuses: NetworkStatus[] = [];

      const subscription = service.onNetworkChange().subscribe((status) => statuses.push(status));

      expect(statuses.length).toBe(1);
      expect(statuses[0].connected).toBeTrue();
      expect(statuses[0].connectionType).toBe('wifi');
      expect(statuses[0].timestamp).toBeDefined();
      subscription.unsubscribe();
    });

    it('should emit network status changes on online event', () => {
      onLine.and.returnValue(false);
      const statuses: NetworkStatus[] = [];
      const subscription = service.onNetworkChange().subscribe((status) => statuses.push(status));

      window.dispatchEvent(new Event('online'));

      expect(statuses.length).toBe(2);
      expect(statuses[0].connected).toBeFalse();
      expect(statuses[1].connected).toBeTrue();
      expect(statuses[1].connectionType).toBe('wifi');
      subscription.unsubscribe();
    });

    it('should emit network status changes on offline event', () => {
      onLine.and.returnValue(true);
      const statuses: NetworkStatus[] = [];
      const subscription = service.onNetworkChange().subscribe((status) => statuses.push(status));

      window.dispatchEvent(new Event('offline'));

      expect(statuses.length).toBe(2);
      expect(statuses[1].connected).toBeFalse();
      expect(statuses[1].connectionType).toBe('none');
      subscription.unsubscribe();
    });

    it('should have distinctUntilChanged behavior (no duplicate emissions)', () => {
      onLine.and.returnValue(true);
      let emittedCount = 0;
      const subscription = service.onNetworkChange().subscribe(() => emittedCount++);

      // Repeated offline events only change the state once
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('offline'));

      // Initial state + one change = 2 total
      expect(emittedCount).toBe(2);
      subscription.unsubscribe();
    });
  });

  describe('Network Quality', () => {
    beforeEach(() => {
      platformSpy.is.and.returnValue(false);
    });

    it('should return "offline" when not connected', fakeAsync(() => {
      window.dispatchEvent(new Event('offline'));
      tick();

      expect(service.networkQuality()).toBe('offline');
    }));

    it('should return "excellent" when online with wifi', fakeAsync(() => {
      window.dispatchEvent(new Event('online'));
      tick();

      expect(service.networkQuality()).toBe('excellent');
    }));
  });

  describe('checkNetworkStatus', () => {
    beforeEach(() => {
      platformSpy.is.and.returnValue(false);
    });

    it('should return current network status', fakeAsync(async () => {
      const status = await service.checkNetworkStatus();

      expect(status).toBeDefined();
      expect(status.connected).toBeDefined();
      expect(status.connectionType).toBeDefined();
      expect(status.timestamp).toBeDefined();
      expect(['wifi', 'none']).toContain(status.connectionType);
    }));

    it('should update isOnline signal when checking network', fakeAsync(async () => {
      await service.checkNetworkStatus();

      expect(service.getIsOnline()).toBe(navigator.onLine);
    }));
  });

  describe('Getter Methods', () => {
    beforeEach(() => {
      platformSpy.is.and.returnValue(false);
    });

    it('should return isOnline via getIsOnline method', () => {
      const result = service.getIsOnline();
      expect(typeof result).toBe('boolean');
      expect(result).toBe(navigator.onLine);
    });

    it('should return connectionType via getConnectionType method', () => {
      const result = service.getConnectionType();
      expect(['wifi', 'none', 'unknown']).toContain(result);
    });
  });

  describe('Signal Reactivity', () => {
    beforeEach(() => {
      platformSpy.is.and.returnValue(false);
    });

    it('isOnline signal should be reactive', fakeAsync(() => {
      window.dispatchEvent(new Event('online'));
      tick();
      const onlineState = service.isOnline();

      window.dispatchEvent(new Event('offline'));
      tick();
      const offlineState = service.isOnline();

      // States should be different as events changed them
      expect(onlineState).toBe(true);
      expect(offlineState).toBe(false);
    }));

    it('connectionType signal should update with isOnline', fakeAsync(() => {
      window.dispatchEvent(new Event('online'));
      tick();
      expect(service.connectionType()).toBe('wifi');

      window.dispatchEvent(new Event('offline'));
      tick();
      expect(service.connectionType()).toBe('none');
    }));

    it('networkQuality computed signal should update based on connection', fakeAsync(() => {
      window.dispatchEvent(new Event('online'));
      tick();
      expect(service.networkQuality()).toBe('excellent');

      window.dispatchEvent(new Event('offline'));
      tick();
      expect(service.networkQuality()).toBe('offline');
    }));
  });
});
