// js/filters.js (VERSÃO CORRIGIDA v3.9)
// Lê valores dos checkboxes customizados

(function () {
  let supabase;

  // Contexto global dos filtros (inalterado)
  if (!window.__filterCtx) {
    window.__filterCtx = {
      mode: 'festivals',
      filmId: null,
      supabaseReady: false,
      lastAppliedPayload: null,
      sortBy: 'deadline',
    };
    console.log('▶️  Inicializando Lógica de Filtros (Versão Limpa v3.9)...');
  }

  /**
   * Helper para aguardar Supabase. (Inalterado)
   */
  async function waitForSupabase(timeoutMs = 5000) {
    // ... (código igual à v3.8) ...
    const start = Date.now();
    while (!window.supabase) {
      /* ... espera ... */
    }
    window.__filterCtx.supabaseReady = true;
    return window.supabase;
  }

  // APIs globais (Inalteradas)
  window.setFilterContext = ({ mode = 'festivals', filmId = null } = {}) => {
    /* ... */
  };
  window.resetFilters = () => {
    /* ... */
  };

  /**
   * Função "mestre" chamada pela UI (filter-ui.js) (Inalterada)
   */
  window.triggerFestivalSearch = async () => {
    let ids = null; // Garante que ids tenha um valor inicial
    try {
      supabase = await waitForSupabase();
      const payload = buildSidebarPayload();
      const matchIds = null;

      // ★ LOG ADICIONADO ★ Log antes da chamada RPC
      console.log('[triggerFestivalSearch] Chamando rpcFilterFestivals...');
      ids = await rpcFilterFestivals(payload, matchIds); // Atribui o resultado a 'ids'
      // ★ LOG ADICIONADO ★ Log imediatamente após a chamada RPC
      console.log(`[triggerFestivalSearch] rpcFilterFestivals retornou:`, ids);

      // Renderiza os resultados (seja um array de IDs ou um array vazio)
      renderFilteredIds(ids);
    } catch (err) {
      // Erros da RPC ou de waitForSupabase/buildSidebarPayload serão pegos aqui
      console.error('❌ Erro no processo de filtro (triggerFestivalSearch catch):', err);
      renderFilteredIds(null, err); // Passa o erro para o renderizador
    }
  };

  // ★★★ INÍCIO DA MUDANÇA PRINCIPAL ★★★

  /**
   * ★ CORRIGIDO: Constrói o payload lendo os CHECKBOXES e o slider
   */
  function buildSidebarPayload() {
    // Helper com logs (como na última tentativa)
    const getCheckedValues = (filterGroupId) => {
      console.log(`[getCheckedValues] Buscando grupo: ${filterGroupId}`);
      const allCheckboxesInGroup = document.querySelectorAll(
        `.custom-filter input[data-filter-group="${filterGroupId}"]`
      );
      console.log(
        `[getCheckedValues] Encontrados ${allCheckboxesInGroup.length} checkboxes no total para ${filterGroupId}.`
      );
      const checkedBoxes = document.querySelectorAll(
        `.custom-filter input[data-filter-group="${filterGroupId}"]:checked`
      );
      console.log(
        `[getCheckedValues] Encontrados ${checkedBoxes.length} checkboxes MARCADOS para ${filterGroupId}.`
      );
      if (!checkedBoxes || checkedBoxes.length === 0) {
        console.log(`[getCheckedValues] Nenhum marcado para ${filterGroupId}, retornando null.`);
        return null;
      }
      const values = Array.from(checkedBoxes).map((cb) => parseInt(cb.value));
      console.log(`[getCheckedValues] Valores marcados para ${filterGroupId}:`, values);
      return values.length ? values : null;
    };

    // Leitura do slider (inalterada)
    let min_fee = null,
      max_fee = null;
    const slider = document.getElementById('fee-range-slider');
    if (slider && slider.noUiSlider) {
      /* ... lógica do slider ... */
    }

    // Monta payload (inalterado)
    const payload = {
      search_term: document.querySelector('.search-field input')?.value || null,
      country_ids: getCheckedValues('filter-country'),
      film_type_ids: getCheckedValues('filter-film-type'),
      genre_ids: getCheckedValues('filter-genre'),
      category_ids: getCheckedValues('filter-category'),
      qualifier_ids: getCheckedValues('filter-qualifier'),
      platform_ids: getCheckedValues('filter-platform'),
      fee_status_ids: getCheckedValues('filter-fee-status'),
      month_opening_ids: getCheckedValues('filter-month'),
      status_ids: getCheckedValues('filter-status'),
      min_fee: min_fee,
      max_fee: max_fee,
    };

    // ★ LOG CORRIGIDO ★ Usa JSON.stringify para garantir a visualização
    console.log('Filtro aplicado com payload (v3.9.1):', JSON.stringify(payload, null, 2));
    return payload;
  }

  // ★★★ FIM DA MUDANÇA PRINCIPAL ★★★

  /**
   * Executa a RPC de filtro e retorna IDs de festivais
   * (Esta função está correta desde a v3.7/v3.8)
   */
  async function rpcFilterFestivals(payload, matchIds = null) {
    if (!supabase) throw new Error('Supabase client not ready.');
    let rpcName, rpcPayload;

    // Lógica de seleção RPC (inalterada)
    if (window.__filterCtx.mode === 'festmatch') {
      /* ... */
    } else {
      rpcName = 'filter_festivals';
      rpcPayload = { ...payload, active_currency: 'BRL' };
    }

    // ★ LOG CORRIGIDO ★ Usa JSON.stringify
    console.log(
      `Enviando payload para RPC '${rpcName}' (v3.9.1):`,
      JSON.stringify(rpcPayload, null, 2)
    );

    // ★ CAPTURA DE ERRO REFINADA ★
    const { data, error } = await supabase.rpc(rpcName, rpcPayload);

    if (error) {
      console.error(`Erro na chamada RPC '${rpcName}':`, error); // Log específico do erro RPC
      throw error; // Relança o erro para ser pego pelo triggerFestivalSearch
    }

    // ★ RETORNO GARANTIDO ★ Retorna array vazio se não houver dados
    const filteredIds = data && data.length > 0 ? data.map((r) => r.id) : [];
    console.log(`RPC '${rpcName}' retornou ${filteredIds.length} IDs.`);
    return filteredIds; // Sempre retorna um array (vazio ou com IDs)
  }

  /**
   * Chama o renderizador no 'festivals-render.js' (Inalterada)
   */
  function renderFilteredIds(ids, error = null) {
    if (error) {
      console.error('[filters.js] Erro recebido, notificando renderizador:', error);
      if (typeof window.renderFestivalsByIds === 'function') {
        window.renderFestivalsByIds(null, error);
      } else {
        console.error(
          'ERRO FATAL: window.renderFestivalsByIds não encontrada ao tentar reportar erro.'
        );
      }
      return;
    }

    // ★ LOG MELHORADO ★ Garante que 'ids' seja um array
    const idsToDeliver = Array.isArray(ids) ? ids : [];
    console.log(`[filters.js] Entregando ${idsToDeliver.length} IDs para renderFestivalsByIds.`);

    if (typeof window.renderFestivalsByIds === 'function') {
      window.renderFestivalsByIds(idsToDeliver); // Entrega sempre um array
    } else {
      console.error('ERRO FATAL: window.renderFestivalsByIds não encontrada.');
    }
  }

  // Inicialização automática (Inalterada)
  (async function initFilters() {
    try {
      supabase = await waitForSupabase();
      console.log('✅ Módulo de Filtros inicializado com Supabase (v3.9).');
    } catch (err) {
      console.error('⛔ Erro fatal ao inicializar módulo de filtros:', err);
    }
  })();
})();
