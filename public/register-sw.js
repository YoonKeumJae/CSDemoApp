// Register as soon as this first-party script runs; do not wait for the CDN or window.load.
const registrationScriptURL = document.currentScript?.src;
if ('serviceWorker' in navigator && window.isSecureContext && registrationScriptURL) {
  (async () => {
    const scope = new URL('./', registrationScriptURL).href;
    const scriptURL = new URL('sw.js', scope).href;
    try {
      const existing = await navigator.serviceWorker.getRegistration(scope);
      const worker = existing?.installing || existing?.waiting || existing?.active;
      // Reuse our registration; preserve any other worker already covering this app.
      if (existing && (existing.scope !== scope || worker?.scriptURL !== scriptURL)) return;
      await navigator.serviceWorker.register(scriptURL, { scope, updateViaCache: 'none' });
    } catch (error) {
      console.warn('오프라인 안내 기능을 준비하지 못했습니다.', error);
    }
  })();
}
