import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { CartPage } from './cart.page';

describe('CartPage', () => {
  let component: CartPage;
  let fixture: ComponentFixture<CartPage>;
  let router: jasmine.SpyObj<Router>;
  let orderService: jasmine.SpyObj<OrderService>;

  beforeEach(async () => {
    // Mock services
    const routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    const orderServiceSpy = jasmine.createSpyObj('OrderService', [
      'getCurrentOrder',
    ]);

    await TestBed.configureTestingModule({
      imports: [CartPage],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: OrderService, useValue: orderServiceSpy },
      ],
    }).compileComponents();

    router = TestBed.inject(Router) as jasmine.SpyObj<Router>;
    orderService = TestBed.inject(OrderService) as jasmine.SpyObj<OrderService>;

    fixture = TestBed.createComponent(CartPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render without console errors', () => {
    spyOn(console, 'error');
    fixture.detectChanges();
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should display empty state message', () => {
    fixture.detectChanges();
    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('Cart is empty');
  });

  it('should have Ionic header with title', () => {
    fixture.detectChanges();
    const ionTitle = fixture.nativeElement.querySelector('ion-title');
    expect(ionTitle).toBeTruthy();
    expect(ionTitle.textContent).toContain('Order Summary');
  });
});
