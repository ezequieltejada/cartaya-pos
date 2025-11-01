import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import {
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonImg,
} from '@ionic/angular/standalone';
import { Product } from '../../../../core/models/product.model';
import { ProductService } from '../../../../core/services/product.service';

/**
 * ProductCardComponent
 *
 * Reusable component to display individual product information in the catalog grid.
 * Handles product display, image loading, and tap events.
 *
 * Responsibilities:
 * - Display product information (name, image, price, category, description)
 * - Lazy load product images with fallback
 * - Format price with currency symbol using ProductService
 * - Display product description (truncated to 2 lines)
 * - Emit tap events to parent component
 */
@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [
    CommonModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonImg,
  ],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
})
export class ProductCardComponent {
  private productService = inject(ProductService);

  /**
   * Product to display in the card
   */
  @Input() product!: Product;

  /**
   * Event emitted when card is tapped
   * Emits the product that was tapped
   */
  @Output() productTapped = new EventEmitter<Product>();

  /**
   * Get the formatted price for display
   * Displays actual price if available in defaultPrice object
   * Falls back to "Price not available" if missing
   * Uses ProductService to format with proper currency symbol
   * @returns Formatted price string with currency symbol or fallback message
   */
  get formattedPrice(): string {
    if (this.product.defaultPrice) {
      return this.productService.formatPrice(
        this.product.defaultPrice.amount,
        this.product.defaultPrice.currency
      );
    }
    return 'Price not available';
  }

  /**
   * Check if product has a description
   * @returns True if product has a non-empty description
   */
  get hasDescription(): boolean {
    return !!this.product.description && this.product.description.trim().length > 0;
  }

  /**
   * Get the image URL for the product
   * Falls back to placeholder if no image URL provided
   * @returns Image URL or placeholder path
   */
  get imageUrl(): string {
    // Product model doesn't include imageUrl yet, so always use placeholder
    return 'assets/icon/product-placeholder.png';
  }

  /**
   * Handle tap event on the product card
   * Emits the product to the parent component
   */
  onTap(): void {
    this.productTapped.emit(this.product);
  }
}
