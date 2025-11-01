/**
 * User Model
 * Represents an authenticated user in the system
 */
export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}
