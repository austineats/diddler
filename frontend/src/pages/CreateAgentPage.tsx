import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import {
  ArrowLeft,
  Send,
  Sparkles,
  MessageSquare,
  Phone,
  Brain,
} from "lucide-react";

const TEMPLATES = [
  { icon: <MessageSquare className="w-4 h-4" />, label: "Customer Support", prompt: "A friendly customer support agent that helps users troubleshoot issues, answers FAQs, and escalates complex problems" },
  { icon: <Brain className="w-4 h-4" />, label: "Study Buddy", prompt: "A study assistant that quizzes me on topics, explains concepts, and helps me prepare for exams" },
  { icon: <Phone className="w-4 h-4" />, label: "Appointment Booker", prompt: "An agent that handles appointment scheduling, sends reminders, and manages cancellations" },
  { icon: <Sparkles className="w-4 h-4" />, label: "Personal Coach", prompt: "A daily check-in coach that tracks my goals, provides motivation, and holds me accountable" },
];

export function CreateAgentPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      const agent = await api.createAgent(prompt.trim());
      navigate(`/agent/${agent.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-10 h-16 border-b border-zinc-200 bg-white/80 backdrop-blur-xl flex items-center px-8">
        <Link
          to="/app"
          className="flex items-center gap-2 text-[13px] text-zinc-400 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-6 h-6 text-blue-500" />
          </div>
          <h1 className="text-[26px] font-medium mb-2">Create a new agent</h1>
          <p className="text-[14px] text-zinc-500">Describe what your agent should do and we'll give it a phone number.</p>
        </div>

        <form onSubmit={handleCreate}>
          <div className="border border-zinc-200 rounded-xl bg-white overflow-hidden mb-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your agent... e.g. A nutrition AI that analyzes food photos and tracks my daily calories"
              rows={5}
              className="w-full px-5 py-4 text-[14px] text-zinc-900 placeholder-zinc-400 resize-none focus:outline-none bg-transparent"
              disabled={creating}
            />
            <div className="flex items-center justify-between px-5 pb-4">
              <span className="text-[11px] text-zinc-400">
                {prompt.length > 0 ? `${prompt.length} / 2000` : "Be as specific as you'd like"}
              </span>
              <button
                type="submit"
                disabled={!prompt.trim() || creating}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-[13px] font-medium transition-colors disabled:opacity-30"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Create Agent
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="border border-red-200 bg-red-50 rounded-lg px-4 py-3 mb-4">
              <p className="text-red-600 text-[13px]">{error}</p>
            </div>
          )}
        </form>

        <div className="mt-10">
          <p className="text-[12px] text-zinc-400 uppercase tracking-wider mb-4">Or start from a template</p>
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => setPrompt(t.prompt)}
                className="flex items-center gap-3 p-4 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center flex-shrink-0 group-hover:border-blue-200 group-hover:bg-blue-50 transition-colors">
                  <span className="text-zinc-400 group-hover:text-blue-500 transition-colors">{t.icon}</span>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-zinc-700">{t.label}</p>
                  <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">{t.prompt}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
