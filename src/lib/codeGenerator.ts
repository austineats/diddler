import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import type { ReasonedIntent } from "./reasoner.js";
import { scoreGeneratedCode, generateRetryFeedback } from "./qualityScorer.js";
import { recordSpend } from "./costTracker.js";
import type { ProgressCallback } from "./progressEmitter.js";
import type { PipelineRunArtifact, QualityBreakdown } from "../types/index.js";


export interface CodeGenerationResult {
  generated_code: string;
  app_name: string;
  tagline: string;
  primary_color: string;
  icon: string;
  pages: string[];
  quality_score: number;
  quality_breakdown: QualityBreakdown;
  pipeline_artifact: PipelineRunArtifact;
}

/* ------------------------------------------------------------------ */
/*  Layout skeletons — structural bones for each page_structure        */
/* ------------------------------------------------------------------ */

const LAYOUT_SKELETONS: Record<string, string> = {
  centered_column: `
PAGE STRUCTURE: CENTERED COLUMN
Single-column layout, centered on screen. Simple and focused.
<div className="min-h-screen {rootBg}">
  {NAV_COMPONENT}
  <main className="max-w-2xl mx-auto px-5 py-8">
    {HERO_COMPONENT}
    <div className="space-y-6 mt-6">{CONTENT}</div>
  </main>
</div>
Use for: single-purpose tools, analyzers, calculators. The simplest layout.`,

  bento_grid: `
PAGE STRUCTURE: BENTO GRID
Asymmetric grid with mixed-size cards. Creates visual interest through varied card sizes.
<div className="min-h-screen {rootBg}">
  {NAV_COMPONENT}
  <main className="max-w-6xl mx-auto px-6 py-8">
    {HERO_COMPONENT}
    <div className="grid grid-cols-4 gap-4 mt-6">
      <div className="col-span-2 row-span-2 {cardStyle} p-6">{/* Large hero card with primary content */}</div>
      <div className="col-span-1 {cardStyle} p-4">{/* Small metric or action card */}</div>
      <div className="col-span-1 {cardStyle} p-4">{/* Small metric or action card */}</div>
      <div className="col-span-2 {cardStyle} p-5">{/* Wide content card */}</div>
      <div className="col-span-1 {cardStyle} p-4">{/* Quick action or stat */}</div>
      <div className="col-span-3 {cardStyle} p-5">{/* Full-width section */}</div>
    </div>
  </main>
</div>
Use for: dashboards, overview screens, analytics home pages. Each card is a self-contained unit.
CRITICAL: Vary card sizes. Use col-span-1, col-span-2, col-span-3, row-span-2 to create asymmetry.`,

  sidebar_main: `
PAGE STRUCTURE: SIDEBAR + MAIN
Fixed sidebar for navigation, scrollable main content area.
<div className="flex min-h-screen {rootBg}">
  <aside className="w-64 min-h-screen border-r {sidebarBg} p-4 flex flex-col gap-1 flex-shrink-0">
    <div className="flex items-center gap-2 px-3 py-3 mb-4">{/* Logo + app name */}</div>
    {/* Vertical nav items: <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm"> */}
    {/* Active: bg-primary/10 text-primary font-medium */}
    <div className="mt-auto pt-4 border-t">{/* Settings / profile at bottom */}</div>
  </aside>
  <main className="flex-1 overflow-y-auto">
    <header className="flex items-center justify-between px-8 py-4 border-b {headerBg}">
      {/* Page title + actions */}
    </header>
    <div className="px-8 py-6">{CONTENT}</div>
  </main>
</div>
Use for: productivity apps, admin dashboards, settings-heavy apps. Do NOT also add a top nav bar.`,

  split_panel: `
PAGE STRUCTURE: SPLIT PANEL
Two-panel side-by-side layout. Input/config on left, output/preview on right.
<div className="min-h-screen {rootBg}">
  <header className="flex items-center justify-between px-6 py-3 border-b">{/* Minimal top bar */}</header>
  <div className="flex" style={{height:'calc(100vh - 3.5rem)'}}>
    <div className="w-[42%] border-r overflow-y-auto p-6">{/* Left: Input form, controls, configuration */}</div>
    <div className="flex-1 overflow-y-auto p-6 {rightPanelBg}">{/* Right: Output, preview, results */}</div>
  </div>
</div>
Use for: generators (input left, output right), comparison tools, editors, before/after tools.
The two panels should have different visual weights — one lighter, one has content/output.`,

  full_bleed_sections: `
PAGE STRUCTURE: FULL-BLEED SECTIONS
Full-width stacked sections with varied backgrounds. Magazine/marketing-tool hybrid.
<div className="min-h-screen {rootBg}">
  {NAV_COMPONENT}
  <section className="w-full py-16 px-6" style={{background:'linear-gradient(135deg, P_COLOR, S_COLOR)'}}>
    <div className="max-w-4xl mx-auto text-center text-white">{/* Hero section with bold typography */}</div>
  </section>
  <section className="w-full py-12 px-6 {rootBg}">
    <div className="max-w-5xl mx-auto">{/* Main content section */}</div>
  </section>
  <section className="w-full py-12 px-6 {altBg}">
    <div className="max-w-5xl mx-auto">{/* Secondary content */}</div>
  </section>
</div>
Use for: consumer apps, portfolio tools, lifestyle apps. Each section has its own background treatment.
Alternate between white, gradient, and tinted sections for rhythm.`,

  floating_cards: `
PAGE STRUCTURE: FLOATING CARDS
Cards floating on a gradient/colored background. Playful, consumer-oriented.
<div className="min-h-screen" style={{background:'linear-gradient(135deg, {gradStart}, {gradMid}, {gradEnd})'}}>
  {NAV_COMPONENT}
  <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
    <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl p-8">{/* Main hero card */}</div>
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg p-5">{/* Card */}</div>
      <div className="bg-white/80 backdrop-blur-lg rounded-xl shadow-lg p-5">{/* Card */}</div>
    </div>
    <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl p-6">{/* Content card */}</div>
  </div>
</div>
Use for: social apps, discovery, dating, music. Cards feel like they float on the gradient.
CRITICAL: Root background is a gradient, NOT white. Cards use bg-white/80 + backdrop-blur.`,

  magazine_layout: `
PAGE STRUCTURE: MAGAZINE LAYOUT
Asymmetric editorial layout — 2/3 main + 1/3 sidebar content.
<div className="min-h-screen {rootBg}">
  {NAV_COMPONENT}
  <main className="max-w-6xl mx-auto px-6 py-8">
    <div className="grid grid-cols-3 gap-8">
      <div className="col-span-2 space-y-6">{/* Main feature content — larger cards, primary data */}</div>
      <div className="col-span-1 space-y-4">{/* Sidebar — quick stats, related items, filters */}</div>
    </div>
  </main>
</div>
Use for: content platforms, news, research tools, editorial apps.
The main column should have larger, more detailed content. The sidebar has complementary info.`,

  kanban_board: `
PAGE STRUCTURE: KANBAN BOARD
Multi-column horizontal scrollable layout with draggable columns.
<div className="min-h-screen {rootBg}">
  {NAV_COMPONENT}
  <div className="flex gap-4 p-6 overflow-x-auto" style={{minHeight:'calc(100vh - 4rem)'}}>
    {/* Each column: */}
    <div className="flex-shrink-0 w-72 {columnBg} rounded-xl p-4">
      <div className="flex items-center justify-between mb-4 text-sm font-semibold">{/* Column header + count */}</div>
      <div className="space-y-3">{/* Cards within column */}</div>
    </div>
    {/* Repeat for each column (3-5 columns) */}
  </div>
</div>
Use for: project management, pipeline tracking, workflow tools.
Columns should be horizontally scrollable. Each column has a distinct header color or indicator.`,
};

/* ------------------------------------------------------------------ */
/*  Navigation patterns                                                */
/* ------------------------------------------------------------------ */

