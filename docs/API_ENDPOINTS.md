# API Endpoints Documentation

This document provides a comprehensive overview of all API endpoints in the Cartaya API project.

## Overview

All endpoints return JSON responses and use session-based authentication via Better Auth unless otherwise noted. The API follows RESTful conventions with proper HTTP status codes.

**General Notes:**
- Tenant-scoped routes are under `/api/tenants/:tenantId/*` and require tenant membership
- Two roles exist: **Owner** (full access) and **Employee** (limited access)
- Pagination uses `limit` and `offset` query parameters (defaults: limit=25, offset=0, max=100)
- Monetary values are returned as decimals (e.g., 12.99) but stored internally as integer cents
- All timestamps are ISO 8601 strings (UTC)
- Query parameters arrive as strings and are validated/parsed to numbers where applicable

## Health

### GET /

**Authorization:** Public

**Response (200):** `Hello Hono!` (text)

---

### GET /up

**Authorization:** Public

**Response (200):** `ok` (text)

---

### GET /health

**Authorization:** Public

**Response (200):** `ok` (text)

---

## Authentication (/api/auth/*)

All `/api/auth/*` routes are handled by Better Auth (mounted for `GET` and `POST`). The list below reflects the core endpoints plus plugin endpoints enabled in `src/lib/auth/auth.ts` (admin, bearer, polar). Additional endpoints can be added by other plugins or configuration.

### Core: Email & Password

#### POST /api/auth/sign-up/email

**Request Body:**
- `name: string`
- `email: string`
- `password: string`
- `image?: string`
- `callbackURL?: string`
- `rememberMe?: boolean`

**Response (200):** `{ token: string | null, user: object }`

---

#### POST /api/auth/sign-in/email

**Request Body:**
- `email: string`
- `password: string`
- `callbackURL?: string`
- `rememberMe?: boolean`

**Response (200):** `{ redirect: boolean, token: string, url?: string, user: object }`

---

#### POST /api/auth/sign-out

**Request Body:** `{}`

**Response (200):** `{ success: boolean }` (clears session)

---

### Core: Sessions

#### GET /api/auth/get-session

**Query Parameters:**
- `disableCookieCache?: boolean`
- `disableRefresh?: boolean`

**Response (200):** `{ session: object, user: object } | null`

---

#### GET /api/auth/list-sessions

**Authorization:** Authenticated user required

**Response (200):** `Session[]`

---

#### POST /api/auth/revoke-session

**Authorization:** Authenticated user required (fresh session)

**Request Body:**
- `token: string`

**Response (200):** `{ status: boolean }`

---

#### POST /api/auth/revoke-sessions

**Authorization:** Authenticated user required (fresh session)

**Response (200):** `{ status: boolean }`

---

#### POST /api/auth/revoke-other-sessions

**Authorization:** Authenticated user required (fresh session)

**Response (200):** `{ status: boolean }`

---

### Core: Email Verification

#### POST /api/auth/send-verification-email

**Request Body:**
- `email: string`
- `callbackURL?: string`

**Response (200):** `{ status: boolean }`

---

#### GET /api/auth/verify-email

**Query Parameters:**
- `token: string`
- `callbackURL?: string`

**Response (200):** `{ status: boolean, user?: object | null }`

---

### Core: Password Reset & Verification

#### POST /api/auth/request-password-reset

**Request Body:**
- `email: string`
- `redirectTo?: string`

**Response (200):** `{ status: boolean, message: string }`

---

#### GET /api/auth/reset-password/:token

**Query Parameters:**
- `callbackURL: string`

**Response (200):** `{ token: string }` (redirects to callback URL)

---

#### POST /api/auth/reset-password

**Request Body:**
- `newPassword: string`
- `token?: string`

**Query Parameters:**
- `token?: string`

**Response (200):** `{ status: boolean }`

---

#### POST /api/auth/verify-password

**Authorization:** Authenticated user required (fresh session)

**Request Body:**
- `password: string`

**Response (200):** `{ status: boolean }`

---

### Core: User Profile

#### POST /api/auth/update-user

**Authorization:** Authenticated user required

