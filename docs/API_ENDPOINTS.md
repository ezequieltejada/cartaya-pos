# API Endpoints Documentation

This document provides a comprehensive overview of all API endpoints in the Cartaya API project.

## Overview

All endpoints return JSON responses and use session-based authentication via Better Auth unless otherwise noted. The API follows RESTful conventions with proper HTTP status codes.

**General Notes:**
- Tenant-scoped routes are under `/api/tenants/:tenantId/*` and require tenant membership
- Two roles exist: **Owner** (full access) and **Employee** (limited access)
- Pagination uses `limit` and `offset` query parameters (defaults: limit=25, offset=0, max=100)
- Monetary values are returned as decimals (e.g., 12.99) but stored internally as integer cents
- All timestamps are in ISO 8601 format (UTC)

## Authentication (/api/auth/*)

These endpoints handle user authentication using Better Auth's email/password strategy. All authentication endpoints use session cookies for maintaining user sessions.

### POST /api/auth/sign-up/email

Creates a new user account with email and password credentials.

**Purpose:** Allows new users to register for the platform. This is the first step before they can be invited to tenants or create their own.

**Request Body:**
- `email` (string, required): Valid email address
- `password` (string, required): Must meet minimum strength requirements (minimum 8 characters)
- `name` (string, optional): User's display name

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    ...
  }
}
```

**Error Responses:**
- `400`: Weak password (less than 8 characters)
- `422`: Email already exists

---

### POST /api/auth/sign-in/email

Authenticates a user and establishes a session.

**Purpose:** Allows registered users to log in to the system. A successful login sets a session cookie that authenticates subsequent requests.

**Request Body:**
- `email` (string, required): User's email address
- `password` (string, required): User's password

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    ...
  }
}
```

Sets `Set-Cookie` header with session token.

**Error Responses:**
- `401`: Invalid email or password

---

### GET /api/auth/get-session

Retrieves the current authenticated user's session information.

**Purpose:** Allows the client to check if a user is currently authenticated and retrieve their user details. Returns null if not authenticated.

**Response (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name",
    ...
  }
}
```

Or `null` if not authenticated.

---

### POST /api/auth/sign-out

Terminates the current user session.

**Purpose:** Logs out the currently authenticated user by invalidating their session cookie. This ensures secure session termination.

**Request Body:** `{}`

**Response (200):** Empty response with cleared session cookie

---

## Invites

The invite system allows tenant Owners to invite new users to join their tenant. Invites can be sent to both existing and new users.

### POST /api/tenants/:tenantId/invites

Creates a new invite for a user to join the tenant.

**Authorization:** Owner only

**Purpose:** Allows tenant Owners to invite people to join their tenant as either Owners or Employees. The endpoint generates a unique invite token and URL that can be shared with the invitee. This is essential for team building and access management.

**Request Body:**
- `email` (string, required): Valid email address of the person to invite
- `role` (string, required): Either "Owner" or "Employee"
- `expiresInHours` (number, optional): Hours until invite expires (default: 72)

**Response (201):**
```json
{
  "inviteId": "uuid",
  "email": "invitee@example.com",
  "role": "Employee",
  "inviteUrl": "https://app.example.com/invite/accept?token=...",
  "expiresAt": "2024-01-15T12:00:00Z"
}
```

**Error Responses:**
- `400`: Invalid email format or role
- `401`: Not authenticated
- `403`: User is not an Owner
- `409`: User is already a member of the tenant
- `422`: Pending invite already exists for this email

---

### POST /api/tenants/:tenantId/invites/:inviteId/resend

Regenerates an invite with a new token and expiration date.

**Authorization:** Owner only

**Purpose:** Allows Owners to resend invites that may have expired or been lost. The original invite token is invalidated and a new one is generated with a fresh expiration time. This is useful when invitees lose the original email or when invites expire before being accepted.

**Response (200):**
```json
{
  "inviteId": "uuid",
  "email": "invitee@example.com",
  "role": "Employee",
  "inviteUrl": "https://app.example.com/invite/accept?token=...",
  "resentAt": "2024-01-14T10:00:00Z",
  "expiresAt": "2024-01-17T10:00:00Z"
}
```

**Error Responses:**
- `401`: Not authenticated
- `403`: User is not an Owner
- `404`: Invite not found
- `422`: Invite has already been accepted or revoked

---

### DELETE /api/tenants/:tenantId/invites/:inviteId

Revokes a pending invite.

**Authorization:** Owner only

**Purpose:** Allows Owners to cancel pending invites before they're accepted. This marks the invite as revoked, preventing it from being used. This is important for maintaining security when invites are sent to wrong addresses or when team membership decisions change.

**Response (204):** No content

**Error Responses:**
- `401`: Not authenticated
- `403`: User is not an Owner
- `404`: Invite not found
- `422`: Invite has already been accepted

---

### POST /auth/invite/accept

Accepts an invite and creates a new user account (or links to existing account).

**Authorization:** Public (no authentication required)

**Purpose:** Allows invited users to accept their invitation and join a tenant. If the user doesn't have an account yet, this endpoint creates one. This is the completion step of the invitation flow, establishing the user's membership in the tenant with the specified role.

**Request Body:**
- `token` (string, required): The invite token from the invitation URL
- `name` (string, required): User's display name (for new accounts)
- `password` (string, required): Password for the new account

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  },
  "tenant": {
    "id": "uuid",
    "name": "Company Name"
  },
  "role": "Employee"
}
```