const NAV_PATTERNS: Record<string, string> = {
  top_bar_tabs: `NAVIGATION: TOP BAR WITH TABS
Use <nav className="sb-nav"> with sb-nav-brand + sb-nav-tabs. Each tab: <button className={cn('sb-nav-tab', page===id && 'active')}>
For dark themes: <nav className="sb-nav sb-nav-dark">.
Brand: sb-icon-box-gradient with icon + app name span.`,

  sidebar_nav: `NAVIGATION: SIDEBAR (already part of sidebar_main layout)
Do NOT add a separate top nav — the sidebar IS the navigation.
Sidebar nav items: <button className={cn("flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors", page===id && "bg-primary/10 text-primary font-medium")} onClick={()=>setPage(id)}><Icon icon={TabIcon} size={18}/> {label}</button>
Group items with section labels: <div className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 mt-4 mb-2">Section</div>
Bottom of sidebar: settings gear icon + profile/account link.`,

  bottom_tab_bar: `NAVIGATION: BOTTOM TAB BAR
NO top nav bar. Use a fixed bottom bar:
<nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 bg-white/90 backdrop-blur-xl border-t border-gray-200/50 px-2">
  {tabs.map(t => (
    <button key={t.id} className="flex flex-col items-center gap-0.5 py-1 px-3" onClick={()=>setPage(t.id)}>
      <Icon icon={t.icon} size={20} style={{color: page===t.id ? P : '#9ca3af'}}/>
      <span className={"text-[10px] font-medium " + (page===t.id ? "text-primary" : "text-gray-400")}>{t.label}</span>
    </button>
  ))}
</nav>
Add pb-20 to main content to prevent overlap.
For dark themes: bg-slate-900/90 with white text.`,

  floating_pill: `NAVIGATION: FLOATING PILL
<nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 px-2 py-1.5 rounded-full bg-white/80 backdrop-blur-xl shadow-lg border border-gray-200/50">
  {tabs.map(t => (
    <button key={t.id} className={cn("flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all", page===t.id ? "bg-primary text-white shadow-md" : "text-gray-500 hover:text-gray-900")} onClick={()=>setPage(t.id)}>
      <Icon icon={t.icon} size={14}/> {t.label}
    </button>
  ))}
</nav>
Add pt-20 to main content to prevent overlap.`,

  contextual_tabs: `NAVIGATION: CONTEXTUAL (NO PERSISTENT NAV)
Do NOT render a <nav> element. Instead, embed mode selectors within content:
<div className="flex items-center gap-2 mb-6">
  {modes.map(m => (
    <button key={m.id} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", mode===m.id ? "bg-primary text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200")} onClick={()=>setMode(m.id)}>
      <Icon icon={m.icon} size={14} className="inline mr-1.5"/> {m.label}
    </button>
  ))}
</div>
Place these selectors at the top of the content area, NOT in a separate nav bar.
Include app name and icon as a small header above the selectors.`,

  breadcrumb_header: `NAVIGATION: BREADCRUMB HEADER
<header className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
  <div className="flex items-center gap-2 text-sm">
    <span className="text-gray-400 cursor-pointer hover:text-gray-600">Home</span>
    <Icon icon={ChevronRight} size={14} className="text-gray-300"/>
    <span className="text-gray-400 cursor-pointer hover:text-gray-600">{section}</span>
    <Icon icon={ChevronRight} size={14} className="text-gray-300"/>
    <span className="text-gray-900 font-medium">{current}</span>
  </div>
  <div className="flex items-center gap-3">{/* Action buttons */}</div>
</header>
Use breadcrumb depth to show navigation state. Clicking breadcrumbs navigates.`,

  hamburger_drawer: `NAVIGATION: HAMBURGER + DRAWER
Add a hamburger button and slide-out drawer:
const [drawerOpen, setDrawerOpen] = useState(false);
// Overlay:
{drawerOpen && <div className="fixed inset-0 bg-black/30 z-40" onClick={()=>setDrawerOpen(false)}/>}
// Drawer:
<aside className={"fixed left-0 top-0 h-full w-72 bg-white shadow-2xl z-50 p-6 transition-transform " + (drawerOpen ? "translate-x-0" : "-translate-x-full")}>
  <div className="flex items-center justify-between mb-6">{/* Logo + close button */}</div>
  {tabs.map(t => (<button key={t.id} className="flex items-center gap-3 w-full px-3 py-3 rounded-lg text-sm hover:bg-gray-100" onClick={()=>{setPage(t.id);setDrawerOpen(false)}}><Icon icon={t.icon} size={18}/> {t.label}</button>))}
</aside>
// Top bar with hamburger:
<header className="flex items-center gap-3 px-4 py-3 border-b">
  <button onClick={()=>setDrawerOpen(true)}><Icon icon={Menu} size={20}/></button>
  <span className="font-semibold">{pageTitle}</span>
</header>`,

  segmented_control: `NAVIGATION: SEGMENTED CONTROL
<header className="flex items-center justify-between px-6 py-4">
  <div className="flex items-center gap-3">{/* Logo + app name */}</div>
  <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
    {tabs.map(t => (
      <button key={t.id} className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", page===t.id ? "bg-white shadow-sm text-gray-900" : "text-gray-500")} onClick={()=>setPage(t.id)}>
        {t.label}
      </button>
    ))}
  </div>
  <div className="flex items-center gap-2">{/* Action icons */}</div>
</header>
Segmented control sits in the header. Best for 2-3 mutually exclusive views.`,
};

/* ------------------------------------------------------------------ */
/*  Visual mood tokens                                                 */
/* ------------------------------------------------------------------ */

const VISUAL_MOOD_TOKENS: Record<string, string> = {
  glassmorphism_light: `MOOD: GLASSMORPHISM LIGHT
Root: bg-gray-50/80. Cards: bg-white/70 backdrop-blur-xl border border-white/30 rounded-2xl shadow-lg. Inputs: glass-input.
Buttons: glass-btn-gradient (gradient + glow). Elevated: glass-elevated.
Nav bg: bg-white/70 backdrop-blur-xl. Depth via layered transparencies.
Accent: sb-glow-sm on hover. Use var(--sb-primary-bg) for tinted zones.`,

  glassmorphism_dark: `MOOD: GLASSMORPHISM DARK
Root: bg-slate-950. Cards: bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl. Inputs: sb-dark-input.
Buttons: glass-btn-gradient. Text: text-white, text-slate-300, text-slate-500.
Glows: sb-glow-sm, sb-glow on interactive elements. Subtle colored reflections.
Set --sb-surface:#0f172a, --sb-surface-elevated:#1e293b, --sb-text:#e2e8f0, --sb-text-secondary:#94a3b8.`,

  neubrutalism: `MOOD: NEUBRUTALISM
Root: bg-[#FFFDF7] or bg-[#FFF8E7]. Cards: bg-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-lg.
Buttons: border-2 border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_rgba(0,0,0,1)] transition-all.
NO soft gradients. Bold, chunky, raw. Strong color blocks. Thick borders everywhere.
Tags: border border-black px-2 py-0.5 rounded text-xs font-bold.
Typography: font-bold everywhere, text-black. Playful but structured.`,

  soft_minimal: `MOOD: SOFT MINIMAL
Root: bg-white. Cards: border border-gray-100 rounded-xl. Shadow: shadow-sm only, NO heavy shadows.
Lots of whitespace (py-10+ between sections). Thin 1px borders. Muted gray palette.
Buttons: border border-gray-200 rounded-lg hover:bg-gray-50. Primary: bg-gray-900 text-white rounded-lg.
Typography: text-gray-900 for headings, text-gray-500 for secondary. Light, airy, understated.
Like Notion or Linear — restraint is the design language. No gradients except subtle primary tint.`,

  dark_premium: `MOOD: DARK PREMIUM
Root: bg-[#0a0a0a] or bg-[#09090b]. Cards: bg-[#141414] border border-[#222] rounded-xl.
Buttons: bg-white text-black rounded-lg hover:bg-gray-100. Or: border border-[#333] text-white hover:bg-[#1a1a1a].
Subtle gradients only — no bold color blocks. Accent glow on hover only, not at rest.
Typography: text-white, text-gray-400, -tracking-tight on headings. text-4xl+ for hero numbers.
Like Raycast, Vercel, Linear dark mode. Premium feel through restraint and contrast.
Set --sb-surface:#0a0a0a, --sb-surface-elevated:#141414, --sb-text:#fafafa, --sb-text-secondary:#737373.`,

  vibrant_gradient: `MOOD: VIBRANT GRADIENT
Root: bg-white. Hero: full-width gradient section with bold text overlay.
Cards: bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow. Glass: glass-elevated.
CTAs: glass-btn-gradient (gradient + glow). Hero text: sb-gradient-text for key headings.
Use BOTH P and S for rich gradients. At least one full-width gradient banner per page.
Bold colors, high contrast, energetic. Like a modern fitness or food app.`,

  clean_corporate: `MOOD: CLEAN CORPORATE
Root: bg-gray-50. Cards: bg-white border border-gray-200 rounded-lg shadow-sm.
Buttons: bg-blue-600 text-white rounded-md. Secondary: border border-gray-300 rounded-md.
Tables: proper th/td with borders. Structured grid layouts. Data-focused.
Typography: Inter font, text-gray-900, structured heading hierarchy (text-lg > text-sm).
Like a Salesforce or HubSpot dashboard. Professional, no playfulness. Trust through structure.`,

  playful_rounded: `MOOD: PLAYFUL ROUNDED
Root: bg-[#FAFAFA] or bg-white. Cards: bg-white rounded-3xl shadow-md border border-gray-100.
Buttons: rounded-full px-6 py-3 font-medium. Large icons: size={24}.
Pastel accent colors alongside primary. Bouncy hover: hover:scale-105 transition-transform.
Like Duolingo or Headspace. Friendly, approachable, slightly oversized components.
Round everything: rounded-3xl for cards, rounded-full for buttons and avatars.`,

  editorial: `MOOD: EDITORIAL
Root: bg-white. Cards: border-b border-gray-200 only (no card backgrounds).
Typography: font-serif for headings (text-4xl), font-sans for body. Dramatic size contrast.
Minimal color — use primary sparingly as an accent, mostly monochrome.
Horizontal rules (<hr className="border-gray-200 my-8"/>) as visual breaks.
Like a premium magazine or The New York Times. Content-first, decoration-minimal.
Layout: generous whitespace, max-w-3xl for reading comfort, large pull quotes.`,

  warm_organic: `MOOD: WARM ORGANIC
Root: bg-[#FBF8F3] or bg-[#FAF5EF]. Cards: bg-white border border-amber-100/50 rounded-xl shadow-sm.
Colors: amber, stone, olive, warm browns. Primary: earthy green or warm orange.
Buttons: bg-primary text-white rounded-lg. Soft hover: hover:bg-primary/90.
Typography: rounded, friendly. Soft shadows (shadow-sm). Natural feel.
Like a cooking app or wellness platform. Comfort through warm tones and soft edges.`,

  neon_dark: `MOOD: NEON DARK
Root: bg-black or bg-[#050505]. Cards: bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl.
Neon accents: text-shadow and box-shadow with primary glow. style={{textShadow:'0 0 20px '+P, boxShadow:'0 0 20px '+window.__sb.color(P,0.3)}}.
Buttons: border border-primary/30 text-primary hover:bg-primary/10. Glow on hover.
Typography: font-mono for labels, text-white. Cyberpunk aesthetic.
Like a music production tool or gaming dashboard. Electric, high-tech.`,

  monochrome_elegant: `MOOD: MONOCHROME ELEGANT
Root: bg-white (or bg-gray-950 for dark variant). Only use primary color + its tonal variations.
No secondary color. Generate tints: window.__sb.color(P, 0.05/0.1/0.2/0.4).
Cards: border border-primary/10 rounded-xl. Buttons: bg-primary text-white.
Typography: -tracking-tight, text-primary for headings. Sophisticated single-palette.
Like a luxury brand site. Elegance through constraint.`,
};

