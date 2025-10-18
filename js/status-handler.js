// js/status-handler.js

function initializeStatusButtons() {
    console.log("▶️  Inicializando Botões de Status...");

    // 1. Define a ordem do ciclo e os dados de cada status
    const statuses = [
        { id: 1, name: 'A Pesquisar' },
        { id: 2, name: 'Em Análise' },
        { id: 3, name: 'Verificado' }
    ];

    const statusButtons = document.querySelectorAll('.festival-status-btn');

    statusButtons.forEach(button => {
        if (button.dataset.statusInitialized) return;
        button.dataset.statusInitialized = 'true';

        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const festivalId = button.dataset.festivalId;
            const currentStatusId = parseInt(button.dataset.statusId, 10);

            // 2. Encontra o status atual e define o próximo no ciclo
            const currentIndex = statuses.findIndex(s => s.id === currentStatusId);
            const nextIndex = (currentIndex + 1) % statuses.length;
            const nextStatus = statuses[nextIndex];

            // 3. Atualiza a aparência do botão imediatamente
            button.textContent = nextStatus.name;
            button.dataset.statusId = nextStatus.id;
            
            // Adiciona um feedback visual
            button.classList.add('updating');

            try {
                // 4. Salva o novo status_id no banco de dados
                const { error } = await window.supabase
                    .from('festivals')
                    .update({ status_id: nextStatus.id })
                    .eq('id', festivalId);

                if (error) throw error;
                
                console.log(`Status do festival ${festivalId} atualizado para: ${nextStatus.name}`);
                
            } catch (err) {
                console.error("Erro ao atualizar o status:", err);
                // Em caso de erro, reverte a aparência do botão
                const currentStatus = statuses[currentIndex];
                button.textContent = currentStatus.name;
                button.dataset.statusId = currentStatus.id;
                alert('Não foi possível atualizar o status.');
            } finally {
                // Remove o feedback visual
                setTimeout(() => button.classList.remove('updating'), 300);
            }
        });
    });
}

window.initializeStatusButtons = initializeStatusButtons;