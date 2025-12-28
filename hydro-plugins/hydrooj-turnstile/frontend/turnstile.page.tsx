import { addPage, NamedPage } from '@hydrooj/ui-default';


addPage(new NamedPage(['user_register'], () => {
    const summitTarget = document.getElementById("submit");
    if (summitTarget) summitTarget.type = "hidden";
    const subs = document.createElement('script');
    subs.replaceChildren(document.createTextNode(`
        function onTurnstileSuccess(token) {
    console.log("Turnstile success:", token);
    document.getElementById("submit").type = "submit";
  }
  function onTurnstileError(errorCode) {
    console.error("Turnstile error:", errorCode);
    document.getElementById("submit").type = "hidden";
  }
  function onTurnstileExpired() {
    console.warn("Turnstile token expired");
    document.getElementById("submit").type = "hidden";
  };`));
    document.head.appendChild(subs);
    const src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    const existing = document.querySelector(`script[src="${src}"]`);
    if (!existing) {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
      console.log('Turnstile script appended to head');
    } else {
      console.log('Turnstile script already present');
    }
    const xpath = '//*[@id="panel"]/div[4]/div/div/div/form';
    const target = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement | null;
    if (target && !target.querySelector('.cf-turnstile')) {
      const container = document.createElement('div');
      container.className = 'cf-turnstile';
      container.setAttribute('data-sitekey', UiContext.turnstileKey);
      container.setAttribute('data-callback', 'onTurnstileSuccess');
      container.setAttribute('data-error-callback', 'onTurnstileError');
      container.setAttribute('data-expired-callback', 'onTurnstileExpired');
      target.appendChild(container);
      console.log('Turnstile container appended to panel div[4]');
    }
}));