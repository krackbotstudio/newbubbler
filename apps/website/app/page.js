'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

/** Production admin app (Vercel). */
const ADMIN_WEB_LOGIN_URL = 'https://bubbler-admin-web.vercel.app/login';

const featureCards = [
  {
    title: 'Order & Pickup Flow',
    description: 'Manage bookings, slots, and delivery updates from one live dashboard.',
  },
  {
    title: 'Invoice & WhatsApp',
    description: 'Auto-generate invoices and send branded updates via WhatsApp instantly.',
  },
  {
    title: 'Branch Control',
    description: 'Run multiple locations with individual pricing, staff, and ops controls.',
  },
  {
    title: 'Subscription Plans',
    description: 'Offer recurring laundry plans. Set it, bill it, keep customers coming back.',
  },
  {
    title: 'Analytics & Insights',
    description: 'Track revenue, order trends, and team performance in real time.',
  },
  {
    title: 'Custom Branding',
    description: 'Your logo, your colors, your customer experience. White-label ready.',
  },
];

const testimonials = [
  {
    quote:
      'Bubbler completely changed how we run our laundry pickup service. Orders, invoices, WhatsApp updates — all in one place.',
    name: 'Ravi K.',
    role: 'Owner, FreshFold Laundry — Mumbai',
    initials: 'RK',
  },
  {
    quote:
      'We onboarded 3 branches in a single day. The dashboard is super clean and our team picked it up in minutes.',
    name: 'Priya S.',
    role: 'Operations Head, CleanPress Co. — Bangalore',
    initials: 'PS',
  },
  {
    quote:
      'Our customers love the pickup portal. Repeat orders went up after the first month. Bubbler just works.',
    name: 'Sandeep',
    role: 'Owner, Weyou Laundry — Hyderabad',
    initials: 'SA',
  },
];

const steps = [
  {
    title: 'Set Up Your Profile',
    time: 'Step 1 · 20 mins',
    description:
      'Add your business profile, branch locations, service zones, pricing rules, and turnaround timelines. Configure pickup slots and order preferences so your operations are ready from day one.',
    points: ['Branch and service setup', 'Pricing and slot rules', 'Ready-to-go operations'],
  },
  {
    title: 'Go Live with Orders',
    time: 'Step 2 · 15 mins',
    description:
      'Launch your branded booking flow across mobile and web so customers can place requests instantly. Capture order details, preferred time slots, and address information without manual follow-ups.',
    points: ['Branded customer portal', 'Instant order capture', 'Automatic request flow'],
  },
  {
    title: 'Manage Everything',
    time: 'Step 3 · Continuous',
    description:
      'Track every order status in real time, update customers with timely WhatsApp communication, and generate invoices from the same dashboard. Monitor team performance and keep daily operations fully in control.',
    points: ['Live order tracking', 'WhatsApp communication', 'Billing and analytics'],
  },
];

const bubbles = [
  { size: 196, x: '5%', y: '10%', duration: 24, delay: 0, moveX: '32vw', moveY: '34vh', bounce: 4.7, alpha: 0.34 },
  { size: 120, x: '16%', y: '62%', duration: 20, delay: 1.1, moveX: '42vw', moveY: '-46vh', bounce: 3.6, alpha: 0.28 },
  { size: 158, x: '33%', y: '26%', duration: 27, delay: 2.4, moveX: '-44vw', moveY: '40vh', bounce: 5.3, alpha: 0.31 },
  { size: 86, x: '44%', y: '78%', duration: 17, delay: 0.5, moveX: '28vw', moveY: '-50vh', bounce: 3.2, alpha: 0.24 },
  { size: 220, x: '61%', y: '12%', duration: 29, delay: 1.8, moveX: '-36vw', moveY: '46vh', bounce: 5.9, alpha: 0.36 },
  { size: 94, x: '73%', y: '56%', duration: 18, delay: 0.7, moveX: '26vw', moveY: '-34vh', bounce: 3.8, alpha: 0.25 },
  { size: 70, x: '84%', y: '30%', duration: 16, delay: 2.1, moveX: '-24vw', moveY: '28vh', bounce: 2.9, alpha: 0.22 },
  { size: 132, x: '91%', y: '76%', duration: 21, delay: 3, moveX: '-38vw', moveY: '-42vh', bounce: 4.2, alpha: 0.3 },
  { size: 60, x: '11%', y: '86%', duration: 15, delay: 1.4, moveX: '48vw', moveY: '-56vh', bounce: 2.7, alpha: 0.2 },
  { size: 150, x: '48%', y: '8%', duration: 26, delay: 2.7, moveX: '-50vw', moveY: '52vh', bounce: 5.1, alpha: 0.29 },
  { size: 78, x: '95%', y: '44%', duration: 19, delay: 0.3, moveX: '-60vw', moveY: '20vh', bounce: 3.4, alpha: 0.23 },
  { size: 108, x: '28%', y: '50%', duration: 23, delay: 1.9, moveX: '52vw', moveY: '-18vh', bounce: 4.4, alpha: 0.27 },
];

