import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandlerFn,
    HttpInterceptorFn,
    HttpRequest,
    HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';
import { Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NetworkService } from '../services/network.service';
import { OrderQueueService } from '../services/order-queue.service';

/**
 * Offline HTTP Interceptor
 * Catches failed order POST requests and automatically queues them using OrderQueueService.
 *
 * Distinguishes between network failures (queue-worthy) and validation errors (not queue-worthy).
 * Only intercepts order POST requests - other requests fail normally.
 *
 * Behavior:
 * - Network errors → Queue order + Return synthetic success (202)
 * - 5xx server errors → Queue order + Return synthetic success (202)
 * - Timeout errors → Queue order + Return synthetic success (202)
 * - Offline state → Queue order + Return synthetic success (202)
 * - 4xx client errors → Propagate error normally (don't queue)
 * - Other errors → Propagate error normally
 */
export const offlineInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const queueService = inject(OrderQueueService);
  const networkService = inject(NetworkService);
  const toastController = inject(ToastController);

  // Only intercept order POST requests
  if (!isOrderRequest(req)) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Check if we should queue this request
      if (shouldQueueRequest(error, networkService)) {
        return queueAndReturnSuccess(
          req,
          error,
          queueService,
          toastController
        );
      }

      // For non-queue-worthy errors, propagate normally
      return throwError(() => error);
    })
  );
};

/**
 * Check if request is an order submission
 * Matches: POST /api/tenants/{tenantId}/pos/{posId}/orders
 */
function isOrderRequest(req: HttpRequest<unknown>): boolean {
  return (
    req.method === 'POST' &&
    req.url.includes('/pos/') &&
    req.url.includes('/orders') &&
    !req.url.includes('/orders/')
  );
}

/**
 * Determine if error should trigger queueing
 * Queue on: network errors, timeouts, 5xx server errors, offline state
 * Don't queue: 4xx client errors (validation, auth, etc.)
 */
function shouldQueueRequest(
  error: HttpErrorResponse,
  networkService: NetworkService
): boolean {
  // Network error (no response from server)
  if (error.error instanceof ErrorEvent) {
    console.log('Network error detected, queueing order');
    return true;
  }

  // Check if offline
  if (!networkService.getIsOnline()) {
    console.log('Offline detected, queueing order');
    return true;
  }

  // HTTP error response
  if (error.status >= 500 && error.status < 600) {
    // Server errors - queue for retry
    console.log(`Server error ${error.status} detected, queueing order`);
    return true;
  }

  // Timeout errors (0 = network error, 408 = timeout, 504 = gateway timeout)
  if (error.status === 0 || error.status === 408 || error.status === 504) {
    console.log('Timeout error detected, queueing order');
    return true;
  }

  // 4xx errors (bad request, unauthorized, etc.) - don't queue
  console.log(`Client error ${error.status}, not queueing`);
  return false;
}

/**
 * Queue the request and return a synthetic success response
 */
function queueAndReturnSuccess(
  req: HttpRequest<unknown>,
  error: HttpErrorResponse,
  queueService: OrderQueueService,
  toastController: ToastController
): Observable<HttpEvent<unknown>> {
  // Extract posId and tenantId from URL
  // URL format: /api/tenants/{tenantId}/pos/{posId}/orders
  const urlParts = req.url.split('/');
  const tenantIdIndex = urlParts.indexOf('tenants') + 1;
  const posIdIndex = urlParts.indexOf('pos') + 1;

  const tenantId = urlParts[tenantIdIndex];
  const posId = urlParts[posIdIndex];

  if (!tenantId || !posId) {
    console.error('Failed to extract tenantId/posId from URL:', req.url);
    return throwError(() => error);
  }

  // Extract metadata from payload for better UX
  const payload = req.body as any;
  const metadata = {
    total: payload?.totalAmount,
    itemCount: payload?.items?.length || 0,
  };

  // Queue the order asynchronously
  queueService
    .enqueue(payload, posId, tenantId, metadata)
    .then((queueId) => {
      console.log(`Order queued with ID: ${queueId}`);
      // Show user feedback
      showQueuedToast(toastController);
    })
    .catch((queueError) => {
      console.error('Failed to queue order:', queueError);
      // If queueing fails, we've already committed to returning success
      // The original error is logged but not propagated
    });

  // Return synthetic success response
  // This allows OrderService to proceed with clearOrder() and printing
  const syntheticResponse = new HttpResponse<any>({
    status: 202, // 202 Accepted (queued for processing)
    statusText: 'Queued',
    url: req.url,
    body: {
      orderId: `queued-${Date.now()}`, // Temporary ID
      status: 'queued',
      createdAt: new Date().toISOString(),
      items: payload?.items || [],
      totalAmount: payload?.totalAmount,
      currency: payload?.currency,
      message: 'Order queued for sync when online',
    },
  });

  return of(syntheticResponse);
}

/**
 * Show toast notification that order was queued
 */
async function showQueuedToast(
  toastController: ToastController
): Promise<void> {
  const toast = await toastController.create({
    message: 'Order queued for sync when online',
    duration: 3000,
    position: 'bottom',
    color: 'warning',
    icon: 'cloud-upload-outline',
    buttons: [
      {
        text: 'Dismiss',
        role: 'cancel',
      },
    ],
  });
  await toast.present();
}
