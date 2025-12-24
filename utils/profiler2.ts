// Lightweight profiler helper used during debugging and performance measurements.
// Provides a simple `startTimer(label)` that returns an `end()` function to
// log elapsed milliseconds, and `timeSync(label, fn)` to measure synchronous
// blocks.

export function startTimer(label: string) {
  const t0 = Date.now();
  let ended = false;
  return {
    end: (note?: string) => {
      if (ended) return;
      ended = true;
      try {
        const dt = Date.now() - t0;
        // Use console.debug for low-noise output; use console.info when note provided
        if (note) console.info(`[perf] ${label} ${note}: ${dt}ms`);
        else console.debug(`[perf] ${label}: ${dt}ms`);
      } catch (e) {}
    },
    lap: (step: string) => {
      try {
        const dt = Date.now() - t0;
        console.debug(`[perf] ${label} - ${step}: ${dt}ms`);
      } catch (e) {}
    }
  }
}

export function timeSync<T>(label: string, fn: () => T): T {
  const t0 = Date.now();
  try {
    return fn();
  } finally {
    try { console.debug(`[perf] ${label}: ${Date.now() - t0}ms`) } catch (e) {}
  }
}

// Small no-op for environments where you want to disable logging quickly.
export const noopProfiler = {
  startTimer: (_: string) => ({ end: (_?: string) => {}, lap: (_?: string) => {} }),
  timeSync: <T>(_label: string, fn: () => T) => fn()
}

export default { startTimer, timeSync, noopProfiler }
