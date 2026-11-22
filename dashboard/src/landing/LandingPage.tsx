import { useCallback, useEffect, useState } from 'react'
import './landing.css'
import { ChipStack } from './components/ChipStack'
import { JarvisArchitectureExperience } from './components/JarvisBlueprint3D'
import { LayerInteractiveTextCard } from './components/LayerInteractiveTextCard'
import {
  LayerCleanCopy,
  Layer02Diagram,
  Layer03Diagram,
  Layer04Diagram,
  Layer05Diagram,
} from './components/LayerUniqueSpecs'

type Layer = {
  id: number
  short: string
  kicker: string
  name: string
  headline: string
  purpose: string
  detail: string
  input: string
  output: string
  flow: [string, string, string]
  capabilities: string[]
}

const layers: Layer[] = [
  {
    id: 1,
    short: 'INGEST',
    kicker: 'CONNECTED SOURCES',
    name: 'Connected Sources',
    headline: 'Unify every live production signal.',
    purpose:
      'Patch-Up ingests commits, Prometheus metrics, Docker container state, application logs and CI/CD events into a single normalized stream.',
    detail:
      'No custom instrumentation rewrites are required. Signals are correlated in real time with strict read-scoped permissions.',
    input: 'GitHub, Prometheus, Docker, Logs, CI/CD',
    output: 'Normalized operational signal stream',
    flow: ['Ecosystem', 'Signal collector', 'Patch-Up stream'],
    capabilities: [
      'Ingest GitHub repositories and commit webhooks',
      'Stream Prometheus service and host metrics',
      'Inspect Docker container health and restarts',
      'Parse structured and unstructured app logs',
      'Track CI/CD deployment pipeline transitions',
      'Preserve read-scoped telemetry boundaries',
    ],
  },
  {
    id: 2,
    short: 'CONTEXT',
    kicker: 'RELEASE & INCIDENT CONTEXT',
    name: 'Release & Incident Context',
    headline: 'Pinpoint the exact change behind an outage.',
    purpose:
      'When health degrades, the agent correlates deployment timelines, Git diffs, Git blame and stack traces against historical metric baselines.',
    detail:
      'Every anomalous spike is mapped directly against recent code and config changes to isolate the suspected culprit commit.',
    input: 'Deploys, Git diffs, stack traces, history',
    output: 'Suspected culprit commit + timeline',
    flow: ['Release event', 'Diff + blame', 'Culprit commit'],
    capabilities: [
      'Build live deployment and release timelines',
      'Correlate Git diff and line-level Git blame',
      'Map stack traces to recent file modifications',
      'Compare anomalies against historical baselines',
      'Rank suspected culprit commits with evidence',
      'Eliminate unrelated noisy service alerts',
    ],
  },
  {
    id: 3,
    short: 'REASON',
    kicker: 'AI DIAGNOSIS ENGINE',
    name: 'AI Diagnosis Engine',
    headline: 'Watcher detection meets Brain root-cause reasoning.',
    purpose:
      'The Watcher continuously evaluates health rules and anomalies to open incidents; The Brain activates to cross-examine logs, metrics and commits.',
    detail:
      'Delivers an evidence-backed root cause diagnosis with explicit confidence scoring and clean separation of code vs infrastructure faults.',
    input: 'Operational signals + incident context',
    output: 'Diagnosis, confidence score & evidence',
    flow: ['The Watcher', 'The Brain', 'Root cause'],
    capabilities: [
      'Continuous Watcher health and rule monitoring',
      'Automatic anomaly detection and incident creation',
      'Brain multi-modal log and metric correlation',
      'Distinguish code bugs from infrastructure faults',
      'Attach verifiable evidence to every claim',
      'Score diagnostic confidence before action',
    ],
  },
  {
    id: 4,
    short: 'REMEDIATE',
    kicker: 'AUTOMATED REMEDIATION & SECURITY',
    name: 'Remediation & Security',
    headline: 'Turn diagnosis into controlled action.',
    purpose:
      'For code-related failures, the agent generates a fix, creates regression tests and opens a GitHub pull request. Changes run in isolated Docker environments.',
    detail:
      'Human approval and permission tiers remain in control, while Sietch adds package-level sandbox security.',
    input: 'Verified diagnosis or changed npm package',
    output: 'Tested GitHub PR or Sietch security verdict',
    flow: ['Diagnosis', 'Patch + tests', 'GitHub PR'],
    capabilities: [
      'Generate a fix branch and GitHub pull request',
      'Create focused regression tests',
      'Run tests in isolated Docker containers',
      'Require approval for risky actions',
      'Provide exact infrastructure repair instructions',
      'Sietch sandbox-scans npm package changes',
      'Block suspicious behaviour with evidence',
    ],
  },
  {
    id: 5,
    short: 'VERIFY',
    kicker: 'VERIFICATION & OUTCOMES',
    name: 'Verification & Outcomes',
    headline: 'Close incidents only when recovery holds.',
    purpose:
      'After a fix or rollback lands, Patch-Up monitors live service telemetry to confirm error rates and latency return to healthy baselines.',
    detail:
      'Automatically closes verified incidents or reopens regressions, then compiles a complete postmortem, audit trail and time-to-diagnosis scorecard.',
    input: 'Applied remediation + post-fix telemetry',
    output: 'Verified closure, postmortem & scorecard',
    flow: ['Recovery check', 'Verify metrics', 'Postmortem'],
    capabilities: [
      'Continuous post-deployment recovery monitoring',
      'Automatic incident closure or instant reopen',
      'Generate structured engineering postmortems',
      'Record immutable decision and action audit trails',
      'Track Time-to-Diagnosis (MTTD) scorecards',
      'Export incident insights to team workspaces',
    ],
  },
]

