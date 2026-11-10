/**
 * Live updates that pause while the browser tab is hidden. Pure (all browser APIs are injected), so it is
 * unit-tested in controller.test.ts. Used by the React hooks in src/components/live.tsx.
 */
export type LiveDeps = {
  isVisible: () => boolean;
  /** Subscribe to visibility changes; returns an unsubscribe function. */
  onVisibilityChange: (cb: () => void) => () => void;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
  now: () => number;
};

export type Controller = { start: () => void; stop: () => void; active: () => boolean };

/**
 * Runs `task` every `ms` while the tab is visible. Hidden → the timer is cleared (no requests).
 * Visible again → runs at once if the last run is older than `ms`, then keeps the interval.
 */
export function createPoller(task: () => void, ms: number, deps: LiveDeps): Controller {
  let timer: unknown = null;
  let offVis: (() => void) | null = null;
  let last = 0;
  let started = false;

  const run = () => {
    last = deps.now();
    task();
  };
  const startTimer = () => {
    if (timer === null) timer = deps.setInterval(run, ms);
  };
  const stopTimer = () => {
    if (timer !== null) deps.clearInterval(timer);
    timer = null;
  };
  const sync = () => {
    if (!started) return;
    if (deps.isVisible()) {
      if (timer === null && last > 0 && deps.now() - last >= ms) run();
      startTimer();
    } else stopTimer();
  };

  return {
    start() {
      if (started) return;
      started = true;
      last = deps.now();
      offVis = deps.onVisibilityChange(sync);
      sync();
    },
    stop() {
      started = false;
      stopTimer();
      offVis?.();
      offVis = null;
    },
    active: () => timer !== null,
  };
}

/**
 * Keeps a subscription (e.g. a Supabase Realtime channel) open only while the tab is visible.
 * `subscribe` returns its own cleanup. `onResume` runs when coming back (to catch up on missed changes).
 */
export function createSubscription(subscribe: () => () => void, deps: LiveDeps, onResume?: () => void): Controller {
  let cleanup: (() => void) | null = null;
  let offVis: (() => void) | null = null;
  let started = false;

  const sync = () => {
    if (!started) return;
    if (deps.isVisible()) {
      if (!cleanup) {
        const wasPaused = offVis !== null && cleanup === null;
        cleanup = subscribe();
        if (wasPaused) onResume?.();
      }
    } else if (cleanup) {
      cleanup();
      cleanup = null;
    }
  };

  return {
    start() {
      if (started) return;
      started = true;
      if (deps.isVisible()) cleanup = subscribe();
      offVis = deps.onVisibilityChange(sync);
    },
    stop() {
      started = false;
      cleanup?.();
      cleanup = null;
      offVis?.();
      offVis = null;
    },
    active: () => cleanup !== null,
  };
}
