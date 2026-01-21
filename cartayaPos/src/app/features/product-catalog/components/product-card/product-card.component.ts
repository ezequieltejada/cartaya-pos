import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonImg
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { imageOutline } from 'ionicons/icons';
import { Modifier } from '../../../../core/models/modifier.model';
import { Product } from '../../../../core/models/product.model';
import { ImageCacheService } from '../../../../core/services/image-cache.service';
import { ModifierService } from '../../../../core/services/modifier.service';
import { PosService } from '../../../../core/services/pos.service';
import { ProductService } from '../../../../core/services/product.service';
import { TenantService } from '../../../../core/services/tenant.service';

/**
 * ProductCardComponent
 *
 * Reusable component to display individual product information in the catalog grid.
 * Handles product display, image loading, and tap events.
 *
 * Responsibilities:
 * - Display product information (name, image, price, category, description)
 * - Lazy load product images with fallback
 * - Format price with currency symbol using ProductService, including default modifiers
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
    IonIcon,
    IonImg
  ],
  templateUrl: './product-card.component.html',
  styleUrls: ['./product-card.component.scss'],
})
export class ProductCardComponent implements OnChanges {
  private productService = inject(ProductService);
  private modifierService = inject(ModifierService);
  private tenantService = inject(TenantService);
  private posService = inject(PosService);
  private imageCacheService = inject(ImageCacheService);

  constructor() {
    addIcons({ imageOutline });
  }

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
   * Default modifiers for the product
   */
  private defaultModifiers = signal<Modifier[]>([]);

  /**
   * Product image URL (from cache or null if not available)
   */
  readonly imageUrl = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] && this.product) {
      this.loadDefaultModifiers();
      this.loadProductImage();
    }
  }

  /**
   * Load default modifiers for the current product
   */
  private loadDefaultModifiers(): void {
    const tenantId = this.tenantService.getCurrentTenantId();
    const pos = this.posService.getSelectedPos();

    if (!tenantId || !pos || !this.product) {
      return;
    }

    this.modifierService
      .fetchProductModifiers(tenantId, this.product.id, pos.id)
      .subscribe({
        next: (modifiers) => {
          // Filter to only default modifiers
          const defaultMods = modifiers.filter((modifier) => modifier.default === true);
          this.defaultModifiers.set(defaultMods);
        },
        error: (error) => {
          console.error('Failed to load default modifiers:', error);
          this.defaultModifiers.set([]);
        },
      });
  }

  /**
   * Load product image URL from cache
   * Finds the main picture from the product and loads it asynchronously
   */
  private async loadProductImage(): Promise<void> {
    const tenantId = this.tenantService.getCurrentTenantId();
    
    if (!tenantId || !this.product?.pictures || this.product.pictures.length === 0) {
      this.imageUrl.set(null);
      return;
    }

    try {
      // Find the main picture or use the first one
      const mainPicture = this.product.pictures.find((p) => p.isMain) || this.product.pictures[0];
      
      if (!mainPicture) {
        this.imageUrl.set(null);
        return;
      }

      const url = await this.imageCacheService.getImageUrl(
        tenantId,
        this.product.id,
        mainPicture.filename
      );
      
      this.imageUrl.set(url);
    } catch (error) {
      console.error('Failed to load product image:', error);
      this.imageUrl.set(null);
    }
  }

  /**
   * Handle image load error
   * Falls back to placeholder icon
   */
  onImageError(): void {
    this.imageUrl.set(null);
  }

  /**
   * Get the formatted price for display
   * Displays base price plus sum of default modifier prices (accounting for includedQuantity)
   * Falls back to "Price not available" if missing
   * Uses ProductService to format with proper currency symbol
   * 
   * For each default modifier, only charges for quantities exceeding includedQuantity:
   *   billableQuantity = max(0, defaultQty - includedQty)
   *   charge = billableQuantity × priceDelta
   * 
   * This ensures the displayed price matches what will be charged in the cart.
   * @returns Formatted price string with currency symbol or fallback message
   */
  get formattedPrice(): string {
    if (!this.product.defaultPrice) {
      return 'Price not available';
    }

    // Calculate total price: base price + sum of default modifier prices (with includedQuantity adjustment)
    const basePrice = this.product.defaultPrice.amount;
    const defaultModifierTotal = this.defaultModifiers().reduce(
      (sum, modifier) => {
        // For default modifiers, quantity is 1 (set in defaultModifiers signal)
        const selectedQty = 1;
        const includedQty = modifier.includedQuantity ?? 0;
        const billableQty = Math.max(0, selectedQty - includedQty);
        return sum + modifier.priceDelta * billableQty;
      },
      0
    );
    const totalPrice = basePrice + defaultModifierTotal;

    return this.productService.formatPrice(
      totalPrice,
      this.product.defaultPrice.currency
    );
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
  get imageUrlOrPlaceholder(): string {
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
