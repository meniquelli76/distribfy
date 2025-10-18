
document.addEventListener("DOMContentLoaded", function () {
  // ============================================================
  // CONFIGURAÇÃO
  // ============================================================
  
  const config = {
    boxSelector: ".tags-box",
    listSelector: ".tags-list",
    chevronSelector: ".icon-chevron",
    tooltipClass: "tags-tooltip",
    hasOverflowClass: "has-overflow",
    visibleClass: "visible",
    tooltipBelowClass: "tooltip-below",
    hoverDelay: 200, // ms antes de mostrar tooltip no hover
    checkOnResize: true,
    resizeDebounceTime: 300,
  };

  let activeTooltip = null;
  let hoverTimeout = null;

  // ============================================================
  // INICIALIZAÇÃO
  // ============================================================

  function init() {
    const tagsBoxes = document.querySelectorAll(config.boxSelector);

    if (tagsBoxes.length === 0) {
      console.warn("⚠️ Nenhum .tags-box encontrado");
      return;
    }

    console.log(`✅ Inicializando tooltip de tags para ${tagsBoxes.length} elemento(s)`);

    tagsBoxes.forEach((box) => {
      setupTagsBox(box);
    });

    // Recheck no resize
    if (config.checkOnResize) {
      setupResizeListener(tagsBoxes);
    }

    // Fecha tooltip ao clicar fora
    document.addEventListener("click", handleOutsideClick);
  }

  // ============================================================
  // SETUP DE CADA TAGS-BOX
  // ============================================================

  function setupTagsBox(box) {
    const tagsList = box.querySelector(config.listSelector);
    const chevron = box.querySelector(config.chevronSelector);

    if (!tagsList) {
      console.warn("⚠️ .tags-list não encontrado dentro de .tags-box", box);
      return;
    }

    if (!chevron) {
      console.warn("⚠️ .icon-chevron não encontrado dentro de .tags-box", box);
      return;
    }

    // Verifica se há overflow
    checkOverflow(box, tagsList, chevron);

    // Eventos do chevron
    setupChevronEvents(box, tagsList, chevron);
  }

  // ============================================================
  // VERIFICA SE HÁ OVERFLOW
  // ============================================================

  function checkOverflow(box, tagsList, chevron) {
    // Usa requestAnimationFrame para garantir que o layout está atualizado
    requestAnimationFrame(() => {
      const hasOverflow = tagsList.scrollWidth > tagsList.clientWidth;

      if (hasOverflow) {
        box.classList.add(config.hasOverflowClass);
        console.log("📦 Overflow detectado em:", box);
      } else {
        box.classList.remove(config.hasOverflowClass);
        console.log("✅ Sem overflow em:", box);
        // Remove tooltip se existir
        hideTooltip();
      }
    });
  }

  // ============================================================
  // SETUP DE EVENTOS DO CHEVRON
  // ============================================================

  function setupChevronEvents(box, tagsList, chevron) {
    // Detecta se é touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    if (isTouchDevice) {
      // TABLET: Click
      chevron.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleTooltip(box, tagsList, chevron);
      });
    } else {
      // DESKTOP: Hover
      chevron.addEventListener("mouseenter", function () {
        // Delay para evitar tooltips acidentais
        hoverTimeout = setTimeout(() => {
          showTooltip(box, tagsList, chevron);
        }, config.hoverDelay);
      });

      chevron.addEventListener("mouseleave", function () {
        clearTimeout(hoverTimeout);
        hideTooltip();
      });
    }
  }

  // ============================================================
  // TOGGLE TOOLTIP (CLICK)
  // ============================================================

  function toggleTooltip(box, tagsList, chevron) {
    if (activeTooltip && activeTooltip.box === box) {
      hideTooltip();
    } else {
      showTooltip(box, tagsList, chevron);
    }
  }

  // ============================================================
  // MOSTRA TOOLTIP
  // ============================================================

  function showTooltip(box, tagsList, chevron) {
    // Se já existe um tooltip ativo, remove
    hideTooltip();

    // Pega o texto completo
    const fullText = getFullText(tagsList);

    if (!fullText) {
      console.warn("⚠️ Nenhum texto encontrado para tooltip");
      return;
    }

    // Cria o tooltip
    const tooltip = document.createElement("div");
    tooltip.className = config.tooltipClass;
    tooltip.textContent = fullText;
    document.body.appendChild(tooltip);

    // Posiciona o tooltip
    positionTooltip(tooltip, chevron);

    // Mostra o tooltip
    setTimeout(() => {
      tooltip.classList.add(config.visibleClass);
    }, 10);

    // Guarda referência
    activeTooltip = { tooltip, box };

    console.log("📌 Tooltip mostrado:", fullText);
  }

  // ============================================================
  // ESCONDE TOOLTIP
  // ============================================================

  function hideTooltip() {
    if (activeTooltip) {
      activeTooltip.tooltip.classList.remove(config.visibleClass);
      
      setTimeout(() => {
        if (activeTooltip && activeTooltip.tooltip.parentNode) {
          activeTooltip.tooltip.remove();
        }
        activeTooltip = null;
      }, 200); // Tempo da transição
    }
  }

  // ============================================================
  // PEGA TEXTO COMPLETO DAS TAGS
  // ============================================================

  function getFullText(tagsList) {
    const spans = tagsList.querySelectorAll("span");
    const texts = Array.from(spans).map(span => span.textContent.trim());
    return texts.join(", ");
  }

  // ============================================================
  // POSICIONA TOOLTIP
  // ============================================================

  function positionTooltip(tooltip, chevron) {
    const chevronRect = chevron.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Posição horizontal (centralizado no chevron)
    let left = chevronRect.left + (chevronRect.width / 2) - (tooltipRect.width / 2);
    
    // Ajusta se sair da tela na esquerda
    if (left < 10) {
      left = 10;
    }
    
    // Ajusta se sair da tela na direita
    if (left + tooltipRect.width > viewportWidth - 10) {
      left = viewportWidth - tooltipRect.width - 10;
    }

    // Posição vertical (padrão: acima do chevron)
    let top = chevronRect.top - tooltipRect.height - 8;
    let isBelow = false;

    // Se não couber acima, coloca abaixo
    if (top < 10) {
      top = chevronRect.bottom + 8;
      isBelow = true;
      tooltip.classList.add(config.tooltipBelowClass);
    }

    // Se não couber abaixo também, força acima mesmo assim
    if (top + tooltipRect.height > viewportHeight - 10 && !isBelow) {
      top = chevronRect.top - tooltipRect.height - 8;
    }

    // Aplica posição
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;

    console.log(`📍 Tooltip posicionado: left=${left}px, top=${top}px, ${isBelow ? 'abaixo' : 'acima'}`);
  }

  // ============================================================
  // FECHA TOOLTIP AO CLICAR FORA
  // ============================================================

  function handleOutsideClick(e) {
    if (activeTooltip && !e.target.closest(config.chevronSelector)) {
      hideTooltip();
    }
  }

  // ============================================================
  // LISTENER DE RESIZE (DEBOUNCED)
  // ============================================================

  function setupResizeListener(tagsBoxes) {
    let resizeTimeout;

    window.addEventListener("resize", function () {
      clearTimeout(resizeTimeout);

      resizeTimeout = setTimeout(() => {
        console.log("↔️ Resize detectado, recalculando overflows...");
        
        // Esconde tooltip se estiver visível
        hideTooltip();
        
        tagsBoxes.forEach((box) => {
          const tagsList = box.querySelector(config.listSelector);
          const chevron = box.querySelector(config.chevronSelector);
          
          if (tagsList && chevron) {
            checkOverflow(box, tagsList, chevron);
          }
        });
      }, config.resizeDebounceTime);
    });
  }

  // ============================================================
  // FUNÇÃO PÚBLICA PARA RECHECK
  // ============================================================

  window.FestMundiTooltip = {
    recheckOverflow: function (boxElement = null) {
      if (boxElement) {
        const tagsList = boxElement.querySelector(config.listSelector);
        const chevron = boxElement.querySelector(config.chevronSelector);
        
        if (tagsList && chevron) {
          checkOverflow(boxElement, tagsList, chevron);
        }
      } else {
        // Recheck em todos
        document.querySelectorAll(config.boxSelector).forEach((box) => {
          const tagsList = box.querySelector(config.listSelector);
          const chevron = box.querySelector(config.chevronSelector);
          
          if (tagsList && chevron) {
            checkOverflow(box, tagsList, chevron);
          }
        });
      }
    },
    
    hideTooltip: hideTooltip,
  };

  // ============================================================
  // EXECUTA A INICIALIZAÇÃO
  // ============================================================

 window.initializeTooltips = init;
});

// ============================================================
// LOG DE INICIALIZAÇÃO
// ============================================================

console.log("🏷️ Tags Tooltip Script carregado!");