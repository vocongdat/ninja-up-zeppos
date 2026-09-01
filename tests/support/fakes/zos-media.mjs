// tests/support/fakes/zos-media.mjs
export const mediaLog = [];
export function resetMedia() { mediaLog.length = 0; }
export class TonePlayer {
  constructor() { this.file = null; }
  prepare(opt) { this.file = opt.file; mediaLog.push({ file: opt.file, method: "prepare" }); return true; }
  start() { mediaLog.push({ file: this.file, method: "start" }); return true; }
  stop() { mediaLog.push({ file: this.file, method: "stop" }); return true; }
  release() { mediaLog.push({ file: this.file, method: "release" }); return true; }
  isPlaying() { return mediaLog.some((e) => e.file === this.file && e.method === "start" && !mediaLog.some((f) => f.file === this.file && f.method === "stop" && mediaLog.indexOf(f) > mediaLog.indexOf(e))); }
}
