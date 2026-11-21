import { type Rule } from "./types.js";
/**
 * R2: a package process reads a credential store, or links to one. Every name the path can be
 * reached by is checked: earlier symlinks, hard links, and /proc/<pid>/root aliases.
 */
export declare const r02CredentialAccess: Rule;
/** " (reached as X)" when a view other than the recorded path matters. */
export declare function via(all: readonly string[] | undefined, recorded: string, show: (s: string) => string): string;
//# sourceMappingURL=r02-credential-access.d.ts.map