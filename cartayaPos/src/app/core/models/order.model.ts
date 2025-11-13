/**
 * Order Models - Re-exported from consolidated location
 * 
 * DEPRECATED: This file is now a re-export wrapper for backward compatibility.
 * All order models have been consolidated to: src/app/models/order.model.ts
 * 
 * Both OrderService (core/services) and OrderHistoryService (services) now use
 * the same unified Order entity from the consolidated location to ensure they
 * work on the same data structures.
 * 
 * Migration Notice:
 * - Direct imports from core/models/order.model.ts will continue to work
 * - New code should import from: src/app/models/order.model.ts
 */

export {
    ApiErrorResponse, Order, OrderHistoryResponse, OrderItem, OrderModifier,
    OrderPagination, SelectedModifier, SubmitOrderResponse
} from '../../models/order.model';

