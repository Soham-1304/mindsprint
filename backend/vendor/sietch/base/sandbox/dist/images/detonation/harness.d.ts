/**
 * The load harness: it loads every dependency of the project, the way an application that depends on the
 * package would, so a payload that waits for `require` or `import` runs while the trace is recording. It
 * runs in the load phase, after install, as the process the `load` marker execs.
 *
 * Pure core with injected `readFile`, `requireModule` and `importModule`, so it is tested without loading
 * anything. For each key of the project's `dependencies` it calls `requireModule(name)` and then
 * `importModule(name)`, each in its own `try`, and swallows every error (a package that throws, or one
 * that can't be loaded one way, must not stop the others). It writes nothing: the trace is the record.
 */
export declare const MAX_HARNESS_DEPENDENCIES = 1000;
export interface HarnessDeps {
    /** Reads `./package.json` as text. May throw. */
    readFile(): string;
    requireModule(name: string): unknown;
    importModule(name: string): Promise<unknown>;
}
export interface HarnessResult {
    /** Dependency names the harness tried. */
    readonly attempted: number;
}
/** The dependency names to load: valid package names only, at most `MAX_HARNESS_DEPENDENCIES`. */
export declare function dependencyNames(packageJsonText: string): string[];
export declare function runHarness(deps: HarnessDeps): Promise<HarnessResult>;
//# sourceMappingURL=harness.d.ts.map