**Request Body:**
- `name?: string`
- `image?: string | null`
- `...additionalFields`

**Response (200):** `{ status: true }`

---

#### POST /api/auth/change-password

**Authorization:** Authenticated user required (fresh session)

**Request Body:**
- `newPassword: string`
- `currentPassword: string`
- `revokeOtherSessions?: boolean`

**Response (200):** `{ token?: string | null, user: object }`

---

#### POST /api/auth/set-password

**Authorization:** Authenticated user required (fresh session)

**Request Body:**
- `newPassword: string`

**Response (200):** `{ status: boolean }`

---

#### POST /api/auth/change-email

**Authorization:** Authenticated user required (fresh session)

**Request Body:**
- `newEmail: string`
- `callbackURL?: string`

**Response (200):** `{ status: boolean, message?: string, user?: object }`

---

#### POST /api/auth/delete-user

**Authorization:** Authenticated user required (fresh session)

**Request Body:**
- `callbackURL?: string`
- `password?: string`
- `token?: string`

**Response (200):** `{ success: boolean, message: string }`

---

#### GET /api/auth/delete-user/callback

**Query Parameters:**
- `token: string`
- `callbackURL?: string`

**Response (200):** `{ success: boolean, message: string }`

---

### Core: Social Sign-In & OAuth

#### POST /api/auth/sign-in/social

**Request Body:**
- `provider: string` (social provider id)
- `callbackURL?: string`
- `newUserCallbackURL?: string`
- `errorCallbackURL?: string`
- `disableRedirect?: boolean`
- `scopes?: string[]`
- `requestSignUp?: boolean`
- `loginHint?: string`
- `additionalData?: Record<string, unknown>`
- `idToken?: { token: string, nonce?: string, accessToken?: string, refreshToken?: string, expiresAt?: number }`

**Response (200):** `{ redirect: boolean, url?: string, token?: string, user?: object }`

---

#### GET|POST /api/auth/callback/:id

**Query/Body Parameters:**
- `code?: string`
- `state?: string`
- `error?: string`
- `error_description?: string`
- `device_id?: string`
- `user?: string`

**Response:** Redirects to provider callback URL

---

### Core: Accounts & Tokens

#### GET /api/auth/list-accounts

**Authorization:** Authenticated user required

**Response (200):** `Array<{ id: string, providerId: string, accountId: string, userId: string, scopes: string[], createdAt: string, updatedAt: string }>`

---

#### POST /api/auth/link-social

**Authorization:** Authenticated user required

**Request Body:**
- `provider: string`
- `callbackURL?: string`
- `idToken?: { token: string, nonce?: string, accessToken?: string, refreshToken?: string, scopes?: string[] }`
- `requestSignUp?: boolean`
- `scopes?: string[]`
- `errorCallbackURL?: string`
- `disableRedirect?: boolean`
- `additionalData?: Record<string, unknown>`

**Response (200):** `{ url: string, redirect: boolean, status?: boolean }`

---

#### POST /api/auth/unlink-account

**Authorization:** Authenticated user required (fresh session)

**Request Body:**
- `providerId: string`
- `accountId?: string`

**Response (200):** `{ status: boolean }`

---

#### POST /api/auth/get-access-token

**Request Body:**
- `providerId: string`
- `accountId?: string`
- `userId?: string`

**Response (200):** `{ accessToken: string, accessTokenExpiresAt?: string, idToken?: string, scopes?: string[] }`

---

#### POST /api/auth/refresh-token

**Request Body:**
- `providerId: string`
- `accountId?: string`
- `userId?: string`

**Response (200):** `{ accessToken: string, refreshToken: string, accessTokenExpiresAt?: string, refreshTokenExpiresAt?: string, scope?: string, idToken?: string }`

---

#### GET /api/auth/account-info

**Authorization:** Authenticated user required

**Query Parameters:**
- `accountId?: string`

**Response (200):** `{ user: object, data: object }`

---

### Admin Plugin (enabled)

#### POST /api/auth/admin/create-user

**Authorization:** Admin user required

**Request Body:**
- `email: string`
- `password?: string`
- `name: string`
- `role?: string | string[]`
- `data?: Record<string, unknown>`