Sets session cookie automatically after acceptance.

**Error Responses:**
- `400`: Missing or invalid required fields
- `401`: Invite token has expired
- `404`: Invite token not found
- `409`: Email already has an account
- `422`: Invite has already been accepted

---

## Tenants

Tenants represent individual businesses or organizations in the multi-tenant system. Each tenant has its own isolated data including users, products, orders, and settings.

### POST /api/tenants

Creates a new tenant and assigns the creator as Owner.

**Authorization:** Authenticated user required

**Purpose:** Allows any authenticated user to create their own tenant (business). The user who creates the tenant automatically becomes an Owner. This is the starting point for using the platform - after creating a tenant, the Owner can invite team members, configure settings, and start managing their business. The tenant acts as a container for all business data.

**Request Body:**
- `name` (string, required): Tenant/business name
- `settings` (object, optional):
  - `timezone` (string): IANA timezone (default: "UTC")
  - `currency` (string): ISO currency code (default: "USD")

**Response (201):**
```json
{
  "id": "uuid",
  "name": "My Business",
  "settings": {
    "timezone": "America/New_York",
    "currency": "USD"
  }
}
```

**Why it exists:** Multi-tenancy enables the platform to serve multiple businesses while keeping their data completely isolated. Each user can create and be a member of multiple tenants.

**Error Response:**
- `401`: User not authenticated

---

### GET /api/tenants

Lists all tenants the authenticated user is a member of.

**Authorization:** Authenticated user required

**Purpose:** Returns all tenants where the authenticated user has membership (either as Owner or Employee). This allows users to see all businesses they have access to and switch between them. Essential for users who work with multiple tenants.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "My Business",
      "role": "Owner",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Why it exists:** Users often need to access multiple tenants (e.g., managing multiple businesses or working for different companies). This endpoint enables tenant switching in the UI.

**Error Response:**
- `401`: User not authenticated

---

### GET /api/tenants/:tenantId

Retrieves detailed information about a specific tenant.

**Authorization:** Owner only

**Purpose:** Provides complete tenant details including settings. This is used primarily for administrative purposes and tenant management screens. Only Owners can access this to maintain security around sensitive tenant information.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "My Business",
  "settings": {
    "timezone": "America/New_York",
    "currency": "USD"
  },
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Error Responses:**
- `401`: User not authenticated
- `403`: User is not an Owner of the tenant
- `404`: Tenant not found

---

### GET /api/tenants/:tenantId/users

Lists all users who are members of the tenant.

**Authorization:** Owner only

**Purpose:** Allows Owners to see all team members, their roles, and membership status. This is essential for team management, showing who has access to the tenant and what permissions they have. The list includes both active and pending members.

