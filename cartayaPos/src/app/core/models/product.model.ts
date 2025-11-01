/**
 * Product Model
 * Represents a product in a tenant's catalog
 */
export interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  active: boolean;
  defaultPriceId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Price Model
 * Represents pricing information for products
 */
export interface Price {
  id: string;
  amount: number;
  currency: string;
  /**
   * ISO 8601 date when this price becomes valid
   * null means no lower bound on validity
   */
  validFrom: string | null;
  /**
   * ISO 8601 date when this price expires
   * null means no upper bound on validity
   */
  validTo: string | null;
}

/**
 * ProductWithPrice Model
 * Extended product with embedded price information
 * Used for scenarios where product and price data are joined
 */
export interface ProductWithPrice extends Product {
  price?: Price;
}
