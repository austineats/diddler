import { useState, useRef, useEffect } from 'react';
import {
  Sparkles, Zap, Database, Rocket, Cpu,
  Plus, Mic, Send, Menu, X, Check,
  ChevronDown, ArrowRight,
  Twitter, Github, MessageCircle, Linkedin,
} from 'lucide-react';

/* ─── Data Arrays (exact KIMI v3) ─── */

const NAV_LINKS = [
  { label: 'Product', href: '#features' },
  { label: 'Use Cases', href: '#pricing' },
  { label: 'Resources', href: '#faq' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Enterprise', href: '#cta' },
];

const QUICK_PROMPTS = [
  'Reporting Dashboard',
  'Gaming Platform',
  'Onboarding Portal',
  'Room Visualizer',
  'Networking App',
];

const FEATURES = [
  { icon: Zap, title: 'Create at the speed of thought', description: 'Tell us your idea, and watch it transform into a working app with all the building blocks already in place.', color: 'from-yellow-400 to-orange-500' },
  { icon: Database, title: 'A backend that builds with you', description: 'User logins, authentication, data storage, and role-based permissions are generated behind the scenes.', color: 'from-blue-400 to-indigo-500' },
  { icon: Rocket, title: 'Ready to use, instantly', description: 'Built-in hosting, analytics, and custom domains so when your app is ready, just press publish.', color: 'from-pink-400 to-rose-500' },
  { icon: Cpu, title: 'One platform. Any model.', description: 'Access to the latest AI models. We automatically select the best model for your project.', color: 'from-green-400 to-emerald-500' },
];

const PRICING = [
  { name: 'Free', price: '$0', period: '/month', description: 'Perfect for getting started', features: ['All core features', 'Built-in integrations', 'Authentication system', 'Database functionality', 'Community support'], cta: 'Start for free', highlighted: false },
  { name: 'Pro', price: '$20', period: '/month', description: 'For growing projects', features: ['Everything in Free', 'Unlimited projects', 'Priority support', 'Custom domains', 'Advanced analytics', 'API access'], cta: 'Start Pro trial', highlighted: true, badge: 'Most Popular' },
  { name: 'Enterprise', price: 'Custom', period: '', description: 'For large organizations', features: ['Everything in Pro', 'Dedicated support', 'SLA guarantee', 'Custom integrations', 'On-premise option', 'Security audit'], cta: 'Contact sales', highlighted: false },
];

const FAQ_DATA = [
  { question: 'What kind of apps can I build?', answer: 'You can build a wide variety of applications including dashboards, customer portals, internal tools, landing pages, e-commerce sites, and more. Our AI understands your requirements and generates fully functional applications.' },
  { question: 'How does the AI development process work?', answer: 'Simply describe what you want to build in natural language. Our AI understands your requirements and generates a fully functional application with proper structure, styling, and logic. You can iterate and refine until it\'s perfect.' },
  { question: 'Is my data secure?', answer: 'Yes, we take security seriously. All data is encrypted in transit and at rest. We use industry-standard security practices, regular security audits, and comply with SOC 2 and GDPR requirements.' },
  { question: 'Do I own the applications I create?', answer: 'Absolutely. You have full ownership of all applications built on our platform. You can export your code and host it anywhere you choose.' },
  { question: 'What integrations are supported?', answer: 'We support integrations with popular services like Stripe, Supabase, Firebase, Auth0, and many more. New integrations are added regularly based on user feedback.' },
];

const FOOTER_LINKS = {
  product: { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'Integrations', href: '#' }, { label: 'Enterprise', href: '#cta' }, { label: 'Pricing', href: '#pricing' }, { label: 'Changelog', href: '#' }] },
  resources: { title: 'Resources', links: [{ label: 'Documentation', href: '#' }, { label: 'Community', href: '#' }, { label: 'Blog', href: '#' }, { label: 'Tutorials', href: '#' }, { label: 'Support', href: '#' }] },
  legal: { title: 'Legal', links: [{ label: 'Privacy Policy', href: '#' }, { label: 'Terms of Service', href: '#' }, { label: 'Security', href: '#' }, { label: 'Cookie Settings', href: '#' }] },
};

