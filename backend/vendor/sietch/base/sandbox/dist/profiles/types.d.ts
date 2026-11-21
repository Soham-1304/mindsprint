import type { HoneytokenKind } from "@sietch/core";
/**
 * Where a registered honeytoken value was planted. It must appear there verbatim, except for a file
 * placement with `encoding: "base64"`: the value is then inside a base64 run of the file's content (a
 * Docker `auth` field), and the check decodes the runs to find it.
 */
export type Placement = {
    readonly type: "file";
    readonly path: string;
    readonly encoding?: "base64";
} | {
    readonly type: "env";
    readonly name: string;
};
/** A honeytoken as the engine takes it (`id`, `kind`, `value`) plus where it was planted. */
export interface PlantedHoneytoken {
    readonly id: string;
    readonly kind: HoneytokenKind;
    readonly value: string;
    readonly placement: Placement;
}
/**
 * A file to plant. `credential` marks a file the engine must treat as a credential store, and says how:
 * `builtin` means the engine already knows the path (under its home credential entries, or matched by its
 * `.env` rule), `extra` means the path goes into `environment.extraCredentialPaths`. The engine round-trip
 * test reads every credential file through the real `judge`, so a wrong mark fails a test.
 */
export interface ProfileFile {
    /** Absolute path inside the container. */
    readonly path: string;
    /** Printable ASCII and newlines. */
    readonly content: string;
    /** Permission bits, for example 0o600. */
    readonly mode: number;
    readonly credential?: "builtin" | "extra";
}
/** An environment profile: what the sandbox looks like from inside, with every fake in place. */
export interface Profile {
    readonly name: "ci-github-actions";
    readonly user: string;
    readonly hostname: string;
    readonly home: string;
    /** The project directory and working directory (`$GITHUB_WORKSPACE` in the CI profile). */
    readonly projectDir: string;
    readonly nodeModulesDir: string;
    /** Scratch directories on tmpfs, for the engine's `tmpDirs`. */
    readonly tmpDirs: readonly string[];
    /** Environment variables for the install and load processes. Some values are honeytokens. */
    readonly env: Readonly<Record<string, string>>;
    readonly files: readonly ProfileFile[];
    readonly honeytokens: readonly PlantedHoneytoken[];
}
//# sourceMappingURL=types.d.ts.map