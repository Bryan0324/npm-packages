import { addPage, NamedPage } from '@hydrooj/ui-default';

function getElementByXpath(path: string): HTMLElement | null {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement | null;
}

function renderTurnstile(document: Document, summitXpath: string, containerXpath: string, UiContext: Record<string, any>) {
  const summitTarget = getElementByXpath(summitXpath);
  if (summitTarget) summitTarget.style = "visibility:hidden";
  const subs = document.createElement('script');
  subs.replaceChildren(document.createTextNode(`
    function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
    const submitPath = '${summitXpath}';
    function onTurnstileSuccess(token) {
      console.log("Turnstile success:", token);
      getElementByXpath(submitPath).style = "";
    }
    function onTurnstileError(errorCode) {
      console.error("Turnstile error:", errorCode);
      getElementByXpath(submitPath).style = "visibility:hidden";
    }
    function onTurnstileExpired() {
      console.warn("Turnstile token expired");
      getElementByXpath(submitPath).style = "visibility:hidden";
    };
  `));
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
  const xpath = containerXpath;
  const target = getElementByXpath(xpath);
  if (target && !target.querySelector('.cf-turnstile')) {
    const container = document.createElement('div');
    container.className = 'cf-turnstile';
    container.setAttribute('data-sitekey', UiContext.turnstileKey);
    container.setAttribute('data-callback', 'onTurnstileSuccess');
    container.setAttribute('data-error-callback', 'onTurnstileError');
    container.setAttribute('data-expired-callback', 'onTurnstileExpired');
    target.appendChild(container);
    console.log('Turnstile container appended to target element');
  }
}

addPage(new NamedPage(['user_register'], () => {
    renderTurnstile(document, '//*[@id="submit"]', '//*[@id="panel"]/div[4]/div/div/div/form', UiContext);
}));


addPage(new NamedPage(['discussion_create'], () => {
    renderTurnstile(document, '//*[@id="panel"]/div[3]/div/div[1]/div/div[2]/form/div[3]/div/button[1]', '//*[@id="panel"]/div[3]/div/div[1]/div/div[2]/form/div[3]/div', UiContext);
}));


addPage(new NamedPage(['blog_edit'], () => {
    renderTurnstile(document, '//*[@id="panel"]/div[3]/div/div[1]/div/div/form/div[3]/div/button[1]', '//*[@id="panel"]/div[3]/div/div[1]/div/div/form/div[3]/div', UiContext);
}));
