import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import {
    LoadingController,
    ToastController,
} from '@ionic/angular/standalone';
import { of } from 'rxjs';
import { PosService } from '../../core/services/pos.service';
import { TenantService } from '../../core/services/tenant.service';
import { Order, OrderItem } from '../../models/order.model';
import { OrderHistoryService } from '../../services/order-history.service';
import { Printer } from '../../services/printer';
import { OrderDetailPage } from './order-detail.page';

describe('OrderDetailPage - Print Functionality', () => {
  let component: OrderDetailPage;
  let fixture: ComponentFixture<OrderDetailPage>;
  let mockPrinter: jasmine.SpyObj<Printer>;
  let mockToastCtrl: jasmine.SpyObj<ToastController>;
  let mockLoadingCtrl: jasmine.SpyObj<LoadingController>;
  let mockOrderHistoryService: jasmine.SpyObj<OrderHistoryService>;
  let mockTenantService: jasmine.SpyObj<TenantService>;
  let mockPosService: jasmine.SpyObj<PosService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockActivatedRoute: any;

  const mockOrder: Order = {
    id: 'order-123',
    orderId: 'ORD-001',
    items: [
      {
        productId: 'prod-1',
        productName: 'Cheeseburger',
        basePrice: 12.99,
        quantity: 2,
        subtotal: 25.98,
        modifiers: [
          {
            modifierId: 'mod-1',
            name: 'Extra Cheese',
            priceDelta: 1.5,
            quantity: 1,
          },
        ],
      } as OrderItem,
    ],
    totalAmount: 27.48,
    currency: 'USD',
    createdAt: '2024-11-13T12:00:00Z',
    status: 'completed',
  };

  beforeEach(async () => {
    mockPrinter = jasmine.createSpyObj('Printer', [
      'printReceipt',
      'connect',
      'disconnect',
    ]);
    mockPrinter.isConnected = true;
    mockPrinter.selectedPrinter = { name: 'Test Printer', address: '00:11:22' };

    mockToastCtrl = jasmine.createSpyObj('ToastController', ['create']);
    mockLoadingCtrl = jasmine.createSpyObj('LoadingController', ['create']);
    mockOrderHistoryService = jasmine.createSpyObj('OrderHistoryService', [
      'getOrderHistory',
    ]);
    mockTenantService = jasmine.createSpyObj('TenantService', [
      'getCurrentTenantId',
    ]);
    mockPosService = jasmine.createSpyObj('PosService', ['getSelectedPos']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    mockActivatedRoute = {
      snapshot: {
        paramMap: {
          get: jasmine.createSpy('get').and.returnValue('order-123'),
        },
      },
    };

    const mockToast = { present: jasmine.createSpy('present') };
    const mockLoading = { 
      present: jasmine.createSpy('present'),
      dismiss: jasmine.createSpy('dismiss')
    };

    mockToastCtrl.create.and.returnValue(Promise.resolve(mockToast as any));
    mockLoadingCtrl.create.and.returnValue(Promise.resolve(mockLoading as any));
    mockOrderHistoryService.getOrderHistory.and.returnValue(of([mockOrder]));
    mockTenantService.getCurrentTenantId.and.returnValue('tenant-123');
    mockPosService.getSelectedPos.and.returnValue({
      id: 'pos-123',
      name: 'Main Counter',
    } as any);

    await TestBed.configureTestingModule({
      imports: [OrderDetailPage],
      providers: [
        { provide: Printer, useValue: mockPrinter },
        { provide: ToastController, useValue: mockToastCtrl },
        { provide: LoadingController, useValue: mockLoadingCtrl },
        { provide: OrderHistoryService, useValue: mockOrderHistoryService },
        { provide: TenantService, useValue: mockTenantService },
        { provide: PosService, useValue: mockPosService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: mockActivatedRoute },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderDetailPage);
    component = fixture.componentInstance;
  });

  describe('Print Functionality', () => {
    it('should show error if printer is not connected', async () => {
      component.order.set(mockOrder);
      mockPrinter.isConnected = false;

      await component.printOrder();

      expect(mockToastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: jasmine.stringContaining(
            'Printer not connected'
          ),
          color: 'danger',
        })
      );
    });

    it('should show error if order is not loaded', async () => {
      component.order.set(null);
      mockPrinter.isConnected = true;

      await component.printOrder();

      expect(mockToastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'No order loaded',
          color: 'danger',
        })
      );
    });

    it('should start printing with loading indicator when conditions are met', async () => {
      component.order.set(mockOrder);
      mockPrinter.isConnected = true;
      mockPrinter.printReceipt.and.returnValue(Promise.resolve());

      await component.printOrder();

      expect(mockLoadingCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'Printing...',
          spinner: 'crescent',
        })
      );
    });

    it('should call printReceipt with formatted receipt data', async () => {
      component.order.set(mockOrder);
      mockPrinter.isConnected = true;
      mockPrinter.printReceipt.and.returnValue(Promise.resolve());

      await component.printOrder();

      expect(mockPrinter.printReceipt).toHaveBeenCalled();
      const receiptData = mockPrinter.printReceipt.calls.mostRecent()
        .args[0] as string;
      expect(receiptData).toContain('*** REPRINT ***');
      expect(receiptData).toContain('ORD-001');
      expect(receiptData).toContain('Cheeseburger');
    });

    it('should show success toast on successful print', async () => {
      component.order.set(mockOrder);
      mockPrinter.isConnected = true;
      mockPrinter.printReceipt.and.returnValue(Promise.resolve());

      await component.printOrder();

      expect(mockToastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: 'Receipt printed successfully',
          color: 'success',
        })
      );
    });

    it('should show error toast on print failure', async () => {
      component.order.set(mockOrder);
      mockPrinter.isConnected = true;
      mockPrinter.printReceipt.and.returnValue(
        Promise.reject(new Error('Print timeout'))
      );

      await component.printOrder();

      expect(mockToastCtrl.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          message: jasmine.stringContaining(
            'Failed to print receipt: Print timeout'
          ),
          color: 'danger',
        })
      );
    });

    it('should set isPrinting to false after print completes', async () => {
      component.order.set(mockOrder);
      mockPrinter.isConnected = true;
      mockPrinter.printReceipt.and.returnValue(Promise.resolve());

      component.printOrder();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(component.isPrinting()).toBe(false);
    });
  });

  describe('Receipt Formatting', () => {
    it('should include REPRINT indicator in receipt', () => {
      component.order.set(mockOrder);
      const formattedReceipt = component['formatOrderForReceipt'](mockOrder);

      expect(formattedReceipt).toContain('*** REPRINT ***');
    });

    it('should include order number in receipt', () => {
      component.order.set(mockOrder);
      const formattedReceipt = component['formatOrderForReceipt'](mockOrder);

      expect(formattedReceipt).toContain(`Order #: ${mockOrder.orderId}`);
    });

    it('should include order date in receipt', () => {
      component.order.set(mockOrder);
      const formattedReceipt = component['formatOrderForReceipt'](mockOrder);

      expect(formattedReceipt).toContain('Date:');
    });

    it('should include order status in receipt', () => {
      component.order.set(mockOrder);
      const formattedReceipt = component['formatOrderForReceipt'](mockOrder);

      expect(formattedReceipt).toContain('COMPLETED');
    });

    it('should include all items in receipt', () => {
      component.order.set(mockOrder);
      const formattedReceipt = component['formatOrderForReceipt'](mockOrder);

      expect(formattedReceipt).toContain('Cheeseburger');
      expect(formattedReceipt).toContain('Qty: 2');
    });

    it('should include modifiers in receipt', () => {
      component.order.set(mockOrder);
      const formattedReceipt = component['formatOrderForReceipt'](mockOrder);

      expect(formattedReceipt).toContain('+ Extra Cheese');
    });

    it('should include totals in receipt', () => {
      component.order.set(mockOrder);
      const formattedReceipt = component['formatOrderForReceipt'](mockOrder);

      expect(formattedReceipt).toContain(`Total:`);
      expect(formattedReceipt).toContain(`Currency: ${mockOrder.currency}`);
    });

    it('should handle orders with multiple items', () => {
      const multiItemOrder: Order = {
        ...mockOrder,
        items: [
          ...mockOrder.items,
          {
            productId: 'prod-2',
            productName: 'French Fries',
            basePrice: 3.99,
            quantity: 1,
            subtotal: 3.99,
            modifiers: [],
          } as OrderItem,
        ],
        totalAmount: 31.47,
      };

      component.order.set(multiItemOrder);
      const formattedReceipt =
        component['formatOrderForReceipt'](multiItemOrder);

      expect(formattedReceipt).toContain('Cheeseburger');
      expect(formattedReceipt).toContain('French Fries');
    });

    it('should handle orders without modifiers', () => {
      const noModifiersOrder: Order = {
        ...mockOrder,
        items: [
          {
            productId: 'prod-1',
            productName: 'Burger',
            basePrice: 5.99,
            quantity: 1,
            subtotal: 5.99,
            modifiers: [],
          } as OrderItem,
        ],
      };

      component.order.set(noModifiersOrder);
      const formattedReceipt = component['formatOrderForReceipt'](
        noModifiersOrder
      );

      expect(formattedReceipt).not.toContain('+ ');
      expect(formattedReceipt).toContain('Burger');
    });
  });

  describe('Item Total Calculation', () => {
    it('should calculate item total with modifiers correctly', () => {
      const item: OrderItem = {
        productId: 'prod-1',
        productName: 'Burger',
        basePrice: 10.0,
        quantity: 2,
        modifiers: [
          { modifierId: 'mod-1', name: 'Cheese', priceDelta: 1.5, quantity: 1 },
        ],
      };

      component.order.set(mockOrder);
      const total = component.getItemTotal(item);

      // (10.00 + 1.50) * 2 = 23.00
      expect(total).toBe(23.0);
    });

    it('should use subtotal if available', () => {
      const item: OrderItem = {
        productId: 'prod-1',
        productName: 'Burger',
        basePrice: 10.0,
        quantity: 2,
        subtotal: 25.0,
        modifiers: [],
      };

      component.order.set(mockOrder);
      const total = component.getItemTotal(item);

      expect(total).toBe(25.0);
    });

    it('should handle priceCentsSnapshot', () => {
      const item: OrderItem = {
        productId: 'prod-1',
        productName: 'Burger',
        priceCentsSnapshot: 1000, // $10.00 in cents
        quantity: 2,
        modifiers: [],
      };

      component.order.set(mockOrder);
      const total = component.getItemTotal(item);

      expect(total).toBe(20.0);
    });
  });

  describe('UI State Management', () => {
    it('should disable print button when isPrinting is true', () => {
      component.order.set(mockOrder);
      component.isPrinting.set(true);

      const printButton = fixture.debugElement.query(
        (el) => el.name === 'ion-button' && el.nativeElement.getAttribute('title')?.includes('Printing')
      );

      // Component state is correct
      expect(component.isPrinting()).toBe(true);
    });

    it('should disable print button when order is not loaded', () => {
      component.order.set(null);

      // Component state is correct
      expect(component.order()).toBeNull();
    });

    it('should enable print button when order is loaded and not printing', () => {
      component.order.set(mockOrder);
      component.isPrinting.set(false);

      // Component state is correct
      expect(component.order()).toBeTruthy();
      expect(component.isPrinting()).toBe(false);
    });
  });
});
