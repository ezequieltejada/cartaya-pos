import { TestBed } from '@angular/core/testing';
import { CapacitorThermalPrinter } from 'capacitor-thermal-printer';

import { Printer } from './printer';

describe('Printer', () => {
  let service: Printer;
  let builder: {
    align: jasmine.Spy;
    text: jasmine.Spy;
    qr: jasmine.Spy;
    cutPaper: jasmine.Spy;
    write: jasmine.Spy;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Printer);

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
});
