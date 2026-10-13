/* iw-film-reel.js
   Intro wipe + pinned, snapping film reel.
   Safe to load from <head> or <body>: it boots once the DOM is ready.
   Requires GSAP + ScrollTrigger to be loaded BEFORE this file. */
(() => {
  const boot = () => {
    const root = document.querySelector('[data-iw-film-reel]');
    if (!root) return;

    if (!window.gsap || !window.ScrollTrigger) {
      console.warn('[iw-film-reel] GSAP / ScrollTrigger not found. Load them before this file.');
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* phones / tablets: drop the heavy film effects (blend modes, filters, animated grain)
       so the videos stay smooth and never turn blank while swiping */
    const lite = window.matchMedia('(max-width: 860px), (hover: none) and (pointer: coarse)').matches;
    root.classList.toggle('is-lite', lite);

    /* =================================================================
       1) INTRO  –  big title covering the reel, strip-wipe on scroll
    ================================================================== */
    const createIntro = (el, options) => {
      const onOut = options && options.onOut;

      if (!el) {
        return { hide() { }, show() { } };
      }

      const strips = el.querySelector('.iw-intro__strips');
      const bar = el.querySelector('.iw-intro__bar-fill');
      const count = el.querySelector('.iw-intro__count');

      const N = 6;                 // number of strips
      const STAGGER = 55;          // delay between strips (ms)
      const STRIP_DUR = 480;       // duration of each strip (ms)
      const DUR = 800;             // progress counter duration (ms)
      const HOLD = 80;             // pause at 100% (ms)

      const ease = (t) => t * t * (3 - 2 * t);

      let out = false;
      let runId = 0;
      const timers = [];

      const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
      const clearTimers = () => { while (timers.length) clearTimeout(timers.pop()); };

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

      /* title slides in the first time the section is on screen */
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {   // a batch can hold a stale "false" first
            el.classList.add('is-ready');
            observer.disconnect();
          }
        }, { threshold: 0.3 });
        observer.observe(el);
      } else {
        el.classList.add('is-ready');
      }

      const finish = (id) => {
        later(() => {
          if (id !== runId) return;
          el.classList.add('is-out');
          if (onOut) onOut();
          later(() => {
            if (id === runId) el.classList.add('is-gone');
          }, (N - 1) * STAGGER + STRIP_DUR + 40);
        }, HOLD);
      };

      /* play the wipe: counter 0 -> 100%, then the strips leave */
      const hide = () => {
        if (out) return;
        out = true;
        runId += 1;
        const id = runId;

        clearTimers();
        el.classList.remove('is-gone', 'is-out');
        el.classList.add('is-running');
        setProgress(0);

        const t0 = performance.now();
        const tick = (now) => {
          if (id !== runId) return;
          const p = ease(Math.max(0, Math.min(1, (now - t0) / DUR)));
          setProgress(p);
          if (p >= 1) {
            finish(id);
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };

      /* scrolled back to the top: the strips come back and cover the reel */
      const show = () => {
        if (!out) return;
        out = false;
        runId += 1;

        clearTimers();
        el.classList.remove('is-gone');
        void el.offsetWidth;                 // flush styles so the strips animate back in
        el.classList.remove('is-out', 'is-running');
        setProgress(0);
      };

      return { hide, show };
    };

    /* =================================================================
       2) FILM REEL
    ================================================================== */
    const frames = Array.from(root.querySelectorAll('.iw-film-reel__frame'));
    const infos = Array.from(root.querySelectorAll('.iw-film-reel__info'));
    const dots = Array.from(root.querySelectorAll('.iw-film-reel__dot'));
    const videos = frames.map((frame) => frame.querySelector('video'));
    const viewport = root.querySelector('.iw-film-reel__viewport');
    const track = root.querySelector('.iw-film-reel__track');
    const countCurrent = root.querySelector('.iw-film-reel__count-current');
    const countTotal = root.querySelector('.iw-film-reel__count-total');
    const barFill = root.querySelector('.iw-film-reel__bar-fill');

    const total = frames.length;
    if (total < 2) return;

    root.style.setProperty('--iw-count', String(total));
    if (countTotal) countTotal.textContent = String(total).padStart(2, '0');

    /* grain + flash (desktop only) and a thin loading line live inside each screen */
    frames.forEach((frame) => {
      const screen = frame.querySelector('.iw-film-reel__window');
      if (!screen) return;
      (lite ? ['loader'] : ['grain', 'flash', 'loader']).forEach((name) => {
        const layer = document.createElement('i');
        layer.className = `iw-film-reel__${name}`;
        layer.setAttribute('aria-hidden', 'true');
        screen.appendChild(layer);
      });
    });

    /* frame size = video size (used by the mobile layout).
       Add data-iw-ratio="16/9" on the section to force a ratio, otherwise it is read from the first video. */
    const forcedRatio = root.getAttribute('data-iw-ratio');
    if (forcedRatio) {
      root.style.setProperty('--iw-ratio', forcedRatio.replace(':', '/'));
    } else if (videos[0]) {
      const readRatio = () => {
        if (videos[0].videoWidth && videos[0].videoHeight) {
          root.style.setProperty('--iw-ratio', `${videos[0].videoWidth} / ${videos[0].videoHeight}`);
        }
      };
      if (videos[0].readyState >= 1) readRatio();
      else videos[0].addEventListener('loadedmetadata', readRatio, { once: true });
    }

    let current = -1;
    let inView = true;

    const pad = (n) => String(n).padStart(2, '0');

    const primed = new WeakSet();      // videos already warmed up
    const priming = new Set();         // videos being warmed up right now (must not be paused)

    const playVideo = (video) => {
      if (!video) return;
      primed.add(video);
      const promise = video.play();
      if (promise && typeof promise.catch === 'function') {
        promise.catch((err) => {
          if (err && err.name === 'NotSupportedError') {
            console.warn('[iw-film-reel] This video cannot be decoded by the browser (use H.264 + AAC .mp4):', video.currentSrc);
          }
        });
      }
    };

    const isWanted = (video) => inView && videos[current] === video;

    /* only the active work plays, and only while the section is on screen */
    const syncVideos = () => {
      videos.forEach((video, i) => {
        if (!video) return;
        if (inView && !document.hidden && i === current) playVideo(video);
        else if (!priming.has(video)) video.pause();
      });
    };

    /* Warm a video up: iOS Safari ignores preload, so a video that was never played stays blank
       until it is needed. A muted play() makes it fetch and decode its first frames, then it is
       paused on frame 0 so it is ready the moment it slides in. */
    const prime = (video) => new Promise((resolve) => {
      if (!video || primed.has(video)) { resolve(); return; }
      primed.add(video);
      if (video.readyState >= 2) { resolve(); return; }       // first frame already available

      priming.add(video);
      video.preload = 'auto';

      let finished = false;
      let timer = 0;
      const done = () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        video.removeEventListener('loadeddata', done);
        video.removeEventListener('error', done);
        priming.delete(video);
        if (!isWanted(video)) {
          video.pause();
          try { video.currentTime = 0; } catch (e) { /* ignore */ }
        }
        resolve();
      };

      video.addEventListener('loadeddata', done);
      video.addEventListener('error', done);
      timer = setTimeout(done, 10000);

      const promise = video.play();
      if (promise && typeof promise.catch === 'function') promise.catch(done);
    });

    /* one at a time, nearest to the active work first, so the visible video keeps the bandwidth */
    let warming = false;
    const warm = async () => {
      if (warming) return;
      warming = true;
      while (true) {
        const next = videos
          .map((video, i) => ({ video, i }))
          .filter((item) => item.video && !primed.has(item.video))
          .sort((a, b) => Math.abs(a.i - current) - Math.abs(b.i - current))[0];
        if (!next) break;
        await prime(next.video);
      }
      warming = false;
    };

    videos.forEach((video, i) => {
      if (!video) return;

      /* the attributes iOS needs for silent inline autoplay (HTML attributes alone are not always enough) */
      video.muted = true;
      video.defaultMuted = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = false;
      video.disablePictureInPicture = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');

      const setLoading = (on) => frames[i].classList.toggle('is-loading', on);
      if (video.readyState < 2) setLoading(true);

      video.addEventListener('loadeddata', () => setLoading(false));
      video.addEventListener('playing', () => setLoading(false));
      video.addEventListener('waiting', () => { if (i === current) setLoading(true); });
      video.addEventListener('canplay', () => {              // slow network: start as soon as it can
        if (inView && i === current && video.paused) playVideo(video);
      });
      video.addEventListener('error', () => {
        setLoading(false);
        console.warn('[iw-film-reel] Video failed to load. Check the path and format:', video.currentSrc || video.querySelector('source')?.getAttribute('src'));
      }, true);
    });

    /* some browsers (iOS Low Power Mode) block autoplay until the first real touch */
    const UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown', 'wheel'];
    const unlock = () => {
      syncVideos();
      UNLOCK_EVENTS.forEach((name) => window.removeEventListener(name, unlock));
    };
    UNLOCK_EVENTS.forEach((name) => window.addEventListener(name, unlock, { passive: true }));

    document.addEventListener('visibilitychange', syncVideos);
    window.addEventListener('pageshow', syncVideos);

    /* copy + tags of one work slide in */
    const showInfo = (index, dir, delay) => {
      const info = infos[index];
      if (!info) return;

      const parts = info.querySelectorAll('[data-iw-reveal]');
      const tags = info.querySelectorAll('[data-iw-tag]');

      gsap.killTweensOf(info);
      gsap.set(info, { autoAlpha: 1, y: 0 });

      gsap.fromTo(parts,
        { autoAlpha: 0, y: 28 * dir },
        { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.07, delay, overwrite: true });

      gsap.fromTo(tags,
        { autoAlpha: 0, scale: 0.9 },
        { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'back.out(1.6)', stagger: 0.06, delay: delay + 0.25, overwrite: true });
    };

    const setActive = (next) => {
      if (next === current) return;

      const prev = current;
      const dir = prev === -1 ? 1 : (next > prev ? 1 : -1);
      current = next;

      frames.forEach((frame, i) => frame.classList.toggle('is-active', i === next));
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === next);
        dot.setAttribute('aria-current', i === next ? 'true' : 'false');
      });

      syncVideos();
      warm();

      if (countCurrent) {
        countCurrent.textContent = pad(next + 1);
        gsap.fromTo(countCurrent,
          { yPercent: 110 * dir },
          { yPercent: 0, duration: 0.5, ease: 'power3.out', overwrite: true });
      }

      if (prev > -1 && infos[prev]) {
        gsap.to(infos[prev], {
          autoAlpha: 0,
          y: -24 * dir,
          duration: 0.35,
          ease: 'power2.in',
          overwrite: true
        });
      }

      showInfo(next, dir, prev > -1 ? 0.2 : 0.1);
    };

    /* the copy re-appears as the strips leave */
    const intro = createIntro(root.querySelector('[data-iw-intro]'), {
      onOut: () => showInfo(Math.max(current, 0), 1, 0.25)
    });

    /* ---------- scroll ----------
       Steps:  0 = intro   1..N = the N works
       The section is pinned for N viewports. Crossing the first bit of
       scroll plays the intro wipe; every step then snaps into place. */
    const INTRO_OUT_AT = 0.2;   // scrolling forward: wipe starts after this much (in steps)
    const INTRO_IN_AT = 0.8;    // scrolling back: intro returns once back to here
    let introOut = false;

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut', duration: 1 },
      scrollTrigger: {
        trigger: root,
        start: 'top top',
        end: () => `+=${total * root.offsetHeight}`,
        pin: true,
        anticipatePin: 1,
        scrub: reduceMotion ? true : (lite ? 0.3 : 0.5),
        invalidateOnRefresh: true,
        snap: {
          snapTo: (value) => {
            const s = value * total;
            if (s < 1) return (introOut ? 1 : 0) / total;   // intro zone: it is either covered or revealed
            return Math.round(s) / total;                   // works: nearest one
          },
          directional: false,
          inertia: false,                                   // snap from where the scroll actually is, never fling past a work
          delay: 0.06,
          duration: { min: 0.25, max: 0.7 },
          ease: 'power3.inOut'
        },
        onUpdate: (self) => {
          const s = self.progress * total;

          if (!introOut && (s >= 1 || (s > INTRO_OUT_AT && self.direction > 0))) {
            introOut = true;
            intro.hide();
          } else if (introOut && s < INTRO_IN_AT && self.direction < 0) {
            introOut = false;
            intro.show();
          }

          setActive(gsap.utils.clamp(0, total - 1, Math.round(s - 1)));
          gsap.set(barFill, { scaleX: gsap.utils.clamp(0, 1, (s - 1) / (total - 1)) });
        }
      }
    });

    /* work f (1..N-1) slides in during step f -> f+1 */
    for (let f = 1; f < total; f += 1) {
      tl.to(track, { yPercent: -(100 / total) * f }, f);
    }

    /* ---------- film feel while moving: jitter, flash, grain ---------- */
    const setJitterX = gsap.quickSetter(track, 'x', 'px');
    let lastY = 0;
    let intensity = 0;
    let settled = true;

    const tick = () => {
      if (!inView || reduceMotion) return;

      const y = Number(gsap.getProperty(track, 'yPercent')) || 0;
      const speed = Math.abs(y - lastY);
      lastY = y;

      intensity += (gsap.utils.clamp(0, 1, speed / 0.9) - intensity) * 0.2;

      if (intensity < 0.002) {
        if (!settled) {
          settled = true;
          setJitterX(0);
          viewport.style.setProperty('--iw-flash', '0');
          viewport.style.setProperty('--iw-grain', '0.16');
        }
        return;
      }

      settled = false;
      setJitterX((Math.random() - 0.5) * intensity * 5);
      viewport.style.setProperty('--iw-flash', (intensity * 0.16 * Math.random()).toFixed(3));
      viewport.style.setProperty('--iw-grain', (0.16 + intensity * 0.22).toFixed(3));
    };

    if (!lite) gsap.ticker.add(tick);        // jitter / flash / grain are desktop-only

    /* the pinned section may be shorter than the visible area on phones (browser toolbars):
       paint the pin spacer in the section colour so no page background can show through */
    const paintSpacer = () => {
      const spacer = tl.scrollTrigger && tl.scrollTrigger.spacer;
      if (spacer) spacer.style.background = getComputedStyle(root).getPropertyValue('--iw-bg').trim() || '#0b0a09';
    };
    paintSpacer();
    ScrollTrigger.addEventListener('refresh', paintSpacer);

    /* ---------- pause videos when the section is off-screen ---------- */
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        /* the newest entry is last: the first one can be a stale value from before layout settled */
        inView = entries[entries.length - 1].isIntersecting;
        syncVideos();
      }, { threshold: 0.05 });
      observer.observe(root);
    }

    /* ---------- dot navigation (work i sits at step i + 1) ---------- */
    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const st = tl.scrollTrigger;
        if (!st) return;
        const top = st.start + (st.end - st.start) * ((i + 1) / total);
        window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });

    /* ---------- initial state ---------- */
    setActive(0);

    /* start warming the other videos once the first one is playing (or after a short wait) */
    if (videos[0] && videos[0].readyState >= 3) {
      warm();
    } else {
      if (videos[0]) videos[0].addEventListener('canplay', warm, { once: true });
      setTimeout(warm, 4000);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();