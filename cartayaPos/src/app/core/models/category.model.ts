/**
 * Category Model
 * Represents a product category in a tenant's catalog
 */
export interface Category {
  id: string;
  name: string;
  position?: number;
  createdAt: string;
  updatedAt: string;
}
