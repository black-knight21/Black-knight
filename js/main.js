// main.js — DOM, observers, cursor, boss overlay, vital bars, projects
import { createArenaScene } from "./scene3d.js";
import { projects } from "./projects.js";

// ─── Utility ────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const qs = (el, sel) => el.querySelector(sel);

// ─── Globals ────────────────────────────────────────────────────
let arena = null;
let currentSection = "hero";

// ─── Loader ─────────────────────────────────────────────────────
const loader = $("#loader");

// ─── 3D Scene init ──────────────────────────────────────────────
const canvas = $("#arena-canvas");

arena = createArenaScene(canvas, {
  onProgress(p) {
    // Could update a progress bar here if needed
  },
  onReady() {
    loader.classList.add("hidden");
    setTimeout(() => loader.remove(), 700);
  },
  onImpact() {
    // Could trigger screen-shake etc.
  },
});

// ─── Filter bar ─────────────────────────────────────────────────
function initFilterBar() {
  const bar = $(".filter-bar");
  if (!bar) return;

  const btns = $$(".filter-btn");
  const indicator = $(".filter-indicator");

  function moveIndicator(btn) {
    const barRect = bar.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    indicator.style.width = btnRect.width + "px";
    indicator.style.transform = `translateX(${btnRect.left - barRect.left - parseInt(getComputedStyle(bar).paddingLeft)}px)`;
  }

  // Set initial position on the active button
  const activeBtn = bar.querySelector(".filter-btn.is-active") || btns[0];
  // Wait for layout
  requestAnimationFrame(() => moveIndicator(activeBtn));

  btns.forEach((btn) => {
    btn.addEventListener("click", () => {
      btns.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      moveIndicator(btn);

      const filter = btn.dataset.filter;
      $$(".project-card").forEach((card) => {
        if (filter === "all" || card.dataset.category === filter) {
          card.classList.remove("hidden");
        } else {
          card.classList.add("hidden");
        }
      });
    });
  });
}

// ─── Project cards ──────────────────────────────────────────────
function renderProjects() {
  const grid = $("#project-grid");
  if (!grid) return;

  projects.forEach((item) => {
    const li = document.createElement("li");
    li.className = "project-card";
    li.setAttribute("role", "listitem");
    li.dataset.category = item.category;
    li.tabIndex = 0;

    li.innerHTML = `
      <span class="card-badge">${item.badge}</span>
      <h3 class="card-title">${item.title}</h3>
      <p class="card-desc">${item.description}</p>
      <div class="card-stack">
        ${item.stack.map((s) => `<span>${s}</span>`).join("")}
      </div>
      <div class="card-cta">Open project ↗</div>
    `;

    // Mouse-move spotlight
    li.addEventListener("mousemove", (e) => {
      const rect = li.getBoundingClientRect();
      li.style.setProperty("--mx", e.clientX - rect.left + "px");
      li.style.setProperty("--my", e.clientY - rect.top + "px");
    });

    // Click → boss overlay → open URL
    li.addEventListener("click", (e) => {
      e.preventDefault();
      triggerBossOverlay(item.title, item.url);
    });
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        triggerBossOverlay(item.title, item.url);
      }
    });

    grid.appendChild(li);
  });

  initFilterBar();
}

// ─── Boss overlay ───────────────────────────────────────────────
let bossActive = false;

function triggerBossOverlay(title, url) {
  if (bossActive) return;
  bossActive = true;

  const overlay = $("#boss-overlay");
  const subtitle = $("#boss-subtitle");
  subtitle.textContent = title;
  overlay.setAttribute("aria-hidden", "false");
  overlay.classList.add("is-active");

  setTimeout(() => {
    overlay.classList.remove("is-active");
    overlay.setAttribute("aria-hidden", "true");
    bossActive = false;
    window.open(url, "_blank", "noopener,noreferrer");
  }, 1920);
}

// ─── Vital bars fill ────────────────────────────────────────────
function initVitalBars() {
  const barsEl = $(".vital-bars");
  if (!barsEl) return;

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-filled");
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  obs.observe(barsEl);
}

// ─── Rune pips ──────────────────────────────────────────────────
function updateRunePips(section) {
  $$(".rune-pip").forEach((pip) => {
    const isActive = pip.dataset.section === section;
    pip.classList.toggle("is-active", isActive);

    if (isActive) {
      pip.classList.remove("is-pulsing");
      void pip.offsetWidth; // force reflow to restart animation
      pip.classList.add("is-pulsing");
      pip.addEventListener("animationend", () => pip.classList.remove("is-pulsing"), { once: true });
    }
  });
}

// ─── Nav link active state ──────────────────────────────────────
function updateNavLinks(section) {
  $$(".nav-link").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.section === section);
  });
}

// ─── Section IntersectionObserver ───────────────────────────────
function initSectionObserver() {
  const sections = $$("section[data-scene], footer[data-scene]");
  const ratioMap = new Map();

  const obs = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const id = entry.target.id;
        ratioMap.set(id, entry.intersectionRatio);
      });

      // Pick the most-visible section
      let bestId = null, bestRatio = -1;
      ratioMap.forEach((ratio, id) => {
        if (ratio > bestRatio) { bestRatio = ratio; bestId = id; }
      });

      if (bestId && bestId !== currentSection) {
        // Map HTML IDs to scene names
        const sceneMap = {
          hero: "hero",
          lore: "lore",
          works: "projects",
          status: "skills",
          grace: "contact",
        };
        currentSection = bestId;
        const sceneName = sceneMap[bestId] || bestId;
        arena?.setSection(sceneName);
        updateNavLinks(bestId);
        updateRunePips(bestId);
      }
    },
    { rootMargin: "-10% 0px -55% 0px", threshold: [0, 0.1, 0.25, 0.5] }
  );

  sections.forEach((s) => {
    ratioMap.set(s.id, 0);
    obs.observe(s);
  });
}

// ─── 3D Toggle ──────────────────────────────────────────────────
function initToggle3D() {
  const btn = $("#toggle-3d");
  if (!btn) return;

  const labels = {
    active: "3D Active",
    eco:    "Eco Mode",
    paused: "3D Paused",
  };

  btn.addEventListener("click", () => {
    const mode = arena?.cycleMode() ?? "active";
    btn.dataset.mode = mode;
    qs(btn, ".toggle-label").textContent = labels[mode];
    btn.setAttribute("aria-label", `Toggle 3D mode — currently ${labels[mode]}`);
  });
}

// ─── Copy email ─────────────────────────────────────────────────
function initCopyEmail() {
  const btn = $("#copy-email-btn");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("yanisjr16@gmail.com");
      const original = btn.textContent;
      btn.textContent = "Email Copied ✓";
      btn.setAttribute("aria-label", "Email address copied");
      setTimeout(() => {
        btn.textContent = original;
        btn.setAttribute("aria-label", "Copy email address");
      }, 2000);
    } catch {
      // Fallback: select the email link
      const emailLink = $(".grace-email");
      if (emailLink) window.location.href = emailLink.href;
    }
  });
}

// ─── Boot ────────────────────────────────────────────────────────
renderProjects();
initVitalBars();
initSectionObserver();
updateNavLinks("hero");
updateRunePips("hero");
initToggle3D();
initCopyEmail();