**Response (200):** `{ user: object }`

---

#### GET /api/auth/admin/get-user

**Authorization:** Admin user required

**Query Parameters:**
- `id: string`

**Response (200):** `{ user: object }`

---

#### GET /api/auth/admin/list-users

**Authorization:** Admin user required

**Query Parameters:**
- `searchValue?: string`
- `searchField?: "email" | "name"`
- `searchOperator?: "contains" | "starts_with" | "ends_with"`
- `limit?: string | number`
- `offset?: string | number`
- `sortBy?: string`
- `sortDirection?: "asc" | "desc"`
- `filterField?: string`
- `filterValue?: string | number | boolean`
- `filterOperator?: "eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "contains"`

**Response (200):** `{ users: object[], total: number, limit?: number, offset?: number }`

---

#### POST /api/auth/admin/set-role

**Authorization:** Admin user required

**Request Body:**
- `userId: string`
- `role: string | string[]`

**Response (200):** `{ user: object }`

---

#### POST /api/auth/admin/set-user-password

**Authorization:** Admin user required

**Request Body:**
- `userId: string`
- `newPassword: string`

**Response (200):** `{ status: boolean }`

---

#### POST /api/auth/admin/update-user

**Authorization:** Admin user required

**Request Body:**
- `userId: string`
- `data: Record<string, unknown>`

**Response (200):** `{ user: object }`

---

#### POST /api/auth/admin/ban-user

**Authorization:** Admin user required

**Request Body:**
- `userId: string`
- `banReason?: string`
- `banExpiresIn?: number`

**Response (200):** `{ user: object }`

---

#### POST /api/auth/admin/unban-user

**Authorization:** Admin user required

**Request Body:**
- `userId: string`

**Response (200):** `{ user: object }`

---

#### POST /api/auth/admin/list-user-sessions

**Authorization:** Admin user required

**Request Body:**
- `userId: string`

**Response (200):** `{ sessions: Session[] }`

---

#### POST /api/auth/admin/revoke-user-session

**Authorization:** Admin user required

**Request Body:**
- `sessionToken: string`

**Response (200):** `{ success: boolean }`

---

#### POST /api/auth/admin/revoke-user-sessions

**Authorization:** Admin user required

**Request Body:**
- `userId: string`

**Response (200):** `{ success: boolean }`

---

#### POST /api/auth/admin/impersonate-user

**Authorization:** Admin user required

**Request Body:**
- `userId: string`

**Response (200):** `{ session: object, user: object }`

---

#### POST /api/auth/admin/stop-impersonating

**Authorization:** Admin user required

**Request Body:** `{}`

**Response (200):** `{ session: object, user: object }`

---

#### POST /api/auth/admin/remove-user

**Authorization:** Admin user required

**Request Body:**
- `userId: string`

**Response (200):** `{ success: boolean }`

---

#### POST /api/auth/admin/has-permission

**Authorization:** Admin user required (or role specified)

**Request Body:**
- `userId?: string`
- `role?: string`
- `permissions: Record<string, string[]>` (or legacy `permission`)

**Response (200):** `{ success: boolean, error?: string | null }`

---

### Bearer Plugin (enabled)

The Bearer plugin does not add HTTP endpoints. It adds support for authenticating with `Authorization: Bearer <token>` and returns a `set-auth-token` header on sign-in responses.

---

### Polar Plugin (enabled)

#### POST /api/auth/checkout

**Authorization:** Authenticated user required if `authenticatedUsersOnly` is true

**Request Body:**
- `products?: string | string[]`
- `slug?: string`
- `referenceId?: string`
- `customFieldData?: Record<string, string | number | boolean>`
- `metadata?: Record<string, string | number | boolean>`
- `allowDiscountCodes?: boolean`
- `discountId?: string`
- `redirect?: boolean`
- `embedOrigin?: string`

**Response (200):** `{ url: string, redirect: boolean }`

---

#### GET /api/auth/customer/portal

**Authorization:** Authenticated user required

**Response (200):** `{ url: string, redirect: boolean }`

---

#### GET /api/auth/customer/state

