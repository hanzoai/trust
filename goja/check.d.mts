// Types for check.mjs, which is plain ESM on purpose: it is imported by
// build.mjs under Node AND bundled into bundle.js by esbuild, so the rule that
// gates a committed control is the same object that gates an authored one.
// Written by hand rather than generated — the module is forty lines of
// signatures and a generator would be a build step for nothing.

export declare function checkFrameworks(frameworks: unknown): [string[], Set<string>];
export declare function checkControls(input: unknown, clauseIndex: Set<string>): string[];
export declare function check(controls: unknown, frameworks: unknown): string[];
export declare function assertValid(controls: unknown, frameworks: unknown): void;
