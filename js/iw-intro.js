/* Safe to load from <head> or <body>: boots after the DOM is ready. */
(() => {
  const boot = () => {
    (() => {
      const root = document.querySelector('[data-iw-intro]');
      if (!root) return;

      const strips = root.querySelector('.iw-intro__strips');
      const bar = root.querySelector('.iw-intro__bar-fill');
      const count = root.querySelector('.iw-intro__count');

      const N = 6;                 // number of strips
      const STAGGER = 55;          // delay between strips (ms)
      const STRIP_DUR = 480;       // duration of each strip (ms)
      const DUR = 800;             // progress counter duration (ms)
      const HOLD = 80;             // pause at 100% (ms)
      const KEY = 'iwIntroSeen';

      const DOWN_KEYS = [' ', 'Spacebar', 'PageDown', 'End', 'ArrowDown'];
      const SCROLL_KEYS = DOWN_KEYS.concat(['PageUp', 'Home', 'ArrowUp']);

      let loaded = document.readyState === 'complete';
      let state = 'idle';          // idle -> running -> done
      let touchStartY = null;

      const ease = (t) => t * t * (3 - 2 * t);
      const isBlocking = () => state !== 'done';

      const readSeen = () => {
        try { return sessionStorage.getItem(KEY); } catch (e) { return null; }
      };
      const markSeen = () => {
        try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* ignore */ }
      };

      const setProgress = (p) => {
        bar.style.transform = `scaleX(${p})`;
        count.textContent = `${Math.round(p * 100)}%`;
      };

      /* strips: neighbours overlap by 1px to avoid gaps; lower strips move first */
      for (let i = 0; i < N; i += 1) {
        const strip = document.createElement('div');
        strip.className = 'iw-intro__strip';
        strip.style.top = `${(i * 100) / N}%`;
        strip.style.height = `calc(${100 / N}% + 1px)`;

        const inner = document.createElement('i');
        inner.style.transitionDelay = `${(N - 1 - i) * STAGGER}ms`;

        strip.appendChild(inner);
        strips.appendChild(strip);
      }

      const finish = () => {
        setTimeout(() => {
          root.classList.add('is-out');
          setTimeout(() => {
            root.classList.add('is-gone');
            state = 'done';
          }, (N - 1) * STAGGER + STRIP_DUR + 40);
        }, HOLD);
      };

      const run = () => {
        if (state !== 'idle') return;
        state = 'running';
        root.classList.add('is-running');
        markSeen();
        setProgress(0);

        const t0 = performance.now();
        const tick = (now) => {
          let p = ease(Math.max(0, Math.min(1, (now - t0) / DUR)));
          if (!loaded && p > 0.9) p = 0.9;       // wait for assets: hold at 90%
          setProgress(p);
          if (p >= 1) {
            setProgress(1);
            finish();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };

      window.addEventListener('load', () => { loaded = true; });

      /* scrolling is blocked while the intro is up; the first scroll intent plays it */
      window.addEventListener('wheel', (e) => {
        if (!isBlocking()) return;
        e.preventDefault();
        if (state === 'idle' && e.deltaY > 4) run();
      }, { passive: false });

      window.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (!isBlocking()) return;
        e.preventDefault();
        if (state === 'idle' && touchStartY !== null && touchStartY - e.touches[0].clientY > 12) run();
      }, { passive: false });

      window.addEventListener('keydown', (e) => {
        if (!isBlocking() || SCROLL_KEYS.indexOf(e.key) === -1) return;
        e.preventDefault();
        if (state === 'idle' && DOWN_KEYS.indexOf(e.key) > -1) run();
      });

      window.addEventListener('scroll', () => {
        if (!isBlocking() || window.scrollY === 0) return;
        window.scrollTo(0, 0);                    // e.g. scrollbar drag
        if (state === 'idle') run();
      });

      /* reload replays the intro; coming back within the same session skips it */
      const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      const isReload = nav ? nav.type === 'reload' : false;

      if (readSeen() && !isReload) {
        root.classList.add('is-gone');
        state = 'done';
      } else {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);
        setTimeout(() => root.classList.add('is-ready'), 80);
      }
    })();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
