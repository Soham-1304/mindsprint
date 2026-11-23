import { useState } from 'react'
import './landing.css'
import { PatchUpWordmark } from '@/components/PatchUpWordmark'
import { ChipStack } from './components/ChipStack'

const navLinks = [
  ['How it works', '#workflow'],
  ['Security gate', '#sietch'],
  ['Safety', '#safety'],
  ['Install', '#install'],
]

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" className="icon-16" aria-hidden="true">
      <path d="M3.2 8h9.6M9 4.2L12.8 8 9 11.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlayCircleIcon() {
  return (
    <svg viewBox="0 0 20 20" className="icon-20" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.3" opacity="0.55" />
      <polygon points="8.6,7.1 13.2,10 8.6,12.9" fill="currentColor" />
    </svg>
  )
}

function WorkflowAndSafety() {
  const stages = [
    ['01', 'DETECT', 'Continuous health rules & anomaly triggers'],
    ['02', 'DIAGNOSE', 'Cross-correlate logs, metrics & traces'],
    ['03', 'IDENTIFY CULPRIT', 'Pinpoint commit diff or runtime fault'],
    ['04', 'GENERATE FIX', 'Draft minimal patch + regression suite'],
    ['05', 'TEST', 'Validate inside isolated Docker sandbox'],
    ['06', 'APPROVE', 'Enforce human permission & safety gates'],
    ['07', 'VERIFY', 'Confirm SLO recovery & write postmortem'],
  ]

  return (
    <section className="workflow-sec" id="workflow">
      <div className="container-wide">
        <header className="section-head">
          <p className="section-kicker">
            <span className="dot-orange" /> END-TO-END INCIDENT WORKFLOW
          </p>
          <h2>From incident to verified recovery.</h2>
          <p>
            Every production incident follows a deterministic seven-stage loop with explicit safety boundaries separating code pull requests from infrastructure operations.
          </p>
        </header>

        <div className="workflow-track">
          {stages.map(([num, label, desc], idx) => (
            <div className="workflow-step" key={num}>
              <div className="workflow-step__top">
                <span className="workflow-step__num">{num}</span>
                {idx < stages.length - 1 && <i className="workflow-step__connector" />}
              </div>
              <strong>{label}</strong>
              <p>{desc}</p>
            </div>
          ))}
        </div>

        <div className="safety-paths" id="safety">
          <article className="safety-card safety-card--code">
            <div className="safety-card__badge">PATH A · CODE-RELATED FAILURE</div>
            <h3>Culprit commit → Tested GitHub Pull Request</h3>
            <p>
              When The Brain proves an incident stems from application code, PatchUP isolates the culprit commit, creates a clean fix branch, writes targeted regression tests in a disposable Docker environment, and opens a reviewable GitHub PR.
            </p>
            <div className="safety-card__chain">
              <span>Culprit Commit</span>
              <i>→</i>
              <span>Fix Branch</span>
              <i>→</i>
              <span>Docker Regression Test</span>
              <i>→</i>
              <span>GitHub PR</span>
            </div>
          </article>

          <article className="safety-card safety-card--infra">
            <div className="safety-card__badge">PATH B · INFRASTRUCTURE / RUNTIME FAILURE</div>
            <h3>Zero unauthorized production mutations</h3>
            <p>
              When failure originates in memory pressure, network partitions, upstream outages or runtime drift, PatchUP supplies exact operator repair commands and rollback guidance while strictly avoiding unapproved production mutations.
            </p>
            <div className="safety-card__chain">
              <span>Infra Diagnosis</span>
              <i>→</i>
              <span>Repair Runbook</span>
              <i>→</i>
              <span>Rollback Plan</span>
              <i>→</i>
              <span>Human Execution</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}

function SietchSection() {
  const checks = [
    ['01', 'Package Inspection', 'Diffs install scripts, postinstall hooks, and transitive tarballs before execution.'],
    ['02', 'Fake-Secret Canary Detection', 'Injects decoy credentials and flags any attempt to read or exfiltrate environment variables.'],
    ['03', 'Network Egress Restrictions', 'Captures DNS lookups, raw socket opens, and unauthorized outbound endpoints.'],
    ['04', 'Process & Filesystem Telemetry', 'Traces spawned child binaries and sensitive filesystem reads or writes inside Docker.'],
  ]

  return (
    <section className="sietch-sec" id="sietch">
      <div className="container-wide sietch-grid">
        <div className="sietch-copy">
          <p className="section-kicker section-kicker--dark">
            <span className="dot-orange" /> SIETCH SUPPLY-CHAIN SECURITY
          </p>
          <h2>Know what&apos;s inside before it gets inside.</h2>
          <p>
            Static scanners miss obfuscated install-time payloads. Sietch executes every new or modified npm dependency inside a disposable, instrumented Docker sandbox and issues an evidence-backed Allow or Block verdict.
          </p>

          <div className="sietch-list">
            {checks.map(([num, title, desc]) => (
              <div className="sietch-list__item" key={num}>
                <span>{num}</span>
                <div>
                  <strong>{title}</strong>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sietch-console">
          <div className="sietch-console__bar">
            <span>SIETCH // DISPOSABLE DOCKER SANDBOX</span>
            <span className="sietch-live">ISOLATED RUN</span>
          </div>

          <svg viewBox="0 0 560 390" className="sietch-svg" role="img" aria-label="Sietch disposable Docker sandbox security pipeline">
            <rect x="24" y="24" width="145" height="54" rx="10" fill="#232421" stroke="#444640" />
            <text x="96" y="48" fill="#FAF8F3" fontSize="11" fontWeight="600" textAnchor="middle">npm Package Diff</text>
            <text x="96" y="65" fill="#9CA3AF" fontSize="9.5" textAnchor="middle">postinstall + deps</text>

            <path d="M169 51H216" stroke="#F26627" strokeWidth="1.6" strokeDasharray="4 4" className="pulse" />

            <rect x="216" y="18" width="320" height="260" rx="14" fill="#1B1C19" stroke="#F26627" strokeOpacity="0.45" />
            <text x="376" y="44" fill="#F26627" fontSize="10" fontWeight="600" letterSpacing="1.2" textAnchor="middle">
              DISPOSABLE DOCKER SANDBOX
            </text>

            {[
              ['Fake-Secret Canary', '0 Canary Leaks', 64],
              ['Network Monitor', 'Egress Blocked', 114],
              ['Process Tree Trace', 'sh / node inspected', 164],
              ['Filesystem Guard', '/etc & ~/.ssh clean', 214],
            ].map(([label, status, y]) => (
              <g key={label as string}>
                <rect x="240" y={y as number} width="272" height="38" rx="7" fill="#252723" stroke="#3A3C36" />
                <text x="256" y={(y as number) + 23} fill="#FAF8F3" fontSize="10.5">{label}</text>
                <text x="496" y={(y as number) + 23} fill="#6EE7B7" fontSize="9.5" textAnchor="end">{status}</text>
              </g>
            ))}

            <path d="M376 278V295H205V312M376 295H384V312" fill="none" stroke="#F26627" strokeWidth="1.6" strokeDasharray="4 4" className="pulse" />

            <rect x="130" y="312" width="150" height="52" rx="10" fill="#1F3327" stroke="#34D399" />
            <text x="205" y="335" fill="#6EE7B7" fontSize="11" fontWeight="700" textAnchor="middle">VERDICT: ALLOW</text>
            <text x="205" y="351" fill="#A7F3D0" fontSize="9" textAnchor="middle">Signed evidence log</text>

            <rect x="304" y="312" width="160" height="52" rx="10" fill="#3A1E1A" stroke="#F97316" />
            <text x="384" y="335" fill="#FDBA74" fontSize="11" fontWeight="700" textAnchor="middle">OR BLOCK PR</text>
            <text x="384" y="351" fill="#FED7AA" fontSize="9" textAnchor="middle">Exfiltration evidence</text>
          </svg>
        </div>
      </div>
    </section>
  )
}

const installSteps = [
  {
    num: '01',
    title: 'Prerequisites & Docker Runtime',
    desc: 'Verify Git and a local or runner-hosted Docker Engine so isolated regression tests and Sietch sandboxes can execute cleanly.',
    snippet: `git --version\ndocker info --format '{{.ServerVersion}}'`,
  },
  {
    num: '02',
    title: 'Repository & GitHub Integration',
    desc: 'Grant scoped repository access so PatchUP can inspect commit history, open fix branches, and submit pull requests for human review.',
    snippet: `# Configure in your deployment environment\nGITHUB_REPO_OWNER=<your-org>\nGITHUB_REPO_NAME=<your-service>\nGITHUB_APP_INSTALLATION_ID=<installation-id>`,
  },
  {
    num: '03',
    title: 'Monitoring & Telemetry Endpoints',
    desc: 'Point The Watcher at your Prometheus instance and application log stream to enable continuous anomaly correlation.',
    snippet: `PROMETHEUS_BASE_URL=http://prometheus.internal:9090\nLOG_STREAM_SOURCE=docker-json\nSIETCH_SANDBOX_IMAGE=node:20-slim`,
  },
  {
    num: '04',
    title: 'Health Check & First Incident Simulation',
    desc: 'Verify source connectivity first, then trigger a non-destructive staging fault or dependency diff to observe the full diagnosis loop.',
    snippet: `# 1. Verify Prometheus, Docker, and GitHub permissions in your dashboard\n# 2. Open a test PR with a changed npm package in package.json\n# 3. Review the generated Sietch verdict & PatchUP diagnosis report`,
  },
]

function InstallationGuide() {
  const [step, setStep] = useState(0)
  const [copied, setCopied] = useState(false)

  const copySnippet = () => {
    navigator.clipboard?.writeText(installSteps[step].snippet).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <section className="install-sec" id="install">
      <div className="container-wide">
        <header className="section-head">
          <p className="section-kicker">
            <span className="dot-orange" /> DEVELOPER INSTALLATION GUIDE
          </p>
          <h2>Connect your stack in four deliberate steps.</h2>
          <p>
            Designed around standard engineering primitives—GitHub, Prometheus, and Docker—with explicit environment configuration and zero black-box agents.
          </p>
        </header>

        <div className="install-box">
          <div className="install-tabs" role="tablist">
            {installSteps.map((s, idx) => (
              <button
                key={s.num}
                type="button"
                className={`install-tab ${step === idx ? 'is-active' : ''}`}
                onClick={() => setStep(idx)}
              >
                <span>{s.num}</span>
                <strong>{s.title}</strong>
              </button>
            ))}
          </div>

          <div className="install-pane">
            <div className="install-pane__meta">STEP {installSteps[step].num} OF 04</div>
            <h3>{installSteps[step].title}</h3>
            <p>{installSteps[step].desc}</p>
            <div className="code-block">
              <div className="code-block__bar">
                <span>TERMINAL / ENV</span>
                <button type="button" className="code-copy" onClick={copySnippet}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre>
                <code>{installSteps[step].snippet}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export interface LandingPageProps {
  onEnterDashboard: () => void
}

export default function LandingPage({ onEnterDashboard }: LandingPageProps) {
  const [mobileMenu, setMobileMenu] = useState(false)
  const [heroHoverLayer, setHeroHoverLayer] = useState<number | null>(null)

  return (
    <div className="site-shell" id="top">
      {/* UNIFIED TOP NAVIGATION BAR — Same PatchUP 2x2 petal logo, NO dark mode toggle */}
      <header className="syntra-header">
        <div className="syntra-header__inner">
          <a href="#top" className="no-underline" aria-label="PatchUP Home">
            <PatchUpWordmark compact />
          </a>

          <nav className={`syntra-nav ${mobileMenu ? 'is-open' : ''}`} aria-label="Primary">
            {navLinks.map(([label, href]) => (
              <a key={label} href={href} onClick={() => setMobileMenu(false)}>
                {label}
              </a>
            ))}
          </nav>

          <div className="syntra-header__actions">
            <button
              type="button"
              className="cta-dark-pill cursor-pointer border-0"
              onClick={onEnterDashboard}
            >
              <span>Open Dashboard</span>
              <ArrowRightIcon />
            </button>
            <button
              type="button"
              className="mobile-burger"
              onClick={() => setMobileMenu(v => !v)}
              aria-label="Toggle navigation"
            >
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION WITH INTERACTIVE 5-LAYER 3D CHIP STACK */}
      <main>
        <section className="syntra-hero">
          <div className="syntra-hero__iso-bg" aria-hidden="true" />

          <div className="syntra-hero__container">
            <div className="syntra-hero__left">
              <div className="hero-badge">
                <span className="hero-badge__dot" />
                <span>PATCH-UP · ZERO-RETENTION AI SRE</span>
              </div>

              <h1 className="hero-title">
                Detect failures.
                <br />
                Diagnose the
                <br />
                exact cause with
                <br />
                <span className="hero-title__ai">AI.</span>
              </h1>

              <p className="hero-subtitle">
                A push-on-break, zero-retention AI Site Reliability Agent that turns error bundles, metrics and commit history into evidence-backed diagnosis, verified PR-only fixes and pre-merge security gates.
              </p>

              <div className="hero-ctas">
                <button
                  type="button"
                  className="btn-orange-pill cursor-pointer border-0"
                  onClick={onEnterDashboard}
                >
                  <span>Open Live Dashboard</span>
                  <ArrowRightIcon />
                </button>
                <a className="btn-white-pill" href="#workflow">
                  <PlayCircleIcon />
                  <span>See the workflow</span>
                </a>
              </div>

              <div className="hero-pillars">
                <div className="hero-pillar">
                  <div>
                    <strong>~16s MTTD</strong>
                    <span>Push-on-break RCA</span>
                  </div>
                </div>
                <div className="hero-pillar">
                  <div>
                    <strong>0 B Retained</strong>
                    <span>Cryptographic RAM purge</span>
                  </div>
                </div>
                <div className="hero-pillar">
                  <div>
                    <strong>PR-Only</strong>
                    <span>main branch protected</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="syntra-hero__right">
              <ChipStack
                active={heroHoverLayer}
                setActive={setHeroHoverLayer}
                interactive
                variant="hero"
                onSelectNavigate={() => {
                  document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })
                }}
              />
            </div>
          </div>
        </section>

        {/* END-TO-END WORKFLOW & SAFETY PATHS */}
        <WorkflowAndSafety />

        {/* 3-LAYER PRE-MERGE SECURITY GATE */}
        <SietchSection />

        {/* DEVELOPER INSTALLATION GUIDE */}
        <InstallationGuide />
      </main>

      {/* FOOTER */}
      <footer className="syntra-footer">
        <div className="container-wide">
          <div className="syntra-footer__top">
            <div>
              <PatchUpWordmark compact />
              <p className="syntra-footer__tagline">
                PatchUP — Push-on-break zero-retention AI SRE, PR-only surgical fixes, and 3-layer pre-merge security gate.
              </p>
            </div>
            <div className="syntra-footer__cols">
              <div>
                <strong>Product</strong>
                <a href="#workflow">How It Works</a>
                <a href="#sietch">Security Gate</a>
                <a href="#safety">Safety</a>
                <a href="#install">Installation</a>
              </div>
              <div>
                <strong>Connect</strong>
                <button
                  type="button"
                  onClick={onEnterDashboard}
                  className="bg-transparent border-0 p-0 text-left cursor-pointer"
                  style={{ color: 'inherit', font: 'inherit' }}
                >
                  Live Dashboard
                </button>
                <a href="https://github.com/Soham-1304/mindsprint" target="_blank" rel="noreferrer">GitHub</a>
                <a href="#top">Back to top ↑</a>
              </div>
            </div>
          </div>
          <div className="syntra-footer__bottom">
            <span>© {new Date().getFullYear()} PatchUP. All rights reserved.</span>
            <span>Zero-retention autonomous reliability.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
