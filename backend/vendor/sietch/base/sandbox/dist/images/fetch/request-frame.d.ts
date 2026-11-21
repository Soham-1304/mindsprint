import { z } from "zod";
export declare const fetchRequestSchema: z.ZodObject<{
    name: z.ZodString;
    version: z.ZodString;
    registryHost: z.ZodString;
}, z.core.$strict>;
export type FetchRequest = z.infer<typeof fetchRequestSchema>;
/** The request frame body. Throws when the request is invalid or too large (a caller bug). */
export declare function encodeFetchRequest(request: FetchRequest): Uint8Array;
export type FetchRequestParse = {
    readonly ok: true;
    readonly request: FetchRequest;
} | {
    readonly ok: false;
};
/** Parses the request frame. Never throws and never echoes the input. */
export declare function parseFetchRequest(bytes: Uint8Array): FetchRequestParse;
//# sourceMappingURL=request-frame.d.ts.map