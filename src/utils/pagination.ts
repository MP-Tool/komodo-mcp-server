/**
 * Cursor-based pagination utilities for list tools.
 *
 * Komodo APIs return full lists; we paginate client-side. The cursor is a
 * base64-encoded JSON object `{ offset: number }`. Malformed cursors fall
 * back to offset 0 silently — callers should not be able to crash a list
 * tool by passing garbage.
 *
 * @module utils/pagination
 */

/** Default page size when the caller does not specify one. */
export const DEFAULT_PAGE_SIZE = 25;

/** Maximum allowed page size (mirrors `paginationInputSchema`). */
export const MAX_PAGE_SIZE = 100;

interface CursorPayload {
  readonly offset: number;
}

/** Encode a cursor for the given offset. */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/**
 * Decode an opaque cursor.
 *
 * Returns `{ offset: 0 }` for missing or malformed cursors — callers should
 * always be able to start fresh without raising on bad input.
 */
export function decodeCursor(cursor: string | undefined): CursorPayload {
  if (!cursor) return { offset: 0 };
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "offset" in parsed &&
      typeof (parsed as CursorPayload).offset === "number" &&
      Number.isInteger((parsed as CursorPayload).offset) &&
      (parsed as CursorPayload).offset >= 0
    ) {
      return { offset: (parsed as CursorPayload).offset };
    }
  } catch {
    /* fall through to default */
  }
  return { offset: 0 };
}

/** Page envelope returned alongside paginated items. */
export interface PageEnvelope {
  /** Cursor for the next page, omitted if no further results exist. */
  readonly next_cursor?: string;
  /** Total number of items across all pages. */
  readonly total: number;
}

/** Result of a `paginate()` call. */
export interface PaginateResult<T> {
  readonly items: readonly T[];
  readonly page: PageEnvelope;
}

/**
 * Slice a fully-loaded list into a single page based on an opaque cursor.
 *
 * @param items - Full list of items as returned by the upstream API.
 * @param cursor - Opaque cursor from a previous call, or undefined for the first page.
 * @param pageSize - Desired page size. Clamped to `[1, MAX_PAGE_SIZE]`. Defaults to `DEFAULT_PAGE_SIZE`.
 */
export function paginate<T>(
  items: readonly T[],
  cursor: string | undefined,
  pageSize: number | undefined,
): PaginateResult<T> {
  const size = Math.min(Math.max(pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const total = items.length;
  const { offset } = decodeCursor(cursor);
  const start = Math.min(offset, total);
  const end = Math.min(start + size, total);
  const slice = items.slice(start, end);
  const page: PageEnvelope = end < total ? { next_cursor: encodeCursor({ offset: end }), total } : { total };
  return { items: slice, page };
}
