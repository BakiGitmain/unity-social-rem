import { test } from "node:test";
import assert from "node:assert/strict";
import { createPoller, createSubscription, type LiveDeps } from "./controller.ts";

/** A fake browser: controllable clock, timers and tab visibility. */
function fakeBrowser() {
  let now = 1_000_000;
  let visible = true;
  const timers = new Map<number, { fn: () => void; ms: number; next: number }>();
  let id = 0;
  const listeners = new Set<() => void>();
  const deps: LiveDeps = {
    isVisible: () => visible,
    onVisibilityChange: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    setInterval: (fn, ms) => {
      timers.set(++id, { fn, ms, next: now + ms });
      return id;
    },
    clearInterval: (i) => void timers.delete(i as number),
    now: () => now,
  };
  return {
    deps,
    timers,
    listeners,
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = [...timers.values()].filter((t) => t.next <= end).sort((a, b) => a.next - b.next)[0];
        if (!due) break;
        now = due.next;
        due.next += due.ms;
        due.fn();
      }
      now = end;
    },
    setVisible(v: boolean) {
      visible = v;
      listeners.forEach((l) => l());
    },
  };
}

test("polling runs every interval while the tab is visible", () => {
  const b = fakeBrowser();
  let runs = 0;
  const p = createPoller(() => runs++, 60_000, b.deps);
  p.start();
  b.advance(60_000 * 3);
  assert.equal(runs, 3);
  p.stop();
});

test("polling pauses while the tab is hidden and catches up when visible again", () => {
  const b = fakeBrowser();
  let runs = 0;
  const p = createPoller(() => runs++, 60_000, b.deps);
  p.start();
  b.advance(30_000);
  b.setVisible(false);
  assert.equal(p.active(), false, "no timer while hidden");
  b.advance(10 * 60_000);
  assert.equal(runs, 0, "no requests while hidden");
  b.setVisible(true);
  assert.equal(runs, 1, "one immediate catch-up on return");
  assert.equal(p.active(), true);
  b.advance(60_000);
  assert.equal(runs, 2);
  p.stop();
});

test("stopping the poller removes the timer and the visibility listener (no leaks)", () => {
  const b = fakeBrowser();
  const p = createPoller(() => {}, 60_000, b.deps);
  p.start();
  p.start(); // a second start must not create a duplicate timer
  assert.equal(b.timers.size, 1);
  p.stop();
  assert.equal(b.timers.size, 0);
  assert.equal(b.listeners.size, 0);
});

test("realtime subscription closes while hidden and reopens (once) when visible", () => {
  const b = fakeBrowser();
  let open = 0;
  let closed = 0;
  let resumed = 0;
  const s = createSubscription(
    () => {
      open++;
      return () => closed++;
    },
    b.deps,
    () => resumed++,
  );
  s.start();
  assert.equal(open, 1);
  b.setVisible(false);
  assert.equal(closed, 1);
  assert.equal(s.active(), false);
  b.setVisible(false); // repeated events: nothing happens
  b.setVisible(true);
  b.setVisible(true);
  assert.equal(open, 2, "reopened exactly once");
  assert.equal(resumed, 1, "catch-up refresh after coming back");
  s.stop();
  assert.equal(closed, 2);
  assert.equal(b.listeners.size, 0);
});

test("a subscription started in a hidden tab waits until it becomes visible", () => {
  const b = fakeBrowser();
  b.setVisible(false);
  let open = 0;
  const s = createSubscription(() => {
    open++;
    return () => {};
  }, b.deps);
  s.start();
  assert.equal(open, 0);
  b.setVisible(true);
  assert.equal(open, 1);
  s.stop();
});
