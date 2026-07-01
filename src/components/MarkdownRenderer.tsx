import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  // Normalize line endings and split into lines for processing
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-outside pl-5 space-y-1.5 my-2">
          {listItems.map((item, i) => {
            const formatted = item
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 text-xs font-mono">$1</code>');
            return (
              <li key={i} className="text-slate-700 text-sm" dangerouslySetInnerHTML={{ __html: formatted }} />
            );
          })}
        </ul>
      );
      listItems = [];
    }
  };

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      const text = paragraphLines.join(' ');
      const formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 text-xs font-mono">$1</code>');
      elements.push(
        <p key={`p-${elements.length}`} className="text-sm text-slate-700 my-1.5" dangerouslySetInnerHTML={{ __html: formatted }} />
      );
      paragraphLines = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line - flush both
    if (!trimmed) {
      flushList();
      flushParagraph();
      continue;
    }

    // Headers
    if (trimmed.startsWith('###')) {
      flushList();
      flushParagraph();
      const text = trimmed.replace(/^###\s*/, '');
      elements.push(
        <h4 key={`h-${elements.length}`} className="text-sm font-bold font-mono text-indigo-700 mt-5 mb-2 border-b border-slate-200 pb-1.5">
          {text}
        </h4>
      );
      continue;
    }

    if (trimmed.startsWith('##') && !trimmed.startsWith('###')) {
      flushList();
      flushParagraph();
      const text = trimmed.replace(/^##\s*/, '');
      elements.push(
        <h3 key={`h-${elements.length}`} className="text-base font-bold text-slate-900 mt-5 mb-2 border-l-2 border-indigo-600 pl-3">
          {text}
        </h3>
      );
      continue;
    }

    // Bullet points (* or -)
    if (/^[\*\-]\s+/.test(trimmed)) {
      flushParagraph();
      listItems.push(trimmed.replace(/^[\*\-]\s+/, ''));
      continue;
    }

    // Not a list item - flush list
    flushList();
    paragraphLines.push(trimmed);
  }

  // Flush remaining
  flushList();
  flushParagraph();

  return <div className="space-y-1 text-slate-800 leading-relaxed font-sans">{elements}</div>;
}
