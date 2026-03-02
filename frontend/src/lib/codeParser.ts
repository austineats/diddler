export interface VirtualFile {
  path: string;
  name: string;
  folder: string;
  code: string;
}

export function classifyComponent(name: string): string {
  if (name === 'App') return 'src/pages';
  if (/Nav|Header|Footer|Sidebar|Layout|TopBar/i.test(name)) return 'src/components/layout';
  if (/Card|List|Grid|Item|Badge|Tag|Chip|Row|Cell/i.test(name)) return 'src/components/ui';
  if (/Modal|Dialog|Popup|Drawer|Sheet|Toast/i.test(name)) return 'src/components/overlay';
  if (/Score|Ring|Chart|Graph|Meter|Gauge/i.test(name)) return 'src/components/data';
  return 'src/components';
}

export function parseVirtualFiles(code: string): VirtualFile[] {
  const files: VirtualFile[] = [];
  const lines = code.split('\n');

  const componentStarts: { name: string; lineIndex: number }[] = [];
  const fnPattern = /^function\s+([A-Z][A-Za-z0-9]+)\s*\(/;
  const constPattern = /^const\s+([A-Z][A-Za-z0-9]+)\s*=\s*(?:\(|function)/;

  for (let i = 0; i < lines.length; i++) {
    const fnMatch = lines[i].match(fnPattern);
    const constMatch = lines[i].match(constPattern);
    const match = fnMatch || constMatch;
    if (match) {
      componentStarts.push({ name: match[1], lineIndex: i });
    }
  }

  if (componentStarts.length === 0) {
    return [{ path: 'src/App.jsx', name: 'App.jsx', folder: 'src', code }];
  }

  if (componentStarts[0].lineIndex > 0) {
    const utilsCode = lines.slice(0, componentStarts[0].lineIndex).join('\n').trim();
    if (utilsCode) {
      files.push({ path: 'src/lib/utils.jsx', name: 'utils.jsx', folder: 'src/lib', code: utilsCode });
    }
  }

  for (let i = 0; i < componentStarts.length; i++) {
    const start = componentStarts[i].lineIndex;
    const end = i < componentStarts.length - 1 ? componentStarts[i + 1].lineIndex : lines.length;
    const name = componentStarts[i].name;

    let componentCode = lines.slice(start, end).join('\n').trim();
    const lastLine = lines[end - 1]?.trim() ?? '';
    if (lastLine.startsWith('ReactDOM.createRoot') && i < componentStarts.length - 1) {
      componentCode = lines.slice(start, end - 1).join('\n').trim();
    }

    const folder = classifyComponent(name);
    files.push({ path: `${folder}/${name}.jsx`, name: `${name}.jsx`, folder, code: componentCode });
  }

  const lastLine = lines[lines.length - 1]?.trim() ?? '';
  if (lastLine.startsWith('ReactDOM.createRoot') && files.length > 0) {
    files[files.length - 1].code += '\n\n' + lastLine;
  }

  return files;
}

export function buildFolderTree(files: VirtualFile[]): Map<string, VirtualFile[]> {
  const tree = new Map<string, VirtualFile[]>();
  for (const f of files) {
    const existing = tree.get(f.folder) ?? [];
    existing.push(f);
    tree.set(f.folder, existing);
  }
  return tree;
}

export function highlightCode(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Comments
    .replace(/(\/\/.*$)/gm, '<span class="text-gray-400">$1</span>')
    .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-gray-400">$1</span>')
    // Strings
    .replace(/(&quot;[^&]*?&quot;|'[^']*?'|`[^`]*?`)/g, '<span class="text-green-600">$1</span>')
    // Keywords
    .replace(/\b(import|export|from|const|let|var|function|return|if|else|for|while|class|extends|new|this|typeof|instanceof|switch|case|break|default|try|catch|finally|throw|async|await|yield)\b/g, '<span class="text-purple-600">$1</span>')
    // JSX/HTML tags
    .replace(/(&lt;\/?)([\w.-]+)/g, '$1<span class="text-pink-600">$2</span>')
    // Numbers
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="text-amber-600">$1</span>');
}