**Authorization:** Authenticated user required

**Response (200):** `Polar customer state object`

---

#### GET /api/auth/customer/benefits/list

**Authorization:** Authenticated user required

**Query Parameters:**
- `page?: number`
- `limit?: number`

**Response (200):** `Polar benefits list`

---

#### GET /api/auth/customer/subscriptions/list

**Authorization:** Authenticated user required

**Query Parameters:**
- `referenceId?: string`
- `page?: number`
- `limit?: number`
- `active?: boolean`

**Response (200):** `Polar subscriptions list`

---

#### GET /api/auth/customer/orders/list

**Authorization:** Authenticated user required

**Query Parameters:**
- `page?: number`
- `limit?: number`
- `productBillingType?: "recurring" | "one_time"`

**Response (200):** `Polar orders list`

---

#### GET /api/auth/usage/meters/list

**Authorization:** Authenticated user required

**Query Parameters:**
- `page?: number`
- `limit?: number`

**Response (200):** `Polar customer meters list`

---

#### POST /api/auth/usage/ingest

**Authorization:** Authenticated user required

**Request Body:**
- `event: string`
- `metadata: Record<string, string | number | boolean>`

**Response (200):** `Polar ingestion response`

---

#### POST /api/auth/polar/webhooks

**Authorization:** Webhook signature (Polar)

**Request Body:** Raw webhook payload

**Response (200):** `{ received: true }`

---

**Note:** If you enable Better Auth OpenAPI plugin, the full schema is available at `/api/auth/reference`.

---

## User Settings

### GET /api/users/me/settings

**Authorization:** Authenticated user required

**Response (200):** `{ preferredLanguage: string, theme: string }`

**Error Responses:** `401`

---

### PATCH /api/users/me/settings

**Authorization:** Authenticated user required

**Request Body:**
- `preferredLanguage?: string`
- `theme?: string`

**Response (200):** `{ preferredLanguage: string, theme: string }`

**Error Responses:** `400`, `401`, `404`, `500`

---

## Invites

### POST /api/tenants/:tenantId/invites

**Authorization:** Owner only

**Request Body:**
- `email: string`
- `role: "Owner" | "Employee"`
- `expiresInHours?: number`

**Response (201):** `{ inviteId: string, email: string, role: string, inviteUrl: string }`

**Error Responses:** `400`, `401`, `403`, `409`, `422`, `500`

---

### POST /api/tenants/:tenantId/invites/:inviteId/resend

**Authorization:** Owner only

**Response (200):**
```
{
  inviteId: string,
  email: string,
  role: string,
  inviteUrl: string,
  resentAt: string,
  expiresAt: string
}
```

**Error Responses:** `401`, `403`, `404`, `422`, `500`

---

### DELETE /api/tenants/:tenantId/invites/:inviteId

**Authorization:** Owner only

**Response (204):** No content

**Error Responses:** `401`, `403`, `404`, `422`, `500`

---

### POST /auth/invite/accept

**Authorization:** Public

**Request Body:**
- `token: string`
- `name: string`
- `password: string`

**Response (201):**
```
{
  user: { id: string, email: string, name: string },
  tenant: { id: string, name: string } | null,
  role: "Owner" | "Employee"
}
```

**Error Responses:** `400`, `401`, `404`, `409`, `422`, `500`

---

## Tenants

### POST /api/tenants

**Authorization:** Authenticated user required

**Request Body:**
- `name: string`
- `settings?: { timezone?: string, currency?: string }`

**Response (201):** `{ id: string, name: string, createdAt: string, updatedAt: string }`

**Error Responses:** `400`, `401`, `500`

---

### GET /api/tenants

**Authorization:** Authenticated user required

**Response (200):** `{ data: Array<{ id: string, name: string, role: string, createdAt: string, updatedAt: string }> }`

**Error Responses:** `401`, `500`

---

### GET /api/tenants/:tenantId

**Authorization:** Owner only

**Response (200):**
```
{
  id: string,
  name: string,
  createdAt: string,
  updatedAt: string,
  settings: Record<string, string>
}
```

**Error Responses:** `401`, `403`, `404`, `500`

