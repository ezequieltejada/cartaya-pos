/**
 * Modifier Model
 * Represents a customization option that can be added to products
 * Modifiers are used to adjust product pricing and attributes (e.g., "Extra Cheese", "No Onions")
 */
export interface Modifier {
  /**
   * Unique identifier for the modifier
   * @example "mod-123e4567-e89b-12d3-a456-426614174000"
   */
  id: string;

  /**
   * Display name for the modifier shown to users
   * Should be descriptive and concise (e.g., "Extra Cheese", "Add Bacon")
   * @example "Extra Cheese"
   */
  name: string;

  /**
   * Price adjustment applied when this modifier is selected
   * Can be positive (add-on) or negative (discount)
   * Stored as decimal (e.g., 1.50 for $1.50)
   * @example 1.50
   */
  priceDelta: number;

  /**
   * ISO 4217 currency code for this modifier's price
   * Must match the tenant's currency for consistency
   * @example "USD"
   */
  currency: string;

  /**
   * Whether this modifier is currently available for purchase
   * Inactive modifiers should not be displayed in the UI or allowed to be selected
   * @example true
   */
  active: boolean;

  /**
   * ISO 8601 timestamp when this modifier was created
   * Stored in UTC timezone
   * @example "2024-01-01T12:00:00Z"
   */
  createdAt: string;

  /**
   * ISO 8601 timestamp when this modifier was last updated
   * Stored in UTC timezone, updates whenever any field changes
   * @example "2024-01-15T14:30:00Z"
   */
  updatedAt: string;
}
