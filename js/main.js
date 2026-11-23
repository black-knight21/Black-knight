document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("project-grid");
  const filterBtns = document.querySelectorAll(".filter-btn");
  const filterIndicator = document.querySelector(".filter-indicator");
  const navLinks = document.querySelectorAll(".nav-links a");
  const sections = document.querySelectorAll("section[id], footer[id]");
  const copyBtn = document.getElementById("copy-email");
  const nav = document.getElementById("site-nav");

  // Friendly display names for badges and categories
  const statusLabel = {
    completed: "Completed",
    "in-progress": "In Progress",
    personal: "Personal Project"
  };

  const categoryLabel = {
    web: "Web App",
    tools: "Tools",
    uiux: "UI/UX"
  };

  // Position sliding indicator beneath the active filter button
  function updateIndicator(btn) {
    if (!filterIndicator || !btn) return;
    filterIndicator.style.transform = `translateX(${btn.offsetLeft}px)`;
    filterIndicator.style.width = `${btn.offsetWidth}px`;
  }

  // Create an interactive project card element
  function buildCard(project) {
    const card = document.createElement("article");
    card.className = "project-card";
    card.dataset.category = project.category;
    card.dataset.id = project.id;
    card.setAttribute("role", "listitem");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `${project.title} - ${project.description}`);

    const hasLiveDemo = project.demo && project.demo !== "#";
    const hasSource = Boolean(project.source);

    let actionsHtml = "";
    if (hasLiveDemo || hasSource) {
      actionsHtml = `
        <div class="card-actions">
          ${hasLiveDemo ? `
            <a href="${project.demo}" target="_blank" rel="noopener noreferrer" class="btn-card-demo">
              Live Demo <span>↗</span>
            </a>` : ""}
          ${hasSource ? `
            <a href="${project.source}" target="_blank" rel="noopener noreferrer" class="btn-card-source">
              GitHub <span>↗</span>
            </a>` : ""}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-header">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          ${project.logo ? `<img src="${project.logo}" alt="${project.title} logo" width="26" height="26" style="border-radius: 6px; object-fit: contain; background: rgba(139,92,246,0.12); border: 1px solid rgba(139,92,246,0.3); padding: 2px;" />` : ""}
          <span class="status-badge status-personal">Personal Project</span>
        </div>
        <span class="card-category-label">${categoryLabel[project.category] || project.category}</span>
      </div>
      <h3 class="card-title">${project.title}</h3>
      <p class="card-summary">${project.description}</p>
      <div class="card-contribution-box">
        <span class="card-contribution-label">Contribution</span>
        <p class="card-contribution">${project.contribution}</p>
      </div>
      <div class="card-stack">
        ${project.stack.map(tag => `<span class="tag">${tag}</span>`).join("")}
      </div>
      ${actionsHtml}
    `;

    // Track cursor movement for dynamic hairline border highlight
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
      card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
    });

    // Open project link in a new tab
    if (hasLiveDemo) {
      card.addEventListener("click", () => {
        window.open(project.demo, "_blank", "noopener,noreferrer");
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.open(project.demo, "_blank", "noopener,noreferrer");
        }
      });
    } else if (hasSource) {
      card.addEventListener("click", () => {
        window.open(project.source, "_blank", "noopener,noreferrer");
      });

      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.open(project.source, "_blank", "noopener,noreferrer");
        }
      });
    } else {
      card.style.cursor = "default";
    }

    // Prevent card click bubbling on action links
    const sourceLink = card.querySelector(".btn-card-source");
    if (sourceLink) {
      sourceLink.addEventListener("click", (e) => e.stopPropagation());
    }

    const demoLink = card.querySelector(".btn-card-demo");
    if (demoLink) {
      demoLink.addEventListener("click", (e) => e.stopPropagation());
    }

    return card;
  }

  // Filter and populate cards in the grid
  function renderProjects(filter) {
    grid.innerHTML = "";
    const visible = filter === "all"
      ? projects
      : projects.filter(p => p.category === filter);

    visible.forEach(p => grid.appendChild(buildCard(p)));
  }

  // Handle category filter tab switching
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      updateIndicator(btn);
      renderProjects(btn.dataset.filter);
    });
  });

  // Recompute sliding indicator on viewport resize
  window.addEventListener("resize", () => {
    const activeBtn = document.querySelector(".filter-btn.active");
    updateIndicator(activeBtn);
  });

  // Copy email to clipboard with temporary feedback badge
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const email = copyBtn.dataset.email;
      navigator.clipboard.writeText(email).then(() => {
        copyBtn.classList.add("copied");
        copyBtn.textContent = "Copied";
        setTimeout(() => {
          copyBtn.classList.remove("copied");
          copyBtn.textContent = "Copy Email";
        }, 2000);
      });
    });
  }

  // Highlight active navbar link based on scroll position
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        navLinks.forEach(link => {
          const href = link.getAttribute("href");
          link.classList.toggle("active", href === `#${id}`);
        });
      }
    });
  }, {
    rootMargin: "-20% 0px -65% 0px",
    threshold: 0
  });

  sections.forEach(section => navObserver.observe(section));

  // Fade-in sections as they enter the viewport
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12
  });

  document.querySelectorAll(".reveal").forEach(el => revealObserver.observe(el));

  // Toggle navigation background border when scrolling down
  window.addEventListener("scroll", () => {
    if (nav) {
      nav.classList.toggle("scrolled", window.scrollY > 20);
    }
  });

  // Initial render and indicator alignment
  renderProjects("all");
  const initialActive = document.querySelector(".filter-btn.active");
  updateIndicator(initialActive);
});