**Query Parameters:**
- `limit` (number, optional): Results per page (default: 25, max: 100)
- `offset` (number, optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "data": [
    {
      "userId": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "role": "Owner",
      "status": "active",
      "joinedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "total": 10,
    "limit": 25,
    "offset": 0,
    "hasMore": false
  }
}
```

**Why it exists:** Team management requires visibility into all members. Owners need to audit access, understand team composition, and manage permissions.

**Error Responses:**
- `401`: User not authenticated
- `403`: User is not an Owner

---

### GET /api/tenants/:tenantId/users/:userId/role

Retrieves the role of a specific user within the tenant.

**Authorization:** Any tenant member

**Purpose:** Allows any tenant member to check what role another user has in the tenant. This is useful for permission checks in the UI and understanding team member capabilities. Unlike the full users list, this is available to all members since role information affects collaboration.

**Response (200):**
```json
{
  "userId": "uuid",
  "tenantId": "uuid",
  "role": "Employee"
}
```

**Why it exists:** Applications need to make permission-based decisions (e.g., "Should I show this user the admin button?"). This endpoint provides lightweight role checking without exposing full user lists to non-Owners.

**Error Responses:**
- `401`: User not authenticated
- `403`: Requester is not a member of the tenant
- `404`: Target user is not a member of the tenant

## Products

- POST /api/tenants/:tenantId/products (Owner)
  - Body: { name: string, sku?: string, description?: string, active?: boolean, defaultPriceId?: string, modifiers?: string[] }
  - 201: { id, name, sku, description, active, defaultPriceId, createdAt, updatedAt }
- GET /api/tenants/:tenantId/products (Member)
  - Query: q?: string, active?: boolean (default true), limit?: number, offset?: number
  - 200: { data: Array<{ id, name, sku, description, active, defaultPriceId }>, pagination: { total, limit, offset, hasMore } }
- GET /api/tenants/:tenantId/products/:productId (Member)
  - 200: { id, name, sku, description, active, defaultPriceId, createdAt, updatedAt }
- GET /api/tenants/:tenantId/products/:productId/modifiers (Member)
  - Query: limit?: number, offset?: number
  - 200: { data: Array<{ id, name, priceDelta: number, currency: string, active: boolean }>, pagination: { total, limit, offset, hasMore } }
- PATCH /api/tenants/:tenantId/products/:productId (Owner)
  - Body: { name?: string, sku?: string, description?: string, active?: boolean, defaultPriceId?: string, modifiers?: string[] }
  - 200: { id, name, sku, description, active, defaultPriceId, createdAt, updatedAt }
- DELETE /api/tenants/:tenantId/products/:productId (Owner)
  - 204 (soft delete: active=false)

## Modifiers

- POST /api/tenants/:tenantId/modifiers (Owner)
  - Body: { name: string, priceDelta: number, currency?: string, active?: boolean }
  - 201: { id, name, priceDelta: number, currency: string, active: boolean, createdAt, updatedAt }
- GET /api/tenants/:tenantId/modifiers (Member)
  - Query: q?: string, active?: boolean, limit?: number (default 25, max 100), offset?: number (default 0)
  - 200: { data: Array<{ id, name, priceDelta: number, currency: string, active: boolean, createdAt, updatedAt }>, pagination: { total, limit, offset, hasMore } }
- PATCH /api/tenants/:tenantId/modifiers/:modifierId (Owner)
  - Body: { name?: string, priceDelta?: number, active?: boolean }
  - 200: { id, name, priceDelta: number, currency: string, active: boolean, createdAt, updatedAt }
- DELETE /api/tenants/:tenantId/modifiers/:modifierId (Owner)
  - 204 (soft delete: active=false)

## Prices

- POST /api/tenants/:tenantId/products/:productId/prices (Owner)
  - Body: { amount: number, currency: string, validFrom?: string | null, validTo?: string | null }
  - 201: { id, amount: number, currency: string, validFrom: string | null, validTo: string | null }
- GET /api/tenants/:tenantId/products/:productId/prices (Member)
  - Query: limit?: number (default 25), offset?: number (default 0)
  - 200: { data: Array<{ id, amount: number, currency: string, validFrom: string | null, validTo: string | null }>, pagination: { total, limit, offset, hasMore } }
- GET /api/tenants/:tenantId/products/:productId/prices/:priceId (Member)
  - 200: { id, productId, tenantId, amount: number, currency: string, validFrom: string | null, validTo: string | null }
- PATCH /api/tenants/:tenantId/products/:productId/prices/:priceId (Owner)
  - Body: { amount?: number, currency?: string (must match existing), validFrom?: string | null, validTo?: string | null }
  - 200: { id, amount: number, currency: string, validFrom: string | null, validTo: string | null }
- DELETE /api/tenants/:tenantId/products/:productId/prices/:priceId (Owner)
  - 204

## Points of Sale (POS)

- POST /api/tenants/:tenantId/pos (Owner)
  - Body: { name: string, slug?: string, location?: string | null, settings?: object | null }
  - 201: { id, name, slug, location: string | null, settings: object | null, createdAt, updatedAt }
- GET /api/tenants/:tenantId/pos (Member)
  - Query: limit?: number, offset?: number
  - 200: { data: Array<{ id, name, slug, location, settings, createdAt, updatedAt }>, pagination: { total, limit, offset, hasMore } }
- GET /api/tenants/:tenantId/pos/:posIdOrSlug (Member)
  - 200: { id, name, slug, location, settings, createdAt, updatedAt }
- PATCH /api/tenants/:tenantId/pos/:posId (Owner)
  - Body: { name?: string, slug?: string, location?: string | null, settings?: object | null }
  - 200: { id, name, slug, location, settings, createdAt, updatedAt }
- DELETE /api/tenants/:tenantId/pos/:posId (Owner)
  - 204

## POS Members

- POST /api/tenants/:tenantId/pos/:posId/members (Owner)
  - Body: { userId: string }
  - 201: { id, posId, userId, createdAt, updatedAt }
- GET /api/tenants/:tenantId/pos/:posId/members (Owner)
  - Query: limit?: number (default 25), offset?: number (default 0)
  - 200: { data: Array<{ id, posId, userId, userName, userEmail, createdAt, updatedAt }>, pagination: { total, limit, offset, hasMore } }
- DELETE /api/tenants/:tenantId/pos/:posId/members/:userId (Owner)
  - 204

## Orders

- POST /api/tenants/:tenantId/pos/:posId/orders (Owner or assigned Employee)
  - Body: { items: Array<{ productId: string, quantity: number, priceId?: string, modifiers?: string[], notes?: string }>, totalAmount: number, currency: string, meta?: object }
  - 201: { orderId: string, status: "received", createdAt: string, items: Array<{ productId, quantity, appliedModifiers?: Array<{ modifierId, name, priceDelta }>, lineTotal: number }>, totalAmount: number, currency: string }
- GET /api/tenants/:tenantId/pos/:posId/orders (Owner or assigned Employee)
  - Query: status?: string, dateFrom?: string, dateTo?: string, limit?: number (default 25, max 100), offset?: number (default 0)
  - 200: { data: Array<{ orderId, status, totalAmount: number, currency: string, createdAt: string, items: Array<{ productId, quantity, notes?: string, priceCentsSnapshot: number, modifiers: Array<{ modifierId, name, priceDeltaCents }> }> }>, pagination: { total, limit, offset, hasMore } }

## Stock

- POST /api/tenants/:tenantId/stock (Owner)
  - Body: { productId: string, quantity: number, posId?: string }
  - 201: { id, productId, posId: string | null, quantity }
- GET /api/tenants/:tenantId/stock (Member)
  - Query: productId?: string, posId?: string, limit?: number (default 25), offset?: number (default 0)
  - 200: { data: Array<{ id, productId, posId: string | null, quantity }>, pagination: { total, limit, offset, hasMore } }
- PATCH /api/tenants/:tenantId/stock/:stockId (Owner)
  - Body: { quantity?: number, posId?: string | null }
  - 200: { id, productId, posId: string | null, quantity }

## Settings

- GET /api/tenants/:tenantId/settings (Member)
  - 200: { timezone: string, currency: string }
- PATCH /api/tenants/:tenantId/settings (Owner)
  - Body: { timezone?: string, currency?: string }
  - 200: { timezone: string, currency: string }
---

## Products

Products represent the items or services that a business sells. The product system supports complex pricing, modifiers, categorization, and inventory management.

### POST /api/tenants/:tenantId/products

Creates a new product in the tenant's catalog.

**Authorization:** Owner only

**Purpose:** Allows Owners to add new products to their catalog. Products are the core items that can be sold through the POS system. Each product can have multiple prices (for different time periods), modifiers (add-ons), and stock levels. This is the foundation of inventory management.

**Request Body:**
- `name` (string, required): Product name
- `sku` (string, optional): Stock Keeping Unit for inventory tracking
- `description` (string, optional): Product description
- `category` (string, optional): Product category for organization
- `active` (boolean, optional): Whether product is available for sale (default: true)
- `defaultPriceId` (string, optional): ID of the default price
- `modifiers` (string[], optional): Array of modifier IDs to associate

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Cheeseburger",
  "sku": "BURGER-001",
  "description": "Classic cheeseburger",
  "category": "Burgers",
  "active": true,
  "defaultPriceId": "price-uuid",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Why it exists:** Businesses need to manage their product catalog. Products can be activated/deactivated, organized by category, and tracked via SKU. The modifiers field enables rich product customization (e.g., "Add bacon" or "Extra cheese").

**Error Responses:**
- `400`: Missing required fields or validation error
- `401`: Not authenticated
- `403`: User is not an Owner
- `409`: SKU already exists within tenant

---

### POST /api/tenants/:tenantId/products/bulk

Creates a product with price, stock, and modifiers in a single transaction.

**Authorization:** Owner only

**Purpose:** Provides an efficient way to create a complete product setup (product + price + stock + modifiers) in one atomic operation. This is particularly useful for initial catalog setup, imports, or POS systems where products need to be immediately available with pricing and stock. If any step fails, the entire operation rolls back, ensuring data consistency.

**Request Body:**
- `name` (string, required): Product name
- `sku` (string, optional): Stock Keeping Unit
- `description` (string, optional): Product description
- `category` (string, optional): Product category
- `active` (boolean, optional): Active status
- `modifiers` (string[], optional): Modifier IDs
- `price` (object, required):
  - `amount` (number, required): Price amount (decimal, e.g., 12.99)
  - `currency` (string, required): ISO currency code
- `stock` (object, optional):
  - `quantity` (number, required): Initial stock quantity
  - `posId` (string, optional): Point of sale location for this stock

**Response (201):**
```json
{
  "product": {
    "id": "uuid",
    "name": "Cheeseburger",
    "sku": "BURGER-001",
    "active": true,
    "defaultPriceId": "price-uuid",
    ...
  },
  "price": {
    "id": "price-uuid",
    "amount": 12.99,
    "currency": "USD",
    ...
  },
  "stock": {
    "id": "stock-uuid",
    "quantity": 100,
    "posId": "pos-uuid"
  }
}
```

**Why it exists:** Creating products often requires setting up multiple related records. This bulk endpoint ensures atomicity (all-or-nothing), reduces network round-trips, and simplifies client logic. It's essential for data imports and rapid catalog setup.

**Error Responses:**
- `400`: Validation error (missing fields, invalid modifiers, etc.)
- `401`: Not authenticated
- `403`: User is not an Owner
- `409`: SKU already exists
- `422`: Invalid modifier IDs or negative stock quantity

---

### GET /api/tenants/:tenantId/products

Lists products in the tenant's catalog with filtering and pagination.

**Authorization:** Any tenant member

**Purpose:** Retrieves the product catalog for display in POS systems, inventory management, or reporting. Supports filtering by name/SKU search and active status, plus pagination for large catalogs. Employees can view products to create orders, while Owners use this for catalog management.

**Query Parameters:**
- `q` (string, optional): Search query (matches name or SKU)
- `active` (boolean, optional): Filter by active status (default: true)
- `limit` (number, optional): Results per page (default: 25, max: 100)
- `offset` (number, optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Cheeseburger",
      "sku": "BURGER-001",
      "description": "Classic cheeseburger",
      "category": "Burgers",
      "active": true,
      "defaultPriceId": "price-uuid"
    }
  ],
  "pagination": {
    "total": 50,
    "limit": 25,
    "offset": 0,
    "hasMore": true
  }
}
```

**Why it exists:** Product catalogs can be large. Pagination and filtering are essential for performance. The search feature enables quick product lookup in busy POS environments.

**Error Responses:**
- `401`: Not authenticated
- `403`: User is not a tenant member

---

### GET /api/tenants/:tenantId/products/:productId

Retrieves detailed information about a specific product.

**Authorization:** Any tenant member

**Purpose:** Provides complete product details including all metadata. Used for product detail pages, order creation, and inventory management. Employees need this to select products when creating orders.

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Cheeseburger",
  "sku": "BURGER-001",
  "description": "Classic cheeseburger",
  "category": "Burgers",
  "active": true,
  "defaultPriceId": "price-uuid",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Error Responses:**
- `401`: Not authenticated
- `403`: User is not a tenant member
- `404`: Product not found or belongs to different tenant

---

### GET /api/tenants/:tenantId/products/:productId/modifiers

Lists all modifiers associated with a specific product.

**Authorization:** Any tenant member

**Purpose:** Retrieves the customization options (modifiers) available for a product. Essential for POS systems where customers can add extras to products. For example, a burger might have modifiers like "Extra Cheese", "Add Bacon", or "No Onions". These modifiers affect the final price and must be displayed to employees creating orders.

**Query Parameters:**
- `limit` (number, optional): Results per page (default: 25, max: 100)
- `offset` (number, optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Extra Cheese",
      "priceDelta": 1.00,
      "currency": "USD",
      "active": true
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 25,
    "offset": 0,
    "hasMore": false
  }
}
```

**Why it exists:** Products often have customizable options. This endpoint provides the available choices for a product, enabling dynamic order creation and accurate pricing.

**Error Responses:**
- `401`: Not authenticated
- `403`: User is not a tenant member
- `404`: Product not found

---

### PATCH /api/tenants/:tenantId/products/:productId

Updates an existing product's information.

**Authorization:** Owner only

**Purpose:** Allows Owners to modify product details such as name, description, pricing, active status, or associated modifiers. All fields are optional - only provided fields are updated. This enables flexible product management without requiring full object replacement.

**Request Body:** (all fields optional)
- `name` (string): Product name
- `sku` (string): Stock Keeping Unit
- `description` (string): Product description
- `category` (string): Product category
- `active` (boolean): Active status
- `defaultPriceId` (string): Default price ID
- `modifiers` (string[]): Array of modifier IDs

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Updated Cheeseburger",
  "sku": "BURGER-001",
  "description": "Updated description",
  "category": "Burgers",
  "active": true,
  "defaultPriceId": "price-uuid",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-02T00:00:00Z"
}
```