---

### GET /api/tenants/:tenantId/users

**Authorization:** Owner only

**Query Parameters:**
- `limit?: number`
- `offset?: number`

**Response (200):**
```
{
  data: Array<{ userId: string, email: string, name: string, role: string, status: string, joinedAt: string }>,
  pagination: { total: number, limit: number, offset: number, hasMore: boolean }
}
```

**Error Responses:** `401`, `403`, `500`

---

### GET /api/tenants/:tenantId/users/:userId/role

**Authorization:** Tenant member

**Response (200):** `{ userId: string, tenantId: string, role: string }`

**Error Responses:** `401`, `403`, `404`, `500`

---

## Tenant Settings

### GET /api/tenants/:tenantId/settings

**Authorization:** Tenant member

**Response (200):** `{ timezone: string, currency: string }`

**Error Responses:** `401`, `404`, `500`

---

### PATCH /api/tenants/:tenantId/settings

**Authorization:** Owner only

**Request Body:**
- `timezone?: string`
- `currency?: string`

**Response (200):** `{ timezone: string, currency: string }`

**Error Responses:** `400`, `401`, `403`, `404`, `500`

---

## Products

### POST /api/tenants/:tenantId/products

**Authorization:** Owner only

**Request Body:**
- `name: string`
- `sku?: string | null`
- `description?: string | null`
- `category?: string | null`
- `active?: boolean`
- `modifiers?: Array<string | { modifierId: string, includedQuantity?: number }>`
- `defaultPriceId?: string | null`

**Response (201):**
```
{
  id: string,
  name: string,
  sku: string | null,
  description: string | null,
  category: string | null,
  active: boolean,
  defaultPriceId: string | null,
  createdAt: string,
  updatedAt: string
}
```

**Error Responses:** `400`, `401`, `403`, `409`, `422`, `500`

---

### POST /api/tenants/:tenantId/products/bulk

**Authorization:** Owner only

**Request Body:**
- `name: string`
- `sku?: string | null`
- `description?: string | null`
- `category?: string | null`
- `active?: boolean`
- `modifiers?: Array<string | { modifierId: string, includedQuantity?: number }>`
- `price: object` (validated server-side)
- `stock?: object` (validated server-side)
- `defaultPriceId?: string | null`

**Response (201):** `{ product: object, price: object, stock?: object, modifiers?: object[] }`

**Error Responses:** `400`, `401`, `403`, `409`, `422`, `500`

---

### GET /api/tenants/:tenantId/products

**Authorization:** Tenant member

**Query Parameters:**
- `q?: string`
- `active?: "true" | "false"`
- `limit?: number`
- `offset?: number`

**Response (200):**
```
{
  data: Array<{ id: string, name: string, sku: string | null, description: string | null, category: string | null, active: boolean, defaultPriceId: string | null }>,
  pagination: { total: number, limit: number, offset: number, hasMore: boolean }
}
```

**Error Responses:** `400`, `401`, `403`, `500`

---

### GET /api/tenants/:tenantId/products/:productId

**Authorization:** Tenant member

**Response (200):**
```
{
  id: string,
  name: string,
  sku: string | null,
  description: string | null,
  category: string | null,
  active: boolean,
  defaultPriceId: string | null,
  createdAt: string,
  updatedAt: string
}
```

**Error Responses:** `401`, `403`, `404`, `500`

---

### GET /api/tenants/:tenantId/products/:productId/modifiers

**Authorization:** Tenant member

**Query Parameters:**
- `limit?: number`
- `offset?: number`

**Response (200):**
```
{
  data: Array<{ id: string, name: string, priceDelta: number, currency: string, active: boolean, isDefault: boolean, isRemovable: boolean }>,
  pagination: { total: number, limit: number, offset: number, hasMore: boolean }
}
```

**Error Responses:** `400`, `401`, `403`, `404`, `500`

---

### PATCH /api/tenants/:tenantId/products/:productId

**Authorization:** Owner only

**Request Body:**
- `name?: string`
- `sku?: string | null`
- `description?: string | null`
- `category?: string | null`
- `active?: boolean`
- `modifiers?: Array<string | { modifierId: string, includedQuantity?: number }>`
- `defaultPriceId?: string | null`