/* ------------------------------------------------------------------ */
/*  Golden examples — 4 diverse styles to teach by showing             */
/* ------------------------------------------------------------------ */

const GOLDEN_A = `
// --- GOLDEN EXAMPLE: DARK PREMIUM + SIDEBAR + BENTO GRID ---
const {useState,useCallback} = React;
const {LayoutDashboard,BarChart2,Settings,Users,TrendingUp,ArrowUpRight,Clock,Search,Bell,Activity,Zap,PieChart} = window.LucideReact || {};
const cn=window.__sb.cn;const useStore=window.__sb.useStore;const toast=window.__sb.toast;const fmt=window.__sb.fmt;
const P='#6366f1';const S='#8b5cf6';
document.documentElement.style.setProperty('--sb-primary',P);
document.documentElement.style.setProperty('--sb-primary-glow',window.__sb.color(P,0.15));
document.documentElement.style.setProperty('--sb-primary-bg',window.__sb.color(P,0.08));
document.documentElement.style.setProperty('--sb-secondary',S);
document.documentElement.style.setProperty('--sb-secondary-glow',window.__sb.color(S,0.15));
function Icon({icon:C,...p}){return C?<C size={18} strokeWidth={1.5} {...p}/>:null;}
const NAV=[{id:'overview',label:'Overview',icon:LayoutDashboard},{id:'analytics',label:'Analytics',icon:BarChart2},{id:'users',label:'Users',icon:Users},{id:'settings',label:'Settings',icon:Settings}];
const METRICS=[{label:'Revenue',value:'$48.2K',change:'+12.4%',up:true},{label:'Users',value:'2,847',change:'+8.2%',up:true},{label:'Conversion',value:'3.6%',change:'-0.3%',up:false}];
const ACTIVITY=[{name:'Sarah K. upgraded to Pro',time:'2m ago'},{name:'New signup from Product Hunt',time:'8m ago'},{name:'Payment received $299',time:'15m ago'},{name:'Support ticket resolved #847',time:'1h ago'}];
function App(){
  const [page,setPage]=useState('overview');
  return(
    <div className="flex min-h-screen bg-[#0a0a0a] text-white">
      <aside className="w-60 min-h-screen border-r border-[#1a1a1a] p-4 flex flex-col gap-1 flex-shrink-0">
        <div className="flex items-center gap-2 px-3 py-3 mb-4"><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg,'+P+','+S+')'}}><Icon icon={Zap} size={16} style={{color:'#fff'}}/></div><span className="font-semibold text-white">AppName</span></div>
        {NAV.map(n=>(<button key={n.id} className={cn("flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors",page===n.id?"text-white font-medium":"text-gray-500 hover:text-gray-300 hover:bg-white/5")} style={page===n.id?{background:window.__sb.color(P,0.15)}:{}} onClick={()=>setPage(n.id)}><Icon icon={n.icon} size={18}/>{n.label}</button>))}
        <div className="mt-auto pt-4 border-t border-[#1a1a1a]"><button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-gray-300"><Icon icon={Settings} size={18}/>Settings</button></div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-between px-8 py-4 border-b border-[#1a1a1a]"><h1 className="text-xl font-semibold tracking-tight">Dashboard</h1><div className="flex items-center gap-3"><div className="relative"><Icon icon={Search} size={18} className="text-gray-500"/></div><Icon icon={Bell} size={18} className="text-gray-500"/></div></header>
        <div className="px-8 py-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-2 row-span-2 bg-[#141414] border border-[#222] rounded-xl p-6"><div className="text-sm text-gray-400 mb-1">Total Revenue</div><div className="text-4xl font-bold tracking-tight">$48,247</div><div className="flex items-center gap-1 mt-2 text-emerald-400 text-sm"><Icon icon={ArrowUpRight} size={14}/>+12.4% from last month</div><svg viewBox="0 0 300 80" className="w-full mt-4"><defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={P} stopOpacity="0.3"/><stop offset="100%" stopColor={P} stopOpacity="0"/></linearGradient></defs><polygon points="0,80 20,65 60,50 100,55 140,35 180,40 220,25 260,30 300,15 300,80" fill="url(#cg)"/><polyline points="20,65 60,50 100,55 140,35 180,40 220,25 260,30 300,15" fill="none" stroke={P} strokeWidth="2" strokeLinecap="round"/></svg></div>
            {METRICS.map(m=>(<div key={m.label} className="bg-[#141414] border border-[#222] rounded-xl p-5"><div className="text-xs text-gray-500 uppercase tracking-wider">{m.label}</div><div className="text-2xl font-bold mt-1 tracking-tight">{m.value}</div><span className={"text-xs font-medium "+(m.up?"text-emerald-400":"text-red-400")}>{m.change}</span></div>))}
            <div className="col-span-2 bg-[#141414] border border-[#222] rounded-xl p-5"><div className="text-sm font-medium text-gray-400 mb-3">Recent Activity</div>{ACTIVITY.map((a,i)=>(<div key={i} className="flex items-center justify-between py-2.5 border-b border-[#1a1a1a] last:border-0"><span className="text-sm text-gray-300">{a.name}</span><span className="text-xs text-gray-600">{a.time}</span></div>))}</div>
            <div className="col-span-2 bg-[#141414] border border-[#222] rounded-xl p-5 flex items-center justify-center"><div className="text-center"><Icon icon={PieChart} size={48} className="mx-auto text-gray-600 mb-3"/><div className="text-sm text-gray-500">Chart placeholder</div></div></div>
          </div>
        </div>
      </main>
    </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);`;

