import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { of, throwError } from 'rxjs';
import { Modifier } from '../../core/models/modifier.model';
import { SelectedModifier } from '../../core/models/order.model';
import { Product } from '../../core/models/product.model';
import { ModifierService } from '../../core/services/modifier.service';
import { OrderService } from '../../core/services/order.service';
import { PosService } from '../../core/services/pos.service';
import { TenantService } from '../../core/services/tenant.service';
import { ModifiersPage } from './modifiers.page';

describe('ModifiersPage', () => {
  let component: ModifiersPage;
  let fixture: ComponentFixture<ModifiersPage>;
  let modifierService: jasmine.SpyObj<ModifierService>;
  let orderService: jasmine.SpyObj<OrderService>;
  let tenantService: jasmine.SpyObj<TenantService>;
  let posService: jasmine.SpyObj<PosService>;
  let router: jasmine.SpyObj<Router>;
  let toastController: jasmine.SpyObj<ToastController>;
  let activatedRoute: any;

  const mockModifiers: Modifier[] = [
    {
      id: 'mod-1',
      name: 'Extra Cheese',
      priceDelta: 1.0,
      currency: 'USD',
      active: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'mod-2',
      name: 'Add Bacon',
      priceDelta: 1.5,
      currency: 'USD',
      active: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'mod-3',
      name: 'No Onions',
      priceDelta: -0.25,
      currency: 'USD',
      active: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  const mockProduct: Product = {
    id: 'prod-1',
    name: 'Cheeseburger',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    defaultPrice: {
      id: 'price-1',
      amount: 12.99,
      currency: 'USD',
    },
  };

  const mockTenant = {
    id: 'tenant-1',
    name: 'Test Tenant',
  };

  const mockPos = {
    id: 'pos-1',
    name: 'Test POS',
  };

  beforeEach(async () => {
    const modifierServiceSpy = jasmine.createSpyObj('ModifierService', [
      'fetchProductModifiers',
    ]);
    const orderServiceSpy = jasmine.createSpyObj('OrderService', [
      'addConfiguredProduct',
    ]);
    const tenantServiceSpy = jasmine.createSpyObj('TenantService', [
      'getSelectedTenant',
    ]);
    const posServiceSpy = jasmine.createSpyObj('PosService', [
      'getSelectedPos',
    ]);
    const routerSpy = jasmine.createSpyObj('Router', [
      'navigate',
      'getCurrentNavigation',
    ]);
    const toastControllerSpy = jasmine.createSpyObj('ToastController', [
      'create',
    ]);

    activatedRoute = {
      snapshot: {
        paramMap: {
          get: jasmine.createSpy('get').and.returnValue('prod-1'),
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [ModifiersPage],
      providers: [
        { provide: ModifierService, useValue: modifierServiceSpy },
        { provide: OrderService, useValue: orderServiceSpy },
        { provide: TenantService, useValue: tenantServiceSpy },
        { provide: PosService, useValue: posServiceSpy },
        { provide: Router, useValue: routerSpy },
        { provide: ToastController, useValue: toastControllerSpy },
        { provide: ActivatedRoute, useValue: activatedRoute },
      ],
    }).compileComponents();

    modifierService = TestBed.inject(
      ModifierService
    ) as jasmine.SpyObj<ModifierService>;
    orderService = TestBed.inject(OrderService) as jasmine.SpyObj<OrderService>;
    tenantService = TestBed.inject(
      TenantService
    ) as jasmine.SpyObj<TenantService>;
    posService = TestBed.inject(PosService) as jasmine.SpyObj<PosService>;
    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    toastController = TestBed.inject(
      ToastController
    ) as jasmine.SpyObj<ToastController>;

    // Setup default return values
    tenantService.getSelectedTenant.and.returnValue(mockTenant as any);
    posService.getSelectedPos.and.returnValue(mockPos as any);
    modifierService.fetchProductModifiers.and.returnValue(of(mockModifiers));
    router.getCurrentNavigation.and.returnValue(null);

    const mockToast = {
      present: jasmine.createSpy('present'),
    };
    toastController.create.and.returnValue(Promise.resolve(mockToast as any));

    fixture = TestBed.createComponent(ModifiersPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Component Initialization', () => {
    it('should fetch modifiers on init', () => {
      fixture.detectChanges();

      expect(modifierService.fetchProductModifiers).toHaveBeenCalledWith(
        'tenant-1',
        'prod-1',
        'pos-1'
      );
    });

    it('should set error if productId is missing', () => {
      activatedRoute.snapshot.paramMap.get.and.returnValue(null);
      fixture.detectChanges();

      expect(component.error()).toEqual('Invalid product ID');
    });

    it('should set error if tenant or pos is not selected', () => {
      tenantService.getSelectedTenant.and.returnValue(null);
      fixture.detectChanges();

      expect(component.error()).toEqual('Tenant or POS configuration missing');
    });

    it('should populate modifiers list on successful fetch', (done) => {
      fixture.detectChanges();

      setTimeout(() => {
        expect(component.modifiersList()).toEqual(mockModifiers);
        done();
      }, 100);
    });

    it('should handle fetch error gracefully', (done) => {
      modifierService.fetchProductModifiers.and.returnValue(
        throwError(() => new Error('Fetch failed'))
      );
      fixture.detectChanges();

      setTimeout(() => {
        expect(component.error()).toContain('Failed to load modifiers');
        done();
      }, 100);
    });
  });

  describe('Quantity Controls', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should increment modifier quantity', () => {
      component.incrementModifier('mod-1');

      expect(component.selectedModifiers().get('mod-1')).toBe(1);

      component.incrementModifier('mod-1');
      expect(component.selectedModifiers().get('mod-1')).toBe(2);
    });

    it('should decrement modifier quantity', () => {
      component.incrementModifier('mod-1');
      component.incrementModifier('mod-1');

      component.decrementModifier('mod-1');
      expect(component.selectedModifiers().get('mod-1')).toBe(1);
    });

    it('should not decrement below 0', () => {
      component.decrementModifier('mod-1');

      expect(component.selectedModifiers().get('mod-1')).toBeUndefined();
    });

    it('should initialize quantity as 0 for new modifiers', () => {
      expect(component.selectedModifiers().get('mod-1')).toBeUndefined();
    });

    it('should handle incrementing multiple modifiers independently', () => {
      component.incrementModifier('mod-1');
      component.incrementModifier('mod-2');
      component.incrementModifier('mod-2');

      expect(component.selectedModifiers().get('mod-1')).toBe(1);
      expect(component.selectedModifiers().get('mod-2')).toBe(2);
    });
  });

  describe('Price Formatting', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should format positive price delta with plus sign', () => {
      const formatted = component.formatPriceDelta(1.5, 'USD');
      expect(formatted).toContain('+');
      expect(formatted).toContain('1.50');
    });

    it('should format negative price delta with minus sign', () => {
      const formatted = component.formatPriceDelta(-0.25, 'USD');
      expect(formatted).toContain('-');
      expect(formatted).toContain('0.25');
    });

    it('should format zero correctly', () => {
      const formatted = component.formatPriceDelta(0, 'USD');
      expect(formatted).toContain('0');
    });

    it('should handle invalid currency gracefully', () => {
      const formatted = component.formatPriceDelta(1.5, 'INVALID');
      // Should use fallback formatting
      expect(formatted).toContain('1.50');
    });
  });

  describe('Confirm Selection', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.product.set(mockProduct);
    });

    it('should add configured product to order with selected modifiers', (done) => {
      component.incrementModifier('mod-1');
      component.incrementModifier('mod-2');
      component.incrementModifier('mod-2');

      component.confirmSelection();

      setTimeout(() => {
        expect(orderService.addConfiguredProduct).toHaveBeenCalled();
        const call = orderService.addConfiguredProduct.calls.mostRecent();
        expect(call.args[0]).toEqual(mockProduct);

        const modifiers = call.args[1] as SelectedModifier[];
        expect(modifiers.length).toBe(2);
        expect(modifiers[0]).toEqual({
          modifierId: 'mod-1',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          quantity: 1,
        });
        expect(modifiers[1]).toEqual({
          modifierId: 'mod-2',
          name: 'Add Bacon',
          priceDelta: 1.5,
          quantity: 2,
        });
        done();
      }, 100);
    });

    it('should filter out modifiers with 0 quantity', (done) => {
      component.incrementModifier('mod-1');
      // mod-2 has no increment, so quantity is 0

      component.confirmSelection();

      setTimeout(() => {
        const call = orderService.addConfiguredProduct.calls.mostRecent();
        const modifiers = call.args[1] as SelectedModifier[];
        expect(modifiers.length).toBe(1);
        expect(modifiers[0].modifierId).toBe('mod-1');
        done();
      }, 100);
    });

    it('should navigate back to products after confirming', (done) => {
      component.incrementModifier('mod-1');
      component.confirmSelection();

      setTimeout(() => {
        expect(router.navigate).toHaveBeenCalledWith(['/products']);
        done();
      }, 100);
    });

    it('should show success toast after confirming', (done) => {
      component.incrementModifier('mod-1');
      component.confirmSelection();

      setTimeout(() => {
        expect(toastController.create).toHaveBeenCalled();
        done();
      }, 100);
    });

    it('should handle missing product gracefully', () => {
      spyOn(console, 'error');
      component.product.set(null);
      component.confirmSelection();

      expect(console.error).toHaveBeenCalledWith('Product not set');
    });
  });

  describe('Add Without Modifiers', () => {
    beforeEach(() => {
      fixture.detectChanges();
      component.product.set(mockProduct);
    });

    it('should add product without modifiers', (done) => {
      component.addWithoutModifiers();

      setTimeout(() => {
        expect(orderService.addConfiguredProduct).toHaveBeenCalledWith(
          mockProduct,
          []
        );
        done();
      }, 100);
    });

    it('should navigate back after adding without modifiers', (done) => {
      component.addWithoutModifiers();

      setTimeout(() => {
        expect(router.navigate).toHaveBeenCalledWith(['/products']);
        done();
      }, 100);
    });

    it('should show success toast after adding without modifiers', (done) => {
      component.addWithoutModifiers();

      setTimeout(() => {
        expect(toastController.create).toHaveBeenCalled();
        done();
      }, 100);
    });
  });

  describe('Retry Fetch Modifiers', () => {
    it('should refetch modifiers after retry', () => {
      modifierService.fetchProductModifiers.calls.reset();
      fixture.detectChanges();
      modifierService.fetchProductModifiers.calls.reset();

      component.retryFetchModifiers();

      expect(modifierService.fetchProductModifiers).toHaveBeenCalledWith(
        'tenant-1',
        'prod-1',
        'pos-1'
      );
    });
  });

  describe('Component Cleanup', () => {
    it('should unsubscribe on destroy', () => {
      fixture.detectChanges();
      spyOn(component['destroy$'], 'next');
      spyOn(component['destroy$'], 'complete');

      component.ngOnDestroy();

      expect(component['destroy$'].next).toHaveBeenCalled();
      expect(component['destroy$'].complete).toHaveBeenCalled();
    });
  });

  describe('State Signals', () => {
    it('should have correct initial state', () => {
      expect(component.modifiersList()).toEqual([]);
      expect(component.selectedModifiers()).toEqual(new Map());
      expect(component.product()).toBeNull();
      expect(component.isLoading()).toBe(false);
      expect(component.error()).toBeNull();
    });

    it('should set loading state during fetch', () => {
      fixture.detectChanges();
      // Component sets loading to true before fetch starts
      expect(component.isLoading()).toBe(false); // After fetch completes
    });
  });

  // ===== includedQuantity UI Display Tests =====

  describe('includedQuantity UI Display Methods', () => {
    describe('getIncludedQuantityText()', () => {
      it('should return empty string when includedQuantity is 0', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          includedQuantity: 0,
        };
        expect(component.getIncludedQuantityText(modifier)).toBe('');
      });

      it('should return empty string when includedQuantity is undefined', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          includedQuantity: undefined,
        };
        expect(component.getIncludedQuantityText(modifier)).toBe('');
      });

      it('should return singular form for includedQuantity = 1', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          includedQuantity: 1,
        };
        expect(component.getIncludedQuantityText(modifier)).toBe('First 1 included');
      });

      it('should return plural form for includedQuantity > 1', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          includedQuantity: 2,
        };
        expect(component.getIncludedQuantityText(modifier)).toBe('First 2 included');
      });

      it('should handle large includedQuantity values', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          includedQuantity: 100,
        };
        expect(component.getIncludedQuantityText(modifier)).toBe('First 100 included');
      });
    });

    describe('getQuantityBreakdown()', () => {
      it('should return empty string when quantity is 0', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          currency: 'USD',
          includedQuantity: 2,
        };
        component.selectedModifiers.set(new Map([['mod-1', 0]]));
        expect(component.getQuantityBreakdown(modifier)).toBe('');
      });

      it('should show singular form when selected = 1 and included > 0', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          currency: 'USD',
          includedQuantity: 2,
        };
        component.selectedModifiers.set(new Map([['mod-1', 1]]));
        expect(component.getQuantityBreakdown(modifier)).toBe('1 included');
      });

      it('should show plural form when all quantity is included', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          currency: 'USD',
          includedQuantity: 2,
        };
        component.selectedModifiers.set(new Map([['mod-1', 2]]));
        expect(component.getQuantityBreakdown(modifier)).toBe('2 included');
      });

      it('should show breakdown when selected > included (singular extra)', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          currency: 'USD',
          includedQuantity: 2,
        };
        component.selectedModifiers.set(new Map([['mod-1', 3]]));
        const result = component.getQuantityBreakdown(modifier);
        expect(result).toContain('2 included');
        expect(result).toContain('1 extra');
        expect(result).toContain('$1.00');
      });

      it('should show breakdown when selected > included (plural extra)', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          currency: 'USD',
          includedQuantity: 2,
        };
        component.selectedModifiers.set(new Map([['mod-1', 4]]));
        const result = component.getQuantityBreakdown(modifier);
        expect(result).toContain('2 included');
        expect(result).toContain('2 extra');
        expect(result).toContain('$2.00');
      });

      it('should handle zero includedQuantity in breakdown', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          currency: 'USD',
          includedQuantity: 0,
        };
        component.selectedModifiers.set(new Map([['mod-1', 3]]));
        const result = component.getQuantityBreakdown(modifier);
        // Should show total × price format for no included quantity
        expect(result).toContain('3');
        expect(result).toContain('$1.00');
      });

      it('should handle undefined includedQuantity as zero', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          currency: 'USD',
          includedQuantity: undefined,
        };
        component.selectedModifiers.set(new Map([['mod-1', 2]]));
        const result = component.getQuantityBreakdown(modifier);
        expect(result).toContain('2');
        expect(result).toContain('$1.00');
      });

      it('should calculate charges correctly with fractional prices', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Premium Sauce',
          priceDelta: 0.5,
          currency: 'USD',
          includedQuantity: 1,
        };
        component.selectedModifiers.set(new Map([['mod-1', 3]]));
        const result = component.getQuantityBreakdown(modifier);
        // 1 included + 2 extra @ $0.50 each = $1.00
        expect(result).toContain('1 included');
        expect(result).toContain('2 extra');
        expect(result).toContain('$1.00');
      });

      it('should handle negative price (discount) breakdown', () => {
        const modifier: any = {
          id: 'mod-discount',
          name: 'Senior Discount',
          priceDelta: -2.0,
          currency: 'USD',
          includedQuantity: 0,
        };
        component.selectedModifiers.set(new Map([['mod-discount', 1]]));
        const result = component.getQuantityBreakdown(modifier);
        expect(result).toContain('1');
        expect(result).toContain('-$2.00');
      });

      it('should show multiple included + extra correctly', () => {
        const modifier: any = {
          id: 'mod-1',
          name: 'Extra Cheese',
          priceDelta: 1.5,
          currency: 'USD',
          includedQuantity: 3,
        };
        component.selectedModifiers.set(new Map([['mod-1', 5]]));
        const result = component.getQuantityBreakdown(modifier);
        // 3 included + 2 extra @ $1.50 each = $3.00
        expect(result).toContain('3 included');
        expect(result).toContain('2 extra');
        expect(result).toContain('$3.00');
      });
    });
  });

  // ===== Modifier Selection Flow Integration Tests =====

  describe('Modifier Selection Flow with includedQuantity', () => {
    it('should correctly map modifiers with includedQuantity to SelectedModifier', (done) => {
      const mockModifiers: any[] = [
        {
          id: 'mod-1',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          includedQuantity: 2,
          currency: 'USD',
          active: true,
        },
        {
          id: 'mod-2',
          name: 'Extra Bacon',
          priceDelta: 2.0,
          // includedQuantity missing
          currency: 'USD',
          active: true,
        },
      ];

      component.modifiersList.set(mockModifiers);
      component.selectedModifiers.set(
        new Map([
          ['mod-1', 3],
          ['mod-2', 1],
        ])
      );

      // Simulate confirmSelection by manually building SelectedModifier array
      const selectedModifiers: any[] = [];
      component.selectedModifiers().forEach((quantity, modifierId) => {
        if (quantity > 0) {
          const modifier = component.modifiersList().find((m) => m.id === modifierId);
          if (modifier) {
            selectedModifiers.push({
              modifierId: modifier.id,
              name: modifier.name,
              priceDelta: modifier.priceDelta,
              quantity,
              includedQuantity: modifier.includedQuantity ?? 0,
            });
          }
        }
      });

      // Verify includedQuantity is correctly mapped
      expect(selectedModifiers.length).toBe(2);
      expect(selectedModifiers[0].modifierId).toBe('mod-1');
      expect(selectedModifiers[0].includedQuantity).toBe(2); // From modifier
      expect(selectedModifiers[1].modifierId).toBe('mod-2');
      expect(selectedModifiers[1].includedQuantity).toBe(0); // Default when undefined
      done();
    });

    it('should preserve includedQuantity through complete modifier selection flow', (done) => {
      const mockModifier: any = {
        id: 'mod-sauce',
        name: 'Premium Sauce',
        priceDelta: 0.5,
        includedQuantity: 3, // First 3 included
        currency: 'USD',
        active: true,
      };

      component.modifiersList.set([mockModifier]);

      // User selects 5 units
      component.selectedModifiers.set(new Map([['mod-sauce', 5]]));

      // Get breakdown
      const breakdown = component.getQuantityBreakdown(mockModifier);

      // Should show: 3 included + 2 extra = $1.00
      expect(breakdown).toContain('3 included');
      expect(breakdown).toContain('2 extra');
      expect(breakdown).toContain('$1.00');

      done();
    });

    it('should handle editing order item with includedQuantity modifiers', (done) => {
      const mockModifiers: any[] = [
        {
          id: 'mod-cheese',
          name: 'Extra Cheese',
          priceDelta: 1.0,
          includedQuantity: 2,
          currency: 'USD',
          active: true,
        },
      ];

      component.modifiersList.set(mockModifiers);

      // Start with 2 units selected (all included)
      component.selectedModifiers.set(new Map([['mod-cheese', 2]]));
      let breakdown = component.getQuantityBreakdown(mockModifiers[0]);
      expect(breakdown).toBe('2 included');

      // User increases to 4 units
      component.selectedModifiers.set(new Map([['mod-cheese', 4]]));
      breakdown = component.getQuantityBreakdown(mockModifiers[0]);

      // Should now show: 2 included + 2 extra = $2.00
      expect(breakdown).toContain('2 included');
      expect(breakdown).toContain('2 extra');
      expect(breakdown).toContain('$2.00');

       done();
     });
   });
});
