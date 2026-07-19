import type { ReactNode } from "react";

type CodeLanguage = "javascript" | "json";

const javascriptTokens =
  /(?<comment>\/\/.*)|(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(?<number>\b(?:0x[\da-f]+|\d+(?:\.\d+)?)\b)|(?<keyword>\b(?:async|await|break|case|catch|class|const|continue|default|delete|do|else|export|extends|finally|for|from|function|if|import|in|instanceof|let|new|of|return|static|switch|throw|try|typeof|var|void|while|yield)\b)|(?<literal>\b(?:true|false|null|undefined|NaN|Infinity)\b)/gi;
const jsonTokens =
  /(?<key>"(?:\\.|[^"\\])*")(?=\s*:)|(?<string>"(?:\\.|[^"\\])*")|(?<number>-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|(?<literal>\b(?:true|false|null)\b)/gi;

export function CodeViewer({
  source,
  language,
  filename,
}: {
  source: string;
  language: CodeLanguage;
  filename: string;
}) {
  const lines = keyedLines(source);

  return (
    <div className="absolute inset-0 flex min-h-0 flex-col overflow-hidden bg-[#151515]">
      <header className="flex shrink-0 items-center justify-between border-[#2d2d2d] border-b bg-[#191919] px-3 py-2 text-[10px]">
        <code className="text-[#b8b8b8]">{filename}</code>
        <span className="rounded bg-[#292929] px-1.5 py-0.5 uppercase tracking-wide text-[#777]">{language}</span>
      </header>
      <ol className="m-0 min-h-0 flex-1 overflow-auto py-3 font-mono text-[11px] leading-5">
        {lines.map((line, index) => (
          <li className="flex min-w-max px-3 hover:bg-[#1d1d1d]" key={line.key}>
            <span
              aria-hidden="true"
              className="mr-4 w-8 shrink-0 select-none border-[#292929] border-r pr-3 text-right text-[#555]"
            >
              {index + 1}
            </span>
            <code className="whitespace-pre pr-4 text-[#c9c9c9]">{highlightLine(line.source, language)}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}

function highlightLine(line: string, language: CodeLanguage) {
  const expression = language === "json" ? jsonTokens : javascriptTokens;
  expression.lastIndex = 0;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;

  for (const match of line.matchAll(expression)) {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(line.slice(cursor, start));
    const kind = Object.entries(match.groups ?? {}).find(([, value]) => value !== undefined)?.[0] ?? "plain";
    nodes.push(
      <span className={tokenColor(kind)} key={`${tokenIndex++}-${start}`}>
        {match[0]}
      </span>,
    );
    cursor = start + match[0].length;
  }
  if (cursor < line.length) nodes.push(line.slice(cursor));
  return nodes.length ? nodes : " ";
}

function keyedLines(source: string) {
  const counts = new Map<string, number>();
  return source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const occurrence = counts.get(line) ?? 0;
      counts.set(line, occurrence + 1);
      return { key: `${line}-${occurrence}`, source: line };
    });
}

function tokenColor(kind: string) {
  if (kind === "comment") return "text-[#707070] italic";
  if (kind === "keyword") return "text-[#c792ea]";
  if (kind === "key") return "text-[#82aaff]";
  if (kind === "string") return "text-[#c3e88d]";
  if (kind === "number") return "text-[#f78c6c]";
  if (kind === "literal") return "text-[#ffcb6b]";
  return "text-[#c9c9c9]";
}
