import { HttpErrorResponse } from '@angular/common/http';
import type { TranslateService } from '@ngx-translate/core';

import { environment } from '../../../environments/environment';

export const UNKNOWN_ERROR_CODE = 'UNKNOWN_ERROR';

/** Every code the API contract (cartaya-api docs/API_ERRORS.md) can return. */
export const API_ERROR_CODES = [
  'INVALID_CREDENTIALS', 'SESSION_EXPIRED', 'EMAIL_ALREADY_REGISTERED',
  'MISSING_PERMISSIONS', 'POS_NOT_ASSIGNED',
  'TENANT_NOT_FOUND', 'POS_NOT_FOUND', 'PRODUCT_NOT_FOUND', 'ORDER_NOT_FOUND',
  'CATEGORY_NOT_FOUND', 'MODIFIER_NOT_FOUND', 'PRICE_NOT_FOUND', 'PICTURE_NOT_FOUND',
  'INVITE_NOT_FOUND', 'USER_NOT_FOUND', 'STOCK_NOT_FOUND', 'FILE_NOT_FOUND',
  'ROUTE_NOT_FOUND', 'RESOURCE_NOT_FOUND',
  'VALIDATION_ERROR', 'INVALID_JSON', 'INVALID_REQUEST', 'INVALID_FILE_TYPE',
  'INVALID_SLUG_FORMAT', 'INVALID_PRICE_RANGE', 'INVALID_OPERATION',
  'CURRENCY_MISMATCH', 'TOTAL_MISMATCH', 'PRODUCT_INACTIVE', 'MODIFIER_INACTIVE',
  'MODIFIER_NOT_ATTACHED',
  'CONFLICT', 'DUPLICATE_NAME', 'DUPLICATE_SLUG', 'DUPLICATE_SKU', 'ALREADY_MEMBER',
  'ALREADY_OWNER', 'ALREADY_ASSIGNED', 'INVITE_PENDING', 'INVITE_NOT_PENDING',
  'LAST_OWNER', 'CATEGORY_IN_USE', 'POS_HAS_ORDERS',
  'PAYLOAD_TOO_LARGE', 'INTERNAL_ERROR', UNKNOWN_ERROR_CODE,
] as const;

export const API_FIELD_ERROR_CODES = [
  'REQUIRED', 'INVALID', 'TOO_SHORT', 'OUT_OF_RANGE', 'NEGATIVE', 'NOT_FOUND',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiFieldError {
  field: string;
  code: string;
}

export interface ParsedApiError {
  status: number;
  code: string;
  params: Record<string, unknown>;
  details: ApiFieldError[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function parseBody(body: unknown): Record<string, unknown> | null {
  if (typeof body === 'string') {
    try {
      return asRecord(JSON.parse(body));
    } catch {
      return null;
    }
  }
  return asRecord(body);
}

/**
 * Reads the stable `code` (plus params/details) from an API error response.
 * `message`, `error`, `detail` and `title` are never read: they are for logs only.
 * A missing or unlisted code resolves to UNKNOWN_ERROR.
 */
export function parseApiError(error: unknown): ParsedApiError {
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  const body = parseBody(error instanceof HttpErrorResponse ? error.error : null);
  const rawCode = body?.['code'];
  const code =
    typeof rawCode === 'string' && (API_ERROR_CODES as readonly string[]).includes(rawCode)
      ? rawCode
      : UNKNOWN_ERROR_CODE;
  const params = asRecord(body?.['params']) ?? {};
  const rawDetails = body?.['details'];
  const details = Array.isArray(rawDetails)
    ? rawDetails
        .map((d) => asRecord(d))
        .filter((d): d is Record<string, unknown> => !!d && typeof d['field'] === 'string')
        .map((d) => ({ field: d['field'] as string, code: String(d['code'] ?? 'INVALID') }))
    : [];

  if (code === UNKNOWN_ERROR_CODE && status !== 0 && body?.['code'] !== undefined) {
    // Pure util (no DI, cannot inject LoggerService); dev-only and logs just the code string.
    if (!environment.production) {
      console.warn('Unknown API error code:', body['code']);
    }
  }
  return { status, code, params, details };
}

/** Whether the error is an API response carrying a recognised code. */
export function hasApiErrorCode(error: unknown): boolean {
  return parseApiError(error).code !== UNKNOWN_ERROR_CODE;
}

export function apiErrorKey(code: string): string {
  return `API_ERRORS.${code}`;
}

/** Translated, user-facing text for an API error (params interpolated). */
export function translateApiError(translate: TranslateService, error: unknown): string {
  const { code, params } = parseApiError(error);
  return translate.instant(apiErrorKey(code), params);
}

/** Translated text for a field-level validation error. */
export function translateFieldError(translate: TranslateService, fieldCode: string): string {
  const key = `API_FIELD_ERRORS.${(API_FIELD_ERROR_CODES as readonly string[]).includes(fieldCode) ? fieldCode : 'INVALID'}`;
  return translate.instant(key);
}

/**
 * Translated text for a failed load/submit: API code when present, a
 * "cannot reach server" message when there was no response at all,
 * otherwise UNKNOWN_ERROR.
 */
export function translateLoadError(translate: TranslateService, error: unknown): string {
  const status = error instanceof HttpErrorResponse ? error.status : undefined;
  if (status === 0) {
    return translate.instant('AUTH.ERRORS.SERVER_UNREACHABLE');
  }
  return translateApiError(translate, error);
}
