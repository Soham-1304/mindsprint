import { type Event, type ScanInput } from "@sietch/core";
import type { Profile } from "./profiles/types.js";
/**
 * Build the `ScanInput` that `judge` takes (Requirement 12.1 and 12.6, design "Invariant ownership"). Pure.
 *
 * - `environment.home`, `projectDir`, `nodeModulesDir`, and `tmpDirs` (`/tmp` and `RUNNER_TEMP` in the CI
 *   profile) come from the profile.
 * - `sinkAddresses` is the sink's fixed address on the per-scan network.
 * - `packageManagerPid` is npm's pid from the normaliser, which the engine exempts for npm's own reads.
 * - `extraCredentialPaths` are the planted credential files the engine doesn't know by itself
 *   (`FakeHome.extraCredentialPaths`), so reading one of them still raises R2.
 * - `honeytokens` are the registered values without their placement.
 *
 * An empty honeytoken list or an empty sink address list is refused: with no honeytokens rule R1 has
 * nothing to find, so the scan could come back SAFE. Only a profile bug can cause it.
 *
 * The result is checked with `validateScanInput` before it is returned (fail closed). A failure returns
 * `INVALID_SCAN_INPUT` with the engine's reason, which names field paths and issue codes and never a value.
 */
export interface AssembleInput {
    readonly package: {
        readonly name: string;
        readonly version: string;
        readonly integrity: string;
    };
    readonly profile: Pick<Profile, "home" | "projectDir" | "nodeModulesDir" | "tmpDirs" | "honeytokens">;
    /** `FakeHome.extraCredentialPaths`. */
    readonly extraCredentialPaths: readonly string[];
    readonly sinkAddresses: readonly string[];
    readonly packageManagerPid: number;
    readonly allowlist: readonly string[];
    /** Merged process and sink events, with `seq` from 1. */
    readonly events: readonly Event[];
    readonly eventsTruncated: boolean;
}
export type AssembleResult = {
    readonly ok: true;
    readonly scanInput: ScanInput;
} | {
    readonly ok: false;
    readonly code: "INVALID_SCAN_INPUT";
    readonly reason: string;
};
export declare function assembleScanInput(input: AssembleInput): AssembleResult;
//# sourceMappingURL=assemble.d.ts.map