// js/static-ui-handlers.js
// Contém os listeners de eventos para a UI que funciona sem banco de dados.

document.addEventListener("DOMContentLoaded", () => {

    // Lógica para o botão "Sugerir Festival" abrir/fechar o painel
    const suggestBtn = document.getElementById("btn-suggest-festival");
    const formWrapper = document.querySelector(".form-panel-wrapper");
    if (suggestBtn && formWrapper) {
        suggestBtn.addEventListener("click", () => formWrapper.classList.toggle("collapsed"));
    }

    // Listener para o botão 'Editar' apenas ABRIR o painel
    document.addEventListener('click', function(event) {
        const editButton = event.target.closest('.board-content .action-btn[title="Editar"]');
        if (editButton) {
            event.preventDefault(); 
            console.log("Botão Editar (estático) clicado. Abrindo formulário...");
            
            if (typeof window.openFestivalForm === 'function') {
                window.openFestivalForm();
                
                // =======================================================
                // ADICIONADO: Efeito de rolagem suave para o topo
                // =======================================================
                window.scrollTo({ top: 0, behavior: 'smooth' });

            } else {
                console.error("Função openFestivalForm() não encontrada. Verifique se form-handler.js está carregado.");
            }
        }
    });

    console.log("✅ Handlers da UI estática carregados.");
});

// js/feedback-handler.js
(function() {
  const modalOverlay = document.getElementById('feedback-modal-overlay');
  const modalMessage = document.getElementById('feedback-modal-message');
  const closeButton = document.getElementById('feedback-modal-close');

  // Função para MOSTRAR o modal com uma mensagem customizada
  function showFeedbackModal(message) {
    if (!modalOverlay || !modalMessage) return;

    modalMessage.textContent = message;
    modalOverlay.style.display = 'flex';
  }

  // Função para ESCONDER o modal
  function hideFeedbackModal() {
    if (!modalOverlay) return;
    modalOverlay.style.display = 'none';
  }

  // Adiciona os eventos para fechar o modal
  if (closeButton) {
    closeButton.addEventListener('click', hideFeedbackModal);
  }
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (event) => {
      // Fecha só se clicar no fundo, não no conteúdo do modal
      if (event.target === modalOverlay) {
        hideFeedbackModal();
      }
    });
  }

  // Expõe a função de mostrar para ser usada por outros scripts
  window.showFeedbackModal = showFeedbackModal;

})();