**Why it exists:** Products need ongoing maintenance - prices change, descriptions improve, availability shifts. Partial updates are more efficient and safer than full replacements.

**Error Responses:**
- `400`: Validation error
- `401`: Not authenticated
- `403`: User is not an Owner
- `404`: Product not found

---

### DELETE /api/tenants/:tenantId/products/:productId

Soft-deletes a product (sets active=false and closes all prices).

**Authorization:** Owner only

**Purpose:** "Deletes" a product by marking it inactive rather than physically removing it. This preserves historical order data that references the product while preventing new orders from being created with it. Also automatically closes all associated prices by setting their `validTo` date to now, ensuring price integrity. This soft-delete approach maintains data integrity for reporting and auditing.

**Response (204):** No content

**Why it exists:** Physical deletion would break foreign key relationships in orders and create data inconsistencies. Soft deletion maintains referential integrity while removing products from active use. The automatic price closure ensures no orphaned active prices exist for inactive products.

**Error Responses:**
- `401`: Not authenticated
- `403`: User is not an Owner
- `404`: Product not found

## Modifiers

### POST /tenants/:tenantId/modifiers
**Description:** Create a new modifier

**Parameters:**
- `name` (string, required): Modifier name
- `description` (string, optional): Modifier description
- `price` (number, optional): Modifier price
- `active` (boolean, optional): Whether modifier is active

