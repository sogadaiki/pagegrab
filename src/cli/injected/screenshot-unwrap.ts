/**
 * Injected IIFE scripts for screenshot unwrap/restore/stabilize.
 *
 * These are string literals that are passed to Runtime.evaluate on the target page.
 * They are NOT bundled — they run in the browser's JavaScript context.
 *
 * Ported from service-worker.ts captureFullPage (L994–1149).
 */

/**
 * UNWRAP_IIFE
 *
 * 1. Detects the primary scroll container (largest scrollHeight–clientHeight delta)
 * 2. Unwraps it and all ancestors up to <body> (overflow → visible, height → auto)
 * 3. Forces html+body unconstrained
 * 4. Neutralizes fixed/sticky elements (position → absolute)
 * 5. Stores originals in window.__pagegrab_* for later restore
 */
export const UNWRAP_IIFE = `(() => {
  // 1. Detect primary scroll container
  let bestEl = null;
  let bestDelta = 100;
  document.querySelectorAll('*').forEach(el => {
    if (el === document.documentElement || el === document.body) return;
    const delta = el.scrollHeight - el.clientHeight;
    if (delta > bestDelta && el.clientWidth >= window.innerWidth * 0.5) {
      bestDelta = delta;
      bestEl = el;
    }
  });

  // 2. Unwrap scroll container + all ancestors up to body
  const unwrapped = [];
  if (bestEl) {
    let current = bestEl;
    while (current && current !== document.documentElement) {
      unwrapped.push({
        el: current,
        overflow: current.style.overflow,
        overflowX: current.style.overflowX,
        overflowY: current.style.overflowY,
        height: current.style.height,
        maxHeight: current.style.maxHeight,
        minHeight: current.style.minHeight,
      });
      current.style.setProperty('overflow', 'visible', 'important');
      current.style.setProperty('overflow-x', 'visible', 'important');
      current.style.setProperty('overflow-y', 'visible', 'important');
      current.style.setProperty('height', 'auto', 'important');
      current.style.setProperty('max-height', 'none', 'important');
      current = current.parentElement;
    }
  }

  // 3. Force html+body unconstrained
  const htmlOrig = {
    overflow: document.documentElement.style.overflow,
    height: document.documentElement.style.height,
  };
  const bodyOrig = {
    overflow: document.body.style.overflow,
    height: document.body.style.height,
  };
  document.documentElement.style.setProperty('overflow', 'visible', 'important');
  document.documentElement.style.setProperty('height', 'auto', 'important');
  document.body.style.setProperty('overflow', 'visible', 'important');
  document.body.style.setProperty('height', 'auto', 'important');

  // 4. Neutralize fixed/sticky elements
  const fixed = [];
  document.querySelectorAll('*').forEach(el => {
    const pos = getComputedStyle(el).position;
    if (pos === 'fixed' || pos === 'sticky') {
      fixed.push({ el, orig: el.style.position });
      el.style.setProperty('position', 'absolute', 'important');
    }
  });

  window.__pagegrab_unwrapped = unwrapped;
  window.__pagegrab_fixed = fixed;
  window.__pagegrab_html_orig = htmlOrig;
  window.__pagegrab_body_orig = bodyOrig;
})()`;

/**
 * RESTORE_IIFE
 *
 * Restores all style overrides applied by UNWRAP_IIFE.
 * Safe to call multiple times (idempotent via delete).
 */
export const RESTORE_IIFE = `(() => {
  if (window.__pagegrab_unwrapped) {
    for (const item of window.__pagegrab_unwrapped) {
      item.el.style.overflow = item.overflow;
      item.el.style.overflowX = item.overflowX;
      item.el.style.overflowY = item.overflowY;
      item.el.style.height = item.height;
      item.el.style.maxHeight = item.maxHeight;
      item.el.style.minHeight = item.minHeight;
    }
    delete window.__pagegrab_unwrapped;
  }
  if (window.__pagegrab_html_orig) {
    document.documentElement.style.overflow = window.__pagegrab_html_orig.overflow;
    document.documentElement.style.height = window.__pagegrab_html_orig.height;
    delete window.__pagegrab_html_orig;
  }
  if (window.__pagegrab_body_orig) {
    document.body.style.overflow = window.__pagegrab_body_orig.overflow;
    document.body.style.height = window.__pagegrab_body_orig.height;
    delete window.__pagegrab_body_orig;
  }
  if (window.__pagegrab_fixed) {
    window.__pagegrab_fixed.forEach(({ el, orig }) => {
      el.style.position = orig;
    });
    delete window.__pagegrab_fixed;
  }
})()`;

/**
 * STABILIZE_IIFE
 *
 * Waits for layout to stabilize after unwrap:
 * - Fires rAF×2 to let the browser repaint
 * - Then polls Page.getLayoutMetrics via a Promise that resolves
 *   when cssContentSize is stable for 2 consecutive checks (100ms interval, max 10 tries)
 * - Falls back to a 500ms wait if no stable point is reached
 *
 * Returns a Promise<void> — must be called with awaitPromise: true.
 */
export const STABILIZE_IIFE = `(() => {
  return new Promise((resolve) => {
    // rAF x2 first
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
})()`;
