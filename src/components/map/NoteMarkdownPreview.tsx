import React from 'react';

interface NoteMarkdownPreviewProps {
  text: string;
  onWikiLinkClick?: (targetTitle: string) => void;
  onToggleCheckbox?: (lineIndex: number) => void;
  compact?: boolean;
}

function isSafeImageSrc(src: string): boolean {
  const trimmed = src.trim();
  return /^https?:\/\//i.test(trimmed) || /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(trimmed);
}

/**
 * Safely renders inline formatting: [[wiki-links]], **bold**, *italic*, `code`
 * without using dangerouslySetInnerHTML.
 */
function renderInlineTokens(
  line: string,
  onWikiLinkClick?: (targetTitle: string) => void
): React.ReactNode[] {
  const tokenRegex = /(\[\[[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
  const parts = line.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    if (part.startsWith('[[') && part.endsWith(']]')) {
      const inner = part.slice(2, -2);
      const [rawTarget, rawAlias] = inner.split('|');
      const targetTitle = (rawTarget || '').trim();
      const displayLabel = (rawAlias || rawTarget || '').trim();

      if (onWikiLinkClick && targetTitle) {
        return (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWikiLinkClick(targetTitle);
            }}
            className="px-1.5 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 font-semibold border border-cyan-500/30 inline-flex items-center gap-1 my-0.5 transition cursor-pointer"
            title={`Abrir nota "${targetTitle}"`}
          >
            <span>🔗 {displayLabel}</span>
          </button>
        );
      }
      return (
        <span
          key={idx}
          className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30 inline-block my-0.5"
        >
          🔗 {displayLabel}
        </span>
      );
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-slate-200">
          {part.slice(1, -1)}
        </em>
      );
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-white/10 text-amber-200 font-mono text-[11px]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const NoteMarkdownPreview: React.FC<NoteMarkdownPreviewProps> = ({
  text,
  onWikiLinkClick,
  onToggleCheckbox,
  compact = false,
}) => {
  if (!text.trim()) {
    return <span className="text-slate-500 italic text-xs">Sem conteúdo nesta nota...</span>;
  }

  const lines = text.split('\n');
  const textSize = compact ? 'text-[11px]' : 'text-xs';

  return (
    <div className={`space-y-1.5 text-slate-200 leading-relaxed font-sans ${textSize}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        if (trimmed === '---' || trimmed === '***') {
          return <hr key={idx} className="border-white/15 my-2" />;
        }

        if (line.startsWith('# ')) {
          return (
            <h1
              key={idx}
              className={`${compact ? 'text-sm' : 'text-lg'} font-black text-cyan-300 border-b border-white/10 pb-1 mt-1.5`}
            >
              {renderInlineTokens(line.slice(2), onWikiLinkClick)}
            </h1>
          );
        }

        if (line.startsWith('## ')) {
          return (
            <h2 key={idx} className={`${compact ? 'text-xs' : 'text-base'} font-bold text-purple-300 mt-1.5`}>
              {renderInlineTokens(line.slice(3), onWikiLinkClick)}
            </h2>
          );
        }

        if (line.startsWith('### ')) {
          return (
            <h3 key={idx} className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-lime-300 mt-1`}>
              {renderInlineTokens(line.slice(4), onWikiLinkClick)}
            </h3>
          );
        }

        if (line.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              className="pl-2.5 border-l-2 border-cyan-400/60 text-slate-300 italic bg-white/5 py-1 pr-2 rounded-r-lg"
            >
              {renderInlineTokens(line.slice(2), onWikiLinkClick)}
            </blockquote>
          );
        }

        if (/^- \[( |x|X)\] /.test(line)) {
          const isChecked = /^- \[(x|X)\] /.test(line);
          const label = line.slice(6);
          return (
            <label
              key={idx}
              className={`flex items-start gap-2 ${onToggleCheckbox ? 'cursor-pointer' : ''}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggleCheckbox?.(idx)}
                readOnly={!onToggleCheckbox}
                className="mt-0.5 rounded text-cyan-500 bg-black/40 border-white/20 accent-cyan-400"
              />
              <span className={isChecked ? 'line-through text-slate-400' : 'text-slate-200'}>
                {renderInlineTokens(label, onWikiLinkClick)}
              </span>
            </label>
          );
        }

        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2">
              <span className="text-cyan-400 shrink-0">•</span>
              <span className="text-slate-300">
                {renderInlineTokens(line.slice(2), onWikiLinkClick)}
              </span>
            </div>
          );
        }

        if (/^\d+\.\s+/.test(line)) {
          const match = line.match(/^(\d+\.)\s+(.*)$/);
          if (match) {
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-cyan-400 font-mono shrink-0">{match[1]}</span>
                <span className="text-slate-300">
                  {renderInlineTokens(match[2], onWikiLinkClick)}
                </span>
              </div>
            );
          }
        }

        if (line.startsWith('![')) {
          const match = line.match(/!\[(.*?)\]\((.*?)\)/);
          if (match && isSafeImageSrc(match[2])) {
            return (
              <img
                key={idx}
                src={match[2]}
                alt={match[1]}
                className="max-h-48 rounded-xl object-cover my-2 border border-white/10"
              />
            );
          }
        }

        return <p key={idx}>{renderInlineTokens(line, onWikiLinkClick)}</p>;
      })}
    </div>
  );
};
