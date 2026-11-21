import { type CompiledHoneytokens } from "./honeytokens.js";
import { type CompiledAllowlist } from "./hosts.js";
import type { Event, ScanInput } from "./schema.js";
import { type PathViews } from "./views.js";
/** Home-relative credential stores (Requirement 6.3). */
export declare const HOME_CREDENTIAL_ENTRIES: readonly [".npmrc", ".yarnrc", ".yarnrc.yml", ".config/gh", ".git-credentials", ".netrc", ".aws", ".ssh", ".docker/config.json", ".kube", ".config/gcloud", ".azure", ".gnupg", ".pypirc", ".bash_history", ".zsh_history", ".config/git/credentials", ".local/share/keyrings", ".password-store", ".config/google-chrome", ".config/chromium", ".config/BraveSoftware", ".mozilla", ".electrum", ".bitcoin", ".ethereum", ".config/solana", ".config/Exodus"];
/** Home-relative directories a package may write to (caches). */
export declare const HOME_WRITE_ROOTS: readonly [".npm", ".cache", ".node-gyp"];
export declare const HARMLESS_DEVICES: readonly ["/dev/null", "/dev/stdout", "/dev/stderr", "/dev/tty"];
export interface EventViews {
    readonly path?: PathViews;
    readonly target?: PathViews;
}
export interface RuleContext {
    readonly input: ScanInput;
    /** Sorted by seq. Paths and link targets are lexically normalised (for display and grouping). */
    readonly events: readonly Event[];
    readonly seqs: ReadonlySet<number>;
    readonly lastSeq: number;
    readonly home: string;
    readonly nodeModulesDir: string;
    readonly sinkAddresses: ReadonlySet<string>;
    readonly allowlist: CompiledAllowlist;
    readonly honeytokens: CompiledHoneytokens;
    /** Events not made by the package manager during install. dns and http are always package events. */
    isPackageEvent(event: Event): boolean;
    /** Every name the event's path (and link target) could refer to, given links created before it. */
    viewsOf(event: Event): EventViews;
    /** True if any view is a credential store. */
    touchesCredentials(views: PathViews | undefined): boolean;
    /** True only if every view is inside the allowed write area, and the views are complete. */
    isAllowedWrite(views: PathViews | undefined): boolean;
    /** Show an untrusted value: honeytokens redacted, unsafe characters escaped, length capped. */
    show(value: string): string;
}
export declare function buildContext(input: ScanInput): RuleContext;
/**
 * Replace every occurrence of each token, in any letter case, with its redacted form. Longest
 * tokens go first, so a token that contains another is redacted whole. The redacted form ends
 * in "…", which no token contains, so a replacement can never join pieces into a new full token.
 */
export declare function redactTokens(value: string, tokenValues: readonly string[]): string;
//# sourceMappingURL=context.d.ts.map