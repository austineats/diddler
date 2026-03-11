import { useState, useRef, useEffect } from 'react';
import {
  Send, Menu, X, Check,
  ChevronDown, ArrowRight,
} from 'lucide-react';
import { TextMarquee } from '@/components/ui/text-marquee';

/* ─── Data ─── */

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const MARQUEE_APPS = [
  'a CRM dashboard',
  'a habit tracker',
  'a recipe organizer',
  'a booking system',
  'a portfolio site',
  'an expense tracker',
  'a project board',
  'a fitness log',
];

const QUICK_PROMPTS = [
  'A reporting dashboard for sales teams',
  'A portfolio site for a photographer',
  'An internal tool for managing inventory',
  'A booking page for a barber shop',
];

const FEATURES = [
  {
    title: 'Describe it, get it',
    description: 'Write what your app should do in plain English. You get a working app — not a wireframe, not a mockup.',
  },
  {
    title: 'Auth, data, and hosting built in',
    description: 'User accounts, a database, and a live URL. No config files, no deployment steps.',
  },
  {
    title: 'Ship in minutes',
    description: 'Go from idea to a shareable link faster than it takes to set up a new repo.',
  },
  {
    title: 'Any AI model, one interface',
    description: 'We pick the best model for each step. You just describe what you want.',
  },
];

const PRICING = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Build and ship for free.',
    features: ['5 apps', 'Built-in auth & database', 'Community support', 'startbox.app subdomain'],
    cta: 'Start building',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$20',
    period: '/mo',
    description: 'For teams that ship often.',
    features: ['Unlimited apps', 'Custom domains', 'Priority support', 'Analytics dashboard', 'API access'],
    cta: 'Start free trial',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For orgs with compliance needs.',
    features: ['Everything in Pro', 'SSO & SAML', 'SLA guarantee', 'Dedicated support', 'On-prem option'],
    cta: 'Talk to us',
    highlighted: false,
  },
];

const FAQ_DATA = [
  {
    question: 'What can I build with StartBox?',
    answer: 'Dashboards, internal tools, customer portals, landing pages, booking sites — anything you can describe. Each app gets auth, a database, and hosting out of the box.',
  },
  {
    question: 'How does the AI actually work?',
    answer: 'You describe your app in plain English. Our pipeline breaks it into design, content, and code steps, then generates a complete React app with real components and working logic.',
  },
  {
    question: 'Do I own the code?',
    answer: 'Yes. You can export the full source code and host it anywhere.',
  },
  {
    question: 'Is my data secure?',
    answer: 'All data is encrypted in transit and at rest. We run SOC 2 compliant infrastructure with regular security audits.',
  },
  {
    question: 'Can I connect external services?',
    answer: 'Yes — Stripe, Supabase, Firebase, and more. We add new integrations based on what users ask for.',
  },
];

/* ─── Navigation ─── */

