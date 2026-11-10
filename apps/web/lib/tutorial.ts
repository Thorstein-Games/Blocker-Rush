/*
 * First-run tutorial: up to 3 short steps over the game, always skippable.
 * The same file lives in every Thorstein Games repo; keep the copies in step.
 *
 * A step either points at part of the page (`target`: the rest of the screen
 * dims and the card sits clear of it), shows a small picture (`art`, static
 * HTML), or holds a tiny playable demo (`demo`, mounted inside the card).
 * Everything renders in shadow DOM, so the game's CSS can't reach it.
 */

export type TutorialDemoApi = {
  /**
   * The player did the thing: show `message` and light up Next. With
   * `advance`, the next step opens by itself after a moment (`ADVANCE_MS`).
   */
  done(message?: string, options?: { advance?: boolean }): void;
  /** Change the hint line under the demo. */
  say(message: string): void;
};

export type TutorialStep = {
  title: string;
  body: string;
  /** CSS selector (or a function) for the part of the page to point at. */
  target?: string | (() => Element | null);
  /** Static, trusted HTML drawn in the card (a picture of the UI). */
  art?: string;
  /** Mounts a playable demo in `mount`; returns a cleanup function. */
  demo?: (mount: HTMLElement, api: TutorialDemoApi) => (() => void) | void;
};

export type TutorialOptions = {
  /** localStorage key that remembers the tutorial was shown (namespace it per game). */
  key: string;
  /** Names the dialog for screen readers, e.g. "Pix Pen tutorial". */
  label: string;
  steps: TutorialStep[];
  /** Button colour and the text colour on it. */
  accent?: string;
  accentText?: string;
  /** Extra CSS for `art` and `demo` (they live in the same shadow root). */
  css?: string;
  onClose?: (finished: boolean) => void;
};

const HOST_ID = "game-tutorial";
/** How long a demo's success message shows before `advance` moves on. */
export const ADVANCE_MS = 1500;
/** On a first visit, how long the page shows before scrolling to the first step's target. */
const FIRST_SCROLL_DELAY_MS = 1000;
/** Room the shared 40px bar (and a little air) takes at the top. */
const TOP_CLEAR = 48;

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or blocked storage: it just shows again next time */
  }
}

/** Has this browser seen the tutorial already? */
export function tutorialSeen(key: string): boolean {
  return storageGet(key) !== null;
}

/**
 * Opens the tutorial the first time a browser loads the game. Automated
 * browsers (crawlers, other tests, jsdom) never get it unless a test sets
 * `window.__tutorialAuto = true` first.
 */
export function autoTutorial(options: TutorialOptions): boolean {
  if (typeof window === "undefined" || tutorialSeen(options.key)) return false;
  const w = window as unknown as { __tutorialAuto?: boolean };
  const automated = navigator.webdriver || /jsdom/i.test(navigator.userAgent);
  if (automated && !w.__tutorialAuto) return false;
  // Let the page be seen first; a replay (the player asked) moves at once.
  openTutorial(options, FIRST_SCROLL_DELAY_MS);
  return true;
}

let closeOpen: (() => void) | null = null;

export function tutorialOpen(): boolean {
  return closeOpen !== null;
}

/**
 * Opens the tutorial now (the replay button), scrolling to the first step's
 * target after `firstDelay` ms. Returns a function that closes it.
 */
