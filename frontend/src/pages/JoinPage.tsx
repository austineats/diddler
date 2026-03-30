import { useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
/* eslint-disable @typescript-eslint/no-unused-vars */

const px = { fontFamily: "'Press Start 2P', monospace" } as const;

export function JoinPage() {
  const { code } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invitedBy = searchParams.get("from") || "Someone";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [school, setSchool] = useState("");
  const [formState, setFormState] = useState<"idle" | "submitting" | "success">("idle");
  const [error, setError] = useState("");

  const fmt = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 10);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  };

  const submit = async () => {
    setError("");
    if (!name.trim() || !phone.trim() || !age.trim() || !gender || !school) {
      setError("all fields required!");
      return;
    }
    setFormState("submitting");
    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("phone", phone.replace(/\D/g, ""));
    fd.append("age", age.trim());
    fd.append("gender", gender);
    fd.append("invited_by", invitedBy);
    if (code) fd.append("invite_code", code);
    fd.append("school", school);
    try {
      const res = await fetch("/api/blind-date/signup", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "something went wrong"); setFormState("idle"); return; }
      setFormState("success");
      // Redirect to the shared lobby view after a brief moment
      setTimeout(() => navigate(`/invite/${code}`), 1500);
    } catch {
      setError("connection failed — retry!");
      setFormState("idle");
    }
  };

  const inputClass =
    "w-full px-4 py-3 border-4 border-[#29adff] bg-[#1d2b53] text-white text-[11px] placeholder:text-[#29adff]/40 focus:outline-none focus:border-[#ffec27]";

  return (
    <div className="min-h-screen relative" style={px}>
      {/* Background */}
      <div className="fixed inset-0 z-0" style={{ background: "#0d0d1a" }} />
      <div
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #000 2px, #000 4px)" }}
      />
      <div
        className="fixed inset-0 z-[1] pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "8px 8px" }}
      />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Nav */}
        <nav className="border-b-4 border-[#29adff] bg-[#1d2b53]/95">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <button onClick={() => navigate("/")} className="text-[#ff004d] text-[18px]">bubl.</button>
            <span className="text-[#ffec27] text-[9px]">&lt; JOIN TEAM &gt;</span>
          </div>
        </nav>

        {/* Main */}
        <div className="flex-1 flex items-center justify-center px-5 py-12">
          <div
            className="w-full max-w-md p-8 sm:p-10"
            style={{ border: "4px solid #29adff", background: "#1d2b53", boxShadow: "4px 4px 0 #1a6b99" }}
          >
            {formState === "success" ? (
              <div className="text-center">
                <div
                  className="w-16 h-16 mx-auto mb-6 flex items-center justify-center text-[24px]"
                  style={{ border: "4px solid #00e436", background: "#1d2b53" }}
                >
                  <span className="text-[#00e436]">&#x2714;</span>
                </div>
                <h2 className="text-[18px] text-[#00e436] mb-4">TEAM JOINED!</h2>
                <p className="text-[#c2c3c7] text-[9px] leading-[2.2] mb-2">
                  You and {invitedBy} are now teammates.
                </p>
                <p className="text-[#5f574f] text-[8px] leading-[2] mb-6">
                  bubl will find your match and text you both on Thursday!
                </p>
                <p
                  className="text-[#ffec27] text-[7px] uppercase"
                  style={{ animation: "blink-pixel 1.5s step-end infinite" }}
                >
                  searching for your match...
                </p>
              </div>
            ) : (
              <>
                <p className="text-[#ff77a8] text-[10px] mb-3 text-center">&lt; TEAMMATE INVITE &gt;</p>
                <p className="text-[#29adff] text-[9px] text-center mb-4 leading-[2]">
                  {invitedBy} invited you to be their teammate!
                </p>
                <h2 className="text-[22px] sm:text-[28px] text-center mb-8 text-[#ffec27]">
                  Join {invitedBy}'s team.
                </h2>

                <div className="space-y-4">
                  <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="&gt; name"
                    className={inputClass} style={px}
                  />
                  <input
                    type="tel" value={phone} onChange={(e) => setPhone(fmt(e.target.value))} placeholder="&gt; phone (iMessage)"
                    className={inputClass} style={px}
                  />
                  <input
                    type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="&gt; age"
                    className={inputClass} style={px}
                  />
                  <select
                    value={gender} onChange={(e) => setGender(e.target.value)}
                    className={`${inputClass} appearance-none cursor-pointer`}
                    style={{ ...px, color: gender ? "white" : "rgba(41,173,255,0.4)" }}
                  >
                    <option value="" disabled>&gt; gender</option>
                    <option value="boy">Boy</option>
                    <option value="girl">Girl</option>
                  </select>
                  <select
                    value={school} onChange={(e) => setSchool(e.target.value)}
                    className={`${inputClass} appearance-none cursor-pointer`}
                    style={{ ...px, color: school ? "white" : "rgba(41,173,255,0.4)" }}
                  >
                    <option value="" disabled>&gt; school</option>
                    <option value="Portola High School">Portola High School</option>
                    <option value="Irvine High School">Irvine High School</option>
                    <option value="Northwood High School">Northwood High School</option>
                    <option value="Woodbridge High School">Woodbridge High School</option>
                    <option value="Beckman High School">Beckman High School</option>
                    <option value="Crean Lutheran High School">Crean Lutheran High School</option>
                    <option value="University High School">University High School</option>
                  </select>

                  {error && <p className="text-[11px] text-[#ff004d] text-center">! {error}</p>}

                  <button
                    onClick={submit}
                    disabled={formState === "submitting"}
                    className="w-full py-4 text-[13px] active:translate-x-[2px] active:translate-y-[2px] disabled:opacity-50"
                    style={{
                      border: "4px solid #00e436",
                      background: "#00e436",
                      color: "#1d2b53",
                      boxShadow: "4px 4px 0 #008751",
                    }}
                  >
                    {formState === "submitting" ? "LOADING..." : "> JOIN TEAM"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
