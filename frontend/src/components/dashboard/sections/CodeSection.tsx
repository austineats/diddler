import { useState, useMemo } from 'react';
import { Copy, Check, Download, Code, FileCode, FolderOpen } from 'lucide-react';
import { parseVirtualFiles, buildFolderTree } from '../../../lib/codeParser';

interface CodeSectionProps {
  code: string | undefined;
  appName: string;
}

export function CodeSection({ code, appName }: CodeSectionProps) {
  const [copied, setCopied] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  const virtualFiles = useMemo(() => code ? parseVirtualFiles(code) : [], [code]);
  const folderTree = useMemo(() => buildFolderTree(virtualFiles), [virtualFiles]);

  const selectedPath = activeFile ?? virtualFiles[0]?.path ?? null;
  const selectedFile = virtualFiles.find(f => f.path === selectedPath);

  function handleCopy() {
    const textToCopy = selectedFile?.code ?? code ?? '';
    navigator.clipboard.writeText(textToCopy).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    if (!code) return;
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${appName.replace(/\s+/g, '-')}.jsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!code) {
    return (
      <div className="dash-code-empty">
        <Code size={48} strokeWidth={1} />
        <h2>No Generated Code</h2>
        <p>This app uses a dynamic spec and does not have standalone generated code.</p>
      </div>
    );
  }

  return (
    <div className="dash-code">
      <div className="dash-code-header">
        <span className="dash-code-title">Generated React Code</span>
        <span className="dash-code-file-count">{virtualFiles.length} files</span>
        <div className="dash-code-actions">
          <button className="dash-btn dash-btn--ghost" onClick={handleCopy}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="dash-btn dash-btn--ghost" onClick={handleDownload}>
            <Download size={16} />
            Download
          </button>
        </div>
      </div>
      <div className="dash-code-split">
        {/* File tree sidebar */}
        <div className="dash-code-tree">
          {Array.from(folderTree.entries()).map(([folder, folderFiles]) => (
            <div key={folder} className="dash-code-tree-folder">
              <div className="dash-code-tree-folder-name">
                <FolderOpen size={14} />
                <span>{folder}</span>
              </div>
              {folderFiles.map((f) => (
                <button
                  key={f.path}
                  className={`dash-code-tree-file${f.path === selectedPath ? ' dash-code-tree-file--active' : ''}`}
                  onClick={() => setActiveFile(f.path)}
                >
                  <FileCode size={13} />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        {/* Code viewer */}
        <div className="dash-code-viewer">
          {selectedFile && (
            <>
              <div className="dash-code-viewer-tab">
                <FileCode size={13} />
                <span>{selectedFile.path}</span>
              </div>
              <pre><code>{selectedFile.code}</code></pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
