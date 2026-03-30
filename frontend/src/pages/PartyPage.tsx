import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";

type Slot = {
  position: number;
  name: string | null;
  role: "guy" | "girl";
  is_host: boolean;
  filled: boolean;
};

type PartyData = {
  code: string;
  status: string;
  slots: Slot[];
};

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.1 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const API = import.meta.env.VITE_API_URL || "";

function SlotCard({ slot, onJoin, blurred }: { slot: Slot; onJoin: () => void; blurred?: boolean }) {
  const isGuy = slot.role === "guy";
  const accent = isGuy ? "#3b82f6" : "#ec4899";
  const accentDim = isGuy ? "rgba(59,130,246,0.15)" : "rgba(236,72,153,0.15)";
  const accentMid = isGuy ? "rgba(59,130,246,0.3)" : "rgba(236,72,153,0.3)";

  return (
    <motion.div
      variants={itemVariants}
      className="relative flex flex-col group cursor-pointer"
      style={{ width: "100%" }}
      onClick={() => !slot.filled && onJoin()}
    >
      {/* Card body — tall vertical */}
      <div
        className="relative flex-1 flex flex-col items-center justify-center overflow-hidden transition-all duration-300"
        style={{
          minHeight: 320,
          background: slot.filled
            ? `linear-gradient(180deg, ${accentDim} 0%, rgba(0,0,0,0.6) 100%)`
            : "rgba(255,255,255,0.03)",
          border: slot.filled ? `1px solid ${accentMid}` : "1px dashed rgba(255,255,255,0.08)",
          clipPath: "polygon(10% 0%, 90% 0%, 100% 4%, 100% 96%, 90% 100%, 10% 100%, 0% 96%, 0% 4%)",
        }}
      >
        {/* Top accent line */}
        {slot.filled && (
          <div className="absolute top-0 left-[10%] right-[10%] h-[2px]" style={{ background: accent }} />
        )}

        {slot.filled ? (
          blurred ? (
            <>
              {/* Big question mark */}
              <span className="text-[72px] sm:text-[80px] font-bold select-none" style={{ color: "rgba(255,255,255,0.12)", textShadow: "2px 2px 0 rgba(0,0,0,0.1)" }}>?</span>
            </>
          ) : (
            <>
              {/* Big emoji avatar */}
              <div
                className="text-[64px] sm:text-[72px] mb-2 select-none"
                style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}
              >
                {isGuy ? "🧑" : "👩"}
              </div>
              {/* Ready badge */}
              <div className="px-3 py-1 rounded text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ background: accentMid, color: accent }}>
                ready
              </div>
            </>
          )
        ) : (
          <>
            {/* Empty plus icon */}
            <div
              className="w-14 h-14 rounded-lg flex items-center justify-center transition-all group-hover:scale-110"
              style={{ border: `2px dashed rgba(255,255,255,0.1)` }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <p className="text-white/15 text-[12px] mt-3 uppercase tracking-widest font-semibold">invite</p>
          </>
        )}
      </div>

      {/* Bottom banner / nameplate */}
      <div
        className="relative py-3 text-center transition-all duration-300"
        style={{
          background: slot.filled
            ? `linear-gradient(180deg, ${accentMid} 0%, transparent 100%)`
            : "transparent",
        }}
      >
        {slot.filled ? (
          <>
            <p className="text-white font-bold text-[15px] sm:text-[17px] tracking-wide">
              {blurred ? "? ? ?" : slot.name}
            </p>
            <p className="text-white/25 text-[10px] font-mono uppercase tracking-[0.15em] mt-0.5">
              {blurred ? "mystery" : slot.is_host ? "matched" : "joined"}
            </p>
          </>
        ) : (
          <p className="text-white/10 text-[13px]">empty slot</p>
        )}
      </div>

      {/* Bottom diamond ornament */}
      {slot.filled && (
        <div className="flex justify-center -mt-1">
          <div className="w-4 h-4 rotate-45 border border-white/10" style={{ background: accentDim }} />
        </div>
      )}
    </motion.div>
  );
}

