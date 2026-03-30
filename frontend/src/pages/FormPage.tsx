import { useState, useRef } from "react";
import { Check, X } from "lucide-react";
import { motion } from "motion/react";

const px = { fontFamily: "'Press Start 2P', monospace" };

const ETHNICITY_OPTIONS = [
  "American Indian", "Black/African Descent", "White", "East Asian",
  "South Asian", "Middle Eastern", "Pacific Islander", "South East Asian",
  "Hispanic/Latino",
];

const LOOKING_FOR_OPTIONS = [
  "Life partner", "Serious relationship", "Casual dates", "New friends", "Not sure yet",
];

const DATE_WHO_OPTIONS = ["Men", "Women", "Everyone"];

const ETHNICITY_PREF_OPTIONS = [...ETHNICITY_OPTIONS.filter(e => e !== "Prefer not to say"), "No preference"];

const MATCHING_SPEED = [
  { icon: "⚡", label: "Fast", desc: "speed over perfection" },
  { icon: "⚖️", label: "Balanced", desc: "decent fit" },
  { icon: "🎯", label: "Intentional", desc: "most preferences match" },
  { icon: "💎", label: "Wait for the one", desc: "all boxes checked" },
];

const YEAR_OPTIONS = ["Freshman", "Sophomore", "Junior", "Senior", "Master", "PhD", "Other"];
const HEARD_FROM_OPTIONS = ["Poster", "Instagram", "TikTok", "X (Twitter)", "Friend"];

