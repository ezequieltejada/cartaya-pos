/**
 * Point of Sale (PoS) Model
 * Represents a physical or virtual sales location
 */
export interface Pos {
  id: string;
  name: string;
  slug: string;
  location: string | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
