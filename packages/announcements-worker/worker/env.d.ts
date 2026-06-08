/**
 * Minimal `process.env` declaration for the build-time `WORKER_*` values that
 * esbuild's `define` inlines (see build.mts). Keeps `tsc` happy without pulling
 * in `@types/node` — the worker runs in a WebWorker/QuickJS context, not Node,
 * and `process` never exists at runtime (esbuild replaces the references).
 */
declare const process: { env: Record<string, string | undefined> }
