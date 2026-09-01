// Fake @zos/timer — a virtual, hand-cranked clock, not the Zepp OS timer.
//
// What it models: setTimeout()/clearTimeout() as a pending map a test
// drains explicitly with tick(), so "is a render queued right now" and
// "did N rapid taps collapse to one pending timer" are both directly
// observable and directly controllable, with no real time ever elapsing.
//
// setInterval()/clearInterval() is modelled as a recurring entry whose
// callback fires every time tick(ms) advances past its period boundary.
// tick() with no argument fires all pending timeouts (legacy behaviour).
// tick(ms) advances intervals by ms milliseconds, firing callbacks as
// many times as their period fits into the elapsed time.
//
// What it does NOT model: actual elapsed time, delay ordering, or nested
// timers scheduled from inside a firing callback (tick() only runs what
// was pending at the moment it was called — see its own comment below).
// There is no jitter, no minimum-delay clamping, and — critically — no
// modelling of the OS suspending or dropping timers in the background;
// that behaviour only exists in this suite to the extent a test calls
// onPause()/onResume()/onDestroy() by hand and checks pendingCount().
export const clock = { pending: new Map(), nextId: 1, fired: 0, cleared: 0 };

const intervals = new Map();
let intervalNextId = 1;

export function resetClock() {
  clock.pending = new Map();
  clock.nextId = 1;
  clock.fired = 0;
  clock.cleared = 0;
}

function resetIntervals() {
  intervals.clear();
  intervalNextId = 1;
}

export function resetTimers() {
  resetClock();
  resetIntervals();
}

export function pendingCount() { return clock.pending.size; }
export function pendingIds() { return [...clock.pending.keys()]; }

// tick() with no args: fire all pending timeouts (legacy).
// tick(ms): advance all intervals by ms, firing each as many times as
// its period fits. Also fires pending timeouts.
export function tick(ms) {
  if (ms === undefined) {
    const batch = [...clock.pending.entries()];
    clock.pending = new Map();
    for (const [, entry] of batch) {
      clock.fired++;
      entry.fn();
    }
    return batch.length;
  }

  for (const [, entry] of intervals) {
    entry.elapsed += ms;
    while (entry.elapsed >= entry.period) {
      entry.elapsed -= entry.period;
      entry.fn();
    }
  }
}

export function setTimeout(fn, delay) {
  const id = clock.nextId++;
  clock.pending.set(id, { fn, delay });
  return id;
}

export function clearTimeout(id) {
  if (clock.pending.has(id)) { clock.pending.delete(id); clock.cleared++; }
}

export function setInterval(fn, period) {
  const id = intervalNextId++;
  intervals.set(id, { fn, period, elapsed: 0 });
  return id;
}

export function clearInterval(id) {
  intervals.delete(id);
}

export function intervalCount() { return intervals.size; }
