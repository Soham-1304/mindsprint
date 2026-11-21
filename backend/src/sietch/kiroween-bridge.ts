/**
 * Runtime & type bridge to @sietch/core and @sietch/sandbox built in
 * /Users/sohamkarandikar/Documents/Kiroween.
 *
 * Imports the real compiled ESM modules from Kiroween directly (configurable via
 * SIETCH_KIROWEEN_DIR) so zero rules or honeytoken generators are duplicated.
 */

import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type * as SietchCoreTypes from "@sietch/core";
import type * as SietchSandboxTypes from "@sietch/sandbox";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Resolves the Kiroween monorepo root on disk. */
export const KIROWEEN_ROOT = path.resolve(
  process.env.SIETCH_KIROWEEN_DIR ?? path.resolve(__dirname, "../../../../../Kiroween"),
);

const CORE_DIST_URL = pathToFileURL(
  path.join(KIROWEEN_ROOT, "base/core/dist/index.js"),
).href;

const SANDBOX_DIST_URL = pathToFileURL(
  path.join(KIROWEEN_ROOT, "base/sandbox/dist/index.js"),
).href;

export type SietchCoreModule = typeof SietchCoreTypes;
export type SietchSandboxModule = typeof SietchSandboxTypes;

// Re-export key types from @sietch/core and @sietch/sandbox for clean downstream imports
export type {
  CompiledHoneytokens,
  Event,
  EventType,
  Finding,
  HoneytokenEncoding,
  HoneytokenKind,
  HoneytokenMatch,
  PackageIdentity,
  RuleId,
  ScanInput,
  Severity,
  Verdict,
  VerdictKind,
} from "@sietch/core";

export type {
  FakeDirectory,
  FakeFile,
  FakeHome,
  PlantedHoneytoken,
  Profile,
  ProfileFile,
  Rng,
} from "@sietch/sandbox";

let cachedCore: SietchCoreModule | null = null;
let cachedSandbox: SietchSandboxModule | null = null;

/** Load the real @sietch/core module from Kiroween. */
export async function loadSietchCore(): Promise<SietchCoreModule> {
  if (!cachedCore) {
    cachedCore = (await import(CORE_DIST_URL)) as SietchCoreModule;
  }
  return cachedCore;
}

/** Load the real @sietch/sandbox module from Kiroween. */
export async function loadSietchSandbox(): Promise<SietchSandboxModule> {
  if (!cachedSandbox) {
    cachedSandbox = (await import(SANDBOX_DIST_URL)) as SietchSandboxModule;
  }
  return cachedSandbox;
}

/** Production CSPRNG matching @sietch/sandbox's Rng interface. */
export function createCryptoRng(): SietchSandboxTypes.Rng {
  return (length: number): Uint8Array => new Uint8Array(crypto.randomBytes(length));
}

/** Deterministic PRNG (SHA-256 CTR stream) for reproducible demos and unit tests. */
export function createSeededRng(seed: string): SietchSandboxTypes.Rng {
  let counter = 0;
  return (length: number): Uint8Array => {
    const out = new Uint8Array(length);
    let offset = 0;
    while (offset < length) {
      const digest = crypto
        .createHash("sha256")
        .update(`${seed}:${counter++}`)
        .digest();
      const take = Math.min(digest.length, length - offset);
      out.set(digest.subarray(0, take), offset);
      offset += take;
    }
    return out;
  };
}

/** Compute an npm-compatible sha512 Subresource Integrity string. */
export function computeSha512Integrity(data: string | Uint8Array): string {
  const hash = crypto.createHash("sha512").update(data).digest("base64");
  return `sha512-${hash}`;
}