export function openTutorial(options: TutorialOptions, firstDelay = 0): () => void {
  closeOpen?.();
  storageSet(options.key, "seen");
  const steps = options.steps.slice(0, 3);
  const accent = options.accent ?? "#f5b942";
  const accentText = options.accentText ?? "#15120a";

  const host = document.createElement("div");
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${STYLE}${options.css ?? ""}</style>
    <div class="scrim" part="scrim"></div>
    <div class="hole" hidden></div>
    <div class="card" tabindex="-1" role="dialog" aria-modal="true" aria-label="${escapeHtml(options.label)}">
      <div class="top">
        <span class="count" aria-hidden="true"></span>
        <button type="button" class="x" aria-label="Close tutorial">×</button>
      </div>
      <h2 class="title"></h2>
      <p class="body"></p>
      <div class="extra"></div>
      <p class="status" role="status" aria-live="polite"></p>
      <div class="dots" aria-hidden="true"></div>
      <div class="nav">
        <button type="button" class="skip">Skip</button>
        <span class="spacer"></span>
        <button type="button" class="back">Back</button>
        <button type="button" class="next"></button>
      </div>
    </div>`;
  host.style.setProperty("--accent", accent);
  host.style.setProperty("--accent-text", accentText);
  document.body.appendChild(host);

  const $ = <T extends Element>(sel: string) => root.querySelector(sel) as T;
  const card = $<HTMLElement>(".card");
  const scrim = $<HTMLElement>(".scrim");
  const hole = $<HTMLElement>(".hole");
  const titleEl = $<HTMLElement>(".title");
  const bodyEl = $<HTMLElement>(".body");
  const extra = $<HTMLElement>(".extra");
  const status = $<HTMLElement>(".status");
  const count = $<HTMLElement>(".count");
  const dots = $<HTMLElement>(".dots");
  const next = $<HTMLButtonElement>(".next");
  const back = $<HTMLButtonElement>(".back");
  const skip = $<HTMLButtonElement>(".skip");
  const closeBtn = $<HTMLButtonElement>(".x");
  const titleId = "tutorial-title";
  titleEl.id = titleId;
  card.setAttribute("aria-describedby", "tutorial-body");
  bodyEl.id = "tutorial-body";
  dots.innerHTML = steps.map(() => "<i></i>").join("");

  const previousFocus = document.activeElement as HTMLElement | null;
  let index = 0;
  let cleanup: (() => void) | void;
  let frame = 0;
  let target: Element | null = null;
  let lastRect = "";
  /** Timer for a pending scroll or auto-advance; cleared on every step change and on close. */
  let timer = 0;
  let travel = 0;
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Is the target on screen, clear of the card, so it can be pointed at without scrolling? */
  function inView(el: Element): boolean {
    const r = el.getBoundingClientRect();
    const cardRoom = card.offsetHeight + 24;
    if (r.height > innerHeight - TOP_CLEAR - cardRoom) return r.top >= TOP_CLEAR && r.top < TOP_CLEAR + 24;
    const above = r.top >= TOP_CLEAR && r.bottom <= innerHeight - cardRoom; // card fits below it
    const below = r.top >= TOP_CLEAR + cardRoom && r.bottom <= innerHeight; // card fits above it
    return above || below;
  }

  /**
   * Scrolls the target into view so the player sees the page move: the card
   * fades out, the page glides there, and the card comes back once it stops.
   */
  function travelTo(el: Element, delay: number) {
    host.classList.add("moving");
    timer = window.setTimeout(() => {
      host.classList.remove("waiting");
      // Land the target in the space the card leaves free below it (the card
      // then sits underneath), rather than centring it where the card would cover it.
      const r = el.getBoundingClientRect();
      const free = innerHeight - TOP_CLEAR - card.offsetHeight - 24;
      const at = r.height <= free ? TOP_CLEAR + (free - r.height) / 2 : TOP_CLEAR + 8;
      try {
        window.scrollTo({ top: scrollY + r.top - at, behavior: reduceMotion() ? "auto" : "smooth" });
      } catch {
        window.scrollTo(0, scrollY + r.top - at);
      }
      // Wait until the target stops moving (smooth scrolling has no reliable end event).
      const started = performance.now();
      let last = "";
      let still = 0;
      const settle = () => {
        const r = el.getBoundingClientRect();
        const key = `${r.top},${r.left}`;
        still = key === last ? still + 1 : 0;
        last = key;
        const waited = performance.now() - started;
        if ((still >= 6 && waited > 150) || waited > 1600) {
          host.classList.remove("moving");
          focusStep();
          return;
        }
        travel = requestAnimationFrame(settle);
      };
      travel = requestAnimationFrame(settle);
    }, delay);
  }

  function stopTimers() {
    window.clearTimeout(timer);
    cancelAnimationFrame(travel);
    host.classList.remove("moving", "waiting");
  }

  function findTarget(step: TutorialStep): Element | null {
    if (!step.target) return null;
    try {
      const el = typeof step.target === "function" ? step.target() : document.querySelector(step.target);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? el : null;
    } catch {
      return null;
    }
  }

  function place() {
    if (!target || !target.isConnected) {
      hole.hidden = true;
      card.dataset.at = "middle";
      scrim.classList.remove("clear");
      // The game may still be rendering (or re-rendering) the part this step
      // points at, so keep looking for it while the step is open.
      const step = steps[index];
      const found = step ? findTarget(step) : null;
      if (found) {
        target = found;
        lastRect = "";
        if (!inView(found) && !host.classList.contains("moving")) travelTo(found, 0);
      }
      frame = requestAnimationFrame(place);
      return;
    }
    const r = target.getBoundingClientRect();
    const key = `${r.left},${r.top},${r.width},${r.height},${innerWidth},${innerHeight}`;
    if (key !== lastRect) {
      lastRect = key;
      const pad = 6;
      hole.hidden = false;
      hole.style.left = `${r.left - pad}px`;
      hole.style.top = `${r.top - pad}px`;
      hole.style.width = `${r.width + pad * 2}px`;
      hole.style.height = `${r.height + pad * 2}px`;
      scrim.classList.add("clear");
      // Sit the card on whichever side of the target has more room.
      card.dataset.at = innerHeight - r.bottom > r.top ? "bottom" : "top";
    }
    frame = requestAnimationFrame(place);
  }

  function show(i: number, delay = 0) {
    if (typeof cleanup === "function") cleanup();
    cleanup = undefined;
    cancelAnimationFrame(frame);
    stopTimers();
    const step = steps[i];
    if (!step) return;
    index = i;
    titleEl.textContent = step.title;
    bodyEl.textContent = step.body;
    status.textContent = "";
    next.classList.remove("ready");
    // On a demo step, Next stays quiet until the player has done the thing.
    next.classList.toggle("quiet", !!step.demo);
    count.textContent = steps.length > 1 ? `${i + 1} of ${steps.length}` : "";
    dots.querySelectorAll("i").forEach((d, j) => d.classList.toggle("on", j === i));
    const last = i === steps.length - 1;
    next.textContent = last ? "Let's play" : "Next";
    back.hidden = i === 0;
    skip.hidden = last;
    extra.innerHTML = step.art ?? "";
    extra.hidden = !step.art && !step.demo;
    if (step.demo) {
      const mount = document.createElement("div");
      mount.className = "demo";
      extra.appendChild(mount);
      cleanup = step.demo(mount, {
        done(message, opts) {
          status.textContent = message ?? "Nice!";
          status.classList.add("good");
          next.classList.remove("quiet");
          next.classList.add("ready");
          if (opts?.advance) {
            window.clearTimeout(timer);
            const from = i;
            timer = window.setTimeout(() => index === from && goNext(), ADVANCE_MS);
          }
        },
        say(message) {
          status.classList.remove("good");
          status.textContent = message;
        },
      });
    }
    target = findTarget(step);
    lastRect = "";
    if (target && !inView(target)) {
      // On opening, let the page be seen first; between steps, go straight there.
      if (delay) host.classList.add("waiting");
      travelTo(target, delay);
    }
    place();
    if (!host.classList.contains("moving")) focusStep();
  }

  /** Focus the card on a demo step (so the demo, not Next, reads as the thing to do), else Next. */
  function focusStep() {
    (steps[index]?.demo ? card : next).focus({ preventScroll: true });
  }

  const goNext = () => (index < steps.length - 1 ? show(index + 1) : close(true));

  function close(finished: boolean) {
    if (closeOpen !== closeNow) return;
    closeOpen = null;
    if (typeof cleanup === "function") cleanup();
    cancelAnimationFrame(frame);
    stopTimers();
    window.removeEventListener("keydown", onWindowKey, true);
    host.remove();
    try {
      previousFocus?.focus({ preventScroll: true });
    } catch {
      /* gone */
    }
    options.onClose?.(finished);
  }
  const closeNow = () => close(false);

  // Keys typed while the tutorial is open never reach the game (arrow keys would
  // move the real board underneath). Demos listen on the card's shadow root.
  function onWindowKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(false);
      return;
    }
    if (e.target === host) return; // inside the card: onHostKey has it
    e.stopPropagation();
    if (e.key === "Tab") {
      e.preventDefault();
      next.focus();
    }
  }

  function onHostKey(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key !== "Tab") return;
    const focusable = Array.from(card.querySelectorAll<HTMLElement>("button, [tabindex='0']")).filter(
      (el) => !el.hidden && el.offsetParent !== null && !(el as HTMLButtonElement).disabled,
    );
    if (!focusable.length) return;
    const active = root.activeElement as HTMLElement | null;
    const at = active ? focusable.indexOf(active) : -1;
    const to = e.shiftKey ? (at <= 0 ? focusable.length - 1 : at - 1) : at === focusable.length - 1 ? 0 : at + 1;
    e.preventDefault();
    focusable[to]?.focus();
  }

  next.addEventListener("click", goNext);
  back.addEventListener("click", () => index > 0 && show(index - 1));
  skip.addEventListener("click", () => close(false));
  closeBtn.addEventListener("click", () => close(false));
  scrim.addEventListener("click", () => close(false));
  // Tapping the part being pointed at is a natural "got it", not a request to quit.
  hole.addEventListener("click", goNext);
  window.addEventListener("keydown", onWindowKey, true);
  host.addEventListener("keydown", onHostKey);

  closeOpen = closeNow;
  show(0, firstDelay);
  return closeNow;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const STYLE = `
:host { all: initial; }
* { box-sizing: border-box; }
.scrim { position: fixed; inset: 0; z-index: 2147483000; background: rgba(6, 7, 12, 0.72); }
.scrim.clear { background: transparent; }
.hole {
  position: fixed; z-index: 2147483001; border-radius: 12px; pointer-events: auto;
  box-shadow: 0 0 0 3px var(--accent), 0 0 0 200vmax rgba(6, 7, 12, 0.72);
  transition: opacity .25s ease, left .2s, top .2s, width .2s, height .2s;
}
.hole[hidden] { display: none; }
.card {
  position: fixed; z-index: 2147483002; left: 50%; transform: translateX(-50%);
  width: min(420px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); overflow: auto;
  background: #16171e; color: #f4f4f6; border: 1px solid rgba(255,255,255,.14); border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,.55); padding: 14px 18px 16px;
  font: 16px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; text-align: left;
}
.scrim, .card { transition: opacity .25s ease; }
:host(.moving) .card { opacity: 0; pointer-events: none; }
:host(.moving) .hole { transition: opacity .25s ease; }
:host(.waiting) .scrim, :host(.waiting) .hole { opacity: 0; pointer-events: none; }
.card[data-at="middle"] { top: 50%; transform: translate(-50%, -50%); }
.card[data-at="bottom"] { bottom: max(12px, env(safe-area-inset-bottom)); }
.card[data-at="top"] { top: 52px; }
.top { display: flex; align-items: center; justify-content: space-between; min-height: 28px; }
.count { font-size: 13px; color: #a9abb6; letter-spacing: .02em; }
.x {
  position: relative; border: 0; background: none; color: #c9cad3; font: 26px/1 system-ui, sans-serif;
  width: 32px; height: 32px; margin-right: -8px; border-radius: 8px; cursor: pointer;
}
.x::after { content: ""; position: absolute; inset: -6px; }
.x:hover { background: rgba(255,255,255,.08); color: #fff; }
.title { margin: 2px 0 6px; font-size: 20px; line-height: 1.25; font-weight: 750; }
.body { margin: 0 0 10px; color: #d8d9e0; }
.extra { margin: 10px 0 4px; }
.extra[hidden] { display: none; }
.status { min-height: 1.45em; margin: 6px 0 0; font-size: 15px; color: #c9cad3; }
.status.good { color: #8ee59a; font-weight: 650; }
.status:empty { min-height: 0; margin: 0; }
.dots { display: flex; gap: 6px; justify-content: center; margin: 12px 0 4px; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.22); }
.dots i.on { background: var(--accent); box-shadow: 0 0 0 1px rgba(255,255,255,.35); }
.nav { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
.spacer { flex: 1; }
button { font: inherit; }
.nav button { min-height: 44px; padding: 0 16px; border-radius: 10px; cursor: pointer; font-weight: 650; }
.skip, .back { background: none; border: 1px solid rgba(255,255,255,.2); color: #e4e5ea; }
.skip { border-color: transparent; color: #b4b6c0; padding: 0 8px; }
.skip:hover, .back:hover { background: rgba(255,255,255,.08); }
.next { background: var(--accent); color: var(--accent-text); border: 1px solid var(--accent); }
.next.quiet { background: none; color: #e4e5ea; border-color: rgba(255,255,255,.2); }
.next.quiet:hover { background: rgba(255,255,255,.08); }
.card:focus { outline: none; }
.next.ready { animation: ready 1s ease-in-out 2; }
[hidden] { display: none !important; }
button:focus-visible { outline: 3px solid #fff; outline-offset: 2px; }
@keyframes ready { 50% { transform: scale(1.07); box-shadow: 0 0 0 6px rgba(255,255,255,.15); } }
@media (prefers-reduced-motion: reduce) { .scrim, .hole, .card { transition: none; } .next.ready { animation: none; } }
`;
