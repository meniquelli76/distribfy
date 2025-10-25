// js/filter-ui.js (VERSÃO v3.10 - UI Customizada com Checkboxes)

(function () {
  let supabase;
  const filtersListElement = document.querySelector('.filters-list');
  // Não precisamos mais de choicesInstances

  /**
   * Função principal de inicialização.
   */
  async function initializeFilterUI() {
    supabase = window.supabase;

    if (filtersListElement) {
      console.log('✅ filter-ui.js (v3.10): Supabase pronto. Construindo UI customizada...');
      // ★ MUDANÇA: Limpa o container antes de construir
      filtersListElement.innerHTML = '';
      buildCustomFilterUI(); // Constrói a UI customizada
    } else {
      console.error('❌ filter-ui.js: Elemento .filters-list não encontrado.');
    }

    // Inicializa o slider de taxa (inalterado)
    await initializeFeeSlider();

    // Inicializa os botões de ordenação (inalterado)
    initializeSortButtons();

    // Anexa o listener ao botão "limpar"
    const clearBtn = document.querySelector('.btn-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearAllFilters);
    }

    // ★ NOVO: Listener para fechar dropdowns ao clicar fora
    document.addEventListener('click', handleOutsideClick);
  }

  /**
   * Inicializa os botões de ordenação (Inalterado)
   */
  function initializeSortButtons() {
    // ... (código igual à versão anterior) ...
    const sortButtons = document.querySelectorAll('.sort-options .sort-btn');
    sortButtons.forEach((btn) => {
      /* ... add dataset ... */
    });
    sortButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return;
        sortButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const sortBy = btn.dataset.sort;
        if (window.__filterCtx) window.__filterCtx.sortBy = sortBy;
        if (typeof window.triggerFestivalSearch === 'function') window.triggerFestivalSearch();
      });
    });
  }

  /**
   * Inicializa o slider de taxa (Inalterado)
   */
  async function initializeFeeSlider() {
    // ... (código igual à versão anterior, chamando a RPC get_max_festival_fee_brl) ...
    const slider = document.getElementById('fee-range-slider');
    const minValSpan = document.getElementById('slider-min-value');
    const maxValSpan = document.getElementById('slider-max-value');
    if (!slider) return;
    let rangeMin = 0,
      rangeMax = 200;
    try {
      /* ... busca max fee ... */
      const { data, error } = await supabase.rpc('get_max_festival_fee_brl');
      if (error) throw error;
      if (data && data > 0) rangeMax = Math.ceil(Number(data) / 10) * 10;
      else if (data === 0) rangeMax = 50;
    } catch (err) {
      /* ... fallback ... */
    }
    noUiSlider.create(slider, {
      /* ... options ... */ start: [rangeMin, rangeMax],
      connect: true,
      range: { min: rangeMin, max: rangeMax },
      step: 5,
      format: { to: (v) => Math.round(v), from: (v) => parseFloat(v) },
    });
    slider.noUiSlider.on('update', (values) => {
      // ★ LOG ADICIONADO ★
      console.log('[Slider Update] Evento disparado. Valores:', values);

      const minValSpan = document.getElementById('slider-min-value'); // ★ Busca o span AQUI DENTRO ★
      const maxValSpan = document.getElementById('slider-max-value'); // ★ Busca o span AQUI DENTRO ★

      if (minValSpan) {
        minValSpan.textContent = `R$ ${values[0]}`;
        // console.log('[Slider Update] -> Atualizou minValSpan'); // Log opcional
      } else {
        console.error('[Slider Update] -> ERRO: span #slider-min-value NÃO encontrado!'); // ★ LOG DE ERRO ★
      }
      if (maxValSpan) {
        maxValSpan.textContent = `R$ ${values[1]}`;
        // console.log('[Slider Update] -> Atualizou maxValSpan'); // Log opcional
      } else {
        console.error('[Slider Update] -> ERRO: span #slider-max-value NÃO encontrado!'); // ★ LOG DE ERRO ★
      }
    });
    console.log('✅ filter-ui.js: Slider de taxa inicializado.');
  }

  /**
   * Busca todos os dados das tabelas de lookup (SELECTs)
   * (Função inalterada)
   */
  async function fetchAllFilterOptions() {
    console.log('filter-ui.js: Iniciando fetchAllFilterOptions...'); // Log inicial
    try {
      // Tenta buscar cada tabela individualmente para isolar o erro
      const countriesPromise = supabase.from('countries').select('id, country').order('country');
      const filmTypesPromise = supabase.from('film_types').select('id, type').order('id');
      const genresPromise = supabase.from('genres').select('id, genre').order('genre');
      const categoriesPromise = supabase
        .from('categories')
        .select('id, category')
        .order('category');
      const qualifiersPromise = supabase.from('qualifiers').select('id, code, name').order('name');
      const platformsPromise = supabase
        .from('platforms')
        .select('id, platform_name')
        .order('platform_name');
      const feeStatusPromise = supabase.from('fee_status').select('id, status_name').order('id');
      const monthsPromise = supabase.from('months').select('id, months_id').order('id');
      const statusPromise = supabase.from('festival_status').select('id, status_name').order('id');

      console.log('filter-ui.js: Promises de busca criadas.');

      // Executa todas em paralelo
      const results = await Promise.all([
        countriesPromise,
        filmTypesPromise,
        genresPromise,
        categoriesPromise,
        qualifiersPromise,
        platformsPromise,
        feeStatusPromise,
        monthsPromise,
        statusPromise,
      ]);

      console.log('filter-ui.js: Promise.all concluído.');

      // ★★★ LOG ADICIONADO AQUI ★★★
      // Verifica o resultado bruto da última promise (film_types)
      const filmTypesResult = results[results.length - 1]; // Pega o último resultado do array
      console.log('--- RESULTADO BRUTO de supabase.from("film_types"): ---');
      console.log(JSON.stringify(filmTypesResult, null, 2)); // Mostra o objeto inteiro
      console.log('----------------------------------------------------');
      // ★★★ FIM DO LOG ADICIONADO ★★★

      // Verifica erros em cada resultado individualmente
      const errors = results.filter((res) => res.error);
      if (errors.length > 0) {
        console.error(
          '❌ filter-ui.js: Erro em uma ou mais buscas de lookup:',
          errors.map((e) => e.error)
        );
        // Lança o primeiro erro encontrado para ser pego pelo catch principal
        throw errors[0].error;
      }

      console.log('filter-ui.js: Todas as buscas de lookup bem-sucedidas.');

      // Extrai os dados
      const [countries, film_types, genres, categories, qualifiers, platforms, fee_status, months, status] =
        results;

      return {
        countries: countries.data,
        film_types: film_types.data, 
        genres: genres.data,
        categories: categories.data,
        qualifiers: qualifiers.data,
        platforms: platforms.data,
        fee_status: fee_status.data,
        months: months.data,
        status: status.data,
      };
    } catch (error) {
      // Este catch DEVE pegar qualquer erro agora
      console.error('❌ filter-ui.js: Erro DETALHADO ao buscar opções de filtro:', error);
      // Retorna null para exibir a mensagem de erro na UI
      return null;
    }
  }

  // ★★★ INÍCIO DAS MUDANÇAS PRINCIPAIS ★★★

  /**
   * Constrói a UI customizada com checkboxes em dropdowns
   */
  async function buildCustomFilterUI() {
    const options = await fetchAllFilterOptions();
    if (!options) {
      filtersListElement.innerHTML =
        '<p style="padding: 0 1rem; color: var(--color-error-red);">Erro ao carregar filtros.</p>';
      return;
    }

    // Função helper para criar cada filtro customizado
    // Função helper para criar cada filtro customizado (COM VERIFICAÇÃO)
    // Função helper para criar cada filtro customizado (VERSÃO COMPLETA E CORRETA)
    const createCustomFilter = (id, label, data, valueKey, labelKey) => {
      // Verifica se 'data' é um array válido
      if (!Array.isArray(data)) {
        console.error(
          `❌ filter-ui.js: Dados inválidos ou ausentes para o filtro "${label}" (ID: ${id}). Esperava um array, recebeu:`,
          data
        );
        const errorHtml = `
            <div class="filter-category custom-filter" data-filter-id="${id}">
              <button type="button" class="filter-toggle" disabled>${label} (Erro)</button>
              <div class="filter-dropdown" style="display: none;">
                 <p style="padding: 5px 10px; color: red; font-size: 0.8em;">Não foi possível carregar opções.</p>
              </div>
            </div>`;
        filtersListElement.insertAdjacentHTML('beforeend', errorHtml);
        return; // Aborta
      }

      // Gera HTML das opções
      const optionsHtml = data
        .map(
          (item) =>
            `<li><label><input type="checkbox" value="${item[valueKey]}" data-filter-group="${id}"> <span>${item[labelKey]}</span></label></li>`
        )
        .join('');

      // Gera HTML do filtro
      const html = `
        <div class="filter-category custom-filter" data-filter-id="${id}">
          <button type="button" class="filter-toggle"> ${label} <img src="public/icons/icon-chevron-down.svg" alt="" class="chevron-icon" /> </button>
          <div class="filter-dropdown" style="display: none;"> <ul class="filter-options-list" id="${id}-list"> ${optionsHtml} </ul> </div>
        </div>`;
      filtersListElement.insertAdjacentHTML('beforeend', html);

      // =============================================================
      // ★★★ BLOCO FALTANTE RESTAURADO ABAIXO ★★★
      // =============================================================
      // Adiciona listeners para este filtro específico
      const filterElement = filtersListElement.querySelector(
        `.custom-filter[data-filter-id="${id}"]`
      );
      const toggleButton = filterElement.querySelector('.filter-toggle');
      const dropdown = filterElement.querySelector('.filter-dropdown');
      // ★ Define a variável 'checkboxes' ★
      const checkboxes = filterElement.querySelectorAll('input[type="checkbox"]');

      // Listener para abrir/fechar o dropdown (Inalterado)
      toggleButton.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpening = dropdown.style.display === 'none';
        closeAllDropdowns(filterElement);
        dropdown.style.display = isOpening ? 'block' : 'none';
        toggleButton.classList.toggle('active', isOpening);
      });

      // ★ Bloco 'checkboxes.forEach' com logs e setTimeout ★
      // Listener para checkboxes (dispara a busca - COM LOGS E DELAY)
      checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => {
          // Adiciona 'event'
          // Logs adicionados
          const isChecked = event.target.checked;
          const value = event.target.value;
          const group = event.target.dataset.filterGroup;
          console.log(`[Checkbox Change] Grupo: ${group}, Valor: ${value}, Marcado: ${isChecked}`);
          console.log('[Checkbox Change] Elemento:', event.target);

          // Chama a busca com delay
          if (typeof window.triggerFestivalSearch === 'function') {
            setTimeout(() => {
              console.log('[Checkbox Change] Chamando triggerFestivalSearch após delay...');
              window.triggerFestivalSearch();
            }, 50); // 50ms de delay
          }
        });
      });
      // =============================================================
      // ★★★ FIM DO BLOCO RESTAURADO ★★★
      // =============================================================
    }; // <-- Fim da função createCustomFilter

    // Criar os filtros usando a nova função helper
    createCustomFilter('filter-country', 'País', options.countries, 'id', 'country');
    createCustomFilter('filter-film-type', 'Tipo', options.film_types, 'id', 'type');
    createCustomFilter('filter-genre', 'Gênero', options.genres, 'id', 'genre');
    createCustomFilter('filter-category', 'Categoria', options.categories, 'id', 'category');
    createCustomFilter('filter-qualifier', 'Qualificadores', options.qualifiers, 'id', 'name');
    createCustomFilter('filter-platform', 'Plataforma', options.platforms, 'id', 'platform_name');
    createCustomFilter('filter-fee-status', 'Taxa', options.fee_status, 'id', 'status_name');
    createCustomFilter('filter-month', 'Mês de Abertura', options.months, 'id', 'months_id');
    createCustomFilter('filter-status', 'Status', options.status, 'id', 'status_name');

    console.log('✅ filter-ui.js (v3.10): UI customizada construída com sucesso.');
  }

  /**
   * Fecha todos os dropdowns abertos, exceto o especificado (opcional)
   */
  function closeAllDropdowns(exceptElement = null) {
    document.querySelectorAll('.custom-filter .filter-dropdown').forEach((dropdown) => {
      const parentFilter = dropdown.closest('.custom-filter');
      if (parentFilter !== exceptElement) {
        dropdown.style.display = 'none';
        parentFilter.querySelector('.filter-toggle')?.classList.remove('active');
      }
    });
  }

  /**
   * Fecha dropdowns se o clique for fora deles
   */
  function handleOutsideClick(event) {
    const openDropdown = document.querySelector('.custom-filter .filter-dropdown[style*="block"]');
    if (openDropdown && !openDropdown.closest('.custom-filter').contains(event.target)) {
      closeAllDropdowns();
    }
  }

  /**
   * Limpa todos os filtros (checkboxes) e dispara a busca
   */
  function clearAllFilters() {
    console.log('filter-ui.js (v3.10): Limpeza de filtros acionada...');

    // ★ MUDANÇA: Desmarca todos os checkboxes
    document.querySelectorAll('.custom-filter input[type="checkbox"]').forEach((cb) => {
      cb.checked = false;
    });

    // Reseta o slider (inalterado)
    const slider = document.getElementById('fee-range-slider');
    if (slider && slider.noUiSlider) {
      slider.noUiSlider.reset();
    }

    // Limpa busca (inalterado)
    const searchInput = document.querySelector('.search-field input');
    if (searchInput) {
      searchInput.value = '';
    }

    // Reseta ordenação (inalterado)
    const sortButtons = document.querySelectorAll('.sort-options .sort-btn');
    sortButtons.forEach((btn) => {
      const isDeadline = btn.dataset.sort === 'deadline';
      btn.classList.toggle('active', isDeadline);
    });
    if (window.__filterCtx) window.__filterCtx.sortBy = 'deadline';

    // Fecha dropdowns abertos
    closeAllDropdowns();

    // Dispara a busca
    if (typeof window.triggerFestivalSearch === 'function') {
      window.triggerFestivalSearch();
    }
  }

  // ★★★ FIM DAS MUDANÇAS PRINCIPAIS ★★★

  // =========================================================
  // LÓGICA DE INICIALIZAÇÃO (Guarda) - Inalterada
  // =========================================================
  if (window.supabase) {
    console.log('filter-ui.js (v3.10): Supabase já estava pronto. Inicializando...');
    initializeFilterUI();
  } else {
    console.log('filter-ui.js (v3.10): Aguardando evento supabaseReady...');
    window.addEventListener('supabaseReady', initializeFilterUI);
  }
})();
