// Fake @zos/storage — an in-memory Map standing in for the on-device
// key/value store, not the store itself.
//
// What it models: getItem/setItem against a plain Map, plus one controlled
// failure mode (backing.failWrites) that mirrors the single case
// utils/store.js and page/checklist.js actually branch on — a write that
// throws. That is enough to exercise "the box refuses to latch when the
// store can't persist it" without needing a real filesystem.
//
// What it does NOT model: storage size limits, partial/corrupted writes
// from a crash mid-write, persistence across process or device restarts,
// or any of the real key/value store's actual synchronous-vs-asynchronous
// behaviour on device. Every test starts from an empty Map via resetAll();
// a real watch's storage does not reset itself between app launches.
export const backing = { map: new Map(), failWrites: false, writes: 0, reads: 0 };

export function resetStorage() {
  backing.map = new Map();
  backing.failWrites = false;
  backing.writes = 0;
  backing.reads = 0;
}

export const localStorage = {
  getItem(k) { backing.reads++; return backing.map.has(k) ? backing.map.get(k) : null; },
  setItem(k, v) {
    backing.writes++;
    if (backing.failWrites) throw new Error("storage full");
    backing.map.set(k, v);
  },
};