**Response:** Modifier object with ID and metadata

### GET /tenants/:tenantId/modifiers
**Description:** List modifiers in a tenant

**Query Parameters:**
- `limit` (number, optional): Number of results per page
- `offset` (number, optional): Pagination offset
- `active` (boolean, optional): Filter by active status
- `q` (string, optional): Search query

**Response:** Paginated list of modifier objects

### GET /tenants/:tenantId/modifiers/:modifierId
**Description:** Get modifier details

**Parameters:** None

**Response:** Complete modifier object

### PUT /tenants/:tenantId/modifiers/:modifierId
**Description:** Update a modifier

**Parameters:** Same as POST, all optional

**Response:** Updated modifier object

### DELETE /tenants/:tenantId/modifiers/:modifierId
**Description:** Delete a modifier

**Parameters:** None

**Response:** Success confirmation

### POST /tenants/:tenantId/products/:productId/modifiers
**Description:** Associate a modifier with a product

**Parameters:**
- `modifierId` (string, required): Modifier ID to associate

**Response:** Association confirmation

### GET /tenants/:tenantId/products/:productId/modifiers
**Description:** Get modifiers associated with a product

**Parameters:** None

**Response:** List of associated modifier objects

## Prices

### POST /api/tenants/:tenantId/products/:productId/prices

