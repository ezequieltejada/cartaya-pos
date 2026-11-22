/**
 * Short, readable order reference used by Order History, Order Queue and
 * Order Detail so the same order always shows the same identifier.
 * Takes the last 6 alphanumeric characters, uppercased (e.g. "…-8f3a2c" → "8F3A2C").
 */
export function shortOrderRef(id: string | null | undefined): string {
  if (!id) {
    return '';
  }
  const clean = id.replace(/[^a-zA-Z0-9]/g, '');
  return clean.slice(-6).toUpperCase();
}
