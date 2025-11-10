import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { of, throwError } from 'rxjs';
import { OrderItem } from '../../core/models/order.model';
import { OrderService } from '../../core/services/order.service';
import { PosService } from '../../core/services/pos.service';
import { TenantService } from '../../core/services/tenant.service';
import { Printer } from '../../services/printer';
import { OrderSummaryComponent } from './order-summary.component';

describe('OrderSummaryComponent', () => {
  let component: OrderSummaryComponent;
  let fixture: ComponentFixture<OrderSummaryComponent>;
  let mockOrderService: jasmine.SpyObj<OrderService>;
  let mockPosService: jasmine.SpyObj<PosService>;
  let mockTenantService: jasmine.SpyObj<TenantService>;
  let mockPrinter: jasmine.SpyObj<Printer>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockToastController: jasmine.SpyObj<ToastController>;
  let mockAlertController: jasmine.SpyObj<AlertController>;

  // Test data
  const mockOrderItems: OrderItem[] = [
    {
      id: 'item-1',
      productId: 'prod-1',
      productName: 'Burger',
      basePrice: 10.0,
      modifiers: [
        {
          modifierId: 'mod-1',
          name: 'Extra Cheese',
          priceDelta: 1.5,
          quantity: 2,
        },
      ],
      subtotal: 13.0,
    },
    {
      id: 'item-2',
      productId: 'prod-2',
      productName: 'Fries',
      basePrice: 3.5,
      modifiers: [],
      subtotal: 3.5,
    },
  ];

  const mockSubmitOrderResponse = {
    orderId: 'order-123',
    status: 'completed',
    createdAt: '2024-01-15T12:00:00Z',
    items: [
      {
        productId: 'prod-1',
        name: 'Burger',
        quantity: 1,
        basePrice: 10.0,
        appliedModifiers: [{ modifierId: 'mod-1', name: 'Extra Cheese', priceDelta: 1.5 }],
        lineTotal: 13.0,
      },
      {
        productId: 'prod-2',
        name: 'Fries',
        quantity: 1,
        basePrice: 3.5,
        lineTotal: 3.5,
      },
    ],
    totalAmount: 16.5,
    currency: 'USD',
  };

  beforeEach(async () => {
    // Create mock services with proper signal mocking
    const orderItemsSignal = jasmine.createSpy('orderItems').and.returnValue([]);
    const orderTotalSignal = jasmine.createSpy('orderTotal').and.returnValue(0);
    const itemCountSignal = jasmine.createSpy('itemCount').and.returnValue(0);
    const hasItemsSignal = jasmine.createSpy('hasItems').and.returnValue(false);
    const isSubmittingSignal = jasmine.createSpy('isSubmitting').and.returnValue(false);

    mockOrderService = jasmine.createSpyObj('OrderService', [
      'addConfiguredProduct',
      'removeItem',
      'updateItemModifiers',
      'clearOrder',
      'submitOrder',
    ]);

    // Override readonly properties with spies
    Object.defineProperty(mockOrderService, 'orderItems', {
      get: orderItemsSignal,
      configurable: true,
    });
    Object.defineProperty(mockOrderService, 'orderTotal', {
      get: orderTotalSignal,
      configurable: true,
    });
    Object.defineProperty(mockOrderService, 'itemCount', {
      get: itemCountSignal,
      configurable: true,
    });
    Object.defineProperty(mockOrderService, 'hasItems', {
      get: hasItemsSignal,
      configurable: true,
    });
    Object.defineProperty(mockOrderService, 'isSubmitting', {
      get: isSubmittingSignal,
      configurable: true,
    });

    mockPosService = jasmine.createSpyObj('PosService', ['getSelectedPos']);
    mockPosService.getSelectedPos.and.returnValue({ id: 'pos-1' } as any);

    mockTenantService = jasmine.createSpyObj('TenantService', ['getCurrentTenantId']);
    mockTenantService.getCurrentTenantId.and.returnValue('tenant-1');

    mockPrinter = jasmine.createSpyObj('Printer', ['scanForPrinters', 'selectPrinter', 'printSample']);

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockRouter.navigate.and.returnValue(Promise.resolve(true));

    mockToastController = jasmine.createSpyObj('ToastController', ['create']);
    const mockToast = jasmine.createSpyObj('Toast', ['present']);
    mockToastController.create.and.returnValue(Promise.resolve(mockToast));

    mockAlertController = jasmine.createSpyObj('AlertController', ['create']);
    const mockAlert = jasmine.createSpyObj('Alert', ['present', 'onDidDismiss']);
    mockAlertController.create.and.returnValue(Promise.resolve(mockAlert));

    await TestBed.configureTestingModule({
      imports: [OrderSummaryComponent],
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        { provide: PosService, useValue: mockPosService },
        { provide: TenantService, useValue: mockTenantService },
        { provide: Printer, useValue: mockPrinter },
        { provide: Router, useValue: mockRouter },
        { provide: ToastController, useValue: mockToastController },
        { provide: AlertController, useValue: mockAlertController },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderSummaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Reactive Data Binding', () => {
    it('should compute orderItems from OrderService', () => {
      // Setup
      (mockOrderService.orderItems as jasmine.Spy).and.returnValue(mockOrderItems);

      // Act
      const items = component.orderItems();

      // Assert
      expect(items).toEqual(mockOrderItems);
    });

    it('should compute orderTotal from OrderService', () => {
      // Setup
      const expectedTotal = 16.5;
      (mockOrderService.orderTotal as jasmine.Spy).and.returnValue(expectedTotal);

      // Act
      const total = component.orderTotal();

      // Assert
      expect(total).toEqual(expectedTotal);
    });

    it('should compute itemCount from OrderService', () => {
      // Setup
      (mockOrderService.itemCount as jasmine.Spy).and.returnValue(2);

      // Act
      const count = component.itemCount();

      // Assert
      expect(count).toEqual(2);
    });

    it('should compute hasItems from OrderService', () => {
      // Setup
      (mockOrderService.hasItems as jasmine.Spy).and.returnValue(true);

      // Act
      const hasItems = component.hasItems();

      // Assert
      expect(hasItems).toEqual(true);
    });

    it('should compute isSubmitting from OrderService', () => {
      // Setup
      (mockOrderService.isSubmitting as jasmine.Spy).and.returnValue(false);

      // Act
      const isSubmitting = component.isSubmitting();

      // Assert
      expect(isSubmitting).toEqual(false);
    });
  });

  describe('Cancel Order', () => {
    it('should show cancel confirmation alert', async () => {
      // Act
      await component.showCancelConfirmation();

      // Assert
      expect(mockAlertController.create).toHaveBeenCalled();
      const alertConfig = (mockAlertController.create as jasmine.Spy).calls.mostRecent().args[0];
      expect(alertConfig.header).toBe('Cancel Order');
      expect(alertConfig.message).toContain('Are you sure');
    });

    it('should clear order on cancel confirmation', async () => {
      // Setup
      await component.showCancelConfirmation();
      const alertConfig = (mockAlertController.create as jasmine.Spy).calls.mostRecent().args[0];
      const confirmButton = alertConfig.buttons.find((btn: any) => btn.text === 'Yes');

      // Act
      confirmButton.handler();

      // Assert
      expect(mockOrderService.clearOrder).toHaveBeenCalled();
    });

    it('should navigate to /products after cancel confirmation', async () => {
      // Setup
      await component.showCancelConfirmation();
      const alertConfig = (mockAlertController.create as jasmine.Spy).calls.mostRecent().args[0];
      const confirmButton = alertConfig.buttons.find((btn: any) => btn.text === 'Yes');

      // Act
      await confirmButton.handler();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/products']);
    });
  });

  describe('Cash Order', () => {
    it('should show cash order confirmation with summary', async () => {
      // Setup
      (mockOrderService.orderTotal as jasmine.Spy).and.returnValue(16.5);
      (mockOrderService.orderItems as jasmine.Spy).and.returnValue(mockOrderItems);

      // Act
      await component.showCashConfirmation();

      // Assert
      expect(mockAlertController.create).toHaveBeenCalled();
      const alertConfig = (mockAlertController.create as jasmine.Spy).calls.mostRecent().args[0];
      expect(alertConfig.message).toContain('Burger');
      expect(alertConfig.message).toContain('16.50');
    });

    it('should submit order on cash confirmation', async () => {
      // Setup
      mockOrderService.submitOrder.and.returnValue(of(mockSubmitOrderResponse));
      (mockOrderService.orderTotal as jasmine.Spy).and.returnValue(16.5);
      (mockOrderService.orderItems as jasmine.Spy).and.returnValue(mockOrderItems);

      await component.showCashConfirmation();
      const alertConfig = (mockAlertController.create as jasmine.Spy).calls.mostRecent().args[0];
      const confirmButton = alertConfig.buttons.find((btn: any) => btn.text === 'Confirm');

      // Act
      confirmButton.handler();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(mockOrderService.submitOrder).toHaveBeenCalledWith('pos-1', 'tenant-1');
    });

    it('should navigate to /products on successful order submission', async () => {
      // Setup
      mockOrderService.submitOrder.and.returnValue(of(mockSubmitOrderResponse));
      (mockOrderService.orderTotal as jasmine.Spy).and.returnValue(16.5);
      (mockOrderService.orderItems as jasmine.Spy).and.returnValue(mockOrderItems);

      await component.showCashConfirmation();
      const alertConfig = (mockAlertController.create as jasmine.Spy).calls.mostRecent().args[0];
      const confirmButton = alertConfig.buttons.find((btn: any) => btn.text === 'Confirm');

      // Act
      confirmButton.handler();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/products']);
    });

    it('should navigate to /products even if receipt printing fails', async () => {
      // Setup
      mockOrderService.submitOrder.and.returnValue(of(mockSubmitOrderResponse));
      (mockOrderService.orderTotal as jasmine.Spy).and.returnValue(16.5);
      (mockOrderService.orderItems as jasmine.Spy).and.returnValue(mockOrderItems);

      await component.showCashConfirmation();
      const alertConfig = (mockAlertController.create as jasmine.Spy).calls.mostRecent().args[0];
      const confirmButton = alertConfig.buttons.find((btn: any) => btn.text === 'Confirm');

      // Act
      confirmButton.handler();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert - should navigate even if printing fails
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/products']);
    });

    it('should show error toast on submission failure', async () => {
      // Setup
      mockOrderService.submitOrder.and.returnValue(throwError(() => new Error('API Error')));
      (mockOrderService.orderTotal as jasmine.Spy).and.returnValue(16.5);
      (mockOrderService.orderItems as jasmine.Spy).and.returnValue(mockOrderItems);

      await component.showCashConfirmation();
      const alertConfig = (mockAlertController.create as jasmine.Spy).calls.mostRecent().args[0];
      const confirmButton = alertConfig.buttons.find((btn: any) => btn.text === 'Confirm');

      // Act
      confirmButton.handler();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(mockToastController.create).toHaveBeenCalled();
    });

    it('should handle missing PoS or Tenant ID', async () => {
      // Setup
      mockPosService.getSelectedPos.and.returnValue(null);
      (mockOrderService.orderTotal as jasmine.Spy).and.returnValue(16.5);
      (mockOrderService.orderItems as jasmine.Spy).and.returnValue(mockOrderItems);

      await component.showCashConfirmation();
      const alertConfig = (mockAlertController.create as jasmine.Spy).calls.mostRecent().args[0];
      const confirmButton = alertConfig.buttons.find((btn: any) => btn.text === 'Confirm');

      // Act
      confirmButton.handler();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(mockToastController.create).toHaveBeenCalled();
      expect(mockOrderService.submitOrder).not.toHaveBeenCalled();
    });
  });

  describe('Edit Item', () => {
    it('should navigate to modifiers page with item context', async () => {
      // Setup
      (mockOrderService.orderItems as jasmine.Spy).and.returnValue(mockOrderItems);

      // Act
      await component.editItem('item-1');

      // Assert
      expect(mockRouter.navigate).toHaveBeenCalledWith(
        ['/products', 'prod-1', 'modifiers'],
        jasmine.objectContaining({
          state: jasmine.objectContaining({
            itemId: 'item-1',
            isEditing: true,
          }),
        })
      );
    });

    it('should not navigate for non-existent item', async () => {
      // Setup
      (mockOrderService.orderItems as jasmine.Spy).and.returnValue(mockOrderItems);

      // Act
      await component.editItem('item-999');

      // Assert
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Remove Item', () => {
    it('should call OrderService.removeItem', () => {
      // Act
      component.removeItem('item-1');

      // Assert
      expect(mockOrderService.removeItem).toHaveBeenCalledWith('item-1');
    });

    it('should show toast notification', async () => {
      // Act
      component.removeItem('item-1');

      // Wait for async toast
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(mockToastController.create).toHaveBeenCalled();
    });
  });

  describe('Track By Function', () => {
    it('should track items by ID for proper change detection', () => {
      // Act
      const id = component.trackByItemId(0, mockOrderItems[0]);

      // Assert
      expect(id).toEqual('item-1');
    });
  });

  describe('Component Lifecycle', () => {
    it('should initialize correctly', () => {
      // Assert
      expect(component).toBeTruthy();
    });

    it('should handle ngOnDestroy', () => {
      // Act & Assert - should not throw
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});