Creates a new price for a product.

**Authorization:** Owner only

**Purpose:** Allows Owners to set prices for products with optional validity date ranges. This enables sophisticated pricing strategies such as temporary discounts, time-based pricing, or seasonal rates. Each product can have multiple prices that are active at different times.

**Request Body:**
- `amount` (number, required): Price amount in decimal format (e.g., 12.99)
- `currency` (string, required): ISO 4217 currency code (e.g., "USD", "EUR")
- `validFrom` (string, optional): ISO 8601 timestamp when price becomes effective (default: now)
- `validTo` (string | null, optional): ISO 8601 timestamp when price expires (null = no expiration)

**Response (201):**
```json
{
  "id": "uuid",
  "amount": 12.99,
  "currency": "USD",
  "validFrom": "2024-01-01T00:00:00.000Z",
  "validTo": "2024-12-31T23:59:59.000Z"
}
```

**Error Responses:**
- `400`: Validation error or missing required fields
- `401`: Not authenticated
- `403`: User is not an Owner
- `404`: Product not found
- `422`: Currency mismatch with tenant settings or invalid date range (validTo before validFrom)

---

### GET /api/tenants/:tenantId/products/:productId/prices

Lists all prices for a specific product with pagination.

**Authorization:** Any tenant member

**Purpose:** Retrieves the price history for a product, including current and future pricing. Used for price management, displaying available pricing options, and historical price tracking. Employees can view this to understand pricing for orders.

