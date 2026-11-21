import { SietchError } from "@sietch/core";
/**
 * Building the fake environment failed: a bad random source, a value that doesn't fit its format,
 * a file outside the fake home. The runner treats it as ERROR (fail closed). The message never
 * contains a generated value.
 */
export declare class FakeEnvironmentError extends SietchError {
    constructor(message: string);
}
//# sourceMappingURL=errors.d.ts.map