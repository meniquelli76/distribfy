/**
 * Controla a animação de abrir/fechar dos acordeões de festival.
 * A lógica é ativada pelo clique no botão chevron, não na área inteira do card.
 * Esta função deve ser chamada DEPOIS que os cards forem renderizados no DOM.
 */
function initializeAccordions() {
  console.log("▶️  Inicializando Acordeões...");

  const accordions = document.querySelectorAll('.festival-accordion');

  accordions.forEach(accordion => {
    // Evita adicionar múltiplos listeners se a função for chamada novamente
    if (accordion.dataset.accordionInitialized) return;
    accordion.dataset.accordionInitialized = 'true';

    // O alvo do clique é o botão, não o summary
    const chevronButton = accordion.querySelector('.festival-chevron-btn');
    const content = accordion.querySelector('.card-expanded-content');

    if (!chevronButton || !content) {
      console.warn('Acordeão mal formado, botão ou conteúdo não encontrado.', accordion);
      return;
    }

    chevronButton.addEventListener('click', (e) => {
      // Impede que o clique no botão se propague para outros elementos
      e.preventDefault();
      e.stopPropagation();

      // Verifica se o acordeão está aberto ou fechando
      if (accordion.open) {
        // Se já está aberto, inicia a animação de fechamento
        // Adicionando uma classe para controlar a animação de saída no CSS
        accordion.classList.add('closing');

        // Escuta pelo final da animação para de fato fechar o <details>
        accordion.addEventListener('animationend', () => {
          accordion.open = false;
          accordion.classList.remove('closing');
        }, { once: true });

      } else {
        // Se está fechado, simplesmente abre
        accordion.open = true;
      }
    });
  });
}

// Expõe a função de inicialização globalmente para que outros scripts possam chamá-la.
window.initializeAccordions = initializeAccordions;