**Query Parameters:**
- `limit` (number, optional): Results per page (default: 25, max: 100)
- `offset` (number, optional): Pagination offset (default: 0)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "amount": 12.99,
      "currency": "USD",
      "validFrom": "2024-01-01T00:00:00.000Z",
      "validTo": "2024-12-31T23:59:59.000Z"
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 25,
    "offset": 0,
    "hasMore": false
  }
}
```

**Error Responses:**
- `401`: Not authenticated
- `403`: User is not a tenant member
- `404`: Product not found

---

### GET /api/tenants/:tenantId/products/:productId/prices/:priceId

Retrieves detailed information about a specific price.

**Authorization:** Any tenant member

**Purpose:** Provides complete details for a specific price associated with a product. Used when you need to view or retrieve price information for display, editing, or order creation. Any tenant member can access this endpoint - Employees can view prices for creating orders, while Owners use it for price management and reporting.

**URL Parameters:**
- `tenantId` (string, required): The tenant ID
- `productId` (string, required): The product ID
- `priceId` (string, required): The price ID to retrieve

**Response (200):**
```json
{
  "id": "5afcc722-49b2-4c57-9120-4883486259b8",
  "productId": "76552fb0-75c5-4102-92a8-299600c150b1",
  "tenantId": "4bbcd705-5500-4f6e-9924-9f108b0a097e",
  "amount": 3.50,
  "currency": "USD",
  "validFrom": "2024-01-01T00:00:00.000Z",
  "validTo": "2024-12-31T23:59:59.000Z"
}
```

**Response Fields:**
- `id` (string): Unique price identifier
- `productId` (string): The product this price belongs to
- `tenantId` (string): The tenant this price belongs to
- `amount` (number): Price amount in decimal format (e.g., 3.50 for $3.50)
- `currency` (string): ISO 4217 currency code (e.g., "USD", "EUR")
- `validFrom` (string | null): ISO 8601 timestamp when this price becomes effective
- `validTo` (string | null): ISO 8601 timestamp when this price expires (null = no expiration)

**Why it exists:** Price information is needed for various operations - displaying prices in the UI, creating orders with specific prices, or managing price history. This endpoint provides a single, authoritative source for price details that can be used by any tenant member.

**Error Responses:**
- `401`: User is not authenticated. Provide a valid session cookie.
- `403`: User is not a member of the tenant. Only tenant members can access prices.
- `404`: Price not found. The price ID may not exist, belong to a different product, or the product doesn't exist.

**Example Usage:**

```bash
curl 'http://localhost:3000/api/tenants/4bbcd705-5500-4f6e-9924-9f108b0a097e/products/76552fb0-75c5-4102-92a8-299600c150b1/prices/5afcc722-49b2-4c57-9120-4883486259b8' \
  -H 'Cookie: better-auth.session_token=YOUR_SESSION_TOKEN'
