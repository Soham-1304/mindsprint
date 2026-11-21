import { pick, randomChars, randomDigits, randomRange } from "./rng.js";
const FIRST_NAMES = [
    "alex",
    "bianca",
    "carlos",
    "dana",
    "elif",
    "farah",
    "gustav",
    "hana",
    "ivan",
    "jules",
    "kenji",
    "lena",
    "mateo",
    "nora",
    "omar",
    "priya",
    "quinn",
    "rosa",
    "sven",
    "tara",
    "uma",
    "viktor",
    "wen",
    "yara",
    "zoe",
];
const LAST_NAMES = [
    "alder",
    "brandt",
    "castell",
    "dumont",
    "eriksen",
    "fontaine",
    "garner",
    "holt",
    "ibarra",
    "jansen",
    "keller",
    "lindqvist",
    "moreau",
    "novak",
    "okafor",
    "petrov",
    "quist",
    "rinaldi",
    "sato",
    "thorne",
    "ullmann",
    "varga",
    "weiss",
    "yilmaz",
    "zhou",
];
const ORG_PARTS = [
    "bright",
    "cedar",
    "delta",
    "ember",
    "fable",
    "granite",
    "harbor",
    "indigo",
    "juniper",
    "kestrel",
    "lumen",
    "meridian",
    "nimbus",
    "orchard",
    "pioneer",
    "quarry",
    "ridge",
    "summit",
    "tidal",
    "umber",
];
const ORG_SUFFIXES = ["labs", "works", "systems", "software", "io", "dev", "tech", "cloud"];
const REPO_WORDS = [
    "api",
    "billing",
    "gateway",
    "dashboard",
    "ingest",
    "scheduler",
    "notifier",
    "catalog",
    "auth",
    "search",
    "web",
    "worker",
    "reports",
    "sync",
    "portal",
    "console",
    "mailer",
    "metrics",
];
const REPO_KINDS = ["service", "app", "backend", "frontend", "core", "platform", "tools", "client"];
const SLUG = /^[a-z0-9][a-z0-9-]{0,38}$/;
const HOSTNAME = /^runnervm[a-z0-9]{5}$/;
/** Draw a fresh fake identity. */
export function generateIdentity(rng) {
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    const login = `${first}-${last}`;
    const userId = randomDigits(rng, 8);
    const org = `${pick(rng, ORG_PARTS)}${pick(rng, ORG_SUFFIXES)}`;
    const repo = `${pick(rng, REPO_WORDS)}-${pick(rng, REPO_KINDS)}`;
    const initial = (word) => word.charAt(0).toUpperCase() + word.slice(1);
    return {
        login,
        displayName: `${initial(first)} ${initial(last)}`,
        userId,
        email: `${userId}+${login}@users.noreply.github.com`,
        org,
        orgId: randomDigits(rng, 8),
        repo,
        repoId: randomDigits(rng, 9),
        hostname: `runnervm${randomChars(rng, "abcdefghijklmnopqrstuvwxyz0123456789", 5)}`,
        runnerName: `GitHub Actions ${randomRange(rng, 1, 99)}`,
    };
}
/** True if every field of `identity` has the shape `generateIdentity` produces. */
export function isValidIdentity(identity) {
    return (SLUG.test(identity.login) &&
        SLUG.test(identity.org) &&
        SLUG.test(identity.repo) &&
        /^[0-9]{8}$/.test(identity.userId) &&
        /^[0-9]{8}$/.test(identity.orgId) &&
        /^[0-9]{9}$/.test(identity.repoId) &&
        identity.email === `${identity.userId}+${identity.login}@users.noreply.github.com` &&
        HOSTNAME.test(identity.hostname) &&
        /^GitHub Actions [0-9]{1,2}$/.test(identity.runnerName) &&
        /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(identity.displayName));
}
//# sourceMappingURL=identity.js.map