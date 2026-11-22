import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { OrderService } from '../../core/services/order.service';
import { OrderSummaryComponent } from '../order-summary/order-summary.component';
import { CartPage } from './cart.page';

@Component({ selector: 'app-order-summary', template: '', standalone: true })
class OrderSummaryStubComponent {}

describe('CartPage', () => {
  let component: CartPage;
  let fixture: ComponentFixture<CartPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CartPage, TranslateModule.forRoot()],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: OrderService, useValue: jasmine.createSpyObj('OrderService', ['getCurrentOrder']) },
      ],
    })
      // The cart contents are covered by the OrderSummaryComponent specs
      .overrideComponent(CartPage, {
        remove: { imports: [OrderSummaryComponent] },
        add: { imports: [OrderSummaryStubComponent] },
      })
      .compileComponents();

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

  it('should have an Ionic header with the translated title', () => {
    fixture.detectChanges();
    const ionTitle = fixture.nativeElement.querySelector('ion-title');
    expect(ionTitle).toBeTruthy();
    expect(ionTitle.textContent).toContain('CART.TITLE');
  });

  it('should show the order summary', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-order-summary')).toBeTruthy();
  });
});
