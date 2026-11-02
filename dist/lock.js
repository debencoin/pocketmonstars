'use strict';
// Battle lock: while a match is live the page can't zoom (pinch, double-tap, ctrl+wheel) and Back / swipe-back
// can't leave the battle. PMLock.on({ scroll: true }) also freezes page scrolling (full-screen Arena).
(() => {
  const meta = document.querySelector('meta[name=viewport]');
  const baseViewport = meta?.getAttribute('content') || 'width=device-width,initial-scale=1';
  let locked = false, opts = {}, lastTouchEnd = 0, onBack = null;
  const stop = e => { if (locked) e.preventDefault(); };
  // iOS Safari pinch gestures
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, stop, { passive: false });
  // two-finger pinch on other browsers
  document.addEventListener('touchmove', e => { if (locked && (e.touches.length > 1 || (opts.scroll && !e.target.closest?.('.pm-scroll')))) e.preventDefault(); }, { passive: false });
  // double-tap zoom
  document.addEventListener('touchend', e => { if (!locked) return; const now = Date.now(); if (now - lastTouchEnd < 350) e.preventDefault(); lastTouchEnd = now; }, { passive: false });
  document.addEventListener('dblclick', stop, { passive: false });
  // ctrl/cmd + wheel and keyboard zoom on desktop
  addEventListener('wheel', e => { if (locked && (e.ctrlKey || e.metaKey)) e.preventDefault(); }, { passive: false });
  addEventListener('keydown', e => { if (locked && (e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].includes(e.key)) e.preventDefault(); });
  // Back button / swipe-back: stay in the battle
  addEventListener('popstate', () => { if (!locked) return; history.pushState({ pmLock: 1 }, ''); onBack?.(); });
  addEventListener('beforeunload', e => { if (locked && opts.warn) { e.preventDefault(); e.returnValue = ''; } });

  window.PMLock = {
    on(o = {}) {
      opts = o; onBack = o.onBack || null;
      if (!locked) { history.pushState({ pmLock: 1 }, ''); }
      locked = true;
      meta?.setAttribute('content', 'width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no,viewport-fit=cover');
      document.documentElement.classList.add('pm-locked'); document.documentElement.classList.toggle('pm-lock-scroll', !!o.scroll);
    },
    off() {
      if (!locked) return; locked = false; onBack = null;
      meta?.setAttribute('content', baseViewport);
      document.documentElement.classList.remove('pm-locked', 'pm-lock-scroll');
    },
    get active() { return locked; },
  };
  const st = document.createElement('style');
  st.textContent = `html.pm-locked,html.pm-locked body{overscroll-behavior:none;-webkit-text-size-adjust:100%}
html.pm-locked button,html.pm-locked canvas{touch-action:manipulation;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
html.pm-lock-scroll,html.pm-lock-scroll body{overflow:hidden;height:100%;touch-action:none}
html.pm-lock-scroll .pv-stage.live{touch-action:none}`;
  document.head.append(st);
})();