const navLinks = [
  ['Architecture', '#architecture'],
  ['How it works', '#workflow'],
  ['Security Gate', '#sietch'],
  ['Safety', '#safety'],
]

function SyntraLogo() {
  return (
    <a className="brand-logo" href="#top" aria-label="PatchUP home">
      <svg className="brand-logo__mark" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M4 9.5C4 6.46 6.46 4 9.5 4H13a2 2 0 0 1 2 2v6.5a2.5 2.5 0 0 1-2.5 2.5H6a2 2 0 0 1-2-2V9.5Z" fill="#FF5500" />
        <path d="M17 6a2 2 0 0 1 2-2h3.5C25.54 4 28 6.46 28 9.5V13a2 2 0 0 1-2 2h-6.5A2.5 2.5 0 0 1 17 12.5V6Z" fill="#F89B6C" />
        <path d="M4 19a2 2 0 0 1 2-2h6.5a2.5 2.5 0 0 1 2.5 2.5V26a2 2 0 0 1-2 2H9.5C6.46 28 4 25.54 4 22.5V19Z" fill="#F89B6C" />
        <path d="M17 19.5a2.5 2.5 0 0 1 2.5-2.5H26a2 2 0 0 1 2 2v3.5c0 3.04-2.46 5.5-5.5 5.5H19a2 2 0 0 1-2-2v-6.5Z" fill="#FF5500" />
      </svg>
      <span className="brand-logo__text">PatchUP</span>
    </a>
  )
}

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

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" className="icon-18" aria-hidden="true">
      <path
        d="M14.8 12.6A5.8 5.8 0 0 1 7.4 5.2a5.8 5.8 0 1 0 7.4 7.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* --- HOLOGRAPHIC ORBITAL CAD EMBLEM FOR EDITORIAL SPECIFICATION ROWS --- */
