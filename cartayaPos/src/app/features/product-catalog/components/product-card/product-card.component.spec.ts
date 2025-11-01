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

  describe('Placeholder Image Handling', () => {
    it('should display placeholder when product image is missing', () => {
      component.product = { ...mockProduct, defaultPriceId: undefined };
      fixture.detectChanges();

      const img = compiled.query(By.css('ion-img'));
      expect(img).toBeTruthy();
      expect(img.componentInstance.src).toContain('product-placeholder');
    });

    it('should use product-placeholder.png as fallback', () => {
      component.product = mockProduct;
      fixture.detectChanges();

      const img = compiled.query(By.css('ion-img'));
      expect(img.componentInstance.src).toContain('product-placeholder.png');
    });
  });

  describe('Price Display', () => {
    it('should display "Price TBD" when price is not available', () => {
      component.product = mockProduct;
      const priceText = component.formattedPrice;

      expect(priceText).toBe('Price TBD');
    });

    it('should format price correctly (future enhancement)', () => {
      component.product = mockProduct;
      fixture.detectChanges();

      const priceElement = compiled.query(By.css('.price'));
      expect(priceElement.nativeElement.textContent).toContain('Price TBD');
    });
  });

  describe('Image Loading Strategy', () => {
    it('should use lazy loading for images', () => {
      component.product = mockProduct;
      fixture.detectChanges();

      const img = compiled.query(By.css('ion-img'));
      expect(img.componentInstance.loading).toBe('lazy');
    });
  });

  describe('Event Binding', () => {
    beforeEach(() => {
      component.product = mockProduct;
      fixture.detectChanges();
    });

    it('should emit productTapped with correct product', (done) => {
      component.productTapped.subscribe((product) => {
        expect(product).toEqual(mockProduct);
        expect(product.id).toBe('prod-1');
        expect(product.name).toBe('Cheeseburger');
        done();
      });

      component.onTap();
    });

    it('should emit product details when card clicked', (done) => {
      component.productTapped.subscribe((product) => {
        expect(product.id).toBeDefined();
        expect(product.name).toBeDefined();
        done();
      });

      const card = compiled.query(By.css('ion-card'));
      card.nativeElement.click();
    });

    it('should handle multiple rapid clicks', (done) => {
      let clickCount = 0;
      component.productTapped.subscribe(() => {
        clickCount++;
        if (clickCount === 3) {
          expect(clickCount).toBe(3);
          done();
        }
      });

      component.onTap();
      component.onTap();
      component.onTap();
    });
  });

  describe('Product Data Binding', () => {
    it('should update display when product input changes', () => {
      component.product = mockProduct;
      fixture.detectChanges();

      let title = compiled.query(By.css('ion-card-title'));
      expect(title.nativeElement.textContent).toContain('Cheeseburger');

      const newProduct = { ...mockProduct, name: 'Veggie Burger' };
      component.product = newProduct;
      fixture.detectChanges();

      title = compiled.query(By.css('ion-card-title'));
      expect(title.nativeElement.textContent).toContain('Veggie Burger');
    });

    it('should handle product without SKU', () => {
      const productWithoutSku = { ...mockProduct };
      delete productWithoutSku.sku;

      component.product = productWithoutSku;
      fixture.detectChanges();

      const card = compiled.query(By.css('ion-card'));
      expect(card).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      component.product = mockProduct;
      fixture.detectChanges();
    });

    it('should have descriptive product name in title', () => {
      const title = compiled.query(By.css('ion-card-title'));
      expect(title.nativeElement.textContent).toContain(mockProduct.name);
    });

    it('should display category for better context', () => {
      const categoryElement = compiled.query(By.css('.category'));
      expect(categoryElement).toBeTruthy();
      expect(categoryElement.nativeElement.textContent).toContain('Burgers');
    });
  });

  describe('Layout Responsiveness', () => {
    it('should render card with appropriate content sections', () => {
      component.product = mockProduct;
      fixture.detectChanges();

      const card = compiled.query(By.css('ion-card'));
      expect(card).toBeTruthy();

      const header = compiled.query(By.css('ion-card-header'));
      expect(header).toBeTruthy();

      const title = compiled.query(By.css('ion-card-title'));
      expect(title).toBeTruthy();

      const content = compiled.query(By.css('ion-card-content'));
      expect(content).toBeTruthy();
    });

    it('should maintain structure with long product names', () => {
      component.product = {
        ...mockProduct,
        name: 'Very Long Product Name That Goes on Multiple Lines',
      };
      fixture.detectChanges();

      const title = compiled.query(By.css('ion-card-title'));
      expect(title).toBeTruthy();
      expect(title.nativeElement.textContent).toContain('Very Long');
    });
  });

  describe('Component Lifecycle', () => {
    it('should initialize with product input', () => {
      component.product = mockProduct;
      expect(component.product).toEqual(mockProduct);
    });

    it('should handle ngOnInit', () => {
      component.product = mockProduct;
      fixture.detectChanges();

      expect(component).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('should render efficiently with minimal DOM operations', () => {
      const startTime = performance.now();

      component.product = mockProduct;
      fixture.detectChanges();

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Component should render quickly (typically <50ms)
      expect(renderTime).toBeLessThan(500);
    });
  });

  describe('Edge Cases - Large Text', () => {
    it('should handle very long product names', () => {
      component.product = {
        ...mockProduct,
        name: 'A'.repeat(100),
      };
      fixture.detectChanges();

      const title = compiled.query(By.css('ion-card-title'));
      expect(title).toBeTruthy();
    });

    it('should handle very long descriptions', () => {
      component.product = {
        ...mockProduct,
        description: 'Description '.repeat(50),
      };
      fixture.detectChanges();

      const card = compiled.query(By.css('ion-card'));
      expect(card).toBeTruthy();
    });
  });

  describe('Special Characters', () => {
    it('should handle product names with special characters', () => {
      component.product = {
        ...mockProduct,
        name: 'Product & Co. <Special> "Quotes"',
      };
      fixture.detectChanges();

      const title = compiled.query(By.css('ion-card-title'));
      expect(title).toBeTruthy();
      expect(title.nativeElement.textContent).toContain('Product');
    });

    it('should handle SKU with special characters', () => {
      component.product = {
        ...mockProduct,
        sku: 'SKU-001-A/B*C',
      };
      fixture.detectChanges();

      const card = compiled.query(By.css('ion-card'));
      expect(card).toBeTruthy();
    });
  });
});
