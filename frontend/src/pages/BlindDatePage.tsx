import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const px = { fontFamily: "'Press Start 2P', monospace" };
const logo = { fontFamily: "'Nunito', sans-serif" };
const serif = { fontFamily: "'Spencer', serif" };

/* ─── Boot sequence overlay ─── */
function BootSequence({ onDone }: { onDone: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const bootLines = [
    "DITTO MATCHMAKING ENGINE v2.0.26",
    "LOADING ROMANCE MODULES...",
    "CALIBRATING HEART SENSORS... OK",
    "SCANNING FOR PLAYERS... ██████ DONE",
    "MATCH ALGORITHM READY",
    "",
    "> PRESS START",
  ];
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i < bootLines.length) { setLines(prev => [...prev, bootLines[i]]); i++; }
      else { clearInterval(id); setTimeout(onDone, 400); }
    }, 150);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fixed inset-0 z-[200] bg-[#111827] flex items-center justify-center px-6" style={px}>
      <div className="max-w-md w-full">
        {lines.map((line, i) => (
          <p key={i} className={`text-[8px] sm:text-[10px] leading-[2.5] ${
            line === "> PRESS START" ? "text-[#ffec27] animate-blink-slow mt-2" :
            line.includes("OK") || line.includes("DONE") || line.includes("READY") ? "text-[#00e436]" :
            "text-[#6366f1]"
          }`}>{line}</p>
        ))}
        <span className="inline-block w-[8px] h-[14px] bg-[#6366f1] ml-1 align-middle" style={{ animation: "blink-pixel 0.5s step-end infinite" }} />
      </div>
    </div>
  );
}

/* ─── CRT overlay (vignette + scanlines + power line) ─── */
function CrtOverlay() {
  return (
    <>
      <div className="crt-vignette" />
      <div className="crt-scanlines" />
      <div className="power-line" />
    </>
  );
}

/* ─── Scroll-based level indicator ─── */
function LevelIndicator() {
  const [level, setLevel] = useState(1);
  const [xp, setXp] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const pct = Math.min(window.scrollY / (document.body.scrollHeight - window.innerHeight), 1);
      const newLevel = Math.max(1, Math.min(7, Math.floor(pct * 7) + 1));
      setLevel(newLevel);
      setXp(Math.round((pct * 7 - Math.floor(pct * 7)) * 100));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-1 pointer-events-none" style={px}>
      <span className="text-[7px] text-[#ffec27]">LVL {level}</span>
      <div className="w-[50px] h-[6px] border border-[#6366f1]/40 overflow-hidden" style={{ imageRendering: "pixelated" }}>
        <div className="h-full bg-[#6366f1] transition-all duration-300" style={{ width: `${xp}%` }} />
      </div>
    </div>
  );
}

/* ─── Floating pixel particles ─── */
function PixelParticles() {
  const particles = Array.from({ length: 15 }, (_, i) => ({
    left: `${(i * 17 + 7) % 100}%`,
    size: i % 3 === 0 ? 3 : 2,
    duration: 8 + (i % 5) * 4,
    delay: (i * 1.3) % 7,
    color: ["#6366f1", "#ec4899", "#ffffff", "#ffec27", "#6366f1"][i % 5],
  }));
  return (
    <div className="fixed inset-0 z-[2] pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <div key={i} className="absolute animate-pixel-fall" style={{
          left: p.left,
          width: p.size,
          height: p.size,
          background: p.color,
          opacity: 0.3,
          animationDuration: `${p.duration}s`,
          animationDelay: `${p.delay}s`,
          imageRendering: "pixelated",
        }} />
      ))}
    </div>
  );
}

/* ─── Screen shake wrapper ─── */
function useScreenShake() {
  const [shaking, setShaking] = useState(false);
  const shake = () => { setShaking(true); setTimeout(() => setShaking(false), 300); };
  return { shaking, shake };
}

/* ─── Scroll reveal hook ─── */
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

