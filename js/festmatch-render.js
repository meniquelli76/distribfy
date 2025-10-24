/*
 * =============================================================
 * ARQUIVO: js/festmatch-render.js
 * (Versão com Lógica de Filtro de Sidebar)
 * =============================================================
 */

(function () {
  let supabaseClient = null;
  let festivalDataCache = new Map();
  let choicesInstance = null; // Para o dropdown de filmes

  const PAGE_SIZE = 12;
  let currentPage = 0;
  let isLoading = false;
  let noMoreResults = false;

  const root = document.querySelector('.board-content');
  const loadMoreBtn = document.getElementById('load-more-btn');
  const filmSelect = document.getElementById('film-select');
  const emptyState = document.getElementById('festmatch-empty-state');

  // =================================================================
  // VARIÁVEIS DE ESTADO DO FILTRO
  // =================================================================

  // Armazena os IDs [1, 5, 10] do filme selecionado (RPC)
  let currentMatchIds = null;

  // Armazena os IDs [5, 10, 20] dos filtros da sidebar (vindo do filters.js)
  let currentSidebarFilterIds = null;

  // Armazena a INTERSECÇÃO [5, 10] que será usada para renderizar
  let currentFinalFilterIds = null;

  // Query string reutilizada
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

  // =================================================================
  // FUNÇÕES DE RENDERIZAÇÃO E UTILITÁRIOS (IDÊNTICAS)
  // =================================================================

  function escapeHtml(s) {
    /* ... (mesma função) ... */
  }
  function formatDate(dateStr) {
    /* ... (mesma função) ... */
  }
  function renderTags(items, key, tagClass) {
    /* ... (mesma função) ... */
  }
  function createFestivalCardHTML(f) {
    // ... (Cole aqui EXATAMENTE a mesma função createFestivalCardHTML
    //      do seu arquivo festivals-render.js) ...
  }
  function handleActionClick(e) {
    /* ... (mesma função do render.js) ... */
  }

  // =================================================================
  // LÓGICA DE FETCH (Adaptada para Festmatch)
  // =================================================================

  async function fetchAndRenderFestivals(isLoadMore = false) {
    // Não faz nada se o usuário ainda não selecionou um filme
    if (currentFinalFilterIds === null) {
      // Garante que a mensagem inicial seja exibida
      if (emptyState) emptyState.style.display = 'block';
      if (root) root.innerHTML = '';
      root.appendChild(emptyState);
      return;
    }

    if (isLoading) return;
    isLoading = true;
    if (loadMoreBtn) loadMoreBtn.textContent = 'Buscando...';

    try {
      if (!isLoadMore) {
        currentPage = 0;
        noMoreResults = false;
        if (root)
          root.innerHTML = "<p style='text-align:center; padding: 2rem;'>Buscando festivais...</p>";
        festivalDataCache.clear();
      }

      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabaseClient.from('festivals').select(window.fullQueryString);

      // Esta é a lógica de filtro principal!
      if (currentFinalFilterIds.length === 0) {
        noMoreResults = true;
        if (root)
          root.innerHTML =
            "<div class='no-results-message'>Nenhum festival encontrado com esta combinação de filme e filtros.</div>";
      } else {
        // Filtra APENAS pelos IDs da intersecção
        query = query.in('id', currentFinalFilterIds);
      }

      if (noMoreResults) {
        if (currentFinalFilterIds.length === 0) {
        } else if (root && !isLoadMore) root.innerHTML = '';
      } else {
        const { data, error } = await query
          .order('deadline_late', { ascending: true })
          .order('deadline_early', { ascending: true })
          .range(from, to);

        if (error) throw error;

        if (currentPage === 0) {
          root.innerHTML = '';
        }

        if (emptyState) emptyState.style.display = 'none';

        if (data.length === 0 && currentPage === 0) {
          root.innerHTML =
            "<div class='no-results-message'>Nenhum festival encontrado com esta combinação de filme e filtros.</div>";
        }

        data.forEach((f) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'festival-item-wrapper';
          wrapper.dataset.festivalId = f.id;
          const festivalData = {
            ...f,
            qualifiers: f.qualifiers.map((q) => q.qualifiers).filter(Boolean),
            categories: f.categories.map((c) => c.categories).filter(Boolean),
            genres: f.genres.map((g) => g.genres).filter(Boolean),
            film_types: f.film_types.map((ft) => ft.film_types).filter(Boolean),
          };
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
      console.error('Erro ao buscar e renderizar festivais:', err);
      if (root)
        root.innerHTML =
          "<p style='text-align:center; padding: 2rem;'>Ocorreu um erro ao carregar os festivais.</p>";
    } finally {
      isLoading = false;
      if (loadMoreBtn) {
        loadMoreBtn.textContent = 'Ver mais festivais';
        loadMoreBtn.style.display = noMoreResults ? 'none' : 'block';
      }
    }
  }

  /**
   * Esta função é chamada pelo 'js/filters.js'
   * Aqui, calculamos a INTERSECÇÃO dos filtros.
   */
  window.triggerFestivalSearch = function (sidebarFilterIds = null) {
    console.log('triggerFestivalSearch chamado com:', sidebarFilterIds);

    // Atualiza os IDs da sidebar
    currentSidebarFilterIds = sidebarFilterIds;

    // Se nenhum filme foi selecionado ainda, não faz nada.
    if (currentMatchIds === null) {
      console.log('Nenhum filme selecionado, busca interrompida.');
      currentFinalFilterIds = null; // Garante que nada seja renderizado
      fetchAndRenderFestivals(false); // Limpará a tela
      return;
    }

    // LÓGICA DE INTERSECÇÃO:

    if (currentSidebarFilterIds === null) {
      // Caso 1: Filtros da sidebar estão "limpos"
      // O resultado final é Apenas os IDs do Match
      currentFinalFilterIds = currentMatchIds;
      console.log('Filtros limpos. Renderizando IDs do Match:', currentFinalFilterIds);
    } else {
      // Caso 2: Filtros da sidebar estão ATIVOS
      // O resultado final é a INTERSECÇÃO
      currentFinalFilterIds = currentMatchIds.filter((id) => currentSidebarFilterIds.includes(id));
      console.log('Filtros ativos. Intersecção:', currentFinalFilterIds);
    }

    // Dispara a renderização com os IDs finais calculados
    fetchAndRenderFestivals(false);
  };

  // =================================================================
  // LÓGICA DE CARREGAMENTO (Com "Guard" e "Trigger")
  // =================================================================

  async function loadUserFilms() {
    // ... (Cole aqui EXATAMENTE a mesma função loadUserFilms
    //      da minha resposta anterior - a que tem o "Guard"
    //      e redireciona se o usuário não tiver filmes) ...
  }

  async function onFilmSelect(e) {
    const filmId = e.target.value ? parseInt(e.target.value, 10) : null;

    if (loadMoreBtn) loadMoreBtn.style.display = 'none';

    if (!filmId) {
      currentMatchIds = null; // Reseta os IDs do Match
      currentSidebarFilterIds = null; // Reseta os IDs do Filtro
      currentFinalFilterIds = null; // Reseta os IDs Finais
      if (typeof window.clearAllFilters === 'function') {
        window.clearAllFilters(); // (Função hipotética do filters.js)
      }
      fetchAndRenderFestivals(false); // Limpará a tela
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    root.innerHTML = `<p style='text-align:center; padding: 2rem;'>Calculando Festmatch para "${
      e.target.options[e.target.selectedIndex].text
    }"...</p>`;

    try {
      // Etapa 1: Chamar a RPC
      const { data: festivalIds, error: rpcError } = await supabaseClient.rpc('get_festmatch_ids', {
        p_film_id: filmId,
      });

      if (rpcError) throw rpcError;

      // Etapa 2: Armazenar os IDs base do Match
      currentMatchIds = festivalIds || [];
      console.log('RPC retornou IDs do Match:', currentMatchIds);

      // Etapa 3: Disparar a renderização
      // Chamamos triggerFestivalSearch com 'null' para indicar que
      // os filtros da sidebar estão (inicialmente) limpos.
      window.triggerFestivalSearch(currentSidebarFilterIds);
    } catch (err) {
      console.error('Erro ao executar Festmatch RPC:', err);
      root.innerHTML =
        "<p style='text-align:center; padding: 2rem;'>Ocorreu um erro ao calcular os festivais compatíveis.</p>";
    }
  }

  // Ponto de entrada do Script
  onSupabaseReady(async () => {
    supabaseClient = window.supabase;

    if (root && !root.dataset.delegateAttached) {
      root.addEventListener('click', handleActionClick);
      root.dataset.delegateAttached = 'true';
    }

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        currentPage++;
        fetchAndRenderFestivals(true);
      });
    }

    if (filmSelect) {
      filmSelect.addEventListener('change', onFilmSelect);
    }

    // LÓGICA DE CARREGAMENTO INICIAL (Com "Guard" e "Trigger")
    const hasFilms = await loadUserFilms();

    if (hasFilms) {
      const urlParams = new URLSearchParams(window.location.search);
      const filmIdFromUrl = urlParams.get('film_id');

      if (filmIdFromUrl) {
        console.log(`Filme ID ${filmIdFromUrl} encontrado na URL. Carregando match...`);

        setTimeout(async () => {
          if (choicesInstance) {
            choicesInstance.setChoiceByValue(filmIdFromUrl);
          } else {
            filmSelect.value = filmIdFromUrl;
          }

          // Simula a seleção do usuário para disparar o onFilmSelect
          const event = new Event('change');
          filmSelect.dispatchEvent(event);
        }, 100);
      }
    }
  });
})();
