import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonImg,
} from '@ionic/angular/standalone';
import { Product } from '../../../../core/models/product.model';

/**
 * ProductCardComponent
 *
 * Reusable component to display individual product information in the catalog grid.
 * Handles product display, image loading, and tap events.
 *
 * Responsibilities:
 * - Display product information (name, image, price, category)
 * - Lazy load product images with fallback
 * - Format price with currency symbol
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
   * Note: API doesn't return price amount yet, so this is a placeholder
   * @returns Formatted price string
   */
  get formattedPrice(): string {
    // TODO: Once API provides price amount, format with currency symbol
    return 'Price TBD';
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
