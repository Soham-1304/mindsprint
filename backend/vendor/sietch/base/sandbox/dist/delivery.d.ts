import type { FakeHome } from "./fake-home.js";
import type { Control } from "./images/detonation/control.js";
import type { Profile } from "./profiles/types.js";
export interface DeliveryInput {
    readonly profile: Profile;
    readonly home: FakeHome;
    /** The per-scan CA certificate. Never the key. */
    readonly caCertPem: string;
    readonly project: {
        readonly packageJson: Uint8Array;
        readonly lockfile: Uint8Array;
    };
    /** The cache part: a tar of `_cacache`. Opaque bytes; the container's tar-path checker validates them. */
    readonly cacheTar: Uint8Array;
    readonly sinkAddress: string;
    readonly observeSeconds: number;
    /** Replaces the generated `control.json` bytes (tests only, to send a bad one). */
    readonly controlBytes?: Uint8Array;
}
/** The `control.json` content for a profile. */
export declare function controlFor(profile: Profile, sinkAddress: string, observeSeconds: number): Control;
/** The empty npm cache: a tar with only its end marker. */
export declare function emptyCacheTar(): Uint8Array;
/** The home part alone. */
export declare function homePart(input: DeliveryInput): Uint8Array;
/** The whole stream. */
export declare function buildDelivery(input: DeliveryInput): Uint8Array;
/** Frames two parts with the container's caps. */
export declare function framed(home: Uint8Array, cache: Uint8Array): Uint8Array;
//# sourceMappingURL=delivery.d.ts.map