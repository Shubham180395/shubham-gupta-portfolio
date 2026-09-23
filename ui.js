(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fine = matchMedia('(pointer: fine)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // If the WebGL module never reports in (CDN blocked, no WebGL), show the CSS fallback orb.
  setTimeout(() => { if (!window.__glReady) document.documentElement.classList.add('no-webgl'); }, 3500);

  /* ───────── palettes / remix ───────── */
  const PALETTES = [
    { a: '#b9a4ff', b: '#5fd3c0' },
    { a: '#ff7a59', b: '#5b6cff' },
    { a: '#d9b779', b: '#8c7bd6' },
    { a: '#8fd3ff', b: '#b69cff' },
  ];
  const ROLES = ['AI Visual Artist', 'Art Director', 'Visual Storyteller', 'Pipeline Builder'];
  let pal = 0, role = 0;

  function remix() {
    pal = (pal + 1) % PALETTES.length;
    const p = PALETTES[pal];
    document.documentElement.style.setProperty('--accent', p.a);
    document.documentElement.style.setProperty('--accent-2', p.b);
    window.dispatchEvent(new CustomEvent('palette', { detail: p }));
    nextRole();
    restartRoleTimer();
  }
  window.addEventListener('orb:click', remix);
  $('#remix')?.addEventListener('click', remix);

  /* ───────── split letters + proximity weight ───────── */
  function split(el) {
    const text = el.textContent;
    el.textContent = '';
    [...text].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = c === ' ' ? 'ch sp' : 'ch';
      s.textContent = c === ' ' ? ' ' : c;
      s.style.setProperty('--i', i);
      el.appendChild(s);
    });
  }
  $$('.hero .split').forEach(split);

  let chars = [];
  const cacheChars = () => {
    chars = $$('.hero .ch').map(el => {
      const r = el.getBoundingClientRect();
      return { el, x: r.left + r.width / 2, y: r.top + r.height / 2 + scrollY };
    });
  };
  addEventListener('load', cacheChars);
  addEventListener('resize', cacheChars);
  document.fonts && document.fonts.ready.then(cacheChars);

  let mx = -9999, my = -9999, proxQueued = false;
  function proximity() {
    proxQueued = false;
    if (scrollY > innerHeight) return;
    const R = 190;
    for (const c of chars) {
      const d = Math.hypot(c.x - mx, c.y - scrollY - my);
      const f = Math.max(0, 1 - d / R);
      const e = f * f * (3 - 2 * f);
      c.el.style.setProperty('--w', (620 + 180 * e).toFixed(0));
      c.el.style.setProperty('--ty', (-0.07 * e).toFixed(3) + 'em');
      c.el.style.setProperty('--g', e.toFixed(3));
    }
  }
  if (fine && !reduced) {
    addEventListener('pointermove', e => {
      mx = e.clientX; my = e.clientY;
      if (!proxQueued) { proxQueued = true; requestAnimationFrame(proximity); }
    }, { passive: true });
  }
  $$('.hero .ch').forEach(c => c.style.setProperty('--w', 620));

  /* rotating role word */
  const roleEl = $('#roleWord');
  let roleTimer;
  function nextRole() {
    role = (role + 1) % ROLES.length;
    roleEl.classList.remove('swap-in');
    roleEl.classList.add('swap-out');
    setTimeout(() => {
      roleEl.textContent = ROLES[role];
      split(roleEl);
      roleEl.classList.remove('swap-out');
      roleEl.classList.add('swap-in');
      $$('.ch', roleEl).forEach(c => c.style.setProperty('--w', 620));
      setTimeout(cacheChars, 50);
    }, reduced ? 0 : 420);
  }
  function restartRoleTimer() {
    clearInterval(roleTimer);
    if (reduced) return;
    roleTimer = setInterval(() => { if (scrollY < innerHeight * .8 && !document.hidden) nextRole(); }, 3600);
  }
  restartRoleTimer();

  /* ───────── HUD parallax ───────── */
  const hud = $$('.hud-chip');
  if (fine && !reduced) {
    addEventListener('pointermove', e => {
      const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
      hud.forEach(h => {
        const d = +h.dataset.depth;
        h.style.setProperty('--px', (-nx * d).toFixed(1) + 'px');
        h.style.setProperty('--py', (-ny * d).toFixed(1) + 'px');
      });
    }, { passive: true });
  }

  /* ───────── cursor: inverting lens + gold comet trail ───────── */
  if (fine) {
    document.body.classList.add('has-cursor');
    const cur = $('.cursor'), lens = $('.cursor-lens'), label = $('.cursor-label'), trailBox = $('.cursor-trail');
    const TRAIL = reduced ? 0 : 12;
    const trail = Array.from({ length: TRAIL }, (_, i) => {
      const d = document.createElement('i');
      const s = 6 - i * .38;
      d.style.width = d.style.height = s + 'px';
      d.style.margin = -s / 2 + 'px 0 0 ' + -s / 2 + 'px';
      d.style.opacity = (1 - i / TRAIL) * .85;
      trailBox.appendChild(d);
      return { el: d, x: innerWidth / 2, y: innerHeight / 2 };
    });
    let x = innerWidth / 2, y = innerHeight / 2, lx = x, ly = y, orbHover = false, disc = false, dx = x, dy = y;
    addEventListener('pointermove', e => {
      x = e.clientX; y = e.clientY;
      if (e.pointerType === 'mouse') { lens.classList.add('on'); cur.style.opacity = 1; }
    }, { passive: true });
    addEventListener('pointerdown', e => {
      lens.classList.add('is-down');
      if (reduced) return;
      const r = document.createElement('span');
      r.className = 'cursor-ripple';
      r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
      document.body.appendChild(r);
      r.addEventListener('animationend', () => r.remove());
    });
    addEventListener('pointerup', () => lens.classList.remove('is-down'));
    const setState = t => {
      const lab = t && t.closest('[data-cursor]');
      const link = t && t.closest('a, button, summary, [data-tilt]');
      const text = t && t.closest('h1, h2, .contact-title, .feature-title');
      const labelText = lab ? lab.dataset.cursor : orbHover ? 'Drag' : '';
      // over the orb the cursor becomes a big gold "Drag" disc, as in the original design
      disc = !lab && orbHover;
      label.textContent = labelText;
      label.classList.toggle('on', !!labelText);
      label.classList.toggle('disc', disc);
      lens.classList.toggle('is-disc', disc);
      lens.classList.toggle('is-label', !!labelText);
      lens.classList.toggle('is-link', !labelText && !!link);
      lens.classList.toggle('is-text', !labelText && !link && !!text);
      cur.classList.toggle('hide-trail', !!labelText || !!text);
    };
    let lastT = null;
    addEventListener('pointerover', e => { lastT = e.target; setState(lastT); });
    window.addEventListener('orb:hover', e => {
      orbHover = e.detail && !(lastT && lastT.closest('a, button'));
      setState(lastT);
    });
    document.addEventListener('mouseleave', () => { lens.classList.remove('on'); cur.style.opacity = 0; });
    document.addEventListener('mouseenter', () => { lens.classList.add('on'); cur.style.opacity = 1; });
    (function loop() {
      lx += (x - lx) * .28; ly += (y - ly) * .28;
      lens.style.transform = `translate3d(${lx}px,${ly}px,0)`;
      // the disc trails the pointer softly; the pill sits just off it
      dx += (x - dx) * .22; dy += (y - dy) * .22;
      label.style.transform = disc ? `translate3d(${dx}px,${dy}px,0)` : `translate3d(${x + 18}px,${y + 18}px,0)`;
      if (!disc) { dx = x; dy = y; }
      let px = x, py = y;
      for (const p of trail) {
        p.x += (px - p.x) * .42; p.y += (py - p.y) * .42;
        p.el.style.transform = `translate3d(${p.x}px,${p.y}px,0)`;
        px = p.x; py = p.y;
      }
      requestAnimationFrame(loop);
    })();
  }

  /* ───────── ambient shades drift slightly with scroll ───────── */
  const amb = $('.ambient');
  if (amb && !reduced) {
    let ambQueued = false;
    addEventListener('scroll', () => {
      if (ambQueued) return; ambQueued = true;
      requestAnimationFrame(() => { amb.style.setProperty('--amb-shift', (-scrollY * .04).toFixed(1)); ambQueued = false; });
    }, { passive: true });
  }

  /* ───────── nav ───────── */
  const nav = $('.nav');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    nav.classList.toggle('is-hidden', y > lastY && y > 400);
    lastY = y;
  }, { passive: true });

  const links = $$('.nav-links a');
  const secIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main section[id], main header[id]').forEach(s => secIO.observe(s));

  const toggle = $('.nav-toggle'), menu = $('.mobile-menu');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  });
  $$('a', menu).forEach(a => a.addEventListener('click', () => toggle.click()));

  /* ───────── reveal ───────── */
  const groups = new Map();
  $$('.reveal').forEach(el => {
    const p = el.parentElement;
    const n = groups.get(p) || 0;
    groups.set(p, n + 1);
    el.style.setProperty('--d', Math.min(n, 6) * 0.08 + 's');
  });
  const revIO = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); revIO.unobserve(en.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach(el => revIO.observe(el));

  /* ───────── counters ───────── */
  const cIO = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      cIO.unobserve(en.target);
      const el = en.target, to = +el.dataset.count, t0 = performance.now(), dur = reduced ? 0 : 1600;
      (function tick(t) {
        const k = dur ? clamp((t - t0) / dur, 0, 1) : 1;
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: .6 });
  $$('[data-count]').forEach(el => cIO.observe(el));

  /* ───────── tilt ───────── */
  $$('[data-z]').forEach(el => el.style.setProperty('--z', el.dataset.z));
  if (fine && !reduced) {
    $$('.tilt').forEach(el => {
      const max = +el.dataset.tilt || 8;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.classList.add('is-tilting');
        el.style.setProperty('--ry', ((px - .5) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--rx', (-(py - .5) * max * 2).toFixed(2) + 'deg');
        el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
        el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', () => {
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });

    /* magnetic */
    $$('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${dx * .22}px, ${dy * .32}px)`;
      });
      el.addEventListener('pointerleave', () => el.style.transform = '');
    });

    /* screenshot stack leans toward the pointer */
    const stack = $('#stack'), si = $('.stack-inner');
    stack.addEventListener('pointermove', e => {
      const r = stack.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      si.style.setProperty('--ry', (px * 18).toFixed(2) + 'deg');
      si.style.setProperty('--rx', (-py * 14).toFixed(2) + 'deg');
    });
    stack.addEventListener('pointerleave', () => { si.style.setProperty('--rx', '0deg'); si.style.setProperty('--ry', '0deg'); });
  }

  /* ───────── award cards: spotlight follows the pointer ───────── */
  $$('.spot').forEach(el => el.addEventListener('pointermove', e => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  /* ───────── screenshot stack tabs ───────── */
  const shots = $$('.shot'), tabs = $$('.shot-tabs button');
  let order = [0, 1, 2], autoShot = null, picked = false;
  function showShot(i) {
    order = [i, ...order.filter(n => n !== i)];
    shots.forEach(s => {
      const k = order.indexOf(+s.dataset.i);
      s.style.setProperty('--k', k);
      s.style.zIndex = 10 - k;
    });
    tabs.forEach(t => t.setAttribute('aria-pressed', +t.dataset.shot === i));
  }
  showShot(0);
  tabs.forEach(t => t.addEventListener('click', () => { picked = true; clearInterval(autoShot); showShot(+t.dataset.shot); }));
  if (!reduced) {
    new IntersectionObserver(([en]) => {
      clearInterval(autoShot);
      if (en.isIntersecting && !picked) {
        autoShot = setInterval(() => { if (!$('#stack').matches(':hover')) showShot(order[1]); }, 3800);
      }
    }, { threshold: .35 }).observe($('#lab'));
  }

  /* ───────── coverflow (infinite loop) ───────── */
  const flow = $('#flow'), cards = $$('.flow-card'), n = cards.length;
  let pos = 2, target = 2, active = -1, dragging = false, moved = 0, startX = 0, startPos = 0, lastX = 0, vel = 0, inView = true;
  const info = { g: $('#flowGenre'), t: $('#flowTitle'), d: $('#flowDesc'), s: $('#flowStat'), l: $('#flowLink'), box: $('.flow-text') };
  const dots = $('#flowDots');
  const mod = i => ((i % n) + n) % n;
  // shortest signed distance around the ring, in (-n/2, n/2]
  const wrap = o => { o = mod(o); return o > n / 2 ? o - n : o; };
  const go = step => { target = Math.round(target) + step; pauseAuto(); };
  cards.forEach((c, i) => {
    c.setAttribute('draggable', 'false');
    dots.appendChild(document.createElement('i'));
    c.addEventListener('click', e => {
      if (moved > 6) { e.preventDefault(); return; }
      if (i !== active) { e.preventDefault(); target = Math.round(pos) + wrap(i - Math.round(pos)); pauseAuto(); }
    });
  });
  flow.addEventListener('dragstart', e => e.preventDefault());

  function setActive(i) {
    if (i === active) return;
    const first = active === -1;
    active = i;
    const c = cards[i];
    cards.forEach((k, j) => { k.classList.toggle('is-active', j === i); k.toggleAttribute('aria-current', j === i); k.tabIndex = -1; });
    $$('i', dots).forEach((d, j) => d.classList.toggle('on', j === i));
    const apply = () => {
      info.g.textContent = c.dataset.genre;
      info.t.textContent = c.dataset.title;
      info.d.textContent = c.dataset.desc;
      info.s.textContent = c.dataset.stat;
      info.l.href = c.href;
      info.l.setAttribute('aria-label', 'Watch ' + c.dataset.title);
      info.box.classList.remove('fade');
    };
    if (first || reduced) apply();
    else { info.box.classList.add('fade'); setTimeout(apply, 220); }
  }

  function spacing() { return cards[0].offsetWidth * (innerWidth < 640 ? .52 : .66); }
  function renderFlow() {
    const sp = spacing();
    cards.forEach((c, i) => {
      const o = wrap(i - pos), a = Math.abs(o);
      const rot = clamp(o, -1, 1) * -44;
      c.style.transform = `translate3d(${o * sp}px,0,${-a * 200}px) rotateY(${rot}deg) scale(${1 - Math.min(a, 3) * .03})`;
      c.style.zIndex = 100 - Math.round(a * 10);
      c.style.filter = `brightness(${1 - Math.min(a, 2) * .32})`;
      // cards crossing the back of the ring fade out so the wrap-around jump is never seen
      c.style.opacity = a > 1.85 ? Math.max(0, 1 - (a - 1.85) / .6) : 1;
      c.style.pointerEvents = a > 2.2 ? 'none' : '';
      c.style.setProperty('--shine', Math.max(0, .9 - a));
    });
    setActive(mod(Math.round(pos)));
  }
  (function flowLoop() {
    if (inView && !dragging) {
      const d = target - pos;
      if (Math.abs(d) > .0005) { pos += d * (reduced ? 1 : .11); renderFlow(); }
      else if (pos !== target || Math.abs(target) > n * 50) {
        // settle exactly and keep the numbers small
        const k = Math.floor(target / n) * n;
        pos = target = target - k;
        renderFlow();
      }
    }
    requestAnimationFrame(flowLoop);
  })();
  new IntersectionObserver(([en]) => { inView = en.isIntersecting; }).observe(flow);

  /* auto-advance: pauses on hover, focus, drag or button use, and while off-screen */
  let hovering = false, pausedUntil = 0;
  function pauseAuto(ms = 6000) { pausedUntil = performance.now() + ms; }
  flow.addEventListener('pointerenter', () => hovering = true);
  flow.addEventListener('pointerleave', () => hovering = false);
  if (!reduced) {
    setInterval(() => {
      if (inView && !hovering && !dragging && !document.hidden && !flow.matches(':focus-visible') && performance.now() > pausedUntil) {
        target = Math.round(target) + 1;
      }
    }, 3800);
  }

  flow.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragging = true; moved = 0; startX = lastX = e.clientX; startPos = pos; vel = 0;
  });
  addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    vel = e.clientX - lastX; lastX = e.clientX;
    pos = startPos - dx / spacing();
    renderFlow();
  }, { passive: true });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    target = Math.round(pos - vel / 18);
    pauseAuto();
  };
  addEventListener('pointerup', endDrag);
  addEventListener('pointercancel', endDrag);
  flow.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { go(1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); }
    if (e.key === 'Enter') { window.open(cards[active].href, '_blank', 'noopener'); }
  });
  $('#flowPrev').addEventListener('click', () => go(-1));
  $('#flowNext').addEventListener('click', () => go(1));
  addEventListener('resize', renderFlow);
  renderFlow();

  /* ───────── background video: silent loop, plays only while on screen ───────── */
  const bgVid = $('#contactVideo');
  if (bgVid && !reduced) {
    new IntersectionObserver(([en]) => { en.isIntersecting ? bgVid.play().catch(() => {}) : bgVid.pause(); }, { threshold: .05 }).observe(bgVid);
  }

  /* ───────── skill sphere ───────── */
  const TAGS = ['Seedance 2.0', 'Seedream', 'Nano Banana', 'Midjourney', 'Veo', 'Frameo.ai', 'ChatGPT', 'Gemini',
    'Photoshop', 'Illustrator', 'Figma', 'Canva', 'Premiere Pro', 'Toon Boom', 'Adobe Creative Suite',
    'AI Workflows', 'Character Consistency', 'Visual QA', 'Art Direction', 'Creative Direction',
    'Team Leadership', 'Storyboarding', 'Narrative Design', 'Cinematic Framing', 'Character Design',
    'Thumbnail Strategy', '2D Animation', 'Branding', 'UX Thinking'];
  const HOT = new Set(['Seedance 2.0', 'Veo', 'Midjourney', 'Art Direction', 'Creative Direction', 'Character Consistency']);
  const sphere = $('#sphere');
  const pts = TAGS.map((t, i) => {
    const s = document.createElement('span');
    s.textContent = t;
    if (HOT.has(t)) s.className = 'hot';
    sphere.appendChild(s);
    const y = 1 - (i / (TAGS.length - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * Math.PI * (3 - Math.sqrt(5));
    return { el: s, x: Math.cos(th) * r, y, z: Math.sin(th) * r };
  });
  let ax = .0025, ay = .004, sDrag = false, sx = 0, sy = 0, sphereOn = false;
  function rotate(a, b) {
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    for (const p of pts) {
      let y = p.y * ca - p.z * sa, z = p.y * sa + p.z * ca;
      let x = p.x * cb + z * sb; z = -p.x * sb + z * cb;
      p.x = x; p.y = y; p.z = z;
    }
  }
  function drawSphere() {
    const R = sphere.offsetWidth * .43;
    for (const p of pts) {
      const k = (p.z + 1) / 2;
      p.el.style.transform = `translate(-50%,-50%) translate3d(${(p.x * R).toFixed(1)}px,${(p.y * R).toFixed(1)}px,0) scale(${(.58 + k * .46).toFixed(3)})`;
      p.el.style.opacity = (.22 + k * .78).toFixed(2);
      p.el.style.zIndex = Math.round(k * 100);
    }
  }
  sphere.addEventListener('pointermove', e => {
    const r = sphere.getBoundingClientRect();
    if (sDrag) {
      ay = (e.clientX - sx) * .0009; ax = -(e.clientY - sy) * .0009; sx = e.clientX; sy = e.clientY;
    } else if (fine) {
      const nx = (e.clientX - r.left) / r.width - .5, ny = (e.clientY - r.top) / r.height - .5;
      ay = nx * .02; ax = -ny * .02;
    }
  });
  sphere.addEventListener('pointerdown', e => { sDrag = true; sx = e.clientX; sy = e.clientY; });
  addEventListener('pointerup', () => sDrag = false);
  new IntersectionObserver(([en]) => { sphereOn = en.isIntersecting; }).observe(sphere);
  (function sphereLoop() {
    if (sphereOn) {
      rotate(ax, ay);
      if (!sDrag && !reduced) { ax += (.0015 - ax) * .01; ay += (.0035 - ay) * .01; }
      drawSphere();
    }
    requestAnimationFrame(sphereLoop);
  })();
  drawSphere();
  if (reduced) { ax = ay = 0; }

  /* ───────── copy email ───────── */
  const toast = $('.toast');
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast.textContent = 'Email copied ✓'; }
    catch { toast.textContent = b.dataset.copy; }
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }));
})();
