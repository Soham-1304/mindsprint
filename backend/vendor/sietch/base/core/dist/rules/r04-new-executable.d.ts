import { type Rule } from "./types.js";
/**
 * R4: running a file the package wrote outside node_modules during the scan, or running an
 * alternative JavaScript runtime. Shai-Hulud 2.0 installed and ran Bun to avoid Node-level hooks.
 * Downloading and running a binary inside node_modules (esbuild, sharp) is normal and not flagged.
 * Every name of each path is checked, so a symlink can't hide where a file really is.
 */
export declare const r04NewExecutable: Rule;
//# sourceMappingURL=r04-new-executable.d.ts.map