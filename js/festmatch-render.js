if (typeof renderFestivals !== 'function') {
  window.renderFestivals = function (festivals) {
    const root = document.querySelector('.board-content');
    if (!root) {
      console.error('❌ Elemento .board-content não encontrado!');
      return;
    }

    console.log('📋 Renderizando festivais (modo teste):', festivals);
    root.innerHTML = festivals.length
      ? festivals
          .map(
            (f) => `
              <div style="padding:8px;border-bottom:1px solid #ccc;">
                <strong>${f.festival_name}</strong>
                <br>
                País: ${f.countries?.country_name || f.country_id}
                <br>
                Deadline: ${f.deadline_early || '—'}
              </div>
            `
          )
          .join('')
      : "<p style='text-align:center;padding:2rem;'>Nenhum festival encontrado.</p>";
  };
}

// Fallbacks globais para evitar erros de undefined (garantem execução segura)
window.triggerFestivalSearch = window.triggerFestivalSearch || function () {};
window.resetFilters = window.resetFilters || function () {};

(function () {
  let supabaseClient = null;
  let festivalDataCache = new Map();
  let choicesInstance = null; // Para o dropdown de filmes

  console.log('✅ festmatch-render.js carregado com sucesso');

  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM completamente carregado - iniciando loadUserFilms()');
  });

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
  // FUNÇÕES DE RENDERIZAÇÃO E UTILITÁRIOS (COPIADAS DE festivals-render.js)
  // =================================================================

  function escapeHtml(s) {
    if (!s) return '';
    return s
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const year = date.getUTCFullYear();
      return `${day}/${month}/${year}`;
    } catch (e) {
      console.warn(`Formato de data inválido: ${dateStr}`);
      return dateStr;
    }
  }
  function renderTags(items, key, tagClass) {
    if (!items || items.length === 0) {
      return '<span class="tag-none">—</span>';
    }
    return items
      .map((item) => `<span class="${tagClass}">${escapeHtml(item[key])}</span>`)
      .join(' ');
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
    const filmTypes =
      f.film_types && f.film_types.length > 0
        ? f.film_types.map((ft) => escapeHtml(ft.type)).join(' e ')
        : 'N/A';

    const websiteUrl = f.official_website;
    const socialUrl = f.festival_social_link;

    // --- LÓGICA PARA O PAINEL DE DETALHES ---

    const premiereTypes = [
      { id: 1, text: 'World Premiere' },
      { id: 2, text: 'International Premiere' },
      { id: 3, text: 'Continental Premiere' },
      { id: 4, text: 'National Premiere' },
      { id: 5, text: 'Regional Premiere' },
      { id: 6, text: 'No Premiere Requirement' },
    ];
    const premiereListHtml = premiereTypes
      .map((p) => `<li class="${f.premiere_id === p.id ? 'active' : 'inactive'}">${p.text}</li>`)
      .join('');

    const formatFeeRange = (min, max) => {
      if (!min && !max) return 'N/A';
      if (min && !max) return `A partir de ${min}`;
      if (!min && max) return `Até ${max}`;
      if (min === max) return `${min}`;
      return `${min}-${max}`;
    };
    const feeEarlyRange = formatFeeRange(f.fee_early_min, f.fee_early_max);
    const feeLateRange = formatFeeRange(f.fee_late_min, f.fee_late_max);

    const moreInfoHtml = f.additional_info
      ? f.additional_info
          .split('\n')
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join('')
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
    const statusId = f.festival_status ? f.festival_status.id : 1;
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
    html += `<div class="festival-info-item"><img src="public/icons/icon-globe.svg" alt="" /><a href="${
      platformLink || '#'
    }" target="_blank" rel="noopener noreferrer">${platformName}</a></div>`;
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
    html += `<div class="tags-group"><span class="label-small">Categorias</span><div class="tags-box"><div class="tags-list">${renderTags(
      f.categories,
      'category',
      ''
    )}</div><img src="public/icons/icon-chevron-right.svg" alt="Seta" class="icon-chevron"></div></div>`;
    html += `<div class="tags-group"><span class="label-small">Gêneros</span><div class="tags-box"><div class="tags-list">${renderTags(
      f.genres,
      'genre',
      ''
    )}</div><img src="public/icons/icon-chevron-right.svg" alt="Seta" class="icon-chevron"></div></div>`;
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '<aside class="festival-actions">';
    html +=
      '<button class="action-btn action-btn--favorite" title="Favoritar"><img src="public/icons/icon-heart.svg" alt="Favoritar"/></button>';
    html += `<button class="action-btn" data-action="edit" data-id="${f.id}" title="Editar"><img src="public/icons/icon-edit.svg" alt="Editar" /></button>`;
    html += websiteUrl
      ? `<a href="${websiteUrl}" target="_blank" rel="noopener noreferrer" class="action-btn" title="Link Externo"><img src="public/icons/icon-external-link.svg" alt="Link Externo"/></a>`
      : `<button class="action-btn" title="Link Externo indisponível" disabled><img src="public/icons/icon-external-link.svg" alt="Link Externo"/></button>`;
    html += socialUrl
      ? `<a href="${socialUrl}" target="_blank" rel="noopener noreferrer" class="action-btn" title="Social Media"><img src="public/icons/icon-instagram.svg" alt="Instagram"/></a>`
      : `<button class="action-btn" title="Social Media indisponível" disabled><img src="public/icons/icon-instagram.svg" alt="Instagram"/></button>`;
    html +=
      '<button class="add-button" title="Adicionar ao meu filme"><img src="public/icons/icon-plus.svg" alt="Adicionar"/></button>';
    html += '</aside>';
    html += '</div>';
    html += '</summary>';

    html += '<div class="card-expanded-content">';
    html += `   <p class="description">${synopsis || 'Sinopse não disponível.'}</p>`;
    html += '   <div class="more-details-panel">';
    html += '       <div class="detail-section detail-premiere">';
    html +=
      '           <div class="detail-header"><img src="public/icons/icon-premiere.svg" alt="" /><h4>Premiere</h4></div>';
    html += `           <ul class="premiere-list">${premiereListHtml}</ul>`;
    html += '       </div>';
    html += '       <div class="detail-section detail-fee">';
    html +=
      '           <div class="detail-header"><img src="public/icons/icon_fest_currency.svg" alt=""/><h4>Fee</h4></div>';
    html += '           <div class="fee-table">';
    html += `               <div class="fee-row"><span class="fee-label">Early</span><span class="fee-value">${feeEarlyRange}</span></div>`;
    html += `               <div class="fee-row"><span class="fee-label">Late</span><span class="fee-value">${feeLateRange}</span></div>`;
    html += '           </div>';
    html +=
      '           <p class="fee-note">Verifique todas as categorias na página do festival.</p>';
    html += '       </div>';
    html += '       <div class="detail-section detail-more">';
    html +=
      '           <div class="detail-header"><img src="public/icons/icon_fest_more.svg" alt="" /><h4>Mais</h4></div>';
    html += `           <ul class="more-list">${moreInfoHtml}</ul>`;
    html += '       </div>';
    html += '   </div>';
    html += '</div>';

    html += '</details>';
    return html;
  }

  function handleActionClick(e) {
    const btn = e.target.closest('button[data-action="edit"]');
    if (!btn) return;

    const id = parseInt(btn.dataset.id, 10);
    if (!id || typeof window.populateFormForEdit !== 'function') return;

    const festivalObject = festivalDataCache.get(id);

    if (festivalObject) {
      e.preventDefault();
      console.log(
        `Render: Pegando dados do cache para o festival ID: ${id}. Populando formulário...`
      );
      window.populateFormForEdit(festivalObject);
    } else {
      console.error(`Festival com ID ${id} não encontrado no cache.`);
    }
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

          // ### CHAMADA DA FUNÇÃO INSERIDA ###
          wrapper.innerHTML = createFestivalCardHTML(festivalData);

          root.appendChild(wrapper);
        });

        if (data.length < PAGE_SIZE) {
          noMoreResults = true;
        }

        // Chamadas de inicialização (copiadas de festivals-render.js)
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
    console.log('🎬 Executando loadUserFilms()...');

    const filmSelect = document.getElementById('film-select');
    const emptyState = document.querySelector('.empty-state');

    if (!filmSelect) {
      console.error('❌ Elemento <select id="film-select"> não encontrado.');
      return;
    }

    try {
      console.log('Iniciando loadUserFilms()...');

      // 1️⃣ Buscar o ID do perfil do usuário logado
      const { data: profileId, error: rpcError } = await supabaseClient.rpc('get_my_profile_id');
      if (rpcError || !profileId) {
        throw new Error('Não foi possível obter o ID do perfil do usuário.');
      }

      console.log(`Perfil ID (int) obtido: ${profileId}`);

      // 2️⃣ Buscar os filmes vinculados a esse perfil
      const { data: films, error: filmError } = await supabaseClient
        .from('films')
        .select('id, title')
        .eq('owner_profile_id', profileId)
        .order('title', { ascending: true });

      if (filmError) throw filmError;

      // 3️⃣ Verificar se o usuário tem filmes
      if (!films || films.length === 0) {
        console.warn('Nenhum filme encontrado para este usuário.');
        if (emptyState) {
          emptyState.innerHTML = `
          <p>Você precisa cadastrar pelo menos um filme para usar o FestMatch.</p>
          <a href="/myfilms.html" class="btn-primary">Cadastrar meu primeiro filme</a>`;
          emptyState.style.display = 'block';
        }
        filmSelect.style.display = 'none';
        return;
      }

      // 4️⃣ Exibir e popular o dropdown nativo de filmes
      filmSelect.style.display = 'block';
      filmSelect.innerHTML = ''; // limpa o select

      // Adiciona a primeira opção “Selecione...”
      const optDefault = document.createElement('option');
      optDefault.value = '';
      optDefault.textContent = 'Selecione um filme...';
      optDefault.selected = true;
      optDefault.disabled = true;
      filmSelect.appendChild(optDefault);

      // Adiciona os filmes
      films.forEach((film) => {
        const opt = document.createElement('option');
        opt.value = film.id;
        opt.textContent = film.title;
        filmSelect.appendChild(opt);
      });

      console.log('✅ Dropdown de filmes populado com sucesso.');
    } catch (err) {
      console.error('❌ Erro crítico ao carregar filmes do usuário:', err.message);
      if (emptyState) {
        emptyState.innerHTML =
          '<p>Ocorreu um erro ao carregar seus filmes. Tente recarregar a página.</p>';
        emptyState.style.display = 'block';
      }
    }
  }

  async function onFilmSelect(e) {
  const filmId = e.target.value ? parseInt(e.target.value, 10) : null;

  // Oculta o botão de carregar mais, se existir
  if (loadMoreBtn) loadMoreBtn.style.display = 'none';

  // Caso nenhum filme tenha sido selecionado
  if (!filmId) {
    console.log('🎬 Nenhum filme selecionado — voltando para modo Festivais');
    // Volta o contexto global para modo "Festivais"
    if (typeof window.setFilterContext === 'function') {
      window.setFilterContext({ mode: 'festivals', filmId: null });
    }

    // Reseta filtros (limpa UI e resultados)
    if (typeof window.resetFilters === 'function') {
      window.resetFilters();
    }

    // Limpa tela de festivais
    if (typeof fetchAndRenderFestivals === 'function') {
      fetchAndRenderFestivals(false);
    }

    return;
  }

  // Se um filme foi selecionado
  if (emptyState) emptyState.style.display = 'none';

  root.innerHTML = `
    <p style='text-align:center; padding: 2rem;'>
      Calculando FestMatch para "<strong>${
        e.target.options[e.target.selectedIndex].text
      }</strong>"...
    </p>
  `;

  try {
    // Etapa 1: Chama a RPC get_festmatch_ids
    const { data: festivalIds, error: rpcError } = await supabaseClient.rpc(
      'get_festmatch_ids',
      { p_film_id: filmId }
    );
    if (rpcError) throw rpcError;

    // Etapa 2: Verifica retorno
    if (!festivalIds || festivalIds.length === 0) {
      console.warn('Nenhum festival compatível encontrado.');
      root.innerHTML = `
        <p style='text-align:center; padding: 2rem;'>
          Nenhum festival compatível encontrado para este filme.
        </p>
      `;
      return;
    }

    // Etapa 3: Extrai apenas IDs
    currentMatchIds = festivalIds.map((item) => item.festival_id);
    console.log('🎯 RPC retornou IDs do Match:', currentMatchIds);

    // Etapa 4: Define contexto global para modo FestMatch
    if (typeof window.setFilterContext === 'function') {
      window.setFilterContext({ mode: 'festmatch', filmId });
    }

    // Etapa 5: Dispara os filtros ativos aplicados à lista de matches
    if (typeof window.triggerFestivalSearch === 'function') {
      window.triggerFestivalSearch();
    }

    // Etapa 6: Busca e renderiza detalhes dos festivais correspondentes
    const { data: festivalDetails, error: fetchError } = await supabaseClient
      .from('festivals')
      .select(
        'id, festival_name, country_id, deadline_early, fee_early_max_amount, festival_status(*), festival_edition(*), countries(*), month_held:months!festivals_month_held_id_fkey(*), month_opening:months!festivals_month_opening_id_fkey(*), platforms(*), fee_status(*), festival_qualifiers_assignments(qualifiers(*)), festival_categories_assignments(categories(*)), festival_genres_assignments(genres(*)), festival_film_types(film_types(*))'
      )
      .in('id', currentMatchIds)
      .order('deadline_early', { ascending: true });

    if (fetchError) {
      console.error('Erro ao buscar detalhes dos festivais:', fetchError);
      renderFestivals([]);
      return;
    }

    console.log(`✅ ${festivalDetails.length} festivais carregados com sucesso`);
    renderFestivals(festivalDetails);
  } catch (err) {
    console.error('❌ Erro ao executar FestMatch RPC:', err);
    root.innerHTML = `
      <p style='text-align:center; padding: 2rem;'>
        Ocorreu um erro ao calcular os festivais compatíveis.
      </p>
    `;
  }
}


    try {
      // Atualiza o contexto para modo FestMatch com o ID do filme
      if (typeof window.setFilterContext === 'function') {
        window.setFilterContext({ mode: 'festmatch', filmId });
      }

      // Dispara o filtro (agora ele chamará a função filter_festivals_match no Supabase)
      if (typeof window.triggerFestivalSearch === 'function') {
        console.log('🚀 Executando filtro FestMatch via triggerFestivalSearch()...');
        window.triggerFestivalSearch();
      } else {
        console.warn('⚠️ Função triggerFestivalSearch não encontrada — verifique filters.js.');
      }
    } catch (err) {
      console.error('❌ Erro ao executar FestMatch:', err);
      root.innerHTML = `
      <p style='text-align:center; padding: 2rem;'>
        Ocorreu um erro ao calcular os festivais compatíveis.
      </p>
    `;
    }
  }


  // Ponto de entrada do Script
  onSupabaseReady(async () => {
    supabaseClient = window.supabase;

    // Listeners de clique
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

    // --- LÓGICA DE CARREGAMENTO INICIAL (CORRIGIDA) ---

    // 1. Popula o dropdown com todos os filmes do usuário
    //    (E executa o "Guard" se ele não tiver filmes)
    const hasFilms = await loadUserFilms(); //

    // 2. Se o usuário tem filmes, procuramos o "Trigger" da URL
    if (hasFilms) {
      const urlParams = new URLSearchParams(window.location.search);
      const filmIdFromUrl = urlParams.get('film_id');

      if (filmIdFromUrl) {
        console.log(`Filme ID ${filmIdFromUrl} encontrado na URL. Setando valor...`);

        // Damos um pequeno delay para garantir que o Choices.js renderizou
        setTimeout(() => {
          if (choicesInstance) {
            // APENAS setamos o valor.
            // O 'change' event listener ('onFilmSelect')
            // será disparado automaticamente pelo Choices.js.
            choicesInstance.setChoiceByValue(filmIdFromUrl);
          } else {
            // Fallback caso o Choices.js não exista
            filmSelect.value = filmIdFromUrl;
            // Dispara manualmente SÓ SE o choices falhar
            filmSelect.dispatchEvent(new Event('change'));
          }
        }, 100); // 100ms de delay
      }
    }
  });
})();
