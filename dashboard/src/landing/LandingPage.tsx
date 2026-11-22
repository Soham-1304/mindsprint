import { ArrowRight, GitPullRequest, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ArchitectureScene } from "@/components/3d/ArchitectureScene";
import type { TowerNodeId } from "@/components/3d/types";
import { PatchUpWordmark } from "@/components/PatchUpWordmark";

export interface LandingPageProps {
  onEnterDashboard: () => void;
}

const DEMO_HEALTH = {
  "ai-engine": "HEALTHY",
  "layer-ai-engine": "HEALTHY",
  "backend-service": "HEALTHY",
  "layer-backend": "HEALTHY",
  "gateway-service": "HEALTHY",
  "layer-gateway": "HEALTHY",
  "frontend-service": "HEALTHY",
  "layer-frontend": "HEALTHY",
  "git-sep": "HEALTHY",
  "layer-git-sep": "HEALTHY",
} as const;

export default function LandingPage({ onEnterDashboard }: LandingPageProps) {
  const [hovered, setHovered] = useState<TowerNodeId | null>(null);

  return (
    <div className="min-h-dvh flex flex-col bg-[#FAF8F5] text-[#181614]">
      {/* Unified 48px Top Bar — Exact same logo, height, and palette as the Dashboard */}
      <header className="sticky top-0 z-40 border-b border-[#EAE2D9] bg-[#FAF8F5]/90 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-[1280px] items-center justify-between gap-4 px-5">
          <PatchUpWordmark compact />

          <nav aria-label="Landing" className="hidden md:flex items-center gap-6 text-[13px] font-medium text-[#5C5650]">
            <a href="#how-it-works" className="hover:text-[#181614] transition-colors">
              How it works
            </a>
            <a href="#security" className="hover:text-[#181614] transition-colors">
              Security gate
            </a>
            <a
              href="https://github.com/Soham-1304/mindsprint"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#181614] transition-colors"
            >
              GitHub
            </a>
          </nav>

          <button
            type="button"
            onClick={onEnterDashboard}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#181614] px-4 text-[12.5px] font-medium text-white transition-colors hover:bg-[#2F2B28] cursor-pointer"
          >
            <span>Open Dashboard</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Clean, De-Cluttered Hero with Live 3D Ceramic & Orange Chip Stack */}
        <section className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-8 px-5 py-12 lg:grid-cols-[1.02fr_0.98fr] lg:py-16">
          <div className="space-y-6">
            <h1 className="text-[42px] font-bold leading-[1.06] tracking-[-0.035em] text-[#181614] sm:text-[54px]">
              Detect failures.
              <br />
              Diagnose root cause.
              <br />
              Ship <span className="text-[#FF5500]">PR-only</span> fixes.
            </h1>

            <p className="max-w-[50ch] text-[15.5px] leading-relaxed text-[#5C5650]">
              PatchUP is a push-on-break, zero-retention AI SRE agent with a 3-layer pre-merge
              security gate. When production faults, it isolates the culprit commit in seconds,
              opens a verified GitHub Fix PR, and purges memory immediately.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onEnterDashboard}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#FF5500] px-6 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[#E04B00] cursor-pointer"
              >
                <span>Open Live Dashboard</span>
                <ArrowRight size={15} />
              </button>
              <a
                href="#how-it-works"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-[#DFD5CA] bg-white px-5 text-[14px] font-medium text-[#181614] transition-colors hover:bg-[#F4EFE9]"
              >
                How it works
              </a>
            </div>

            <div className="grid grid-cols-3 gap-4 border-t border-[#EAE2D9] pt-6 max-w-[480px]">
              <div>
                <div className="font-mono text-[18px] font-bold text-[#181614] tabular-nums">
                  ~16s
                </div>
                <div className="text-[12px] text-[#665E56]">Mean diagnosis</div>
              </div>
              <div>
                <div className="font-mono text-[18px] font-bold text-[#15803D] tabular-nums">
                  0 B
                </div>
                <div className="text-[12px] text-[#665E56]">Logs retained</div>
              </div>
              <div>
                <div className="font-mono text-[18px] font-bold text-[#181614]">PR-only</div>
                <div className="text-[12px] text-[#665E56]">main protected</div>
              </div>
            </div>
          </div>

          {/* Interactive 3D Chip Stack (Same visual world as Dashboard Architecture) */}
          <div className="relative h-[440px] w-full overflow-hidden rounded-2xl border border-[#EAE2D9] bg-[#FAF8F5] lg:h-[500px]">
            <ArchitectureScene
              hoveredServiceId={hovered}
              selectedServiceId={null}
              layerHealth={{ ...DEMO_HEALTH }}
              onHoverService={setHovered}
              onSelectService={() => onEnterDashboard()}
            />
          </div>
        </section>

        {/* How PatchUP Works — 3 Crisp, Honest Pillars */}
        <section id="how-it-works" className="border-t border-[#EAE2D9] bg-white">
          <div className="mx-auto max-w-[1280px] px-5 py-16">
            <h2 className="text-[26px] font-bold tracking-[-0.025em] text-[#181614]">
              From production fault to reviewable fix PR.
            </h2>

            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="rounded-xl border border-[#EAE2D9] bg-[#FAF8F5] p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#FBD3B7] bg-[#FFF5EE] text-[#FF5500]">
                  <Lock size={17} />
                </div>
                <h3 className="mt-4 text-[15.5px] font-semibold text-[#181614]">
                  Push-on-break, zero retention
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#5C5650]">
                  No 24/7 log storage. Services push scrubbed error bundles only when a 5xx spike
                  fires. PII is redacted before diagnosis and volatile RAM is purged with a SHA-256
                  receipt.
                </p>
              </div>

              <div className="rounded-xl border border-[#EAE2D9] bg-[#FAF8F5] p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#FBD3B7] bg-[#FFF5EE] text-[#FF5500]">
                  <GitPullRequest size={17} />
                </div>
                <h3 className="mt-4 text-[15.5px] font-semibold text-[#181614]">
                  Surgical PR-only remediation
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#5C5650]">
                  Traces stack frames to the culprit commit, ranks counterfactual strategies,
                  verifies syntax and security on its own patch, and opens a GitHub PR—never
                  pushing to main.
                </p>
              </div>

              <div id="security" className="rounded-xl border border-[#EAE2D9] bg-[#FAF8F5] p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#FBD3B7] bg-[#FFF5EE] text-[#FF5500]">
                  <ShieldCheck size={17} />
                </div>
                <h3 className="mt-4 text-[15.5px] font-semibold text-[#181614]">
                  3-layer pre-merge security gate
                </h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#5C5650]">
                  Detonates new npm packages with honeytoken tripwires, flags typosquats, and
                  blocks leaked secrets or unsafe container configs via live GitHub Check Runs.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Minimal Unified Footer */}
      <footer className="border-t border-[#EAE2D9] bg-[#FAF8F5]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-6 text-[12.5px] text-[#665E56]">
          <PatchUpWordmark compact />
          <div className="flex items-center gap-5">
            <a
              href="https://github.com/Soham-1304/mindsprint"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#181614]"
            >
              GitHub
            </a>
            <button
              type="button"
              onClick={onEnterDashboard}
              className="font-medium text-[#181614] hover:text-[#FF5500] cursor-pointer"
            >
              Open Dashboard →
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
