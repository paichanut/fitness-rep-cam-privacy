// ==UserScript==
// @name         OnHockey Clean
// @namespace    https://github.com/paichanut/fitness-rep-cam-privacy
// @version      1.0.0
// @description  Strips ads, popunders and redirect hijacks from onhockey.tv and gives it a cleaner, responsive layout.
// @match        *://onhockey.tv/*
// @match        *://*.onhockey.tv/*
// @run-at       document-start
// @grant        none
// @all-frames   true
// ==/UserScript==

(function () {
  'use strict';

  // Hosts known to serve ads/popunders on the site. Extend as new ones show up.
  const AD_HOSTS = [
    'everyoneconsole.com',
    'highperformanceformat.com',
    'profitablecpmrate.com',
    'effectivegatecpm.com',
    'adsterra.com',
    'popads.net',
    'popcash.net',
    'propellerads.com',
    'onclickads.net',
    'clocklink.com', // decorative clock iframe; not needed
  ];

  const isAdUrl = (url) => {
    if (!url) return false;
    try {
      const host = new URL(url, location.href).hostname;
      return AD_HOSTS.some((h) => host === h || host.endsWith('.' + h));
    } catch (_) {
      return false;
    }
  };

  // 1. Kill popups/popunders. The site only uses window.open for its own
  //    "Advertise"/"Donate" windows, so nothing of value is lost.
  const blockedOpen = function () { return null; };
  try {
    Object.defineProperty(window, 'open', { value: blockedOpen, writable: false, configurable: false });
  } catch (_) {
    window.open = blockedOpen;
  }

  // 2. Neutralise the ad network's config object so its loader bails out.
  try {
    Object.defineProperty(window, 'atOptions', { get: () => undefined, set: () => {}, configurable: false });
  } catch (_) {}

  // 3. Stop ad scripts/iframes before they execute or load.
  const scrub = (node) => {
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if ((tag === 'SCRIPT' || tag === 'IFRAME') && isAdUrl(node.src || node.getAttribute('src'))) {
      node.type = 'javascript/blocked';
      node.removeAttribute('src');
      node.remove();
      return;
    }
    if (tag === 'SCRIPT' && /atOptions|invoke\.js/.test(node.textContent || '')) {
      node.type = 'javascript/blocked';
      node.remove();
      return;
    }
    if (tag === 'A' && isAdUrl(node.href)) node.remove();
  };

  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        scrub(n);
        if (n.querySelectorAll) n.querySelectorAll('script,iframe,a').forEach(scrub);
      }
    }
  }).observe(document, { childList: true, subtree: true });

  // Firefox-only hook; a harmless no-op elsewhere.
  document.addEventListener('beforescriptexecute', (e) => {
    if (isAdUrl(e.target.src)) e.preventDefault();
  }, true);

  // 4. Block click-jacking: ad scripts attach capture listeners on document
  //    that redirect the tab. Swallow clicks whose target leads to an ad host.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (a && isAdUrl(a.href)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  // 5. Pages from onhockey.tv itself: re-render them with the ad markup
  //    stripped out. Parser-inserted <script> tags run before a
  //    MutationObserver can remove them, so we stop the load, fetch the HTML
  //    ourselves, clean it, and rebuild the page from it. The window.open
  //    lock above stays in place because the window object is reused.
  const css = `
    table[height="60"], marquee { display: none !important; }
    body { background-color: #0b0d10 !important; background-image: none !important; }
    @media (max-width: 1300px) {
      table[width="1270"], table[width="1278"] { width: 100% !important; }
      table[cols="3"] > tbody > tr { display: flex; flex-wrap: wrap; justify-content: center; }
      table[cols="3"] > tbody > tr > td { width: auto !important; }
      iframe[name="player_frame"] { width: min(712px, 100vw) !important; aspect-ratio: 712 / 520; height: auto !important; }
    }
  `;

  const clean = (html) => html
    // external ad scripts / iframes
    .replace(/<(script|iframe)\b[^>]*\bsrc\s*=\s*["']?([^"'\s>]+)[^>]*>[\s\S]*?<\/\1>/gi,
      (m, _t, src) => (isAdUrl(src) ? '' : m))
    // inline ad-network config blocks
    .replace(/<script\b[^>]*>(?:(?!<\/script>)[\s\S])*?atOptions[\s\S]*?<\/script>/gi, '')
    // decorative third-party clock
    .replace(/ClockOut\(timez\);/g, '')
    .replace(/<\/head>/i, `<style id="onhockey-clean">${css}</style></head>`);

  // Rebuild the document from cleaned HTML. Scripts coming out of DOMParser
  // are inert, so each one is recreated and run in source order.
  const render = async (html) => {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const root = document.importNode(parsed.documentElement, true);
    if (document.documentElement) document.documentElement.replaceWith(root);
    else document.appendChild(root);
    for (const old of Array.from(root.querySelectorAll('script'))) {
      const s = document.createElement('script');
      for (const { name, value } of Array.from(old.attributes)) s.setAttribute(name, value);
      s.textContent = old.textContent;
      const done = s.src ? new Promise((res) => { s.onload = s.onerror = res; }) : null;
      old.replaceWith(s);
      if (done) await done;
    }
    document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
    window.dispatchEvent(new Event('load'));
  };

  if (!/^https?:$/.test(location.protocol) || document.readyState !== 'loading') return;
  if (sessionStorage.getItem('onhockey-clean-off')) {
    sessionStorage.removeItem('onhockey-clean-off');
    return;
  }
  window.stop();
  fetch(location.href, { credentials: 'include' })
    .then((r) => r.arrayBuffer().then((buf) => {
      const ct = r.headers.get('content-type') || '';
      const head = new TextDecoder('latin1').decode(buf.slice(0, 2048));
      const cs = (/charset=([\w-]+)/i.exec(ct) || /charset=["']?([\w-]+)/i.exec(head) || [, 'utf-8'])[1];
      let text;
      try { text = new TextDecoder(cs).decode(buf); } catch (_) { text = new TextDecoder().decode(buf); }
      render(clean(text));
    }))
    .catch(() => {
      // Never leave the user with a blank page: fall back to the original.
      sessionStorage.setItem('onhockey-clean-off', '1');
      location.reload();
    });
})();
