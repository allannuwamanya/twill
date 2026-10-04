export interface DiffLine {
  type: 'added' | 'deleted' | 'context' | 'header';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface SplitDiffRow {
  left?: DiffLine;
  right?: DiffLine;
}

export function parseUnifiedDiff(diffText: string): DiffLine[] {
  const lines = diffText.split('\n');
  const result: DiffLine[] = [];

  let oldLine = 1;
  let newLine = 1;

  for (const rawLine of lines) {
    if (rawLine.startsWith('---') || rawLine.startsWith('+++')) {
      result.push({
        type: 'header',
        text: rawLine,
      });
      continue;
    }

    if (rawLine.startsWith('@@')) {
      // Parse hunk header: @@ -oldStart,oldLen +newStart,newLen @@
      const match = rawLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLine = parseInt(match[1], 10);
        newLine = parseInt(match[2], 10);
      }
      result.push({
        type: 'header',
        text: rawLine,
      });
      continue;
    }

    if (rawLine.startsWith('+')) {
      result.push({
        type: 'added',
        text: rawLine.slice(1),
        newLineNumber: newLine++,
      });
    } else if (rawLine.startsWith('-')) {
      result.push({
        type: 'deleted',
        text: rawLine.slice(1),
        oldLineNumber: oldLine++,
      });
    } else {
      // Context or empty line
      const text = rawLine.startsWith(' ') ? rawLine.slice(1) : rawLine;
      result.push({
        type: 'context',
        text,
        oldLineNumber: oldLine++,
        newLineNumber: newLine++,
      });
    }
  }

  return result;
}

export function buildSplitRows(lines: DiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'header') {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }

    if (line.type === 'context') {
      rows.push({ left: line, right: line });
      i++;
      continue;
    }

    // Collect consecutive deletions and additions in current hunk
    const deletedGroup: DiffLine[] = [];
    while (i < lines.length && lines[i].type === 'deleted') {
      deletedGroup.push(lines[i]);
      i++;
    }

    const addedGroup: DiffLine[] = [];
    while (i < lines.length && lines[i].type === 'added') {
      addedGroup.push(lines[i]);
      i++;
    }

    const maxCount = Math.max(deletedGroup.length, addedGroup.length);
    for (let j = 0; j < maxCount; j++) {
      rows.push({
        left: deletedGroup[j],
        right: addedGroup[j],
      });
    }
  }

  return rows;
}
