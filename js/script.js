// ============================================================
// FESTMUNDI - SCRIPT.JS PRINCIPAL (VERSÃO LIMPA)
// Contém apenas funcionalidades gerais da página.
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  
  // ============================================================
  // MENU MOBILE ELEGANTE
  // ============================================================
  
  const menuToggle = document.querySelector(".menu-toggle");
  const menu = document.querySelector(".menu");
  let overlay = document.querySelector(".menu-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.classList.add("menu-overlay");
    document.body.appendChild(overlay);
  }

  const toggleMenu = (forceClose = false) => {
    const isOpen = forceClose ? false : !menu.classList.contains("active");
    
    if (isOpen) {
      menuToggle.classList.add("open");
      menu.classList.add("active");
      overlay.classList.add("visible");
      document.body.classList.add("no-scroll");
    } else {
      menuToggle.classList.remove("open");
      menu.classList.remove("active");
      overlay.classList.remove("visible");
      document.body.classList.remove("no-scroll");
    }
  };

  if (menuToggle) {
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu();
    });
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      toggleMenu(true);
    });
  }

  const menuLinks = document.querySelectorAll(".menu a");
  menuLinks.forEach(link => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 1024) {
        setTimeout(() => {
          toggleMenu(true);
        }, 200);
      }
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menu.classList.contains("active")) {
      toggleMenu(true);
      menuToggle.focus();
    }
  });

  // ============================================================
  // MODAL DE FILTROS - TABLET E MOBILE
  // ============================================================
  
  const createFilterModal = () => {
    if (window.innerWidth > 1024) return;

    const filterPanel = document.querySelector(".filter-panel");
    if (!filterPanel) return;

    let filterToggleBtn = document.querySelector(".filter-toggle-btn");
    
    if (!filterToggleBtn) {
      filterToggleBtn = document.createElement("button");
      filterToggleBtn.className = "filter-toggle-btn";
      filterToggleBtn.textContent = "Filtros";
      // Adiciona o botão de filtro antes do primeiro elemento do painel
      filterPanel.insertBefore(filterToggleBtn, filterPanel.firstChild);
    }
    // (A lógica completa para criar e operar o modal de filtros continua aqui)
  };

  createFilterModal();
  window.addEventListener("resize", debounce(createFilterModal, 250));

  // ============================================================
  // SMOOTH SCROLL HORIZONTAL PARA CARDS EM TABLET
  // ============================================================
  
  const festivalHeaders = document.querySelectorAll(".festival-card-header");
  
  festivalHeaders.forEach(header => {
    let isDown = false;
    let startX;
    let scrollLeft;

    header.addEventListener("mousedown", (e) => {
      if (window.innerWidth > 768 && window.innerWidth <= 1024) {
        isDown = true;
        header.style.cursor = "grabbing";
        startX = e.pageX - header.offsetLeft;
        scrollLeft = header.scrollLeft;
      }
    });
    header.addEventListener("mouseleave", () => {
      isDown = false;
      header.style.cursor = "grab";
    });
    header.addEventListener("mouseup", () => {
      isDown = false;
      header.style.cursor = "grab";
    });
    header.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - header.offsetLeft;
      const walk = (x - startX) * 2;
      header.scrollLeft = scrollLeft - walk;
    });
  });

  // ============================================================
  // LÓGICA DE SIDEBAR (FILTROS, LIMPAR, ORDENAÇÃO)
  // ============================================================
  
  const filterItems = document.querySelectorAll(".filter-item");
  filterItems.forEach(item => {
    item.addEventListener("click", () => {
      console.log("Filtro clicado:", item.querySelector("span").textContent);
    });
  });

  const btnClear = document.querySelector(".btn-clear");
  if (btnClear) {
    btnClear.addEventListener("click", () => {
      console.log("Filtros limpos");
    });
  }

  const sortButtons = document.querySelectorAll(".sort-btn");
  sortButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      sortButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      console.log("Ordenar por:", btn.textContent);
    });
  });

  // ============================================================
  // DETECÇÃO DE ORIENTAÇÃO (MOBILE)
  // ============================================================
  
  const handleOrientationChange = () => {
    const isLandscape = window.innerHeight < window.innerWidth;
    document.body.classList.toggle("landscape", isLandscape);
    if (menu && menu.classList.contains("active")) {
      toggleMenu(true);
    }
  };
  window.addEventListener("orientationchange", handleOrientationChange);

  // ============================================================
  // LAZY LOADING DE IMAGENS
  // ============================================================
  
  if ("IntersectionObserver" in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
            observer.unobserve(img);
          }
        }
      });
    });
    const lazyImages = document.querySelectorAll("img[data-src]");
    lazyImages.forEach(img => imageObserver.observe(img));
  }
  
  // ============================================================
  // MENSAGEM DE CONSOLE
  // ============================================================
  
  console.log("%cFestmundi", "font-size: 24px; font-weight: bold; color: #212529;");
  console.log("%cSistema responsivo carregado com sucesso! ✨", "font-size: 14px; color: #219ebc;");
  
});

// ============================================================
// FUNÇÕES UTILITÁRIAS GLOBAIS
// ============================================================

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const isTouchDevice = () => {
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    navigator.msMaxTouchPoints > 0
  );
};

if (isTouchDevice()) {
  document.body.classList.add("touch-device");
} else {
  document.body.classList.add("no-touch");
}