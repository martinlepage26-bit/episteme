export function getSelectionOffsets(container: HTMLElement): { start: number; end: number; text: string } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;

  const text = range.toString();
  if (!text) return null;

  const preRange = range.cloneRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);
  const start = preRange.toString().length;

  return { start, end: start + text.length, text };
}

export interface TextSegment {
  text: string;
  citationId: string | null;
}

export function buildSegments(
  content: string,
  citations: { id: string; locationStart: number; locationEnd: number }[],
): TextSegment[] {
  const sorted = [...citations].sort((a, b) => a.locationStart - b.locationStart);
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const citation of sorted) {
    if (citation.locationStart < cursor) continue;
    if (citation.locationStart > cursor) {
      segments.push({ text: content.slice(cursor, citation.locationStart), citationId: null });
    }
    segments.push({ text: content.slice(citation.locationStart, citation.locationEnd), citationId: citation.id });
    cursor = citation.locationEnd;
  }
  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor), citationId: null });
  }
  return segments;
}