/* ─── Countdown to next Thursday 7 PM PST ─── */
function useCountdown() {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    function getNext() {
      const now = new Date();
      const pst = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
      const day = pst.getDay(); // 0=Sun … 3=Wed
      let daysUntil = (3 - day + 7) % 7;
      if (daysUntil === 0 && pst.getHours() >= 19) daysUntil = 7;
      const target = new Date(pst);
      target.setDate(pst.getDate() + daysUntil);
      target.setHours(19, 0, 0, 0);
      return target.getTime() - pst.getTime();
    }
    const tick = () => {
      const ms = getNext();
      const s = Math.floor(ms / 1000);
      setTime({ d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

/* ─── Digit display for countdown ─── */
function CountdownDigit({ value, label }: { value: number; label: string }) {
  const str = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-1">
        {str.split("").map((ch, i) => (
          <div key={i} className="w-[28px] sm:w-[44px] h-[36px] sm:h-[56px] bg-[#1c2444] border-2 border-[#6366f1] flex items-center justify-center"
            style={{ boxShadow: "0 0 8px #6366f133" }}>
            <span className="text-[16px] sm:text-[28px] text-[#ffffff] tabular-nums">{ch}</span>
          </div>
        ))}
      </div>
      <span className="text-[6px] sm:text-[7px] text-[#64748b] mt-1.5 uppercase tracking-widest">{label}</span>
    </div>
  );
}

/* ─── Pixel border box with optional border beam ─── */
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

/* ─── Custom pixel select dropdown ─── */
function PixelSelect({ value, onChange, placeholder, options, className = "" }: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 sm:px-4 border-4 border-[#6366f1] bg-[#1c2444] text-left text-[11px] focus:outline-none focus:border-[#ffec27] h-[48px] flex items-center justify-between"
        style={px}
      >
        <span className={value ? "text-white" : "text-[#6366f1]/40"}>
          {value ? options.find(o => o.value === value)?.label || value : placeholder}
        </span>
        <span className="text-[#6366f1] text-[8px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 border-4 border-[#6366f1] bg-[#1c2444] max-h-[200px] overflow-y-auto" style={{ boxShadow: "4px 4px 0 #3730a3" }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full px-3 py-2.5 text-left text-[9px] sm:text-[11px] min-h-[40px] ${
                value === opt.value ? "bg-[#6366f1] text-[#1c2444]" : "text-white hover:bg-[#6366f1]/20"
              }`}
              style={px}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Blinking pixel cursor ─── */
function BlinkCursor() {
  return (
    <span
      className="inline-block w-[12px] h-[22px] bg-white ml-1 align-middle"
      style={{ animation: "blink-pixel 1s step-end infinite" }}
    />
  );
}

/* ─── Glitch logo ─── */
const display = { fontFamily: "'Rubik Glitch', system-ui" };

function GlitchLogo({ size = "text-[52px] sm:text-[85px] lg:text-[110px]" }: { size?: string }) {
  return (
    <div className="relative inline-block">
      <h1 className={`${size} leading-none tracking-[0.02em] text-[#ec4899] text-shimmer relative z-10`} style={display}>
        doubles
      </h1>
      <h1
        className={`${size} leading-none tracking-[0.02em] text-[#6366f1] absolute top-0 left-0 animate-glitch-1 pointer-events-none`}
        style={display} aria-hidden
      >
        doubles
      </h1>
      <h1
        className={`${size} leading-none tracking-[0.02em] text-[#ffec27] absolute top-0 left-0 animate-glitch-2 pointer-events-none`}
        style={display} aria-hidden
      >
        doubles
      </h1>
    </div>
  );
}

/* ─── Pixel heart ─── */
function PixelHeart({ size = 32 }: { size?: number }) {
  const s = size / 16;
  const r = (x: number, y: number, w: number, h: number, fill: string) => (
    <rect x={x * s} y={y * s} width={w * s} height={h * s} fill={fill} />
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ imageRendering: "pixelated" }}>
      {r(2,0,3,1,"#000")}{r(8,0,3,1,"#000")}
      {r(1,1,1,1,"#000")}{r(5,1,3,1,"#000")}{r(11,1,1,1,"#000")}
      {r(0,2,1,2,"#000")}{r(12,2,1,2,"#000")}
      {r(0,4,1,1,"#000")}{r(12,4,1,1,"#000")}
      {r(0,5,1,1,"#000")}{r(12,5,1,1,"#000")}
      {r(1,6,1,1,"#000")}{r(11,6,1,1,"#000")}
      {r(2,7,1,1,"#000")}{r(10,7,1,1,"#000")}
      {r(3,8,1,1,"#000")}{r(9,8,1,1,"#000")}
      {r(4,9,1,1,"#000")}{r(8,9,1,1,"#000")}
      {r(5,10,1,1,"#000")}{r(7,10,1,1,"#000")}
      {r(6,11,1,1,"#000")}
      {r(5,5,7,1,"#9d174d")}{r(4,6,7,1,"#9d174d")}{r(5,7,5,1,"#9d174d")}
      {r(6,8,3,1,"#9d174d")}{r(7,9,1,1,"#9d174d")}
      {r(11,2,1,2,"#9d174d")}{r(11,4,1,1,"#9d174d")}{r(11,5,1,1,"#9d174d")}
      {r(10,6,1,1,"#9d174d")}
      {r(2,1,3,1,"#7c3aed")}{r(8,1,3,1,"#7c3aed")}
      {r(1,2,3,1,"#7c3aed")}{r(7,2,4,1,"#7c3aed")}
      {r(1,3,3,1,"#7c3aed")}{r(6,3,5,1,"#7c3aed")}
      {r(1,4,4,1,"#7c3aed")}{r(6,4,6,1,"#7c3aed")}
      {r(1,5,4,1,"#7c3aed")}{r(6,5,5,1,"#7c3aed")}
      {r(2,6,2,1,"#7c3aed")}{r(5,6,5,1,"#7c3aed")}
      {r(3,7,2,1,"#7c3aed")}{r(6,7,4,1,"#7c3aed")}
      {r(4,8,2,1,"#7c3aed")}{r(7,8,2,1,"#7c3aed")}
      {r(5,9,2,1,"#7c3aed")}
      {r(6,10,1,1,"#7c3aed")}
      {r(4,2,3,1,"#ffffff")}{r(4,3,2,1,"#ffffff")}{r(5,4,1,1,"#ffffff")}
      {r(3,2,1,1,"#fff")}{r(4,1,1,1,"#fff")}
      {r(3,3,1,1,"#fff")}
    </svg>
  );
}

/* ─── Pixel star decorations ─── */
function PixelStars() {
  const stars = [
    { x: "8%", y: "12%", delay: "0s" },
    { x: "92%", y: "8%", delay: "0.5s" },
    { x: "85%", y: "35%", delay: "1s" },
    { x: "5%", y: "55%", delay: "1.5s" },
    { x: "90%", y: "65%", delay: "0.3s" },
    { x: "15%", y: "80%", delay: "0.8s" },
    { x: "75%", y: "90%", delay: "1.2s" },
  ];
  return (
    <>
      {stars.map((s, i) => (
        <div
          key={i}
          className="fixed w-2 h-2 bg-yellow-300 z-0 pointer-events-none"
          style={{
            left: s.x,
            top: s.y,
            animation: `twinkle-pixel 2s step-end infinite`,
            animationDelay: s.delay,
            imageRendering: "pixelated",
          }}
        />
      ))}
    </>
  );
}

/* ─── Interactive FAQ accordion ─── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b-2 border-[#ec4899]/20">
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-4 sm:py-5 flex items-center justify-between text-left gap-4 group"
        style={px}
      >
        <span className="text-[#ffffff] text-[9px] sm:text-[12px] leading-[2]">{q}</span>
        <span
          className="text-[#ec4899] text-[14px] shrink-0 transition-transform duration-500"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        >
          ▼
        </span>
      </button>
      <div
        className="overflow-hidden transition-all duration-500"
        style={{ maxHeight: open ? "200px" : "0", opacity: open ? 1 : 0 }}
      >
        <p className="text-[#cbd5e1] text-[8px] sm:text-[11px] leading-[2.2] pb-4 sm:pb-5 pl-2">{a}</p>
      </div>
    </div>
  );
}

/* ─── Photo marquee (Ditto-style horizontal scroll) ─── */
function PhotoMarquee() {
  const photos = [
    { src: "/1.jpg" }, { src: "/2.jpg" }, { src: "/3.jpg" },
    { src: "/4.jpg" }, { src: "/5.jpg" }, { src: "/6.jpg" },
    { src: "/7.jpg", rotate90: true }, { src: "/8.jpg" }, { src: "/9.jpg" },
  ];
  const colors = ["#ffffff", "#6366f1", "#ffec27", "#ec4899", "#ffffff", "#6366f1", "#ffec27", "#ec4899", "#ffffff"];
  const allPhotos = [...photos, ...photos];
  return (
    <div className="overflow-hidden">
      <div className="flex gap-4 sm:gap-6" style={{ animation: "marquee-scroll 80s linear infinite", width: "max-content" }}>
        {allPhotos.map((p, i) => (
          <div
            key={i}
            className="shrink-0 overflow-hidden"
            style={{
              border: `4px solid ${colors[i % colors.length]}`,
              boxShadow: `0 0 20px ${colors[i % colors.length]}22`,
            }}
          >
            <img
              src={p.src}
              alt=""
              className="h-[200px] sm:h-[300px] object-cover block"
              style={{
                width: "auto",
                minWidth: p.rotate90 ? "300px" : "260px",
                maxWidth: p.rotate90 ? "300px" : "400px",
                ...(p.rotate90 ? { transform: "rotate(270deg)", transformOrigin: "center center", objectFit: "contain" as const } : {}),
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}


/* ═══ Page ═══ */

export function BlindDatePage() {
  const navigate = useNavigate();
  const countdown = useCountdown();
  const { shaking, shake } = useScreenShake();
  const [booted, setBooted] = useState(() => sessionStorage.getItem("ditto-booted") === "1");
  const [code, setCode] = useState("");
  const signupRef = useRef<HTMLDivElement>(null);

  const howItWorks = useReveal();
  const experiences = useReveal();
  const quote = useReveal();
  const imessage = useReveal();
  const signup = useReveal();
  const faq = useReveal();

  const scrollToSignup = () => signupRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
    {!booted && <BootSequence onDone={() => { setBooted(true); sessionStorage.setItem("ditto-booted", "1"); }} />}
    <div className={`min-h-screen relative overflow-x-hidden ${shaking ? "animate-screen-shake" : ""}`} style={px}>

      {/* ── CRT + ambient effects ── */}
      <CrtOverlay />
      <PixelParticles />
      <LevelIndicator />

      {/* ── Global background ── */}
      <div className="fixed inset-0 z-0" style={{ background: "#111827" }} />
      <div
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)" }}
      />
      <PixelStars />

      {/* ── Nav ── */}
      <nav className="fixed top-0 w-full z-50 border-b-4 border-[#6366f1] bg-[#1c2444]/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-white text-[16px] sm:text-[20px]" style={{ ...logo, fontWeight: 900 }}>Ditto</span>
            <div className="flex items-center gap-1.5 ml-2">
              <PixelHeart size={10} />
              <PixelHeart size={10} />
              <PixelHeart size={10} />
            </div>
            <span className="text-[#64748b] text-[6px] sm:text-[7px] ml-1 hidden sm:inline">HI-SCORE</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => navigate("/doubles")} className="text-[#ec4899] text-[8px] sm:text-[11px] hover:text-[#ffec27] transition-none py-2">
              [ DOUBLES ]
            </button>
            <span className="text-[#64748b] text-[8px] sm:text-[11px]">|</span>
            <button onClick={() => navigate("/signin")} className="text-[#cbd5e1] text-[8px] sm:text-[11px] hover:text-[#ffec27] transition-none py-2">
              [ SIGN IN ]
            </button>
            <span className="text-[#64748b] text-[8px] sm:text-[11px]">|</span>
            <button onClick={scrollToSignup} className="text-[#ec4899] text-[8px] sm:text-[11px] hover:text-[#ffec27] transition-none py-2">
              [ JOIN NOW ]
            </button>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════
          SECTION 1 — Hero (sticky, full viewport, like Ditto)
          ════════════════════════════════════════════════════════════ */}
      <section className="sticky top-0 z-10 h-[100svh] min-h-[600px] flex flex-col items-center justify-center px-4 sm:px-6 -mb-[100svh] overflow-hidden"
        style={{ background: "#111827" }}>

        {/* Sunset background — blurred + frosted like ditto */}
        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
          <img src="/lasunset.jpg" alt="" className="w-full h-full object-cover" style={{ filter: "blur(10px) brightness(0.35) saturate(1.3)", transform: "scale(1.05)" }} />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(17,24,39,0.6) 0%, rgba(17,24,39,0.3) 40%, rgba(17,24,39,0.7) 100%)" }} />
          <div className="absolute inset-0" style={{ background: "rgba(17,24,39,0.15)" }} />
        </div>

        <div className="text-center relative z-10 animate-fade-up">
          <GlitchLogo />
          <p className="mt-3 sm:mt-4 text-[#64748b] text-[12px] sm:text-[16px]" style={px}>by Ditto</p>

          <p className="mt-6 sm:mt-8 text-[#cbd5e1] text-[22px] sm:text-[32px] lg:text-[40px] leading-[1.3] max-w-lg mx-auto" style={serif}>
            double dates every wednesday
          </p>
          <p className="mt-2 text-[#ffec27] text-[9px] sm:text-[11px]">
            you + friend vs mystery duo<BlinkCursor />
          </p>

          {/* Couple photo */}
          <div className="mt-8 sm:mt-10 relative w-[200px] sm:w-[280px] mx-auto rounded-2xl overflow-hidden" style={{ boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
            <img src="/couple.jpg" alt="" className="w-full block" style={{ filter: "brightness(0.85) contrast(1.05)" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(99,102,241,0.2), rgba(236,72,153,0.1))", mixBlendMode: "color" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent 40%, rgba(17,24,39,0.4) 100%)" }} />
          </div>

          {/* Countdown */}
          <div className="mt-8 sm:mt-10 flex items-center justify-center gap-2 sm:gap-4">
            <CountdownDigit value={countdown.d} label="days" />
            <span className="text-[#6366f1] text-[16px] sm:text-[28px] self-start mt-1 sm:mt-2 animate-blink-slow">:</span>
            <CountdownDigit value={countdown.h} label="hrs" />
            <span className="text-[#6366f1] text-[16px] sm:text-[28px] self-start mt-1 sm:mt-2 animate-blink-slow">:</span>
            <CountdownDigit value={countdown.m} label="min" />
            <span className="text-[#6366f1] text-[16px] sm:text-[28px] self-start mt-1 sm:mt-2 animate-blink-slow">:</span>
            <CountdownDigit value={countdown.s} label="sec" />
          </div>

          <p className="mt-4 text-[#64748b] text-[7px] sm:text-[8px]">NEXT MATCH DROP: WEDNESDAY 7 PM</p>

          {/* iMessage CTA */}
          <button
            onClick={() => { shake(); scrollToSignup(); }}
            className="mt-8 sm:mt-10 mx-auto flex items-center justify-center gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-white hover:bg-gray-100 active:scale-[0.97] transition-transform"
            style={{ borderRadius: "50px" }}
          >
            {/* iMessage icon */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
              <rect width="28" height="28" rx="6" fill="#34C759" />
              <path d="M14 7C9.58 7 6 9.91 6 13.5C6 15.47 7.13 17.22 8.88 18.35L8.25 21L11.16 19.55C12.08 19.83 13.02 20 14 20C18.42 20 22 17.09 22 13.5C22 9.91 18.42 7 14 7Z" fill="white" />
            </svg>
            <span className="text-[#ec4899] text-[13px] sm:text-[16px]" style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800 }}>
              Message Ditto to Join
            </span>
          </button>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce-subtle">
          <span className="text-[#64748b] text-[7px]">SCROLL</span>
          <span className="text-[#6366f1] text-[14px]">▼</span>
        </div>
      </section>

      {/* Spacer so content scrolls over the sticky hero */}
      <div className="h-[140svh] relative z-0 pointer-events-none" />

      {/* ════════════════════════════════════════════════════════════
          SECTION 2 — How It Works (scrolls over hero)
          ════════════════════════════════════════════════════════════ */}
      <div className="relative z-20">

        {/* Shadows background */}
        <div
          className="relative"
          style={{
            backgroundImage: "linear-gradient(to bottom, #111827 0%, transparent 30%, transparent 70%, #111827 100%), url(/shadows.jpg)",
            backgroundAttachment: "fixed",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="relative z-10 bg-[#111827]/60">

        {/* Divider */}
        <div className="py-6 sm:py-10 flex items-center justify-center gap-4 sm:gap-6">
          <div className="h-px flex-1 max-w-[80px] sm:max-w-[120px] bg-gradient-to-r from-transparent to-[#ec4899]/40" />
          <span className="text-[#ec4899]/60 text-[7px] sm:text-[9px] tracking-[0.3em] uppercase">every wednesday</span>
          <div className="h-px flex-1 max-w-[80px] sm:max-w-[120px] bg-gradient-to-l from-transparent to-[#ec4899]/40" />
        </div>

        {/* How it works */}
        <section className="py-16 sm:py-32 px-4 sm:px-6">
          <div ref={howItWorks.ref} style={howItWorks.style}>
            <div className="max-w-4xl mx-auto">
              <h2 className="text-center text-[24px] sm:text-[40px] text-[#ffffff] mb-4 sm:mb-6" style={serif}>
                how to play
              </h2>
              <p className="text-center text-[#ec4899] text-[9px] sm:text-[11px] mb-12 sm:mb-16">— SELECT STAGE —</p>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
                {[
                  { n: "01", title: "team up", desc: "sign up + invite your best friend", color: "#ec4899" },
                  { n: "02", title: "the wednesday drop", desc: "we match your duo with another duo", color: "#6366f1" },
                  { n: "03", title: "say yes", desc: "both teams accept — we plan the double date", color: "#ffec27" },
                  { n: "04", title: "show up", desc: "4 people, 1 night. zero awkwardness.", color: "#00e436" },
                ].map((step) => (
                  <div key={step.n} className="text-center group">
                    <div
                      className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 border-4 flex items-center justify-center bg-[#1c2444]"
                      style={{ borderColor: step.color, boxShadow: `0 0 20px ${step.color}33` }}
                    >
                      <span className="text-[16px] sm:text-[22px]" style={{ color: step.color }}>{step.n}</span>
                    </div>
                    <h3 className="text-[#ffffff] text-[10px] sm:text-[12px] mb-2">{step.title}</h3>
                    <p className="text-[#cbd5e1] text-[8px] sm:text-[10px] leading-[2]">{step.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Experiences — scattered photos */}
        <section className="py-16 sm:py-28 px-4 sm:px-6 overflow-hidden">
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-[#ec4899]/60 text-[8px] sm:text-[10px] tracking-[0.25em] uppercase mb-3 sm:mb-4">what it looks like</p>
            <h2 className="text-center text-[22px] sm:text-[36px] text-[#ffffff] mb-8 sm:mb-14" style={serif}>
              the ditto experience
            </h2>
            <div className="relative mx-auto" style={{ height: "clamp(380px, 65vw, 580px)", maxWidth: "800px" }}>
              {/* Photo 1 — top left, tilted */}
              <div className="absolute left-[0%] sm:left-[2%] top-[0%] w-[48%] sm:w-[44%]" style={{ transform: "rotate(-4deg)", zIndex: 2 }}>
                <div className="rounded-lg sm:rounded-xl overflow-hidden shadow-2xl">
                  <img src="/dinner.jpg" alt="" className="w-full aspect-[4/3] object-cover block" style={{ filter: "brightness(0.85) contrast(1.05)" }} />
                </div>
              </div>
              {/* Photo 2 — top right, opposite tilt */}
              <div className="absolute right-[0%] sm:right-[2%] top-[4%] w-[46%] sm:w-[42%]" style={{ transform: "rotate(3deg)", zIndex: 1 }}>
                <div className="rounded-lg sm:rounded-xl overflow-hidden shadow-2xl">
                  <img src="/japanesedinner.jpg" alt="" className="w-full aspect-[3/2] object-cover block" style={{ filter: "brightness(0.85) contrast(1.1)" }} />
                </div>
              </div>
              {/* Photo 3 — bottom center, overlaps both */}
              <div className="absolute left-[12%] sm:left-[18%] bottom-[0%] w-[52%] sm:w-[46%]" style={{ transform: "rotate(1.5deg)", zIndex: 4 }}>
                <div className="rounded-lg sm:rounded-xl overflow-hidden shadow-2xl">
                  <img src="/happy.jpg" alt="" className="w-full aspect-[4/3] object-cover block" style={{ filter: "brightness(0.9) contrast(1.05)" }} />
                </div>
              </div>
              {/* Photo 4 — bottom right, tucked behind */}
              <div className="absolute right-[0%] sm:right-[4%] bottom-[2%] w-[38%] sm:w-[34%]" style={{ transform: "rotate(-2.5deg)", zIndex: 3 }}>
                <div className="rounded-lg sm:rounded-xl overflow-hidden shadow-2xl">
                  <img src="/nighttime.jpg" alt="" className="w-full aspect-[4/3] object-cover block" style={{ filter: "brightness(0.8) contrast(1.1)" }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Experiences — photo scroll */}
        <section className="py-16 sm:py-24 overflow-hidden">
          <div ref={experiences.ref} style={experiences.style}>
            <div className="text-center mb-8 sm:mb-12 px-4">
              <h2 className="text-[22px] sm:text-[36px] text-[#ffffff]" style={serif}>
                <span className="text-[#ec4899]">real</span> dates delivered
              </h2>
            </div>
            <PhotoMarquee />
          </div>
        </section>

          </div>{/* close z-10 */}
        </div>{/* close shadows background */}

        {/* ════════════════════════════════════════════════════════════
            SECTION 4 — iMessage demo + quote (scrolls over photos)
            ════════════════════════════════════════════════════════════ */}
        <div className="relative z-20 bg-[#111827]">

          {/* iMessage demo */}
          <section className="py-16 sm:py-32 px-4 sm:px-6">
            <div ref={imessage.ref} style={imessage.style}>
              <div
                className="max-w-4xl mx-auto card-spotlight"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  e.currentTarget.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
                  e.currentTarget.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
                }}
              >
              <PixelBox color="#6366f1" className="bg-[#1c2444] p-5 sm:p-12" beam>
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 sm:gap-12 lg:gap-16">

                  {/* Mock iMessage conversation */}
                  <div className="shrink-0 w-[280px] sm:w-[340px] rounded-[36px] overflow-hidden" style={{ fontFamily: "-apple-system, 'SF Pro Text', 'Helvetica Neue', sans-serif", background: "#000" }}>
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-6 pt-3 pb-1">
                      <span className="text-white text-[12px] font-semibold">9:41</span>
                      <div className="flex items-center gap-1">
                        <svg width="16" height="12" viewBox="0 0 16 12" fill="white"><rect x="0" y="6" width="3" height="6" rx="0.5"/><rect x="4.5" y="4" width="3" height="8" rx="0.5"/><rect x="9" y="1.5" width="3" height="10.5" rx="0.5"/><rect x="13" y="0" width="3" height="12" rx="0.5"/></svg>
                        <svg width="22" height="12" viewBox="0 0 22 12" fill="none"><rect x="0.5" y="0.5" width="19" height="11" rx="2" stroke="white"/><rect x="2" y="2" width="14" height="8" rx="1" fill="#34C759"/><rect x="20.5" y="3.5" width="1.5" height="5" rx="0.5" fill="white"/></svg>
                      </div>
                    </div>

                    {/* Nav header */}
                    <div className="flex items-center px-4 pt-1 pb-2">
                      <svg width="10" height="18" viewBox="0 0 10 18" fill="none"><path d="M9 1L1.5 9L9 17" stroke="#3478F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <div className="flex-1 text-center">
                        <img src="/ditto.jpeg" alt="" className="w-8 h-8 mx-auto rounded-full object-cover mb-0.5" />
                        <p className="text-white text-[11px] font-semibold">Ditto</p>
                      </div>
                      <div className="w-[10px]" />
                    </div>

                    {/* Messages area */}
                    <div className="px-3 pb-3 flex flex-col gap-[3px]" style={{ background: "#000" }}>
                      {/* Timestamp */}
                      <p className="text-[#86868b] text-[10px] text-center my-2">Wed 6:52 PM</p>

                      {/* Incoming cluster — no gap between consecutive */}
                      <div className="self-start max-w-[82%] bg-[#26252a] px-3 py-[7px]" style={{ borderRadius: "18px 18px 18px 6px" }}>
                        <p className="text-white text-[14px] leading-[1.35]">ayyy we found your double date 👀</p>
                      </div>
                      <div className="self-start max-w-[82%] bg-[#26252a] px-3 py-[7px]" style={{ borderRadius: "6px 18px 18px 6px" }}>
                        <p className="text-white text-[14px] leading-[1.35]">you + austin are going out with lily & leona</p>
                      </div>

                      {/* Photos */}
                      <div className="self-start grid grid-cols-2 gap-[2px] w-[70%] overflow-hidden" style={{ borderRadius: "6px 18px 18px 6px" }}>
                        <img src="/lilyz.jpg" alt="" className="w-full aspect-[3/4] object-cover block" />
                        <img src="/leona.jpg" alt="" className="w-full aspect-[3/4] object-cover block" />
                      </div>

                      <div className="self-start max-w-[82%] bg-[#26252a] px-3 py-[7px]" style={{ borderRadius: "6px 18px 18px 6px" }}>
                        <p className="text-white text-[14px] leading-[1.35]">wednesday 7pm @ Kit Coffee ☕</p>
                      </div>
                      <div className="self-start max-w-[82%] bg-[#26252a] px-3 py-[7px]" style={{ borderRadius: "6px 18px 18px 18px" }}>
                        <p className="text-white text-[14px] leading-[1.35]">they already said yes so no backing out 😤</p>
                      </div>

                      {/* Small gap before reply */}
                      <div className="h-1" />

                      {/* Outgoing */}
                      <div className="self-end max-w-[70%] bg-[#3478F6] px-3 py-[7px]" style={{ borderRadius: "18px 18px 6px 18px" }}>
                        <p className="text-white text-[14px] leading-[1.35]">say less 🫡</p>
                      </div>

                      {/* Delivered */}
                      <p className="text-[#86868b] text-[9px] self-end mr-1 mt-[2px]">Delivered</p>

                      {/* Input bar */}
                      <div className="flex items-center gap-2 mt-3">
                        <div className="w-7 h-7 rounded-full bg-[#26252a] flex items-center justify-center">
                          <span className="text-[#86868b] text-[16px] leading-none">+</span>
                        </div>
                        <div className="flex-1 h-[34px] rounded-full border border-[#38383a] flex items-center px-3">
                          <span className="text-[#86868b] text-[13px]">iMessage</span>
                        </div>
                      </div>
                    </div>

                    {/* Home indicator */}
                    <div className="flex justify-center pb-2 pt-1" style={{ background: "#000" }}>
                      <div className="w-[120px] h-[4px] rounded-full bg-white/30" />
                    </div>
                  </div>

                  <div className="lg:pt-8">
                    <p className="text-[#ec4899] text-[9px] sm:text-[11px] mb-4 sm:mb-5">no app needed</p>
                    <h2
                      className="text-[20px] sm:text-[32px] lg:text-[40px] text-[#ffffff] leading-[1.4] mb-4 sm:mb-5"
                      style={{ ...serif, textShadow: "0 0 20px #ffffff22" }}
                    >
                      doubles lives in your texts.
                    </h2>
                    <p className="text-[#cbd5e1] text-[9px] sm:text-[11px] leading-[2.2] max-w-sm">
                      we match your duo with another duo, plan the double date, and text you everything. all 4 of you just show up.
                    </p>
                    <div
                      className="mt-6 sm:mt-8 inline-block bg-[#6366f1] text-[#1c2444] px-3 sm:px-4 py-2 text-[9px] sm:text-[11px]"
                      style={{ boxShadow: "0 0 12px #6366f144" }}
                    >
                      blue bubbles only
                    </div>
                  </div>
                </div>
              </PixelBox>
              </div>
            </div>
          </section>

          {/* Quote */}
          <section className="py-20 sm:py-36 px-4 sm:px-6">
            <div ref={quote.ref} style={quote.style}>
              <div className="max-w-2xl mx-auto text-center">
                <p className="text-[20px] sm:text-[28px] lg:text-[34px] text-[#ffffff]/90 leading-[2]" style={serif}>
                  "Going on a date alone is{" "}
                  <span className="text-[#ec4899]/60">terrifying.</span><br />
                  Going with your best friend?{" "}
                  <span className="text-[#ffffff]" style={{ textShadow: "0 0 20px rgba(255,255,255,0.3)" }}>
                    legendary.
                  </span>"
                </p>
              </div>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════
              SECTION 5 — Join via iMessage
              ════════════════════════════════════════════════════════════ */}
          <section ref={signupRef} className="py-16 sm:py-32 px-4 sm:px-6"
            style={{ background: "linear-gradient(180deg, #111827 0%, #151d35 50%, #111827 100%)" }}>
            <div ref={signup.ref} style={signup.style}>
              <h2 className="text-center text-[20px] sm:text-[32px] text-[#ffffff] mb-3 sm:mb-4" style={serif}>
                create your team
              </h2>
              <p className="text-center text-[#ec4899] text-[8px] sm:text-[10px] mb-8 sm:mb-12">— PLAYER 1 SIGN UP —</p>

              <div className="max-w-md mx-auto flex flex-col gap-8">
                {/* Step 1: Text Ditto */}
                <PixelBox color="#ec4899" className="bg-[#1c2444] p-5 sm:p-10 text-center" beam>
                  <div className="w-14 h-14 mx-auto mb-4 border-4 border-[#ec4899] bg-[#111827] flex items-center justify-center" style={{ boxShadow: "0 0 20px #ec489933" }}>
                    <span className="text-[#ec4899] text-[18px]">01</span>
                  </div>
                  <h3 className="text-[#ffffff] text-[11px] sm:text-[14px] mb-2">text ditto to sign up</h3>
                  <p className="text-[#cbd5e1] text-[8px] sm:text-[10px] leading-[2.2] mb-6">
                    we'll get your info and send you<br />a team code through iMessage
                  </p>
                  <a
                    href="sms:austinoahn@icloud.com&body=hey ditto, i want to sign up for doubles!"
                    className="inline-flex items-center justify-center gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-white hover:bg-gray-100 active:scale-[0.97] transition-transform"
                    style={{ borderRadius: "50px" }}
                  >
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
                      <rect width="28" height="28" rx="6" fill="#34C759" />
                      <path d="M14 7C9.58 7 6 9.91 6 13.5C6 15.47 7.13 17.22 8.88 18.35L8.25 21L11.16 19.55C12.08 19.83 13.02 20 14 20C18.42 20 22 17.09 22 13.5C22 9.91 18.42 7 14 7Z" fill="white" />
                    </svg>
                    <span className="text-[#111827] text-[13px] sm:text-[16px]" style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800 }}>
                      Message Ditto
                    </span>
                  </a>
                </PixelBox>

                {/* Step 2: Enter code */}
                <PixelBox color="#6366f1" className="bg-[#1c2444] p-5 sm:p-10 text-center" beam>
                  <div className="w-14 h-14 mx-auto mb-4 border-4 border-[#6366f1] bg-[#111827] flex items-center justify-center" style={{ boxShadow: "0 0 20px #6366f133" }}>
                    <span className="text-[#6366f1] text-[18px]">02</span>
                  </div>
                  <h3 className="text-[#ffffff] text-[11px] sm:text-[14px] mb-2">got your code?</h3>
                  <p className="text-[#cbd5e1] text-[8px] sm:text-[10px] leading-[2.2] mb-6">
                    enter the team code ditto sent you
                  </p>
                  <div className="flex gap-2 max-w-xs mx-auto">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                      placeholder="CODE"
                      className="flex-1 px-3 py-3 border-4 border-[#6366f1] bg-[#111827] text-white text-[13px] text-center tracking-[0.3em] placeholder:text-[#6366f1]/40 focus:outline-none focus:border-[#ffec27]"
                      style={px}
                    />
                    <button
                      onClick={() => { if (code.length >= 4) navigate(`/invite/${code}`); }}
                      className="px-5 py-3 border-4 border-[#6366f1] bg-[#6366f1] text-[#111827] text-[10px] sm:text-[12px] hover:bg-white hover:border-white active:translate-x-[2px] active:translate-y-[2px] transition-none"
                      style={{ boxShadow: "4px 4px 0 #3730a3" }}
                    >
                      JOIN
                    </button>
                  </div>
                </PixelBox>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-16 sm:py-32 px-4 sm:px-6">
            <div ref={faq.ref} style={faq.style}>
              <div className="max-w-2xl mx-auto bg-[#1c2444]/40 border-4 border-[#6366f1]/20 p-5 sm:p-10">
                <h2 className="text-[#ffffff] text-[14px] sm:text-[20px] mb-6 sm:mb-8">FAQ</h2>
                <FaqItem q="How does it work?" a="You and a friend sign up as a team. Every Wednesday we match your duo with another duo and plan the double date." />
                <FaqItem q="Do I need an app?" a="No. Everything happens through iMessage." />
                <FaqItem q="Do I need a teammate?" a="Yes — grab a friend and sign up together. That's the whole point." />
                <FaqItem q="What if we don't like our match?" a="Reply 'no'. Both duos go back in the pool for next week." />
                <FaqItem q="Is it free?" a="Yes." />
              </div>
            </div>
          </section>

          {/* Final CTA */}
          <section className="py-24 sm:py-40 px-4 sm:px-6 text-center relative overflow-hidden">
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center bottom, rgba(236,72,153,0.06) 0%, transparent 70%)" }} />
            <div className="relative z-10">
              <p className="text-[28px] sm:text-[44px] lg:text-[52px] text-[#ffffff] leading-[1.3]" style={serif}>
                you don't swipe.<br />you squad up.
              </p>
              <button
                onClick={() => { shake(); scrollToSignup(); }}
                className="mt-10 sm:mt-14 mx-auto flex items-center justify-center gap-3 px-8 sm:px-10 py-3.5 sm:py-4 bg-white hover:bg-gray-100 active:scale-[0.97] transition-transform"
                style={{ borderRadius: "50px" }}
              >
                <svg width="24" height="24" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
                  <rect width="28" height="28" rx="6" fill="#34C759" />
                  <path d="M14 7C9.58 7 6 9.91 6 13.5C6 15.47 7.13 17.22 8.88 18.35L8.25 21L11.16 19.55C12.08 19.83 13.02 20 14 20C18.42 20 22 17.09 22 13.5C22 9.91 18.42 7 14 7Z" fill="white" />
                </svg>
                <span className="text-[#111827] text-[14px] sm:text-[16px]" style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 800 }}>
                  Join Ditto
                </span>
              </button>
            </div>
          </section>

          {/* Footer */}
          <footer className="py-10 sm:py-14 px-4 sm:px-6 border-t border-white/[0.06]">
            <div className="max-w-5xl mx-auto flex flex-col items-center gap-3">
              <span className="text-[#ffffff] text-[16px] sm:text-[20px]" style={{ ...logo, fontWeight: 900 }}>Ditto</span>
              <p className="text-[#64748b] text-[10px] sm:text-[12px]" style={{ fontFamily: "'Inter', sans-serif" }}>double dates every wednesday</p>
              <p className="text-[#64748b]/40 text-[9px] sm:text-[10px] mt-2" style={{ fontFamily: "'Inter', sans-serif" }}>© 2026 ditto</p>
            </div>
          </footer>

        </div>
      </div>
    </div>
    </>
  );
}
