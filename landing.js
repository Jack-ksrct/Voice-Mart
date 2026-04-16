/**
 * landing.js — Voice Mart landing page interactions
 *
 * Responsibilities (single-responsibility per function):
 *  - Sticky nav shadow on scroll
 *  - IntersectionObserver-driven entrance animations
 *  - "Learn more" smooth scroll
 *  - Offline sync button + toast notification
 *
 * No framework dependencies. Vanilla ES2020.
 * Runs only on the landing page; the dashboard loads app.js separately.
 */

"use strict";

/* ─── Offline sync state ─────────────────────────────────────────────────── */

/**
 * Returns a simple offline-sync status derived from navigator.onLine.
 * In production this would check a Service Worker cache status.
 * @returns {{ isOnline: boolean, label: string }}
 */
function getOfflineStatus() {
  return {
    isOnline: navigator.onLine,
    label: navigator.onLine
      ? "You are online. Offline sync is standing by."
      : "You are offline. Changes will sync when connectivity returns.",
  };
}

/** @param {HTMLElement} toast */
function showToast(toast) {
  toast.classList.remove("hidden");
  // Auto-dismiss after 4 s
  window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 4000);
}

/* ─── Sticky nav ─────────────────────────────────────────────────────────── */

/**
 * Adds/removes the `.scrolled` class on the nav element based on
 * whether the page has been scrolled past the initial threshold.
 * Uses requestAnimationFrame to throttle the scroll handler.
 *
 * @param {HTMLElement} nav
 */
function initStickyNav(nav) {
  const SCROLL_THRESHOLD = 40;
  let ticking = false;

  function updateNav() {
    nav.classList.toggle("scrolled", window.scrollY > SCROLL_THRESHOLD);
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(updateNav);
      ticking = true;
    }
  }, { passive: true });

  // Initial state (handles hard-refresh mid-page)
  updateNav();
}

/* ─── Scroll-driven entrance animations ─────────────────────────────────── */

/**
 * Observes all `.fade-up` elements and applies `.visible` when they
 * enter the viewport. Uses a single shared IntersectionObserver for
 * efficiency. Unobserves each element after it becomes visible
 * (one-shot reveal — no need to re-trigger on scroll-up).
 */
function initScrollReveal() {
  const targets = document.querySelectorAll(".fade-up");
  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  targets.forEach((el) => observer.observe(el));
}

/* ─── Smooth scroll to target section ───────────────────────────────────── */

/**
 * Scrolls smoothly to the given element, accounting for the
 * fixed nav height so the heading isn't obscured.
 *
 * @param {HTMLElement} target
 * @param {number} [navOffset=72]
 */
function scrollToSection(target, navOffset = 72) {
  const top = target.getBoundingClientRect().top + window.scrollY - navOffset;
  window.scrollTo({ top, behavior: "smooth" });
}

/* ─── Event wiring ───────────────────────────────────────────────────────── */

/**
 * Wires all interactive elements on the landing page.
 * Called once on DOMContentLoaded.
 */
function initLanding() {
  const nav            = document.getElementById("landingNav");
  const offlineSyncBtn = document.getElementById("offlineSyncBtn");
  const learnMoreBtn   = document.getElementById("heroLearnMoreBtn");
  const offlineToast   = document.getElementById("offlineToast");
  const howSection     = document.getElementById("howItWorks");

  if (nav) initStickyNav(nav);
  initScrollReveal();

  /* Offline sync button */
  if (offlineSyncBtn && offlineToast) {
    offlineSyncBtn.addEventListener("click", () => {
      const { label } = getOfflineStatus();
      offlineToast.childNodes[offlineToast.childNodes.length - 1].textContent = ` ${label}`;
      showToast(offlineToast);
    });
  }

  /* "See how it works" → smooth scroll to the How section */
  if (learnMoreBtn && howSection) {
    learnMoreBtn.addEventListener("click", () => {
      scrollToSection(howSection);
    });
  }

  /* Reflect online/offline network changes in the offline dot color */
  function syncDotColor(isOnline) {
    const dot = offlineSyncBtn?.querySelector(".offline-dot");
    if (!dot) return;
    dot.style.background = isOnline
      ? "var(--green)"
      : "var(--danger, #a63e2e)";
  }

  window.addEventListener("online",  () => syncDotColor(true));
  window.addEventListener("offline", () => syncDotColor(false));
  syncDotColor(navigator.onLine);
}

/* ─── Boot ───────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", initLanding);
