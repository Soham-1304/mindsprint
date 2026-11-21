import { X509Certificate } from "node:crypto";
/**
 * Composes the CA bundle that every child trusts (`NODE_EXTRA_CA_CERTS`): the roots copied from the base
 * image, a newline, then the per-scan CA certificate. Pure, apart from certificate parsing.
 *
 * The per-scan CA must be exactly one `CERTIFICATE` PEM block, nothing else, that parses as an X.509
 * certificate with the CA flag set. Anything with a key block, a second certificate, or stray text is
 * refused, so a mistake upstream can't put a private key (or a second trust anchor) into the bundle.
 * Reasons are fixed text.
 */
export const MAX_CA_PEM_BYTES = 16 * 1024;
export const MAX_ROOTS_BYTES = 1024 * 1024;
const ONE_CERTIFICATE = /^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END CERTIFICATE-----\r?\n?$/;
const refuse = (reason) => ({ ok: false, reason });
export function composeBundle(rootsPem, caPem) {
    if (typeof rootsPem !== "string" || rootsPem.length === 0 || rootsPem.length > MAX_ROOTS_BYTES) {
        return refuse("the root certificates are missing or too large");
    }
    if (!rootsPem.includes("-----BEGIN CERTIFICATE-----"))
        return refuse("the root certificates hold no certificate");
    if (typeof caPem !== "string" || caPem.length === 0 || caPem.length > MAX_CA_PEM_BYTES) {
        return refuse("the CA certificate is missing or too large");
    }
    if (caPem.includes("PRIVATE KEY") || !ONE_CERTIFICATE.test(caPem)) {
        return refuse("the CA file is not exactly one certificate");
    }
    try {
        if (new X509Certificate(caPem).ca !== true)
            return refuse("the certificate is not a CA certificate");
    }
    catch {
        return refuse("the CA certificate does not parse");
    }
    return { ok: true, pem: `${rootsPem.trimEnd()}\n${caPem.trim()}\n` };
}
//# sourceMappingURL=ca-bundle.js.map