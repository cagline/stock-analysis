import type { Order } from '../types';

/** Same key as portfolio merge/upsert — keep in sync with server `dedupeKey`. */
export function orderDedupeKey(o: Order): string {
  return o.executionId
    ? o.executionId
    : `${o.exchangeOrderId || o.id}|${o.orderDate}|${o.orderTime || ''}`;
}
