/**
 * Order Models
 * Defines data structures for managing orders and their components
 */

/**
 * SelectedModifier
 * Represents a modifier that has been selected for a specific order item
 * Snapshots modifier data to preserve historical pricing and names
 */
export interface SelectedModifier {
  /**
   * Reference to the original modifier ID
   * Allows tracking which modifier was applied
   * @example "mod-123e4567-e89b-12d3-a456-426614174000"
   */
  modifierId: string;

  /**
   * Snapshot of the modifier's name at time of order
   * Preserves historical naming for audit trail
   * @example "Extra Cheese"
   */
  name: string;

  /**
   * Snapshot of the modifier's price delta at time of order
   * Preserves pricing for accurate historical calculations
   * Can be positive (add-on) or negative (discount)
   * @example 1.50
   */
  priceDelta: number;

  /**
   * Number of times this modifier is applied to the order item
   * Allows adding the same modifier multiple times
   * @example 2
   */
  quantity: number;
}

/**
 * OrderItem
 * Represents a configured product in an order
 * Includes base product info, modifiers selected, and calculated totals
 */
export interface OrderItem {
  /**
   * Client-generated unique identifier (typically UUID v4)
   * Used for local tracking before submission to backend
   * Helps identify items during order editing
   * @example "item-550e8400-e29b-41d4-a716-446655440000"
   */
  id: string;

  /**
   * Reference to the product being ordered
   * Allows linking to product catalog
   * @example "prod-123e4567-e89b-12d3-a456-426614174000"
   */
  productId: string;

  /**
   * Snapshot of the product's name at time of order
   * Preserves name for historical records
   * @example "Cheeseburger"
   */
  productName: string;

  /**
   * Base price of the product without modifiers
   * Stored as decimal (e.g., 12.99 for $12.99)
   * @example 12.99
   */
  basePrice: number;

  /**
   * Array of modifiers applied to this order item
   * Empty array if no modifiers selected
   * Order items can have multiple instances of the same modifier
   * @example [{ modifierId: "mod-1", name: "Extra Cheese", priceDelta: 1.00, quantity: 2 }]
   */
  modifiers: SelectedModifier[];

  /**
   * Calculated subtotal for this order item
   * Formula: (basePrice + Σ(modifier.priceDelta × quantity)) × quantity
   * Computed field, should be recalculated when item details change
   * @example 27.98
   */
  subtotal: number;
}

/**
 * Order
 * Represents a complete order with items and total amount
 * May contain items with multiple products and modifiers
 */
export interface Order {
  /**
   * Unique identifier for the order
   * Only set after backend submission
   * null/undefined for unsaved orders in draft state
   * @example "order-123e4567-e89b-12d3-a456-426614174000"
   */
  id?: string;

  /**
   * Array of order items (products with selected modifiers)
   * Must have at least one item to be valid
   * @example [{ id: "item-1", productId: "prod-1", productName: "Burger", basePrice: 12.99, modifiers: [], subtotal: 12.99 }]
   */
  items: OrderItem[];

  /**
   * Total order amount including all items and modifiers
   * Computed field: Σ(item.subtotal) for all items
   * Should reflect the exact amount to be charged
   * @example 55.96
   */
  totalAmount: number;

  /**
   * ISO 4217 currency code for the order
   * Must match the tenant's currency
   * @example "USD"
   */
  currency: string;

  /**
   * ISO 8601 timestamp when the order was created
   * Only set after backend submission
   * null/undefined for unsaved orders in draft state
   * @example "2024-01-15T14:30:00Z"
   */
  createdAt?: string;
}