**Response (200):** (same as GET product)

**Error Responses:** `400`, `401`, `403`, `404`, `409`, `422`, `500`

---

### DELETE /api/tenants/:tenantId/products/:productId

**Authorization:** Owner only

**Response (204):** No content

**Error Responses:** `401`, `403`, `404`, `500`

---

## Modifiers

### POST /api/tenants/:tenantId/modifiers

**Authorization:** Owner only

**Request Body:**
- `name: string`
- `priceDelta: number`
- `currency?: string`
- `active?: boolean`
- `isDefault?: boolean`
- `isRemovable?: boolean`

**Response (201):**
```
{
  id: string,
  name: string,
  priceDelta: number,
  currency: string,
  active: boolean,
  isDefault: boolean,
  isRemovable: boolean,
  createdAt: string,
  updatedAt: string
}
```

**Error Responses:** `400`, `401`, `403`, `422`, `500`

---

### GET /api/tenants/:tenantId/modifiers

**Authorization:** Tenant member

**Query Parameters:**
- `q?: string`
- `active?: string` (`"true"` | `"false"`)
- `limit?: number`
- `offset?: number`

**Response (200):**
```
{
  data: Array<{ id: string, name: string, priceDelta: number, currency: string, active: boolean, isDefault: boolean, isRemovable: boolean, createdAt: string, updatedAt: string }>,
  pagination: { total: number, limit: number, offset: number, hasMore: boolean }
}
```

**Error Responses:** `401`, `403`, `500`

---

### PATCH /api/tenants/:tenantId/modifiers/:modifierId

**Authorization:** Owner only

**Request Body:**
- `name?: string`
- `priceDelta?: number`
- `active?: boolean`
- `isDefault?: boolean`
- `isRemovable?: boolean`

**Response (200):** (same as POST modifier)

**Error Responses:** `401`, `403`, `404`, `500`

---

### DELETE /api/tenants/:tenantId/modifiers/:modifierId

**Authorization:** Owner only

**Response (204):** No content

**Error Responses:** `401`, `403`, `404`, `500`

---

## Prices

### POST /api/tenants/:tenantId/products/:productId/prices

**Authorization:** Owner only

**Request Body:**
- `amount: number`
- `currency: string`
- `validFrom?: string` (timestamp)
- `validTo?: string` (timestamp)

**Response (201):** `{ id: string, amount: number, currency: string, validFrom: string | null, validTo: string | null }`

**Error Responses:** `400`, `401`, `403`, `404`, `422`, `500`

---

### GET /api/tenants/:tenantId/products/:productId/prices

**Authorization:** Tenant member

**Query Parameters:**
- `limit?: number`
- `offset?: number`

**Response (200):**
```
{
  data: Array<{ id: string, amount: number, currency: string, validFrom: string | null, validTo: string | null }>,
  pagination: { total: number, limit: number, offset: number, hasMore: boolean }
}
```

**Error Responses:** `401`, `403`, `404`, `500`

---

### GET /api/tenants/:tenantId/products/:productId/prices/:priceId

**Authorization:** Tenant member

**Response (200):** `{ id: string, productId: string, tenantId: string, amount: number, currency: string, validFrom: string | null, validTo: string | null }`

**Error Responses:** `401`, `403`, `404`, `500`

---

### PATCH /api/tenants/:tenantId/products/:productId/prices/:priceId

**Authorization:** Owner only

**Request Body:**
- `amount?: number`
- `currency?: string` (must match existing)
- `validFrom?: string | null` (timestamp)
- `validTo?: string | null` (timestamp)

**Response (200):** `{ id: string, amount: number, currency: string, validFrom: string | null, validTo: string | null }`

**Error Responses:** `400`, `401`, `403`, `404`, `422`, `500`

---

### DELETE /api/tenants/:tenantId/products/:productId/prices/:priceId

**Authorization:** Owner only

**Response (204):** No content

**Error Responses:** `401`, `403`, `404`, `500`

---

## Pictures

### POST /api/tenants/:tenantId/products/:productId/pictures

