export function mapViewportKey(
  bounds: readonly number[],
  zoom: number,
): string {
  return `${bounds.join(",")}:${zoom < 10 ? "wide" : zoom < 12 ? "overview" : "details"}`;
}

// Fetch every page before applying client-side filters; a truncated viewport
// can hide all matches even when matching restaurants exist in the area.
export async function loadViewportPages<T extends { id: string }>(
  fetchPage: (afterId: string | undefined, limit: number) => Promise<T[]>,
  isStale: () => boolean,
): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 400;
  let afterId: string | undefined;
  while (!isStale()) {
    const page = await fetchPage(afterId, pageSize);
    if (isStale()) return [];
    rows.push(...page);
    if (page.length < pageSize) break;
    afterId = page[page.length - 1]!.id;
  }
  return rows;
}