const GOLDEN_B = `
// --- GOLDEN EXAMPLE: VIBRANT + BOTTOM TABS + FLOATING CARDS ---
const {useState,useCallback} = React;
const {Home,Search,Heart,User,MapPin,Star,Clock,Filter,ShoppingBag,Sparkles,ArrowRight,Bookmark} = window.LucideReact || {};
const cn=window.__sb.cn;const useStore=window.__sb.useStore;const toast=window.__sb.toast;const fmt=window.__sb.fmt;
const P='#f97316';const S='#ec4899';
document.documentElement.style.setProperty('--sb-primary',P);
document.documentElement.style.setProperty('--sb-primary-glow',window.__sb.color(P,0.15));
document.documentElement.style.setProperty('--sb-primary-bg',window.__sb.color(P,0.08));
document.documentElement.style.setProperty('--sb-secondary',S);
document.documentElement.style.setProperty('--sb-secondary-glow',window.__sb.color(S,0.15));
function Icon({icon:C,...p}){return C?<C size={18} strokeWidth={1.5} {...p}/>:null;}
const ITEMS=[{id:1,name:'Golden Hour Cafe',cat:'Brunch',rating:4.8,dist:'0.3 mi',price:'$$',gradient:'from-amber-400 to-orange-500',saved:false},{id:2,name:'Sakura Garden',cat:'Japanese',rating:4.9,dist:'0.5 mi',price:'$$$',gradient:'from-pink-400 to-rose-500',saved:true},{id:3,name:'Verde Kitchen',cat:'Healthy',rating:4.7,dist:'0.2 mi',price:'$',gradient:'from-emerald-400 to-teal-500',saved:false},{id:4,name:'Bella Napoli',cat:'Italian',rating:4.6,dist:'0.8 mi',price:'$$',gradient:'from-red-400 to-orange-500',saved:false},{id:5,name:'Blue Lagoon',cat:'Seafood',rating:4.5,dist:'1.1 mi',price:'$$',gradient:'from-blue-400 to-cyan-500',saved:true}];
const CATS=['All','Brunch','Japanese','Healthy','Italian','Seafood'];
function App(){
  const [page,setPage]=useState('discover');
  const [items,setItems]=useStore('items',ITEMS);
  const [cat,setCat]=useState('All');
  const filtered=cat==='All'?items:items.filter(i=>i.cat===cat);
  const toggleSave=useCallback((id)=>{setItems(prev=>prev.map(i=>i.id===id?{...i,saved:!i.saved}:i))},[setItems]);
  const tabs=[{id:'discover',label:'Discover',icon:Home},{id:'search',label:'Search',icon:Search},{id:'saved',label:'Saved',icon:Heart},{id:'profile',label:'Profile',icon:User}];
  return(
    <div className="min-h-screen pb-20" style={{background:'linear-gradient(165deg, #FFF5EB 0%, #FFE8D6 30%, #FFDDD2 100%)'}}>
      <div className="max-w-lg mx-auto px-5 pt-8">
        {page==='discover'&&(<div className="space-y-6 sb-stagger">
          <div><div className="text-3xl font-bold tracking-tight text-gray-900">Good evening,</div><div className="text-3xl font-bold" style={{background:'linear-gradient(135deg,'+P+','+S+')',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>what's for dinner?</div></div>
          <div className="relative"><Icon icon={Search} size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input className="w-full pl-10 pr-4 py-3 bg-white/80 backdrop-blur-lg rounded-2xl border-0 shadow-sm text-sm" placeholder="Search restaurants, cuisines..."/></div>
          <div className="flex gap-2 overflow-x-auto pb-1">{CATS.map(c=>(<button key={c} className={cn("px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",cat===c?"text-white shadow-md":"bg-white/60 text-gray-600")} style={cat===c?{background:'linear-gradient(135deg,'+P+','+S+')'}:{}} onClick={()=>setCat(c)}>{c}</button>))}</div>
          <div className="space-y-4">{filtered.map(item=>(<div key={item.id} className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg overflow-hidden"><div className={"h-32 bg-gradient-to-br "+item.gradient+" relative"}><button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center" onClick={()=>toggleSave(item.id)}><Icon icon={Heart} size={14} style={{color:item.saved?'#ef4444':'#9ca3af',fill:item.saved?'#ef4444':'none'}}/></button></div><div className="p-4"><div className="flex items-center justify-between"><span className="font-semibold">{item.name}</span><span className="text-xs text-gray-500">{item.price}</span></div><div className="flex items-center gap-3 mt-1.5 text-sm text-gray-500"><span className="flex items-center gap-1"><Icon icon={Star} size={13} style={{color:'#f59e0b',fill:'#f59e0b'}}/>{item.rating}</span><span className="flex items-center gap-1"><Icon icon={MapPin} size={13}/>{item.dist}</span><span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{item.cat}</span></div></div></div>))}</div>
        </div>)}
        {page==='saved'&&(<div className="space-y-4 sb-stagger"><div className="text-2xl font-bold text-gray-900">Saved Places</div>{items.filter(i=>i.saved).map(item=>(<div key={item.id} className="bg-white/80 backdrop-blur-lg rounded-xl shadow-md p-4 flex items-center gap-3"><div className={"w-14 h-14 rounded-xl bg-gradient-to-br flex-shrink-0 "+item.gradient}/><div className="flex-1"><div className="font-medium">{item.name}</div><div className="text-sm text-gray-500">{item.cat} · {item.dist}</div></div><Icon icon={ArrowRight} size={16} className="text-gray-400"/></div>))}</div>)}
      </div>
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-16 bg-white/90 backdrop-blur-xl border-t border-gray-200/50 px-2">
        {tabs.map(t=>(<button key={t.id} className="flex flex-col items-center gap-0.5 py-1 px-3" onClick={()=>setPage(t.id)}><Icon icon={t.icon} size={20} style={{color:page===t.id?P:'#9ca3af'}}/><span className={"text-[10px] font-medium "+(page===t.id?"text-orange-500":"text-gray-400")}>{t.label}</span></button>))}
      </nav>
    </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);`;

const GOLDEN_C = `
// --- GOLDEN EXAMPLE: SOFT MINIMAL + SPLIT PANEL + BREADCRUMB ---
const {useState,useCallback} = React;
const {ChevronRight,Sparkles,Copy,Clock,RotateCcw,Check,FileText,Settings,Sliders,ArrowRight} = window.LucideReact || {};
const cn=window.__sb.cn;const useStore=window.__sb.useStore;const toast=window.__sb.toast;const copy=window.__sb.copy;const fmt=window.__sb.fmt;
const P='#2563eb';const S='#7c3aed';
document.documentElement.style.setProperty('--sb-primary',P);
document.documentElement.style.setProperty('--sb-primary-glow',window.__sb.color(P,0.15));
document.documentElement.style.setProperty('--sb-primary-bg',window.__sb.color(P,0.08));
document.documentElement.style.setProperty('--sb-secondary',S);
document.documentElement.style.setProperty('--sb-secondary-glow',window.__sb.color(S,0.15));
function Icon({icon:C,...p}){return C?<C size={18} strokeWidth={1.5} {...p}/>:null;}
const HISTORY=[{id:1,title:'Marketing Email Copy',date:'2024-03-10',words:320},{id:2,title:'Product Description',date:'2024-03-08',words:180},{id:3,title:'Blog Post Intro',date:'2024-03-05',words:450}];
function App(){
  const [section,setSection]=useState('generate');
  const [output]=useState('Transform your morning routine with our revolutionary smart alarm clock. Unlike traditional alarms that jolt you awake, our AI-powered device analyzes your sleep cycles to find the optimal wake window, ensuring you start every day feeling refreshed and energized.');
  return(
    <div className="min-h-screen bg-white">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-gray-900"><Icon icon={FileText} size={16} style={{color:P}}/> AppName</span>
          <Icon icon={ChevronRight} size={14} className="text-gray-300"/>
          <span className="text-gray-400 cursor-pointer hover:text-gray-600" onClick={()=>setSection('generate')}>Generator</span>
          {section==='history'&&<><Icon icon={ChevronRight} size={14} className="text-gray-300"/><span className="text-gray-900 font-medium">History</span></>}
        </div>
        <div className="flex items-center gap-2"><button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-50" onClick={()=>setSection('history')}><Icon icon={Clock} size={14}/>History</button><button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-gray-500 hover:bg-gray-50"><Icon icon={Settings} size={14}/></button></div>
      </header>
      {section==='generate'&&(
        <div className="flex" style={{height:'calc(100vh - 3.25rem)'}}>
          <div className="w-[42%] border-r border-gray-100 overflow-y-auto p-6 space-y-5">
            <div><div className="text-lg font-semibold text-gray-900">Create Content</div><div className="text-sm text-gray-500 mt-1">Describe what you need and we'll generate it</div></div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Content Type</label><select className="glass-input"><option>Marketing Copy</option><option>Product Description</option><option>Blog Post</option><option>Email</option></select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Describe your content</label><textarea className="glass-input" rows={4} placeholder="What product or service is this for?" defaultValue="A smart alarm clock that uses AI to optimize your wake time based on sleep cycles"/></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Tone</label><div className="flex gap-2">{['Professional','Friendly','Bold','Minimal'].map((t,i)=>(<button key={t} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",i===0?"border-blue-200 bg-blue-50 text-blue-700":"border-gray-200 text-gray-500 hover:bg-gray-50")}>{t}</button>))}</div></div>
              <button className="w-full py-2.5 rounded-lg text-sm font-medium text-white shadow-sm" style={{background:'linear-gradient(135deg,'+P+','+S+')'}}><Icon icon={Sparkles} size={15} className="inline mr-1.5"/>Generate Content</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
            <div className="flex items-center justify-between mb-4"><span className="text-sm font-medium text-gray-500">Generated Output</span><div className="flex items-center gap-2"><button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-gray-500 hover:bg-white border border-gray-200" onClick={()=>{copy(output);toast('Copied!','success')}}><Icon icon={Copy} size={12}/>Copy</button><button className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-gray-500 hover:bg-white border border-gray-200"><Icon icon={RotateCcw} size={12}/>Retry</button></div></div>
            <div className="bg-white border border-gray-100 rounded-xl p-6"><p className="text-gray-800 leading-relaxed">{output}</p></div>
            <div className="mt-4 flex items-center gap-3 text-xs text-gray-400"><span>{output.split(' ').length} words</span><span>·</span><span>Generated just now</span></div>
          </div>
        </div>
      )}
      {section==='history'&&(
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">{HISTORY.map(h=>(<div key={h.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"><div><div className="font-medium text-sm text-gray-900">{h.title}</div><div className="text-xs text-gray-400 mt-0.5">{fmt.date(h.date)} · {h.words} words</div></div><Icon icon={ArrowRight} size={16} className="text-gray-400"/></div>))}</div>
      )}
    </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);`;

