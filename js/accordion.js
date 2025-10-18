/**
 * Controla a animação de abrir/fechar dos acordeões de festival.
 * A lógica é ativada SOMENTE pelo clique no botão chevron.
 * Impede o comportamento padrão de clique no <summary>, mas permite que links e outros botões funcionem.
 */
function initializeAccordions() {
  console.log("▶️  Inicializando Acordeões (versão com links corrigidos)...");

  const accordions = document.querySelectorAll('.festival-accordion');

  accordions.forEach(accordion => {
    if (accordion.dataset.accordionInitialized) return;
    accordion.dataset.accordionInitialized = 'true';

    const summary = accordion.querySelector('summary');
    const content = accordion.querySelector('.card-expanded-content');

    if (!summary || !content) {
      console.warn('Acordeão mal formado, summary ou conteúdo não encontrado.', accordion);
      return;
    }

    // Adiciona o listener de clique ao <summary> para ter controle total.
    summary.addEventListener('click', (e) => {
      const target = e.target;

      // =================================================================
      // ##### LÓGICA DE CLIQUE REFINADA #####
      // =================================================================

      // Se o clique foi em um link <a> ou em um botão <button> que NÃO seja o botão do acordeão,
      // não fazemos nada e deixamos a ação padrão acontecer (ex: seguir o link).
      if (target.closest('a') || (target.closest('button') && !target.closest('.festival-chevron-btn'))) {
        return;
      }

      // Para qualquer outro clique, prevenimos a ação padrão de abrir/fechar.
      e.preventDefault();

      // Se o clique foi especificamente no botão do acordeão, executa nossa animação.
      if (target.closest('.festival-chevron-btn')) {
        toggleAccordion(accordion);
      }
    });
  });
}

/**
 * Função que gerencia a animação de abrir e fechar.
 * (Esta função permanece a mesma).
 */
function toggleAccordion(accordion) {
  const content = accordion.querySelector('.card-expanded-content');
  
  if (accordion.open) {
    content.style.maxHeight = content.scrollHeight + 'px';
    
    requestAnimationFrame(() => {
        content.style.maxHeight = '0px';
        content.style.opacity = '0';
    });

    content.addEventListener('transitionend', () => {
      accordion.open = false;
      content.style.maxHeight = null;
      content.style.opacity = null;
    }, { once: true });

  } else {
    accordion.open = true;
  }
}

// Expõe a função de inicialização globalmente
window.initializeAccordions = initializeAccordions;