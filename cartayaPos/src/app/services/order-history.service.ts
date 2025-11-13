import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
    ApiErrorResponse,
    Order,
    OrderHistoryResponse,
} from '../models/order.model';

/**
 * Service for fetching and managing order history from the backend API
 *
 * Endpoint: GET /api/tenants/:tenantId/pos/:posId/orders
 *
 * Features:
 * - Fetches orders from the last 24 hours (or custom time range)
 * - Supports pagination with limit and offset
 * - Handles errors with detailed error messages
 * - Maps API responses to local TypeScript models
 * - Handles empty results gracefully
 */
@Injectable({
  providedIn: 'root',
})
export class OrderHistoryService {
  private readonly API_URL = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Fetch order history for a specific POS within a time range
   *
   * @param tenantId - The tenant ID
   * @param posId - The Point of Sale ID
   * @param hours - Number of hours to look back (default: 24)
   * @param limit - Number of results per page (default: 50, max: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Observable<Order[]> - Array of orders
   *
   * @example
   * this.orderHistoryService.getOrderHistory('tenant123', 'pos456', 24).subscribe(
   *   (orders) => console.log('Orders:', orders),
   *   (error) => console.error('Error:', error)
   * );
   */
  getOrderHistory(
    tenantId: string,
    posId: string,
    hours: number = 24,
    limit: number = 50,
    offset: number = 0
  ): Observable<Order[]> {
    // Validate inputs
    if (!tenantId || !posId) {
      return throwError(
        () => new Error('tenantId and posId are required parameters')
      );
    }

    if (hours < 0) {
      return throwError(
        () => new Error('hours parameter must be a positive number')
      );
    }

    // Calculate date range for the last N hours
    const now = new Date();
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // Build query parameters
    let params = new HttpParams()
      .set('dateFrom', since.toISOString())
      .set('dateTo', now.toISOString())
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    // Construct the API endpoint URL
    const url = `${this.API_URL}/api/tenants/${tenantId}/pos/${posId}/orders`;

    return this.http
      .get<OrderHistoryResponse>(url, { params, withCredentials: true })
      .pipe(
        map((response) => response.data),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * Fetch order history with custom date range
   *
   * @param tenantId - The tenant ID
   * @param posId - The Point of Sale ID
   * @param dateFrom - Start date (ISO 8601 format)
   * @param dateTo - End date (ISO 8601 format)
   * @param limit - Number of results per page (default: 50, max: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Observable<Order[]> - Array of orders
   *
   * @example
   * const from = new Date('2024-11-13T00:00:00Z').toISOString();
   * const to = new Date('2024-11-13T23:59:59Z').toISOString();
   * this.orderHistoryService.getOrderHistoryByDateRange('tenant123', 'pos456', from, to).subscribe(
   *   (orders) => console.log('Orders:', orders),
   *   (error) => console.error('Error:', error)
   * );
   */
  getOrderHistoryByDateRange(
    tenantId: string,
    posId: string,
    dateFrom: string,
    dateTo: string,
    limit: number = 50,
    offset: number = 0
  ): Observable<Order[]> {
    // Validate inputs
    if (!tenantId || !posId) {
      return throwError(
        () => new Error('tenantId and posId are required parameters')
      );
    }

    if (!dateFrom || !dateTo) {
      return throwError(
        () => new Error('dateFrom and dateTo are required parameters')
      );
    }

    // Validate date format
    try {
      new Date(dateFrom).toISOString();
      new Date(dateTo).toISOString();
    } catch {
      return throwError(
        () =>
          new Error(
            'Invalid date format. Use ISO 8601 format (e.g., 2024-11-13T00:00:00Z)'
          )
      );
    }

    // Build query parameters
    let params = new HttpParams()
      .set('dateFrom', dateFrom)
      .set('dateTo', dateTo)
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    // Construct the API endpoint URL
    const url = `${this.API_URL}/api/tenants/${tenantId}/pos/${posId}/orders`;

    return this.http
      .get<OrderHistoryResponse>(url, { params, withCredentials: true })
      .pipe(
        map((response) => response.data),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * Fetch order history with status filter
   *
   * @param tenantId - The tenant ID
   * @param posId - The Point of Sale ID
   * @param status - Filter by order status ('received' or 'completed')
   * @param hours - Number of hours to look back (default: 24)
   * @param limit - Number of results per page (default: 50, max: 100)
   * @param offset - Pagination offset (default: 0)
   * @returns Observable<Order[]> - Array of orders
   *
   * @example
   * this.orderHistoryService.getOrderHistoryByStatus('tenant123', 'pos456', 'completed', 24).subscribe(
   *   (orders) => console.log('Completed orders:', orders),
   *   (error) => console.error('Error:', error)
   * );
   */
  getOrderHistoryByStatus(
    tenantId: string,
    posId: string,
    status: 'received' | 'completed',
    hours: number = 24,
    limit: number = 50,
    offset: number = 0
  ): Observable<Order[]> {
    // Validate inputs
    if (!tenantId || !posId) {
      return throwError(
        () => new Error('tenantId and posId are required parameters')
      );
    }

    if (!status || !['received', 'completed'].includes(status)) {
      return throwError(
        () => new Error("status must be either 'received' or 'completed'")
      );
    }

    // Calculate date range for the last N hours
    const now = new Date();
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);

    // Build query parameters
    let params = new HttpParams()
      .set('status', status)
      .set('dateFrom', since.toISOString())
      .set('dateTo', now.toISOString())
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    // Construct the API endpoint URL
    const url = `${this.API_URL}/api/tenants/${tenantId}/pos/${posId}/orders`;

    return this.http
      .get<OrderHistoryResponse>(url, { params, withCredentials: true })
      .pipe(
        map((response) => response.data),
        catchError((error) => this.handleError(error))
      );
  }

  /**
   * Handle HTTP errors from the API
   * Provides detailed error messages based on the error response
   *
   * @param error - HttpErrorResponse from the HTTP request
   * @returns Observable that emits an error
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred while fetching order history';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Network error: ${error.error.message}`;
      console.error('Client-side error:', error.error);
    } else {
      // Server-side error
      const apiError = error.error as ApiErrorResponse;

      switch (error.status) {
        case 0:
          errorMessage =
            'Network error: Unable to reach the server. Please check your connection.';
          break;
        case 400:
          errorMessage = `Bad request: ${apiError?.message || 'Invalid parameters'}`;
          break;
        case 401:
          errorMessage =
            'Authentication required: Please sign in again to fetch order history.';
          break;
        case 403:
          errorMessage =
            'Access denied: You do not have permission to view orders for this POS.';
          break;
        case 404:
          errorMessage =
            'Point of Sale not found: The specified POS does not exist in this tenant.';
          break;
        case 500:
          errorMessage =
            'Server error: An error occurred while processing your request. Please try again later.';
          break;
        default:
          errorMessage =
            apiError?.message ||
            `Error ${error.status}: ${error.statusText || 'Unknown error'}`;
      }

      console.error('API error:', {
        status: error.status,
        message: errorMessage,
        error: apiError,
      });
    }

    return throwError(() => new Error(errorMessage));
  }
}
