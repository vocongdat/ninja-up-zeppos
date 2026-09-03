// tests/support/resolve-hook.mjs
const REDIRECTS = {
  "@zos/ui": new URL("./fakes/zos-ui.mjs", import.meta.url).href,
  "@zos/timer": new URL("./fakes/zos-timer.mjs", import.meta.url).href,
  "@zos/storage": new URL("./fakes/zos-storage.mjs", import.meta.url).href,
  "@zos/router": new URL("./fakes/zos-router.mjs", import.meta.url).href,
  "@zos/media": new URL("./fakes/zos-media.mjs", import.meta.url).href,
  "@zos/settings": new URL("./fakes/zos-settings.mjs", import.meta.url).href,
  "@zeppos/zml/base-page": new URL("./fakes/zeppos-base-page.mjs", import.meta.url).href,
};
export async function resolve(specifier, context, nextResolve) {
  const redirected = REDIRECTS[specifier];
  if (redirected) return { url: redirected, shortCircuit: true };
  return nextResolve(specifier, context);
}
