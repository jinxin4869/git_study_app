import { diffArrays } from 'diff';

interface Edit { start: number; end: number; lines: string[] }
function edits(base: string[], next: string[]): Edit[] {
  const result: Edit[] = [];
  let cursor = 0;
  let edit: Edit | undefined;
  for (const part of diffArrays(base, next)) {
    if (!part.added && !part.removed) {
      if (edit) result.push(edit);
      edit = undefined;
      cursor += part.value.length;
    } else {
      edit ??= { start: cursor, end: cursor, lines: [] };
      if (part.removed) { cursor += part.value.length; edit.end = cursor; }
      else edit.lines.push(...part.value);
    }
  }
  if (edit) result.push(edit);
  return result;
}

/** Three-way text merge. Deletion/modification and overlapping line edits need a decision. */
export function mergeContent(base: string | undefined, ours: string | undefined, theirs: string | undefined, label = 'incoming'): { content: string | undefined; conflict: boolean } {
  if (ours === theirs) return { content: ours, conflict: false };
  if (base === ours) return { content: theirs, conflict: false };
  if (base === theirs) return { content: ours, conflict: false };
  const conflict = () => ({ content: `<<<<<<< HEAD\n${ours ?? ''}\n=======\n${theirs ?? ''}\n>>>>>>> ${label}`, conflict: true });
  if (base === undefined || ours === undefined || theirs === undefined) return conflict();
  const original = base.split('\n');
  const left = edits(original, ours.split('\n'));
  const right = edits(original, theirs.split('\n'));
  const combined = [...left];
  for (const edit of right) {
    if (left.some(other => JSON.stringify(other) === JSON.stringify(edit))) continue;
    if (left.some(other => {
      if (edit.start === edit.end || other.start === other.end) return edit.start <= other.end && other.start <= edit.end;
      return edit.start <= other.end && other.start <= edit.end;
    })) return conflict();
    combined.push(edit);
  }
  combined.sort((a, b) => a.start - b.start);
  const merged: string[] = [];
  let cursor = 0;
  for (const edit of combined) {
    merged.push(...original.slice(cursor, edit.start), ...edit.lines);
    cursor = edit.end;
  }
  merged.push(...original.slice(cursor));
  return { content: merged.join('\n'), conflict: false };
}
