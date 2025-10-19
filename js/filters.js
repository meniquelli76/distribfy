document.addEventListener('DOMContentLoaded', () => {
    console.log("▶️  Inicializando Lógica de Filtros (Versão Finalíssima)...");
    
    let filterOptions = {};
    const activeFilters = {
        searchTerm: '', sortBy: 'deadline', sortAsc: true,
        countries: [], platforms: [], fee_status: [], month_opening: [], status: [],
        genres: [], categories: [], qualifiers: [],
    };

    const searchInput = document.querySelector('.search-field input');
    const sortButtons = document.querySelectorAll('.sort-options .sort-btn');
    const filtersListContainer = document.querySelector('.filters-list');
    const btnClear = document.querySelector('.btn-clear');

    async function fetchFilterOptions() {
        try {
            const filtersToFetch = [
                { key: 'countries', table: 'countries', nameCol: 'country', title: 'País' }, { key: 'month_opening', table: 'months', nameCol: 'months_id', title: 'Abertura das Inscrições' },
                { key: 'categories', table: 'categories', nameCol: 'category', title: 'Categoria' }, { key: 'genres', table: 'genres', nameCol: 'genre', title: 'Gênero' },
                { key: 'platforms', table: 'platforms', nameCol: 'platform_name', title: 'Plataforma' }, { key: 'fee_status', table: 'fee_status', nameCol: 'status_name', title: 'Inscrições' },
                { key: 'status', table: 'festival_status', nameCol: 'status_name', title: 'Status' }, { key: 'qualifiers', table: 'qualifiers', nameCol: 'name', title: 'Qualificadores' },
            ];
            for (const filter of filtersToFetch) {
                const { data, error } = await window.supabase.from(filter.table).select(`id, ${filter.nameCol}`).order(filter.nameCol, { ascending: true });
                if (error) throw error;
                filterOptions[filter.key] = { title: filter.title, options: data.map(item => ({ id: item.id, name: item[filter.nameCol] })) };
            }
        } catch (err) { console.error("Erro ao buscar opções de filtros:", err); }
    }

    function renderFilterUI() {
        if (!filtersListContainer) return;
        filtersListContainer.innerHTML = '';
        for (const key in filterOptions) {
            const filter = filterOptions[key];
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'filter-category';
            let optionsHtml = filter.options.map(option => `<label class="filter-option">${escapeHtml(option.name)}<input type="checkbox" value="${option.id}" data-category="${key}"><span class="checkmark"></span></label>`).join('');
            categoryDiv.innerHTML = `<button class="filter-toggle"><span>${filter.title}</span><img src="public/icons/icon-chevron-down.svg" alt=""/></button><div class="filter-options-panel">${optionsHtml}</div>`;
            filtersListContainer.appendChild(categoryDiv);
        }
        addEventListeners();
    }
    
    function addEventListeners() {
        document.querySelectorAll('.filter-toggle').forEach(toggle => toggle.addEventListener('click', () => toggle.parentElement.classList.toggle('open')));
        document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const category = e.target.dataset.category;
                const id = parseInt(e.target.value, 10);
                if (e.target.checked) {
                    if (!activeFilters[category].includes(id)) activeFilters[category].push(id);
                } else {
                    activeFilters[category] = activeFilters[category].filter(itemId => itemId !== id);
                }
                debouncedApplyFilters();
            });
        });
        if (searchInput) { searchInput.addEventListener('input', (e) => { activeFilters.searchTerm = e.target.value; debouncedApplyFilters(); }); }
        sortButtons.forEach(button => { button.addEventListener('click', () => { if (button.classList.contains('active')) return; sortButtons.forEach(btn => btn.classList.remove('active')); button.classList.add('active'); const sortValue = button.textContent.trim().toLowerCase(); activeFilters.sortBy = sortValue === 'deadline' ? 'deadline' : 'results'; applyFilters(); }); });
        if(btnClear) { btnClear.addEventListener('click', () => { resetFilters(); }); }
    }

    async function applyFilters() {
        if (!window.supabase || !window.fetchAndRenderFestivals) { return; }
        try {
            const params = {
                search_term: activeFilters.searchTerm || null,
                country_ids: activeFilters.countries.length > 0 ? activeFilters.countries : null,
                genre_ids: activeFilters.genres.length > 0 ? activeFilters.genres : null,
                category_ids: activeFilters.categories.length > 0 ? activeFilters.categories : null,
                qualifier_ids: activeFilters.qualifiers.length > 0 ? activeFilters.qualifiers : null,
                platform_ids: activeFilters.platforms.length > 0 ? activeFilters.platforms : null,
                fee_status_ids: activeFilters.fee_status.length > 0 ? activeFilters.fee_status : null,
                month_opening_ids: activeFilters.month_opening.length > 0 ? activeFilters.month_opening : null,
                status_ids: activeFilters.status.length > 0 ? activeFilters.status : null,
            };

            const { data: idData, error: rpcError } = await window.supabase.rpc('filter_festivals', params);
            if (rpcError) throw rpcError;

            const festivalIds = idData.map(item => item.id);
            if (festivalIds.length === 0 && (activeFilters.searchTerm || params.country_ids || params.genre_ids || params.category_ids || params.qualifier_ids || params.platform_ids || params.fee_status_ids || params.month_opening_ids || params.status_ids)) {
                window.fetchAndRenderFestivals([]);
                return;
            }

            let query = window.supabase.from('festivals').select(window.fullQueryString);
            if(festivalIds.length > 0) {
                 query = query.in('id', festivalIds);
            }

            if (activeFilters.sortBy === 'deadline') {
                query = query.order('deadline_late', { ascending: true }).order('deadline_early', { ascending: true });
            } else {
                query = query.order('result_date', { ascending: activeFilters.sortAsc });
            }
            
            const { data, error } = await query;
            if (error) throw error;
            
            window.fetchAndRenderFestivals(data);
        } catch (err) {
            console.error("Erro no processo de filtro:", err);
            window.fetchAndRenderFestivals(null, err);
        }
    }
    
    function resetFilters() {
        Object.keys(activeFilters).forEach(key => { if (Array.isArray(activeFilters[key])) activeFilters[key] = []; });
        activeFilters.searchTerm = '';
        if (searchInput) searchInput.value = '';
        document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(cb => cb.checked = false);
        document.querySelectorAll('.filter-category.open').forEach(cat => cat.classList.remove('open'));
        applyFilters();
    }
    function escapeHtml(s) { return s.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
    const debounce = (func, delay) => { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); }; };
    const debouncedApplyFilters = debounce(applyFilters, 500);

    fetchFilterOptions().then(() => { renderFilterUI(); });
});