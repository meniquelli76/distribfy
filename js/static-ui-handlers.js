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