export function FormPage() {
  // basics
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState("");
  const [ethnicity, setEthnicity] = useState<string[]>([]);
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");

  // hobbies
  const [hobbies, setHobbies] = useState("");

  // school
  const [year, setYear] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [heardOther, setHeardOther] = useState("");

  // type
  const [lookingFor, setLookingFor] = useState<string[]>([]);
  const [dateWho, setDateWho] = useState<string[]>([]);
  const [ageRange, setAgeRange] = useState([18, 50]);
  const [ethnicityPref, setEthnicityPref] = useState<string[]>([]);

  // attraction
  const [heightPref, setHeightPref] = useState("");
  const [heightPrefSkip, setHeightPrefSkip] = useState(false);
  const [facePref, setFacePref] = useState("");
  const [facePrefSkip, setFacePrefSkip] = useState(false);
  const [vibePref, setVibePref] = useState("");
  const [vibePrefSkip, setVibePrefSkip] = useState(false);

  // matching
  const [matchSpeed, setMatchSpeed] = useState("");

  // photos
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null, null, null, null]);
  const [previews, setPreviews] = useState<(string | null)[]>([null, null, null, null, null, null]);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const toggleMulti = (arr: string[], val: string, set: (v: string[]) => void) =>
    set(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);

  const addPhoto = (i: number, f: File) => {
    const newPhotos = [...photos]; newPhotos[i] = f; setPhotos(newPhotos);
    const r = new FileReader();
    r.onload = (e) => { const p = [...previews]; p[i] = e.target?.result as string; setPreviews(p); };
    r.readAsDataURL(f);
  };

  const removePhoto = (i: number) => {
    const p = [...photos]; p[i] = null; setPhotos(p);
    const pr = [...previews]; pr[i] = null; setPreviews(pr);
  };

  const submit = async () => {
    if (!name.trim()) { setError("name is required"); return; }
    const realPhotos = photos.filter(Boolean);
    if (realPhotos.length === 0) { setError("add at least 1 photo"); return; }
    setError(""); setSubmitting(true);

    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("birthday", birthday);
    fd.append("gender", gender);
    fd.append("ethnicity", JSON.stringify(ethnicity));
    fd.append("height", heightFt && heightIn ? `${heightFt}'${heightIn}"` : "");
    fd.append("hobbies", hobbies.trim());
    fd.append("year", year);
    fd.append("heard_from", heardFrom === "Other" ? heardOther : heardFrom);
    fd.append("looking_for", JSON.stringify(lookingFor));
    fd.append("date_who", JSON.stringify(dateWho));
    fd.append("age_range", JSON.stringify(ageRange));
    fd.append("ethnicity_pref", JSON.stringify(ethnicityPref));
    fd.append("height_pref", heightPrefSkip ? "" : heightPref);
    fd.append("face_pref", facePrefSkip ? "" : facePref);
    fd.append("vibe_pref", vibePrefSkip ? "" : vibePref);
    fd.append("match_speed", matchSpeed);
    realPhotos.forEach(p => fd.append("photos", p!));

    try {
      const res = await fetch("/api/bubl/profile", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "something went wrong"); setSubmitting(false); return; }
      setDone(true);
    } catch { setError("couldn't connect — try again"); setSubmitting(false); }
  };

  /* ─── Success state ─── */
  if (done) {
    return (
      <div className="min-h-screen bg-[#0d0d1a]" style={px}>
        <div className="flex items-center justify-center min-h-screen px-6">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
            <div className="w-20 h-20 border-4 border-[#00e436] bg-[#1d2b53] flex items-center justify-center mx-auto mb-6"
              style={{ boxShadow: "4px 4px 0 #0a1a30" }}>
              <Check className="w-10 h-10 text-[#00e436]" />
            </div>
            <h1 className="text-[20px] sm:text-[28px] font-bold text-[#00e436] tracking-tight leading-relaxed">YOU'RE IN</h1>
            <p className="text-[#c2c3c7] mt-4 text-[9px] leading-relaxed">bubl will text you on<br />wednesday with your match</p>
            <p className="text-[#c2c3c7]/40 mt-8 text-[8px]">you can close this page</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a]" style={px}>

      {/* Pixel star decorations */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        {[...Array(40)].map((_, i) => (
          <div key={i} className="absolute bg-[#fff1e8]"
            style={{
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              top: `${(i * 2.5) % 100}%`,
              left: `${(i * 7.3 + 13) % 100}%`,
              opacity: 0.15 + (i % 5) * 0.1,
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        {/* ─── Section 1: Basics ─── */}
        <section className="min-h-screen flex flex-col justify-center px-4 py-20">
          <div className="max-w-lg mx-auto w-full">
            <h1 className="text-[16px] sm:text-[22px] font-bold text-[#fff1e8] tracking-tight mb-2 text-center leading-relaxed">
              bubl. your <span className="text-[#ff77a8]">basics</span>
            </h1>
            <div className="mt-10 border-4 border-[#29adff] bg-[#1d2b53] p-5 space-y-6"
              style={{ boxShadow: "4px 4px 0 #0a1a30" }}>
              <Field label="What's your name?">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Type your answer here..."
                  className="pixel-inp" />
              </Field>
              <Field label="When is your birthday?" sub="Only your age will be shown to others">
                <input type="date" value={birthday} onChange={e => setBirthday(e.target.value)}
                  className="pixel-inp" />
              </Field>
              <Field label="What's your gender?">
                <Pills options={["Female", "Male"]} selected={gender ? [gender] : []}
                  onToggle={v => setGender(v === gender ? "" : v)} />
              </Field>
              <Field label="What's your ethnicity?" sub="Select all that apply">
                <Pills options={ETHNICITY_OPTIONS} selected={ethnicity}
                  onToggle={v => toggleMulti(ethnicity, v, setEthnicity)} />
              </Field>
              <Field label="How tall are you?">
                <div className="flex gap-3 items-center">
                  <div className="flex items-center gap-1">
                    <input value={heightFt} onChange={e => setHeightFt(e.target.value.replace(/\D/g, "").slice(0, 1))}
                      className="pixel-inp w-16 text-center" placeholder="5" inputMode="numeric" />
                    <span className="text-[#c2c3c7] text-[9px]">ft</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input value={heightIn} onChange={e => setHeightIn(e.target.value.replace(/\D/g, "").slice(0, 2))}
                      className="pixel-inp w-16 text-center" placeholder="11" inputMode="numeric" />
                    <span className="text-[#c2c3c7] text-[9px]">in</span>
                  </div>
                </div>
              </Field>
            </div>
          </div>
        </section>

        {/* ─── Section 2: Hobbies ─── */}
        <section className="px-4 py-20">
          <div className="max-w-lg mx-auto w-full">
            <div className="border-4 border-[#29adff] bg-[#1d2b53] p-5 space-y-6"
              style={{ boxShadow: "4px 4px 0 #0a1a30" }}>
              <Field label="Share your hobbies and interests">
                <textarea value={hobbies} onChange={e => setHobbies(e.target.value)} rows={4}
                  className="pixel-inp resize-none" placeholder={"example:\n hiking with dog\n reading feminism literature\n music (kdot, keshi, laufey)"} />
              </Field>
              <Field label="What year are you in">
                <RadioList options={YEAR_OPTIONS} selected={year} onSelect={setYear} />
              </Field>
              <Field label="Where did you hear from us?">
                <RadioList options={[...HEARD_FROM_OPTIONS, "Other"]} selected={heardFrom} onSelect={setHeardFrom} />
                {heardFrom === "Other" && (
                  <input value={heardOther} onChange={e => setHeardOther(e.target.value)}
                    placeholder="Please specify..." className="pixel-inp mt-2" />
                )}
              </Field>
            </div>
          </div>
        </section>

        {/* ─── Section 3: Type ─── */}
        <section className="px-4 py-20">
          <div className="max-w-lg mx-auto w-full">
            <h2 className="text-[16px] sm:text-[22px] font-bold text-[#fff1e8] tracking-tight mb-2 text-center leading-relaxed">
              bubl. your <span className="text-[#ff77a8]">type</span>
            </h2>
            <div className="mt-10 border-4 border-[#29adff] bg-[#1d2b53] p-5 space-y-6"
              style={{ boxShadow: "4px 4px 0 #0a1a30" }}>
              <Field label="What are you looking for right now?" sub="Select all that apply">
                <Pills options={LOOKING_FOR_OPTIONS} selected={lookingFor}
                  onToggle={v => toggleMulti(lookingFor, v, setLookingFor)} />
              </Field>
              <Field label="Who do you wanna date?" sub="Select all who you're open to meeting">
                <Pills options={DATE_WHO_OPTIONS} selected={dateWho}
                  onToggle={v => toggleMulti(dateWho, v, setDateWho)} />
              </Field>
              <Field label="What age range would you like to date in?" sub="Drag the slider to set your preferred age range.">
                <div className="space-y-3">
                  <input type="range" min={18} max={50} value={ageRange[1]}
                    onChange={e => setAgeRange([ageRange[0], parseInt(e.target.value)])}
                    className="w-full accent-[#ff004d]" style={{ height: 8 }} />
                  <span className="text-[#ffec27] text-[9px] border-2 border-[#ffec27] px-3 py-1 inline-block">
                    Age range: {ageRange[0]}-{ageRange[1]}+
                  </span>
                </div>
              </Field>
              <Field label="What ethnicities are you attracted to?" sub="Select all that apply">
                <Pills options={ETHNICITY_PREF_OPTIONS} selected={ethnicityPref}
                  onToggle={v => toggleMulti(ethnicityPref, v, setEthnicityPref)} />
              </Field>
            </div>
          </div>
        </section>

        {/* ─── Section 4: Attraction ─── */}
        <section className="px-4 py-20">
          <div className="max-w-lg mx-auto w-full">
            <div className="border-4 border-[#29adff] bg-[#1d2b53] p-5 space-y-6"
              style={{ boxShadow: "4px 4px 0 #0a1a30" }}>
              <h3 className="text-[11px] font-bold text-[#ffec27] leading-relaxed">What do you find physically attractive?</h3>
              <AttractionField label="Height & Build" value={heightPref} onChange={setHeightPref}
                skip={heightPrefSkip} onSkip={setHeightPrefSkip} placeholder="5'in, athletic, broad shoulders..." />
              <AttractionField label="Facial Features" value={facePref} onChange={setFacePref}
                skip={facePrefSkip} onSkip={setFacePrefSkip} placeholder="expressive eyes, warm smiles, clean-shaven..." />
              <AttractionField label="Energy & Vibes" value={vibePref} onChange={setVibePref}
                skip={vibePrefSkip} onSkip={setVibePrefSkip} placeholder="Artsy/Indie, Nerd/Smart, Calm & Grounding..." />
            </div>
          </div>
        </section>

        {/* ─── Section 5: Matching Speed ─── */}
        <section className="px-4 py-20">
          <div className="max-w-lg mx-auto w-full">
            <div className="border-4 border-[#29adff] bg-[#1d2b53] p-5 space-y-4"
              style={{ boxShadow: "4px 4px 0 #0a1a30" }}>
              <Field label="How do you want bubl to match you rn" sub="Select all that apply">
                {MATCHING_SPEED.map(s => (
                  <button key={s.label} onClick={() => setMatchSpeed(s.label)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition border-2 ${
                      matchSpeed === s.label
                        ? "bg-[#29adff]/20 border-[#29adff]"
                        : "border-transparent hover:border-[#29adff]/30"
                    }`}>
                    <span className="text-[16px]">{s.icon}</span>
                    <div>
                      <span className="text-[#fff1e8] text-[9px] font-semibold">{s.label}</span>
                      <span className="text-[#c2c3c7] text-[8px] ml-2">- {s.desc}</span>
                    </div>
                  </button>
                ))}
              </Field>
            </div>
          </div>
        </section>

        {/* ─── Section 6: Photos ─── */}
        <section className="px-4 py-20">
          <div className="max-w-lg mx-auto w-full text-center">
            <h2 className="text-[16px] sm:text-[22px] font-bold text-[#fff1e8] tracking-tight mb-2 leading-relaxed">
              <span className="text-[#ff77a8]">5 pics</span> of your vibe
            </h2>
            <div className="mt-10 border-4 border-[#29adff] bg-[#1d2b53] p-5"
              style={{ boxShadow: "4px 4px 0 #0a1a30" }}>
              <p className="text-[#fff1e8] text-[9px] font-semibold text-left mb-1 leading-relaxed">Add 5 pics that show your face and vibe</p>
              <p className="text-[#c2c3c7] text-[8px] text-left mb-4 leading-relaxed">Clear face photos from different moments help bubl find better matches for you. You can swap them anytime.</p>
              <div className="grid grid-cols-3 gap-3">
                {previews.map((src, i) => (
                  <div key={i} className="aspect-[3/4] overflow-hidden relative border-2 border-dashed border-[#29adff]/50">
                    {src ? (
                      <div className="relative group w-full h-full">
                        <img src={src} className="w-full h-full object-cover" />
                        <button onClick={() => removePhoto(i)}
                          className="absolute top-1 right-1 w-6 h-6 bg-[#ff004d] border-2 border-[#ff004d] flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                          <X className="w-3 h-3 text-[#fff1e8]" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => fileRefs.current[i]?.click()}
                        className={`w-full h-full flex items-center justify-center transition ${
                          i === 0 ? "bg-[#29adff]/10 border-[#29adff]" : "hover:border-[#29adff]"
                        }`}>
                        <span className="text-[#29adff] text-[20px]">+</span>
                      </button>
                    )}
                    <input ref={el => { fileRefs.current[i] = el; }} type="file" accept="image/*" className="hidden"
                      onChange={e => { if (e.target.files?.[0]) addPhoto(i, e.target.files[0]); e.target.value = ""; }} />
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[#c2c3c7]/40 text-[7px] mt-6 leading-relaxed">By continuing, you agree to our <span className="underline">Terms</span> & <span className="underline">Privacy</span>.</p>

            {error && <p className="text-[#ff004d] text-[9px] mt-3">{error}</p>}

            <button onClick={submit} disabled={submitting}
              className="w-full mt-4 py-4 border-4 border-[#00e436] bg-[#00e436] text-[#1d2b53] font-bold text-[10px] hover:brightness-110 active:translate-y-[2px] transition disabled:opacity-50"
              style={{ boxShadow: "4px 4px 0 #00802a" }}>
              {submitting ? "SUBMITTING..." : "SUBMIT"}
            </button>
          </div>
        </section>
      </div>

      {/* Global pixel input styles */}
      <style>{`
        .pixel-inp {
          width: 100%;
          padding: 10px 12px;
          border: 4px solid #29adff;
          background: #1d2b53;
          color: #fff1e8;
          font-family: 'Press Start 2P', monospace;
          font-size: 11px;
          line-height: 1.6;
          outline: none;
          transition: border-color 0.15s;
        }
        .pixel-inp::placeholder {
          color: #c2c3c7;
          opacity: 0.4;
        }
        .pixel-inp:focus {
          border-color: #ffec27;
        }
        .pixel-inp:disabled {
          opacity: 0.3;
        }
        input[type="range"] {
          -webkit-appearance: none;
          appearance: none;
          background: #1d2b53;
          border: 2px solid #29adff;
          height: 8px;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          background: #ff004d;
          border: 2px solid #fff1e8;
          cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: #ff004d;
          border: 2px solid #fff1e8;
          border-radius: 0;
          cursor: pointer;
        }
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
        }
      `}</style>
    </div>
  );
}

/* ─── Reusable components ─── */

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[#ff77a8] text-[10px] font-semibold mb-1 leading-relaxed">{label}</p>
      {sub && <p className="text-[#c2c3c7] text-[8px] mb-3 leading-relaxed">{sub}</p>}
      {children}
    </div>
  );
}

function Pills({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button key={o} onClick={() => onToggle(o)}
          className={`px-3 py-2 text-[8px] transition border-2 ${
            selected.includes(o)
              ? "bg-[#29adff] text-[#1d2b53] border-[#29adff] font-bold"
              : "bg-transparent text-[#c2c3c7] border-dashed border-[#c2c3c7]/30 hover:border-[#29adff]"
          }`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function RadioList({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <div className="space-y-2">
      {options.map(o => (
        <button key={o} onClick={() => onSelect(o)}
          className="w-full flex items-center gap-3 text-left py-2">
          <div className={`w-5 h-5 border-2 flex items-center justify-center transition ${
            selected === o ? "border-[#29adff] bg-[#29adff]" : "border-[#c2c3c7]/30"
          }`}>
            {selected === o && <div className="w-2.5 h-2.5 bg-[#1d2b53]" />}
          </div>
          <span className="text-[#fff1e8] text-[9px]">{o}</span>
        </button>
      ))}
    </div>
  );
}

function AttractionField({ label, value, onChange, skip, onSkip, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  skip: boolean; onSkip: (v: boolean) => void; placeholder: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#fff1e8] text-[9px] font-semibold">{label}</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            onClick={() => onSkip(!skip)}
            className={`w-4 h-4 border-2 flex items-center justify-center cursor-pointer transition ${
              skip ? "border-[#ff77a8] bg-[#ff77a8]" : "border-[#c2c3c7]/30"
            }`}>
            {skip && <div className="w-2 h-2 bg-[#1d2b53]" />}
          </div>
          <span className="text-[#c2c3c7] text-[7px]">i don't care</span>
        </label>
      </div>
      <textarea value={skip ? "" : value} onChange={e => onChange(e.target.value)} rows={2}
        disabled={skip} placeholder={placeholder}
        className={`pixel-inp resize-none ${skip ? "opacity-30" : ""}`} />
    </div>
  );
}