function LayerOrbitalSpec({ layer }: { layer: Layer }) {
  return (
    <svg className="diagram" viewBox="0 0 580 270" role="img" aria-label={`Layer 0${layer.id} ${layer.name} orbital blueprint`}>
      <circle cx="290" cy="135" r="108" fill="none" stroke="rgba(79,106,130,0.22)" strokeWidth="1" strokeDasharray="3 6" />
      <circle cx="290" cy="135" r="76" fill="rgba(242,102,39,0.05)" stroke="rgba(242,102,39,0.45)" strokeWidth="1.2" />
      <ellipse cx="290" cy="135" rx="136" ry="46" fill="none" stroke="rgba(79,106,130,0.28)" strokeWidth="1" transform="rotate(-14 290 135)" />
      <ellipse cx="290" cy="135" rx="136" ry="46" fill="none" stroke="rgba(242,102,39,0.34)" strokeWidth="1" strokeDasharray="6 5" className="pulse" transform="rotate(14 290 135)" />
      <path d="M 158 135 H 198 M 382 135 H 422" stroke="#F26627" strokeWidth="1.3" strokeDasharray="4 4" className="pulse" />

      {/* Left Ingest Node */}
      <rect x="20" y="113" width="138" height="44" rx="8" fill="#FAF8F4" stroke="rgba(70,94,115,0.28)" />
      <text x="89" y="139" textAnchor="middle" className="d-caption">{layer.flow[0].toUpperCase()}</text>

      {/* Center Collector Core */}
      <rect x="198" y="105" width="184" height="60" rx="10" fill="rgba(255,255,255,0.96)" stroke="#F26627" strokeWidth="1.6" />
      <text x="290" y="128" textAnchor="middle" className="d-kicker-orange">L0{layer.id} // {layer.short}</text>
      <text x="290" y="148" textAnchor="middle" fill="#0F172A" fontSize="10.5" fontWeight="600">{layer.flow[1]}</text>

      {/* Right Stream Output */}
      <rect x="422" y="113" width="138" height="44" rx="8" fill="#FFF6F0" stroke="rgba(242,102,39,0.4)" />
      <text x="491" y="139" textAnchor="middle" className="d-caption">{layer.flow[2].toUpperCase()}</text>
    </svg>
  )
}

