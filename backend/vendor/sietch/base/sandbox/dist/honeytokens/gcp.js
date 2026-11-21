import { createPrivateKey, createPublicKey, createSign, createVerify } from "node:crypto";
import { z } from "zod";
import { FakeEnvironmentError } from "../errors.js";
import { randomDigits, randomHex } from "../rng.js";
import { bytesToBigint } from "./der.js";
import { pickLine, wrapLines } from "./registration.js";
import { encodePkcs8, generateRsaKey, isConsistent, RSA_BITS } from "./rsa.js";
const PEM_BEGIN = "-----BEGIN PRIVATE KEY-----";
const PEM_END = "-----END PRIVATE KEY-----";
const PEM_WIDTH = 64;
const PROJECT_ID_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const ACCOUNT_PATTERN = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
/** A fake GCP service-account key file with a freshly generated RSA-2048 private key. */
export function generate(rng, input) {
    if (!PROJECT_ID_PATTERN.test(input.projectId) || !ACCOUNT_PATTERN.test(input.serviceAccount)) {
        throw new FakeEnvironmentError("invalid GCP project id or service account name");
    }
    const key = generateRsaKey(rng);
    const { der, privateOffset } = encodePkcs8(key);
    // Importing the key is a check that the encoding is exactly what OpenSSL expects.
    const parsed = createPrivateKey({ key: Buffer.from(der), format: "der", type: "pkcs8" });
    if (parsed.asymmetricKeyType !== "rsa" || parsed.asymmetricKeyDetails?.modulusLength !== RSA_BITS) {
        throw new FakeEnvironmentError("generated RSA key has the wrong shape");
    }
    const lines = wrapLines(Buffer.from(der).toString("base64"), PEM_WIDTH);
    // Lines that lie wholly inside the secret fields (d, p, q, dp, dq, qinv). The last line is left out: it
    // may be short and carry `=` padding.
    const bytesPerLine = (PEM_WIDTH / 4) * 3;
    const eligible = [];
    for (let i = 0; i < lines.length - 1; i++) {
        if (i * bytesPerLine >= privateOffset && lines[i]?.length === PEM_WIDTH)
            eligible.push(i);
    }
    if (eligible.length === 0)
        throw new FakeEnvironmentError("no eligible key line");
    const keyLine = pickLine(rng, lines, eligible);
    const privateKeyId = randomHex(rng, 40);
    const clientEmail = `${input.serviceAccount}@${input.projectId}.iam.gserviceaccount.com`;
    const pem = `${PEM_BEGIN}\n${lines.join("\n")}\n${PEM_END}\n`;
    const file = {
        type: "service_account",
        project_id: input.projectId,
        private_key_id: privateKeyId,
        private_key: pem,
        client_email: clientEmail,
        client_id: randomDigits(rng, 21),
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(clientEmail)}`,
        universe_domain: "googleapis.com",
    };
    return { json: `${JSON.stringify(file, null, 2)}\n`, privateKeyId, keyLine };
}
const fileSchema = z.strictObject({
    type: z.literal("service_account"),
    project_id: z.string().regex(PROJECT_ID_PATTERN),
    private_key_id: z.string().regex(/^[0-9a-f]{40}$/),
    private_key: z.string(),
    client_email: z.string(),
    client_id: z.string().regex(/^[1-9][0-9]{20}$/),
    auth_uri: z.literal("https://accounts.google.com/o/oauth2/auth"),
    token_uri: z.literal("https://oauth2.googleapis.com/token"),
    auth_provider_x509_cert_url: z.literal("https://www.googleapis.com/oauth2/v1/certs"),
    client_x509_cert_url: z.string(),
    universe_domain: z.literal("googleapis.com"),
});
/**
 * True if `json` is a well-formed key file whose private key is a working RSA-2048 key (a signature
 * made with it verifies against the public half).
 */
export function validate(json) {
    try {
        const parsed = fileSchema.safeParse(JSON.parse(json));
        if (!parsed.success)
            return false;
        const file = parsed.data;
        const [account, domain] = file.client_email.split("@");
        if (account === undefined || !ACCOUNT_PATTERN.test(account))
            return false;
        if (domain !== `${file.project_id}.iam.gserviceaccount.com`)
            return false;
        if (!file.private_key.startsWith(`${PEM_BEGIN}\n`) || !file.private_key.endsWith(`\n${PEM_END}\n`)) {
            return false;
        }
        const bodyLines = file.private_key.slice(PEM_BEGIN.length + 1, -(PEM_END.length + 2)).split("\n");
        if (bodyLines.some((l, i) => !/^[A-Za-z0-9+/=]+$/.test(l) || (i < bodyLines.length - 1 && l.length !== PEM_WIDTH))) {
            return false;
        }
        const key = createPrivateKey(file.private_key);
        if (key.asymmetricKeyType !== "rsa" || key.asymmetricKeyDetails?.modulusLength !== RSA_BITS)
            return false;
        // A signature only uses the CRT values, so check every part against the others as well.
        const jwk = key.export({ format: "jwk" });
        const part = (v) => bytesToBigint(new Uint8Array(Buffer.from(v ?? "", "base64url")));
        const parts = {
            n: part(jwk.n),
            e: part(jwk.e),
            d: part(jwk.d),
            p: part(jwk.p),
            q: part(jwk.q),
            dp: part(jwk.dp),
            dq: part(jwk.dq),
            qinv: part(jwk.qi),
        };
        if (!isConsistent(parts))
            return false;
        const message = "sandbox-fixture-check";
        const signature = createSign("RSA-SHA256").update(message).sign(key);
        return createVerify("RSA-SHA256").update(message).verify(createPublicKey(key), signature);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=gcp.js.map