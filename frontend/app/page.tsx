import Link from "next/link";
import Image from "next/image";
import { HorizontalMarquee } from "@/components/ui/marquee";
import { AnimatedStatsSection } from "@/components/ui/animated-stats";
import { ScrollNavbar, Reveal } from "@/components/ui/scroll-effects";
import { GlassButton } from "@/components/ui/glass-button";
import FUITestimonialWithSlide from "@/components/ui/sliding-testimonial";
import { Features } from "@/components/ui/features-7";
import ScrollCTA from "@/components/ui/scroll-cta";

// ─── Icon components ────────────────────────────────────────────────────────
function IconLogo({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="2" y="9" width="1.5" height="6" rx="0.5" />
      <rect x="5" y="6" width="1.5" height="12" rx="0.5" />
      <rect x="8" y="3" width="1.5" height="18" rx="0.5" />
      <rect x="11" y="5" width="1.5" height="14" rx="0.5" />
      <rect x="14" y="2" width="1.5" height="20" rx="0.5" />
      <rect x="17" y="7" width="1.5" height="10" rx="0.5" />
      <rect x="20" y="10" width="1.5" height="4" rx="0.5" />
    </svg>
  );
}

function IconArrowUpRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function IconMic() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function IconBrain() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}


function FeatureCard({
  icon, label, title, description, points,
}: {
  icon: React.ReactNode; label: string; title: string; description: string; points: string[];
}) {
  return (
    <div className="group flex flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-all duration-300 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-500/6 hover:-translate-y-1">
      <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
        {icon}
      </div>
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[2px] text-indigo-400">{label}</p>
        <h3 className="text-[22px] font-bold leading-tight tracking-tight text-slate-900">{title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-500">{description}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {points.map((p) => (
          <li key={p} className="flex items-center gap-2.5 text-[13px] text-slate-600">
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
              <IconCheck />
            </span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepCard({ num, title, desc }: { num: string; title: string; desc: string }) {
  return (
    <div className="flex gap-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[13px] font-black text-white">
        {num}
      </div>
      <div className="flex-1 pb-8 border-b border-slate-100 last:border-0">
        <h4 className="text-[17px] font-bold text-slate-900">{title}</h4>
        <p className="mt-1 text-[14px] leading-relaxed text-slate-500">{desc}</p>
      </div>
    </div>
  );
}


// ─── Page ──────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="flex min-h-full flex-col bg-white" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── NAVBAR (Adaptive Flat to Pill) ── */}
      <ScrollNavbar>
        {/* Logo */}
        <div className="flex items-center gap-2.5 pl-2">
          <div className="flex items-center justify-center text-slate-900 group-[.is-scrolled]:text-white/90 transition-colors">
            <IconLogo size={22} />
          </div>
          <span className="text-[17px] font-bold tracking-tight text-slate-900 group-[.is-scrolled]:text-white group-[.is-scrolled]:font-normal transition-colors">Lumen</span>
        </div>

        {/* Nav links */}
        <div className="hidden items-center gap-7 md:flex">
          {["Products", "AI", "Solutions", "Resources", "Pricing", "Contact"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-[14px] font-medium text-slate-600 group-[.is-scrolled]:font-light group-[.is-scrolled]:text-white transition-colors hover:text-slate-900 group-[.is-scrolled]:hover:text-white/80"
            >
              {item}
            </a>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/register"
          className="cursor-pointer rounded-full border border-slate-200 group-[.is-scrolled]:border-indigo-500/40 bg-white group-[.is-scrolled]:bg-[#1E1E1E] px-6 py-2 text-[14px] font-semibold text-slate-900 group-[.is-scrolled]:font-light group-[.is-scrolled]:text-white transition-all shadow-sm group-[.is-scrolled]:shadow-none hover:bg-slate-50 group-[.is-scrolled]:hover:bg-indigo-500/10"
        >
          Sign up free
        </Link>
      </ScrollNavbar>

      {/* ── HERO (clean centered — exact Conferra style) ── */}
      <section className="relative px-6 pb-0 pt-32 md:pt-40 text-center overflow-hidden">
        {/* Dot grid background to allow glass button to refract */}
        <div className="hero-dot-grid pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-3xl">

          {/* Eyebrow tag */}
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-[13px] text-slate-600 shadow-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#7C3AED]">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M8 12h8M12 8v8"/>
            </svg>
            <span>AI Interview Simulator &mdash; Instant Feedback</span>
            <IconArrowUpRight />
          </div>

          {/* Headline */}
          <h1
            className="text-[56px] font-semibold leading-[1.08] tracking-[-1.5px] text-[#2f3137] sm:text-[64px] lg:text-[72px]"
            style={{ fontFamily: "'Manrope', 'Space Grotesk', 'Google Sans', sans-serif" }}
          >
            Practice Interviews.
            <br />
            Get Coached by AI.
          </h1>

          {/* Subtitle */}
          <p className="mx-auto mt-5 max-w-[520px] text-[16px] leading-relaxed text-slate-500">
            A concise, AI-powered platform that evaluates your voice, words, and facial expressions
            — giving you quantified coaching after every mock interview.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register">
              <GlassButton size="default" contentClassName="flex items-center gap-2.5 text-[15px]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="3" ry="3" />
                </svg>
                Start Simulation
              </GlassButton>
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-slate-200 bg-white px-6 py-3 text-[15px] font-medium text-[#111111] transition-all hover:bg-slate-50"
            >
              Learn more
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 ml-0.5">
                <line x1="7" y1="17" x2="17" y2="7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </Link>
          </div>

          {/* Micro caption */}
          <p className="mt-4 text-[12px] text-slate-400">
            No sign-up required &middot; ~5 min per session &middot; Instant AI feedback
          </p>
        </div>

        {/* ── Product screenshot — full-width with mist background ── */}
        <div className="relative z-10 mx-auto mt-14 max-w-5xl pb-0">
          {/* Mist / gradient background behind the screenshot */}
          <div
            className="absolute inset-x-0 bottom-0 top-8 rounded-3xl"
            style={{
              background: "linear-gradient(180deg, #e0e7ff 0%, #f0f4ff 35%, #eef2ff 65%, #ffffff 100%)",
            }}
          />
          {/* Screenshot card */}
          <div className="relative overflow-hidden rounded-2xl bg-slate-950">
            <video
              src="/videos/recording.mp4"
              className="w-full object-cover block"
              autoPlay
              loop
              muted
              playsInline
            />
            {/* Tall white fade-out */}
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white via-white/60 to-transparent" />
          </div>
        </div>
      </section>

      {/* Seamless bridge */}
      <div className="h-8 bg-gradient-to-b from-white to-slate-50/70" />

      {/* ── SOCIAL PROOF MARQUEE ── */}
      <section className="relative bg-slate-50/70 pb-16 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-40 bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-40 bg-gradient-to-l from-white to-transparent" />

        <p className="mb-8 text-center text-[12px] font-bold uppercase tracking-[2.5px] text-slate-400">
          Powered by state-of-the-art AI models
        </p>

        <div className="w-full">
          <HorizontalMarquee speed={25} pauseOnHover>
            {[
              { src: "/techstack-logos/openai.svg", alt: "OpenAI" },
              { src: "/techstack-logos/huggingface.svg", alt: "HuggingFace" },
              { src: "/techstack-logos/sentence-transformers.webp", alt: "Sentence Transformers" },
              { src: "/techstack-logos/ultralytics.svg", alt: "Ultralytics" },
              { src: "/techstack-logos/openai.svg", alt: "OpenAI 2" },
              { src: "/techstack-logos/huggingface.svg", alt: "HuggingFace 2" },
              { src: "/techstack-logos/sentence-transformers.webp", alt: "Sentence Transformers 2" },
              { src: "/techstack-logos/ultralytics.svg", alt: "Ultralytics 2" },
            ].map((logo, idx) => (
              <div key={idx} className="mx-12 flex items-center justify-center">
                <div className="relative h-10 w-32 md:h-12 md:w-40">
                  <Image
                    src={logo.src}
                    alt={logo.alt}
                    fill
                    className="pointer-events-none select-none object-contain grayscale opacity-40 transition-opacity duration-300 hover:opacity-80"
                    draggable={false}
                  />
                </div>
              </div>
            ))}
          </HorizontalMarquee>
        </div>
      </section>

      {/* ── ANIMATED STATS — full-section breathing room ── */}
      <AnimatedStatsSection />

      {/* ── INTEGRATED FEATURES SECTION ── */}
      <Features />

      {/* ── HOW IT WORKS — min-screen ── */}
      <section id="how-it-works" className="flex min-h-screen items-center px-6 py-28">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-16 grid gap-12 lg:grid-cols-2 lg:items-start">
            {/* Left: steps */}
            <div>
              <Reveal>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[2px] text-indigo-500">How it works</p>
                <h2 className="text-[48px] font-black leading-tight tracking-[-2px] text-slate-900 lg:text-[56px]">
                  From recording to feedback in minutes.
                </h2>
                <p className="mt-5 text-[17px] leading-relaxed text-slate-500">
                  Lumen guides you through a structured mock interview, then delivers a detailed
                  multi-dimensional report the moment you&apos;re done.
                </p>
              </Reveal>
              <div className="mt-12 flex flex-col gap-0">
                {[
                  { num: "01", title: "Choose your interview track", desc: "Pick from Software Engineering, Product Management, Marketing, UX Design, Data Analyst, or a custom topic." },
                  { num: "02", title: "Answer per-question", desc: "Each question is recorded separately with a live countdown. Real-time emotion detection runs throughout." },
                  { num: "03", title: "AI analyses all dimensions", desc: "Audio, facial expressions, and content are evaluated question by question against the specific rubric." },
                  { num: "04", title: "Get your score + coaching", desc: "A detailed report card shows your scores, transcripts, and actionable feedback for every dimension." },
                ].map((step, i) => (
                  <Reveal key={step.num} delay={i * 0.1}>
                    <StepCard {...step} />
                  </Reveal>
                ))}
              </div>
            </div>

            {/* Right: screenshot sticky */}
            <Reveal direction="right" className="sticky top-24">
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/10 transition-all duration-500 hover:shadow-slate-900/16">
                <Image
                  src="/images/feature-recording.png"
                  alt="Interview recording interface showing live session with per-question navigation"
                  width={600}
                  height={460}
                  className="w-full"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── FEATURES — min-screen ── */}
      <section id="features" className="flex min-h-screen items-center bg-slate-50/80 px-6 py-28">
        <div className="mx-auto w-full max-w-5xl">
          <Reveal className="mb-16 text-center">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[2px] text-indigo-500">What we measure</p>
            <h2 className="text-[48px] font-black leading-tight tracking-[-2px] text-slate-900 lg:text-[56px]">
              Every dimension that matters.
            </h2>
            <p className="mx-auto mt-5 max-w-[560px] text-[17px] leading-relaxed text-slate-500">
              Interviewers form judgements across three channels simultaneously. So does Lumen.
            </p>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              { icon: <IconEye />, label: "01 · Non-Verbal", title: "Body, Face & Eyes", description: "Posture confidence, facial expression stability, and emotion distribution — the signals interviewers register but rarely say out loud.", points: ["Live emotion detection", "Stability score", "Nervous rate tracking", "YOLOv8 face analysis"] },
              { icon: <IconMic />, label: "02 · Delivery", title: "Voice as Data", description: "Speaking rate, filler word density, pause patterns, and vocal tone — quantified into a single actionable delivery score.", points: ["Words per minute", "Filler word count", "Pause analysis", "Voice emotion (SER)"] },
              { icon: <IconBrain />, label: "03 · Content", title: "Words That Fit", description: "Semantic alignment between your answer and the question. Rubric coverage, argument completeness, and relevance scoring.", points: ["Semantic similarity", "Rubric coverage", "STAR completeness", "Per-question scoring"] },
            ].map((card, i) => (
              <Reveal key={card.label} delay={i * 0.12}>
                <FeatureCard {...card} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI FEEDBACK — min-screen ── */}
      <section id="methodology" className="flex min-h-screen items-center px-6 py-28">
        <div className="mx-auto w-full max-w-5xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            {/* Screenshot */}
            <Reveal direction="left">
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/10 transition-all duration-500 hover:shadow-slate-900/16">
                <Image
                  src="/images/feature-feedback.png"
                  alt="Lumen detailed feedback report showing score breakdown and coaching tips"
                  width={600}
                  height={460}
                  className="w-full"
                />
              </div>
            </Reveal>

            {/* Text */}
            <Reveal direction="right">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[2px] text-indigo-500">AI Feedback</p>
              <h2 className="text-[48px] font-black leading-tight tracking-[-2px] text-slate-900 lg:text-[56px]">
                Feedback that actually coaches.
              </h2>
              <p className="mt-5 text-[17px] leading-relaxed text-slate-500">
                Every report includes a weighted fusion score, dimension-specific breakdowns, and
                actionable coaching tips tailored to your exact answers — not generic advice.
              </p>
              <ul className="mt-8 flex flex-col gap-3">
                {[
                  "Content Quality — semantic match + rubric coverage",
                  "Delivery & Fluency — WPM, fillers, pause patterns",
                  "Non-Verbal — emotion stability, confidence signal",
                  "Per-question transcript with speech preview",
                  "History tracking across multiple sessions",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] text-slate-600">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                      <IconCheck />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-10 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-7 py-4 text-[15px] font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] hover:bg-indigo-500"
              >
                Try it now — it&apos;s free
                <IconArrowUpRight />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="flex min-h-screen w-full items-center justify-center bg-slate-50 py-28 overflow-hidden">
        <div className="w-full">
          <FUITestimonialWithSlide />
        </div>
      </section>

      {/* ── GRADIENT BRIDGE ── */}
      <div className="h-[40vh] w-full bg-gradient-to-b from-slate-50 to-[#0A0D14] -my-[2px] relative z-10 pointer-events-none" />

      {/* ── SCROLL CTA ── */}
      <ScrollCTA words={[
          "interview",
          "presentation",
          "career",
          "pitch",
          "communication",
          "performance",
          "future"
      ]} />

      {/* ── FOOTER ── */}
      <footer className="bg-[#0A0D14] px-6 py-16 relative z-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center text-white/90">
                  <IconLogo size={24} />
                </div>
                <span className="text-[17px] font-normal tracking-tight text-white">Lumen</span>
              </div>
              <p className="mt-3 text-[13px] font-light leading-relaxed text-white/90">
                AI-powered interview performance analysis. Multimodal. Quantified. Actionable.
              </p>
            </div>

            {/* Product */}
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[1.5px] text-white/90">Product</p>
              <ul className="flex flex-col gap-2">
                {["Start Simulation", "Dashboard", "History", "Report Cards"].map((item) => (
                  <li key={item}>
                    <Link href="/" className="cursor-pointer text-[13px] font-light text-white/90 transition-colors hover:text-white">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Technology */}
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[1.5px] text-white/90">Technology</p>
              <ul className="flex flex-col gap-2">
                {["Groq Whisper", "YOLOv8", "Wav2Vec2 SER", "IndoBERT", "S-BERT"].map((item) => (
                  <li key={item}>
                    <span className="text-[13px] font-light text-white/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Project */}
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[1.5px] text-white/90">Project</p>
              <ul className="flex flex-col gap-2">
                {["About", "Methodology", "Capstone Project", "Telkom University"].map((item) => (
                  <li key={item}>
                    <span className="text-[13px] font-light text-white/90">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </footer>

      {/* Font & Styles */}
      <style>{`
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Manrope', 'Space Grotesk', 'Google Sans', sans-serif !important;
        }
        body, div, p, span, a, button, li {
          font-family: 'DM Sans', system-ui, sans-serif;
        }
      `}</style>
    </div>
  );
}