const GOLDEN_D = `
// --- GOLDEN EXAMPLE: NEUBRUTALISM + FULL-BLEED + CONTEXTUAL TABS ---
const {useState,useCallback} = React;
const {Palette,Sparkles,Grid,Star,Download,Share2,Layers,Wand2,Image,Zap,RefreshCw,Eye} = window.LucideReact || {};
const cn=window.__sb.cn;const useStore=window.__sb.useStore;const toast=window.__sb.toast;const fmt=window.__sb.fmt;
const P='#6366f1';const S='#ec4899';
document.documentElement.style.setProperty('--sb-primary',P);
document.documentElement.style.setProperty('--sb-primary-glow',window.__sb.color(P,0.15));
document.documentElement.style.setProperty('--sb-primary-bg',window.__sb.color(P,0.08));
document.documentElement.style.setProperty('--sb-secondary',S);
document.documentElement.style.setProperty('--sb-secondary-glow',window.__sb.color(S,0.15));
function Icon({icon:C,...p}){return C?<C size={18} strokeWidth={1.5} {...p}/>:null;}
const WORKS=[{id:1,title:'Sunset Abstract',style:'Impressionist',gradient:'from-amber-300 to-orange-500'},{id:2,title:'Neon City',style:'Cyberpunk',gradient:'from-violet-500 to-fuchsia-500'},{id:3,title:'Ocean Calm',style:'Minimalist',gradient:'from-cyan-400 to-blue-500'},{id:4,title:'Forest Path',style:'Watercolor',gradient:'from-emerald-400 to-teal-600'},{id:5,title:'Electric Dreams',style:'Digital Art',gradient:'from-pink-500 to-rose-600'},{id:6,title:'Mountain Peak',style:'Realism',gradient:'from-slate-400 to-zinc-600'}];
function App(){
  const [mode,setMode]=useState('create');
  const modes=[{id:'create',label:'Create',icon:Wand2},{id:'gallery',label:'Gallery',icon:Grid},{id:'enhance',label:'Enhance',icon:Sparkles}];
  return(
    <div className="min-h-screen bg-[#FFFDF7]">
      <section className="w-full py-12 px-6" style={{background:P}}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 bg-white border-2 border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] rounded-lg flex items-center justify-center"><Icon icon={Palette} size={20} style={{color:P}}/></div><span className="text-2xl font-black text-white">AppName</span></div>
          <div className="flex items-center gap-2 mb-8">{modes.map(m=>(<button key={m.id} className={cn("flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold border-2 border-black transition-all",mode===m.id?"bg-white text-black shadow-[3px_3px_0_0_rgba(0,0,0,1)]":"bg-transparent text-white border-white/30 hover:bg-white/10")} onClick={()=>setMode(m.id)}><Icon icon={m.icon} size={15}/>{m.label}</button>))}</div>
          {mode==='create'&&(<div className="bg-white border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-xl p-6 space-y-4"><textarea className="w-full p-3 border-2 border-black rounded-lg text-sm resize-none" rows={3} placeholder="Describe your vision..." defaultValue="A serene mountain landscape at golden hour with impressionist brushstrokes"/><div className="flex items-center justify-between"><div className="flex gap-2">{['Painting','Photo','3D','Sketch'].map((s,i)=>(<button key={s} className={cn("px-3 py-1.5 text-xs font-bold border-2 border-black rounded transition-all",i===0?"bg-black text-white":"bg-white text-black hover:bg-gray-100 shadow-[2px_2px_0_0_rgba(0,0,0,1)]")}>{s}</button>))}</div><button className="px-5 py-2.5 text-sm font-bold text-white border-2 border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] rounded-lg hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0_0_rgba(0,0,0,1)] transition-all" style={{background:P}}><Icon icon={Zap} size={14} className="inline mr-1"/>Generate</button></div></div>)}
        </div>
      </section>
      <section className="w-full py-10 px-6">
        <div className="max-w-4xl mx-auto">
          {mode==='create'&&(<div><div className="aspect-video bg-gradient-to-br from-amber-200 via-orange-300 to-rose-400 border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-xl flex items-center justify-center"><span className="text-white/80 font-bold">Generated Preview</span></div><div className="flex gap-3 mt-4"><button className="flex-1 px-4 py-2.5 bg-black text-white text-sm font-bold border-2 border-black rounded-lg"><Icon icon={Download} size={14} className="inline mr-1"/>Export</button><button className="flex-1 px-4 py-2.5 bg-white text-black text-sm font-bold border-2 border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] rounded-lg"><Icon icon={Share2} size={14} className="inline mr-1"/>Share</button></div></div>)}
          {mode==='gallery'&&(<div className="grid grid-cols-3 gap-4">{WORKS.map(w=>(<div key={w.id} className="group border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-xl overflow-hidden hover:shadow-[2px_2px_0_0_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-all"><div className={"h-36 bg-gradient-to-br "+w.gradient}/><div className="p-3 bg-white"><div className="font-bold text-sm">{w.title}</div><div className="text-xs text-gray-500 mt-0.5">{w.style}</div></div></div>))}</div>)}
          {mode==='enhance'&&(<div className="bg-white border-2 border-black shadow-[6px_6px_0_0_rgba(0,0,0,1)] rounded-xl p-6 text-center"><Icon icon={Image} size={48} className="mx-auto text-gray-300 mb-3"/><div className="font-bold text-lg">Upload to Enhance</div><div className="text-sm text-gray-500 mt-1">Drop an image or click to browse</div><button className="mt-4 px-6 py-2.5 text-sm font-bold border-2 border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] rounded-lg" style={{background:S,color:'#fff'}}>Choose File</button></div>)}
        </div>
      </section>
    </div>);
}
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);`;

function selectGoldenExample(mood: string, _structure: string): string {
  if (["dark_premium", "glassmorphism_dark", "neon_dark"].includes(mood)) return GOLDEN_A;
  if (["vibrant_gradient", "playful_rounded", "warm_organic"].includes(mood)) return GOLDEN_B;
  if (["soft_minimal", "clean_corporate", "monochrome_elegant", "glassmorphism_light"].includes(mood)) return GOLDEN_C;
  return GOLDEN_D; // neubrutalism, editorial
}

/* ------------------------------------------------------------------ */
/*  System prompt builder                                              */
/* ------------------------------------------------------------------ */

