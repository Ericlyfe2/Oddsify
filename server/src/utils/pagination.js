/**
 * Cursor-based pagination helper.
 *
 * Unlike offset/limit, cursor pagination is stable under writes: inserting or
 * deleting rows between pages never shifts items that the user has already seen.
 *
 * Usage in a route handler:
 *   const { cursor, limit, items, nextCursor } = paginate(allItems, req.query, { sortKey: 'createdAt' });
 *   res.json({ items, nextCursor, hasMore: !!nextCursor });
 *
 * The client passes `?cursor=<opaque_token>&limit=50`. The response includes
 * `nextCursor` which is the sort-key value of the last item in the current page.
 * Pass it as `?cursor=<nextCursor>` to get the next page. When `nextCursor` is
 * null, there are no more items.
 */

export function paginate(items, query = {}, opts = {}) {
  const {
    sortKey = 'createdAt',
    sortDir = 'desc',
    defaultLimit = 50,
    maxLimit = 200,
  } = opts;

  const limit = Math.min(Math.max(1, Number(query.limit) || defaultLimit), maxLimit);
  const cursor = query.cursor ? String(query.cursor) : null;

  let filtered = [...items];

  if (cursor) {
    filtered = filtered.filter((item) => {
      const val = item[sortKey];
      if (val == null) return false;
      const cmp = String(val).localeCompare(cursor);
      return sortDir === 'desc' ? cmp < 0 : cmp > 0;
    });
  }

  if (sortDir === 'desc') {
    filtered.sort((a, b) => String(b[sortKey] || '').localeCompare(String(a[sortKey] || '')));
  } else {
    filtered.sort((a, b) => String(a[sortKey] || '').localeCompare(String(b[sortKey] || '')));
  }

  const page = filtered.slice(0, limit);
  const nextCursor = page.length === limit ? page[page.length - 1][sortKey] : null;

  return { items: page, nextCursor, hasMore: !!nextCursor, limit };
}