function Navigation({ onStartBuilding }: { onStartBuilding: () => void }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-colors duration-150"
      style={{
        background: isScrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(12px)' : 'none',
        borderBottom: isScrolled ? '1px solid #e5e7eb' : '1px solid transparent',
      }}
    >
      <nav className="max-w-5xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          <a href="#" className="text-[15px] font-semibold text-neutral-900 tracking-tight no-underline">
            StartBox
          </a>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                className="text-[13px] text-neutral-500 hover:text-neutral-900 transition-colors duration-150 no-underline"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button className="text-[13px] text-neutral-500 hover:text-neutral-900 transition-colors duration-150">
              Log in
            </button>
            <button
              onClick={onStartBuilding}
              className="text-[13px] font-medium text-white bg-neutral-900 hover:bg-neutral-700 px-4 py-1.5 rounded-md transition-colors duration-150"
            >
              Start building
            </button>
          </div>

          <button
            className="md:hidden p-1.5 text-neutral-500 hover:text-neutral-900 transition-colors duration-150"
            onClick={() => setIsMobileMenuOpen(v => !v)}
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-neutral-200">
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  className="px-3 py-2 text-[13px] text-neutral-500 hover:text-neutral-900 transition-colors duration-150 no-underline"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 mt-2 border-t border-neutral-200 flex flex-col gap-2">
                <button className="text-[13px] text-neutral-500 px-3 py-2 text-left">Log in</button>
                <button
                  onClick={onStartBuilding}
                  className="text-[13px] font-medium text-white bg-neutral-900 px-3 py-2 rounded-md text-center"
                >
                  Start building
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

/* ─── Hero ─── */

function HeroSection({
  prompt,
  onPromptChange,
  onGenerate,
}: {
  prompt: string;
  onPromptChange: (v: string) => void;
  onGenerate: (e: React.FormEvent) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleChipClick(chip: string) {
    onPromptChange(chip);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onGenerate(e as unknown as React.FormEvent);
    }
  }

  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl mx-auto text-center">
        <div className="flex items-baseline justify-center">
          <TextMarquee
            prefix={
              <span className="text-4xl sm:text-5xl font-semibold text-neutral-900 tracking-tight leading-[1.1]">
                Make me
              </span>
            }
            speed={2.5}
            className="text-4xl sm:text-5xl font-semibold text-neutral-400 tracking-tight leading-[1.1]"
          >
            {MARQUEE_APPS.map(app => (
              <span key={app}>{app}</span>
            ))}
          </TextMarquee>
        </div>

        <p className="mt-6 text-[15px] text-neutral-500 max-w-md mx-auto leading-relaxed">
          Tell us what you need in plain English. Get a working app with auth,
          a database, and hosting — ready to share.
        </p>

        <form onSubmit={onGenerate} className="mt-10 relative">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={e => onPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            rows={3}
            className="w-full p-4 pr-14 resize-none rounded-lg text-[15px] text-neutral-900 placeholder:text-neutral-400 bg-white focus:outline-none transition-colors duration-150"
            style={{
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
          />
          <button
            type="submit"
            className="absolute bottom-3 right-3 w-9 h-9 rounded-md flex items-center justify-center transition-all duration-150"
            style={{
              background: prompt.trim() ? '#171717' : '#f5f5f5',
              color: prompt.trim() ? '#fff' : '#d4d4d4',
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {QUICK_PROMPTS.map(chip => (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              className="px-3 py-1.5 text-[12px] text-neutral-500 hover:text-neutral-900 bg-white hover:bg-neutral-50 rounded-md transition-colors duration-150"
              style={{ border: '1px solid #e5e7eb' }}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Features ─── */

function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-900 tracking-tight">
          How it works
        </h2>
        <p className="mt-2 text-[15px] text-neutral-500">
          Four steps between your idea and a live app.
        </p>

        <div
          className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-px rounded-lg overflow-hidden"
          style={{ background: '#e5e7eb' }}
        >
          {FEATURES.map((feature, i) => (
            <div
              key={feature.title}
              className="p-8 bg-white"
            >
              <span className="text-[12px] font-medium text-neutral-400 tracking-wider uppercase">
                0{i + 1}
              </span>
              <h3 className="mt-3 text-[15px] font-medium text-neutral-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-[14px] text-neutral-500 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ─── */

function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-900 tracking-tight">
          Pricing
        </h2>
        <p className="mt-2 text-[15px] text-neutral-500">
          Start free. Upgrade when you need to.
        </p>

        <div
          className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-px rounded-lg overflow-hidden"
          style={{ background: '#e5e7eb' }}
        >
          {PRICING.map(plan => (
            <div
              key={plan.name}
              className="p-8 flex flex-col"
              style={{
                background: plan.highlighted ? '#fafafa' : '#fff',
              }}
            >
              <div>
                <h3 className="text-[14px] font-medium text-neutral-900">{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-neutral-900 tracking-tight">{plan.price}</span>
                  {plan.period && <span className="text-[13px] text-neutral-400">{plan.period}</span>}
                </div>
                <p className="mt-2 text-[13px] text-neutral-500">{plan.description}</p>
              </div>

              <button
                className="mt-6 w-full py-2 rounded-md text-[13px] font-medium transition-colors duration-150"
                style={plan.highlighted
                  ? { background: '#171717', color: '#fff' }
                  : { background: '#fff', border: '1px solid #e5e7eb', color: '#171717' }
                }
              >
                {plan.cta}
              </button>

              <ul className="mt-8 space-y-3 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                    <span className="text-[13px] text-neutral-500">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ ─── */

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 px-6">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-900 tracking-tight">
          Questions
        </h2>

        <div className="mt-10">
          {FAQ_DATA.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                style={{ borderBottom: '1px solid #e5e7eb' }}
              >
                <button
                  className="w-full flex items-center justify-between py-5 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                >
                  <span className="text-[14px] font-medium text-neutral-900 pr-4">{faq.question}</span>
                  <ChevronDown
                    className="w-4 h-4 text-neutral-400 flex-shrink-0 transition-transform duration-150"
                    style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }}
                  />
                </button>
                <div
                  className="overflow-hidden transition-all duration-150"
                  style={{ maxHeight: isOpen ? '200px' : '0' }}
                >
                  <p className="pb-5 text-[14px] text-neutral-500 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA ─── */

function CTABanner({ onStartBuilding }: { onStartBuilding: () => void }) {
  return (
    <section className="py-24 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold text-neutral-900 tracking-tight">
          Ready to build?
        </h2>
        <p className="mt-3 text-[15px] text-neutral-500">
          Go from idea to live app in minutes. No credit card required.
        </p>
        <button
          onClick={onStartBuilding}
          className="mt-8 inline-flex items-center gap-2 text-[14px] font-medium text-white bg-neutral-900 hover:bg-neutral-700 px-6 py-2.5 rounded-md transition-colors duration-150"
        >
          Start building
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
}

/* ─── Footer ─── */

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid #e5e7eb' }}>
      <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="text-[12px] text-neutral-400">&copy; 2025 StartBox</span>
        <div className="flex items-center gap-6">
          <a href="#" className="text-[12px] text-neutral-400 hover:text-neutral-900 transition-colors duration-150 no-underline">Privacy</a>
          <a href="#" className="text-[12px] text-neutral-400 hover:text-neutral-900 transition-colors duration-150 no-underline">Terms</a>
          <a href="#" className="text-[12px] text-neutral-400 hover:text-neutral-900 transition-colors duration-150 no-underline">Twitter</a>
          <a href="#" className="text-[12px] text-neutral-400 hover:text-neutral-900 transition-colors duration-150 no-underline">GitHub</a>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main ─── */

interface StudioLandingViewProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: (e: React.FormEvent) => void;
  onStartBuilding: () => void;
  selectedModel: 'sonnet' | 'opus';
  onModelChange: (model: 'sonnet' | 'opus') => void;
  isWorking: boolean;
}

export function StudioLandingView({
  prompt,
  onPromptChange,
  onGenerate,
  onStartBuilding,
}: StudioLandingViewProps) {
  return (
    <div className="min-h-screen" style={{ background: '#fafafa' }}>
      <Navigation onStartBuilding={onStartBuilding} />
      <HeroSection prompt={prompt} onPromptChange={onPromptChange} onGenerate={onGenerate} />
      <FeaturesSection />
      <PricingSection />
      <FAQSection />
      <CTABanner onStartBuilding={onStartBuilding} />
      <Footer />
    </div>
  );
}
