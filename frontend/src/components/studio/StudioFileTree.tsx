import { useMemo, useState } from 'react';
import { FolderOpen, FolderClosed, FileCode, FileText, Copy, Check, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { parseVirtualFiles, buildFolderTree, type VirtualFile } from '../../lib/codeParser';

interface StudioFileTreeProps {
  code: string | null;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

function getFileIcon(name: string): { icon: typeof FileCode; color: string } {
  if (name.endsWith('.html')) return { icon: FileCode, color: 'text-orange-500' };
  if (name.endsWith('.css')) return { icon: FileCode, color: 'text-blue-500' };
  if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.jsx')) return { icon: FileCode, color: 'text-yellow-500' };
  if (name.endsWith('.json')) return { icon: FileCode, color: 'text-green-500' };
  if (name.endsWith('.md')) return { icon: FileText, color: 'text-gray-500' };
  return { icon: FileText, color: 'text-gray-400' };
}

export function StudioFileTree({ code, selectedFile, onSelectFile }: StudioFileTreeProps) {
  const [copied, setCopied] = useState(false);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const virtualFiles = useMemo(() => code ? parseVirtualFiles(code) : [], [code]);
  const folderTree = useMemo(() => {
    const tree = buildFolderTree(virtualFiles);
    // Auto-open all folders on first render
    if (openFolders.size === 0 && tree.size > 0) {
      setOpenFolders(new Set(tree.keys()));
    }
    return tree;
  }, [virtualFiles]);

  const selected = selectedFile ?? virtualFiles[0]?.path ?? null;
  const selectedFileObj = virtualFiles.find(f => f.path === selected);

  function handleCopy() {
    const text = selectedFileObj?.code ?? code ?? '';
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!code) return;
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'app.jsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleFolder(folder: string) {
    setOpenFolders(prev => {
      const next = new Set(prev);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  }

  if (!code) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 text-gray-400 px-4">
        <FolderClosed className="w-12 h-12 mb-2 opacity-50" />
        <p className="text-sm text-center">No files yet</p>
        <p className="text-xs text-center mt-1">Generate an app to see files</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 border-r border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <span className="font-semibold text-gray-900">Files</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {Array.from(folderTree.entries()).map(([folder, files]) => {
          const isOpen = openFolders.has(folder);
          return (
            <div key={folder}>
              <button
                onClick={() => toggleFolder(folder)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100 transition-colors text-gray-700"
                style={{ paddingLeft: '12px' }}
              >
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                {isOpen ? <FolderOpen className="w-4 h-4 text-yellow-500" /> : <FolderClosed className="w-4 h-4 text-yellow-500" />}
                <span className="text-sm font-medium">{folder}</span>
              </button>
              {isOpen && files.map(f => {
                const isSelected = f.path === selected;
                const { icon: FileIcon, color } = getFileIcon(f.name);
                return (
                  <button
                    key={f.path}
                    onClick={() => onSelectFile(f.path)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100 transition-colors ${
                      isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                    }`}
                    style={{ paddingLeft: '28px' }}
                  >
                    <span className="w-4" />
                    <FileIcon className={`w-4 h-4 ${color}`} />
                    <span className="text-sm">{f.name}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {selectedFileObj && (
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
          <div className="text-xs text-gray-500 mb-1">Selected</div>
          <div className="text-sm font-medium text-gray-900 truncate">{selectedFileObj.name}</div>
          <div className="text-xs text-gray-500 mt-1">{(selectedFileObj.code.length / 1024).toFixed(1)} KB</div>
        </div>
      )}
    </div>
  );
}

export { type VirtualFile };
