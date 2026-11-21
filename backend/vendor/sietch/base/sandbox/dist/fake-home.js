import { FakeEnvironmentError } from "./errors.js";
import { MAX_HOME_BYTES } from "./limits.js";
import { SAFE_SEGMENT } from "./safe-path.js";
/** Printable ASCII, newline, and tab. */
const PLAIN_TEXT = /^[\t\n -~]*$/;
const MAX_PATH_LENGTH = 4096;
const PRIVATE_DIRECTORIES = new Set([".ssh", ".gnupg"]);
const encoder = new TextEncoder();
function checkPath(path, home) {
    if (path.length > MAX_PATH_LENGTH || !path.startsWith(`${home}/`)) {
        throw new FakeEnvironmentError("a planted path is not inside the fake home");
    }
    const segments = path.slice(home.length + 1).split("/");
    if (segments.some((s) => !SAFE_SEGMENT.test(s))) {
        throw new FakeEnvironmentError("a planted path has an unsafe segment");
    }
    return segments;
}
/** Build the tree for a profile. Throws `FakeEnvironmentError` for anything out of place. */
export function buildFakeHome(profile) {
    const home = profile.home;
    if (!/^\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*$/.test(home)) {
        throw new FakeEnvironmentError("the home directory is not a clean absolute path");
    }
    const files = new Map();
    const directories = new Map();
    let total = 0;
    for (const planted of profile.files) {
        const segments = checkPath(planted.path, home);
        if (files.has(planted.path))
            throw new FakeEnvironmentError("a path is planted twice");
        if (!PLAIN_TEXT.test(planted.content)) {
            throw new FakeEnvironmentError("planted content must be printable ASCII");
        }
        if (!Number.isInteger(planted.mode) || planted.mode < 0 || planted.mode > 0o777) {
            throw new FakeEnvironmentError("planted file mode out of range");
        }
        const bytes = encoder.encode(planted.content);
        total += bytes.length;
        if (total > MAX_HOME_BYTES)
            throw new FakeEnvironmentError("the fake home is too large");
        files.set(planted.path, { path: planted.path, bytes, mode: planted.mode });
        let dir = home;
        for (const segment of segments.slice(0, -1)) {
            dir = `${dir}/${segment}`;
            if (!directories.has(dir)) {
                directories.set(dir, { path: dir, mode: PRIVATE_DIRECTORIES.has(segment) ? 0o700 : 0o755 });
            }
        }
    }
    for (const dir of directories.keys()) {
        if (files.has(dir))
            throw new FakeEnvironmentError("a path is both a file and a directory");
    }
    const byPath = (a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
    const credentialPaths = profile.files.filter((f) => f.credential !== undefined).map((f) => f.path);
    const extraCredentialPaths = profile.files.filter((f) => f.credential === "extra").map((f) => f.path);
    return {
        home,
        files: [...files.values()].sort(byPath),
        // Sorting by path puts a parent directly before its children.
        directories: [...directories.values()].sort(byPath),
        credentialPaths: credentialPaths.sort(),
        extraCredentialPaths: extraCredentialPaths.sort(),
    };
}
//# sourceMappingURL=fake-home.js.map