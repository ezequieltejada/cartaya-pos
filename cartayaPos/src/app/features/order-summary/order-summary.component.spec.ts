import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { signal, WritableSignal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { OrderItem, SelectedModifier } from '../../models/order.model';
import { OrderService } from '../../core/services/order.service';
import { PosService } from '../../core/services/pos.service';
import { TenantService } from '../../core/services/tenant.service';
import { ProductService } from '../../core/services/product.service';
import { SettingsService } from '../../core/services/settings.service';
import { TranslateModule } from '@ngx-translate/core';
import { Printer } from '../../services/printer';
import { OrderSummaryComponent } from './order-summary.component';

describe('OrderSummaryComponent', () => {
  let component: OrderSummaryComponent;
  let fixture: ComponentFixture<OrderSummaryComponent>;
  let mockOrderService: jasmine.SpyObj<OrderService>;
  let orderItemsSig: WritableSignal<OrderItem[]>;
  let orderTotalSig: WritableSignal<number>;
  let itemCountSig: WritableSignal<number>;
  let hasItemsSig: WritableSignal<boolean>;
  let mockPosService: jasmine.SpyObj<PosService>;
  let mockTenantService: jasmine.SpyObj<TenantService>;
  let mockProductService: jasmine.SpyObj<ProductService>;
  let mockSettingsService: jasmine.SpyObj<SettingsService>;
  let mockPrinter: jasmine.SpyObj<Printer>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockToastController: jasmine.SpyObj<ToastController>;
  let mockAlertController: jasmine.SpyObj<AlertController>;
  let mockAlert: jasmine.SpyObj<HTMLIonAlertElement>;

  /** Makes the next alert resolve as if the user pressed the given button role */
  const userPresses = (role: string) =>
    mockAlert.onDidDismiss.and.returnValue(Promise.resolve({ role }));

  // Test data
  const mockOrderItems: OrderItem[] = [
    {
      id: 'item-1',
      productId: 'prod-1',
      productName: 'Burger',
      basePrice: 10.0,
      quantity: 1,
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
      quantity: 1,
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
    orderItemsSig = signal<OrderItem[]>([]);
    orderTotalSig = signal(0);
    itemCountSig = signal(0);
    hasItemsSig = signal(false);

    mockOrderService = jasmine.createSpyObj(
      'OrderService',
      ['addConfiguredProduct', 'removeItem', 'setItemQuantity', 'updateItemModifiers', 'clearOrder', 'submitOrder'],
      {
        orderItems: orderItemsSig,
        orderTotal: orderTotalSig,
        itemCount: itemCountSig,
        hasItems: hasItemsSig,
        isSubmitting: signal(false),
      }
    );

    mockPosService = jasmine.createSpyObj('PosService', ['getSelectedPos', 'clearSelection']);
    mockPosService.clearSelection.and.returnValue(Promise.resolve());
    mockPosService.getSelectedPos.and.returnValue({ id: 'pos-1' } as any);

    mockTenantService = jasmine.createSpyObj('TenantService', ['getCurrentTenantId']);
    mockTenantService.getCurrentTenantId.and.returnValue('tenant-1');

    mockSettingsService = jasmine.createSpyObj('SettingsService', ['loadTenantSettings'], {
      currency: signal('USD'),
    });

    mockProductService = jasmine.createSpyObj('ProductService', ['fetchProductsWithPrices']);
    mockProductService.fetchProductsWithPrices.and.returnValue(of([]));

    mockPrinter = jasmine.createSpyObj('Printer', [
      'scanForPrinters',
      'selectPrinter',
      'printSample',
      'printReceipt',
      'isUserManuallyDisconnected',
    ]);
    mockPrinter.selectedPrinter = null;
    mockPrinter.isUserManuallyDisconnected.and.returnValue(false);

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockRouter.navigate.and.returnValue(Promise.resolve(true));

    mockToastController = jasmine.createSpyObj('ToastController', ['create']);
    const mockToast = jasmine.createSpyObj('Toast', ['present']);
    mockToastController.create.and.returnValue(Promise.resolve(mockToast));

    mockAlertController = jasmine.createSpyObj('AlertController', ['create']);
    mockAlert = jasmine.createSpyObj('Alert', ['present', 'onDidDismiss']);
    mockAlert.present.and.returnValue(Promise.resolve());
    mockAlert.onDidDismiss.and.returnValue(Promise.resolve({ role: 'cancel' }));
    mockAlertController.create.and.returnValue(Promise.resolve(mockAlert));

    await TestBed.configureTestingModule({
      imports: [OrderSummaryComponent, TranslateModule.forRoot()],
      providers: [
        { provide: OrderService, useValue: mockOrderService },
        { provide: PosService, useValue: mockPosService },
        { provide: TenantService, useValue: mockTenantService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: ProductService, useValue: mockProductService },
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
      orderItemsSig.set(mockOrderItems);

      // Act
      const items = component.orderItems();

      // Assert
      expect(items).toEqual(mockOrderItems);
    });

    it('should compute orderTotal from OrderService', () => {
      // Setup
      const expectedTotal = 16.5;
      orderTotalSig.set(expectedTotal);

      // Act
      const total = component.orderTotal();

      // Assert
      expect(total).toEqual(expectedTotal);
    });

    it('should compute itemCount from OrderService', () => {
      // Setup
      itemCountSig.set(2);

      // Act
      const count = component.itemCount();

      // Assert
      expect(count).toEqual(2);
    });

    it('should compute hasItems from OrderService', () => {
      // Setup
      hasItemsSig.set(true);

      // Act
      const hasItems = component.hasItems();

      // Assert
      expect(hasItems).toEqual(true);
    });

    it('should compute isSubmitting from OrderService', () => {
      // Setup
      

      // Act
      const isSubmitting = component.isSubmitting();

      // Assert
      expect(isSubmitting).toEqual(false);
    });
  });

  describe('Cancel Order', () => {
    it('should show an Ionic confirmation alert', async () => {
      await component.showCancelConfirmation();

      expect(mockAlertController.create).toHaveBeenCalled();
      const alertConfig = (mockAlertController.create as jasmine.Spy).calls.mostRecent().args[0];
      expect(alertConfig.header).toBe('ORDER_SUMMARY.CANCEL_CONFIRMATION');
      expect(alertConfig.message).toBe('ORDER_SUMMARY.CANCEL_MESSAGE');
    });

    it('should keep the order when the user declines', async () => {
      userPresses('cancel');

      await component.showCancelConfirmation();

      expect(mockOrderService.clearOrder).not.toHaveBeenCalled();
    });

    it('should clear order and go to /products when the user accepts', async () => {
      userPresses('destructive');

      await component.showCancelConfirmation();

      expect(mockOrderService.clearOrder).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/products']);
    });
  });

  describe('Cash Order', () => {
    beforeEach(() => {
      orderTotalSig.set(16.5);
      orderItemsSig.set(mockOrderItems);
      userPresses('confirm');
    });

    /** Confirms the dialog and lets the async submit handlers finish */
    const confirmOrder = async () => {
      await component.showCashConfirmation();
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    it('should show confirmation with a summary using the tenant currency', async () => {
      userPresses('cancel');

      await component.showCashConfirmation();

      const alertConfig = (mockAlertController.create as jasmine.Spy).calls.mostRecent().args[0];
      expect(alertConfig.message).toContain('Burger');
      expect(alertConfig.message).toContain('16.50');
      expect(mockOrderService.submitOrder).not.toHaveBeenCalled();
    });

    it('should submit order on confirmation', async () => {
      mockOrderService.submitOrder.and.returnValue(of(mockSubmitOrderResponse));

      await confirmOrder();

      expect(mockOrderService.submitOrder).toHaveBeenCalledWith('pos-1', 'tenant-1');
    });

    it('should navigate to /products on successful order submission', async () => {
      mockOrderService.submitOrder.and.returnValue(of(mockSubmitOrderResponse));

      await confirmOrder();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/products']);
    });

    it('should navigate to /products even if receipt printing fails', async () => {
      mockOrderService.submitOrder.and.returnValue(of(mockSubmitOrderResponse));
      mockPrinter.selectedPrinter = { address: 'AA:BB:CC:DD:EE:FF', name: 'Kitchen Printer' };
      mockPrinter.printReceipt.and.returnValue(Promise.reject(new Error('Printer offline')));

      await confirmOrder();

      expect(mockRouter.navigate).toHaveBeenCalledWith(['/products']);
      expect(mockToastController.create).toHaveBeenCalled();
    });

    it('should attempt printing when a printer is selected', async () => {
      mockOrderService.submitOrder.and.returnValue(of(mockSubmitOrderResponse));
      mockPrinter.selectedPrinter = { address: 'AA:BB:CC:DD:EE:FF', name: 'Kitchen Printer' };
      mockPrinter.printReceipt.and.returnValue(Promise.resolve());

      await confirmOrder();

      expect(mockPrinter.printReceipt).toHaveBeenCalled();
    });

    it('should handle missing PoS or Tenant ID', async () => {
      mockPosService.getSelectedPos.and.returnValue(null);

      await confirmOrder();

      expect(mockToastController.create).toHaveBeenCalled();
      expect(mockOrderService.submitOrder).not.toHaveBeenCalled();
    });

    describe('rejected orders', () => {
      /** Lets the error alert be dismissed and returns the last alert config */
      const submitFailingWith = async (status: number, body: unknown = {}) => {
        mockOrderService.submitOrder.and.returnValue(
          throwError(() => new HttpErrorResponse({ status, error: body }))
        );
        await confirmOrder();
        const errorAlert = (mockAlertController.create as jasmine.Spy).calls
          .all()
          .map((c) => c.args[0])
          .find((cfg) => cfg.header === 'ORDER_SUMMARY.ERRORS.TITLE');
        return errorAlert;
      };

      it('should explain that the user is not assigned to the PoS and go back to PoS selection', async () => {
        const errorAlert = await submitFailingWith(403, { code: 'POS_NOT_ASSIGNED', message: 'English' });

        expect(errorAlert?.message).toBe('API_ERRORS.POS_NOT_ASSIGNED');
        expect(mockPosService.clearSelection).toHaveBeenCalled();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/pos-selection']);
        expect(mockOrderService.clearOrder).not.toHaveBeenCalled();
      });

      it('should explain the PoS no longer exists and go to PoS selection', async () => {
        const errorAlert = await submitFailingWith(404, { code: 'POS_NOT_FOUND' });

        expect(errorAlert?.message).toBe('API_ERRORS.POS_NOT_FOUND');
        expect(mockPosService.clearSelection).toHaveBeenCalled();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/pos-selection']);
        // The cart is kept
        expect(mockOrderService.clearOrder).not.toHaveBeenCalled();
      });

      it('should show a permissions message without leaving the screen on MISSING_PERMISSIONS', async () => {
        const errorAlert = await submitFailingWith(403, { code: 'MISSING_PERMISSIONS' });

        expect(errorAlert?.message).toBe('API_ERRORS.MISSING_PERMISSIONS');
        expect(mockPosService.clearSelection).not.toHaveBeenCalled();
      });

      it('should refresh prices on TOTAL_MISMATCH', async () => {
        await submitFailingWith(422, { code: 'TOTAL_MISMATCH' });

        expect(mockProductService.fetchProductsWithPrices).toHaveBeenCalledWith('tenant-1', true);
        expect(mockSettingsService.loadTenantSettings).toHaveBeenCalledWith('tenant-1');
      });

      it('should remove the rejected cart line using the productId param', async () => {
        orderItemsSig.set(mockOrderItems);
        const rejected = mockOrderItems[0];

        await submitFailingWith(404, { code: 'PRODUCT_NOT_FOUND', params: { productId: rejected.productId } });

        expect(mockOrderService.removeItem).toHaveBeenCalledWith(rejected.id as string);
      });

      it('should show UNKNOWN_ERROR for unknown codes and never queue/navigate', async () => {
        const errorAlert = await submitFailingWith(500, { code: 'WHATEVER', message: 'English' });

        expect(errorAlert?.message).toBe('API_ERRORS.UNKNOWN_ERROR');
        expect(mockRouter.navigate).not.toHaveBeenCalledWith(['/pos-selection']);
      });
    });
  });

  describe('Edit Item', () => {
    it('should navigate to modifiers page with item context', async () => {
      // Setup
      orderItemsSig.set(mockOrderItems);

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
      orderItemsSig.set(mockOrderItems);

      // Act
      await component.editItem('item-999');

      // Assert
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Remove Item', () => {
    beforeEach(() => {
      orderItemsSig.set(mockOrderItems);
    });

    it('should ask for confirmation and not remove when declined', async () => {
      userPresses('cancel');

      await component.removeItem('item-1');

      expect(mockAlertController.create).toHaveBeenCalled();
      expect(mockOrderService.removeItem).not.toHaveBeenCalled();
    });

    it('should remove the item and show a toast when confirmed', async () => {
      userPresses('destructive');

      await component.removeItem('item-1');

      expect(mockOrderService.removeItem).toHaveBeenCalledWith('item-1');
      expect(mockToastController.create).toHaveBeenCalled();
    });
  });

  describe('Quantity', () => {
    it('should increase the quantity of a line', () => {
      orderItemsSig.set(mockOrderItems);

      component.changeQuantity('item-1', 1);

      expect(mockOrderService.setItemQuantity).toHaveBeenCalledWith('item-1', 2);
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
   });

   describe('Modifier Pricing Calculation', () => {
     describe('calculateModifierCharge', () => {
       it('should calculate charge when selected quantity > included quantity', () => {
         // Setup: Jamon +€1.00, includedQuantity=1, user selected 3
         const modifier: SelectedModifier = {
           modifierId: 'mod-jamon',
           name: 'Jamon',
           priceDelta: 1.0,
           quantity: 3,
           includedQuantity: 1,
         };

         // Act
         const charge = component.calculateModifierCharge(modifier);

         // Assert
         // billableQuantity = max(0, 3 - 1) = 2
         // charge = 2 × €1.00 = €2.00
         expect(charge).toEqual(2.0);
       });

       it('should return 0 when selected quantity equals included quantity', () => {
         // Setup: Jamon +€1.00, includedQuantity=1, user selected 1
         const modifier: SelectedModifier = {
           modifierId: 'mod-jamon',
           name: 'Jamon',
           priceDelta: 1.0,
           quantity: 1,
           includedQuantity: 1,
         };

         // Act
         const charge = component.calculateModifierCharge(modifier);

         // Assert
         // billableQuantity = max(0, 1 - 1) = 0
         // charge = 0 × €1.00 = €0.00
         expect(charge).toEqual(0);
       });

       it('should return 0 when selected quantity < included quantity', () => {
         // Setup: Jamon +€1.00, includedQuantity=5, user selected 2
         const modifier: SelectedModifier = {
           modifierId: 'mod-jamon',
           name: 'Jamon',
           priceDelta: 1.0,
           quantity: 2,
           includedQuantity: 5,
         };

         // Act
         const charge = component.calculateModifierCharge(modifier);

         // Assert
         // billableQuantity = max(0, 2 - 5) = 0
         // charge = 0 × €1.00 = €0.00
         expect(charge).toEqual(0);
       });

       it('should handle negative price delta (discount)', () => {
         // Setup: Discount -€0.50, includedQuantity=0, user selected 2
         const modifier: SelectedModifier = {
           modifierId: 'mod-discount',
           name: 'Discount',
           priceDelta: -0.5,
           quantity: 2,
           includedQuantity: 0,
         };

         // Act
         const charge = component.calculateModifierCharge(modifier);

         // Assert
         // billableQuantity = max(0, 2 - 0) = 2
         // charge = 2 × (-€0.50) = -€1.00
         expect(charge).toEqual(-1.0);
       });

       it('should treat missing includedQuantity as 0', () => {
         // Setup: Modifier without includedQuantity
         const modifier: SelectedModifier = {
           modifierId: 'mod-cheese',
           name: 'Extra Cheese',
           priceDelta: 1.5,
           quantity: 2,
           // includedQuantity is undefined
         };

         // Act
         const charge = component.calculateModifierCharge(modifier);

         // Assert
         // billableQuantity = max(0, 2 - 0) = 2
         // charge = 2 × €1.50 = €3.00
         expect(charge).toEqual(3.0);
       });

       it('should handle zero quantity', () => {
         // Setup: User selected 0 (edge case)
         const modifier: SelectedModifier = {
           modifierId: 'mod-cheese',
           name: 'Extra Cheese',
           priceDelta: 1.5,
           quantity: 0,
           includedQuantity: 1,
         };

         // Act
         const charge = component.calculateModifierCharge(modifier);

         // Assert
         // billableQuantity = max(0, 0 - 1) = 0
         expect(charge).toEqual(0);
       });
     });

     describe('formatModifierPrice', () => {
       it('should return "(included)" when charge is 0', () => {
         // Setup: Modifier fully covered by includedQuantity
         const modifier: SelectedModifier = {
           modifierId: 'mod-jamon',
           name: 'Jamon',
           priceDelta: 1.0,
           quantity: 1,
           includedQuantity: 1,
         };

         // Act
         const formatted = component.formatModifierPrice(modifier);

         // Assert
         expect(formatted).toEqual('(included)');
       });

       it('should format positive charge with + sign and currency', () => {
         // Setup: Modifier with positive charge
         const modifier: SelectedModifier = {
           modifierId: 'mod-cheese',
           name: 'Extra Cheese',
           priceDelta: 1.5,
           quantity: 2,
           includedQuantity: 0,
         };

         // Act
         const formatted = component.formatModifierPrice(modifier);

         // Assert
         // charge = 2 × $1.50 = $3.00
         // With USD, should format as $3.00
         expect(formatted).toMatch(/\(\+\$3\.00\)/);
       });

       it('should format negative charge with - sign and currency', () => {
         // Setup: Discount modifier
         const modifier: SelectedModifier = {
           modifierId: 'mod-discount',
           name: 'Discount',
           priceDelta: -0.5,
           quantity: 2,
           includedQuantity: 0,
         };

         // Act
         const formatted = component.formatModifierPrice(modifier);

         // Assert
         // charge = 2 × (-$0.50) = -$1.00
         // Formatter should show -$1.00 with currency
         expect(formatted).toMatch(/\(-\$1\.00\)/);
       });

       it('should round to 2 decimal places', () => {
         // Setup: Modifier with fractional price
         const modifier: SelectedModifier = {
           modifierId: 'mod-special',
           name: 'Special',
           priceDelta: 1.234567,
           quantity: 2,
           includedQuantity: 0,
         };

         // Act
         const formatted = component.formatModifierPrice(modifier);

         // Assert
         // charge = 2 × $1.234567 = $2.469134 → $2.47
         expect(formatted).toMatch(/\(\+\$2\.47\)/);
       });

       it('should format zero charge as "(included)" not "+$0.00"', () => {
         // Setup: Modifier partially included
         const modifier: SelectedModifier = {
           modifierId: 'mod-sauce',
           name: 'Sauce',
           priceDelta: 0.5,
           quantity: 2,
           includedQuantity: 2,
         };

         // Act
         const formatted = component.formatModifierPrice(modifier);

         // Assert
         expect(formatted).toEqual('(included)');
       });

       it('should handle real-world scenario: Jamon with includedQuantity=1', () => {
         // Setup: Bug scenario - Sandwich €4.00, Jamon +€1.00, includedQuantity=1, user selected 1
         const modifier: SelectedModifier = {
           modifierId: 'mod-jamon',
           name: 'Jamon',
           priceDelta: 1.0,
           quantity: 1,
           includedQuantity: 1,
         };

         // Act
         const charge = component.calculateModifierCharge(modifier);
         const formatted = component.formatModifierPrice(modifier);

         // Assert
         // Expected: charge = 0 (no billable quantity)
         // Expected: display = "(included)"
         expect(charge).toEqual(0);
         expect(formatted).toEqual('(included)');
       });
     });
   });
 });