function JoinModal({ role, onClose, onSubmit, submitting }: { role: "guy" | "girl"; onClose: () => void; onSubmit: (name: string, phone: string) => void; submitting: boolean }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const fmt = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-[24px] mb-1">join the party</h3>
        <p className="text-white/40 text-[14px] mb-6">you're joining as {role === "guy" ? "his" : "her"} +1</p>

        <div className="space-y-3">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="your name"
            className="w-full px-4 py-3 rounded-lg border border-white/10 text-[15px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition bg-white/5" />
          <div>
            <input type="tel" value={phone} onChange={(e) => setPhone(fmt(e.target.value))} placeholder="phone"
              className="w-full px-4 py-3 rounded-lg border border-white/10 text-[15px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition bg-white/5" />
            <p className="text-[11px] text-white/15 mt-1 ml-1">iMessage required</p>
          </div>
          <button
            onClick={() => { if (name.trim() && phone.trim()) onSubmit(name.trim(), phone.trim()); }}
            disabled={submitting}
            className="w-full py-3 rounded-lg bg-white text-black font-semibold text-[14px] hover:bg-white/90 active:scale-[0.98] transition disabled:opacity-50"
          >
            {submitting ? <div className="w-4 h-4 mx-auto border-2 border-black/20 border-t-black rounded-full animate-spin" /> : "I'm in"}
          </button>
        </div>

        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition text-[20px]">&times;</button>
      </motion.div>
    </motion.div>
  );
}

