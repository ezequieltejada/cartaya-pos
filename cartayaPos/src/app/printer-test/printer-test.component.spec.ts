import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { Printer } from '../services/printer';
import { PrinterTestComponent } from './printer-test.component';

describe('PrinterTestComponent', () => {
  let component: PrinterTestComponent;
  let fixture: ComponentFixture<PrinterTestComponent>;
  let printer: jasmine.SpyObj<Printer>;

  beforeEach(async () => {
    printer = jasmine.createSpyObj<Printer>('Printer', ['scanForPrinters', 'selectPrinter'], {
      discoveredPrinters: [],
      selectedPrinter: null,
      selectedAddress: '',
      isScanning: false,
    });

    await TestBed.configureTestingModule({
      imports: [PrinterTestComponent],
      providers: [provideIonicAngular(), { provide: Printer, useValue: printer }],
    }).compileComponents();

    fixture = TestBed.createComponent(PrinterTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not enable printing until a printer is selected', () => {
    expect(component.isPrintButtonEnabled).toBeFalse();
  });

  it('should scan for printers through the Printer service', async () => {
    await component.scanForPrinters();

    expect(printer.scanForPrinters).toHaveBeenCalled();
  });
});
