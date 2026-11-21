import { z } from "zod";
import { NAME_PATTERN, VERSION_PATTERN } from "../../request.js";
import { MAX_REQUEST_FRAME_BYTES } from "./limits.js";
/**
 * The first frame on the fetch container's stdin: what to fetch and from which registry. It crosses a
 * trust boundary (the entrypoint validates it with the scan request's own name and version patterns), so
 * it is a zod `.strict()` schema. The host builds it with `encodeFetchRequest`; nothing in it ever
 * becomes an npm argument (see `npm-argv.ts`).
 */
const REGISTRY_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
export const fetchRequestSchema = z.strictObject({
    name: z.string().min(1).max(214).regex(NAME_PATTERN),
    version: z.string().min(1).max(256).regex(VERSION_PATTERN),
    registryHost: z.string().min(3).max(253).regex(REGISTRY_HOST),
});
/** The request frame body. Throws when the request is invalid or too large (a caller bug). */
export function encodeFetchRequest(request) {
    const checked = fetchRequestSchema.parse(request);
    const bytes = new TextEncoder().encode(JSON.stringify(checked));
    if (bytes.length > MAX_REQUEST_FRAME_BYTES)
        throw new RangeError("the fetch request is too large");
    return bytes;
}
/** Parses the request frame. Never throws and never echoes the input. */
export function parseFetchRequest(bytes) {
    if (bytes.length === 0 || bytes.length > MAX_REQUEST_FRAME_BYTES)
        return { ok: false };
    try {
        const json = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        const parsed = fetchRequestSchema.safeParse(json);
        return parsed.success ? { ok: true, request: parsed.data } : { ok: false };
    }
    catch {
        return { ok: false };
    }
}
//# sourceMappingURL=request-frame.js.map