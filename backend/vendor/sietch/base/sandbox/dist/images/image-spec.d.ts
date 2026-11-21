/**
 * What the four container images have in common: the pinned base, the names, where our code lives
 * inside an image, and which compiled files each image may contain. The Dockerfile linter, the context
 * stager and the build driver all read these constants, so the three can't drift apart.
 *
 * Each image's TypeScript lives in `src/images/<name>/`, compiles to `dist/images/<name>/`, and is
 * copied into the image under `LIB_ROOT/sandbox/`. `@sietch/core` and `zod` sit next to it in
 * `LIB_ROOT/node_modules/`, so plain Node resolution finds them. Nothing is installed at build time.
 */
/**
 * The only `FROM` any Sietch image may use: `node:24-alpine` pinned by digest, as pulled into the
 * Colima VM. Changing it is a security change (it needs a review and a build-log note).
 */
export declare const BASE_IMAGE_REF = "node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5";
export declare const IMAGE_NAMES: readonly ["detonation", "sink", "fetch", "proxy"];
export type ImageName = (typeof IMAGE_NAMES)[number];
export declare function isImageName(value: unknown): value is ImageName;
/** Local image repository names are `<prefix><image>`. A product rename changes this one constant. */
export declare const IMAGE_NAME_PREFIX = "sietch-sandbox-";
/** The tag a local build gets. Runs never use it: they use `name@sha256:<id>`. */
export declare const IMAGE_TAG = "local";
/** Where the runner's own files live inside an image. Root-owned and read-only at run time. */
export declare const RUNNER_ROOT = "/opt/runner";
/** Our compiled code and its two dependencies. */
export declare const LIB_ROOT = "/opt/runner/lib";
/** Where `dist/` is copied to under `LIB_ROOT`. */
export declare const LIB_SANDBOX_DIR = "sandbox";
/** The Node binary in the base image. Entrypoints use the absolute path. */
export declare const NODE_BINARY = "/usr/local/bin/node";
export declare function imageRepository(image: ImageName): string;
/** Entry file per image, relative to `dist/`. */
export declare const IMAGE_ENTRY_FILES: Readonly<Record<ImageName, string>>;
/** The absolute path the image's `ENTRYPOINT` runs. */
export declare function imageEntrypointPath(image: ImageName): string;
/**
 * The compiled files each image may contain, as paths relative to `base/sandbox/dist`, every one a
 * `.js` file. The stager copies exactly these, and a test checks that the relative imports reachable
 * from the image's entry files are all listed. An image's FEAT fills in its own list.
 *
 * Keep one image per block with a comment between, so parallel branches merge cleanly.
 */
export declare const IMAGE_FILES: Readonly<Record<ImageName, readonly string[]>>;
//# sourceMappingURL=image-spec.d.ts.map