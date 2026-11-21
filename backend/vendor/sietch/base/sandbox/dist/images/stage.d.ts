import { SietchError } from "@sietch/core";
import { type ImageName } from "./image-spec.js";
/**
 * Builds the Docker build context for one image in a fresh directory:
 *
 * ```
 * Dockerfile                      from base/sandbox/images/<image>/ (linted first)
 * lib/package.json                {"type":"module"}
 * lib/sandbox/<file>.js           only the files IMAGE_FILES lists for the image
 * lib/node_modules/@sietch/core   package.json and the .js files of core's dist
 * lib/node_modules/zod            package.json files and .js files, read through the pnpm link
 * runner/install, runner/load     detonation image only, from the `renderMarkers` hook
 * ```
 *
 * Only files this function names are copied, never a directory tree of ours. It refuses a listed file that
 * is a declaration, a source map or a test, that resolves outside `base/sandbox/dist`, or that is a link.
 * It also checks the built files: every relative import must be another listed file, and every other
 * import must be `node:*`, `@sietch/core` or `zod`, so an image can't start and then fail on a missing
 * module. Nothing is installed and no network is used.
 *
 * Every check that doesn't need the output directory runs before the first byte is written. A failure
 * during the copy itself (a link in core's dist, an oversize tree) can leave a partial directory, so the
 * caller owns `outDir` and removes it (`buildImage` does).
 */
export declare class StageError extends SietchError {
    constructor(message: string);
}
export interface RenderedMarkers {
    readonly install: string;
    readonly load: string;
}
/** Renders the two executable marker scripts the detonation image runs. The detonation FEAT fills it in. */
export type RenderMarkers = () => RenderedMarkers;
export interface StageOptions {
    readonly image: ImageName;
    /** The repository root, as an absolute path. Everything copied must resolve inside it. */
    readonly repoRoot: string;
    /** An absolute path to an empty or missing directory. */
    readonly outDir: string;
    /** Required for the detonation image, refused for the others. */
    readonly renderMarkers?: RenderMarkers;
    /** Overrides `IMAGE_FILES` (tests only). */
    readonly allowlist?: Readonly<Record<ImageName, readonly string[]>>;
}
export interface StageResult {
    /** Every file written, relative to `outDir`, sorted. */
    readonly files: readonly string[];
}
/** The module specifiers a source or compiled file loads at run time. */
export declare function moduleSpecifiers(text: string): readonly string[];
/** True for the modules an image has besides its own files: Node's, core, and zod. */
export declare function isImageProvidedModule(specifier: string): boolean;
/** Resolves a relative specifier against a dist-relative file path. Returns null when it leaves dist. */
export declare function resolveRelativeImport(fromFile: string, specifier: string): string | null;
export declare function stageImageContext(options: StageOptions): Promise<StageResult>;
//# sourceMappingURL=stage.d.ts.map