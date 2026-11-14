export function textToLines(value: string): string[] {
  if (value.length === 0) {
    return [""];
  }
  return value.split("\n");
}

export function linesToText(lines: string[]): string {
  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
    return "";
  }
  return lines.join("\n");
}

export function replaceLine(
  lines: string[],
  index: number,
  text: string,
): string[] {
  const next = lines.slice();
  next[index] = text;
  return next;
}

export function insertLineAfter(lines: string[], index: number): string[] {
  const next = lines.slice();
  next.splice(index + 1, 0, "");
  return next;
}

export function removeLine(lines: string[], index: number): string[] {
  if (lines.length <= 1) {
    return [""];
  }
  return lines.filter((_, lineIndex) => lineIndex !== index);
}

export function moveLine(
  lines: string[],
  index: number,
  direction: -1 | 1,
): string[] {
  const target = index + direction;
  if (target < 0 || target >= lines.length) {
    return lines;
  }
  const next = lines.slice();
  const [row] = next.splice(index, 1);
  next.splice(target, 0, row ?? "");
  return next;
}

export function splitLine(
  lines: string[],
  index: number,
  caret: number,
): { lines: string[]; focusIndex: number } {
  const current = lines[index] ?? "";
  const before = current.slice(0, caret);
  const after = current.slice(caret);
  const next = lines.slice();
  next.splice(index, 1, before, after);
  return { lines: next, focusIndex: index + 1 };
}

export function pasteIntoLine(
  lines: string[],
  index: number,
  text: string,
  caret: number,
): { lines: string[]; focusIndex: number; split: boolean } {
  const chunk = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!chunk.includes("\n")) {
    return { lines, focusIndex: index, split: false };
  }
  const current = lines[index] ?? "";
  const merged = `${current.slice(0, caret)}${chunk}${current.slice(caret)}`;
  const parts = merged.split("\n");
  const next = lines.slice();
  next.splice(index, 1, ...parts);
  return {
    lines: next,
    focusIndex: index + parts.length - 1,
    split: true,
  };
}

export function addLine(lines: string[]): {
  lines: string[];
  focusIndex: number;
} {
  const last = lines.length - 1;
  if (lines[last] === "") {
    return { lines, focusIndex: last };
  }
  return { lines: insertLineAfter(lines, last), focusIndex: last + 1 };
}
