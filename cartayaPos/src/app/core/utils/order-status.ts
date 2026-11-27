/** Badge variant for an order status (design system: Nuevo = volt, Listo = success). */
export function orderStatusClass(status?: string): 'new' | 'success' | 'neutral' {
  switch (status) {
    case 'received':
      return 'new';
    case 'completed':
      return 'success';
    default:
      return 'neutral';
  }
}

/** i18n key for an order status; unknown statuses fall back to the neutral label. */
export function orderStatusLabelKey(status: string): string {
  return status === 'received' || status === 'completed'
    ? `ORDER_HISTORY.STATUS.${status.toUpperCase()}`
    : 'ORDER_HISTORY.STATUS.UNKNOWN';
}
