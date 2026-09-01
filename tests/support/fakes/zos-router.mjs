// Fake @zos/router — records navigation calls, does not navigate.
//
// What it models: back()/push()/replace() as call logs, so a test can
// assert "the back button was tapped" without a real router existing.
//
// What it does NOT model: any real navigation. Calling back() here does
// not itself unmount the current page or drive its onPause/onDestroy —
// on a real watch, leaving a page via the router is what triggers those
// lifecycle calls. Every scenario in this suite therefore calls
// onPause/onResume/onDestroy on the captured page object directly rather
// than relying on router.back() to do it, because this fake cannot.
export const router = { backCalls: 0, pushes: [], push: (o) => push(o), back: () => back(), replace: (o) => replace(o) };
export function resetRouter() { router.backCalls = 0; router.pushes = []; }
export function back() { router.backCalls++; }
export function push(o) { router.pushes.push(o); }
export function replace(o) { router.pushes.push(o); }
