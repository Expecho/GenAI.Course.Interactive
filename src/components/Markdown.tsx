/**
 * Minimal markdown rendering — enough for headings (`## `, `### `), bold (`**`), inline
 * code (`` ` ``), paragraphs, and bullet lists (`- `) without pulling in a
 * markdown dependency. Content is author-controlled (topic text), and `inline()`
 * HTML-escapes before applying formatting, so there's no untrusted-content path.
 */
export function Markdown({ markdown }: { markdown: string }) {
  // Group lines into blocks separated by blank lines: consecutive non-empty
  // lines form one paragraph, and blank lines become real spacing between blocks.
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const line of markdown.split("\n")) {
    if (line.trim() === "") {
      if (current.length) blocks.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length) blocks.push(current);

  const html = blocks
    .map((lines) => {
      if (lines[0].startsWith("## ")) {
        const raw = lines[0].slice(3);
        // An optional leading emoji becomes a section icon.
        const iconMatch = raw.match(/^(\p{Extended_Pictographic}(?:️)?)\s+/u);
        const iconHtml = iconMatch
          ? `<span class="mr-2 text-xl leading-none">${iconMatch[1]}</span>`
          : "";
        const heading = inline(iconMatch ? raw.slice(iconMatch[0].length) : raw);
        const rest = lines.slice(1);
        const restHtml = rest.length ? `<div class="mt-1">${renderBody(rest)}</div>` : "";
        return `<div><h2 class="flex items-center text-lg font-semibold text-[var(--fg)]">${iconHtml}<span>${heading}</span></h2>${restHtml}</div>`;
      }
      if (lines[0].startsWith("### ")) {
        const raw = lines[0].slice(4);
        const iconMatch = raw.match(/^(\p{Extended_Pictographic}(?:️)?)\s+/u);
        const iconHtml = iconMatch
          ? `<span class="mr-1.5 text-base leading-none">${iconMatch[1]}</span>`
          : "";
        const heading = inline(iconMatch ? raw.slice(iconMatch[0].length) : raw);
        const rest = lines.slice(1);
        const restHtml = rest.length ? `<div class="mt-1">${renderBody(rest)}</div>` : "";
        return `<div><h3 class="flex items-center text-base font-semibold text-[var(--fg)]">${iconHtml}<span>${heading}</span></h3>${restHtml}</div>`;
      }
      return `<div>${renderBody(lines)}</div>`;
    })
    .join("");

  return <div className="space-y-3" dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Renders a block of lines as either a bullet list (if any line starts with
 * "- ") or a single paragraph. List items may span multiple lines: a line
 * starting with "- " begins an item, and following lines continue it.
 */
function renderBody(lines: string[]): string {
  if (!lines.some((l) => l.startsWith("- "))) {
    return `<p class="text-sm text-[var(--fg-muted)]">${lines.map(inline).join(" ")}</p>`;
  }
  const items: string[][] = [];
  for (const line of lines) {
    if (line.startsWith("- ")) items.push([line.slice(2)]);
    else if (items.length) items[items.length - 1].push(line);
  }
  const lis = items.map((it) => `<li>${it.map(inline).join(" ")}</li>`).join("");
  return `<ul class="list-disc space-y-1 pl-5 text-sm text-[var(--fg-muted)]">${lis}</ul>`;
}

function inline(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--fg-body)]">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-[var(--chip)] px-1 py-0.5 text-[var(--fg-body)]">$1</code>');
}
