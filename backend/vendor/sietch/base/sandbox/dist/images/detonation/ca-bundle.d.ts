/**
 * Composes the CA bundle that every child trusts (`NODE_EXTRA_CA_CERTS`): the roots copied from the base
 * image, a newline, then the per-scan CA certificate. Pure, apart from certificate parsing.
 *
 * The per-scan CA must be exactly one `CERTIFICATE` PEM block, nothing else, that parses as an X.509
 * certificate with the CA flag set. Anything with a key block, a second certificate, or stray text is
 * refused, so a mistake upstream can't put a private key (or a second trust anchor) into the bundle.
 * Reasons are fixed text.
 */
export declare const MAX_CA_PEM_BYTES: number;
export declare const MAX_ROOTS_BYTES: number;
export type BundleResult = {
    readonly ok: true;
    readonly pem: string;
} | {
    readonly ok: false;
    readonly reason: string;
};
export declare function composeBundle(rootsPem: string, caPem: string): BundleResult;
//# sourceMappingURL=ca-bundle.d.ts.map