**Authorization:** Owner only

**Request Body (multipart/form-data):**
- `file: File`
- `title: string`
- `altText?: string | null`

**Response (201):** `{ id: string, title: string, altText: string | null, isMain: boolean, filename: string, thumbnail: string, createdAt: string }`

**Error Responses:** `400`, `401`, `403`, `404`, `500`

---

### GET /api/tenants/:tenantId/products/:productId/pictures

**Authorization:** Tenant member

**Query Parameters:**
- `limit?: number`
- `offset?: number`

**Response (200):**
```
{
  pictures: Array<{ id: string, title: string, altText: string | null, isMain: boolean, filename: string, thumbnail: string, displayOrder: number, createdAt: string }>,
  pagination: { total: number, limit: number, offset: number }
}
```

**Error Responses:** `400`, `401`, `403`, `404`, `500`

---

### GET /api/tenants/:tenantId/products/:productId/pictures/:pictureId

**Authorization:** Tenant member

**Response (200):** `{ id: string, title: string, altText: string | null, isMain: boolean, filename: string, thumbnail: string, displayOrder: number, createdAt: string, updatedAt: string }`

**Error Responses:** `401`, `403`, `404`, `500`

---

### PUT /api/tenants/:tenantId/products/:productId/pictures/:pictureId

**Authorization:** Owner only

**Request Body:**
- `title?: string`
- `altText?: string | null`

**Response (200):** (same as GET picture)

**Error Responses:** `401`, `403`, `404`, `500`

---

### PUT /api/tenants/:tenantId/products/:productId/pictures/:pictureId/main

**Authorization:** Owner only

**Response (200):** (same as GET picture)

**Error Responses:** `401`, `403`, `404`, `500`

---

### DELETE /api/tenants/:tenantId/products/:productId/pictures/:pictureId

**Authorization:** Owner only

**Response (204):** No content

**Error Responses:** `401`, `403`, `404`, `500`

---

## POS (Points of Sale)

### POST /api/tenants/:tenantId/pos

**Authorization:** Owner only

**Request Body:**
- `name: string`
- `slug?: string`
- `location?: string | null`
- `settings?: object | null`

**Response (201):** `{ id: string, name: string, slug: string | null, location: string | null, settings: object | null, createdAt: string, updatedAt: string }`

**Error Responses:** `400`, `401`, `403`, `409`, `422`, `500`

---

### GET /api/tenants/:tenantId/pos

**Authorization:** Tenant member

**Query Parameters:**
- `limit?: number`
- `offset?: number`

**Response (200):**
```
{
  data: Array<{ id: string, name: string, slug: string | null, location: string | null, settings: object | null, createdAt: string, updatedAt: string }>,
  pagination: { total: number, limit: number, offset: number, hasMore: boolean }
}
```

**Error Responses:** `400`, `401`, `403`, `500`

---

### GET /api/tenants/:tenantId/pos/:posIdOrSlug

**Authorization:** Tenant member

**Response (200):** `{ id: string, name: string, slug: string | null, location: string | null, settings: object | null, createdAt: string, updatedAt: string }`

**Error Responses:** `401`, `403`, `404`, `500`

---

### PATCH /api/tenants/:tenantId/pos/:posId

**Authorization:** Owner only

**Request Body:**
- `name?: string`
- `slug?: string`
- `location?: string | null`
- `settings?: object | null`

**Response (200):** (same as GET POS)

**Error Responses:** `400`, `401`, `403`, `404`, `409`, `422`, `500`

---

### DELETE /api/tenants/:tenantId/pos/:posId

**Authorization:** Owner only

**Response (204):** No content

**Error Responses:** `401`, `403`, `404`, `500`

---

## POS Members

### POST /api/tenants/:tenantId/pos/:posId/members

**Authorization:** Owner only

**Request Body:**
- `userId: string`

**Response (201):** `{ id: string, posId: string, userId: string, createdAt: string, updatedAt: string }`

**Error Responses:** `400`, `401`, `403`, `404`, `409`, `500`

---

### GET /api/tenants/:tenantId/pos/:posId/members

**Authorization:** Owner only

