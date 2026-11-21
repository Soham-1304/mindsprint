import type { ExecEvent } from "./schema.js";
import type { PathViews } from "./views.js";
/**
 * Every lowercase name the exec could be running: the basename of each view of its path (so a
 * symlink /tmp/c -> /usr/bin/curl is "curl"), and for busybox or toybox, the applet in argv[1].
 */
export declare function programNames(event: ExecEvent, views?: PathViews): string[];
/** True if any of the names is in the set. */
export declare const anyIn: (names: readonly string[], set: ReadonlySet<string>) => boolean;
/** Arguments after the program name, lowercased (after the applet for busybox and toybox). */
export declare function argsOf(event: ExecEvent, names: readonly string[]): string[];
export declare const PACKAGE_MANAGERS: Set<string>;
/**
 * If the exec runs a package manager, its name and the arguments after it. Covers both
 * `/usr/local/bin/npm publish` and `node .../npm-cli.js publish`.
 */
export declare function packageManagerCall(event: ExecEvent, names: readonly string[]): {
    name: string;
    args: string[];
} | null;
/** npm's own abbreviations for registry-changing commands (npm 11 lib/utils/cmd-list.js), plus "token". */
export declare const REGISTRY_WRITE_COMMANDS: Set<string>;
export declare const NETWORK_TOOLS: Set<string>;
export declare const ALTERNATIVE_RUNTIMES: Set<string>;
export declare const NPM_REGISTRY_HOSTS: Set<string>;
export declare const GITHUB_HOSTS: Set<string>;
export declare const WRITE_METHODS: Set<string>;
/** Positional (non-option) arguments. */
export declare const positional: (args: readonly string[]) => string[];
//# sourceMappingURL=programs.d.ts.map