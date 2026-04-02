import { useState } from "react";
import { useNavigate } from "react-router-dom";

const px = { fontFamily: "'Press Start 2P', monospace" } as const;

type Step = "phone" | "texted" | "code" | "done";

export function SignInPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(() => {
    const saved = sessionStorage.getItem("ditto-signin");
    return saved ? JSON.parse(saved).step || "phone" : "phone";
  });
  const [phone, setPhone] = useState(() => {
    const saved = sessionStorage.getItem("ditto-signin");
    return saved ? JSON.parse(saved).phone || "" : "";
  });

  // Persist step + phone so returning from iMessage lands on code screen
  const goToStep = (s: Step, p?: string) => {
    setStep(s);
    sessionStorage.setItem("ditto-signin", JSON.stringify({ step: s, phone: p || phone }));
  };
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fmt = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const checkPhone = async () => {
    setError("");
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setError("enter a valid phone number"); return; }
    setLoading(true);
    try {
      // Check if user exists
      const res = await fetch(`/api/blind-date/status/${digits}`);
      await res.json();
      if (!res.ok) { setError("no account found with this number"); setLoading(false); return; }
      // User exists — tell them to text ditto
      goToStep("texted");
    } catch {
      setError("connection failed");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError("");
    if (otp.length < 4) { setError("enter the 4-digit code"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/blind-date/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), code: otp }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "invalid code"); setLoading(false); return; }
      sessionStorage.setItem("ditto-user", JSON.stringify(data.user));
      if (data.user.teamCode) {
        navigate(`/invite/${data.user.teamCode}`);
        return;
      }
      goToStep("done"); sessionStorage.removeItem("ditto-signin");
    } catch {
      setError("connection failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 sm:px-4 py-3 border-4 border-[#6366f1] bg-[#1c2444] text-white text-[11px] placeholder:text-[#6366f1]/40 focus:outline-none focus:border-[#ffec27] text-center tracking-[0.2em] min-h-[44px]";

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={px}>
      <div className="fixed inset-0 z-0" style={{ background: "#111827" }} />
      <div className="fixed inset-0 z-[1] pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)" }} />
      <div className="fixed inset-0 z-[1] pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "8px 8px" }} />

      <div className="relative z-10 min-h-screen flex flex-col">
        <nav className="border-b-4 border-[#6366f1] bg-[#1c2444]/95">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
            <button onClick={() => navigate("/")} className="text-[#ffffff] text-[14px] sm:text-[18px]">ditto</button>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-[#ffec27] text-[7px] sm:text-[9px]">&lt; SIGN IN &gt;</span>
              <span className="text-[#64748b] text-[7px] sm:text-[9px]">|</span>
              <button onClick={() => navigate("/")} className="text-[#6366f1] text-[7px] sm:text-[9px] hover:text-[#ffec27] transition-none">
                [ JOIN ] &gt;&gt;
              </button>
            </div>
          </div>
        </nav>

        <div className="flex-1 flex items-center justify-center px-4 sm:px-5 py-8 sm:py-12">
          <div className="w-full max-w-sm p-5 sm:p-10"
            style={{ border: "4px solid #6366f1", background: "#1c2444", boxShadow: "4px 4px 0 #3730a3" }}>

            {/* Step 1: Enter phone */}
            {step === "phone" && (
              <div>
                <p className="text-[#ec4899] text-[8px] sm:text-[10px] mb-2 sm:mb-3 text-center">&lt; WELCOME BACK &gt;</p>
                <h2 className="text-[14px] sm:text-[22px] text-center mb-2 sm:mb-3 text-[#ffffff]">Sign in</h2>
                <p className="text-[#cbd5e1] text-[7px] sm:text-[8px] text-center mb-6 sm:mb-8 leading-[2]">
                  Enter your phone number to get started
                </p>
                <div className="space-y-3 sm:space-y-4">
                  <input type="tel" value={phone} onChange={(e) => setPhone(fmt(e.target.value))}
                    placeholder="(___) ___-____" className={inputClass} style={px} autoFocus />
                  {error && <p className="text-[8px] sm:text-[9px] text-[#ffffff] text-center">! {error}</p>}
                  <button onClick={checkPhone} disabled={loading}
                    className="w-full py-3 sm:py-4 min-h-[44px] text-[10px] sm:text-[12px] active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
                    style={{ border: "4px solid #ffec27", background: "#ffec27", color: "#1c2444", boxShadow: "4px 4px 0 #3730a3" }}>
                    {loading ? "CHECKING..." : "> NEXT"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Text ditto */}
            {step === "texted" && (
              <div className="text-center">
                <p className="text-[#ec4899] text-[8px] sm:text-[10px] mb-3">&lt; VERIFY &gt;</p>
                <h2 className="text-[14px] sm:text-[22px] text-center mb-3 text-[#ffffff]">Text ditto</h2>
                <p className="text-[#cbd5e1] text-[7px] sm:text-[8px] text-center mb-2 leading-[2]">
                  Text ditto "sign in" to get your code
                </p>
                <p className="text-[#6366f1] text-[8px] sm:text-[10px] text-center mb-6">{phone}</p>

                <a href="sms:textbubl@icloud.com&body=sign in"
                  onClick={() => goToStep("code")}
                  className="inline-block w-full py-3 sm:py-4 min-h-[44px] text-[10px] sm:text-[12px] text-center active:translate-x-[2px] active:translate-y-[2px]"
                  style={{ border: "4px solid #00e436", background: "#00e436", color: "#1c2444", boxShadow: "4px 4px 0 #008751" }}>
                  &gt; TEXT DITTO
                </a>

                <p className="text-[#64748b] text-[6px] sm:text-[7px] text-center mt-4"
                  style={{ animation: "blink-pixel 1.5s step-end infinite" }}>
                  ditto will reply with a 4-digit code...
                </p>
              </div>
            )}

            {/* Step 3: Enter code */}
            {step === "code" && (
              <div>
                <p className="text-[#ec4899] text-[8px] sm:text-[10px] mb-2 sm:mb-3 text-center">&lt; VERIFY &gt;</p>
                <h2 className="text-[14px] sm:text-[22px] text-center mb-2 sm:mb-3 text-[#ffffff]">Enter code</h2>
                <p className="text-[#cbd5e1] text-[7px] sm:text-[8px] text-center mb-2 leading-[2]">
                  Enter the code ditto texted you
                </p>
                <p className="text-[#6366f1] text-[8px] sm:text-[10px] text-center mb-6 sm:mb-8">{phone}</p>
                <div className="space-y-3 sm:space-y-4">
                  <input type="text" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="____" maxLength={4} className={inputClass}
                    style={{ ...px, fontSize: "20px", letterSpacing: "0.4em" }} autoFocus />
                  {error && <p className="text-[8px] sm:text-[9px] text-[#ffffff] text-center">! {error}</p>}
                  <button onClick={verifyOtp} disabled={loading}
                    className="w-full py-3 sm:py-4 min-h-[44px] text-[10px] sm:text-[12px] active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
                    style={{ border: "4px solid #00e436", background: "#00e436", color: "#1c2444", boxShadow: "4px 4px 0 #008751" }}>
                    {loading ? "VERIFYING..." : "> VERIFY"}
                  </button>
                  <button onClick={() => goToStep("texted")}
                    className="w-full py-3 min-h-[44px] text-[8px] sm:text-[9px] text-[#6366f1]">
                    resend code
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Done */}
            {step === "done" && (
              <div className="text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 flex items-center justify-center text-[20px] sm:text-[24px]"
                  style={{ border: "4px solid #00e436", background: "#1c2444" }}>
                  <span className="text-[#00e436]">&#x2714;</span>
                </div>
                <h2 className="text-[14px] sm:text-[18px] text-[#00e436] mb-3 sm:mb-4">SIGNED IN!</h2>
                <p className="text-[#cbd5e1] text-[8px] sm:text-[9px] leading-[2.2] mb-4 sm:mb-6 break-words">welcome back to ditto.</p>
                <button onClick={() => navigate("/")}
                  className="px-6 sm:px-8 py-3 text-[9px] sm:text-[11px] min-h-[44px] active:translate-x-[2px] active:translate-y-[2px]"
                  style={{ border: "4px solid #6366f1", background: "#6366f1", color: "#1c2444", boxShadow: "4px 4px 0 #3730a3" }}>
                  CONTINUE &gt;&gt;
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
