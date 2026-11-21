// P0 environment profile: a GitHub-hosted Ubuntu runner mid-job (spec design D4).
//
// Nothing here names this project: no variable, path, file name, or value says what is watching. The
// fake identity, files, and variables all tell one consistent story. Every secret is built from the
// injected rng and is never a real credential. Generated values are never logged or committed.
import { FakeEnvironmentError } from "../errors.js";
import { aws, env as envSecrets, gcp, generic, github, npm, oidc, ssh } from "../honeytokens/index.js";
import { generateIdentity } from "../identity.js";
import { pick, randomDigits, randomHex, randomRange, randomUuid } from "../rng.js";
export const CI_USER = "runner";
export const CI_HOME = "/home/runner";
export const CI_TOOL_CACHE = "/opt/hostedtoolcache";
const AWS_REGIONS = ["us-east-1", "us-east-2", "us-west-2", "eu-west-1", "eu-central-1"];
const GCP_SERVICE_ACCOUNT = "github-actions";
/** Build the GitHub Actions CI profile, with fresh fakes. Pass a fresh identity or let it draw one. */
export function buildCiProfile(deps, identity = generateIdentity(deps.rng)) {
    const { rng } = deps;
    const nowMs = deps.clock();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0)
        throw new FakeEnvironmentError("clock returned a bad time");
    const nowSeconds = Math.floor(nowMs / 1000);
    const workspace = `${CI_HOME}/work/${identity.repo}/${identity.repo}`;
    const runnerTemp = `${CI_HOME}/work/_temp`;
    const awsRegion = pick(rng, AWS_REGIONS);
    const npmToken = npm.generate(rng);
    const actionsToken = github.generate(rng, "ghs_");
    const cliToken = github.generate(rng, "gho_");
    const patToken = github.generate(rng, "ghp_");
    const awsKeys = aws.generate(rng);
    const dockerToken = generic.generate(rng, 27);
    const netrcPassword = randomUuid(rng);
    const sshKey = ssh.generate(rng, identity.email);
    const gcpProjectId = `${identity.repo}-${randomDigits(rng, 6)}`;
    const gcpKey = gcp.generate(rng, { projectId: gcpProjectId, serviceAccount: GCP_SERVICE_ACCOUNT });
    const gcpPath = `${workspace}/gha-creds-${randomHex(rng, 16)}.json`;
    const idToken = oidc.generate(rng, { nowSeconds });
    const dotenv = envSecrets.generate(rng);
    const dockerSecret = `dckr_pat_${dockerToken}`;
    const dockerAuth = Buffer.from(`${identity.login}:${dockerSecret}`).toString("base64");
    const file = (path, mode, content, credential) => credential === undefined ? { path, content, mode } : { path, content, mode, credential };
    const awsCredentialsPath = `${CI_HOME}/.aws/credentials`;
    const files = [
        file(`${CI_HOME}/.npmrc`, 0o600, `//registry.npmjs.org/:_authToken=${npmToken}\n`, "builtin"),
        file(`${CI_HOME}/.config/gh/hosts.yml`, 0o600, `github.com:\n    user: ${identity.login}\n    oauth_token: ${cliToken}\n    git_protocol: https\n`, "builtin"),
        file(`${CI_HOME}/.git-credentials`, 0o600, `https://${identity.login}:${patToken}@github.com\n`, "builtin"),
        file(awsCredentialsPath, 0o600, `[default]\naws_access_key_id = ${awsKeys.accessKeyId}\naws_secret_access_key = ${awsKeys.secretAccessKey}\n`, "builtin"),
        file(`${CI_HOME}/.aws/config`, 0o644, `[default]\nregion = ${awsRegion}\noutput = json\n`, "builtin"),
        file(`${CI_HOME}/.docker/config.json`, 0o600, `${JSON.stringify({ auths: { "https://index.docker.io/v1/": { auth: dockerAuth } } }, null, "\t")}\n`, "builtin"),
        file(`${CI_HOME}/.netrc`, 0o600, `machine api.heroku.com\n  login ${identity.email}\n  password ${netrcPassword}\nmachine git.heroku.com\n  login ${identity.email}\n  password ${netrcPassword}\n`, "builtin"),
        file(`${CI_HOME}/.ssh/id_ed25519`, 0o600, sshKey.file, "builtin"),
        // google-github-actions/auth writes the key into the workspace. The engine doesn't list this path.
        file(gcpPath, 0o600, gcpKey.json, "extra"),
        file(`${workspace}/.env`, 0o644, `NODE_ENV=production\nDATABASE_URL=postgres://${identity.login}:${dotenv.databasePassword}@db.${identity.org}.internal:5432/${identity.repo}\nAPI_KEY=${dotenv.apiKey}\n`, "builtin"),
        // Not a credential: it carries the identity, so the git config agrees with everything else.
        file(`${CI_HOME}/.gitconfig`, 0o644, `[user]\n\tname = ${identity.displayName}\n\temail = ${identity.email}\n`),
    ];
    const oidcUrl = `https://pipelinesghubeus${randomRange(rng, 1, 30)}.actions.githubusercontent.com/${randomHex(rng, 24)}/00000000-0000-0000-0000-000000000000/_apis/distributedtask/hubs/Actions/plans/${randomUuid(rng)}/jobs/${randomUuid(rng)}/idtoken?api-version=2.0`;
    const repository = `${identity.org}/${identity.repo}`;
    const env = {
        HOME: CI_HOME,
        USER: CI_USER,
        CI: "true",
        GITHUB_ACTIONS: "true",
        GITHUB_ACTION: "__run",
        GITHUB_ACTOR: identity.login,
        GITHUB_ACTOR_ID: identity.userId,
        GITHUB_TRIGGERING_ACTOR: identity.login,
        GITHUB_API_URL: "https://api.github.com",
        GITHUB_GRAPHQL_URL: "https://api.github.com/graphql",
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_EVENT_NAME: "push",
        GITHUB_JOB: "build",
        GITHUB_REF: "refs/heads/main",
        GITHUB_REF_NAME: "main",
        GITHUB_REF_TYPE: "branch",
        GITHUB_REPOSITORY: repository,
        GITHUB_REPOSITORY_ID: identity.repoId,
        GITHUB_REPOSITORY_OWNER: identity.org,
        GITHUB_REPOSITORY_OWNER_ID: identity.orgId,
        GITHUB_RUN_ATTEMPT: "1",
        GITHUB_RUN_ID: randomDigits(rng, 11),
        GITHUB_RUN_NUMBER: String(randomRange(rng, 20, 900)),
        GITHUB_SHA: randomHex(rng, 40),
        GITHUB_WORKFLOW: "CI",
        GITHUB_WORKSPACE: workspace,
        ImageOS: "ubuntu24",
        RUNNER_ARCH: deps.arch === "arm64" ? "ARM64" : "X64",
        RUNNER_ENVIRONMENT: "github-hosted",
        RUNNER_NAME: identity.runnerName,
        RUNNER_OS: "Linux",
        RUNNER_TEMP: runnerTemp,
        RUNNER_TOOL_CACHE: CI_TOOL_CACHE,
        // Secrets
        GITHUB_TOKEN: actionsToken,
        NODE_AUTH_TOKEN: npmToken,
        NPM_TOKEN: npmToken,
        AWS_ACCESS_KEY_ID: awsKeys.accessKeyId,
        AWS_SECRET_ACCESS_KEY: awsKeys.secretAccessKey,
        AWS_REGION: awsRegion,
        AWS_DEFAULT_REGION: awsRegion,
        GOOGLE_APPLICATION_CREDENTIALS: gcpPath,
        GOOGLE_GHA_CREDS_PATH: gcpPath,
        CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE: gcpPath,
        GOOGLE_CLOUD_PROJECT: gcpProjectId,
        GCLOUD_PROJECT: gcpProjectId,
        ACTIONS_ID_TOKEN_REQUEST_URL: oidcUrl,
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: idToken.token,
    };
    const inFile = (path) => ({ type: "file", path });
    const inEnv = (name) => ({ type: "env", name });
    const honeytokens = [
        { id: "npm", kind: "npm", value: npmToken, placement: inFile(`${CI_HOME}/.npmrc`) },
        { id: "github-actions", kind: "github", value: actionsToken, placement: inEnv("GITHUB_TOKEN") },
        {
            id: "github-cli",
            kind: "github",
            value: cliToken,
            placement: inFile(`${CI_HOME}/.config/gh/hosts.yml`),
        },
        { id: "github-pat", kind: "github", value: patToken, placement: inFile(`${CI_HOME}/.git-credentials`) },
        {
            id: "aws-access-key-id",
            kind: "aws-access-key",
            value: awsKeys.accessKeyId,
            placement: inFile(awsCredentialsPath),
        },
        {
            id: "aws-secret-access-key",
            kind: "aws-secret-key",
            value: awsKeys.secretAccessKey,
            placement: inFile(awsCredentialsPath),
        },
        {
            id: "docker-auth",
            kind: "generic",
            value: dockerAuth,
            placement: inFile(`${CI_HOME}/.docker/config.json`),
        },
        // A stealer that decodes the auth field sends `login:token` or the bare token, which never contain the
        // base64 blob above. The inner secret is registered too (the engine also finds it inside a blob).
        {
            id: "docker-secret",
            kind: "generic",
            value: dockerSecret,
            placement: { type: "file", path: `${CI_HOME}/.docker/config.json`, encoding: "base64" },
        },
        { id: "netrc-password", kind: "generic", value: netrcPassword, placement: inFile(`${CI_HOME}/.netrc`) },
        {
            id: "ssh-key-line",
            kind: "ssh-key",
            value: sshKey.keyLine,
            placement: inFile(`${CI_HOME}/.ssh/id_ed25519`),
        },
        { id: "gcp-key-line", kind: "gcp", value: gcpKey.keyLine, placement: inFile(gcpPath) },
        { id: "gcp-private-key-id", kind: "gcp", value: gcpKey.privateKeyId, placement: inFile(gcpPath) },
        {
            id: "oidc-signature",
            kind: "generic",
            value: idToken.signature,
            placement: inEnv("ACTIONS_ID_TOKEN_REQUEST_TOKEN"),
        },
        {
            id: "dotenv-database-password",
            kind: "env",
            value: dotenv.databasePassword,
            placement: inFile(`${workspace}/.env`),
        },
        { id: "dotenv-api-key", kind: "env", value: dotenv.apiKey, placement: inFile(`${workspace}/.env`) },
    ];
    assertDistinct(honeytokens);
    assertVerbatim(honeytokens, files, env);
    return {
        name: "ci-github-actions",
        user: CI_USER,
        hostname: identity.hostname,
        home: CI_HOME,
        projectDir: workspace,
        nodeModulesDir: `${workspace}/node_modules`,
        tmpDirs: ["/tmp", runnerTemp],
        env,
        files,
        honeytokens,
    };
}
/** Two honeytokens with the same id or value would make the engine reject the whole input. */
function assertDistinct(tokens) {
    if (new Set(tokens.map((t) => t.id)).size !== tokens.length) {
        throw new FakeEnvironmentError("duplicate honeytoken id");
    }
    if (new Set(tokens.map((t) => t.value)).size !== tokens.length) {
        throw new FakeEnvironmentError("duplicate honeytoken value");
    }
}
const BASE64_RUN = /[A-Za-z0-9+/]{16,}={0,2}/g;
/** True if `value` is inside some base64 run of `text` once the run is decoded. */
function inBase64Run(text, value) {
    for (const run of text.match(BASE64_RUN) ?? []) {
        if (Buffer.from(run, "base64").toString("latin1").includes(value))
            return true;
    }
    return false;
}
/**
 * Every registered value must be in the place it was planted, exactly as registered (never joined or
 * re-encoded). The one exception is a placement marked `encoding: "base64"`, found by decoding base64 runs.
 */
function assertVerbatim(tokens, files, env) {
    for (const token of tokens) {
        const where = token.placement;
        const text = where.type === "env" ? env[where.name] : files.find((f) => f.path === where.path)?.content;
        const found = text !== undefined &&
            (where.type === "file" && where.encoding === "base64"
                ? inBase64Run(text, token.value)
                : text.includes(token.value));
        if (!found) {
            throw new FakeEnvironmentError(`honeytoken ${token.id} is not in its planted location`);
        }
    }
}
//# sourceMappingURL=ci-github-actions.js.map