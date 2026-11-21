export interface PackageIdentity {
    readonly name: string;
    readonly version: string;
    readonly integrity: string;
}
/**
 * The key a verdict is cached under. Equal keys mean equal name, version, integrity, and ruleset
 * version. Each part is passed through encodeURIComponent, which always encodes ":", so no part
 * can contain the separator. A re-published tarball (new integrity) never reuses an old verdict.
 */
export declare function verdictCacheKey(identity: PackageIdentity, rulesetVersion: string): string;
//# sourceMappingURL=cache-key.d.ts.map