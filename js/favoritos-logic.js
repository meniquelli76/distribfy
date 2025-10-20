document.addEventListener('DOMContentLoaded', () => {
    console.log("▶️ Lógica da Página de Favoritos INICIADA");

    const favoriteIds = JSON.parse(localStorage.getItem('festmundi_favorites') || '[]');
    const boardContent = document.querySelector('.board-content');
    const filterPanel = document.querySelector('.filter-panel');
    const loadMoreContainer = document.querySelector('.load-more-container');
    const festivalCountSpan = document.querySelector('.festival-count');

    if (favoriteIds.length === 0) {
        // Caso não haja favoritos, mostra uma mensagem e esconde os filtros/conteúdo.
        if (boardContent) {
            boardContent.innerHTML = '<div class="no-results-message">Você ainda não favoritou nenhum festival.</div>';
        }
        if (filterPanel) filterPanel.style.display = 'none';
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';
        if (festivalCountSpan) festivalCountSpan.textContent = '0 favoritos';
        return; // Interrompe a execução
    }

    // Se há favoritos, modifica a função applyFilters ANTES que ela seja usada
    const originalApplyFilters = window.applyFilters;
    window.applyFilters = async function() {
        // Pega o objeto de parâmetros que a função original montaria
        const params = originalApplyFilters.getParams(); 

        // Adiciona a nossa lista de favoritos à busca
        params.base_ids = favoriteIds;

        // Continua com a busca, agora filtrada
        try {
            const { data: idData, error: rpcError } = await window.supabase.rpc('filter_festivals', params);
            if (rpcError) throw rpcError;

            const festivalIds = idData.map(item => item.id);
            window.triggerFestivalSearch(festivalIds);

        } catch (err) {
            console.error("Erro no processo de filtro de favoritos:", err);
            window.triggerFestivalSearch([]);
        }
    }

    // Precisamos ajustar o 'filters.js' para expor a função getParams.
    // Faremos isso no próximo passo.

    // Dispara a busca inicial, considerando apenas os favoritos
    if (typeof window.triggerFestivalSearch === 'function') {
        window.triggerFestivalSearch(favoriteIds);
    }
});