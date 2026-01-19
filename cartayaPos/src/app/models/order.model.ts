/**
 * Order Models
 * Unified interfaces for managing orders across both order creation and order history
 * Shared between OrderService (draft orders) and OrderHistoryService (order history)
 */

/**
 * SelectedModifier
 * Represents a modifier that has been selected for a specific order item
 * Snapshots modifier data to preserve historical pricing and names
 * Used during order creation (OrderService)
 */
export interface SelectedModifier {
  /**
   * Reference to the original modifier ID
   * Allows tracking which modifier was applied
   * @example "mod-123e4567-e89b-12d3-a456-426614174000"
   */
  modifierId: string;

  /**
   * Quantity included in the base price for this product-modifier relation
   * 
   * Copied from the Modifier interface at the time of order creation.
   * Represents the quantity of this modifier that is included in the product's base price.
   * 
   * During pricing calculation in OrderService.calculateSubtotal():
   * billableQuantity = max(0, selectedQuantity - includedQuantity)
   * charge = billableQuantity × priceDelta
   * 
   * Allows pricing adjustments based on "bundle" quantities without requiring
   * separate product SKUs (e.g., "first 2 sauces included, $0.50 each after").
   * 
   * @example 2  // User selected 3, but first 2 are included → charge for 1
   * @default 0  // If undefined, treated as 0 (charge full quantity)
   */
   includedQuantity?: number;

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
   * In cents: use priceDeltaCents for API data, priceDelta for local calculations
   * @example 1.50 (for display/calculations) or 150 (priceDeltaCents for API)
   */
  priceDelta: number;

  /**
   * Price delta in cents (for API compatibility)
   * Used when receiving data from backend API
   * @example 150 (representing $1.50)
   */
  priceDeltaCents?: number;

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
 * Supports both draft order items (OrderService) and historical order items (OrderHistoryService)
 */
export interface OrderItem {
  /**
   * Client-generated unique identifier (typically UUID v4)
   * Used for local tracking before submission to backend
   * Helps identify items during order editing
   * Only set for draft orders (OrderService)
   * @example "item-550e8400-e29b-41d4-a716-446655440000"
   */
  id?: string;

  /**
   * Reference to the product being ordered
   * Allows linking to product catalog
   * @example "prod-123e4567-e89b-12d3-a456-426614174000"
   */
  productId: string;

  /**
   * Snapshot of the product's name at time of order
   * Preserves name for historical records
   * Optional, may be derived from productId during draft state
   * @example "Cheeseburger"
   */
  productName?: string;

  /**
   * Base price of the product without modifiers
   * Stored as decimal (e.g., 12.99 for $12.99)
   * In cents: use priceCentsSnapshot for API data
   * @example 12.99 (for display/calculations) or 1299 (priceCentsSnapshot for API)
   */
  basePrice?: number;

  /**
   * Base price in cents (for API compatibility)
   * Used when receiving data from backend API
   * @example 1299 (representing $12.99)
   */
  priceCentsSnapshot?: number;

  /**
   * Quantity of this item ordered
   * For MVP, each order item is quantity 1
   * @example 1
   */
  quantity: number;

  /**
   * Array of modifiers applied to this order item
   * Empty array if no modifiers selected
   * Order items can have multiple instances of the same modifier
   * @example [{ modifierId: "mod-1", name: "Extra Cheese", priceDelta: 1.00, quantity: 2 }]
   */
  modifiers: SelectedModifier[];

  /**
   * Special instructions or notes for this item
   * Can be null if no special instructions
   * Only populated for historical order items (from OrderHistoryService)
   * @example "No onions"
   */
  notes?: string | null;

  /**
   * Calculated subtotal for this order item
   * Formula: (basePrice + Σ(modifier.priceDelta × quantity)) × quantity
   * Computed field, should be recalculated when item details change
   * Only set for draft orders (OrderService)
   * @example 27.98
   */
  subtotal?: number;

  /**
   * Line total for this item (alternative to subtotal)
   * Used in API responses from OrderHistoryService
   * @example 2798 (in cents) or 27.98 (decimal)
   */
  lineTotal?: number;
}

/**
 * Order
 * Represents a complete order with items and total amount
 * Supports both draft orders (being built by OrderService) and submitted orders (from OrderHistoryService)
 * 
 * For draft orders: id, createdAt, status are undefined
 * For submitted orders: id, createdAt, status are set from backend
 */
export interface Order {
  /**
   * Unique identifier for the order
   * Only set after backend submission
   * undefined for unsaved orders in draft state
   * @example "order-123e4567-e89b-12d3-a456-426614174000"
   */
  id?: string;

  /**
   * Alternative order ID from backend (used in OrderHistoryService responses)
   * When present, either id or orderId should be used (id takes precedence)
   * @example "order-123e4567-e89b-12d3-a456-426614174000"
   */
  orderId?: string;

  /**
   * Array of order items (products with selected modifiers)
   * Must have at least one item to be valid
   * @example [{ id: "item-1", productId: "prod-1", productName: "Burger", basePrice: 12.99, modifiers: [], subtotal: 12.99 }]
   */
  items: OrderItem[];

  /**
   * Total order amount including all items and modifiers
   * Decimal format: e.g., 55.96 for $55.96
   * Computed field: Σ(item.subtotal) for all items OR from API response
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
   * undefined for unsaved orders in draft state
   * @example "2024-01-15T14:30:00Z"
   */
  createdAt?: string;

  /**
   * Current status of the order
   * Only set for submitted orders (from OrderHistoryService)
   * undefined for draft orders (OrderService)
   * @example "received" or "completed"
   */
  status?: 'received' | 'completed';
}

/**
 * OrderModifier (from OrderHistoryService API)
 * Represents a modifier as returned by the order history API
 * Stored in cents for precision
 */
export interface OrderModifier {
  modifierId: string;
  name: string;
  priceDeltaCents: number; // Price change in cents (can be negative)
}

/**
 * Pagination information from the API
 */
export interface OrderPagination {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * API Response for order history
 */
export interface OrderHistoryResponse {
  data: Order[];
  pagination: OrderPagination;
}

/**
 * Response from order submission API
 * Returned when OrderService submits a new order
 */
export interface SubmitOrderResponse {
  orderId: string;
  status: string;
  createdAt: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    basePrice: number;
    appliedModifiers?: Array<{
      modifierId: string;
      name: string;
      priceDelta: number;
    }>;
    lineTotal: number;
  }>;
  totalAmount: number;
  currency: string;
}

/**
 * Error response from the API
 */
export interface ApiErrorResponse {
  code: string;
  message: string;
}
