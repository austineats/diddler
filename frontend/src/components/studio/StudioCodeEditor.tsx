import { useMemo } from 'react';
import { parseVirtualFiles, highlightCode } from '../../lib/codeParser';

interface StudioCodeEditorProps {
  code: string | null;
  selectedFile: string | null;
}

function getLanguage(name: string): string {
  if (name.endsWith('.jsx') || name.endsWith('.tsx')) return 'JSX';
  if (name.endsWith('.js') || name.endsWith('.ts')) return 'JS';
  if (name.endsWith('.css')) return 'CSS';
  if (name.endsWith('.html')) return 'HTML';
  if (name.endsWith('.json')) return 'JSON';
  if (name.endsWith('.md')) return 'MD';
  return 'Code';
}

export function StudioCodeEditor({ code, selectedFile }: StudioCodeEditorProps) {
  const virtualFiles = useMemo(() => code ? parseVirtualFiles(code) : [], [code]);
  const selected = selectedFile ?? virtualFiles[0]?.path ?? null;
  const file = virtualFiles.find(f => f.path === selected);

  // Empty state — no file selected
  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-400">
        <div className="w-16 h-16 rounded-2xl bg-gray-200 flex items-center justify-center mb-4">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </div>
        <p className="text-lg font-medium text-gray-600">No file selected</p>
        <p className="text-sm mt-1">Select a file from the tree to view its code</p>
      </div>
    );
  }

  const lines = file.code.split('\n');
  const language = getLanguage(file.name);
  const charCount = file.code.length;
  const sizeKB = (charCount / 1024).toFixed(1);

  // Build highlighted HTML with line numbers
  const highlightedLines = highlightCode(file.code).split('\n');
  const linesHtml = highlightedLines.map((line, i) => (
    `<div class="flex"><span class="w-12 text-right pr-4 text-gray-400 select-none text-sm">${i + 1}</span><span class="flex-1 text-sm font-mono whitespace-pre">${line}</span></div>`
  )).join('');

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-900">{file.name}</span>
          <span className="px-2 py-0.5 rounded text-xs bg-gray-200 text-gray-600 uppercase">{language}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{sizeKB} KB</span>
        </div>
      </div>

      {/* Code */}
      <div className="flex-1 overflow-auto bg-[#fafafa]">
        <pre className="p-4">
          <code dangerouslySetInnerHTML={{ __html: linesHtml }} />
        </pre>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex-shrink-0">
        <div className="flex items-center gap-4">
          <span>{lines.length} lines</span>
          <span>{charCount.toLocaleString()} characters</span>
        </div>
        <span>UTF-8</span>
      </div>
    </div>
  );
}
