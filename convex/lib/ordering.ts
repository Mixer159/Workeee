/**
 * Fractional ordering for board columns.
 *
 * A card carries a `order` number inside its column. Dropping it between two
 * neighbours gives it the midpoint of their orders, so a drag writes exactly one
 * document no matter how long the column is. Halving a gap forever eventually
 * runs out of float precision, so `orderBetween` refuses once the neighbours are
 * closer than `MIN_ORDER_GAP`; the caller then renumbers the whole column with
 * `renumber` (rare, and cheap for a board column) and places the card again.
 *
 * The client never sends an order — it sends the two neighbour ids and the
 * server reads their current orders. Two people dragging at once therefore both
 * land somewhere sane instead of overwriting each other's numbers.
 */

/** Gap between two freshly numbered neighbours. */
export const ORDER_STEP = 1024;

/** Below this, halving the gap is no longer safe — renumber instead. */
export const MIN_ORDER_GAP = 1 / 1024;

type Ordered = { order: number };

/** Order for a card appended at the end of `siblings` (any order, unsorted). */
export function appendOrder(siblings: readonly Ordered[]): number {
  let max = 0;
  for (const sibling of siblings) {
    if (sibling.order > max) {
      max = sibling.order;
    }
  }
  return max + ORDER_STEP;
}

/**
 * Order for a card dropped between `previous` and `next`, or `null` when the
 * gap is too small and the column has to be renumbered first.
 */
export function orderBetween(
  previous: number | null,
  next: number | null,
): number | null {
  if (previous === null && next === null) {
    return ORDER_STEP;
  }
  if (previous === null) {
    return (next as number) - ORDER_STEP;
  }
  if (next === null) {
    return previous + ORDER_STEP;
  }
  if (next - previous < MIN_ORDER_GAP) {
    return null;
  }
  return (previous + next) / 2;
}

/** Evenly spaced orders for a list already in its final sequence. */
export function renumber(count: number): number[] {
  return Array.from({ length: count }, (_, index) => (index + 1) * ORDER_STEP);
}

/** Ascending by `order`, ties broken by creation time so the result is stable. */
export function byOrder<T extends Ordered & { _creationTime: number }>(
  a: T,
  b: T,
): number {
  return a.order - b.order || a._creationTime - b._creationTime;
}
