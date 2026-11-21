import { type Rng } from "../rng.js";
/** Secrets for the project `.env` file. */
export interface EnvSecrets {
    /** 24 base62 characters, used as the password in `DATABASE_URL`. */
    readonly databasePassword: string;
    /** 40 lowercase hex characters, used as `API_KEY`. */
    readonly apiKey: string;
}
export declare function generate(rng: Rng): EnvSecrets;
export declare function validate(value: EnvSecrets): boolean;
//# sourceMappingURL=env.d.ts.map