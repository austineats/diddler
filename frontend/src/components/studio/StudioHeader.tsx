import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Sparkles, ChevronDown, Check, LayoutDashboard, Eye } from 'lucide-react';

const MODEL_OPTIONS: Array<{ id: 'sonnet' | 'opus'; name: string; shortName: string; desc: string }> = [
  { id: 'sonnet', name: 'Claude Sonnet 4.6', shortName: 'Sonnet 4.6', desc: 'Fast & high quality' },
  { id: 'opus', name: 'Claude Opus 4.6', shortName: 'Opus 4.6', desc: 'Maximum quality' },
];

function ClaudeLogo({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M8 1.5v5M8 9.5v5M1.5 8h5M9.5 8h5M3.4 3.4l3.5 3.5M9.1 9.1l3.5 3.5M12.6 3.4l-3.5 3.5M6.9 9.1l-3.5 3.5"
        stroke="#e8734a"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface StudioHeaderProps {
  appName: string | null;
  hasApp: boolean;
  selectedModel: 'sonnet' | 'opus';
  onModelChange: (model: 'sonnet' | 'opus') => void;
  onNew: () => void;
  onShare: () => void;
  shareCopied: boolean;
  onBack: () => void;
  headerView: 'dashboard' | 'preview';
  onHeaderViewChange: (view: 'dashboard' | 'preview') => void;
}

export function StudioHeader({
  appName,
  hasApp,
  selectedModel,
  onModelChange,
  onNew,
  onShare,
  shareCopied,
  onBack,
  headerView,
  onHeaderViewChange,
}: StudioHeaderProps) {
  const [modelOpen, setModelOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modelOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setModelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [modelOpen]);

  return (
    <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-600"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>
        <div className="w-px h-6 bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-900">
            {appName || 'StartBox Studio'}
          </span>
        </div>
      </div>

      {/* Center — Dashboard / Preview toggle */}
      {hasApp && (
        <div className="flex items-center bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onHeaderViewChange('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              headerView === 'dashboard'
                ? 'bg-white shadow-sm text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </button>
          <button
            onClick={() => onHeaderViewChange('preview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              headerView === 'preview'
                ? 'bg-white shadow-sm text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Preview
          </button>
        </div>
      )}

      {/* Right */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Free plan</span>

        {/* Model selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setModelOpen(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ClaudeLogo size={14} />
            <span>{MODEL_OPTIONS.find(m => m.id === selectedModel)?.shortName}</span>
            <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
          {modelOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-lg z-50 py-1">
              <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Model</div>
              {MODEL_OPTIONS.map(model => (
                <button
                  key={model.id}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                    selectedModel === model.id ? 'bg-indigo-50' : ''
                  }`}
                  onClick={() => { onModelChange(model.id); setModelOpen(false); }}
                >
                  <ClaudeLogo size={16} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{model.name}</div>
                    <div className="text-xs text-gray-500">{model.desc}</div>
                  </div>
                  {selectedModel === model.id && <Check className="w-4 h-4 text-indigo-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasApp && (
          <>
            <button
              onClick={onNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              + New
            </button>
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              {shareCopied ? 'Copied!' : 'Share'}
            </button>
          </>
        )}

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
          U
        </div>
      </div>
    </header>
  );
}