```

---

### PATCH /api/tenants/:tenantId/products/:productId/prices/:priceId

Updates an existing price.

**Authorization:** Owner only

**Purpose:** Allows Owners to modify price details such as amount or validity dates. All fields are optional - only provided fields are updated. This enables flexible pricing management without requiring full price object replacement.

**Request Body:** (all fields optional)
- `amount` (number): Updated price amount
- `currency` (string): Must match existing currency (cannot change)
- `validFrom` (string | null): When price becomes effective
- `validTo` (string | null): When price expires

**Response (200):**
```json
{
  "id": "uuid",
  "amount": 14.99,
  "currency": "USD",
  "validFrom": "2024-02-01T00:00:00.000Z",
  "validTo": "2024-11-30T23:59:59.000Z"
}
```

**Error Responses:**
- `400`: Validation error or cannot change currency
- `401`: Not authenticated
- `403`: User is not an Owner
- `404`: Price not found
- `422`: Invalid date range (validTo before validFrom)

---

### DELETE /api/tenants/:tenantId/products/:productId/prices/:priceId

Deletes a price.

**Authorization:** Owner only

**Purpose:** Removes a price from a product. This is useful for cleaning up incorrect or outdated pricing. After deletion, this price cannot be used for new orders.

**Response (204):** No content

**Error Responses:**
- `401`: Not authenticated
- `403`: User is not an Owner
- `404`: Price not found

## POS (Point of Sale)

### POST /tenants/:tenantId/pos
**Description:** Create a new POS location

**Parameters:**
- `name` (string, required): POS location name
- `slug` (string, optional): URL-friendly identifier

**Response:** POS object with ID and metadata

### GET /tenants/:tenantId/pos
**Description:** List POS locations in a tenant

**Query Parameters:**
- `limit` (number, optional): Number of results per page
- `offset` (number, optional): Pagination offset

**Response:** Paginated list of POS objects

### GET /tenants/:tenantId/pos/:posId
**Description:** Get POS location details

**Parameters:** None

**Response:** Complete POS object

### PUT /tenants/:tenantId/pos/:posId
**Description:** Update a POS location

**Parameters:** Same as POST, all optional

**Response:** Updated POS object

### DELETE /tenants/:tenantId/pos/:posId
**Description:** Delete a POS location

**Parameters:** None

**Response:** Success confirmation

### POST /tenants/:tenantId/pos/:posId/members
**Description:** Add a user as a member of a POS location

**Parameters:**
- `userId` (string, required): User ID to add
- `role` (string, optional): Role in POS (default: member)

**Response:** Membership confirmation

### GET /tenants/:tenantId/pos/:posId/members
**Description:** List members of a POS location

**Query Parameters:**
- `limit` (number, optional): Number of results per page
- `offset` (number, optional): Pagination offset

**Response:** Paginated list of POS member objects

### DELETE /tenants/:tenantId/pos/:posId/members/:userId
**Description:** Remove a user from a POS location

**Parameters:** None

**Response:** Success confirmation

## Orders

### POST /tenants/:tenantId/pos/:posId/orders
**Description:** Create a new order

**Parameters:**
- `items` (array, required): Order items
- `total` (number, required): Order total
- `status` (string, optional): Order status

**Response:** Order object with ID and metadata

### GET /tenants/:tenantId/pos/:posId/orders
**Description:** List orders for a POS location

**Query Parameters:**
- `limit` (number, optional): Number of results per page
- `offset` (number, optional): Pagination offset

**Response:** Paginated list of order objects

## Stock

### POST /tenants/:tenantId/stock
**Description:** Create a stock entry

**Parameters:**
- `productId` (string, required): Product ID
- `quantity` (number, required): Stock quantity
- `location` (string, optional): Stock location

**Response:** Stock object with ID and metadata

### GET /tenants/:tenantId/stock
**Description:** List stock entries

**Query Parameters:**
- `limit` (number, optional): Number of results per page
- `offset` (number, optional): Pagination offset
- `productId` (string, optional): Filter by product ID

**Response:** Paginated list of stock objects

### GET /tenants/:tenantId/stock/:stockId
**Description:** Get stock entry details

**Parameters:** None

**Response:** Complete stock object

### PUT /tenants/:tenantId/stock/:stockId
**Description:** Update a stock entry

**Parameters:** Same as POST, all optional

**Response:** Updated stock object

## Settings

### GET /tenants/:tenantId/settings
**Description:** Get tenant settings

**Parameters:** None

**Response:** Key-value pairs of tenant settings

### PUT /tenants/:tenantId/settings
**Description:** Update tenant settings

**Parameters:** Object with setting key-value pairs to update

**Response:** Updated settings object
