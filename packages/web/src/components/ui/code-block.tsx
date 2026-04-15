"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  children: string;
  title?: string;
  lang?: string;
}

const COLORS = {
  keyword: "#FFD60A",
  string: "#22C55E",
  comment: "#6B6D7B",
  property: "#9CA3AF",
  text: "#E8E9ED",
};

export function CodeBlock({ children, title, lang = "bash" }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const code = children.trim();
  const highlighted = highlightCode(code, lang);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative rounded-lg border border-border overflow-hidden">
      {title && (
        <div className="flex items-center gap-2 border-b border-border bg-[#0A0B0F] px-4 py-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
          <div className="h-2.5 w-2.5 rounded-full bg-[#27C93F]" />
          <span className="ml-2 text-xs text-muted-foreground">{title}</span>
        </div>
      )}
      <pre className="bg-[#0A0B0F] p-4 overflow-x-auto">
        <code
          className="font-mono text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-muted-foreground opacity-0 transition-all hover:bg-white/10 hover:text-foreground group-hover:opacity-100 cursor-pointer"
        style={title ? { top: "2.5rem" } : undefined}
        title="Copy to clipboard"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

type Token = { type: "keyword" | "string" | "comment" | "property" | "text"; value: string };

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderTokens(tokens: Token[]): string {
  return tokens
    .map((t) => {
      const escaped = escape(t.value);
      if (t.type === "text") return `<span style="color:${COLORS.text}">${escaped}</span>`;
      return `<span style="color:${COLORS[t.type]}">${escaped}</span>`;
    })
    .join("");
}

function highlightCode(code: string, lang: string): string {
  if (lang === "bash" || lang === "shell") {
    return code.split("\n").map(highlightBashLine).join("\n");
  }
  if (lang === "typescript" || lang === "tsx" || lang === "javascript") {
    return code.split("\n").map(highlightTSLine).join("\n");
  }
  return escape(code);
}

function highlightBashLine(line: string): string {
  const tokens: Token[] = [];

  const trimmed = line.trimStart();
  if (trimmed.startsWith("#")) {
    return renderTokens([{ type: "comment", value: line }]);
  }

  const parts = splitStrings(line);
  for (const part of parts) {
    if (part.isString) {
      tokens.push({ type: "string", value: part.value });
      continue;
    }

    const words = part.value.split(/(\s+)/);
    let foundCommand = false;
    for (const word of words) {
      if (/^\s+$/.test(word)) {
        tokens.push({ type: "text", value: word });
      } else if (!foundCommand && /^(git|cd|docker-compose|docker|curl|npm|npx|ssh|echo|set|go|mkdir|cat|psql)$/.test(word)) {
        tokens.push({ type: "keyword", value: word });
        foundCommand = true;
      } else if (/^-{1,2}[\w-]+/.test(word)) {
        tokens.push({ type: "property", value: word });
      } else {
        tokens.push({ type: "text", value: word });
      }
    }
  }

  return renderTokens(tokens);
}

function highlightTSLine(line: string): string {
  const trimmed = line.trimStart();

  if (trimmed.startsWith("//")) {
    return renderTokens([{ type: "comment", value: line }]);
  }

  const tokens: Token[] = [];
  const parts = splitStrings(line);

  for (const part of parts) {
    if (part.isString) {
      tokens.push({ type: "string", value: part.value });
      continue;
    }

    const segments = part.value.split(/(\b|\s+|[{}(),:;<>=!+\-*/&|?.])/);
    for (const seg of segments) {
      if (seg === "") continue;

      if (/^(import|from|export|default|function|return|const|let|var|async|await|if|else|new|true|false|null|undefined|throw|try|catch|class|extends|type|interface)$/.test(seg)) {
        tokens.push({ type: "keyword", value: seg });
      } else if (/^\s+$/.test(seg) || /^[{}(),:;<>=!+\-*/&|?.]$/.test(seg)) {
        tokens.push({ type: "text", value: seg });
      } else {
        tokens.push({ type: "text", value: seg });
      }
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    if (
      tokens[i].type === "text" &&
      /^\w+$/.test(tokens[i].value) &&
      i + 1 < tokens.length &&
      tokens[i + 1].value.startsWith(":")
    ) {
      tokens[i].type = "property";
    }
  }

  return renderTokens(tokens);
}

interface StringPart {
  value: string;
  isString: boolean;
}

function splitStrings(line: string): StringPart[] {
  const parts: StringPart[] = [];
  let current = "";
  let inString: string | null = null;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (inString) {
      current += ch;
      if (ch === inString && line[i - 1] !== "\\") {
        parts.push({ value: current, isString: true });
        current = "";
        inString = null;
      }
      i++;
    } else if (ch === "'" || ch === '"' || ch === "`") {
      if (current) {
        parts.push({ value: current, isString: false });
        current = "";
      }
      current = ch;
      inString = ch;
      i++;
    } else {
      current += ch;
      i++;
    }
  }

  if (current) {
    parts.push({ value: current, isString: inString !== null });
  }

  return parts;
}
