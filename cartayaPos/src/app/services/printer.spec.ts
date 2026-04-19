import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { App } from '@capacitor/app';
import { CapacitorThermalPrinter } from 'capacitor-thermal-printer';

import { Printer } from './printer';

describe('Printer', () => {
  let service: Printer;
  let addListenerSpy: jasmine.Spy;
  let appAddListenerSpy: jasmine.Spy;
  let builder: {
    align: jasmine.Spy;
    text: jasmine.Spy;
    qr: jasmine.Spy;
    cutPaper: jasmine.Spy;
    write: jasmine.Spy;
  };
  const eventHandlers = new Map<string, (payload?: unknown) => void>();
  const appEventHandlers = new Map<string, (payload?: unknown) => void>();

  beforeEach(async () => {
    localStorage.clear();
    eventHandlers.clear();
    appEventHandlers.clear();

    addListenerSpy = spyOn(CapacitorThermalPrinter, 'addListener').and.callFake(async (eventName, handler) => {
      eventHandlers.set(eventName, handler as (payload?: unknown) => void);
      return {
        remove: jasmine.createSpy(`remove-${eventName}`),
      } as never;
    });

    appAddListenerSpy = spyOn(App, 'addListener').and.callFake(async (eventName, handler) => {
      appEventHandlers.set(eventName, handler as (payload?: unknown) => void);
      return {
        remove: jasmine.createSpy(`remove-app-${eventName}`),
      } as never;
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(Printer);
    await (service as Printer & { connectionListenersReady: Promise<void> | null }).connectionListenersReady;
    await (service as Printer & { appStateListenerReady: Promise<void> | null }).appStateListenerReady;

    builder = {
      align: jasmine.createSpy('align'),
      text: jasmine.createSpy('text'),
      qr: jasmine.createSpy('qr'),
      cutPaper: jasmine.createSpy('cutPaper'),
      write: jasmine.createSpy('write').and.resolveTo(),
    };

    builder.align.and.callFake(() => builder);
    builder.text.and.callFake(() => builder);
    builder.qr.and.callFake(() => builder);
    builder.cutPaper.and.callFake(() => builder);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should register native printer connection listeners', () => {
    expect(addListenerSpy.calls.allArgs().map(([eventName]) => eventName)).toEqual(['connected', 'disconnected']);
  });

  it('should register an app resume listener', () => {
    expect(appAddListenerSpy).toHaveBeenCalledWith('appStateChange', jasmine.any(Function));
  });

  it('should reuse the current connection when printing a receipt', async () => {
    service.selectedPrinter = {
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    };
    service.selectedAddress = service.selectedPrinter.address;
    service.isConnected = true;

    spyOn(CapacitorThermalPrinter, 'isConnected').and.resolveTo(true);
    const connectSpy = spyOn(CapacitorThermalPrinter, 'connect').and.resolveTo(service.selectedPrinter);
    spyOn(CapacitorThermalPrinter, 'begin').and.returnValue(builder as never);

    await service.printReceipt('test receipt');

    expect(connectSpy).not.toHaveBeenCalled();
    expect(builder.text).toHaveBeenCalledWith('test receipt');
    expect(builder.write).toHaveBeenCalled();
  });

  it('should throw a descriptive error when the native connect returns null', async () => {
    service.selectedPrinter = {
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    };
    service.selectedAddress = service.selectedPrinter.address;

    spyOn(CapacitorThermalPrinter, 'connect').and.resolveTo(null);
    spyOn(service, 'ensureBluetoothPermissions').and.resolveTo(true);

    await expectAsync(service.printReceipt('test receipt')).toBeRejectedWithError(
      /Failed to connect to printer "Kitchen Printer" \(AA:BB:CC:DD:EE:FF\)/
    );
    expect(service.connectionError).toContain('Failed to connect to printer');
  });

  it('should report connected status when a selected printer is connected', () => {
    service.selectedPrinter = {
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    };
    service.isConnected = true;
    service.printerAvailable.set(true);

    expect(service.status()).toBe('connected');
  });

  it('should report found-not-connected status when a printer is selected but disconnected', () => {
    service.selectedPrinter = {
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    };
    service.isConnected = false;
    service.printerAvailable.set(true);

    expect(service.status()).toBe('found-not-connected');
  });

  it('should report not-found status when no printer is selected', () => {
    service.selectedPrinter = null;
    service.isConnected = false;
    service.printerAvailable.set(true);

    expect(service.status()).toBe('not-found');
  });

  it('should report not-found status when the selected printer becomes unavailable', () => {
    service.selectedPrinter = {
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    };
    service.isConnected = true;
    service.printerAvailable.set(false);

    expect(service.status()).toBe('not-found');
  });

  it('should restore a persisted printer as found-not-connected status', () => {
    localStorage.setItem('selected_printer', JSON.stringify({
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    }));

    service.loadPersistedPrinter();

    expect(service.selectedPrinter).toEqual({
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    });
    expect(service.status()).toBe('found-not-connected');
  });

  it('should update status when the native connected event fires', () => {
    const device = {
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    };

    eventHandlers.get('connected')?.(device);

    expect(service.selectedPrinter).toEqual(device);
    expect(service.selectedAddress).toBe(device.address);
    expect(service.isConnected).toBeTrue();
    expect(service.printerAvailable()).toBeTrue();
    expect(service.status()).toBe('connected');
  });

  it('should keep the selected printer and report found-not-connected when the native disconnected event fires', () => {
    service.selectedPrinter = {
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    };
    service.selectedAddress = service.selectedPrinter.address;
    service.isConnected = true;
    service.printerAvailable.set(true);
    service.connectionError = 'Previous error';

    eventHandlers.get('disconnected')?.();

    expect(service.selectedPrinter).toEqual({
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    });
    expect(service.selectedAddress).toBe('AA:BB:CC:DD:EE:FF');
    expect(service.isConnected).toBeFalse();
    expect(service.printerAvailable()).toBeTrue();
    expect(service.connectionError).toBeNull();
    expect(service.status()).toBe('found-not-connected');
  });

  it('should mark the printer as disconnected when the status poll detects a dropped connection', fakeAsync(() => {
    service.selectedPrinter = {
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    };
    service.selectedAddress = service.selectedPrinter.address;

    spyOn(CapacitorThermalPrinter, 'isConnected').and.resolveTo(false);

    service.isConnected = true;
    tick(2000);
    flushMicrotasks();

    expect(service.isConnected).toBeFalse();
    expect(service.status()).toBe('found-not-connected');
  }));

  it('should refresh connection status when the app resumes', fakeAsync(() => {
    service.selectedPrinter = {
      address: 'AA:BB:CC:DD:EE:FF',
      name: 'Kitchen Printer',
    };
    service.selectedAddress = service.selectedPrinter.address;
    service.isConnected = true;

    spyOn(CapacitorThermalPrinter, 'isConnected').and.resolveTo(false);

    appEventHandlers.get('appStateChange')?.({ isActive: true });
    flushMicrotasks();

    expect(service.isConnected).toBeFalse();
    expect(service.status()).toBe('found-not-connected');
  }));
});
