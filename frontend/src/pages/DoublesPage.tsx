import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PerspectiveBook } from "@/components/ui/perspective-book";

const px = { fontFamily: "'Press Start 2P', monospace" };
const logo = { fontFamily: "'Nunito', sans-serif" };
const serif = { fontFamily: "'Spencer', serif" };

const API = import.meta.env.VITE_API_URL || "";

/* ─── CRT overlay ─── */
function CrtOverlay() {
  return (<><div className="crt-vignette" /><div className="crt-scanlines" /><div className="power-line" /></>);
}

/* ─── Pixel particles ─── */
function PixelParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    left: `${(i * 19 + 5) % 100}%`,
    size: i % 3 === 0 ? 3 : 2,
    duration: 9 + (i % 4) * 4,
    delay: (i * 1.5) % 6,
    color: ["#ec4899", "#6366f1", "#c4b5fd", "#ffec27", "#ec4899"][i % 5],
  }));
  return (
    <div className="fixed inset-0 z-[2] pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <div key={i} className="absolute animate-pixel-fall" style={{
          left: p.left, width: p.size, height: p.size, background: p.color, opacity: 0.3,
          animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s`, imageRendering: "pixelated",
        }} />
      ))}
    </div>
  );
}

/* ─── Pixel box ─── */
function PixelBox({ children, className = "", color = "#fff", beam = false }: { children: React.ReactNode; className?: string; color?: string; beam?: boolean }) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        border: `4px solid ${color}`,
        boxShadow: `4px 4px 0 ${color}, -4px -4px 0 ${color}, 4px -4px 0 ${color}, -4px 4px 0 ${color}`,
        imageRendering: "pixelated",
      }}
    >
      {beam && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
          <div
            className="absolute w-8 h-8 rounded-full animate-border-beam"
            style={{ background: `radial-gradient(circle, ${color}, transparent)`, filter: "blur(4px)" }}
          />
        </div>
      )}
      {children}
    </div>
  );
}

/* ─── VS badge ─── */
function VsBadge() {
  return (
    <div className="flex flex-col items-center gap-2 px-1">
      <div className="w-1 h-6" style={{ background: "#64748b" }} />
      <div className="px-3 py-2 text-[14px] sm:text-[18px] text-[#ffec27] shrink-0"
        style={{ border: "4px solid #ffec27", background: "#1c2444", boxShadow: "4px 4px 0 #3730a3", textShadow: "2px 2px 0 #3730a3" }}>
        VS
      </div>
      <div className="w-1 h-6" style={{ background: "#64748b" }} />
    </div>
  );
}

/* ─── Team slot card ─── */
function SlotCard({ label, name, filled, color, onClick }: {
  label: string; name?: string | null; filled: boolean; color: string; onClick?: () => void;
}) {
  const dark = color === "#ec4899" ? "#9d174d" : "#3730a3";
  return (
    <div
      className={`flex flex-col items-center gap-2 w-[70px] sm:w-[90px] ${!filled && onClick ? "cursor-pointer group" : ""}`}
      onClick={() => !filled && onClick?.()}
    >
      <div
        className="w-full aspect-square flex items-center justify-center transition-colors"
        style={{
          border: filled ? `4px solid ${color}` : `4px dashed ${color}44`,
          background: filled ? "#1c2444" : "#111827",
          boxShadow: filled ? `3px 3px 0 ${dark}` : "none",
        }}
      >
        {filled ? (
          <span className="text-[20px] sm:text-[24px]">{color === "#ec4899" ? "👩" : "🧑"}</span>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[16px] sm:text-[20px] group-hover:text-[#ffec27] transition-none" style={{ color: `${color}66` }}>+</span>
            {onClick && <span className="text-[5px] sm:text-[6px] group-hover:text-[#ffec27] transition-none" style={{ color: `${color}44` }}>TAP TO INVITE</span>}
          </div>
        )}
      </div>
      <span className="text-[6px] sm:text-[7px] text-center" style={{ color: filled ? color : "#64748b" }}>
        {filled ? (name || label) : label}
      </span>
      {filled && (
        <div className="px-2 py-0.5 text-[5px] sm:text-[6px] uppercase tracking-wider"
          style={{ background: color, color: "#111827" }}>
          ready
        </div>
      )}
    </div>
  );
}

/* ─── Scroll reveal ─── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, style: { opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(30px)", transition: "opacity 0.7s ease-out, transform 0.7s ease-out" } as React.CSSProperties };
}

/* ═══ Page ═══ */
type LobbyState = "landing" | "creating" | "lobby";

export function DoublesPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<LobbyState>("landing");
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [createData, setCreateData] = useState({ name: "", phone: "", role: "" as "guy" | "girl" | "" });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // lobby state
  const [lobbyCode, setLobbyCode] = useState("");
  const [mySide, setMySide] = useState<"guy" | "girl">("guy");
  const [myName, setMyName] = useState("");
  const [slots, setSlots] = useState<{ label: string; name: string | null; filled: boolean; side: "guy" | "girl" }[]>([]);

  const manual = useReveal();

  const fmt = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const inputClass =
    "w-full px-3 sm:px-4 py-3 border-4 border-[#6366f1] bg-[#1c2444] text-white text-[11px] placeholder:text-[#6366f1]/40 focus:outline-none focus:border-[#ffec27] h-[48px]";

  // Check for signed-in user on mount
  useEffect(() => {
    const saved = sessionStorage.getItem("ditto-user");
    if (saved) {
      try {
        const user = JSON.parse(saved);
        if (user.name && user.teamCode) {
          setMyName(user.name);
          setLobbyCode(user.teamCode);
          setView("lobby");
          setSlots([
            { label: "YOU", name: user.name, filled: true, side: "guy" },
            { label: "FRIEND", name: null, filled: false, side: "guy" },
            { label: "???", name: null, filled: false, side: "girl" },
            { label: "???", name: null, filled: false, side: "girl" },
          ]);
        }
      } catch { /* ignore */ }
    }
  }, []);

  const handleCreate = () => {
    const { name, phone, role } = createData;
    if (!name.trim() || !phone.trim()) { setCreateError("enter your name and phone"); return; }
    if (!role) { setCreateError("are you a guy or girl?"); return; }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const otherSide = role === "guy" ? "girl" : "guy";
    setLobbyCode(code);
    setMySide(role);
    setMyName(name.trim());
    setSlots([
      { label: "YOU", name: name.trim(), filled: true, side: role },
      { label: "FRIEND", name: null, filled: false, side: role },
      { label: "???", name: null, filled: false, side: otherSide },
      { label: "???", name: null, filled: false, side: otherSide },
    ]);
    setView("lobby");
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/party/${lobbyCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={px}>
      <CrtOverlay />
      <PixelParticles />

      {/* Background */}
      <div className="fixed inset-0 z-0" style={{ background: "#111827" }} />
      <div className="fixed inset-0 z-[1] pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)" }} />

      {/* Toast notification */}
      {copied && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-fade-up">
          <div className="px-5 sm:px-6 py-3 border-4 border-[#00e436] bg-[#111827] text-center" style={{ boxShadow: "4px 4px 0 #065f46" }}>
            <p className="text-[#00e436] text-[9px] sm:text-[11px]" style={px}>INVITE LINK COPIED!</p>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b-4 border-[#ec4899] bg-[#1c2444]/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="text-[#ec4899] text-[16px] sm:text-[20px]" style={{ ...logo, fontWeight: 900 }}>doubles</button>
          <div className="flex items-center gap-2 sm:gap-4">
            {lobbyCode && (
              <>
                <span className="text-[#ffec27] text-[8px] sm:text-[10px] tracking-wider">{lobbyCode}</span>
                <div className="w-2 h-2 bg-[#00e436] animate-pulse" />
                <span className="text-[#64748b] text-[8px] sm:text-[11px]">|</span>
              </>
            )}
            <button onClick={() => navigate("/signin")} className="text-[#444] text-[8px] sm:text-[11px] hover:text-[#ffec27] transition-none py-2">
              [ SIGN IN ]
            </button>
          </div>
        </div>
      </nav>

      <div className="relative z-10 pt-20 sm:pt-24 pb-8">

        {/* ═══ Landing: Start or Join ═══ */}
        {view === "landing" && (
          <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 sm:px-6 text-center">
            <div className="inline-block relative mb-2">
              <h1 className="text-[36px] sm:text-[56px] leading-none font-bold text-[#ec4899] relative z-10" style={logo}>doubles</h1>
              <h1 className="text-[36px] sm:text-[56px] leading-none font-bold text-[#6366f1] absolute top-0 left-0 animate-glitch-1 pointer-events-none" style={logo} aria-hidden>doubles</h1>
            </div>
            <p className="text-[#64748b] text-[7px] sm:text-[9px] mb-2">by ditto</p>
            <p className="text-[#cbd5e1] text-[16px] sm:text-[22px] mb-1" style={serif}>party lobby</p>
            <p className="text-[#64748b] text-[7px] sm:text-[9px] mb-10">2v2 double dates — grab a friend</p>

            <div className="flex flex-col gap-4 w-full max-w-xs">
              <button
                onClick={() => setView("creating")}
                className="w-full py-4 border-4 border-[#ec4899] bg-[#ec4899] text-[#111827] text-[10px] sm:text-[12px] hover:bg-white hover:border-white active:translate-x-[2px] active:translate-y-[2px] transition-none"
                style={{ boxShadow: "4px 4px 0 #9d174d" }}>
                START LOBBY
              </button>
              <div className="flex gap-2">
                <input
                  type="text" value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  placeholder="CODE"
                  className="flex-1 px-3 py-3 border-4 border-[#6366f1] bg-[#1c2444] text-white text-[11px] text-center tracking-[0.2em] placeholder:text-[#6366f1]/40 focus:outline-none focus:border-[#ffec27]"
                  style={px}
                />
                <button
                  onClick={() => { if (joinCode.length >= 4) navigate(`/party/${joinCode}`); }}
                  className="px-4 py-3 border-4 border-[#6366f1] bg-[#6366f1] text-[#111827] text-[10px] hover:bg-white hover:border-white active:translate-x-[2px] active:translate-y-[2px] transition-none"
                  style={{ boxShadow: "4px 4px 0 #3730a3" }}>
                  JOIN
                </button>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center gap-2 animate-bounce-subtle">
              <span className="text-[#64748b] text-[7px]">NEW HERE?</span>
              <span className="text-[#6366f1] text-[14px]">▼</span>
            </div>
          </div>
        )}

        {/* ═══ Create Lobby ═══ */}
        {view === "creating" && (
          <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 sm:px-6">
            <PixelBox color="#ec4899" className="max-w-sm w-full bg-[#1c2444] p-6 sm:p-8" beam>
              <h2 className="text-[14px] sm:text-[18px] text-white mb-1 text-center" style={serif}>start a lobby</h2>
              <p className="text-[#64748b] text-[7px] sm:text-[8px] mb-6 text-center">enter your info to create a party</p>

              <div className="space-y-4">
                <input type="text" value={createData.name} onChange={e => setCreateData(d => ({ ...d, name: e.target.value }))}
                  placeholder="> name" className={inputClass} style={px} />
                <input type="tel" value={createData.phone} onChange={e => setCreateData(d => ({ ...d, phone: fmt(e.target.value) }))}
                  placeholder="> phone (iMessage)" className={inputClass} style={px} />

                <div>
                  <p className="text-[#64748b] text-[7px] mb-2">I'M A...</p>
                  <div className="flex gap-2">
                    {(["guy", "girl"] as const).map(role => (
                      <button key={role} onClick={() => setCreateData(d => ({ ...d, role }))}
                        className="flex-1 py-3 text-[10px] border-4 active:translate-y-[2px] transition-none"
                        style={{
                          borderColor: role === "guy" ? "#6366f1" : "#ec4899",
                          background: createData.role === role ? (role === "guy" ? "#6366f1" : "#ec4899") : "transparent",
                          color: createData.role === role ? "#111827" : (role === "guy" ? "#6366f1" : "#ec4899"),
                          boxShadow: createData.role === role ? `3px 3px 0 ${role === "guy" ? "#3730a3" : "#9d174d"}` : "none",
                        }}>
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                {createError && <p className="text-[9px] text-white text-center">! {createError}</p>}

                <button onClick={handleCreate} disabled={creating}
                  className="w-full py-3 sm:py-4 border-4 border-[#ec4899] bg-[#ec4899] text-[#111827] text-[10px] sm:text-[12px] hover:bg-white hover:border-white active:translate-x-[2px] active:translate-y-[2px] transition-none disabled:opacity-50"
                  style={{ boxShadow: "4px 4px 0 #9d174d" }}>
                  {creating ? "LOADING..." : "CREATE PARTY"}
                </button>

                <button onClick={() => setView("landing")}
                  className="w-full py-2 text-[#64748b] text-[8px] hover:text-[#ffec27] transition-none">
                  [ BACK ]
                </button>
              </div>
            </PixelBox>
          </div>
        )}

        {/* ═══ Lobby ═══ */}
        {view === "lobby" && (
          <div className="px-4 sm:px-6">
            <div className="max-w-2xl mx-auto">

              {/* Lobby header */}
              <div className="text-center mb-8 sm:mb-12">
                <p className="text-[#ec4899] text-[8px] sm:text-[10px] mb-2">LOBBY</p>
                <h1 className="text-[20px] sm:text-[28px] text-white" style={serif}>double date</h1>
                <p className="text-[#64748b] text-[7px] sm:text-[9px] mt-2">2v2 — every match brings a friend</p>
              </div>

              {/* Arena */}
              <PixelBox color="#6366f1" className="bg-[#1c2444] p-6 sm:p-10" beam>
                <div className="flex items-center justify-center gap-3 sm:gap-5">
                  {/* My side */}
                  <div className="text-center flex-1">
                    <p className="text-[#ec4899] text-[7px] sm:text-[8px] mb-4 uppercase">
                      {mySide === "guy" ? "guys" : "girls"}
                    </p>
                    <div className="flex justify-center gap-3 sm:gap-4">
                      {slots.filter(s => s.side === mySide).map((s, i) => (
                        <SlotCard key={i} label={s.label} name={s.name} filled={s.filled}
                          color={mySide === "guy" ? "#6366f1" : "#ec4899"}
                          onClick={!s.filled ? copyLink : undefined} />
                      ))}
                    </div>
                  </div>

                  <VsBadge />

                  {/* Other side — mystery, matched by ditto */}
                  <div className="text-center flex-1">
                    <p className="text-white/40 text-[7px] sm:text-[8px] mb-4 uppercase">
                      mystery duo
                    </p>
                    <div className="flex justify-center gap-3 sm:gap-4">
                      {slots.filter(s => s.side !== mySide).map((s, i) => (
                        <SlotCard key={i} label={s.label} name={s.name} filled={s.filled}
                          color={mySide === "guy" ? "#ec4899" : "#6366f1"} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="mt-8 pt-6 border-t-2 border-[#6366f1]/20 text-center">
                  {(() => {
                    const friendSlot = slots.find(s => s.side === mySide && !s.filled);
                    if (friendSlot) {
                      return <p className="text-[#444] text-[8px] sm:text-[10px] leading-[2]">
                        invite your friend to complete your duo.<br />
                        <span className="text-[#ffec27]">we'll match you with another pair.</span>
                      </p>;
                    }
                    return <p className="text-[#00e436] text-[8px] sm:text-[10px] leading-[2]">
                      your duo is set — waiting for ditto to match you
                    </p>;
                  })()}
                </div>
              </PixelBox>

              {/* Code + share (for inviting your friend) */}
              <div className="mt-8 text-center">
                <p className="text-[#64748b] text-[7px] sm:text-[8px] mb-3">SEND THIS TO YOUR FRIEND</p>
                <p className="text-[24px] sm:text-[32px] tracking-[0.3em] text-[#6366f1] select-all mb-4" style={px}>
                  {lobbyCode}
                </p>
                <button onClick={copyLink}
                  className="px-8 py-3 border-4 border-[#ffec27] bg-[#ffec27] text-[#111827] text-[9px] sm:text-[11px] hover:bg-white hover:border-white active:translate-x-[2px] active:translate-y-[2px] transition-none"
                  style={{ boxShadow: "4px 4px 0 #a38a1a" }}>
                  {copied ? "COPIED!" : "COPY INVITE LINK"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ Example Lobby ═══ */}
        <section className="mt-16 sm:mt-24 px-4 sm:px-6">
          <div className="max-w-lg mx-auto">
            <p className="text-[#64748b] text-[6px] sm:text-[8px] mb-4 tracking-widest text-center">EXAMPLE LOBBY</p>
            <PixelBox color="#6366f1" className="bg-[#1c2444] p-4 sm:p-6" beam>
              <div className="flex items-center justify-center gap-2 sm:gap-4">
                {/* Guys side */}
                <div className="text-center flex-1">
                  <p className="text-[#6366f1] text-[6px] sm:text-[7px] mb-3 uppercase">guys</p>
                  <div className="flex justify-center gap-2 sm:gap-3">
                    <div className="flex flex-col items-center gap-1.5 w-[50px] sm:w-[65px]">
                      <div className="w-full aspect-square flex items-center justify-center"
                        style={{ border: "3px solid #6366f1", background: "#1c2444", boxShadow: "2px 2px 0 #3730a3" }}>
                        <span className="text-[16px] sm:text-[20px]">🧑</span>
                      </div>
                      <span className="text-[5px] sm:text-[6px] text-[#6366f1]">Jake</span>
                      <div className="px-1.5 py-0.5 text-[4px] sm:text-[5px] uppercase bg-[#6366f1] text-[#111827]">ready</div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 w-[50px] sm:w-[65px]">
                      <div className="w-full aspect-square flex items-center justify-center"
                        style={{ border: "3px solid #6366f1", background: "#1c2444", boxShadow: "2px 2px 0 #3730a3" }}>
                        <span className="text-[16px] sm:text-[20px]">🧑</span>
                      </div>
                      <span className="text-[5px] sm:text-[6px] text-[#6366f1]">Ethan</span>
                      <div className="px-1.5 py-0.5 text-[4px] sm:text-[5px] uppercase bg-[#6366f1] text-[#111827]">ready</div>
                    </div>
                  </div>
                </div>

                {/* VS */}
                <div className="flex flex-col items-center gap-1 px-1">
                  <div className="w-1 h-4" style={{ background: "#64748b" }} />
                  <div className="px-2 py-1 text-[10px] sm:text-[12px] text-[#ffec27]"
                    style={{ border: "3px solid #ffec27", background: "#1c2444", boxShadow: "3px 3px 0 #3730a3" }}>
                    VS
                  </div>
                  <div className="w-1 h-4" style={{ background: "#64748b" }} />
                </div>

                {/* Girls side */}
                <div className="text-center flex-1">
                  <p className="text-[#ec4899] text-[6px] sm:text-[7px] mb-3 uppercase">girls</p>
                  <div className="flex justify-center gap-2 sm:gap-3">
                    <div className="flex flex-col items-center gap-1.5 w-[50px] sm:w-[65px]">
                      <div className="w-full aspect-square flex items-center justify-center"
                        style={{ border: "3px solid #ec4899", background: "#1c2444", boxShadow: "2px 2px 0 #9d174d" }}>
                        <span className="text-[16px] sm:text-[20px]">👩</span>
                      </div>
                      <span className="text-[5px] sm:text-[6px] text-[#ec4899]">Mia</span>
                      <div className="px-1.5 py-0.5 text-[4px] sm:text-[5px] uppercase bg-[#ec4899] text-[#111827]">ready</div>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 w-[50px] sm:w-[65px]">
                      <div className="w-full aspect-square flex items-center justify-center"
                        style={{ border: "3px solid #ec4899", background: "#1c2444", boxShadow: "2px 2px 0 #9d174d" }}>
                        <span className="text-[16px] sm:text-[20px]">👩</span>
                      </div>
                      <span className="text-[5px] sm:text-[6px] text-[#ec4899]">Lily</span>
                      <div className="px-1.5 py-0.5 text-[4px] sm:text-[5px] uppercase bg-[#ec4899] text-[#111827]">ready</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t-2 border-[#6366f1]/20 text-center">
                <p className="text-[#00e436] text-[6px] sm:text-[8px] leading-[2]">
                  party's full — double date this wednesday
                </p>
              </div>
            </PixelBox>
          </div>
        </section>

        {/* ═══ Nintendo-style User Manual ═══ */}
        <section className="mt-20 sm:mt-32 px-4 sm:px-6 pb-16">
          <div ref={manual.ref} style={manual.style} className="max-w-2xl mx-auto">

            {/* Manual cover — 3D book */}
            <div className="flex justify-center mb-10 sm:mb-14">
              <PerspectiveBook size="lg" className="bg-[#1a1a2e] border-[#ec4899]">
                <div className="flex flex-col h-full relative overflow-hidden">
                  {/* NES-style top stripe */}
                  <div className="flex items-center gap-0 -mx-[12%] -mt-[12%]">
                    <div className="h-[18px] flex-1 bg-[#ec4899]" />
                    <div className="h-[18px] w-[6px] bg-[#1a1a2e]" />
                    <div className="h-[18px] flex-1 bg-[#6366f1]" />
                  </div>

                  {/* Pixel heart art — split pink/indigo */}
                  <div className="flex justify-center mt-6 mb-2">
                    <svg width="48" height="42" viewBox="0 0 12 10" style={{ imageRendering: "pixelated" }}>
                      <rect x="1" y="0" width="3" height="1" fill="#ec4899"/>
                      <rect x="7" y="0" width="3" height="1" fill="#6366f1"/>
                      <rect x="0" y="1" width="5" height="1" fill="#ec4899"/>
                      <rect x="6" y="1" width="5" height="1" fill="#6366f1"/>
                      <rect x="0" y="2" width="6" height="1" fill="#ec4899"/>
                      <rect x="6" y="2" width="5" height="1" fill="#6366f1"/>
                      <rect x="0" y="3" width="6" height="1" fill="#ec4899"/>
                      <rect x="6" y="3" width="5" height="1" fill="#6366f1"/>
                      <rect x="1" y="4" width="5" height="1" fill="#ec4899"/>
                      <rect x="6" y="4" width="4" height="1" fill="#6366f1"/>
                      <rect x="2" y="5" width="4" height="1" fill="#ec4899"/>
                      <rect x="6" y="5" width="3" height="1" fill="#6366f1"/>
                      <rect x="3" y="6" width="3" height="1" fill="#ec4899"/>
                      <rect x="6" y="6" width="2" height="1" fill="#6366f1"/>
                      <rect x="4" y="7" width="2" height="1" fill="#ec4899"/>
                      <rect x="6" y="7" width="1" height="1" fill="#6366f1"/>
                      <rect x="5" y="8" width="1" height="1" fill="#ec4899"/>
                    </svg>
                  </div>

                  {/* Title */}
                  <div className="text-center flex-1 flex flex-col justify-center -mt-2">
                    <h2 className="text-[28px] sm:text-[36px] font-black text-[#ec4899] leading-none" style={logo}>
                      Doubles
                    </h2>
                    <p className="text-[#ec4899]/60 text-[6px] mt-1.5 tracking-widest" style={px}>2V2 DATING GAME</p>

                    {/* Divider */}
                    <div className="flex items-center gap-2 mx-auto mt-3 mb-3 w-[80%]">
                      <div className="h-[2px] flex-1 bg-[#6366f1]/40" />
                      <div className="w-[4px] h-[4px] bg-[#ec4899]" style={{ imageRendering: "pixelated" }} />
                      <div className="h-[2px] flex-1 bg-[#6366f1]/40" />
                    </div>

                    <p className="text-[#6366f1] text-[5px] sm:text-[6px] tracking-[0.2em] uppercase" style={px}>
                      Instruction Manual
                    </p>
                    <p className="text-[#64748b] text-[6px] sm:text-[7px] mt-3" style={px}>By Ditto</p>
                  </div>
                </div>
              </PerspectiveBook>
            </div>

            {/* Page 1: Overview */}
            <PixelBox color="#ec4899" className="bg-[#b8b4af] p-5 sm:p-8 mb-8" beam>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-[#ec4899] flex items-center justify-center shrink-0"
                  style={{ background: "#d4d0cb" }}>
                  <span className="text-[#ec4899] text-[8px] sm:text-[10px]">1</span>
                </div>
                <div>
                  <h3 className="text-[#1a1a2e] text-[10px] sm:text-[12px] mb-1">WHAT IS DOUBLES?</h3>
                  <p className="text-[#64748b] text-[6px] sm:text-[7px]">page 1 of 4</p>
                </div>
              </div>
              <div className="border-t-2 border-[#ec4899]/20 pt-4">
                <p className="text-[#444] text-[8px] sm:text-[10px] leading-[2.5]">
                  doubles is 2v2 blind dating. you and a friend get matched with another duo for a double date every wednesday.
                </p>
                <p className="text-[#444] text-[8px] sm:text-[10px] leading-[2.5] mt-3">
                  no swiping. no profiles. no pressure. just show up with your friend and meet two new people.
                </p>
                <div className="mt-5 p-3 bg-[#d4d0cb] border-2 border-[#6366f1]/30">
                  <p className="text-[#6366f1] text-[7px] sm:text-[8px] leading-[2]">
                    TIP: dating is always less awkward when your best friend is there
                  </p>
                </div>
              </div>
            </PixelBox>

            {/* Page 2: How to play */}
            <PixelBox color="#6366f1" className="bg-[#b8b4af] p-5 sm:p-8 mb-8" beam>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-[#6366f1] flex items-center justify-center shrink-0"
                  style={{ background: "#d4d0cb" }}>
                  <span className="text-[#6366f1] text-[8px] sm:text-[10px]">2</span>
                </div>
                <div>
                  <h3 className="text-[#1a1a2e] text-[10px] sm:text-[12px] mb-1">HOW TO PLAY</h3>
                  <p className="text-[#64748b] text-[6px] sm:text-[7px]">page 2 of 4</p>
                </div>
              </div>
              <div className="border-t-2 border-[#6366f1]/20 pt-4 space-y-4">
                {[
                  { step: "01", label: "SIGN UP", desc: "create your profile on the front page. takes 30 seconds.", color: "#ec4899" },
                  { step: "02", label: "TEAM UP", desc: "invite your best friend using your team code. you're a duo now.", color: "#6366f1" },
                  { step: "03", label: "GET MATCHED", desc: "every wednesday we match your duo with another duo.", color: "#b8860b" },
                  { step: "04", label: "DOUBLE DATE", desc: "we plan the date. all 4 of you just show up.", color: "#16a34a" },
                ].map(s => (
                  <div key={s.step} className="flex items-start gap-3">
                    <div className="w-8 h-8 border-2 flex items-center justify-center shrink-0"
                      style={{ borderColor: s.color, background: "#d4d0cb" }}>
                      <span className="text-[8px]" style={{ color: s.color }}>{s.step}</span>
                    </div>
                    <div className="pt-1">
                      <p className="text-[8px] sm:text-[9px] mb-0.5" style={{ color: s.color }}>{s.label}</p>
                      <p className="text-[#555] text-[7px] sm:text-[8px] leading-[2]">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </PixelBox>

            {/* Page 3: The lobby */}
            <PixelBox color="#b8860b" className="bg-[#b8b4af] p-5 sm:p-8 mb-8" beam>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-[#b8860b] flex items-center justify-center shrink-0"
                  style={{ background: "#d4d0cb" }}>
                  <span className="text-[#b8860b] text-[8px] sm:text-[10px]">3</span>
                </div>
                <div>
                  <h3 className="text-[#1a1a2e] text-[10px] sm:text-[12px] mb-1">THE LOBBY</h3>
                  <p className="text-[#64748b] text-[6px] sm:text-[7px]">page 3 of 4</p>
                </div>
              </div>
              <div className="border-t-2 border-[#b8860b]/20 pt-4">
                <p className="text-[#444] text-[8px] sm:text-[10px] leading-[2.5]">
                  the lobby is your party's home base. here you can see who's in, who's missing, and share your invite code.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { icon: "🎮", label: "START LOBBY", desc: "create a new party" },
                    { icon: "🔗", label: "JOIN LOBBY", desc: "enter a friend's code" },
                    { icon: "📋", label: "SHARE CODE", desc: "invite your +1" },
                    { icon: "👀", label: "WAIT", desc: "we handle the rest" },
                  ].map((item, i) => (
                    <div key={i} className="p-2 sm:p-3 bg-[#d4d0cb] border-2 border-[#b8860b]/20 text-center">
                      <span className="text-[14px]">{item.icon}</span>
                      <p className="text-[#b8860b] text-[6px] sm:text-[7px] mt-1">{item.label}</p>
                      <p className="text-[#666] text-[5px] sm:text-[6px] mt-0.5">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </PixelBox>

            {/* Page 4: FAQ */}
            <PixelBox color="#16a34a" className="bg-[#b8b4af] p-5 sm:p-8" beam>
              <div className="flex items-start gap-3 mb-4">
                <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-[#16a34a] flex items-center justify-center shrink-0"
                  style={{ background: "#d4d0cb" }}>
                  <span className="text-[#16a34a] text-[8px] sm:text-[10px]">4</span>
                </div>
                <div>
                  <h3 className="text-[#1a1a2e] text-[10px] sm:text-[12px] mb-1">FAQ</h3>
                  <p className="text-[#64748b] text-[6px] sm:text-[7px]">page 4 of 4</p>
                </div>
              </div>
              <div className="border-t-2 border-[#16a34a]/20 pt-4 space-y-5">
                {[
                  { q: "DO I NEED AN APP?", a: "nope. everything runs through iMessage and this website." },
                  { q: "WHAT IF I DON'T HAVE A FRIEND?", a: "sign up solo on the front page — we'll pair you with someone." },
                  { q: "WHEN DO MATCHES DROP?", a: "every wednesday. you'll get a text with your match details." },
                  { q: "IS IT FREE?", a: "yes. completely free. no catch." },
                ].map((item, i) => (
                  <div key={i}>
                    <p className="text-[#16a34a] text-[7px] sm:text-[9px] mb-1">{item.q}</p>
                    <p className="text-[#555] text-[7px] sm:text-[8px] leading-[2]">{item.a}</p>
                  </div>
                ))}
              </div>
            </PixelBox>

            {/* Manual footer */}
            <div className="mt-10 text-center">
              <p className="text-[#64748b] text-[6px] sm:text-[7px]">— END OF MANUAL —</p>
              <button onClick={() => navigate("/")}
                className="mt-4 text-[#ec4899] text-[8px] sm:text-[10px] hover:text-[#ffec27] transition-none">
                [ BACK TO DITTO ]
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 sm:py-10 px-4 sm:px-6 border-t-4 border-[#ec4899]/20">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-[#ec4899] text-[14px] sm:text-[18px]" style={{ ...logo, fontWeight: 900 }}>doubles</span>
            <p className="text-[#64748b] text-[8px] sm:text-[10px]">every wednesday</p>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/")} className="text-[#64748b] text-[6px] sm:text-[8px] hover:text-[#6366f1] transition-none">by ditto</button>
              <span className="text-[#64748b]/30 text-[6px]">|</span>
              <p className="text-[#64748b] text-[6px] sm:text-[8px]">&copy; 2026</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