const HERO_SLIDE_MS = 2600;
const HERO_SLIDE_COUNT = 4;

export default function WebsitePage() {
  const [heroSlide, setHeroSlide] = useState(0);
  const [heroReducedMotion, setHeroReducedMotion] = useState(false);

  useEffect(() => {
    const updateCursorVars = (event) => {
      document.documentElement.style.setProperty('--cursor-x', `${event.clientX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${event.clientY}px`);
    };

    window.addEventListener('pointermove', updateCursorVars, { passive: true });
    return () => window.removeEventListener('pointermove', updateCursorVars);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setHeroReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    if (mq.matches) {
      return () => mq.removeEventListener('change', sync);
    }
    const id = window.setInterval(() => {
      setHeroSlide((i) => (i + 1) % HERO_SLIDE_COUNT);
    }, HERO_SLIDE_MS);
    return () => {
      window.clearInterval(id);
      mq.removeEventListener('change', sync);
    };
  }, []);

  const whatsappMessage =
    "Hi, I would like to schedule a Bubbler demo for my laundry business. Please help me with the details.";

  return (
    <>
      <main className="site">
        <div className="bubble-bg" aria-hidden="true">
        {bubbles.map((bubble, index) => (
          <span
            key={`${bubble.x}-${bubble.y}-${index}`}
            className="bubble"
            style={{
              '--bubble-size': `${bubble.size}px`,
              '--bubble-x': bubble.x,
              '--bubble-y': bubble.y,
              '--bubble-duration': `${bubble.duration}s`,
              '--bubble-delay': `${bubble.delay}s`,
              '--bubble-move-x': bubble.moveX,
              '--bubble-move-y': bubble.moveY,
              '--bubble-bounce': `${bubble.bounce}s`,
              '--bubble-alpha': bubble.alpha,
            }}
          />
        ))}
      </div>
      <div className="topbar-wrap">
        <header className="topbar topbar-blue">
          <div className="logo-wrap-dark">
            <Image
              src="/images/logos/dark-mode.svg"
              alt="Bubbler Logo"
              width={190}
              height={73}
              style={{ width: '190px', height: 'auto' }}
            />
          </div>
          <nav className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#why-bubbler">Why Bubbler</a>
          </nav>
          <div className="topbar-actions">
            <a
              className="btn btn-ghost topbar-login"
              href={ADMIN_WEB_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Login
            </a>
            <a className="btn btn-demo" href="#demo">
              Book a Demo
            </a>
          </div>
        </header>
      </div>

      <section className="section hero">
        <div>
          <h1>
            The <span className="gradient-text">Smarter</span> Way to Run Your Laundry Business
          </h1>
          <p>
            Stop juggling spreadsheets and WhatsApp chats. Bubbler gives your team one dashboard to
            handle orders, pickups, billing, and customers - at any scale.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="#demo">
              Book a Demo →
            </a>
            <a className="btn btn-ghost" href="#how-it-works">
              See How It Works
            </a>
          </div>
        </div>
        <div
          className="hero-visual"
          aria-label="Product preview carousel"
          role="region"
          aria-roledescription="carousel"
        >
          <div
            className={`hero-card hero-slide slide-mobile-1${heroSlide === 0 ? ' is-active' : ''}`}
            aria-hidden={heroReducedMotion ? false : heroSlide !== 0}
          >
            <Image
              src="/images/customer-mobile-hero.png"
              alt="Bubbler customer app login screen"
              priority
              quality={100}
              unoptimized
              width={518}
              height={938}
              className="hero-shot hero-shot-mobile"
              sizes="(max-width: 900px) 74vw, 24vw"
            />
          </div>
          <div
            className={`hero-card hero-slide slide-mobile-2${heroSlide === 1 ? ' is-active' : ''}`}
            aria-hidden={heroReducedMotion ? false : heroSlide !== 1}
          >
            <Image
              src="/images/customer-mobile-home-hero.png"
              alt="Bubbler customer app home screen with orders"
              priority
              quality={100}
              unoptimized
              width={518}
              height={938}
              className="hero-shot hero-shot-mobile"
              sizes="(max-width: 900px) 74vw, 24vw"
            />
          </div>
          <div
            className={`hero-card hero-slide slide-desktop-1${heroSlide === 2 ? ' is-active' : ''}`}
            aria-hidden={heroReducedMotion ? false : heroSlide !== 2}
          >
            <Image
              src="/images/hero-desktop-order.png"
              alt="Bubbler admin order details and invoice"
              priority
              quality={100}
              unoptimized
              width={1920}
              height={1080}
              className="hero-shot hero-shot-desktop"
              sizes="(max-width: 900px) 96vw, 54vw"
            />
          </div>
          <div
            className={`hero-card hero-slide slide-desktop-2${heroSlide === 3 ? ' is-active' : ''}`}
            aria-hidden={heroReducedMotion ? false : heroSlide !== 3}
          >
            <Image
              src="/images/hero-desktop-final-invoices.png"
              alt="Bubbler admin final invoices"
              priority
              quality={100}
              unoptimized
              width={1920}
              height={1080}
              className="hero-shot hero-shot-desktop"
              sizes="(max-width: 900px) 96vw, 54vw"
            />
          </div>
        </div>
      </section>

      <section id="platforms" className="section">
        <div className="section-head centered">
          <h2>One platform. Every device.</h2>
          <p>
            Your team and customers get a seamless experience - whether they&apos;re on a phone,
            tablet, or desktop.
          </p>
        </div>
        <div className="platform-grid">
          <div className="platform-card glass">
            <h3>Android App</h3>
            <p>
              Native Android app for customers to place orders, track pickups, and manage their
              laundry on the go.
            </p>
          </div>
          <div className="platform-card glass">
            <h3>iOS App</h3>
            <p>
              A smooth, fast iOS experience for iPhone and iPad users - built for speed and
              simplicity.
            </p>
          </div>
          <div className="platform-card glass">
            <h3>Web App</h3>
            <p>
              Full-featured web portal for business owners and admins - manage everything from any
              browser.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <div className="section-head">
          <h2>Built for Modern Laundry Teams</h2>
          <p>From solo operators to multi-branch enterprises - Bubbler scales with you.</p>
        </div>
        <div className="feature-grid">
          {featureCards.map((feature, index) => (
            <article
              key={feature.title}
              className="feature-card glass"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="section">
        <div className="section-head">
          <h2>Up and running in under a day</h2>
          <p>
            Bubbler follows a simple onboarding flow designed for real laundry operations. You can
            configure your setup quickly and start handling live customer orders the same day.
          </p>
        </div>
        <div className="steps">
          {steps.map((step, index) => (
            <div key={step.title} className="step glass">
              <span className="step-num">{index + 1}</span>
              <div className="step-content">
                <p className="step-time">{step.time}</p>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <div className="step-points">
                  {step.points.map((point) => (
                    <span key={point} className="step-point">
                      {point}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="testimonials" className="section">
        <div className="section-head">
          <h2>Real businesses, real results</h2>
        </div>
        <div className="testimonials-grid">
          {testimonials.map((t) => (
            <div key={t.name} className="testimonial-card glass">
              <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{t.initials}</div>
                <div>
                  <p className="testimonial-name">{t.name}</p>
                  <p className="testimonial-role">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="why-bubbler" className="section">
        <div className="showcase-row">
          <div className="showcase-image">
            <Image
              src="/images/family-laundry.png"
              alt="Laundry customer experience"
              fill
              sizes="(max-width: 900px) 100vw, 48vw"
            />
          </div>
          <div className="showcase-copy">
            <h2>Every Customer, Perfectly Managed</h2>
            <p>
              Bubbler keeps the full customer journey visible - from first pickup request to final
              delivery. Your team always knows what&apos;s next.
            </p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="showcase-row">
          <div className="showcase-copy">
            <h2>Your Brand. Your Business.</h2>
            <p>
              Upload your logo, set your color palette, and create a laundry experience customers
              remember. Bubbler is fully white-label.
            </p>
          </div>
          <div className="showcase-image">
            <Image
              src="/images/stacked-clothes.png"
              alt="Branded laundry service presentation"
              fill
              sizes="(max-width: 900px) 100vw, 48vw"
            />
          </div>
        </div>
      </section>

      <section id="demo" className="section">
        <div className="demo-panel glass">
          <div className="section demo-grid">
            <div className="demo-copy">
              <h2>See Bubbler in Action</h2>
              <p>
                Book a free 20-minute demo. We&apos;ll walk you through the platform and answer every
                question.
              </p>
            </div>
            <div className="demo-offer">
              <span className="offer-highlight">3 months absolutely free</span>
              <h3>1 Year Subscription Offer</h3>
              <p className="offer-main">
                Subscribe for 12 months and unlock <strong>15 months</strong> of full Bubbler access.
              </p>
              <div className="offer-actions">
                <a className="btn btn-primary" href="tel:+918971690163">
                  Call +91 8971690163
                </a>
                <a className="btn btn-ghost" href="mailto:Krackbotstudio@gmail.com">
                  Email: Krackbotstudio@gmail.com
                </a>
              </div>
              <p className="demo-note">Limited-time offer · Free setup · Quick onboarding support</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer-outer">
        <div className="footer-top section">
          <div className="footer-brand">
            <div className="footer-logo-wrap">
              <Image
                src="/images/logos/light-mode.svg"
                alt="Bubbler Logo"
                width={160}
                height={61}
                style={{ width: '160px', height: 'auto' }}
              />
            </div>
            <p className="footer-company">
              A product by <strong>dotbotz Interactives Pvt. Ltd.</strong>
            </p>
          </div>
          <div className="footer-links-group">
            <p className="footer-col-title">PRODUCT</p>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#demo">Book a Demo</a>
          </div>
          <div className="footer-links-group">
            <p className="footer-col-title">COMPANY</p>
            <a href="mailto:hello@bubbler.app">Contact</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="section footer-bottom-inner">
            <p>© 2026 dotbotz Interactives Private Limited. All rights reserved.</p>
            <div className="footer-bottom-links">
              <a href="#">Privacy</a>
              <a href="#">Terms</a>
            </div>
          </div>
        </div>
      </footer>
      </main>
      <a
        href={`https://wa.me/918971690163?text=${encodeURIComponent(whatsappMessage)}`}
        className="whatsapp-float"
        aria-label="Chat on WhatsApp to schedule a Bubbler demo"
        target="_blank"
        rel="noreferrer"
      >
        <span className="whatsapp-icon" aria-hidden="true">
          <svg
            viewBox="0 0 32 32"
            width="22"
            height="22"
            focusable="false"
          >
            <circle cx="16" cy="16" r="16" fill="#25D366" />
            <path
              d="M22.4 17.2c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.1-.2.1-.3.1-.6 0s-1.2-.4-2.3-1.5c-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.4.1-.1.2-.3.3-.5.1-.2 0-.4 0-.5 0-.2-.7-1.8-1-2.4-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1.1-1.1 2.6 0 1.5 1.1 2.9 1.3 3.1.2.2 2.1 3.2 5.1 4.4.7.3 1.3.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.2.1-1.4-.1-.2-.3-.3-.6-.5Z"
              fill="#ffffff"
            />
          </svg>
        </span>
        <span className="whatsapp-label">WhatsApp</span>
      </a>
    </>
  );
}