function LayerDeepDives() {
  const layer1 = layers[0]
  const layer2 = layers[1]
  const layer3 = layers[2]
  const layer4 = layers[3]
  const layer5 = layers[4]

  return (
    <section className="deep-dives" id="layers">
      <div className="container-wide">
        <header className="section-head">
          <p className="section-kicker">
            <span className="dot-orange" /> LAYER-BY-LAYER TECHNICAL SPECIFICATION
          </p>
          <h2>
            Five specialized layers.{' '}
            <span className="text-orange-highlight">Zero black boxes.</span>
          </h2>
          <p>
            Each physical layer in the Patch-Up stack owns a distinct reliability boundary—from raw signal ingestion to verified recovery and supply-chain sandboxing.
          </p>
        </header>

        <div className="deep-dives__list">
          {/* LAYER 01: EXCLUSIVE SIGNATURE BEFORE/AFTER COMPARISON SHOWCASE */}
          <article className="deep-row" key={layer1.id}>
            <div className="deep-row__copy">
              <LayerInteractiveTextCard layer={layer1} />
            </div>
            <div className="deep-row__diagram">
              <div className="deep-row__frame-top">
                <span>MODULE 01 · CONNECTED SOURCES</span>
                <span className="comp-status-pill comp-status-pill--green">■ ACTIVE INGEST</span>
              </div>
              <LayerOrbitalSpec layer={layer1} />
            </div>
          </article>

          {/* LAYER 02: RELEASE & INCIDENT CONTEXT (DIAGRAM ON LEFT, COPY ON RIGHT) */}
          <article className="deep-row deep-row--reverse" key={layer2.id}>
            <div className="deep-row__copy">
              <LayerCleanCopy
                layer={layer2}
                badge={
                  <div className="layer-distinct-badge layer-distinct-badge--git">
                    <span className="badge-tag-pill badge-tag-pill--git">GIT DIFF</span>
                    <span className="badge-code-hash">#8f4b2a</span>
                    <span className="badge-file-target">auth-worker.ts</span>
                    <span className="badge-diff-stats">
                      <span className="stat-add">+14</span> / <span className="stat-del">-3</span> lines
                    </span>
                  </div>
                }
              />
            </div>
            <Layer02Diagram />
          </article>

          {/* LAYER 03: MULTI-MODEL REASONING ENGINE (FEATURED BRAIN ARCHITECTURE) */}
          <article className="deep-row deep-row--featured" key={layer3.id}>
            <div className="deep-row__copy">
              <LayerCleanCopy
                layer={layer3}
                badge={
                  <div className="layer-distinct-badge layer-distinct-badge--brain">
                    <div className="badge-split-chips">
                      <span className="chip-pill chip-pill--watcher">
                        <i className="chip-live-dot" /> THE WATCHER · Rule Sentinel
                      </span>
                      <span className="chip-pill chip-pill--brain">
                        <i className="chip-brain-dot" /> THE BRAIN · 98.4% Confidence Root Cause
                      </span>
                    </div>
                  </div>
                }
              />
            </div>
            <Layer03Diagram />
          </article>

          {/* LAYER 04: HERMETIC DOCKER SANDBOX & SIETCH SECURITY (DIAGRAM ON LEFT) */}
          <article className="deep-row deep-row--reverse" key={layer4.id}>
            <div className="deep-row__copy">
              <LayerCleanCopy
                layer={layer4}
                badge={
                  <div className="layer-distinct-badge layer-distinct-badge--security">
                    <span className="badge-tag-pill badge-tag-pill--docker">HERMETIC DOCKER</span>
                    <span>14 regression tests passed in sandbox</span>
                    <span className="badge-tag-pill badge-tag-pill--sietch">SIETCH CANARY: 0 LEAKS</span>
                  </div>
                }
              />
            </div>
            <Layer04Diagram />
          </article>

          {/* LAYER 05: VERIFICATION & OUTCOMES POSTMORTEM SCORECARD */}
          <article className="deep-row" key={layer5.id}>
            <div className="deep-row__copy">
              <LayerCleanCopy
                layer={layer5}
                badge={
                  <div className="layer-distinct-badge layer-distinct-badge--slo">
                    <span className="badge-tag-pill badge-tag-pill--slo">SLO VERIFIED</span>
                    <span>MTTD: <strong>4m 12s</strong> · 30m Zero-Burn Stabilized · Signed Postmortem</span>
                  </div>
                }
              />
            </div>
            <Layer05Diagram />
          </article>
        </div>
      </div>
    </section>
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
              When The Brain proves an incident stems from application code, Patch-Up isolates the culprit commit, creates a clean fix branch, writes targeted regression tests in a disposable Docker environment, and opens a reviewable GitHub PR.
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
              When failure originates in memory pressure, network partitions, upstream outages or runtime drift, Patch-Up supplies exact operator repair commands and rollback guidance while strictly avoiding unapproved production mutations.
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
    desc: 'Grant scoped repository access so Patch-Up can inspect commit history, open fix branches, and submit pull requests for human review.',
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
    snippet: `# 1. Verify Prometheus, Docker, and GitHub permissions in your dashboard\n# 2. Open a test PR with a changed npm package in package.json\n# 3. Review the generated Sietch verdict & Patch-Up diagnosis report`,
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

const capabilitiesList = [
  ['01', 'Continuous Reliability Monitoring', 'Always-on Watcher rules across Prometheus metrics, container health, and deployment streams.'],
  ['02', 'AI Root-Cause Diagnosis', 'Evidence-backed correlation across logs, stack traces, and commit blame—distinguishing code from infra.'],
  ['03', 'Automated Fix Pull Requests', 'Minimal, human-reviewable code patches isolated on dedicated Git branches with full context.'],
  ['04', 'Isolated Regression Testing', 'Every proposed patch is compiled and verified inside a clean Docker environment before PR creation.'],
  ['05', 'Incident Postmortems & Scorecards', 'Automated recovery confirmation, immutable audit trails, and Time-to-Diagnosis scorecards.'],
  ['06', 'Sietch Supply-Chain Security', 'Behavioral Docker sandboxing for new and updated npm packages with canary secret detection.'],
]

const pricingTiers = [
  {
    tier: 'Developer / Starter',
    priceLabel: 'Configurable',
    sub: 'For individual repositories and staging reliability evaluation.',
    items: [
      'Single repository & service integration',
      'Watcher health checks & Brain RCA',
      'Isolated Docker regression runner',
      'Sietch npm PR sandbox checks',
    ],
    cta: 'Start Evaluation',
  },
  {
    tier: 'Team',
    priceLabel: 'Custom per team',
    featured: true,
    sub: 'For production engineering teams running multi-service architectures.',
    items: [
      'Multi-service Prometheus & log correlation',
      'Automated fix PRs with approval gates',
      'Sietch supply-chain policy enforcement',
      'Postmortems, audit trails & MTTD scorecards',
    ],
    cta: 'Get Started',
  },
  {
    tier: 'Enterprise',
    priceLabel: 'Tailored deployment',
    sub: 'For security-sensitive organizations requiring custom governance.',
    items: [
      'Self-hosted or VPC-isolated execution runners',
      'Custom RBAC & human-approval tier policies',
      'Custom telemetry & CI/CD integrations',
      'Dedicated reliability architecture support',
    ],
    cta: 'Contact Engineering',
  },
]

export interface LandingPageProps {
  onEnterDashboard: () => void
}

export default function LandingPage({ onEnterDashboard }: LandingPageProps) {
  const [mobileMenu, setMobileMenu] = useState(false)
  const [darkAccent, setDarkAccent] = useState(false)
  const [heroHoverLayer, setHeroHoverLayer] = useState<number | null>(null)
  const [targetArchLayer, setTargetArchLayer] = useState<number | null>(null)

  useEffect(() => {
    document.documentElement.classList.toggle('theme-dim', darkAccent)
    return () => {
      document.documentElement.classList.remove('theme-dim')
    }
  }, [darkAccent])

  const clearTargetArch = useCallback(() => {
    setTargetArchLayer(null)
  }, [])

  return (
    <div className="site-shell" id="top">
      {/* TOP NAVIGATION BAR */}
      <header className="syntra-header">
        <div className="syntra-header__inner">
          <SyntraLogo />

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
              className="theme-btn"
              onClick={() => setDarkAccent(v => !v)}
              aria-label="Toggle surface contrast"
              title="Toggle contrast"
            >
              <MoonIcon />
            </button>
            <button
              type="button"
              className="login-link cursor-pointer bg-transparent border-0"
              onClick={onEnterDashboard}
            >
              Dashboard
            </button>
            <button
              type="button"
              className="cta-dark-pill cursor-pointer border-0"
              onClick={onEnterDashboard}
            >
              <span>Launch App</span>
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

      {/* HERO SECTION */}
      <main>
        <section className="syntra-hero">
          <div className="syntra-hero__iso-bg" aria-hidden="true" />

          <div className="syntra-hero__container">
            <div className="syntra-hero__left">
              <div className="hero-badge">
                <span className="hero-badge__dot" />
                <span>PATCH-UP · AUTONOMOUS AI SRE</span>
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
                A zero-retention AI Site Reliability Agent that turns push-on-break logs, metrics and commit history into evidence-backed diagnosis, verified PR-only fixes and pre-merge security gates.
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
                <a className="btn-white-pill" href="#architecture">
                  <PlayCircleIcon />
                  <span>Explore architecture</span>
                </a>
              </div>

              <div className="hero-pillars">
                <div className="hero-pillar">
                  <svg viewBox="0 0 24 24" className="hero-pillar__icon" aria-hidden="true">
                    <circle cx="9" cy="8.5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M3.8 18.5c.6-2.7 2.6-4.2 5.2-4.2s4.6 1.5 5.2 4.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <path d="M15.5 6.5a3 3 0 0 1 0 5.2M17.2 14.6c1.6.6 2.7 1.8 3 3.9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <div>
                    <strong>Detect</strong>
                    <span>Always-on monitoring</span>
                  </div>
                </div>

                <div className="hero-pillar">
                  <svg viewBox="0 0 24 24" className="hero-pillar__icon" aria-hidden="true">
                    <path
                      d="M12 3.8l2.45 4.96 5.47.8-3.96 3.86.93 5.45L12 16.3l-4.9 2.57.94-5.45-3.96-3.86 5.47-.8L12 3.8Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div>
                    <strong>Diagnose</strong>
                    <span>Evidence-backed RCA</span>
                  </div>
                </div>

                <div className="hero-pillar">
                  <svg viewBox="0 0 24 24" className="hero-pillar__icon" aria-hidden="true">
                    <path
                      d="M12 3.5l7 3v5.3c0 4.5-2.9 7.6-7 9.2-4.1-1.6-7-4.7-7-9.2V6.5l7-3Z"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <path d="M9.2 12.2l2 2 3.8-3.8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <div>
                    <strong>Verify</strong>
                    <span>Recovery confirmation</span>
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
                onSelectNavigate={idx => setTargetArchLayer(idx)}
              />
            </div>
          </div>
        </section>

        {/* FULL-SCREEN SCROLL-DRIVEN 3D HOLOGRAPHIC JARVIS ARCHITECTURE */}
        <JarvisArchitectureExperience
          externalTargetLayer={targetArchLayer}
          onClearExternalTarget={clearTargetArch}
        />

        {/* FULL-PAGE LAYER EXPLANATIONS */}
        <LayerDeepDives />

        {/* END-TO-END WORKFLOW & SAFETY PATHS */}
        <WorkflowAndSafety />

        {/* SIETCH SUPPLY-CHAIN SECURITY */}
        <SietchSection />

        {/* SERVICES / CAPABILITIES */}
        <section className="capabilities-sec" id="services">
          <div className="container-wide">
            <header className="section-head">
              <p className="section-kicker">
                <span className="dot-orange" /> PLATFORM SERVICES &amp; CAPABILITIES
              </p>
              <h2>Engineered for high-reliability teams.</h2>
            </header>
            <div className="cap-grid">
              {capabilitiesList.map(([num, title, desc]) => (
                <article className="cap-card" key={num}>
                  <span className="cap-card__num">{num}</span>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* DEVELOPER INSTALLATION GUIDE */}
        <InstallationGuide />

        {/* CONFIGURABLE PRICING */}
        <section className="pricing-sec" id="pricing">
          <div className="container-wide">
            <header className="section-head section-head--center">
              <p className="section-kicker">
                <span className="dot-orange" /> CONFIGURABLE PLANS
              </p>
              <h2>Transparent tiers aligned to your reliability surface.</h2>
              <p>Final pricing scales with monitored services, sandbox runner concurrency, and deployment model.</p>
            </header>

            <div className="pricing-grid">
              {pricingTiers.map(t => (
                <article className={`price-card ${t.featured ? 'price-card--featured' : ''}`} key={t.tier}>
                  <div className="price-card__top">
                    <p className="price-card__tier">{t.tier}</p>
                    {t.featured && <span className="price-card__badge">MOST POPULAR</span>}
                  </div>
                  <h3>{t.priceLabel}</h3>
                  <p className="price-card__sub">{t.sub}</p>
                  <ul>
                    {t.items.map(item => (
                      <li key={item}>
                        <span>✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`${t.featured ? 'btn-orange-pill' : 'btn-white-pill'} cursor-pointer`}
                    onClick={onEnterDashboard}
                  >
                    <span>{t.cta}</span>
                    <ArrowRightIcon />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="syntra-footer">
        <div className="container-wide">
          <div className="syntra-footer__top">
            <div>
              <SyntraLogo />
              <p className="syntra-footer__tagline">
                PatchUP — Push-on-break zero-retention AI SRE, PR-only surgical fixes, and 3-layer pre-merge security gate.
              </p>
            </div>
            <div className="syntra-footer__cols">
              <div>
                <strong>Product</strong>
                <a href="#architecture">Architecture</a>
                <a href="#workflow">How It Works</a>
                <a href="#sietch">Security Gate</a>
                <a href="#safety">Safety</a>
              </div>
              <div>
                <strong>Platform</strong>
                <button
                  type="button"
                  onClick={onEnterDashboard}
                  className="bg-transparent border-0 p-0 text-left cursor-pointer"
                  style={{ color: 'inherit', font: 'inherit' }}
                >
                  Live Dashboard
                </button>
                <a href="#install">Installation</a>
                <a href="#services">Services</a>
                <a href="#pricing">Pricing</a>
              </div>
              <div>
                <strong>Connect</strong>
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
