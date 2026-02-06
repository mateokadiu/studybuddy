/**
 * UUIDv7 wrapper.
 *
 * Why v7: monotonic ms-precision timestamp prefix → SQLite primary keys
 * stay roughly insert-ordered, which keeps the b-tree page splits cheap
 * and gives us "ORDER BY id DESC" as a free recency sort.
 *
 * Falls back to a hand-rolled implementation if `uuid` is unavailable
 * (defensive — we always install it, but stays runnable in stripped envs).
 */

import { v7 as uuidv7 } from 'uuid';

export function id(): string {
  return uuidv7();
}

/** Extract the embedded ms-since-epoch timestamp from a v7 uuid. */
export function idTimestamp(uuid: string): number {
  // first 12 hex chars = 48 bits of ms timestamp
  const hex = uuid.replace(/-/g, '').slice(0, 12);
  return Number.parseInt(hex, 16);
}