function buildCodeGenSystemPrompt(intent: ReasonedIntent): string {
  const { layout_composition, visual_mood } = intent;
  const layoutSkeleton = LAYOUT_SKELETONS[layout_composition.page_structure] ?? LAYOUT_SKELETONS.centered_column;
  const navPattern = NAV_PATTERNS[layout_composition.navigation_type] ?? NAV_PATTERNS.top_bar_tabs;
  const moodTokens = VISUAL_MOOD_TOKENS[visual_mood] ?? VISUAL_MOOD_TOKENS.soft_minimal;
  const goldenExample = selectGoldenExample(visual_mood, layout_composition.page_structure);

  const isDark = ["glassmorphism_dark", "dark_premium", "neon_dark"].includes(visual_mood);

  return `You build premium web apps that look like real products people pay for (Linear, Notion, Stripe, Robinhood). Write JSX — Babel transpiles in browser. NO imports. ZERO emoji.

MANDATORY FIRST LINES (copy exactly, replace color values):
const {useState,useEffect,useRef,useCallback,useMemo} = React;
const {/* destructure 10+ needed Lucide icons */} = window.LucideReact || {};
function Icon({icon:C,...p}) { return C ? <C size={18} strokeWidth={1.5} {...p} /> : null; }
const cn = window.__sb.cn;
const useStore = window.__sb.useStore;
const toast = window.__sb.toast;
const copy = window.__sb.copy;
const fmt = window.__sb.fmt;
const P = '#HEX_PRIMARY';
const S = '#HEX_SECONDARY';
document.documentElement.style.setProperty('--sb-primary', P);
document.documentElement.style.setProperty('--sb-primary-glow', window.__sb.color(P, 0.15));
document.documentElement.style.setProperty('--sb-primary-bg', window.__sb.color(P, 0.08));
document.documentElement.style.setProperty('--sb-secondary', S);
document.documentElement.style.setProperty('--sb-secondary-glow', window.__sb.color(S, 0.15));
// LAST LINE: ReactDOM.createRoot(document.getElementById('root')).render(<App />);

=== ANTI-PATTERNS (VIOLATION = AUTOMATIC REJECTION) ===
NEVER produce these — they create the generic "AI template" look:
1. Logo top-left + horizontal tab bar + centered column of stat cards — THE TEMPLATE LOOK
2. Every tab having identical space-y-N with card lists
3. sb-stat cards (value + label) as the primary content on any tab
4. Same max-w-3xl mx-auto px-5 py-6 wrapper on every page
5. Generic "How It Works", "Get Started", fake social proof (10k+ users)
6. Grid of uniform identical cards as the entire main content
7. Using sb-nav when a different navigation type was specified

=== YOUR LAYOUT COMPOSITION ===

${layoutSkeleton}

${navPattern}

HERO STYLE: ${layout_composition.hero_style}
${layout_composition.hero_style === 'gradient_banner' ? 'Full-width gradient section with bold white text overlay. Use linear-gradient with P and S colors.' :
  layout_composition.hero_style === 'metric_dashboard' ? 'Row of 3-4 key metrics in a flex/grid layout at the top. Each metric: large value + label + trend indicator.' :
  layout_composition.hero_style === 'image_hero' ? 'Placeholder image area (use gradient bg as placeholder) with text overlay. Aspect-video or h-48.' :
  layout_composition.hero_style === 'minimal_header' ? 'Just app name + subtitle text, no decorative elements. Clean and understated.' :
  layout_composition.hero_style === 'search_hero' ? 'Large centered search input as the primary interaction point. Full-width, prominent, with icon.' :
  layout_composition.hero_style === 'profile_hero' ? 'User avatar circle + name + stats row. Like a social profile header.' :
  layout_composition.hero_style === 'card_hero' ? 'Single elevated card containing the primary content/action. Centered, prominent.' :
  'No hero — content starts immediately after navigation.'}

CONTENT PATTERN: ${layout_composition.content_pattern}
${layout_composition.content_pattern === 'asymmetric_bento' ? 'Use varied col-span and row-span values. Mix card sizes. NOT uniform grid.' :
  layout_composition.content_pattern === 'card_grid' ? 'Grid of cards (2-3 cols). Each card has image/gradient area + text + metadata.' :
  layout_composition.content_pattern === 'list_feed' ? 'Vertical list of items. Each item: icon/avatar + text + metadata + action. Use sb-list-item or custom rows.' :
  layout_composition.content_pattern === 'form_to_results' ? 'Input area (form/textarea) followed by output/results section that appears below or beside it.' :
  layout_composition.content_pattern === 'timeline_feed' ? 'Chronological items with time markers, dots, or connecting lines. Vertical timeline layout.' :
  layout_composition.content_pattern === 'carousel_sections' ? 'Horizontal scrollable sections with overflow-x-auto. Category chips + horizontal card rows.' :
  layout_composition.content_pattern === 'tabbed_panels' ? 'Tabbed interface within a card. Tab header + swappable content panels.' :
  'Table with headers, rows, sorting, and filters. Use structured data layout.'}

=== VISUAL MOOD ===
${moodTokens}

=== DESIGN SYSTEM (pre-loaded CSS classes — use these, NEVER recreate with inline styles) ===
Surfaces: glass | glass-elevated | glass-hover | sb-frosted | sb-frosted-light
Inputs: glass-input | sb-dark-input | sb-form-group (label+input+.sb-helper) | sb-search (wraps input+sb-search-icon)
Buttons: glass-btn glass-btn-primary | glass-btn-gradient (gradient+glow) | glass-btn glass-btn-secondary | glass-btn-lg
Cards: sb-card | sb-dark-card | sb-accent-card (left border) | sb-feature-card (top border) | sb-result-highlight (gradient bg)
Stats: sb-stat + sb-stat-value + sb-stat-label + sb-stat-change.up/.down | sb-inline-stat
Nav: sb-nav | sb-nav-dark | sb-nav-centered | sb-nav-spread | sb-nav-minimal + sb-nav-brand + sb-nav-tabs + sb-nav-tab
Lists: sb-list-item | sb-divider
Badges: sb-badge | sb-badge-primary | sb-tag | sb-tag-success | sb-tag-warning | sb-tag-error | sb-tag-primary
Data: sb-table + sb-th + sb-td | sb-progress + sb-progress-fill
Interactive: sb-chip / cn("sb-chip", active && "active") | sb-toggle / cn("sb-toggle", on && "on")
Visual: sb-icon-box | sb-icon-box-gradient | sb-avatar | sb-gradient | sb-gradient-subtle | sb-gradient-text | sb-gradient-animated
Effects: sb-glow | sb-glow-sm | sb-stagger | sb-skeleton | sb-empty | sb-section-label | sb-upload-zone
Browse: sb-image-card + sb-image-card-img + sb-image-card-body | sb-price | sb-rating | sb-carousel | sb-bottom-bar
Timeline: sb-timeline-item + sb-timeline-dot | sb-step-dot / .locked / .completed
Layout: sb-kanban-col + sb-kanban-col-header | sb-calendar-cell
Social: sb-chat-bubble | sb-chat-bubble-self | sb-notification-badge | sb-typing-indicator
Data Viz: sb-sparkline + sb-sparkline-bar | sb-meter + sb-meter-fill + sb-meter-marker
Visual: sb-gradient-card | sb-streak-badge | sb-color-dot

SVG PATTERNS (copy and adapt):
ScoreRing: <svg><circle track/><circle progress with strokeDasharray={circ} strokeDashoffset={circ*(1-score/100)}/></svg>
Sparkline: <svg><polyline points="..."/></svg>
DonutChart: <svg> with multiple <circle> segments

SDK: useStore(key,default)=>[val,setVal]; copy(text); toast(msg,'success'|'error'|'info'); fmt.date/time/number/currency/percent/relative; window.__sb.color(hex,opacity); cn(...); window.__sbAI(system,user)
ANIMATIONS: fadeIn, slideUp, slideDown, scaleIn, shimmer, countUp, fillRight, ringFill, pulse, spin, glow, float, gradientShift
COLOR: P=primary, S=secondary. window.__sb.color(P,0.08) for tints.

=== GOLDEN EXAMPLE (match this quality and visual diversity — adapt to your domain) ===
${goldenExample}
// --- END GOLDEN EXAMPLE ---

=== SIGNATURE COMPONENT ===
This app MUST include: ${intent.signature_component}
Build this as a prominent, interactive component on Tab 1. It should be the visual centerpiece.

=== TYPOGRAPHY ===
${intent.typography_style === 'bold_display' ? 'Use text-4xl or text-5xl font-bold -tracking-tight for hero headings. Dramatic size contrast between headings and body text.' :
  intent.typography_style === 'compact_dense' ? 'Use text-sm as the base. Dense spacing. Compact cards. More information visible at once.' :
  intent.typography_style === 'editorial_serif' ? 'Use font-serif for headings (text-3xl+). Sans-serif for body. Editorial feel with dramatic whitespace.' :
  'Standard sizing. text-xl for page headings, text-sm for body. Clean and balanced.'}

=== CONTENT DENSITY ===
${intent.content_density === 'spacious' ? 'Generous whitespace. py-10+ between sections. gap-6 for grids. Fewer items visible. Breathing room.' :
  intent.content_density === 'dense' ? 'Compact layout. py-3 between sections. gap-2 for grids. More items visible. Information-dense.' :
  'Balanced density. py-6 between sections. gap-4 for grids. Standard spacing.'}

=== CRITICAL INSTRUCTIONS ===
1. Write JSX. Babel transpiles. No imports, no h().
2. Tab 1 = WORKING PRODUCT with demo data visible. NEVER a marketing/landing page.
3. Follow the LAYOUT COMPOSITION exactly — use the specified page structure, navigation, hero, and content.
4. Each tab MUST use a different content arrangement (NOT all identical card lists).
5. 5+ demo items with 4+ domain-specific fields each. Show completed results on first render.
6. 10+ unique Lucide icons. Buttons include icon + text. Never text-only buttons.
7. At least 1 SVG data visualization (ScoreRing, sparkline, or donut).
8. Interactive: hover effects, click handlers, at least 1 filter/toggle.
9. ${isDark ? 'DARK THEME: Root bg-slate-950 or darker. All text white/slate. No white cards unless glass with low opacity.' : 'Ensure visual depth — no plain flat white pages. Use tinted bg zones, subtle gradients, or elevated surfaces.'}
10. 6000-12000 chars of focused quality.
11. VARIABLE SAFETY: Every event handler referencing 'e' MUST declare it: onClick={(e) => ...}. Never reference undeclared variables.
12. AVOID: emoji, "Item 1"/"Category A", "Powered by AI", marketing pages, text-only buttons, stat cards as primary content.`;
}

/* ------------------------------------------------------------------ */
/*  Code gen tool schema + repair + streaming (preserved infrastructure) */
/* ------------------------------------------------------------------ */

const codeGenToolSchema = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    generated_code: {
      type: "string",
      description: "Complete single-file React JSX app code. Babel transpiles JSX. ZERO emoji.",
    },
    app_name: {
      type: "string",
      description: "Short, catchy product name (2-3 words max)",
    },
    tagline: {
      type: "string",
      description: "One-line value proposition (under 60 chars)",
    },
    primary_color: {
      type: "string",
      description: "Primary accent hex color e.g. #22c55e",
    },
    icon: {
      type: "string",
      description: "Lucide React icon name in PascalCase",
    },
    pages: {
      type: "array",
      items: { type: "string" },
      description: "List of page/tab names in the app",
    },
  },
  required: ["generated_code", "app_name", "tagline", "primary_color", "icon", "pages"],
};

const QUALITY_GATE_SCORE = 75;

/* ------------------------------------------------------------------ */
/*  Code repair — catches common issues post-generation                */
/* ------------------------------------------------------------------ */