const SOCIAL_LINKS = [
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Github, href: '#', label: 'GitHub' },
  { icon: MessageCircle, href: '#', label: 'Discord' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
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
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/80 backdrop-blur-md shadow-sm' : 'bg-transparent'}`}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 group no-underline">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">StartBox</span>
          </a>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <a key={link.label} href={link.href} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-100/50 transition-colors relative group no-underline">
                {link.label}
                <span className="absolute bottom-1 left-4 right-4 h-0.5 bg-gray-900 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
              </a>
            ))}
          </div>

          {/* Desktop buttons */}
          <div className="hidden md:flex items-center gap-3">
            <button className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2 rounded-md transition-colors">Log in</button>
            <button onClick={onStartBuilding} className="text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 rounded-full px-5 py-2 transition-all duration-200 hover:scale-[1.02]">Start Building</button>
          </div>

          {/* Mobile menu toggle */}
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setIsMobileMenuOpen(v => !v)}>
            {isMobileMenuOpen ? <X className="w-6 h-6 text-gray-700" /> : <Menu className="w-6 h-6 text-gray-700" />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100 animate-in slide-in-from-top-2">
            <div className="flex flex-col gap-2">
              {NAV_LINKS.map(link => (
                <a key={link.label} href={link.href} className="px-4 py-3 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors no-underline">{link.label}</a>
              ))}
              <div className="pt-4 mt-2 border-t border-gray-100 flex flex-col gap-2">
                <button className="text-sm font-medium text-gray-700 px-4 py-2 text-left">Log in</button>
                <button onClick={onStartBuilding} className="text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 rounded-full px-4 py-2">Start Building</button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

/* ─── Hero Section ─── */

function HeroSection({ prompt, onPromptChange, onGenerate }: { prompt: string; onPromptChange: (v: string) => void; onGenerate: (e: React.FormEvent) => void }) {
  const [isFocused, setIsFocused] = useState(false);
  const [visibleChips, setVisibleChips] = useState<number[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    QUICK_PROMPTS.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleChips(prev => [...prev, i]), 800 + i * 100));
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  function handleChipClick(chip: string) {
    onPromptChange(`Build me a ${chip.toLowerCase()} for...`);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onGenerate(e as unknown as React.FormEvent);
    }
  }

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: 'url(/hero-gradient.jpg)' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-white/50" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center pt-20">
        <h1
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-8 fill-mode-forwards"
          style={{ animationDelay: '200ms', animationDuration: '700ms' }}
        >
          Build something <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">amazing</span>
        </h1>

        <p
          className="mt-6 text-lg sm:text-xl text-gray-700 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-6 fill-mode-forwards"
          style={{ animationDelay: '400ms', animationDuration: '600ms' }}
        >
          Create apps and websites by chatting with AI. No coding necessary.
        </p>

        {/* Textarea card */}
        <div
          className="mt-10 max-w-2xl mx-auto animate-in fade-in zoom-in-95 fill-mode-forwards"
          style={{ animationDelay: '600ms', animationDuration: '600ms' }}
        >
          <form onSubmit={onGenerate} className={`relative bg-white rounded-2xl shadow-xl transition-all duration-300 ${isFocused ? 'shadow-2xl ring-2 ring-indigo-500/20' : ''}`}>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => onPromptChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask AI to create a landing page for..."
              rows={3}
              className="w-full min-h-[120px] p-5 pr-14 pb-16 resize-none bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none rounded-2xl text-base"
            />

            {/* Bottom-left action buttons */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <button type="button" className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                <Plus className="w-5 h-5" />
              </button>
              <button type="button" className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                <Mic className="w-5 h-5" />
              </button>
            </div>

            {/* Send button */}
            <button
              type="submit"
              className={`absolute bottom-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${prompt.trim() ? 'bg-gray-900 text-white hover:bg-gray-800 hover:scale-105' : 'bg-gray-200 text-gray-400'}`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Suggestion chips */}
        <div className="mt-8">
          <p className="text-sm text-gray-600 mb-4">Not sure where to start? Try one of these:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {QUICK_PROMPTS.map((chip, i) => (
              <button
                key={chip}
                onClick={() => handleChipClick(chip)}
                className={`px-4 py-2 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-white hover:border-gray-300 hover:scale-105 transition-all duration-300 ${visibleChips.includes(i) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Trusted by */}
        <div
          className="mt-12 flex items-center justify-center gap-2 text-sm text-gray-600 animate-in fade-in fill-mode-forwards"
          style={{ animationDelay: '1200ms', animationDuration: '500ms' }}
        >
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span>Trusted by 10,000+ creators worldwide</span>
        </div>
      </div>
    </section>
  );
}

/* ─── Features Section ─── */

function FeaturesSection() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="features" className="py-24 bg-white" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">Everything you need to build</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">From idea to production in minutes, not months</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`group relative p-8 rounded-2xl border border-gray-100 bg-white hover:shadow-xl transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing Section ─── */

function PricingSection() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="pricing" className="py-24 bg-slate-50" ref={ref}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">Pricing plans for every need</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">Scale as you go with plans designed to match your growth</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto">
          {PRICING.map((plan, i) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'} ${plan.highlighted ? 'bg-white border-2 border-indigo-500 shadow-xl scale-105 md:scale-110 z-10' : 'bg-white border border-gray-200 hover:shadow-lg'}`}
              style={{ transitionDelay: `${i * 150}ms` }}
            >
              {plan.highlighted && plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium rounded-full">
                    <Sparkles className="w-4 h-4" />
                    {plan.badge}
                  </span>
                </div>
              )}
              <div className="p-8">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  {plan.period && <span className="ml-1 text-gray-500">{plan.period}</span>}
                </div>
                <p className="mt-2 text-sm text-gray-600">{plan.description}</p>
                <button className={`w-full mt-6 rounded-full py-2.5 text-sm font-medium transition-all duration-200 hover:scale-[1.02] ${plan.highlighted ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
                  {plan.cta}
                </button>
                <ul className="mt-8 space-y-4">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-600">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── FAQ Section ─── */

function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="faq" className="py-24 bg-white" ref={ref}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`text-center mb-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight">Frequently asked questions</h2>
        </div>
        <div className="space-y-4">
          {FAQ_DATA.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={i}
                className={`border border-gray-200 rounded-xl overflow-hidden transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${isOpen ? 'bg-gray-50' : 'bg-white hover:bg-gray-50'}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <button
                  className="w-full flex items-center justify-between p-5 text-left"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                >
                  <span className="text-base font-medium text-gray-900 pr-4">{faq.question}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                  <div className="px-5 pb-5">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─── CTA Banner ─── */

function CTABanner({ onStartBuilding }: { onStartBuilding: () => void }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="cta" className="py-24 relative overflow-hidden" ref={ref}>
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
      <div className="absolute top-0 left-1/4 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-pink-400/20 rounded-full blur-3xl" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className={`text-center transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-8">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">Ready to start building?</h2>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">Join thousands of creators turning their ideas into reality. Start building for free today.</p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={onStartBuilding} className="inline-flex items-center bg-gray-900 text-white hover:bg-gray-800 rounded-full px-8 py-3 text-base font-medium transition-all duration-200 hover:scale-[1.02] group">
              Get started for free
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <a href="#pricing" className="inline-flex items-center rounded-full px-8 py-3 text-base font-medium border border-gray-300 hover:bg-gray-50 transition-all duration-200 text-gray-900 no-underline">
              View pricing
            </a>
          </div>
          <p className="mt-8 text-sm text-gray-500">No credit card required. Free forever plan available.</p>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ─── */

function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-4 lg:col-span-2">
            <a href="#" className="flex items-center gap-2 group no-underline">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">StartBox</span>
            </a>
            <p className="mt-4 text-gray-600 max-w-sm leading-relaxed">
              The AI-powered platform that lets you build fully functioning apps in minutes. Turn your words into reality.
            </p>
            <div className="mt-6 flex items-center gap-4">
              {SOCIAL_LINKS.map(social => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    aria-label={social.label}
                    className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 hover:text-gray-900 hover:scale-110 transition-all duration-200 no-underline"
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          {Object.values(FOOTER_LINKS).map(column => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">{column.title}</h3>
              <ul className="mt-4 space-y-3">
                {column.links.map(link => (
                  <li key={link.label}>
                    <a href={link.href} className="text-gray-600 hover:text-gray-900 transition-colors relative group no-underline">
                      {link.label}
                      <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-gray-900 group-hover:w-full transition-all duration-300" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-500">&copy; 2025 StartBox. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors no-underline">Privacy</a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors no-underline">Terms</a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors no-underline">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─── Main Landing View ─── */

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
    <div className="min-h-screen bg-white">
      <Navigation onStartBuilding={onStartBuilding} />
      <HeroSection prompt={prompt} onPromptChange={onPromptChange} onGenerate={onGenerate} />
      <FeaturesSection />
      <PricingSection />
      <FAQSection />
      <CTABanner onStartBuilding={onStartBuilding} />
      <Footer />

      {/* Floating "Open Builder" button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={onStartBuilding}
          className="inline-flex items-center bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl hover:shadow-2xl transition-all hover:scale-105 rounded-full px-6 py-3 text-sm font-medium"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Open Builder
        </button>
      </div>
    </div>
  );
}
