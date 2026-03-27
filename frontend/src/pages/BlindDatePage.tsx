import { useState, useEffect, useRef } from "react";
import { Camera, Check } from "lucide-react";
import { motion, type Variants } from "motion/react";

/* ─── Scroll-triggered section wrapper ─── */
const sectionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

/* ─── Countdown to next Friday 2:30pm ─── */
function useCountdown() {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    function getNext() {
      const now = new Date();
      const fri = new Date(now);
      fri.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7));
      fri.setHours(14, 30, 0, 0);
      if (fri <= now) fri.setDate(fri.getDate() + 7);
      return fri;
    }
    function tick() {
      const diff = Math.max(0, getNext().getTime() - Date.now());
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}
const pad = (n: number) => String(n).padStart(2, "0");

/* ─── Phone mockup ─── */
function PhoneMockup() {
  const msgs = [
    { dir: "in" as const, text: "hey sarah... your bubl match is ready 👀" },
    { dir: "in" as const, text: "are you ready to find out who you got?" },
    { dir: "out" as const, text: "omg YES" },
    { dir: "in" as const, text: "you're locked in 🔒 waiting on your match..." },
    { dir: "in" as const, text: "your match is... Jake! 🎉\n\ntheir number: (949) 555-0123\n\nsay hi 👋" },
  ];
  return (
    <div className="w-[280px] shrink-0">
      <div className="bg-black rounded-[44px] p-[10px] ring-1 ring-white/10">
        <div className="bg-black rounded-[34px] overflow-hidden relative">
          <div className="relative px-6 pt-3 pb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-white w-12">9:41</span>
            <div className="absolute left-1/2 -translate-x-1/2 w-[90px] h-[22px] bg-black rounded-full" />
            <div className="flex items-center gap-1 w-12 justify-end">
              <svg width="13" height="10" viewBox="0 0 13 10" fill="white"><rect x="0" y="6" width="2.5" height="4" rx="0.5" opacity="0.4"/><rect x="3.5" y="4" width="2.5" height="6" rx="0.5" opacity="0.6"/><rect x="7" y="2" width="2.5" height="8" rx="0.5" opacity="0.8"/><rect x="10.5" y="0" width="2.5" height="10" rx="0.5"/></svg>
              <svg width="15" height="10" viewBox="0 0 15 10" fill="white"><path d="M7.5 2.5C9.5 2.5 11.2 3.3 12.4 4.6L13.5 3.5C12 1.9 10 1 7.5 1S3 1.9 1.5 3.5L2.6 4.6C3.8 3.3 5.5 2.5 7.5 2.5Z" opacity="0.4"/><path d="M7.5 5C8.8 5 10 5.5 10.9 6.3L12 5.2C10.8 4.1 9.2 3.5 7.5 3.5S4.2 4.1 3 5.2L4.1 6.3C5 5.5 6.2 5 7.5 5Z" opacity="0.7"/><path d="M7.5 7.5C8.2 7.5 8.8 7.8 9.3 8.2L7.5 10L5.7 8.2C6.2 7.8 6.8 7.5 7.5 7.5Z"/></svg>
              <svg width="22" height="10" viewBox="0 0 22 10" fill="none"><rect x="0.5" y="0.5" width="18" height="9" rx="2" stroke="white" strokeWidth="1" opacity="0.35"/><rect x="19.5" y="3" width="2" height="4" rx="1" fill="white" opacity="0.4"/><rect x="1.5" y="1.5" width="14" height="7" rx="1" fill="white"/></svg>
            </div>
          </div>
          <div className="px-3 pt-1 pb-2">
            <div className="flex items-center gap-1 mb-2">
              <svg width="10" height="16" viewBox="0 0 10 16" fill="none"><path d="M8.5 1L1.5 8L8.5 15" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[14px] text-[#007AFF]">12</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-pink-500 flex items-center justify-center mb-1">
                <span className="text-[12px] font-bold text-white">b</span>
              </div>
              <p className="text-[13px] font-semibold text-white">bubl</p>
              <p className="text-[10px] text-[#8E8E93]">iMessage</p>
            </div>
          </div>
          <div className="px-3 pb-3 pt-2 space-y-[6px] min-h-[260px]">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.dir === "out" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] px-3 py-[7px] text-[13px] leading-[1.35] ${
                  m.dir === "out"
                    ? "bg-[#007AFF] text-white rounded-[18px] rounded-br-[4px]"
                    : "bg-[#1C1C1E] text-[#E5E5EA] rounded-[18px] rounded-bl-[4px]"
                }`}>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 pb-4 pt-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#1C1C1E] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="#8E8E93" strokeWidth="1.5"/><path d="M7 4V10M4 7H10" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <div className="flex-1 h-[30px] rounded-full border border-[#3A3A3C] flex items-center px-3">
                <span className="text-[13px] text-[#8E8E93]">iMessage</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center pb-2">
            <div className="w-[100px] h-[4px] rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ Page ═══ */
type FormState = "idle" | "submitting" | "success";

export function BlindDatePage() {
  const countdown = useCountdown();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>("idle");
  const [error, setError] = useState("");
  const [position, setPosition] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const signupRef = useRef<HTMLDivElement>(null);

  const handlePhoto = (f: File | null) => {
    setPhoto(f);
    if (f) { const r = new FileReader(); r.onload = (e) => setPhotoPreview(e.target?.result as string); r.readAsDataURL(f); }
    else setPhotoPreview(null);
  };
  const fmt = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };
  const submit = async () => {
    setError("");
    if (!name.trim() || !phone.trim() || !photo) { setError("all fields are required"); return; }
    setFormState("submitting");
    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("phone", phone.replace(/\D/g, ""));
    fd.append("school_id", photo);
    try {
      const res = await fetch("/api/blind-date/signup", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "something went wrong"); setFormState("idle"); return; }
      setPosition(data.position);
      setFormState("success");
    } catch { setError("couldn't connect — try again"); setFormState("idle"); }
  };
  const scrollToSignup = () => signupRef.current?.scrollIntoView({ behavior: "smooth" });

  const countdownStr = `${pad(countdown.d)}d ${pad(countdown.h)}h ${pad(countdown.m)}m ${pad(countdown.s)}s`;

  return (
    <div className="min-h-screen relative">

      {/* Background */}
      <div className="fixed inset-0 z-0">
        <img src="/bg.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 backdrop-blur-[12px] bg-black/40" />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-white font-bold text-[18px] tracking-[-0.03em]">bubl.</span>
          <button onClick={scrollToSignup} className="text-white/60 text-[13px] hover:text-white transition">
            join waitlist &rarr;
          </button>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <motion.section
        variants={sectionVariants} initial="hidden" animate="visible"
        className="relative z-10 min-h-screen flex items-end px-6 pb-24 pt-14">
        <div className="max-w-5xl mx-auto w-full flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10">
          <div className="flex-1">
            <motion.h1 variants={itemVariants} className="text-[80px] sm:text-[120px] lg:text-[160px] font-bold leading-[0.85] tracking-[-0.05em] text-white select-none">
              bubl.
            </motion.h1>
            <div className="mt-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <motion.p variants={itemVariants} className="text-white/60 text-[18px] sm:text-[22px] leading-snug max-w-md">
                  We match you with a stranger over iMessage. Every Friday. No app, no swiping, no profile.
                </motion.p>
                <motion.p variants={itemVariants} className="mt-4 font-mono text-[13px] text-white/30 tracking-wide">
                  next drop in <span className="text-white/70">{countdownStr}</span>
                </motion.p>
              </div>
              <motion.button variants={itemVariants} onClick={scrollToSignup}
                className="shrink-0 px-7 py-3 rounded-full bg-white text-black text-[14px] font-semibold hover:bg-white/90 active:scale-[0.97] transition self-start sm:self-auto">
                Join the Waitlist
              </motion.button>
            </div>
          </div>
          <motion.div variants={itemVariants} className="shrink-0 lg:mb-2" style={{ transform: "rotate(2deg)" }}>
            <div className="bg-[#1a1a1a] p-2 pb-8 rounded shadow-2xl">
              <img src="/peson.jpg" alt="" className="w-[260px] sm:w-[300px] aspect-[3/4] object-cover rounded-sm" />
            </div>
          </motion.div>
        </div>
      </motion.section>

      <div className="relative z-10">

      {/* ─── Marquee divider ─── */}
      <div className="border-y border-white/5 py-3 overflow-hidden">
        <div className="flex whitespace-nowrap animate-[marquee_20s_linear_infinite]">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="text-white/10 text-[13px] font-mono uppercase tracking-[0.2em] mx-8">
              iMessage only &middot; verified students &middot; every friday &middot; no app required
            </span>
          ))}
        </div>
      </div>

      {/* ─── How it works — editorial layout ─── */}
      <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_1px_1fr] gap-12 lg:gap-0">
            <div className="lg:pr-16">
              <motion.p variants={itemVariants} className="font-mono text-[12px] text-white/25 uppercase tracking-[0.15em] mb-6">How it works</motion.p>
              <motion.h2 variants={itemVariants} className="text-[36px] sm:text-[48px] font-bold tracking-[-0.03em] text-white leading-[1.05]">
                Sign up.<br />
                Get texted.<br />
                Meet someone<br />
                <span className="text-white/30">real.</span>
              </motion.h2>
            </div>
            <div className="hidden lg:block bg-white/10" />
            <div className="lg:pl-16 flex flex-col justify-center space-y-8">
              {[
                "Drop your name, number, and school ID.",
                "Every Friday at 2:30pm we send you a match over iMessage.",
                "Both say yes — we reveal names and numbers.",
                "We break the ice. You take it from there.",
              ].map((text, i) => (
                <motion.div key={i} variants={itemVariants} className="flex gap-4 items-baseline">
                  <span className="font-mono text-[12px] text-white/20 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-white/50 text-[15px] leading-relaxed">{text}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* ─── Pull quote ─── */}
      <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.3 }} className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.p variants={itemVariants} className="text-[28px] sm:text-[36px] lg:text-[44px] font-bold tracking-[-0.02em] leading-[1.15] text-white/80">
            &ldquo;Tinder gave me carpal tunnel.<br />
            bubl gave me a date.&rdquo;
          </motion.p>
          <motion.p variants={itemVariants} className="mt-4 font-mono text-[12px] text-white/20 uppercase tracking-[0.15em]">— actual student, probably</motion.p>
        </div>
      </motion.section>

      {/* ─── iMessage demo — offset layout ─── */}
      <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col lg:flex-row items-start gap-16">
            <motion.div variants={itemVariants} className="lg:w-1/2 flex justify-center lg:justify-start lg:-mt-12">
              <PhoneMockup />
            </motion.div>
            <div className="lg:w-1/2 lg:pt-12">
              <motion.p variants={itemVariants} className="font-mono text-[12px] text-white/25 uppercase tracking-[0.15em] mb-6">No app needed</motion.p>
              <motion.h2 variants={itemVariants} className="text-[36px] sm:text-[44px] font-bold tracking-[-0.03em] text-white leading-[1.05] mb-6">
                It lives in<br />your texts.
              </motion.h2>
              <motion.p variants={itemVariants} className="text-white/40 text-[15px] leading-[1.7] max-w-sm">
                We text you. You reply yes. We reveal your match. The whole thing takes 30 seconds and you never leave iMessage.
              </motion.p>
              <motion.p variants={itemVariants} className="mt-6 font-mono text-[12px] text-blue-400/60 tracking-wide">blue bubbles only</motion.p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ─── Photo collage ─── */}
      <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} className="py-32 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <motion.p variants={itemVariants} className="font-mono text-[12px] text-white/25 uppercase tracking-[0.15em] mb-16 text-center">Real people. Real nights.</motion.p>
          <div className="relative" style={{ minHeight: "500px" }}>
            <div className="absolute left-0 top-0 w-[55%] sm:w-[45%]" style={{ transform: "rotate(-3deg)" }}>
              <div className="bg-[#1a1a1a] p-2 pb-8 rounded">
                <img src="/gallery-1.jpg" alt="" className="w-full aspect-[4/3] object-cover rounded-sm" />
              </div>
            </div>
            <div className="absolute right-0 top-4 w-[50%] sm:w-[42%]" style={{ transform: "rotate(2deg)" }}>
              <div className="bg-[#1a1a1a] p-2 pb-8 rounded">
                <div className="w-full aspect-[4/3] bg-white/[0.03] rounded-sm flex items-center justify-center">
                  <p className="text-white/10 text-[13px] font-mono">yours here soon</p>
                </div>
              </div>
            </div>
            <div className="absolute left-[15%] bottom-0 w-[55%] sm:w-[45%]" style={{ transform: "rotate(1.5deg)" }}>
              <div className="bg-[#1a1a1a] p-2 pb-8 rounded">
                <div className="w-full aspect-[16/9] bg-white/[0.03] rounded-sm flex items-center justify-center">
                  <p className="text-white/10 text-[13px] font-mono">yours here soon</p>
                </div>
              </div>
            </div>
            <div className="absolute top-[-8px] left-[28%] sm:left-[32%] z-10" style={{ transform: "rotate(-5deg)" }}>
              <div className="bg-pink-400 px-4 py-2">
                <p className="text-black font-black text-[28px] sm:text-[34px] leading-none">100+</p>
                <p className="text-black/60 font-bold text-[11px] uppercase">Matches</p>
              </div>
            </div>
            <div className="absolute top-[45%] right-[2%] sm:right-[5%] z-10" style={{ transform: "rotate(4deg)" }}>
              <div className="bg-yellow-400 px-4 py-2">
                <p className="text-black font-black text-[28px] sm:text-[34px] leading-none">0</p>
                <p className="text-black/60 font-bold text-[11px] uppercase">Swipes</p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ─── Signup form ─── */}
      <motion.section ref={signupRef} variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="py-32 px-6">
        <div className="max-w-sm mx-auto">
          {formState === "success" ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white flex items-center justify-center">
                <Check className="w-8 h-8 text-black" strokeWidth={3} />
              </div>
              <h2 className="text-[28px] font-bold text-white mb-2">you're in</h2>
              <p className="text-white/50 text-[15px] mb-1">#{position} on the waitlist</p>
              <p className="text-white/30 text-[14px]">we'll text you when your match is ready</p>
            </div>
          ) : (
            <>
              <motion.p variants={itemVariants} className="font-mono text-[12px] text-white/25 uppercase tracking-[0.15em] mb-4 text-center">Waitlist</motion.p>
              <motion.h2 variants={itemVariants} className="text-[36px] sm:text-[44px] font-bold text-center mb-10 tracking-[-0.03em] text-white leading-[1.05]">
                Get in.
              </motion.h2>

              <div className="space-y-3">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="name"
                  className="w-full px-4 py-3 rounded-lg border border-white/10 text-[15px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition bg-white/5" />
                <div>
                  <input type="tel" value={phone} onChange={(e) => setPhone(fmt(e.target.value))} placeholder="phone"
                    className="w-full px-4 py-3 rounded-lg border border-white/10 text-[15px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/25 transition bg-white/5" />
                  <p className="text-[11px] text-white/15 mt-1 ml-1">iMessage required</p>
                </div>
                <div>
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)} className="hidden" />
                  {photoPreview ? (
                    <div className="relative w-full h-32 rounded-lg overflow-hidden border border-white/10 cursor-pointer group" onClick={() => fileRef.current?.click()}>
                      <img src={photoPreview} alt="School ID" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <p className="text-white text-[13px]">change</p>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} className="w-full h-24 rounded-lg border border-dashed border-white/10 hover:border-white/25 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer">
                      <Camera className="w-4 h-4 text-white/20" />
                      <span className="text-[13px] text-white/25">school ID</span>
                    </button>
                  )}
                </div>

                {error && <p className="text-[13px] text-red-400 text-center">{error}</p>}

                <button onClick={submit} disabled={formState === "submitting"}
                  className="w-full py-3 rounded-lg bg-white text-black font-semibold text-[14px] hover:bg-white/90 active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {formState === "submitting"
                    ? <div className="w-4 h-4 mx-auto border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    : "Join"}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.section>

      {/* ─── FAQ ─── */}
      <motion.section variants={sectionVariants} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} className="py-32 px-6">
        <div className="max-w-xl mx-auto">
          <motion.p variants={itemVariants} className="font-mono text-[12px] text-white/25 uppercase tracking-[0.15em] mb-12">FAQ</motion.p>
          {[
            { q: "How does matching work?", a: "Every Friday at 2:30pm we pair everyone and send both people an iMessage. Both say yes, we reveal names and numbers." },
            { q: "Do I need an app?", a: "No. iMessage only." },
            { q: "Why school ID?", a: "We verify every user is a real student. Your ID is never shared." },
            { q: "What if I'm not into my match?", a: "Reply 'no'. Back in the pool next week." },
            { q: "Is it free?", a: "Yes." },
          ].map((f, i) => (
            <motion.div key={i} variants={itemVariants} className="border-b border-white/5 py-5">
              <h3 className="text-white/70 text-[15px] mb-1">{f.q}</h3>
              <p className="text-white/30 text-[14px] leading-relaxed">{f.a}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-white/20 font-bold text-[15px] tracking-[-0.03em]">bubl</span>
          <p className="text-white/15 text-[12px] font-mono">every friday @ 2:30pm</p>
        </div>
      </footer>

      </div>
    </div>
  );
}