export function PartyPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewerSide = searchParams.get("as") as "guy" | "girl" | null;
  const [party, setParty] = useState<PartyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joinModal, setJoinModal] = useState<"guy" | "girl" | null>(null);
  const [joinError, setJoinError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [createData, setCreateData] = useState({ guyName: "", guyPhone: "", girlName: "", girlPhone: "", iAm: "" as "guy" | "girl" | "" });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const fmt = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const handleCreate = async () => {
    const { guyName, guyPhone, girlName, girlPhone, iAm } = createData;
    if (!guyName.trim() || !guyPhone.trim() || !girlName.trim() || !girlPhone.trim()) {
      setCreateError("all fields required");
      return;
    }
    if (!iAm) {
      setCreateError("select who you are");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch(`${API}/api/party`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guy_name: guyName.trim(),
          guy_phone: guyPhone.replace(/\D/g, ""),
          girl_name: girlName.trim(),
          girl_phone: girlPhone.replace(/\D/g, ""),
        }),
      });
      const data = await res.json();
      if (data.ok) navigate(`/party/${data.code}?as=${createData.iAm}`);
      else setCreateError(data.error || "something went wrong");
    } catch {
      setCreateError("couldn't connect");
    } finally {
      setCreating(false);
    }
  };

  // Fetch party data
  useEffect(() => {
    if (!code) {
      setLoading(false);
      setError("no party code");
      return;
    }
    fetch(`${API}/api/party/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.ok) setParty(data.party);
        else setError(data.error || "party not found");
      })
      .catch(() => {
        // Fallback to mock data for demo
        setParty({
          code: code!,
          status: "waiting",
          slots: [
            { position: 0, role: "guy", is_host: true, name: "Alex", filled: true },
            { position: 1, role: "guy", is_host: false, name: null, filled: false },
            { position: 2, role: "girl", is_host: true, name: "Sarah", filled: true },
            { position: 3, role: "girl", is_host: false, name: null, filled: false },
          ],
        });
        // Default demo to guy's perspective so girl side is blurred
        if (!searchParams.get("as")) navigate(`/party/${code}?as=guy`, { replace: true });
      })
      .finally(() => setLoading(false));
  }, [code]);

  // Poll for updates every 5s
  useEffect(() => {
    if (!code || !party) return;
    const interval = setInterval(() => {
      fetch(`${API}/api/party/${code}`)
        .then(r => r.json())
        .then(data => { if (data.ok) setParty(data.party); })
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [code, party]);

  const shareUrl = party ? `${window.location.origin}/party/${party.code}` : "";

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async (name: string, phone: string) => {
    if (!joinModal || !code) return;
    setSubmitting(true);
    setJoinError("");
    try {
      const res = await fetch(`${API}/api/party/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, role: joinModal }),
      });
      const data = await res.json();
      if (data.ok) {
        setParty(data.party);
        setJoinModal(null);
        // Set viewer side after joining
        navigate(`/party/${code}?as=${joinModal}`, { replace: true });
      } else {
        setJoinError(data.error || "couldn't join");
      }
    } catch {
      setJoinError("couldn't connect");
    } finally {
      setSubmitting(false);
    }
  };

  const slots = party?.slots || [];
  const allFilled = slots.length === 4 && slots.every(s => s.filled);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // No code provided — show start/join landing
  if (!code) {
    return (
      <div className="min-h-screen relative">
        <div className="fixed inset-0 z-0">
          <img src="/bg.jpg" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 backdrop-blur-[12px] bg-black/50" />
        </div>
        <nav className="fixed top-0 w-full z-50 border-b border-white/5">
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center">
            <button onClick={() => navigate("/")} className="text-white font-bold text-[18px] tracking-[-0.03em]">bubl.</button>
          </div>
        </nav>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <h1 className="text-[48px] sm:text-[64px] font-bold tracking-[-0.04em] text-white leading-[0.95] mb-3">double date</h1>
          <p className="text-white/40 text-[16px] sm:text-[18px] mb-12">2v2 — every match brings a friend</p>

          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
            <button
              onClick={() => setShowCreate(true)}
              className="flex-1 py-4 rounded-xl bg-white text-black font-semibold text-[15px] hover:bg-white/90 active:scale-[0.97] transition"
            >
              start lobby
            </button>
            <button
              onClick={() => setShowJoinCode(true)}
              className="flex-1 py-4 rounded-xl border border-white/15 text-white font-semibold text-[15px] hover:bg-white/5 active:scale-[0.97] transition"
            >
              join lobby
            </button>
          </div>
        </div>

        {/* Create lobby modal */}
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowCreate(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold text-[24px] mb-1">start a lobby</h3>
              <p className="text-white/40 text-[14px] mb-6">enter both matched people to create the party</p>
              <div className="space-y-4">
                <div>
                  <p className="text-blue-400 text-[11px] font-semibold uppercase tracking-widest mb-2">his side</p>
                  <input type="text" value={createData.guyName} onChange={e => setCreateData(d => ({ ...d, guyName: e.target.value }))} placeholder="name"
                    className="w-full px-4 py-3 rounded-lg border border-white/10 text-[15px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition bg-white/5 mb-2" />
                  <input type="tel" value={createData.guyPhone} onChange={e => setCreateData(d => ({ ...d, guyPhone: fmt(e.target.value) }))} placeholder="phone"
                    className="w-full px-4 py-3 rounded-lg border border-white/10 text-[15px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition bg-white/5" />
                </div>
                <div>
                  <p className="text-pink-400 text-[11px] font-semibold uppercase tracking-widest mb-2">her side</p>
                  <input type="text" value={createData.girlName} onChange={e => setCreateData(d => ({ ...d, girlName: e.target.value }))} placeholder="name"
                    className="w-full px-4 py-3 rounded-lg border border-white/10 text-[15px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition bg-white/5 mb-2" />
                  <input type="tel" value={createData.girlPhone} onChange={e => setCreateData(d => ({ ...d, girlPhone: fmt(e.target.value) }))} placeholder="phone"
                    className="w-full px-4 py-3 rounded-lg border border-white/10 text-[15px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition bg-white/5" />
                </div>
                <div>
                  <p className="text-white/40 text-[11px] font-semibold uppercase tracking-widest mb-2">which one are you?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCreateData(d => ({ ...d, iAm: "guy" }))}
                      className={`flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition ${createData.iAm === "guy" ? "bg-blue-500/20 border border-blue-500/40 text-blue-400" : "border border-white/10 text-white/30 hover:text-white/50"}`}
                    >
                      i'm the guy
                    </button>
                    <button
                      onClick={() => setCreateData(d => ({ ...d, iAm: "girl" }))}
                      className={`flex-1 py-2.5 rounded-lg text-[14px] font-semibold transition ${createData.iAm === "girl" ? "bg-pink-500/20 border border-pink-500/40 text-pink-400" : "border border-white/10 text-white/30 hover:text-white/50"}`}
                    >
                      i'm the girl
                    </button>
                  </div>
                </div>
                {createError && <p className="text-red-400 text-[13px] text-center">{createError}</p>}
                <button onClick={handleCreate} disabled={creating}
                  className="w-full py-3 rounded-lg bg-white text-black font-semibold text-[14px] hover:bg-white/90 active:scale-[0.98] transition disabled:opacity-50">
                  {creating ? <div className="w-4 h-4 mx-auto border-2 border-black/20 border-t-black rounded-full animate-spin" /> : "create party"}
                </button>
              </div>
              <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition text-[20px]">&times;</button>
            </motion.div>
          </motion.div>
        )}

        {/* Join with code modal */}
        {showJoinCode && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowJoinCode(false)}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold text-[24px] mb-1">join a lobby</h3>
              <p className="text-white/40 text-[14px] mb-6">enter your party code</p>
              <div className="space-y-3">
                <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} placeholder="XXXXXX"
                  className="w-full px-4 py-4 rounded-lg border border-white/10 text-[24px] text-white placeholder:text-white/15 focus:outline-none focus:border-white/25 transition bg-white/5 text-center font-mono tracking-[0.3em]" />
                <button onClick={() => { if (joinCode.length >= 4) navigate(`/party/${joinCode}`); }}
                  className="w-full py-3 rounded-lg bg-white text-black font-semibold text-[14px] hover:bg-white/90 active:scale-[0.98] transition">
                  join
                </button>
              </div>
              <button onClick={() => setShowJoinCode(false)} className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition text-[20px]">&times;</button>
            </motion.div>
          </motion.div>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen relative">
        <div className="fixed inset-0 z-0">
          <img src="/bg.jpg" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 backdrop-blur-[12px] bg-black/50" />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
          <h1 className="text-[32px] font-bold text-white mb-2">party not found</h1>
          <p className="text-white/40 text-[16px] mb-8">{error}</p>
          <button onClick={() => navigate("/")} className="px-8 py-3 rounded-full bg-white text-black font-semibold text-[14px]">
            back to bubl
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 z-0">
        <img src="/bg.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 backdrop-blur-[12px] bg-black/50" />
      </div>

      <nav className="fixed top-0 w-full z-50 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="text-white font-bold text-[18px] tracking-[-0.03em]">bubl.</button>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-white/30 tracking-wider">{party?.code}</span>
            <div className={`w-2 h-2 rounded-full ${allFilled ? "bg-green-500" : "bg-yellow-500"} animate-pulse`} />
          </div>
        </div>
      </nav>

      <div className="relative z-10 pt-24 pb-20 px-5 sm:px-6">
        <div className="relative max-w-2xl mx-auto">
        {/* Tape strips on corners — outside clip-path so they're visible */}
        <div className="absolute -top-3 -left-2 z-30" style={{ width: 70, height: 24, background: "rgba(255,255,255,0.3)", transform: "rotate(-15deg)", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", backdropFilter: "blur(1px)" }} />
        <div className="absolute -top-3 -right-2 z-30" style={{ width: 70, height: 24, background: "rgba(255,255,255,0.3)", transform: "rotate(12deg)", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", backdropFilter: "blur(1px)" }} />
        <div className="absolute -bottom-3 -left-2 z-30" style={{ width: 70, height: 24, background: "rgba(255,255,255,0.3)", transform: "rotate(10deg)", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", backdropFilter: "blur(1px)" }} />
        <div className="absolute -bottom-3 -right-2 z-30" style={{ width: 70, height: 24, background: "rgba(255,255,255,0.3)", transform: "rotate(-8deg)", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", backdropFilter: "blur(1px)" }} />

        <motion.div
          variants={sectionVariants} initial="hidden" animate="visible"
          className="relative px-10 sm:px-14 py-12"
          style={{
            background: "#1a2236",
            boxShadow: "4px 6px 30px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.03)",
            transform: "rotate(-0.3deg)",
            clipPath: "polygon(0% 0.5%, 1.5% 0%, 3% 0.8%, 5% 0.2%, 7% 0.6%, 10% 0%, 12% 0.4%, 15% 0.1%, 18% 0.7%, 20% 0%, 25% 0.3%, 30% 0%, 35% 0.5%, 40% 0.1%, 50% 0.4%, 60% 0%, 65% 0.3%, 70% 0.1%, 75% 0.6%, 80% 0%, 85% 0.4%, 90% 0.1%, 93% 0.5%, 95% 0%, 97% 0.3%, 99% 0%, 100% 0.6%, 100% 5%, 99.5% 8%, 100% 12%, 99.6% 16%, 100% 20%, 99.5% 25%, 100% 30%, 99.7% 35%, 100% 40%, 99.5% 45%, 100% 50%, 99.6% 55%, 100% 60%, 99.5% 65%, 100% 70%, 99.7% 75%, 100% 80%, 99.5% 85%, 100% 90%, 99.6% 95%, 100% 99%, 99% 100%, 97% 99.5%, 95% 100%, 93% 99.6%, 90% 100%, 85% 99.5%, 80% 100%, 75% 99.6%, 70% 100%, 65% 99.5%, 60% 100%, 50% 99.6%, 40% 100%, 35% 99.5%, 30% 100%, 25% 99.4%, 20% 100%, 15% 99.6%, 10% 100%, 7% 99.5%, 5% 100%, 3% 99.6%, 1.5% 100%, 0% 99.5%, 0% 95%, 0.4% 90%, 0% 85%, 0.5% 80%, 0% 75%, 0.3% 70%, 0% 65%, 0.5% 60%, 0% 55%, 0.4% 50%, 0% 45%, 0.5% 40%, 0% 35%, 0.3% 30%, 0% 25%, 0.5% 20%, 0% 16%, 0.4% 12%, 0% 8%, 0.5% 5%)",
          }}
        >
          {/* Notebook holes on left side */}
          <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none z-10">
            {[12, 25, 38, 50, 62, 75, 88].map(pct => (
              <div key={pct} className="absolute left-2" style={{
                top: `${pct}%`,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.7)",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)",
              }} />
            ))}
          </div>

          {/* Lined paper lines */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.06 }}>
            {Array.from({ length: 30 }, (_, i) => 24 + i * 24).map(y => (
              <div key={y} className="absolute left-10 right-4" style={{ top: y, height: 1, background: "#8ba8d4" }} />
            ))}
          </div>

          {/* Red margin line */}
          <div className="absolute top-0 bottom-0 pointer-events-none" style={{ left: 36, width: 1, background: "rgba(196,107,107,0.15)" }} />

          {/* Crumple / wrinkle overlays */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `
              linear-gradient(127deg, transparent 30%, rgba(255,255,255,0.015) 32%, transparent 34%),
              linear-gradient(237deg, transparent 45%, rgba(0,0,0,0.04) 47%, transparent 49%),
              linear-gradient(352deg, transparent 60%, rgba(255,255,255,0.012) 62%, transparent 64%),
              linear-gradient(78deg, transparent 20%, rgba(0,0,0,0.03) 22%, transparent 24%),
              linear-gradient(190deg, transparent 70%, rgba(255,255,255,0.02) 72%, transparent 74%)
            `,
          }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            background: `
              radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.02) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 60%, rgba(0,0,0,0.03) 0%, transparent 40%),
              radial-gradient(ellipse at 40% 80%, rgba(255,255,255,0.015) 0%, transparent 45%)
            `,
          }} />

          <motion.div variants={itemVariants} className="text-center mb-12">
            <h1 className="text-[40px] sm:text-[56px] font-bold tracking-[-0.04em] text-white leading-[0.95]">
              double date
            </h1>
            <p className="mt-3 text-white/40 text-[16px] sm:text-[18px]">
              2v2 &middot; every match brings a friend
            </p>
          </motion.div>

          {/* Valorant-style 4-card row: guys | VS | girls */}
          <motion.div variants={sectionVariants} className="flex items-center gap-3 sm:gap-5 mb-10">
            {/* Guys side */}
            <div className="flex-1 flex gap-3 sm:gap-4">
              {slots.filter(s => s.role === "guy").map((s) => (
                <SlotCard key={s.position} slot={s} onJoin={() => setJoinModal("guy")} blurred={!!viewerSide && viewerSide !== "guy" && s.filled} />
              ))}
            </div>

            {/* VS divider */}
            <div className="flex flex-col items-center gap-2 px-1">
              <div className="w-px h-8 bg-white/10" />
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-white/10 flex items-center justify-center bg-white/5">
                <span className="text-white/25 font-bold text-[12px] sm:text-[14px]">VS</span>
              </div>
              <div className="w-px h-8 bg-white/10" />
            </div>

            {/* Girls side */}
            <div className="flex-1 flex gap-3 sm:gap-4">
              {slots.filter(s => s.role === "girl").map((s) => (
                <SlotCard key={s.position} slot={s} onJoin={() => setJoinModal("girl")} blurred={!!viewerSide && viewerSide !== "girl" && s.filled} />
              ))}
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="text-center mb-8">
            {allFilled ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-6 py-4">
                <p className="text-green-400 font-semibold text-[16px]">party's full — let's go</p>
                <p className="text-green-400/50 text-[13px] mt-1">match details drop thursday 9–11am</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-4">
                <p className="text-white/60 text-[15px]">
                  {slots.filter(s => !s.filled).length} slot{slots.filter(s => !s.filled).length > 1 ? "s" : ""} left — share the link
                </p>
              </div>
            )}
          </motion.div>

          {joinError && (
            <p className="text-red-400 text-[13px] text-center mb-4">{joinError}</p>
          )}

          <motion.div variants={itemVariants} className="flex flex-col items-center gap-4">
            <p className="font-mono text-[40px] sm:text-[56px] font-bold tracking-[0.25em] text-white/15 select-all">{party?.code}</p>
            <button
              onClick={copyLink}
              className="px-8 py-3 rounded-full bg-white text-black font-semibold text-[14px] hover:bg-white/90 active:scale-[0.97] transition"
            >
              {copied ? "copied!" : "copy invite link"}
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-16 border-t border-white/5 pt-10">
            <p className="text-white/30 text-[13px] uppercase tracking-widest font-semibold mb-6 text-center">how it works</p>
            <div className="grid sm:grid-cols-3 gap-6 text-center">
              {[
                { step: "01", text: "you get matched with someone" },
                { step: "02", text: "both of you invite a friend to fill the party" },
                { step: "03", text: "thursday hits — double date time" },
              ].map((s) => (
                <div key={s.step}>
                  <span className="font-mono text-[11px] text-white/15">{s.step}</span>
                  <p className="text-white/40 text-[14px] mt-2 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </motion.div>

        </motion.div>
        </div>
      </div>

      {joinModal && (
        <JoinModal role={joinModal} onClose={() => setJoinModal(null)} onSubmit={handleJoin} submitting={submitting} />
      )}
    </div>
  );
}
