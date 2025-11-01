import { DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonImg,
} from '@ionic/angular/standalone';
import { Product } from '../../../../core/models/product.model';
import { ProductCardComponent } from './product-card.component';

describe('ProductCardComponent', () => {
  let component: ProductCardComponent;
  let fixture: ComponentFixture<ProductCardComponent>;
  let compiled: DebugElement;

  const mockProduct: Product = {
    id: 'prod-1',
    name: 'Cheeseburger',
    sku: 'BURGER-001',
    description: 'Classic cheeseburger',
    category: 'Burgers',
    active: true,
    defaultPriceId: 'price-1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ProductCardComponent,
        IonCard,
        IonCardHeader,
        IonCardTitle,
        IonCardContent,
        IonImg,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductCardComponent);
    component = fixture.componentInstance;
    compiled = fixture.debugElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Input and Output', () => {
    it('should accept @Input product', () => {
      component.product = mockProduct;
      expect(component.product).toEqual(mockProduct);
    });

    it('should have productTapped output', () => {
      expect(component.productTapped).toBeDefined();
      expect(component.productTapped.observers.length).toBe(0);
    });

    it('should emit productTapped when onTap is called', (done) => {
      component.product = mockProduct;
      component.productTapped.subscribe((product) => {
        expect(product).toEqual(mockProduct);
        done();
      });

      component.onTap();
    });
  });

  describe('Template Rendering', () => {
    beforeEach(() => {
      component.product = mockProduct;
      fixture.detectChanges();
    });

    it('should render ion-card', () => {
      const card = compiled.query(By.css('ion-card'));
      expect(card).toBeTruthy();
    });

    it('should render product name in card title', () => {
      const title = compiled.query(By.css('ion-card-title'));
      expect(title.nativeElement.textContent).toContain(mockProduct.name);
    });

    it('should render price in card content', () => {
      const priceElement = compiled.query(By.css('.price'));
      expect(priceElement).toBeTruthy();
      expect(priceElement.nativeElement.textContent).toContain('Price TBD');
    });

    it('should render category when present', () => {
      const categoryElement = compiled.query(By.css('.category'));
      expect(categoryElement).toBeTruthy();
      expect(categoryElement.nativeElement.textContent).toContain(
        mockProduct.category
      );
    });

    it('should not render category when absent', () => {
      component.product = { ...mockProduct, category: undefined };
      fixture.detectChanges();

      const categoryElement = compiled.query(By.css('.category'));
      expect(categoryElement).toBeFalsy();
    });

    it('should render ion-img with lazy loading', () => {
      const img = compiled.query(By.css('ion-img'));
      expect(img).toBeTruthy();
      expect(img.componentInstance.loading).toBe('lazy');
    });

    it('should use placeholder image', () => {
      const img = compiled.query(By.css('ion-img'));
      expect(img.componentInstance.src).toContain('product-placeholder.png');
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      component.product = mockProduct;
      fixture.detectChanges();
    });

    it('should emit productTapped when card is clicked', (done) => {
      component.productTapped.subscribe((product) => {
        expect(product).toEqual(mockProduct);
        done();
      });

      const card = compiled.query(By.css('ion-card'));
      card.nativeElement.click();
    });
  });

  describe('Getters', () => {
    beforeEach(() => {
      component.product = mockProduct;
    });

    it('formattedPrice should return placeholder text', () => {
      expect(component.formattedPrice).toBe('Price TBD');
    });

    it('imageUrl should return placeholder path', () => {
      expect(component.imageUrl).toContain('product-placeholder.png');
    });
  });

  describe('Edge Cases', () => {
    it('should handle product with no category gracefully', () => {
      component.product = { ...mockProduct, category: undefined };
      fixture.detectChanges();

      const categoryElement = compiled.query(By.css('.category'));
      expect(categoryElement).toBeFalsy();
    });

    it('should handle product with minimal properties', () => {
      const minimalProduct: Product = {
        id: 'prod-minimal',
        name: 'Minimal Product',
        active: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      component.product = minimalProduct;
      fixture.detectChanges();

      const title = compiled.query(By.css('ion-card-title'));
      expect(title.nativeElement.textContent).toContain('Minimal Product');

      const categoryElement = compiled.query(By.css('.category'));
      expect(categoryElement).toBeFalsy();
    });

    it('should render card correctly regardless of product content', () => {
      component.product = mockProduct;
      fixture.detectChanges();

      const card = compiled.query(By.css('ion-card'));
      expect(card).toBeTruthy();

      const header = compiled.query(By.css('ion-card-header'));
      expect(header).toBeTruthy();

      const content = compiled.query(By.css('ion-card-content'));
      expect(content).toBeTruthy();
    });
  });
});