function repairGeneratedCode(rawCode: string): { code: string; repairs: string[] } {
  const repairs: string[] = [];
  let code = (rawCode ?? "")
    .replace(/^```(?:jsx?|tsx?|javascript)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  // 1. Strip import/require statements
  const importPattern = /^(?:import\s+.*?(?:from\s+['"].*?['"]|;)\s*$|const\s+\{[^}]*\}\s*=\s*require\(.*?\).*?$)/gm;
  const importMatches = code.match(importPattern);
  if (importMatches) {
    code = code.replace(importPattern, '').replace(/^\s*\n/gm, '\n');
    repairs.push(`Stripped ${importMatches.length} import statements`);
  }

  // 2. Strip export statements
  if (/^export\s+(default\s+)?/m.test(code)) {
    code = code.replace(/^export\s+default\s+/gm, '').replace(/^export\s+/gm, '');
    repairs.push('Stripped export statements');
  }

  // 3. Detect h() regression
  const usesH = /const\s+h\s*=\s*React\.createElement/.test(code);
  if (usesH) {
    repairs.push('WARNING: Code uses h() instead of JSX');
  }

  // 4. Ensure ReactDOM.createRoot render call exists
  if (!/ReactDOM\.createRoot/.test(code)) {
    if (/function\s+App\s*[\(\{]|const\s+App\s*=/.test(code)) {
      code += "\n\nReactDOM.createRoot(document.getElementById('root')).render(<App />);";
      repairs.push('Added missing ReactDOM.createRoot render call');
    }
  }

  // 5. Strip emoji characters
  const emojiPattern = /[\u{1F000}-\u{1FFFF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]/gu;
  if (emojiPattern.test(code)) {
    code = code.replace(emojiPattern, '');
    repairs.push('Stripped emoji characters');
  }

  // 6. Add glass-input to bare <input> and <textarea> elements
  let bareInputCount = 0;
  code = code.replace(/<(input|textarea)(\s+[^>]*?)(\/?>)/g, (match, tag, attrs, close) => {
    if (/className/.test(attrs)) return match;
    if (/type=["'](radio|checkbox|hidden|range)["']/.test(attrs)) return match;
    bareInputCount++;
    return `<${tag}${attrs} className="glass-input"${close}`;
  });
  if (bareInputCount > 0) {
    repairs.push(`Added glass-input to ${bareInputCount} bare input/textarea elements`);
  }

  // 7. Add glass-input to bare <select> elements
  let bareSelectCount = 0;
  code = code.replace(/<select(\s+[^>]*?)>/g, (match, attrs) => {
    if (/className/.test(attrs)) return match;
    bareSelectCount++;
    return `<select${attrs} className="glass-input">`;
  });
  if (bareSelectCount > 0) {
    repairs.push(`Added glass-input to ${bareSelectCount} bare select elements`);
  }

  // 8. Check CSS variable setup
  if (!/--sb-primary/.test(code)) {
    repairs.push('WARNING: Missing --sb-primary CSS variable setup');
  }

  // 9. Fix event handlers missing (e) parameter
  let eventParamFixes = 0;
  code = code.replace(
    /(\b(?:onClick|onChange|onSubmit|onInput|onKeyDown|onKeyUp|onFocus|onBlur)\s*=\s*\{)\s*\(\)\s*=>\s*([^}]*?\be\b)/g,
    (match, prefix, body) => {
      if (/\bconst\s+e\b|\blet\s+e\b|\bvar\s+e\b/.test(body)) return match;
      eventParamFixes++;
      return `${prefix}(e) => ${body}`;
    }
  );
  if (eventParamFixes > 0) {
    repairs.push(`Fixed ${eventParamFixes} event handlers missing (e) parameter`);
  }

  // 10. Wrap ReactDOM.createRoot render with ErrorBoundary
  code = code.replace(
    /ReactDOM\.createRoot\(document\.getElementById\(['"](root)['"]\)\)\.render\(\s*(<App\s*\/?>)\s*\)/,
    (_match, rootId, appJsx) => {
      repairs.push('Wrapped App render with ErrorBoundary');
      return `var __EB = window.__SBErrorBoundary || React.Fragment;\nReactDOM.createRoot(document.getElementById('${rootId}')).render(<__EB>${appJsx}</__EB>);\nwindow.__sbRenderComplete = true;`;
    }
  );

  return { code: code.trim(), repairs };
}

function classifyComponent(name: string): string {
  if (name === 'App') return 'pages/App';
  if (/Nav|Header|Footer|Sidebar|Layout|TopBar/i.test(name)) return `components/layout/${name}`;
  if (/Card|List|Grid|Item|Badge|Tag|Chip|Row|Cell/i.test(name)) return `components/ui/${name}`;
  if (/Modal|Dialog|Popup|Drawer|Sheet|Toast/i.test(name)) return `components/overlay/${name}`;
  if (/Score|Ring|Chart|Graph|Meter|Gauge/i.test(name)) return `components/data/${name}`;
  return `components/${name}`;
}

async function runToolCodeGeneration(
  client: Anthropic,
  modelId: string,
  systemPrompt: string,
  userMessage: string,
  onProgress?: ProgressCallback,
): Promise<CodeGenerationResult | null> {
  const timeoutMs = Number(process.env.STARTBOX_CODEGEN_TIMEOUT_MS ?? 300000);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const stream = client.messages.stream({
      model: modelId,
      max_tokens: 24000,
      temperature: 0.7,
      system: [
        {
          type: "text" as const,
          text: systemPrompt,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
      tools: [
        {
          name: "generate_react_app",
          description:
            "Generate a complete, single-file React JSX application. Babel transpiles JSX. ZERO emoji.",
          input_schema: codeGenToolSchema,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      tool_choice: { type: "tool", name: "generate_react_app" },
    }, { signal: controller.signal });

    const detectedComponents = new Set<string>();
    const componentPattern = /function\s+([A-Z][A-Za-z0-9]+)\s*[\(\{]/g;
    const constComponentPattern = /const\s+([A-Z][A-Za-z0-9]+)\s*=\s*(?:\(|function)/g;

    const charMilestones: Array<{ threshold: number; message: string; fired: boolean }> = [
      { threshold: 200, message: "Setting up the application core...", fired: false },
      { threshold: 1500, message: "Building the component library...", fired: false },
      { threshold: 4000, message: "Adding interactive features...", fired: false },
      { threshold: 7000, message: "Implementing data management...", fired: false },
      { threshold: 10000, message: "Polishing the interface...", fired: false },
      { threshold: 13000, message: "Finalizing the application...", fired: false },
    ];

    const patternMilestones: Array<{ pattern: RegExp; message: string; fired: boolean }> = [
      { pattern: /useState/, message: "Configuring state management...", fired: false },
      { pattern: /LucideReact/, message: "Loading icon library...", fired: false },
      { pattern: /__sbAI/, message: "Connecting AI capabilities...", fired: false },
      { pattern: /useEffect/, message: "Adding lifecycle behavior...", fired: false },
      { pattern: /localStorage|useStore/, message: "Setting up data persistence...", fired: false },
      { pattern: /animation|animate|keyframes/i, message: "Adding smooth animations...", fired: false },
    ];

    stream.on('inputJson', (_delta: string, snapshot: unknown) => {
      if (!onProgress) return;
      const snap = snapshot as Record<string, unknown>;
      const code = typeof snap?.generated_code === 'string' ? snap.generated_code : '';
      if (!code) return;

      for (const m of charMilestones) {
        if (!m.fired && code.length >= m.threshold) {
          m.fired = true;
          onProgress({ type: 'writing', message: m.message, data: { milestone: true } });
        }
      }

      for (const m of patternMilestones) {
        if (!m.fired && m.pattern.test(code)) {
          m.fired = true;
          onProgress({ type: 'writing', message: m.message, data: { milestone: true } });
        }
      }

      componentPattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = componentPattern.exec(code)) !== null) {
        const name = match[1];
        if (!detectedComponents.has(name)) {
          detectedComponents.add(name);
          const path = classifyComponent(name);
          onProgress({ type: 'writing', message: `Wrote ${path}`, data: { component: name, path } });
        }
      }

      constComponentPattern.lastIndex = 0;
      while ((match = constComponentPattern.exec(code)) !== null) {
        const name = match[1];
        if (!detectedComponents.has(name)) {
          detectedComponents.add(name);
          const path = classifyComponent(name);
          onProgress({ type: 'writing', message: `Wrote ${path}`, data: { component: name, path } });
        }
      }
    });

    const response = await stream.finalMessage();

    if (onProgress && detectedComponents.size > 0) {
      onProgress({ type: 'created', message: 'Created', data: { components: Array.from(detectedComponents) } });
    }
    clearTimeout(timeoutHandle);

    const usage = response.usage as unknown as Record<string, number>;
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheCreate = usage.cache_creation_input_tokens ?? 0;
    const uncached = usage.input_tokens - cacheRead - cacheCreate;
    const cost = ((uncached * 3 + cacheCreate * 3.75 + cacheRead * 0.30 + usage.output_tokens * 15) / 1_000_000);
    console.log(`Code gen tokens — input: ${usage.input_tokens} (cached: ${cacheRead}, wrote: ${cacheCreate}), output: ${usage.output_tokens} (est cost: $${cost.toFixed(3)})`);
    recordSpend(cost);

    if (response.stop_reason === "max_tokens") {
      console.warn("Code generation hit max_tokens limit — output may be truncated");
      onProgress?.({ type: 'status', message: 'Output was truncated, extracting code...' });
    }

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      console.error("No tool_use block in response. stop_reason:", response.stop_reason, "content types:", response.content.map(b => b.type));
      onProgress?.({ type: 'status', message: 'Retrying code extraction...' });
      return null;
    }

    const raw = toolUse.input as CodeGenerationResult;
    const { code: repairedCode, repairs } = repairGeneratedCode(raw.generated_code ?? "");
    if (repairs.length > 0) {
      console.log(`Code repairs: ${repairs.join('; ')}`);
    }

    if (!repairedCode) {
      console.error("Code generation produced empty code after repair. Raw length:", (raw.generated_code ?? "").length);
      return null;
    }
    return { ...raw, generated_code: repairedCode };
  } catch (e) {
    clearTimeout(timeoutHandle);
    if (controller.signal.aborted) {
      throw new Error(`Code generation timed out after ${timeoutMs}ms`);
    }
    throw e;
  }
}

/* ------------------------------------------------------------------ */
/*  Main entry — generation with quality gate retry                    */
/* ------------------------------------------------------------------ */

export async function generateReactCode(
  intent: ReasonedIntent,
  originalPrompt: string,
  model: "sonnet" | "opus" = "sonnet",
  onProgress?: ProgressCallback,
  contextBrief?: import("./contextResearch.js").AppContextBrief | null,
): Promise<CodeGenerationResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey, maxRetries: 0 });

  const modelId =
    model === "opus" ? "claude-opus-4-6" : "claude-sonnet-4-6";

  const systemPrompt = buildCodeGenSystemPrompt(intent);

  const composition = intent.layout_composition;
  const tabList = intent.nav_items.map(t =>
    `  ${t.id}: "${t.label}" (icon: ${t.icon}, content: ${t.content_type}) — ${t.purpose}`
  ).join("\n");

  const featureDetails = (intent.feature_details ?? []).map(f =>
    `  - ${f.name}: ${f.description}`
  ).join("\n");

  const contextSection = contextBrief ? [
    ``,
    `DOMAIN CONTEXT (from competitive research):`,
    `Competitors: ${contextBrief.competitive_landscape.map(c => c.name).join(', ')}`,
    `Target user: ${contextBrief.target_persona?.role ?? 'general user'}`,
    `Must-have features: ${contextBrief.must_have_features.join(', ')}`,
    `Field labels: ${JSON.stringify(contextBrief.domain_terminology?.field_labels ?? {})}`,
    `CTA verbs: ${contextBrief.domain_terminology?.cta_verbs?.join(', ') ?? ''}`,
    `UI patterns: ${contextBrief.ui_component_suggestions?.join(', ') ?? ''}`,
  ].join("\n") : '';

  const secondaryColor = intent.secondary_color;
  const visualKeywords = intent.visual_style_keywords?.join(', ') ?? '';
  const animKeywords = (intent as Record<string, unknown>).animation_keywords as string[] | undefined;

  const baseUserMessage = [
    `Build: "${originalPrompt}"`,
    `App: ${intent.app_name_hint} | Primary: ${intent.primary_color}${secondaryColor ? ` | Secondary: ${secondaryColor}` : ''} | Icon: ${intent.app_icon}`,
    `Domain: ${intent.domain} | Goal: ${intent.primary_goal}`,
    ``,
    `LAYOUT COMPOSITION:`,
    `  Page Structure: ${composition.page_structure}`,
    `  Navigation: ${composition.navigation_type}`,
    `  Hero Style: ${composition.hero_style}`,
    `  Content Pattern: ${composition.content_pattern}`,
    `Visual Mood: ${intent.visual_mood} | Style: ${visualKeywords}${animKeywords?.length ? ` | Animation: ${animKeywords.join(', ')}` : ''}`,
    `Typography: ${intent.typography_style} | Density: ${intent.content_density}`,
    `Signature Component: ${intent.signature_component}`,
    ``,
    `TABS (use these exact IDs for page state):`,
    tabList,
    `Default tab: "${intent.nav_items[0]?.id ?? 'main'}"`,
    ``,
    `FEATURES:`,
    featureDetails || `  - ${intent.premium_features?.join("\n  - ") ?? "standard"}`,
    ``,
    `Output format: ${intent.output_format_hint}`,
    contextSection,
    ``,
    `CRITICAL:`,
    `1. Write JSX. Babel transpiles. No imports, no h().`,
    `2. Follow the LAYOUT COMPOSITION exactly. page_structure=${composition.page_structure}, navigation=${composition.navigation_type}.`,
    `3. Tab 1 = WORKING PRODUCT with demo data. No marketing pages. No "How It Works".`,
    `4. Domain-specific labels and values for "${intent.domain}". Zero generic text.`,
    `5. Show completed demo results on first render.`,
    `6. Build the SIGNATURE COMPONENT: ${intent.signature_component} — make it prominent on Tab 1.`,
    `7. Each tab uses a DIFFERENT layout arrangement.`,
  ].join("\n");

  function buildResult(
    candidate: CodeGenerationResult,
    evaluation: { quality_score: number; quality_breakdown: QualityBreakdown },
    repaired: boolean,
  ): CodeGenerationResult {
    const pipelineArtifact: PipelineRunArtifact = {
      run_id: randomUUID(),
      stages: ["Research & Planning", "Code Generation", "Quality Scoring", "Finalize"],
      selected_candidate: "A",
      candidates: [{
        id: "A",
        quality_score: evaluation.quality_score,
        quality_breakdown: evaluation.quality_breakdown,
      }],
      repaired,
    };
    return {
      ...candidate,
      quality_score: evaluation.quality_score,
      quality_breakdown: evaluation.quality_breakdown,
      pipeline_artifact: pipelineArtifact,
    };
  }

  try {
    // ATTEMPT 1
    const candidate = await runToolCodeGeneration(client, modelId, systemPrompt, baseUserMessage, onProgress);
    if (!candidate) {
      console.error("Code generation returned null — no usable output from API");
      onProgress?.({ type: 'status', message: 'Code generation failed — retrying is recommended' });
      return null;
    }

    onProgress?.({ type: 'status', message: 'Evaluating code quality...' });

    const evaluation = scoreGeneratedCode({
      code: candidate.generated_code,
      prompt: originalPrompt,
      outputFormat: intent.output_format_hint,
      requestedLayout: composition.page_structure,
      requestedNavType: composition.navigation_type,
      requestedMood: intent.visual_mood,
    });

    // Quality gate — retry once if below threshold
    if (evaluation.quality_score < QUALITY_GATE_SCORE) {
      console.log(`Quality score ${evaluation.quality_score} < ${QUALITY_GATE_SCORE} — attempting retry`);
      onProgress?.({ type: 'status', message: `Polishing output (score: ${evaluation.quality_score})...` });

      const feedback = generateRetryFeedback(
        evaluation.quality_breakdown,
        candidate.generated_code,
        composition.page_structure,
        composition.navigation_type,
      );
      const usesH = /const\s+h\s*=\s*React\.createElement/.test(candidate.generated_code);

      const retryMessage = [
        baseUserMessage,
        '',
        '--- QUALITY FEEDBACK (previous attempt scored ' + evaluation.quality_score + '/100) ---',
        feedback,
        usesH ? 'CRITICAL: Write JSX, NOT h()/React.createElement. Babel handles transpilation.' : '',
        '--- Generate an improved version addressing the issues above. ---',
      ].join('\n');

      const retryCandidate = await runToolCodeGeneration(client, modelId, systemPrompt, retryMessage, onProgress);

      if (retryCandidate) {
        const retryEval = scoreGeneratedCode({
          code: retryCandidate.generated_code,
          prompt: originalPrompt,
          outputFormat: intent.output_format_hint,
          requestedLayout: composition.page_structure,
          requestedNavType: composition.navigation_type,
          requestedMood: intent.visual_mood,
        });

        console.log(`Retry score: ${retryEval.quality_score} (original: ${evaluation.quality_score})`);

        if (retryEval.quality_score > evaluation.quality_score) {
          const result = buildResult(retryCandidate, retryEval, true);
          console.log(`Code generation success (retried): ${result.app_name}, ${result.generated_code.length} chars, score ${result.quality_score}`);
          return result;
        }
      }
    }

    // Use original (or if retry was worse)
    const result = buildResult(candidate, evaluation, false);
    console.log(`Code generation success: ${result.app_name}, ${result.generated_code.length} chars, score ${result.quality_score}`);
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Code generation failed:", msg);
    onProgress?.({ type: 'status', message: `Code generation error: ${msg.slice(0, 100)}` });
    return null;
  }
}