**Query Parameters:**
- `limit?: number`
- `offset?: number`

**Response (200):**
```
{
  data: Array<{ id: string, posId: string, userId: string, userName: string, userEmail: string, createdAt: string, updatedAt: string }>,
  pagination: { total: number, limit: number, offset: number, hasMore: boolean }
}
```

**Error Responses:** `400`, `401`, `403`, `404`, `500`

---

### DELETE /api/tenants/:tenantId/pos/:posId/members/:userId

**Authorization:** Owner only

**Response (204):** No content

**Error Responses:** `401`, `403`, `404`, `500`

---

## Orders

### POST /api/tenants/:tenantId/pos/:posId/orders

**Authorization:** Owner or assigned Employee

**Request Body:**
- `items: Array<{ productId: string, priceId?: string, quantity: number, modifiers?: Array<{ modifierId: string, quantity?: number }>, notes?: string }>`
- `totalAmount: number`
- `currency: string`
- `meta?: unknown`

**Response (201):**
```
{
  orderId: string,
  status: string,
  createdAt: string,
  items: Array<{ productId: string, name: string, quantity: number, basePrice: number, appliedModifiers?: Array<{ modifierId: string, name: string, priceDelta: number }>, lineTotal: number }>,
  totalAmount: number,
  currency: string
}
```

**Error Responses:** `400`, `401`, `403`, `404`, `422`, `500`

---

### GET /api/tenants/:tenantId/pos/:posId/orders

**Authorization:** Owner or assigned Employee

**Query Parameters:**
- `status?: string`
- `dateFrom?: string` (timestamp)
- `dateTo?: string` (timestamp)
- `limit?: number`
- `offset?: number`

**Response (200):**
```
{
  data: Array<{ orderId: string, status: string, totalAmount: number, currency: string, createdAt: string, items: Array<{ productId: string, quantity: number, notes?: string, priceCentsSnapshot: number, modifiers: Array<{ modifierId: string, name: string, priceDeltaCents: number }> }> }>,
  pagination: { total: number, limit: number, offset: number, hasMore: boolean }
}
```

**Error Responses:** `401`, `403`, `404`, `500`

---

## Stock

### POST /api/tenants/:tenantId/stock

**Authorization:** Owner only

**Request Body:**
- `productId: string`
- `quantity: number`
- `posId?: string`

**Response (201 or 200):** `{ id: string, productId: string, posId: string | null, quantity: number }`

**Error Responses:** `400`, `401`, `403`, `404`, `422`, `500`

---

### PATCH /api/tenants/:tenantId/stock/:stockId

**Authorization:** Owner only

**Request Body:**
- `quantity?: number`
- `posId?: string`

**Response (200):** `{ id: string, productId: string, posId: string | null, quantity: number }`

**Error Responses:** `400`, `401`, `403`, `404`, `422`, `500`

---

### GET /api/tenants/:tenantId/stock

**Authorization:** Tenant member

**Query Parameters:**
- `productId?: string`
- `posId?: string`
- `limit?: number`
- `offset?: number`

**Response (200):**
```
{
  data: Array<{ id: string, productId: string, posId: string | null, quantity: number }>,
  pagination: { total: number, limit: number, offset: number, hasMore: boolean }
}
```

**Error Responses:** `401`, `403`, `500`

---

### GET /api/tenants/:tenantId/stock-movements

**Authorization:** Tenant member (Owner sees all; Employee sees assigned POS + tenant-level)

**Query Parameters:**
- `productId?: string`
- `posId?: string`
- `movementType?: string`
- `dateFrom?: string` (timestamp)
- `dateTo?: string` (timestamp)
- `orderId?: string`
- `limit?: number`
- `offset?: number`

**Response (200):**
```
{
  data: Array<{ id: string, tenantId: string, stockId: string, productId: string, posId: string | null, movementType: string, quantityChange: number, quantityBefore: number, quantityAfter: number, orderId: string | null, createdBy: string | null, notes: string | null, createdAt: string }>,
  pagination: { total: number, limit: number, offset: number, hasMore: boolean }
}
```

**Error Responses:** `401`, `403`, `500`
