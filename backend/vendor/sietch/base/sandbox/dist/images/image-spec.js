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
export const BASE_IMAGE_REF = "node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5";
export const IMAGE_NAMES = ["detonation", "sink", "fetch", "proxy"];
export function isImageName(value) {
    return typeof value === "string" && IMAGE_NAMES.includes(value);
}
/** Local image repository names are `<prefix><image>`. A product rename changes this one constant. */
export const IMAGE_NAME_PREFIX = "sietch-sandbox-";
/** The tag a local build gets. Runs never use it: they use `name@sha256:<id>`. */
export const IMAGE_TAG = "local";
/** Where the runner's own files live inside an image. Root-owned and read-only at run time. */
export const RUNNER_ROOT = "/opt/runner";
/** Our compiled code and its two dependencies. */
export const LIB_ROOT = "/opt/runner/lib";
/** Where `dist/` is copied to under `LIB_ROOT`. */
export const LIB_SANDBOX_DIR = "sandbox";
/** The Node binary in the base image. Entrypoints use the absolute path. */
export const NODE_BINARY = "/usr/local/bin/node";
export function imageRepository(image) {
    if (!isImageName(image))
        throw new TypeError("unknown image name");
    return `${IMAGE_NAME_PREFIX}${image}`;
}
/** Entry file per image, relative to `dist/`. */
export const IMAGE_ENTRY_FILES = {
    detonation: "images/detonation/main.js",
    sink: "images/sink/main.js",
    fetch: "images/fetch/main.js",
    proxy: "images/proxy/main.js",
};
/** The absolute path the image's `ENTRYPOINT` runs. */
export function imageEntrypointPath(image) {
    if (!isImageName(image))
        throw new TypeError("unknown image name");
    return `${LIB_ROOT}/${LIB_SANDBOX_DIR}/${IMAGE_ENTRY_FILES[image]}`;
}
/**
 * The compiled files each image may contain, as paths relative to `base/sandbox/dist`, every one a
 * `.js` file. The stager copies exactly these, and a test checks that the relative imports reachable
 * from the image's entry files are all listed. An image's FEAT fills in its own list.
 *
 * Keep one image per block with a comment between, so parallel branches merge cleanly.
 */
export const IMAGE_FILES = {
    // detonation (Task 8). The marker renderer (markers.ts) is host-side only and is not in the image.
    detonation: [
        "framing.js",
        "limits.js",
        "tar-path.js",
        "images/detonation/ca-bundle.js",
        "images/detonation/control.js",
        "images/detonation/dns-relay.js",
        "images/detonation/exit-codes.js",
        "images/detonation/extract.js",
        "images/detonation/harness-main.js",
        "images/detonation/harness.js",
        "images/detonation/init.js",
        "images/detonation/layout.js",
        "images/detonation/main.js",
        "images/detonation/relay-main.js",
        "images/detonation/tar-reader.js",
    ],
    // sink (Task 9)
    sink: [
        "ca.js",
        "der.js",
        "framing.js",
        "images/sink/config.js",
        "images/sink/dns-responder.js",
        "images/sink/http-connection.js",
        "images/sink/limits.js",
        "images/sink/main.js",
        "images/sink/recorder.js",
        "images/sink/run.js",
        "images/sink/servers.js",
        "limits.js",
        "sink/parse-dns.js",
        "sink/parse-http.js",
        "sink/records.js",
    ],
    // fetch (Task 10)
    fetch: [
        "framing.js",
        "images/fetch/cache-tar.js",
        "images/fetch/limits.js",
        "images/fetch/main.js",
        "images/fetch/npm-argv.js",
        "images/fetch/request-frame.js",
        "images/fetch/script-report-builder.js",
        "images/fetch/stages.js",
        "limits.js",
        "request.js",
        "script-report.js",
        "synthetic-package.js",
    ],
    // proxy (Task 10)
    proxy: [
        "docker-args.js",
        "images/proxy/config.js",
        "images/proxy/connect-policy.js",
        "images/proxy/ip-class.js",
        "images/proxy/main.js",
        "images/proxy/proxy-server.js",
        "limits.js",
        "scan-id.js",
    ],
};
//# sourceMappingURL=image-spec.js.map