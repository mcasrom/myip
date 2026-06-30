import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null;

  // Split into paragraphs/sections
  const blocks = content.split('\n\n');

  return (
    <div className="space-y-4 text-sm text-slate-800 leading-relaxed font-sans">
      {blocks.map((block, idx) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // Header 3 (###)
        if (trimmed.startsWith('###')) {
          const text = trimmed.replace(/^###\s*/, '');
          return (
            <h4 key={idx} className="text-sm font-mono font-bold uppercase tracking-wider text-indigo-700 mt-6 border-b border-slate-200 pb-2">
              {text}
            </h4>
          );
        }

        // Header 2 (##)
        if (trimmed.startsWith('##')) {
          const text = trimmed.replace(/^##\s*/, '');
          return (
            <h3 key={idx} className="text-base font-bold text-slate-900 mt-6 border-l-2 border-indigo-600 pl-3">
              {text}
            </h3>
          );
        }

        // Horizontal Rule (---)
        if (trimmed === '---') {
          return <hr key={idx} className="border-slate-200 my-4" />;
        }

        // Bullet Points
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.includes('\n* ') || trimmed.includes('\n- ')) {
          const items = trimmed.split(/\n[\*\-]\s*/).filter(Boolean);
          // Check if first line had item text after bullet
          const firstLineRaw = trimmed.match(/^[\*\-]\s*(.*)/);
          const parsedItems = firstLineRaw ? [firstLineRaw[1], ...items.slice(1)] : items;

          return (
            <ul key={idx} className="list-disc list-outside pl-5 space-y-2 mt-2">
              {parsedItems.map((item, itemIdx) => {
                const cleanItem = item.replace(/^[\*\-]\s*/, '').trim();
                const formatted = cleanItem.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                return (
                  <li 
                    key={itemIdx} 
                    className="text-slate-800"
                    dangerouslySetInnerHTML={{ __html: formatted }}
                  />
                );
              })}
            </ul>
          );
        }

        // Numbered list
        if (/^\d+\.\s*/.test(trimmed)) {
          const items = trimmed.split(/\n\d+\.\s*/).filter(Boolean);
          const firstLineRaw = trimmed.match(/^\d+\.\s*(.*)/);
          const parsedItems = firstLineRaw ? [firstLineRaw[1], ...items.slice(1)] : items;

          return (
            <ol key={idx} className="list-decimal list-outside pl-5 space-y-2 mt-2">
              {parsedItems.map((item, itemIdx) => {
                const formatted = item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                return (
                  <li 
                    key={itemIdx} 
                    className="text-slate-800"
                    dangerouslySetInnerHTML={{ __html: formatted }}
                  />
                );
              })}
            </ol>
          );
        }

        // Regular Paragraph
        const formattedParagraph = trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return (
          <p 
            key={idx} 
            className="text-slate-800 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formattedParagraph }}
          />
        );
      })}
    </div>
  );
}
