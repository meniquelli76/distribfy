
function initializeCardActions() {
  console.log("▶️  Inicializando Ações dos Cards...");

  // --- LÓGICA COMPARTILHADA DE TOOLTIP ---
  let tooltip = null;

  const createTooltip = () => {
    // Procura por um tooltip existente, senão cria um novo.
    // Isso evita múltiplos tooltips no body se a função for chamada mais de uma vez.
    let existingTooltip = document.querySelector('.card-action-tooltip');
    if (existingTooltip) {
      tooltip = existingTooltip;
    } else {
      tooltip = document.createElement('div');
      tooltip.className = 'card-action-tooltip';
      document.body.appendChild(tooltip);
    }
  };

  const showTooltip = (button, text) => {
    if (!tooltip) createTooltip();
    tooltip.textContent = text;
    tooltip.classList.add('visible');

    const btnRect = button.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    tooltip.style.left = `${btnRect.left + btnRect.width / 2 - tooltipRect.width / 2}px`;
    tooltip.style.top = `${btnRect.top - tooltipRect.height - 8}px`;
  };

  const hideTooltip = () => {
    if (tooltip) {
      tooltip.classList.remove('visible');
    }
  };


  // --- LÓGICA DO BOTÃO ADICIONAR (+ -> ✓ -> X) ---
  const addButtons = document.querySelectorAll('.add-button');

  const createConfirmationModal = (onConfirm) => {
    // Remove qualquer modal antigo para evitar duplicatas
    const oldModal = document.querySelector('.confirm-modal-overlay');
    if (oldModal) oldModal.remove();

    const overlay = document.createElement('div');
    overlay.className = 'confirm-modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'confirm-modal';
    modal.innerHTML = `
      <p class="confirm-modal-message">Certeza que deseja excluir este festival do seu filme?</p>
      <div class="confirm-modal-buttons">
        <button class="btn-secondary">Cancelar</button>
        <button class="btn-primary">Excluir</button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('visible'), 10);
    
    const closeModal = () => {
      overlay.classList.remove('visible');
      setTimeout(() => overlay.remove(), 300);
    };

    modal.querySelector('.btn-primary').addEventListener('click', () => {
      onConfirm();
      closeModal();
    });
    modal.querySelector('.btn-secondary').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  };

  addButtons.forEach(button => {
    // Evita adicionar múltiplos listeners se a função for chamada novamente
    if (button.dataset.actionsInitialized) return;
    button.dataset.actionsInitialized = 'true';

    const icon = button.querySelector('img');
    const iconPlusSrc = 'public/icons/icon-plus.svg';
    const iconCheckSrc = 'public/icons/icon-check.svg';
    const iconCloseSrc = 'public/icons/icon-close.svg';

    button.addEventListener('mouseenter', () => {
      const text = button.classList.contains('active') ? 'Remover do filme' : 'Adicionar ao filme';
      showTooltip(button, text);
    });
    button.addEventListener('mouseleave', hideTooltip);

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideTooltip();

      if (button.classList.contains('active')) {
        createConfirmationModal(() => {
          button.classList.remove('active');
          icon.src = iconPlusSrc;
        });
      } else {
        if (button.disabled) return;
        button.disabled = true;

        button.classList.add('feedback-success');
        icon.src = iconCheckSrc;
        
        setTimeout(() => {
          button.classList.remove('feedback-success');
          button.classList.add('active');
          icon.src = iconCloseSrc;
          button.disabled = false;
        }, 1200);
      }
    });
  });


  // --- LÓGICA DO BOTÃO DE FAVORITO (♡) ---
  const favoriteButtons = document.querySelectorAll('.action-btn--favorite');

  favoriteButtons.forEach(button => {
    // Evita adicionar múltiplos listeners
    if (button.dataset.actionsInitialized) return;
    button.dataset.actionsInitialized = 'true';

    const festivalCard = button.closest('.festival-accordion');
    if (!festivalCard) return;

    // Acessa o ID do festival a partir do data attribute no elemento pai, que é mais confiável.
    const wrapper = button.closest('.festival-item-wrapper');
    const festivalId = wrapper ? wrapper.dataset.festivalId : null;
    
    if (!festivalId) {
        console.warn('Não foi possível encontrar o ID do festival para o botão de favorito.', button);
        return;
    }

    // A lógica de favoritar deve usar o ID numérico, que é único, em vez do nome do festival.
    const savedFavorites = JSON.parse(localStorage.getItem('festmundi_favorites') || '[]');
    if (savedFavorites.includes(festivalId)) {
      button.classList.add('active');
    }

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      button.classList.toggle('active');

      const currentFavorites = JSON.parse(localStorage.getItem('festmundi_favorites') || '[]');
      if (button.classList.contains('active')) {
        if (!currentFavorites.includes(festivalId)) {
          currentFavorites.push(festivalId);
        }
      } else {
        const index = currentFavorites.indexOf(festivalId);
        if (index > -1) {
          currentFavorites.splice(index, 1);
        }
      }
      localStorage.setItem('festmundi_favorites', JSON.stringify(currentFavorites));
    });
  });
}

// Expõe a função de inicialização globalmente para que outros scripts possam chamá-la.
window.initializeCardActions = initializeCardActions;