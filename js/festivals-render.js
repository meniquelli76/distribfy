

(function () {
    let supabaseClient = null;

    async function updateFestivalCounter() {
    const counterElement = document.querySelector('.festival-count');
    if (!counterElement) {
        console.warn('Elemento do contador .festival-count não encontrado.');
        return;
    }

    try {
        // Query eficiente que apenas conta as linhas da tabela 'festivals'
        const { count, error } = await supabaseClient
            .from('festivals')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        if (count !== null) {
            counterElement.textContent = `${count} festivais`;
        } else {
            counterElement.textContent = '0 festivais';
        }
    } catch (err) {
        console.error('Erro ao buscar a contagem de festivais:', err);
        counterElement.textContent = 'Erro ao contar';
    }
}
    
    // =================================================================
    // CORREÇÃO APLICADA AQUI:
    // A variável do cache é declarada no escopo principal do script,
    // para que todas as funções dentro dele possam acessá-la.
    // =================================================================
    let festivalDataCache = new Map();

    const PAGE_SIZE = 12; // Quantos festivais carregar por vez
let currentPage = 0;
let isLoading = false; // Para evitar cliques múltiplos no botão
let currentFilterIds = null; // Armazena os IDs de uma busca filtrada
let noMoreResults = false; // Indica se chegamos ao fim dos resultados

const root = document.querySelector(".board-content");
const loadMoreBtn = document.getElementById('load-more-btn');

   window.fullQueryString = `
    *,
    festival_status!left(*),
    festival_edition!left(*),
    countries!left(*),
    month_held:months!festivals_month_held_id_fkey!left(*),
    month_opening:months!festivals_month_opening_id_fkey!left(*),
    platforms!left(*),
    fee_status!left(*),
    qualifiers:festival_qualifiers_assignments!left(qualifiers(*)),
    categories:festival_categories_assignments!left(categories(*)),
    genres:festival_genres_assignments!left(genres(*)),
    film_types:festival_film_types!left(film_types(*))
`;


    function onSupabaseReady(callback) {
        const interval = setInterval(() => {
            if (window.supabase) {
                clearInterval(interval);
                supabaseClient = window.supabase;
                callback();
            }
        }, 50);
    }

    function escapeHtml(s) { if (!s) return ''; return s.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
    function formatDate(dateStr) { if (!dateStr) return 'N/A'; try { const date = new Date(dateStr); const day = String(date.getUTCDate()).padStart(2, '0'); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const year = date.getUTCFullYear(); return `${day}/${month}/${year}`; } catch (e) { console.warn(`Formato de data inválido: ${dateStr}`); return dateStr; } }
    function renderTags(items, key, tagClass) {
    if (!items || items.length === 0) {
        // Adicionamos uma classe para poder estilizar este estado "vazio" se quisermos.
        return '<span class="tag-none">—</span>'; 
    }
    return items.map(item => `<span class="${tagClass}">${escapeHtml(item[key])}</span>`).join(' ');
}

    function createFestivalCardHTML(f) {
    const festivalName = escapeHtml(f.festival_name);
    const synopsis = escapeHtml(f.synopsis);
    const deadlineEarly = formatDate(f.deadline_early);
    const deadlineLate = formatDate(f.deadline_late);
    const resultDate = formatDate(f.result_date);
    const edition = escapeHtml(f.festival_edition?.edition || 'N/A');
    const country = escapeHtml(f.countries?.country || 'País N/A');
    const flagUrl = f.countries?.flag_icon_url || 'public/icons/flag.svg';
    const monthHeld = escapeHtml(f.month_held?.months_id || 'N/A');
    const monthOpening = escapeHtml(f.month_opening?.months_id || 'N/A');
    const platformName = escapeHtml(f.platforms?.platform_name || 'N/A');
    const platformLink = f.platform_link;
    const feeStatus = escapeHtml(f.fee_status?.status_name || 'N/A');
    const filmTypes = f.film_types && f.film_types.length > 0 ? f.film_types.map(ft => escapeHtml(ft.type)).join(' e ') : 'N/A';
    
    const websiteUrl = f.official_website;
    const socialUrl = f.festival_social_link;

    // --- LÓGICA PARA O PAINEL DE DETALHES ---
    
    // Lista de Premieres (baseado na estrutura do seu DB e HTML)
    const premiereTypes = [
        { id: 1, text: 'World Premiere' },
        { id: 2, text: 'International Premiere' },
        { id: 3, text: 'Continental Premiere' },
        { id: 4, text: 'National Premiere' },
        { id: 5, text: 'Regional Premiere' },
        { id: 6, text: 'No Premiere Requirement' }
    ];
    const premiereListHtml = premiereTypes.map(p => 
        `<li class="${f.premiere_id === p.id ? 'active' : 'inactive'}">${p.text}</li>`
    ).join('');

    // Formatação das taxas (Fee)
    const formatFeeRange = (min, max) => {
        if (!min && !max) return 'N/A';
        if (min && !max) return `A partir de ${min}`;
        if (!min && max) return `Até ${max}`;
        if (min === max) return `${min}`;
        return `${min}-${max}`;
    };
    const feeEarlyRange = formatFeeRange(f.fee_early_min, f.fee_early_max);
    const feeLateRange = formatFeeRange(f.fee_late_min, f.fee_late_max);

    // Lista de "Mais Informações"
    const moreInfoHtml = f.additional_info 
        ? f.additional_info.split('\n').map(line => `<li>${escapeHtml(line)}</li>`).join('')
        : '<li>Nenhuma informação adicional.</li>';


    let html = '';
    html += '<details class="festival-accordion">';
    html += '<summary class="festival-summary">';
    html += '<div class="festival-card-top">';
    html += '<div class="festival-card">';
    html += '<header class="festival-title-section">';
    html += '<div class="festival-title-wrapper">';
    html += `<h3 class="festival-title">${festivalName}</h3>`;
    html += '<img src="public/icons/icon-verified.svg" alt="Verificado" class="icon-verified" />';
    html += '</div>';
    const statusName = f.festival_status ? f.festival_status.status_name : 'A Pesquisar';
const statusId = f.festival_status ? f.festival_status.id : 1; // Assumindo 1 como padrão
html += `<button class="festival-status-btn" data-festival-id="${f.id}" data-status-id="${statusId}">${statusName}</button>`;

    html += '<button class="festival-chevron-btn" type="button">';
    html += '<img src="public/icons/btn-chevron-down.svg" alt="Expandir" />';
    html += '</button>';
    html += '</header>';
    html += '<div class="festival-card-header">';
    html += '<div class="festival-col festival-col-country">';
    html += '<div class="festival-country">';
    html += `<img src="${flagUrl}" alt="Bandeira do ${country}" class="flag-icon" />`;
    html += `<span>${country}</span>`;
    html += '</div>';
    html += '<div class="festival-qualifiers">';
    html += '<span class="label-small">Qualifying</span>';
    html += `<div class="tags-list">${renderTags(f.qualifiers, 'code', 'tag-qualifier')}</div>`;
    html += '</div>';
    html += `<div class="festival-age">${edition}ª Edição</div>`;
    html += '</div>';
    html += '<div class="divider-vertical"></div>';
    html += '<div class="festival-col festival-col-info">';
    html += `<div class="festival-info-item"><img src="public/icons/icon-calendar-period.svg" alt="" /><span>${monthHeld}</span></div>`;
    html += `<div class="festival-info-item"><img src="public/icons/icon-calendar-openentries.svg" alt="" /><span>${monthOpening}</span></div>`;
    html += `<div class="festival-info-item"><img src="public/icons/timer-film.svg" alt="" /><span>${filmTypes}</span></div>`;
    html += `<div class="festival-info-item"><img src="public/icons/icon-globe.svg" alt="" /><a href="${platformLink || '#'}" target="_blank" rel="noopener noreferrer">${platformName}</a></div>`;
    html += '</div>';
    html += '<div class="divider-vertical"></div>';
    html += '<div class="festival-col festival-col-deadlines">';
    html += '<h4 class="col-title">Deadlines</h4>';
    html += `<div class="deadline-item"><span class="deadline-label">Early</span><span class="deadline-date">${deadlineEarly}</span></div>`;
    html += `<div class="deadline-item"><span class="deadline-label">Last Date</span><span class="deadline-date">${deadlineLate}</span></div>`;
    html += '</div>';
    html += '<div class="festival-col festival-col-result">';
    html += '<h4 class="col-title">Resultado</h4>';
    html += `<span class="result-date">${resultDate}</span>`;
    html += `<div class="festival-col festival-col-fee"><img src="public/icons/icon_fest_currency2.svg" alt="" /><span class="fee-status">${feeStatus}</span></div>`;
    html += '</div>';
    html += '<div class="festival-item-tags">';
    html += '<div class="icon-tag"><img src="public/icons/icon-tag.svg" alt="Tag Icon" /></div>';
    html += `<div class="tags-group"><span class="label-small">Categorias</span><div class="tags-box"><div class="tags-list">${renderTags(f.categories, 'category', '')}</div><img src="public/icons/icon-chevron-right.svg" alt="Seta" class="icon-chevron"></div></div>`;
    html += `<div class="tags-group"><span class="label-small">Gêneros</span><div class="tags-box"><div class="tags-list">${renderTags(f.genres, 'genre', '')}</div><img src="public/icons/icon-chevron-right.svg" alt="Seta" class="icon-chevron"></div></div>`;
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '<aside class="festival-actions">';
    html += '<button class="action-btn action-btn--favorite" title="Favoritar"><img src="public/icons/icon-heart.svg" alt="Favoritar"/></button>';
    html += `<button class="action-btn" data-action="edit" data-id="${f.id}" title="Editar"><img src="public/icons/icon-edit.svg" alt="Editar" /></button>`;
    html += websiteUrl ? `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" class="action-btn" title="Link Externo"><img src="public/icons/icon-external-link.svg" alt="Link Externo"/></a>` : `<button class="action-btn" title="Link Externo indisponível" disabled><img src="public/icons/icon-external-link.svg" alt="Link Externo"/></button>`;
    html += socialUrl ? `<a href="${socialUrl}" target="_blank" rel="noopener noreferrer" class="action-btn" title="Social Media"><img src="public/icons/icon-instagram.svg" alt="Instagram"/></a>` : `<button class="action-btn" title="Social Media indisponível" disabled><img src="public/icons/icon-instagram.svg" alt="Instagram"/></button>`;
    html += '<button class="add-button" title="Adicionar ao meu filme"><img src="public/icons/icon-plus.svg" alt="Adicionar"/></button>';
    html += '</aside>';
    html += '</div>';
    html += '</summary>';
    
    // =================================================================
    // ##### CÓDIGO DO PAINEL EXPANDIDO ADICIONADO AQUI #####
    // =================================================================
    html += '<div class="card-expanded-content">';
    html += `   <p class="description">${synopsis || 'Sinopse não disponível.'}</p>`;
    html += '   <div class="more-details-panel">';
    html += '       <div class="detail-section detail-premiere">';
    html += '           <div class="detail-header"><img src="public/icons/icon-premiere.svg" alt="" /><h4>Premiere</h4></div>';
    html += `           <ul class="premiere-list">${premiereListHtml}</ul>`;
    html += '       </div>';
    html += '       <div class="detail-section detail-fee">';
    html += '           <div class="detail-header"><img src="public/icons/icon_fest_currency.svg" alt=""/><h4>Fee</h4></div>';
    html += '           <div class="fee-table">';
    html += `               <div class="fee-row"><span class="fee-label">Early</span><span class="fee-value">${feeEarlyRange}</span></div>`;
    html += `               <div class="fee-row"><span class="fee-label">Late</span><span class="fee-value">${feeLateRange}</span></div>`;
    html += '           </div>';
    html += '           <p class="fee-note">Verifique todas as categorias na página do festival.</p>';
    html += '       </div>';
    html += '       <div class="detail-section detail-more">';
    html += '           <div class="detail-header"><img src="public/icons/icon_fest_more.svg" alt="" /><h4>Mais</h4></div>';
    html += `           <ul class="more-list">${moreInfoHtml}</ul>`;
    html += '       </div>';
    html += '   </div>';
    html += '</div>';

    html += '</details>';
    return html;
}

    async function fetchAndRenderFestivals(isLoadMore = false) {
    if (isLoading) return;
    isLoading = true;
    if (loadMoreBtn) loadMoreBtn.textContent = 'Buscando...';

    try {
        if (!isLoadMore) {
            currentPage = 0;
            noMoreResults = false;
            if (root) root.innerHTML = "<p style='text-align:center; padding: 2rem;'>Carregando festivais...</p>";
        }

        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let query = supabaseClient.from('festivals').select(window.fullQueryString);

        if (currentFilterIds !== null) {
            if (currentFilterIds.length === 0) {
                noMoreResults = true;
                if(root) root.innerHTML = "<div class='no-results-message'>Nenhum festival encontrado com os filtros atuais.</div>";
            } else {
                query = query.in('id', currentFilterIds);
            }
        }

        if(noMoreResults) {
             if (currentFilterIds && currentFilterIds.length === 0) {}
             else if(root && !isLoadMore) root.innerHTML = "";
        } else {
            const { data, error } = await query
                .order("deadline_late", { ascending: true })
                .order("deadline_early", { ascending: true })
                .range(from, to);

            if (error) throw error;
            
            if (currentPage === 0) {
                root.innerHTML = ''; 
                festivalDataCache.clear();
            }

            if (data.length === 0 && currentPage === 0) {
                 root.innerHTML = "<div class='no-results-message'>Nenhum festival encontrado.</div>";
            }

            data.forEach(f => {
                const wrapper = document.createElement("div");
                wrapper.className = "festival-item-wrapper";
                wrapper.dataset.festivalId = f.id;
                const festivalData = { ...f, qualifiers: f.qualifiers.map(q => q.qualifiers).filter(Boolean), categories: f.categories.map(c => c.categories).filter(Boolean), genres: f.genres.map(g => g.genres).filter(Boolean), film_types: f.film_types.map(ft => ft.film_types).filter(Boolean) };
                festivalDataCache.set(f.id, festivalData);
                wrapper.innerHTML = createFestivalCardHTML(festivalData);
                root.appendChild(wrapper);
            });

            if (data.length < PAGE_SIZE) {
                noMoreResults = true;
            }
            
            if (typeof window.initializeTooltips === 'function') window.initializeTooltips();
            if (typeof window.initializeCardActions === 'function') window.initializeCardActions();
            if (typeof window.initializeAccordions === 'function') window.initializeAccordions();
            if (typeof window.initializeStatusButtons === 'function') window.initializeStatusButtons();
        }

    } catch (err) {
        console.error("Erro ao buscar e renderizar festivais:", err);
        if(root) root.innerHTML = "<p style='text-align:center; padding: 2rem;'>Ocorreu um erro ao carregar os festivais.</p>";
    } finally {
        isLoading = false;
        if (loadMoreBtn) {
            loadMoreBtn.textContent = 'Ver mais festivais';
            loadMoreBtn.style.display = noMoreResults ? 'none' : 'block';
        }
    }
}

window.triggerFestivalSearch = function(ids = null) {
    currentFilterIds = ids; // Armazena os IDs do filtro (ou null se limpou)
    fetchAndRenderFestivals(false); // Inicia uma nova busca do zero
}
    
    function handleActionClick(e) {
        const btn = e.target.closest('button[data-action="edit"]');
        if (!btn) return;
        
        const id = parseInt(btn.dataset.id, 10);
        if (!id || typeof window.populateFormForEdit !== 'function') return;

        const festivalObject = festivalDataCache.get(id);

        if (festivalObject) {
            e.preventDefault();
            console.log(`Render: Pegando dados do cache para o festival ID: ${id}. Populando formulário...`);
            window.populateFormForEdit(festivalObject);
        } else {
            console.error(`Festival com ID ${id} não encontrado no cache.`);
        }
    }

    window.fetchAndRenderFestivals = fetchAndRenderFestivals;

    onSupabaseReady(() => {
    supabaseClient = window.supabase;
    updateFestivalCounter();
    
    // ▼▼▼ CÓDIGO FALTANTE RESTAURADO AQUI ▼▼▼
    // Este bloco ativa o listener para os botões de ação (como 'Editar')
    // Ele garante que cliques dentro da área dos cards sejam monitorados.
    const root = document.querySelector(".board-content");
    if (root && !root.dataset.delegateAttached) {
        root.addEventListener("click", handleActionClick);
        root.dataset.delegateAttached = "true";
    }
    // ▲▲▲ FIM DO BLOCO RESTAURADO ▲▲▲

    // Listener para o botão de carregar mais (continua igual)
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentPage++; // Incrementa a página
            fetchAndRenderFestivals(true); // Busca a próxima página
        });
    }

    // Busca inicial ao carregar a página (continua igual)
    fetchAndRenderFestivals(false);
});

})();