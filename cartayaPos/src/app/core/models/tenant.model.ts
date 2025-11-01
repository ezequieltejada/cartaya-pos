/**
 * Tenant Model
 * Represents a business/organization in the multi-tenant system
 */
export interface Tenant {
  id: string;
  name: string;
  role: 'Owner' | 'Employee';
  createdAt: string;
  updatedAt: string;
}
