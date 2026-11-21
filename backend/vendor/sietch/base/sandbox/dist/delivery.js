import { encodeFrames } from "./framing.js";
import { MAX_DEPS_BYTES, MAX_HOME_BYTES } from "./limits.js";
import { fakeHomeTar } from "./tar.js";
/**
 * Builds the detonation container's delivery stream (design D3): `[u64 length][home tar][u64 length][cache tar]`.
 * The home part is the fake home plus init's two files under `.init/` (the control file and the per-scan CA
 * certificate, public part only) and the project's `package.json` and lockfile. The CA private key never
 * goes in here: it travels only to the sink.
 */
const encoder = new TextEncoder();
const DEFAULT_MTIME_SECONDS = 1_700_000_000;
/** The `control.json` content for a profile. */
export function controlFor(profile, sinkAddress, observeSeconds) {
    return { env: { ...profile.env }, projectDir: profile.projectDir, sinkAddress, observeSeconds };
}
/** The empty npm cache: a tar with only its end marker. */
export function emptyCacheTar() {
    return new Uint8Array(1024);
}
/** The home part alone. */
export function homePart(input) {
    const { profile, home } = input;
    const control = input.controlBytes ??
        encoder.encode(JSON.stringify(controlFor(profile, input.sinkAddress, input.observeSeconds)));
    const extra = (path, bytes, mode) => ({
        path: `${home.home}/${path}`,
        bytes,
        mode,
    });
    const withInit = {
        ...home,
        directories: [...home.directories, { path: `${home.home}/.init`, mode: 0o700 }],
        files: [
            ...home.files,
            extra(".init/control.json", control, 0o600),
            extra(".init/ca.pem", encoder.encode(input.caCertPem), 0o600),
            { path: `${profile.projectDir}/package.json`, bytes: input.project.packageJson, mode: 0o644 },
            { path: `${profile.projectDir}/package-lock.json`, bytes: input.project.lockfile, mode: 0o644 },
        ],
    };
    return fakeHomeTar(withInit, { mtimeSeconds: DEFAULT_MTIME_SECONDS });
}
/** The whole stream. */
export function buildDelivery(input) {
    return framed(homePart(input), input.cacheTar);
}
/** Frames two parts with the container's caps. */
export function framed(home, cache) {
    return encodeFrames([home, cache], [MAX_HOME_BYTES, MAX_DEPS_BYTES]);
}
//# sourceMappingURL=delivery.js.map