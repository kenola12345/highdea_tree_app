// メモの任意の見出し（What: / Why: / Example: / Remember: / Mistakes: / Note:）と ``` のコードを、表示用のかたまりに分ける
// （manifests/nodes.md §3.5 Sections in the note）。見出しのないメモは1つの文のかたまりになる。

export type NoteBlock = { label: string | null; kind: "text" | "code"; text: string };

const LABELS: Record<string, string> = {
  what: "What",
  why: "Why",
  example: "Example",
  examples: "Example",
  remember: "Remember",
  mistakes: "Mistakes",
  "common mistakes": "Mistakes",
  note: "Note",
};
const SECTION = /^(what|why|examples?|remember|common mistakes|mistakes|note)\s*:\s*(.*)$/i;

/** メモをかたまりに分ける（純粋関数）。前後の空行は落とす */
export function parseNote(note: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  let current: NoteBlock | null = null;
  let inCode = false;
  const flush = () => {
    if (current && (current.text.trim() !== "" || current.label)) {
      blocks.push({
        ...current,
        text: current.kind === "code" ? current.text : current.text.trim(),
      });
    }
    current = null;
  };
  for (const line of note.split("\n")) {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        flush();
        inCode = false;
      } else {
        flush();
        inCode = true;
        current = { label: null, kind: "code", text: "" };
      }
      continue;
    }
    if (inCode && current) {
      current.text = current.text === "" ? line : `${current.text}\n${line}`;
      continue;
    }
    const match = SECTION.exec(line.trim());
    if (match) {
      flush();
      current = {
        label: LABELS[(match[1] ?? "").toLowerCase()] ?? null,
        kind: "text",
        text: match[2] ?? "",
      };
      continue;
    }
    current ??= { label: null, kind: "text", text: "" };
    current.text = current.text === "" ? line : `${current.text}\n${line}`;
  }
  flush();
  return blocks;
}

/** 見出しかコードがあるか（あれば区切って表示する） */
export function isStructured(blocks: NoteBlock[]): boolean {
  return blocks.some((b) => b.label !== null || b.kind === "code");
}
