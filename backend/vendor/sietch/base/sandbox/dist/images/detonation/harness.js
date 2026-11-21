/**
 * The load harness: it loads every dependency of the project, the way an application that depends on the
 * package would, so a payload that waits for `require` or `import` runs while the trace is recording. It
 * runs in the load phase, after install, as the process the `load` marker execs.
 *
 * Pure core with injected `readFile`, `requireModule` and `importModule`, so it is tested without loading
 * anything. For each key of the project's `dependencies` it calls `requireModule(name)` and then
 * `importModule(name)`, each in its own `try`, and swallows every error (a package that throws, or one
 * that can't be loaded one way, must not stop the others). It writes nothing: the trace is the record.
 */
export const MAX_HARNESS_DEPENDENCIES = 1_000;
const PACKAGE_NAME = /^(?:@[a-z0-9][a-z0-9._-]{0,213}\/)?[a-z0-9][a-z0-9._-]{0,213}$/;
/** The dependency names to load: valid package names only, at most `MAX_HARNESS_DEPENDENCIES`. */
export function dependencyNames(packageJsonText) {
    let parsed;
    try {
        parsed = JSON.parse(packageJsonText);
    }
    catch {
        return [];
    }
    if (typeof parsed !== "object" || parsed === null)
        return [];
    const dependencies = parsed.dependencies;
    if (typeof dependencies !== "object" || dependencies === null || Array.isArray(dependencies))
        return [];
    return Object.keys(dependencies)
        .filter((name) => PACKAGE_NAME.test(name))
        .slice(0, MAX_HARNESS_DEPENDENCIES);
}
export async function runHarness(deps) {
    let text = "";
    try {
        text = deps.readFile();
    }
    catch {
        // No readable package.json: nothing to load.
    }
    const names = dependencyNames(text);
    for (const name of names) {
        try {
            deps.requireModule(name);
        }
        catch {
            // A package that throws on load is exactly what we want to watch, and says nothing about the next one.
        }
        try {
            await deps.importModule(name);
        }
        catch {
            // Same: the import form may fail where the require form worked.
        }
    }
    return { attempted: names.length };
}
//# sourceMappingURL=harness.js.map