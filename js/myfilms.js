// js/myfilms.js (Revisão 7.1 - Human-Readable / Lista de Filmes)

const onSupabaseReady = (callback) => {
  const interval = setInterval(() => {
    if (window.supabase) {
      clearInterval(interval);
      callback(window.supabase);
    }
  }, 50);
};

onSupabaseReady((supabase) => {
  console.log('myfilms.js: Supabase está pronto. Iniciando a lógica da página.');

  // ===================================================================
  // ESTADO DA APLICAÇÃO E SELETORES DO DOM
  // ===================================================================
  let credits = [];
  let moreLinks = [];
  let collaborators = [];
  let currentlyEditingCreditId = null;
  let currentlyEditingLinkId = null;
  let posterFileForUpload = null;
  let croppieInstance = null;
  let choicesInstances = {};
  let myFilms = []; // <-- NOVO: Armazena os filmes carregados
  let isEditing = false; // <-- NOVO: Controla se estamos editando ou criando
  let currentEditingFilmId = null; // <-- NOVO: ID do filme em edição

  // Estado do Perfil do Usuário
  let currentAuthUserId = null;
  let currentProfileId = null;
  let currentProfileName = 'Meu Perfil';
  let currentProfileRole = null;
  let currentProfilePlan = null;
  let currentCurrencyCode = 'USD'; // <-- NOVO: Padrão, será atualizado

  // --- Seletores do Formulário ---
  const filmForm = document.getElementById('film-form');
  const formPanelWrapper = document.querySelector('.form-panel-wrapper'); // <-- NOVO
  const formTitle = document.querySelector('.form-film-title'); // <-- NOVO
  // Buscamos o botão de cancelar do wizard, não o antigo
  const btnCancelForm = document.getElementById('btn-prev-step'); // <-- ATUALIZADO (usamos o 'Voltar' como cancelar no Passo 1)

  // ... (seletores de campos do formulário) ...
  const posterUploadBtn = document.getElementById('poster-upload-btn');
  const posterUploadInput = document.getElementById('poster-upload');
  const posterPreviewContainer = document.getElementById('poster-preview');
  const posterPreviewImage = posterPreviewContainer
    ? posterPreviewContainer.querySelector('img')
    : null;
  const creditNameInput = document.getElementById('credit-name');
  const creditRoleSelect = document.getElementById('credit_role_id');
  const addCreditBtn = document.getElementById('add-credit-btn');
  const creditsList = document.getElementById('credits-list');
  const creditsListTitle = document.getElementById('credits-list-title');
  const linkNameInput = document.getElementById('link-name');
  const externalLinkInput = document.getElementById('external-link');
  const addLinkBtn = document.getElementById('add-link-btn');
  const linksList = document.getElementById('links-list');
  const linksListTitle = document.getElementById('links-list-title');
  const originalAddCreditIcon = addCreditBtn ? addCreditBtn.innerHTML : '';
  const originalAddLinkIcon = addLinkBtn ? addLinkBtn.innerHTML : '';
  const inviteNameInput = document.getElementById('invite-name');
  const inviteEmailInput = document.getElementById('invite-email');
  const addInviteBtn = document.getElementById('add-invite-btn');
  const invitesList = document.getElementById('invites-list');
  const invitesListTitle = document.getElementById('invites-list-title');
  const originalAddInviteIcon = addInviteBtn ? addInviteBtn.innerHTML : '';
  const producerPersonSelect = document.getElementById('producer_person_id');
  const distributionLeadPersonSelect = document.getElementById('distribution_lead_person_id');
  const distributorDisplayGroup = document.getElementById('distributor-display-group');
  const distributorNameDisplay = document.getElementById('distributor_name_display');
  const distributorProfileIdInput = document.getElementById('distributor_profile_id');
  const distributorSelectGroup = document.getElementById('distributor-select-group');
  const distributorFieldsWrapper = document.getElementById('distributor-fields-wrapper');
  const invitesWrapper = document.getElementById('invites-wrapper');

  // --- Seletores da Página ---
  const btnNewFilm = document.getElementById('btn-new-film'); // <-- NOVO
  const myFilmsListContainer = document.getElementById('my-films-list-container'); // <-- NOVO

  // ===================================================================
  // ESTADO E SELETORES DO WIZARD (FORMULÁRIO MULTI-ETAPAS)
  // ===================================================================
  let currentStep = 1;
  const totalSteps = 5;
  const btnPrevStep = document.getElementById('btn-prev-step');
  const btnNextStep = document.getElementById('btn-next-step');
  const btnSubmitFilm = document.getElementById('btn-submit-film');
  const allSteps = document.querySelectorAll('.form-step');
  const allProgressSteps = document.querySelectorAll('.progress-bar-step');

  // ===================================================================
  // FUNÇÃO PRINCIPAL: SUBMISSÃO DO FORMULÁRIO (ATUALIZADA)
  // ===================================================================
  async function handleFilmSubmit(event) {
    event.preventDefault();

    if (!validateStep(currentStep)) {
      alert('Por favor, corrija os erros no passo atual antes de salvar.');
      return;
    }

    const submitButton = btnSubmitFilm;
    submitButton.disabled = true;
    submitButton.textContent = 'Salvando...';

    try {
      if (!currentProfileId || !currentAuthUserId) {
        await populateProfileSelects();
        if (!currentProfileId || !currentAuthUserId)
          throw new Error('Não foi possível identificar o perfil completo do usuário.');
      }
      const ownerIdToSave = currentProfileId;
      const ownerUuidToSave = currentAuthUserId;

      let posterThumbnailUrl = null;
      if (posterFileForUpload) {
        const fileExt = 'jpeg';
        const fileName = `${ownerUuidToSave}-${Date.now()}.${fileExt}`;
        const filePath = `${ownerUuidToSave}/${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from('film-posters')
          .upload(filePath, posterFileForUpload);
        if (uploadError) throw new Error(`Falha no upload do cartaz: ${uploadError.message}`);
        const { data: urlData } = supabase.storage.from('film-posters').getPublicUrl(filePath);
        posterThumbnailUrl = urlData.publicUrl;
      }

      const currencySelect = document.getElementById('currency_id');
      const selectedOption = currencySelect.options[currencySelect.selectedIndex];
      const localCurrencyCode = selectedOption.dataset.code;

      const formData = new FormData(filmForm);
      const filmObject = {};
      for (const [key, value] of formData.entries()) {
        if (value && value !== '') filmObject[key] = value;
      }

      if (filmObject.completion_date) {
        try {
          const parts = filmObject.completion_date.split('/');
          if (parts.length === 3) {
            const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
            filmObject.completion_date = isoDate;
          } else {
            throw new Error('Formato de data inesperado.');
          }
        } catch (e) {
          console.error('Erro ao formatar data:', e, filmObject.completion_date);
          throw new Error(`Data de finalização inválida: ${filmObject.completion_date}`);
        }
      }

      if (filmObject.distribution_budget_amount && localCurrencyCode) {
        const localAmount = parseFloat(filmObject.distribution_budget_amount);

        if (localCurrencyCode === 'USD') {
          // Se a moeda é USD, o valor local É o valor USD.
          filmObject.distribution_budget_amount = localAmount; // (ex: 100)
          filmObject.distribution_budget_usd = localAmount; // (ex: 100)
        } else {
          // Se for BRL (ex: 100)
          const rate = await window.CurrencyService.getExchangeRate(supabase, localCurrencyCode);
          if (rate && rate > 0) {
            const usdAmount = localAmount / rate;

            // CORREÇÃO: Atribui os valores às colunas corretas
            filmObject.distribution_budget_amount = localAmount; // Mantém 100 (local)
            filmObject.distribution_budget_usd = Math.round(usdAmount); // Salva 19 (USD)

            console.log(
              `Conversão de Orçamento: ${localAmount} ${localCurrencyCode} (Salvo em '..._amount') -> ${filmObject.distribution_budget_usd} USD (Salvo em '..._usd') (Taxa: ${rate})`
            );
          } else {
            // Fallback (salva o valor local e nulo no USD)
            console.warn(
              `Não foi possível converter o orçamento para USD. Taxa para ${localCurrencyCode} não encontrada. Salvando valor local.`
            );
            filmObject.distribution_budget_amount = localAmount;
            filmObject.distribution_budget_usd = null;
          }
        }
      }

      if (filmObject.duration_in_seconds) {
        const parts = filmObject.duration_in_seconds.split(':');
        const minutes = parseInt(parts[0], 10) || 0;
        const seconds = parseInt(parts[1], 10) || 0;
        filmObject.duration_in_seconds = minutes * 60 + seconds;
      }

      filmObject.owner_profile_id = ownerIdToSave;
      if (posterThumbnailUrl) filmObject.poster_thumbnail_url = posterThumbnailUrl;
      filmObject.is_debut = filmObject.is_debut === 'true';
      filmObject.is_student_project = filmObject.is_student_project === 'true';

      if (currentProfileRole === 'distribuidora') {
        filmObject.distributor_profile_id = ownerUuidToSave;
        if (distributorProfileIdInput && distributorProfileIdInput.value) {
          filmObject.distributor_profile_id = distributorProfileIdInput.value;
        }
      } else {
        filmObject.distributor_profile_id = ownerUuidToSave;
      }

      [
        'poster_thumbnail',
        'credit_name',
        'credit_role_id',
        'link_name',
        'external_link',
        'category_ids',
        'genre_ids',
        'invite_name',
        'invite_email',
        'distributor_profile_id_fallback',
      ].forEach((key) => delete filmObject[key]);

      console.log("Objeto a ser salvo em 'films':", JSON.stringify(filmObject, null, 2));

      // ======================================================
      // INSERIR vs ATUALIZAR (Lógica de Edição)
      // ======================================================
      let newFilmId = null;
      if (isEditing && currentEditingFilmId) {
        // MODO DE ATUALIZAÇÃO
        console.log(`Atualizando filme ID: ${currentEditingFilmId}`);
        const { data, error } = await supabase
          .from('films')
          .update(filmObject)
          .eq('id', currentEditingFilmId)
          .select('id')
          .single();

        if (error) throw new Error(`Falha ao atualizar o filme: ${error.message}`);
        newFilmId = data.id;

        // Limpar dados relacionais antigos antes de salvar os novos
        await supabase.from('film_category_assignments').delete().eq('film_id', newFilmId);
        await supabase.from('film_genre_assignments').delete().eq('film_id', newFilmId);
        await supabase.from('film_credits').delete().eq('film_id', newFilmId);
        await supabase.from('film_invitations').delete().eq('film_id', newFilmId);
      } else {
        // MODO DE CRIAÇÃO
        const { data: newFilm, error: filmInsertError } = await supabase
          .from('films')
          .insert([filmObject])
          .select()
          .single();
        if (filmInsertError) {
          console.error('Erro detalhado do Supabase ao inserir filme:', filmInsertError);
          let userMessage = `Falha ao salvar o filme: ${filmInsertError.message}`;
          if (filmInsertError.message.includes('violates foreign key constraint')) {
            userMessage +=
              '\nVerifique se os campos obrigatórios (como Produtor/Responsável) foram selecionados.';
          }
          throw new Error(userMessage);
        }
        if (!newFilm && !filmInsertError) {
          console.warn('Filme inserido, mas RLS impediu o SELECT de retorno.');
        }
        if (newFilm) {
          newFilmId = newFilm.id;
        } else {
          const { data: latestFilm, error: fetchError } = await supabase
            .from('films')
            .select('id')
            .eq('owner_profile_id', ownerIdToSave)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (fetchError || !latestFilm)
            throw new Error('Falha ao obter ID do filme após a criação.');
          newFilmId = latestFilm.id;
        }
      }
      console.log('ID do filme salvo/recuperado:', newFilmId);

      // Salva Categorias e Gêneros
      if (choicesInstances.category_ids) {
        const categoryIds = choicesInstances.category_ids.getValue(true);
        if (categoryIds && categoryIds.length > 0) {
          const categoriesToInsert = categoryIds.map((id) => ({
            film_id: newFilmId,
            category_id: id,
          }));
          await supabase.from('film_category_assignments').insert(categoriesToInsert);
        }
      }
      if (choicesInstances.genre_ids) {
        const genreIds = choicesInstances.genre_ids.getValue(true);
        if (genreIds && genreIds.length > 0) {
          const genresToInsert = genreIds.map((id) => ({ film_id: newFilmId, genre_id: id }));
          await supabase.from('film_genre_assignments').insert(genresToInsert);
        }
      }
      // Salva Créditos
      if (credits.length > 0) {
        const validCredits = credits.filter((c) => c.personId);
        if (validCredits.length > 0) {
          const creditsToInsert = validCredits.map((credit) => ({
            film_id: newFilmId,
            person_id: credit.personId,
            role_id: credit.roleId,
          }));
          const { error: creditError } = await supabase
            .from('film_credits')
            .insert(creditsToInsert);
          if (creditError)
            console.warn('Filme salvo, mas falha ao salvar créditos:', creditError.message);
        }
      }
      // Salva Colaboradores (Convites)
      if (collaborators.length > 0) {
        const invitesToInsert = collaborators.map((invite) => ({
          film_id: newFilmId,
          invited_by_profile_id: ownerUuidToSave,
          invited_email: invite.email,
          invited_name: invite.name,
          status: 'pending',
        }));
        const { error: inviteError } = await supabase
          .from('film_invitations')
          .insert(invitesToInsert);
        if (inviteError)
          console.warn('Filme salvo, mas falha ao salvar convites:', inviteError.message);
      }

      alert(`Filme ${isEditing ? 'atualizado' : 'salvo'} com sucesso!`);

      showFormPanel(false); // Esconde o painel
      await loadAndRenderFilms(); // Recarrega a lista de filmes
    } catch (error) {
      console.error('ERRO GERAL AO SALVAR O FILME:', error);
      alert(`Ocorreu um erro ao salvar:\n${error.message}`);
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar Filme';
      }
    }
  }

  // ===================================================================
  // NOVO: LÓGICA DE RENDERIZAÇÃO DE CARDS (ETAPA 1)
  // ===================================================================

  /**
   * Busca os filmes (via RPC), busca as taxas necessárias e os renderiza na página.
   */
  async function loadAndRenderFilms() {
    if (!myFilmsListContainer) return;
    myFilmsListContainer.innerHTML = '<p>Carregando filmes...</p>';

    try {
      // 1. Busca os dados dos filmes pela RPC (agora inclui film_currency_code)
      const { data: filmsData, error: rpcError } = await supabase.rpc('get_my_films_list');
      if (rpcError) throw rpcError;

      myFilms = filmsData || []; // Armazena os dados globalmente
      console.log('Filmes carregados:', myFilms);

      if (myFilms.length === 0) {
        myFilmsListContainer.innerHTML = '<p>Nenhum filme cadastrado ainda.</p>';
        return;
      }

      // 2. Coleta todas as moedas ÚNICAS presentes nos filmes carregados
      const uniqueCurrencyCodes = [
        ...new Set(myFilms.map((film) => film.film_currency_code).filter((code) => code)),
      ];
      if (!uniqueCurrencyCodes.includes('USD')) {
        uniqueCurrencyCodes.push('USD'); // Garante que temos USD
      }
      console.log('Moedas únicas nos filmes:', uniqueCurrencyCodes);

      // 3. Busca TODAS as taxas de câmbio necessárias DE UMA VEZ
      const ratesMap = {};
      for (const code of uniqueCurrencyCodes) {
        // Não busca taxa para USD (é sempre 1)
        if (code === 'USD') {
          ratesMap[code] = 1;
        } else {
          // Busca a taxa e armazena no mapa
          ratesMap[code] = await window.CurrencyService.getExchangeRate(supabase, code);
          if (ratesMap[code] === null) {
            console.warn(`Taxa não encontrada para ${code}, usando fallback 1.`);
            ratesMap[code] = 1; // Fallback se a taxa falhar
          }
        }
      }
      console.log('Taxas de câmbio carregadas:', ratesMap);

      // 4. Renderiza os cards, passando a taxa e o código corretos para CADA filme
      const cardsHtml = myFilms
        .map((film) => {
          const filmCurrencyCode = film.film_currency_code || 'USD'; // Usa USD se não houver código
          const filmRate = ratesMap[filmCurrencyCode] || 1; // Pega a taxa do mapa
          return renderFilmCard(film, filmRate, filmCurrencyCode); // Passa os dados específicos do filme
        })
        .join('');

      myFilmsListContainer.innerHTML = cardsHtml;
    } catch (error) {
      console.error('Erro ao carregar lista de filmes:', error.message);
      myFilmsListContainer.innerHTML = "<p style='color:red;'>Erro ao carregar filmes.</p>";
    }
  }

  /**
   * Gera o HTML para um único card de filme.
   * @param {object} film - O objeto do filme vindo da RPC (inclui film_currency_code).
   * @param {number} rate - A taxa de câmbio (USD -> Moeda DO FILME).
   * @param {string} currencyCode - O código da moeda DO FILME (ex: "BRL").
   */
  function renderFilmCard(film, rate, currencyCode) {
    // --- Formatação de Dados ---
    const { formatCurrency } = window.CurrencyService;
    // Não precisa mais de fallback aqui, pois loadAndRenderFilms já garante rate=1 e code='USD'

    // --- Orçamento de Distribuição (Convertido para moeda do filme) ---
    const distBudget = formatCurrency(film.distribution_budget_amount, currencyCode);

    // --- Placeholders (Formatados na moeda do filme) ---
    const investedAmount = formatCurrency(0 * rate, currencyCode);
    const revenueAmount = formatCurrency(0 * rate, currencyCode);
    const expenseAmount = formatCurrency(0 * rate, currencyCode);

    // --- Duração ---
    const duration = film.duration_in_seconds
      ? `${Math.floor(film.duration_in_seconds / 60)}'`
      : 'N/A';

    // --- Data ---
    let completionDate = 'N/A';
    if (film.completion_date) {
      try {
        completionDate = new Date(film.completion_date + 'T00:00:00').toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
        }); // <-- Mudado para 'en-US' e ordem padrão
        completionDate = completionDate.replace('.', ',');
      } catch (e) {
        console.warn('Data inválida:', film.completion_date);
      }
    }

    // --- Poster ---
    const posterUrl = film.poster_thumbnail_url || 'public/images/film-poster.png';

    // --- Template HTML ---
    return `
        <div class="film-card-container">
          <div class="poster-wrapper">
            <div class="image-wrapper-poster">
              <img src="${posterUrl}" alt="Pôster do filme ${film.title}" />
            </div>
          </div>
          <div class="board-content">
            <div class="festival-item-wrapper">
              <details class="festival-accordion">
                <summary class="festival-summary">
                  <div class="festival-card-top">
                    <div class="film-card">
                      <header class="festival-title-section">
                        <div class="film-title-wrapper">
                          <h3 class="film-title">${film.title || 'Título não encontrado'}</h3>
                          <div class="film-country">
                            ${
                              film.country_name
                                ? `<img src="${
                                    film.flag_icon_url || 'public/icons/flag.svg'
                                  }" alt="Bandeira ${
                                    film.country_name
                                  }" class="flag-icon" /><span>${film.country_name}</span>`
                                : ''
                            }
                          </div>
                        </div>
                      </header>
                      <div class="festival-card-header">
                        <div class="film-col film-col-info">
                          <div class="film-info-item">
                            <img src="public/icons/timer-film.svg" alt="Duração" />
                            <span class="duration">${duration}</span>
                          </div>
                          <div class="film-info-item">
                            <img src="public/icons/rocket.svg" alt="Conclusão" />
                            <span>${completionDate}</span>
                          </div>
                          <div class="film-info-item">
                            <img src="public/icons/type-film.svg" alt="Tipo" />
                            <span>${film.film_type_name || 'N/A'}</span>
                          </div>
                          <div class="film-info-item">
                            <img src="public/icons/tag-film.svg" alt="Gênero" />
                            <span>${film.genres_list || 'N/A'}</span>
                          </div>
                        </div>
                        <div class="account-board">
                          <div class="account-board-head">
                            <div class="account-board-section">
                              <span class="account-board-label-green">${distBudget}</span><br>
                              <span class="account-board-desc">orçamento (dist.)</span>
                            </div>
                            <div class="account-board-section">
                              <span class="account-board-label-yellow">${investedAmount}</span><br>
                              <span class="account-board-desc">investido</span>
                            </div>
                          </div>
                          <div class="account-board-divider"></div>
                          <div class="account-board-values">
                            <div class="account-board-value-green">${revenueAmount}</div>
                            <div class="account-board-value-red">${expenseAmount}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div class="film-stats-panel">
                      <div class="stat-item">
                        <img src="public/icons/icon-film-ticket.svg" alt="Inscrições" class="stat-icon">
                        <span class="stat-value">${film.stats_submissions}</span>
                        <span class="stat-label">inscrições</span>
                      </div>
                      <div class="stat-item">
                        <img src="public/icons/icon-film-selected.svg" alt="Seleções" class="stat-icon">
                        <span class="stat-value">${film.stats_selections}</span>
                        <span class="stat-label">seleções</span>
                      </div>
                      <div class="stat-item">
                        <img src="public/icons/icon-film-indicated.svg" alt="Indicações" class="stat-icon">
                        <span class="stat-value">${film.stats_nominations}</span>
                        <span class="stat-label">indicações</span>
                      </div>
                      <div class="stat-item">
                        <img src="public/icons/icon-film-awards.svg" alt="Premiações" class="stat-icon">
                        <span class="stat-value">${film.stats_awards}</span>
                        <span class="stat-label">premiações</span>
                      </div>
                    </div>
                    <aside class="film-actions">
                      <div class="btn-control">
                        <button class="action-btn btn-edit-film" title="Editar" data-film-id="${
                          film.id
                        }">
                          <img src="public/icons/icon-edit.svg" alt="Editar" style="pointer-events: none;"/>
                        </button>
                        <button class="action-btn" title="Link Externo" ${
                          film.official_site_link
                            ? `onclick="window.open('${film.official_site_link}', '_blank')"`
                            : 'disabled'
                        }>
                          <img src="public/icons/icon-external-link.svg" alt="Link Externo" />
                        </button>
                        <button class="action-btn" title="Instagram" ${
                          film.social_media_link
                            ? `onclick="window.open('${film.social_media_link}', '_blank')"`
                            : 'disabled'
                        }>
                          <img src="public/icons/icon-instagram.svg" alt="Instagram" />
                        </button>
                      </div>
                      <button class="rocket-btn" title="Adicionar ao meu filme">
                        <img src="public/icons/rocket-btn.svg" alt="Adicionar" />
                      </button>
                    </aside>
                  </div>
                </summary>
              </details>
            </div>
          </div>
        </div>
        `;
  }

  // ===================================================================
  // NOVO: LÓGICA DE VISIBILIDADE DO FORMULÁRIO (ETAPA 2)
  // ===================================================================

  function resetForm() {
    credits = [];
    moreLinks = [];
    collaborators = [];

    renderCredits();
    renderLinks();
    renderInvites();
    updateCreditRoleSelects();

    if (choicesInstances.category_ids) choicesInstances.category_ids.setValue([]);
    if (choicesInstances.genre_ids) choicesInstances.genre_ids.setValue([]);

    if (posterPreviewImage) posterPreviewImage.src = '';
    if (posterPreviewContainer) posterPreviewContainer.style.display = 'none';
    posterFileForUpload = null;
    if (croppieInstance) {
      croppieInstance.destroy();
      croppieInstance = null;
    }

    document.getElementById('production_budget_range_id').innerHTML =
      '<option value="">Escolha a moeda primeiro</option>';
    document.getElementById('production_budget_range_id').disabled = true;

    const currencySelect = document.getElementById('currency_id');
    const budgetSuffix = document.getElementById('distribution-currency-suffix');
    const selectedOption = currencySelect.options[currencySelect.selectedIndex];
    if (budgetSuffix) budgetSuffix.textContent = selectedOption.dataset.code || 'USD';

    currentStep = 1;
    showStep(1);
  }

  /**
   * Preenche o formulário com os dados de um filme para edição. (v3 - Reinit Choices)
   * @param {object} filmData - O objeto do filme vindo da RPC.
   */
  // ===================================================================
  // SUBSTITUA SUA FUNÇÃO INTEIRA POR ESTA
  // ===================================================================
  async function populateFormForEdit(filmData) {
    console.log('Populando formulário para edição (base):', filmData);
    if (!filmForm || !filmData.id) return;

    let fullFilmData;
    const filmId = filmData.id;

    // --- Parte 1: Buscar o registro COMPLETO ---
    try {
      const { data: fetchedFilm, error: filmFetchError } = await supabase
        .from('films')
        .select('*') // Seleciona TODAS as colunas
        .eq('id', filmId)
        .single();

      if (filmFetchError) {
        throw new Error(`Falha ao buscar dados completos do filme: ${filmFetchError.message}`);
      }
      if (!fetchedFilm) {
        throw new Error(`Filme com ID ${filmId} não encontrado no banco.`);
      }
      fullFilmData = fetchedFilm; // Armazena o objeto completo
      console.log('Dados completos do filme buscados:', fullFilmData);
    } catch (fetchError) {
      console.error('Erro ao buscar dados completos do filme:', fetchError);
      alert(`Não foi possível carregar os dados do filme: ${fetchError.message}`);
      return; // Interrompe a execução
    }

    // --- Parte 2: Popular o Formulário ---
    try {
      // --- Campos de Texto e Selects Simples (USANDO fullFilmData) ---
      filmForm.querySelector('#title').value = fullFilmData.title || '';
      filmForm.querySelector('#synopsis').value = fullFilmData.synopsis || '';
      filmForm.querySelector('#director_bio').value = fullFilmData.director_bio || '';
      filmForm.querySelector('#director_statement').value = fullFilmData.director_statement || '';
      filmForm.querySelector('#media_link').value = fullFilmData.media_link || '';
      filmForm.querySelector('#trailer_link').value = fullFilmData.trailer_link || '';
      filmForm.querySelector('#official_site_link').value = fullFilmData.official_site_link || '';
      filmForm.querySelector('#social_media_link').value = fullFilmData.social_media_link || '';
      filmForm.querySelector('#poster_profile_url').value = fullFilmData.poster_profile_url || '';
      filmForm.querySelector('#still_images_link').value = fullFilmData.still_images_link || '';

      filmForm.querySelector('#is_debut').value = fullFilmData.is_debut ? 'true' : 'false';
      filmForm.querySelector('#is_student_project').value = fullFilmData.is_student_project
        ? 'true'
        : 'false';

      filmForm.querySelector('#country_id').value = fullFilmData.country_id || '';
      filmForm.querySelector('#film_type_id').value = fullFilmData.film_type_id || '';
      filmForm.querySelector('#language_id').value = fullFilmData.language_id || '';
      filmForm.querySelector('#aspect_ratio_id').value = fullFilmData.aspect_ratio_id || '';
      filmForm.querySelector('#color_mode_id').value = fullFilmData.color_mode_id || '';
      filmForm.querySelector('#recording_format_id').value = fullFilmData.recording_format_id || '';

      // --- Data (Flatpickr) ---
      const completionDateInput = filmForm.querySelector('#completion_date');
      const fpInstance = completionDateInput._flatpickr;
      if (fpInstance) {
        fpInstance.setDate(fullFilmData.completion_date, false);
      }

      // --- Duração (IMask) ---
      if (fullFilmData.duration_in_seconds) {
        const totalSeconds = fullFilmData.duration_in_seconds;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const formattedDuration = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(
          2,
          '0'
        )}`;
        filmForm.querySelector('#duration_in_seconds').value = formattedDuration;
        // Re-inicializa a máscara (se necessário, embora o 'value' deva ser suficiente)
        initializeInputMasks();
      } else {
        filmForm.querySelector('#duration_in_seconds').value = '';
      }

      // --- Moeda e Orçamentos (Lógica Dependente) ---
      const currencySelect = filmForm.querySelector('#currency_id');
      const budgetRangeSelect = filmForm.querySelector('#production_budget_range_id');

      if (fullFilmData.currency_id) {
        currencySelect.value = fullFilmData.currency_id;
        // Dispara o 'change' para carregar as faixas
        currencySelect.dispatchEvent(new Event('change'));

        // Aguarda a UI atualizar as faixas
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Agora seta a faixa de orçamento
        budgetRangeSelect.value = fullFilmData.production_budget_range_id || '';

        // CORREÇÃO: Popula o orçamento de distribuição (agora usa o valor local direto)
        // Não precisamos mais de 'rate' ou 'selectedOption' aqui.
        const localDistBudget = fullFilmData.distribution_budget_amount || '';
        filmForm.querySelector('#distribution_budget_amount').value = localDistBudget;
      } else {
        console.warn(`ID de moeda não encontrado em 'fullFilmData'.`);
        budgetRangeSelect.innerHTML = '<option value="">Escolha a moeda primeiro</option>';
        budgetRangeSelect.disabled = true;
      }

      // --- Parte 3: Buscar e Popular Dados Relacionais ---
      const [
        { data: selectedCategories, error: catErr },
        { data: selectedGenres, error: genErr },
        { data: creditsData, error: credErr },
        { data: invitesData, error: invErr },
      ] = await Promise.all([
        // Simplificado: Não busca mais 'allCategories' ou 'allGenres'
        supabase.from('film_category_assignments').select('category_id').eq('film_id', filmId),
        supabase.from('film_genre_assignments').select('genre_id').eq('film_id', filmId),
        supabase
          .from('film_credits')
          .select(`role_id, crew_roles (role_name), crew_members (id, first_name, last_name)`)
          .eq('film_id', filmId),
        supabase
          .from('film_invitations')
          .select('invited_name, invited_email')
          .eq('film_id', filmId),
      ]);

      if (catErr) console.error('Erro ao buscar categorias:', catErr);
      if (genErr) console.error('Erro ao buscar gêneros:', genErr);
      if (credErr) console.error('Erro ao buscar créditos:', credErr);
      if (invErr) console.error('Erro ao buscar convites:', invErr);

      // --- Parte 4: Popular Choices.js (LÓGICA SIMPLES) ---
      // Confia nas instâncias originais de 'initializeChoices'
      // 'resetForm' já limpou os valores antigos, então só precisamos setar.

      try {
        if (choicesInstances.category_ids && selectedCategories) {
          // Limpa os valores atuais
          choicesInstances.category_ids.removeActiveItems();

          // Seta os novos valores usando setChoiceByValue()
          selectedCategories.forEach((item) => {
            const categoryId = String(item.category_id);
            choicesInstances.category_ids.setChoiceByValue(categoryId);
          });

          console.log(
            'Categorias populadas:',
            selectedCategories.map((c) => c.category_id)
          );
        }
      } catch (e) {
        console.error(`Erro ao definir valor para Choices Categoria:`, e);
      }

      // GÊNEROS
      try {
        if (choicesInstances.genre_ids && selectedGenres) {
          // Limpa os valores atuais
          choicesInstances.genre_ids.removeActiveItems();

          // Seta os novos valores usando setChoiceByValue()
          selectedGenres.forEach((item) => {
            const genreId = String(item.genre_id);
            choicesInstances.genre_ids.setChoiceByValue(genreId);
          });

          console.log(
            'Gêneros populados:',
            selectedGenres.map((g) => g.genre_id)
          );
        }
      } catch (e) {
        console.error(`Erro ao definir valor para Choices Gênero:`, e);
      }

      // --- Parte 5: Popular Listas (Créditos, Links, Convites) ---

      // Créditos e Selects de Produtor/Responsável
      credits = (creditsData || []).map((c) => ({
        id: Date.now() + Math.random(), // ID local para UI
        name: `${c.crew_members?.first_name || ''} ${c.crew_members?.last_name || ''}`.trim(),
        roleId: c.role_id,
        roleName: c.crew_roles?.role_name || 'Desconhecido',
        personId: c.crew_members?.id,
      }));
      renderCredits();

      // Popula os selects E JÁ SETA os valores corretos
      updateCreditRoleSelects(
        fullFilmData.producer_person_id,
        fullFilmData.distribution_lead_person_id
      );

      // Links (Ainda não implementado no 'select *', mas pronto para quando for)
      let linksData = fullFilmData.extra_links || []; // Supondo que a coluna se chame 'extra_links'
      moreLinks = (linksData || []).map((l) => ({
        id: Date.now() + Math.random(),
        name: l.name || 'Link',
        url: l.url,
      }));
      renderLinks();

      // Convites
      collaborators = (invitesData || []).map((inv) => ({
        name: inv.invited_name,
        email: inv.invited_email,
      }));
      renderInvites();

      // --- Parte 6: Popular Poster ---
      if (fullFilmData.poster_thumbnail_url && posterPreviewImage && posterPreviewContainer) {
        posterPreviewImage.src = fullFilmData.poster_thumbnail_url;
        posterPreviewContainer.style.display = 'block';
        posterFileForUpload = null;
        if (croppieInstance) {
          croppieInstance.destroy();
          croppieInstance = null;
        }
      } else {
        if (posterPreviewImage) posterPreviewImage.src = '';
        if (posterPreviewContainer) posterPreviewContainer.style.display = 'none';
        posterFileForUpload = null;
      }

      console.log('Formulário populado para edição.');
    } catch (error) {
      console.error('Erro ao popular formulário para edição:', error);
      alert('Não foi possível carregar todos os dados do filme para edição.');
    }
  }
  // ===================================================================
  // FIM DA SUBSTITUIÇÃO
  // ===================================================================

  function showFormPanel(show, film = null) {
    if (show) {
      isEditing = film !== null;
      currentEditingFilmId = film ? film.id : null;

      resetForm();

      if (isEditing) {
        if (formTitle) formTitle.textContent = 'editar filme';
        populateFormForEdit(film); // <-- CHAMA A FUNÇÃO DE POPULAÇÃO
      } else {
        if (formTitle) formTitle.textContent = 'cadastro de filme';
      }

      formPanelWrapper.style.display = 'block';
      formPanelWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      formPanelWrapper.style.display = 'none';
      isEditing = false;
      currentEditingFilmId = null;
      resetForm();
    }
  }

  // ===================================================================
  // LÓGICA DE UI "INTELIGENTE" (ATUALIZADA para campo fixo)
  // ===================================================================
  function updateFormVisibility(role, plan) {
    console.log(`Atualizando UI para Role: ${role}, Plan: ${plan}`);

    if (distributorFieldsWrapper) distributorFieldsWrapper.style.display = 'none';
    if (invitesWrapper) invitesWrapper.style.display = 'none';
    if (distributorDisplayGroup) distributorDisplayGroup.style.display = 'none';
    if (distributorSelectGroup) distributorSelectGroup.style.display = 'none';

    if (role === 'realizador_solo') {
      if (plan !== 'free' && invitesWrapper) {
        invitesWrapper.style.display = 'block';
      }
    } else if (role === 'distribuidora') {
      if (distributorFieldsWrapper) {
        distributorFieldsWrapper.style.display = 'block';
        if (distributorDisplayGroup && distributorNameDisplay && distributorProfileIdInput) {
          distributorDisplayGroup.style.display = 'block';
          console.log('Campo fixo da distribuidora (wrapper) habilitado.');
        } else {
          console.error('Elementos do campo fixo da distribuidora não encontrados!');
        }
      }
      if (invitesWrapper) {
        invitesWrapper.style.display = 'block';
      }
    } else {
      console.warn('Role do usuário desconhecido ou não definido:', role);
      if (distributorFieldsWrapper) distributorFieldsWrapper.style.display = 'none';
      if (invitesWrapper) invitesWrapper.style.display = 'none';
    }
  }

  // ===================================================================
  // LÓGICA DE DROPDOWNS DEPENDENTES (Moeda -> Orçamento)
  // ===================================================================
  function setupDependentDropdowns() {
    const currencySelect = document.getElementById('currency_id');
    const budgetRangeSelect = document.getElementById('production_budget_range_id');
    const budgetSuffix = document.getElementById('distribution-currency-suffix');

    if (!currencySelect || !budgetRangeSelect || !budgetSuffix) {
      console.warn('Faltando elementos para dropdowns dependentes (moeda, faixa ou sufixo).');
      return;
    }

    budgetSuffix.textContent = currentCurrencyCode;

    currencySelect.addEventListener('change', async (event) => {
      const selectedOption = currencySelect.options[currencySelect.selectedIndex];
      const currencyCode = selectedOption.dataset.code;

      if (currencyCode) {
        budgetSuffix.textContent = currencyCode;
        currentCurrencyCode = currencyCode; // Atualiza o estado global
      } else {
        budgetSuffix.textContent = 'USD';
        currentCurrencyCode = 'USD';
      }

      budgetRangeSelect.innerHTML = '<option value="">Carregando faixas...</option>';
      budgetRangeSelect.disabled = true;
      if (!currencyCode) {
        budgetRangeSelect.innerHTML = '<option value="">Escolha a moeda primeiro</option>';
        return;
      }
      const ranges = await window.CurrencyService.getDynamicBudgetRanges(supabase, currencyCode);
      if (ranges && ranges.length > 0) {
        budgetRangeSelect.innerHTML = '<option value="">Selecione uma faixa...</option>';
        ranges.forEach((range) => {
          budgetRangeSelect.appendChild(new Option(range.range_label, range.id));
        });
        budgetRangeSelect.disabled = false;
      } else {
        budgetRangeSelect.innerHTML = '<option value="">Nenhuma faixa encontrada</option>';
      }
    });
    console.log('Listeners para dropdowns dependentes (DINÂMICOS) configurados.');
  }

  // ===================================================================
  // LÓGICA DE VALIDAÇÃO DO WIZARD (MULTI-ETAPAS)
  // ===================================================================
  function showValidationError(element, message) {
    const formGroup = element.closest('.form-group');
    if (!formGroup) return;
    formGroup.classList.add('error');
    let messageEl = formGroup.querySelector('.validation-message');
    if (!messageEl) {
      messageEl = document.createElement('span');
      messageEl.className = 'validation-message';
      const inputWrapper =
        formGroup.querySelector('.select-wrapper, .input-icon, .choices') || element;
      inputWrapper.parentNode.insertBefore(messageEl, inputWrapper.nextSibling);
    }
    messageEl.textContent = message;
    messageEl.classList.add('visible');
  }

  function clearValidationError(element) {
    const formGroup = element.closest('.form-group');
    if (!formGroup) return;
    formGroup.classList.remove('error');
    const messageEl = formGroup.querySelector('.validation-message');
    if (messageEl) {
      messageEl.classList.remove('visible');
    }
  }

  function validateField(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return false;
    if (!element.value || (element.type === 'select-one' && element.value === '')) {
      showValidationError(element, message);
      return false;
    }
    clearValidationError(element);
    return true;
  }

  function validateChoices(elementId, message) {
    const instance = choicesInstances[elementId];
    const element = document.getElementById(elementId);
    if (!instance || instance.getValue(true).length === 0) {
      showValidationError(element, message);
      return false;
    }
    clearValidationError(element);
    return true;
  }

  function validateStep(stepNumber) {
    let isValid = true;
    document.querySelectorAll(`#form-step-${stepNumber} .form-group.error`).forEach((group) => {
      group.classList.remove('error');
      const msg = group.querySelector('.validation-message');
      if (msg) msg.classList.remove('visible');
    });

    switch (stepNumber) {
      case 1: // Básico
        isValid = validateField('title', 'O título é obrigatório.') && isValid;
        isValid = validateField('completion_date', 'A data é obrigatória.') && isValid;
        isValid = validateField('currency_id', 'A moeda é obrigatória.') && isValid;
        isValid =
          validateField('production_budget_range_id', 'A faixa de orçamento é obrigatória.') &&
          isValid;
        isValid =
          validateField('distribution_budget_amount', 'O orçamento é obrigatório.') && isValid;
        isValid = validateField('synopsis', 'A sinopse é obrigatória.') && isValid;
        break;
      case 2: // Detalhes
        isValid = validateField('country_id', 'O país é obrigatório.') && isValid;
        isValid = validateField('film_type_id', 'O tipo é obrigatório.') && isValid;
        isValid = validateField('language_id', 'O idioma é obrigatório.') && isValid;
        isValid = validateField('duration_in_seconds', 'A duração é obrigatória.') && isValid;
        isValid = validateChoices('category_ids', 'Selecione ao menos uma categoria.') && isValid;
        isValid = validateChoices('genre_ids', 'Selecione ao menos um gênero.') && isValid;
        isValid = validateField('aspect_ratio_id', 'O aspect ratio é obrigatório.') && isValid;
        isValid = validateField('color_mode_id', 'A cor é obrigatória.') && isValid;
        isValid = validateField('recording_format_id', 'O formato é obrigatório.') && isValid;
        break;
      case 3: // Equipe
        isValid = validateField('director_bio', 'A bio da direção é obrigatória.') && isValid;
        break;
      case 4: // Distribuição
        if (distributorFieldsWrapper && distributorFieldsWrapper.style.display !== 'none') {
          isValid =
            validateField('producer_person_id', 'Selecione o Produtor Principal.') && isValid;
          isValid =
            validateField(
              'distribution_lead_person_id',
              'Selecione o Responsável pela Inscrição.'
            ) && isValid;
        }
        break;
      case 5: // Mídia
        isValid = validateField('media_link', 'O link do filme é obrigatório.') && isValid;
        break;
    }

    if (!isValid) {
      const firstError = document.querySelector(`#form-step-${stepNumber} .form-group.error`);
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const firstInput = firstError.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
      }
    }
    return isValid;
  }

  // ===================================================================
  // LÓGICA DE NAVEGAÇÃO DO WIZARD (MULTI-ETAPAS)
  // ===================================================================
  function updateWizardUI() {
    allProgressSteps.forEach((step, index) => {
      const stepNum = index + 1;
      step.classList.remove('active', 'completed');
      if (stepNum < currentStep) step.classList.add('completed');
      else if (stepNum === currentStep) step.classList.add('active');
    });

    // O botão "Voltar" agora também funciona como "Cancelar" no Passo 1
    if (currentStep === 1) {
      btnPrevStep.style.display = 'inline-flex'; // MOSTRAR
      btnPrevStep.textContent = 'Cancelar'; // Mudar texto
      btnNextStep.style.display = 'inline-flex';
      btnSubmitFilm.style.display = 'none';
    } else if (currentStep === totalSteps) {
      btnPrevStep.style.display = 'inline-flex';
      btnPrevStep.textContent = 'Voltar'; // Texto normal
      btnNextStep.style.display = 'none';
      btnSubmitFilm.style.display = 'inline-flex';
    } else {
      btnPrevStep.style.display = 'inline-flex';
      btnPrevStep.textContent = 'Voltar'; // Texto normal
      btnNextStep.style.display = 'inline-flex';
      btnSubmitFilm.style.display = 'none';
    }
  }

  function showStep(stepNumber) {
    allSteps.forEach((step, index) => {
      step.classList.toggle('active', index + 1 === stepNumber);
    });
    updateWizardUI();
    document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
  }

  function handleNextStep() {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        currentStep++;
        showStep(currentStep);
      }
    }
  }

  function handlePrevStep() {
    // Agora, se estiver no passo 1, o "Voltar" (que diz "Cancelar") fecha o painel
    if (currentStep === 1) {
      showFormPanel(false); // Esconde o formulário
    } else if (currentStep > 1) {
      currentStep--;
      showStep(currentStep);
    }
  }

  function setupWizardListeners() {
    btnNextStep.addEventListener('click', handleNextStep);
    btnPrevStep.addEventListener('click', handlePrevStep);

    console.log('Listeners do Wizard (Próximo/Voltar/Cancelar) configurados.');
  }

  // ===================================================================
  // LÓGICA DAS LISTAS DINÂMICAS (CRÉDITOS - ATUALIZADA)
  // ===================================================================
  async function handleAddCredit() {
    if (!creditNameInput || !creditRoleSelect) return;
    const name = creditNameInput.value.trim();
    const roleId = creditRoleSelect.value;
    const roleName = creditRoleSelect.options[creditRoleSelect.selectedIndex].text;
    if (!name || !roleId) {
      alert('Por favor, preencha o nome e a função do crédito.');
      return;
    }
    let personId = null;
    try {
      const nameParts = name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      if (!firstName && !lastName) {
        if (nameParts.length === 1 && nameParts[0]) {
          console.warn(`Salvando crédito com nome único: ${name}`);
        } else {
          alert('Nome inválido.');
          return;
        }
      }
      const { data: existingPerson, error: findError } = await supabase
        .from('crew_members')
        .select('id')
        .eq('first_name', firstName)
        .eq('last_name', lastName)
        .maybeSingle();
      if (findError) throw findError;
      if (existingPerson) {
        personId = existingPerson.id;
        console.log(`Pessoa encontrada em 'crew_members': ${name} (ID: ${personId})`);
      } else {
        console.log(`Pessoa não encontrada, criando em 'crew_members': ${name}`);
        const { data: newPerson, error: insertError } = await supabase
          .from('crew_members')
          .insert({ first_name: firstName, last_name: lastName })
          .select('id')
          .single();
        if (insertError) throw insertError;
        if (!newPerson) throw new Error('Falha ao criar nova pessoa, ID não retornado.');
        personId = newPerson.id;
        console.log(`Pessoa criada: ${name} (ID: ${personId})`);
      }
    } catch (error) {
      console.error('Erro ao buscar/criar pessoa:', error.message);
      if (error.message.includes('violates row level security policy')) {
        alert(
          "Falha ao adicionar pessoa. Você não tem permissão (RLS) para inserir na tabela 'crew_members'."
        );
      } else {
        alert(
          `Ocorreu um erro ao verificar/adicionar a pessoa '${name}'. O crédito não será adicionado.`
        );
      }
      return;
    }
    credits.push({ id: Date.now(), name, roleId, roleName, personId });
    renderCredits();
    updateCreditRoleSelects();
    creditNameInput.value = '';
    creditRoleSelect.value = '';
  }

  function handleUpdateCredit(id) {
    const name = creditNameInput.value.trim();
    const roleId = creditRoleSelect.value;
    const roleName = creditRoleSelect.options[creditRoleSelect.selectedIndex].text;
    if (!name || !roleId) {
      alert('Por favor, preencha o nome e a função do crédito.');
      return;
    }
    const creditIndex = credits.findIndex((credit) => credit.id === id);
    if (creditIndex > -1) {
      credits[creditIndex].name = name;
      credits[creditIndex].roleId = roleId;
      credits[creditIndex].roleName = roleName;
    }
    resetCreditForm();
    renderCredits();
    updateCreditRoleSelects();
  }

  function handleDeleteCredit(id) {
    credits = credits.filter((credit) => credit.id !== id);
    if (currentlyEditingCreditId === id) resetCreditForm();
    renderCredits();
    updateCreditRoleSelects();
  }

  function renderCredits() {
    if (!creditsList || !creditsListTitle) return;
    creditsList.innerHTML = '';
    if (credits.length === 0) {
      creditsListTitle.style.display = 'none';
      return;
    }
    creditsListTitle.style.display = 'block';
    credits.forEach((credit) => {
      const listItem = document.createElement('li');
      listItem.className = 'credit-item';
      listItem.style =
        'display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--color-border);';
      listItem.innerHTML = `
                <span class="credit-text" style="font-size:0.85rem; color:var(--color-text-primary);">
                    <strong>${credit.name}</strong> — ${credit.roleName} </span>
                <div class="actions">
                    <button type="button" class="btn-gst-film btn-edit-credit" data-id="${credit.id}" title="Editar crédito"><img src="public/icons/icon-film-edit.svg" alt="Editar" style="pointer-events: none;"/></button>
                    <button type="button" class="btn-gst-film btn-delete-credit" data-id="${credit.id}" title="Excluir crédito"><img src="public/icons/icon-film-x.svg" alt="Excluir" style="pointer-events: none;"/></button>
                </div>
            `;
      creditsList.appendChild(listItem);
    });
  }

  function handleEditCredit(id) {
    const creditToEdit = credits.find((credit) => credit.id === id);
    if (!creditToEdit || !creditNameInput || !creditRoleSelect || !addCreditBtn) return;
    creditNameInput.value = creditToEdit.name;
    creditRoleSelect.value = creditToEdit.roleId;
    currentlyEditingCreditId = id;
    addCreditBtn.innerHTML =
      '<img src="public/icons/icon-check.svg" alt="Salvar alteração" style="width: 16px; height: 16px;" />';
    addCreditBtn.title = 'Salvar alteração';
    creditNameInput.focus();
  }

  function resetCreditForm() {
    if (!creditNameInput || !creditRoleSelect || !addCreditBtn) return;
    creditNameInput.value = '';
    creditRoleSelect.value = '';
    currentlyEditingCreditId = null;
    addCreditBtn.innerHTML = originalAddCreditIcon;
    addCreditBtn.title = 'Adicionar crédito';
  }

  // ===================================================================
  // FUNÇÃO: Popular Selects de Produtor/Responsável
  // ===================================================================
  function updateCreditRoleSelects(producerId = null, leadId = null) {
    if (!producerPersonSelect || !distributionLeadPersonSelect) return;

    // Limpa os selects
    producerPersonSelect.innerHTML = '<option value="">Selecione nos créditos...</option>';
    distributionLeadPersonSelect.innerHTML = '<option value="">Selecione nos créditos...</option>';

    if (credits.length === 0) {
      producerPersonSelect.innerHTML = '<option value="">Adicione créditos primeiro</option>';
      distributionLeadPersonSelect.innerHTML =
        '<option value="">Adicione créditos primeiro</option>';
      return;
    }

    // Agrupa pessoas únicas
    const uniquePeopleInCredits = new Map();
    credits.forEach((credit) => {
      if (credit.personId && !uniquePeopleInCredits.has(credit.personId)) {
        uniquePeopleInCredits.set(credit.personId, credit.name);
      }
    });

    if (uniquePeopleInCredits.size === 0) {
      producerPersonSelect.innerHTML =
        '<option value="">Nenhuma pessoa válida nos créditos</option>';
      distributionLeadPersonSelect.innerHTML =
        '<option value="">Nenhuma pessoa válida nos créditos</option>';
      return;
    }

    // Popula os selects e JÁ SELECIONA os IDs passados
    uniquePeopleInCredits.forEach((name, personId) => {
      const optionP = new Option(name, personId);
      const optionL = new Option(name, personId);

      // Compara usando os parâmetros da função
      if (personId == producerId) {
        optionP.selected = true;
      }
      if (personId == leadId) {
        optionL.selected = true;
      }

      producerPersonSelect.appendChild(optionP);
      distributionLeadPersonSelect.appendChild(optionL);
    });
  }

  // --- Funções de Links ---
  function renderLinks() {
    if (!linksList || !linksListTitle) return;
    linksList.innerHTML = '';
    if (moreLinks.length === 0) {
      linksListTitle.style.display = 'none';
      return;
    }
    linksListTitle.style.display = 'block';
    moreLinks.forEach((link) => {
      const listItem = document.createElement('li');
      listItem.className = 'link-item';
      listItem.style =
        'display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--color-border);';
      listItem.innerHTML = `
                <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="text-decoration:none; color:var(--color-text-primary); font-size:0.85rem;">
                    ${link.name} - ${link.url}
                </a>
                <div class="actions">
                    <button type="button" class="btn-gst-film btn-edit-link" data-id="${link.id}" title="Editar link"><img src="public/icons/icon-film-edit.svg" alt="Editar" style="pointer-events: none;"/></button>
                    <button type="button" class="btn-gst-film btn-delete-link" data-id="${link.id}" title="Excluir link"><img src="public/icons/icon-film-x.svg" alt="Excluir" style="pointer-events: none;"/></button>
                </div>
            `;
      linksList.appendChild(listItem);
    });
  }

  function handleAddOrUpdateLink() {
    if (currentlyEditingLinkId !== null) handleUpdateLink(currentlyEditingLinkId);
    else handleAddLink();
  }

  function handleAddLink() {
    if (!linkNameInput || !externalLinkInput) return;
    const name = linkNameInput.value.trim();
    const url = externalLinkInput.value.trim();
    if (!name || !url) {
      alert('Por favor, preencha o nome e a URL do link.');
      return;
    }
    try {
      new URL(url);
    } catch (_) {
      alert('Por favor, insira uma URL válida (ex: https://exemplo.com).');
      return;
    }
    moreLinks.push({ id: Date.now(), name, url });
    renderLinks();
    linkNameInput.value = '';
    externalLinkInput.value = '';
  }

  function handleEditLink(id) {
    const linkToEdit = moreLinks.find((link) => link.id === id);
    if (!linkToEdit || !linkNameInput || !externalLinkInput || !addLinkBtn) return;
    linkNameInput.value = linkToEdit.name;
    externalLinkInput.value = linkToEdit.url;
    currentlyEditingLinkId = id;
    addLinkBtn.innerHTML =
      '<img src="public/icons/icon-check.svg" alt="Salvar alteração" style="width: 16px; height: 16px;" />';
    addLinkBtn.title = 'Salvar alteração';
    linkNameInput.focus();
  }

  function handleUpdateLink(id) {
    if (!linkNameInput || !externalLinkInput) return;
    const name = linkNameInput.value.trim();
    const url = externalLinkInput.value.trim();
    if (!name || !url) {
      alert('Por favor, preencha o nome e a URL do link.');
      return;
    }
    try {
      new URL(url);
    } catch (_) {
      alert('Por favor, insira uma URL válida (ex: https://exemplo.com).');
      return;
    }
    const linkIndex = moreLinks.findIndex((link) => link.id === id);
    if (linkIndex > -1) {
      moreLinks[linkIndex] = { ...moreLinks[linkIndex], name, url };
    }
    resetLinkForm();
    renderLinks();
  }

  function handleDeleteLink(id) {
    moreLinks = moreLinks.filter((link) => link.id !== id);
    if (currentlyEditingLinkId === id) resetLinkForm();
    renderLinks();
  }

  function resetLinkForm() {
    if (!linkNameInput || !externalLinkInput || !addLinkBtn) return;
    linkNameInput.value = '';
    externalLinkInput.value = '';
    currentlyEditingLinkId = null;
    addLinkBtn.innerHTML = originalAddLinkIcon;
    addLinkBtn.title = 'Adicionar link';
  }

  // --- Funções de Convites ---
  function renderInvites() {
    if (!invitesList || !invitesListTitle) return;
    invitesList.innerHTML = '';
    if (collaborators.length === 0) {
      invitesListTitle.style.display = 'none';
      return;
    }
    invitesListTitle.style.display = 'block';
    collaborators.forEach((invite) => {
      const listItem = document.createElement('li');
      listItem.className = 'invite-item';
      listItem.style =
        'display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--color-border);';
      listItem.innerHTML = `
                <span class="invite-text" style="font-size:0.85rem; color:var(--color-text-primary);">
                    <strong>${invite.name || 'N/A'}</strong> — ${invite.email}
                </span>
                <div class="actions">
                    <button type="button" class="btn-gst-film btn-delete-invite" data-email="${
                      invite.email
                    }" title="Remover convite"><img src="public/icons/icon-film-x.svg" alt="Excluir" style="pointer-events: none;"/></button>
                </div>
            `;
      invitesList.appendChild(listItem);
    });
  }

  function handleAddInvite() {
    if (!inviteNameInput || !inviteEmailInput) return;
    const name = inviteNameInput.value.trim();
    const email = inviteEmailInput.value.trim().toLowerCase();
    if (!email) {
      alert('Por favor, preencha o email do colaborador.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('Por favor, insira um email válido.');
      return;
    }
    if (collaborators.some((invite) => invite.email === email)) {
      alert('Este email já foi adicionado à lista.');
      return;
    }
    if (currentProfilePlan === 'free' && collaborators.length >= 2) {
      alert('Seu plano gratuito permite apenas 2 colaboradores. Faça upgrade para adicionar mais!');
      return;
    }
    collaborators.push({ name, email });
    renderInvites();
    inviteNameInput.value = '';
    inviteEmailInput.value = '';
  }

  function handleDeleteInvite(email) {
    collaborators = collaborators.filter((invite) => invite.email !== email);
    renderInvites();
  }

  // --- Event Listeners ---
  function setupDynamicListListeners() {
    if (addCreditBtn)
      addCreditBtn.addEventListener('click', () => {
        if (currentlyEditingCreditId !== null) {
          handleUpdateCredit(currentlyEditingCreditId);
        } else {
          handleAddCredit();
        }
      });
    if (addLinkBtn) addLinkBtn.addEventListener('click', handleAddOrUpdateLink);
    if (addInviteBtn) addInviteBtn.addEventListener('click', handleAddInvite);
    if (invitesList) {
      invitesList.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const email = button.dataset.email;
        if (button.classList.contains('btn-delete-invite')) {
          handleDeleteInvite(email);
        }
      });
    }
    if (creditsList) {
      creditsList.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const id = parseInt(button.dataset.id);
        if (button.classList.contains('btn-delete-credit')) handleDeleteCredit(id);
        if (button.classList.contains('btn-edit-credit')) handleEditCredit(id);
      });
    }
    if (linksList) {
      linksList.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;
        const id = parseInt(button.dataset.id);
        if (button.classList.contains('btn-delete-link')) handleDeleteLink(id);
        if (button.classList.contains('btn-edit-link')) handleEditLink(id);
      });
    }
    console.log('Listeners para listas dinâmicas configurados.');
  }

  // ===================================================================
  // LÓGICA DE UPLOAD DO CARTAZ
  // ===================================================================
  function setupPosterUploadListeners() {
    if (!posterUploadBtn || !posterUploadInput) return;
    posterUploadBtn.addEventListener('click', () => posterUploadInput.click());
    posterUploadInput.addEventListener('change', handlePosterFileSelection);
    console.log('Listeners para upload de cartaz configurados.');
  }

  function handlePosterFileSelection(event) {
    const file = event.target.files[0];
    if (!file) return;
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      alert(
        `O arquivo é muito grande (${(file.size / 1024 / 1024).toFixed(
          1
        )}MB). O tamanho máximo permitido é de 5MB.`
      );
      posterUploadInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (croppieInstance) croppieInstance.destroy();
      if (!posterPreviewImage || !posterPreviewContainer) return;
      posterPreviewContainer.style.display = 'block';
      croppieInstance = new Croppie(posterPreviewImage, {
        viewport: { width: 200, height: 300 },
        boundary: { width: '100%', height: 320 },
        showZoomer: true,
        enableOrientation: true,
      });
      croppieInstance.bind({ url: e.target.result }).then(() => {
        generateOptimizedBlob();
      });
    };
    reader.readAsDataURL(file);
  }

  async function generateOptimizedBlob() {
    if (!croppieInstance || !posterPreviewImage) return;
    console.log('Gerando blob otimizado...');
    const blob = await croppieInstance.result({
      type: 'blob',
      size: { width: 400 },
      format: 'jpeg',
      quality: 0.75,
      circle: false,
    });
    const previewUrl = URL.createObjectURL(blob);
    croppieInstance.destroy();
    croppieInstance = null;
    posterPreviewImage.src = previewUrl;
    posterPreviewImage.style.display = 'block';
    posterFileForUpload = blob;
    console.log(
      'Arquivo de cartaz processado e pronto para envio. Tamanho:',
      `${(blob.size / 1024).toFixed(1)} KB`
    );
  }

  // ===================================================================
  // FUNÇÕES DE INICIALIZAÇÃO (Populate, Choices, Mask)
  // ===================================================================
  async function populateSelects() {
    console.log('Iniciando a população dos campos de seleção (Estáticos)...');
    const displayColumnMap = {
      countries: 'country',
      currencies: 'name',
      film_types: 'type',
      languages: 'name',
      categories: 'category',
      genres: 'genre',
      crew_roles: 'role_name',
      aspect_ratios: 'name',
      color_modes: 'name',
      recording_formats: 'name',
    };
    const selects = document.querySelectorAll('select[data-source]:not([data-source="users"])');

    let validCurrencyCodes = null;
    try {
      // Use 'await'
      const { data, error } = await supabase.from('exchange_rates').select('target_currency_code');
      if (error) throw error;
      validCurrencyCodes = data.map((item) => item.target_currency_code);
      if (!validCurrencyCodes.includes('USD')) validCurrencyCodes.push('USD');
    } catch (error) {
      console.error('Erro ao buscar lista de moedas válidas:', error.message);
    }

    // O loop for...of funciona com 'await' dentro dele
    for (const select of selects) {
      const tableName = select.dataset.source;
      if (!tableName) continue;

      select.innerHTML = '';
      if (!select.multiple) select.appendChild(new Option('Selecione...', ''));

      if (tableName === 'currencies') {
        if (!validCurrencyCodes) {
          select.innerHTML = `<option value="">Erro ao carregar moedas</option>`;
          continue;
        }
        try {
          // Use 'await'
          const { data, error } = await supabase
            .from('currencies')
            .select('id, name, iso_code')
            .in('iso_code', validCurrencyCodes)
            .order('name', { ascending: true });
          if (error) throw error;
          data.forEach((item) => {
            const optionText = `${item.name} (${item.iso_code})`;
            const option = new Option(optionText, item.id);
            option.dataset.code = item.iso_code;
            select.appendChild(option);
          });
        } catch (error) {
          console.error(`Erro ao buscar dados filtrados para ${tableName}:`, error.message);
          select.innerHTML = `<option value="">Erro ao carregar</option>`;
        }
      } else if (tableName === 'crew_roles') {
        try {
          // Use 'await'
          const { data, error } = await supabase
            .from('crew_roles')
            .select('id, role_name, department')
            .order('department')
            .order('role_name');
          if (error) throw error;
          const groupedByDept = data.reduce((acc, role) => {
            const dept = role.department || 'Outros';
            if (!acc[dept]) acc[dept] = [];
            acc[dept].push(role);
            return acc;
          }, {});
          for (const department in groupedByDept) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = department.charAt(0).toUpperCase() + department.slice(1);
            groupedByDept[department].forEach((role) => {
              optgroup.appendChild(new Option(role.role_name, role.id));
            });
            select.appendChild(optgroup);
          }
        } catch (error) {
          console.error(`Erro ao buscar e agrupar dados para ${tableName}:`, error.message);
          select.innerHTML = `<option value="">Erro ao carregar</o'ptio>`;
        }
      } else {
        try {
          const displayColumn = displayColumnMap[tableName] || 'name';
          // Use 'await'
          const { data, error } = await supabase
            .from(tableName)
            .select(`id, ${displayColumn}`)
            .order(displayColumn, { ascending: true });
          if (error) throw error;
          data.forEach((item) => {
            select.appendChild(new Option(item[displayColumn], item.id));
          });
        } catch (error) {
          console.error(`Erro ao buscar dados para ${tableName}:`, error.message);
          select.innerHTML = `<option value="">Erro ao carregar</option>`;
        }
      }
    } // Fim do loop for...of
    console.log('População dos campos de seleção (Estáticos) finalizada.');
  }

  // ATUALIZADO: para buscar a moeda preferida e definir o estado global
  async function populateProfileSelects() {
    console.log('Populando selects de perfil...');
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error(`Usuário não autenticado: ${authError?.message}`);
      currentAuthUserId = user.id;

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_profile_id');
      if (rpcError || rpcData === null) {
        console.error("Erro na RPC 'get_my_profile_id':", rpcError);
        throw new Error(
          `Falha ao buscar ID INT4 do perfil (RPC 'get_my_profile_id'): ${
            rpcError?.message || 'Nenhum dado retornado'
          }.`
        );
      }
      currentProfileId = rpcData;
      console.log(`ID INT4 (Owner) obtido via RPC: ${currentProfileId}`);
      console.log(`ID UUID (Auth) obtido: ${currentAuthUserId}`);

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('role, plan, preferred_currency_id, currencies (iso_code)') // JOIN para pegar o iso_code
        .eq('id', currentAuthUserId)
        .single();

      if (profileError || !profileData) {
        let detail = profileError ? profileError.message : 'Nenhum dado retornado.';
        if (profileError && profileError.code === 'PGRST116') {
          detail = `Nenhum perfil encontrado na tabela 'users' com id (UUID) = ${currentAuthUserId}.`;
        }
        throw new Error(`Não foi possível buscar 'role' e 'plan' do perfil: ${detail}`);
      }

      currentProfileRole = profileData.role || 'realizador_solo';
      currentProfilePlan = profileData.plan || 'free';

      if (profileData.currencies && profileData.currencies.iso_code) {
        currentCurrencyCode = profileData.currencies.iso_code;
        const currencySelect = document.getElementById('currency_id');
        if (currencySelect) {
          const optionToSelect = Array.from(currencySelect.options).find(
            (opt) => opt.dataset.code === currentCurrencyCode
          );
          if (optionToSelect) {
            currencySelect.value = optionToSelect.value;
            // Dispara o evento change para atualizar faixas de orçamento e sufixo
            currencySelect.dispatchEvent(new Event('change'));
          }
        }
      } else {
        currentCurrencyCode = 'USD'; // Padrão
      }
      console.log(`Moeda preferida definida: ${currentCurrencyCode}`);

      if (currentProfileRole === 'distribuidora') {
        if (distributorDisplayGroup && distributorNameDisplay && distributorProfileIdInput) {
          distributorNameDisplay.textContent = currentProfileName || 'Distribuidora Logada';
          distributorProfileIdInput.value = currentAuthUserId;
        }
      } else {
        const select = document.getElementById('distributor_profile_id_fallback');
        if (select) {
          const defaultOption = new Option(currentProfileName, currentAuthUserId);
          defaultOption.selected = true;
          select.innerHTML = '';
          select.appendChild(defaultOption);
        }
      }
      console.log('Dados do perfil (INT4, UUID, Moeda) carregados e UI ajustada.');
    } catch (error) {
      console.error('Erro CRÍTICO ao popular selects de perfil:', error.message);
      currentProfileRole = 'realizador_solo';
      currentProfilePlan = 'free';
      currentCurrencyCode = 'USD'; // Padrão seguro
    }
  }

  function initializeChoices() {
    console.log('Inicializando Choices.js...');
    const categorySelect = document.getElementById('category_ids');
    const genreSelect = document.getElementById('genre_ids');
    if (typeof Choices !== 'undefined') {
      if (categorySelect) {
        try {
          choicesInstances.category_ids = new Choices(categorySelect, {
            removeItemButton: true,
            placeholder: true,
            placeholderValue: 'Selecione categorias',
            noResultsText: 'Nenhum resultado',
            itemSelectText: '',
            addItems: false, // <-- CRÍTICO: Não permite criar novos items
            searchEnabled: true,
            shouldSort: false, // <-- Mantém a ordem original
          });
        } catch (e) {
          console.error('Erro Choices Categoria:', e);
        }
      } else {
        console.warn('Select de categoria não encontrado.');
      }
      if (genreSelect) {
        try {
          choicesInstances.genre_ids = new Choices(genreSelect, {
            removeItemButton: true,
            placeholder: true,
            placeholderValue: 'Selecione gêneros',
            noResultsText: 'Nenhum resultado',
            itemSelectText: '',
            addItems: false, // <-- CRÍTICO: Não permite criar novos items
            searchEnabled: true,
            shouldSort: false, // <-- Mantém a ordem original
          });
        } catch (e) {
          console.error('Erro Choices Gênero:', e);
        }
      } else {
        console.warn('Select de gênero não encontrado.');
      }
      if (choicesInstances.category_ids || choicesInstances.genre_ids) {
        console.log('Choices.js inicializado.');
      }
    } else {
      console.error('Biblioteca Choices.js não carregada.');
    }
  }

  function initializeInputMasks() {
    const durationInput = document.getElementById('duration_in_seconds');
    if (!durationInput) return;
    if (typeof IMask !== 'undefined') {
      try {
        const durationMask = IMask(durationInput, {
          mask: 'MM:SS',
          blocks: {
            MM: { mask: Number, min: 0, max: 999 },
            SS: { mask: IMask.MaskedRange, from: 0, to: 59, maxLength: 2 },
          },
        });
        console.log('Máscara de duração inicializada.');
      } catch (error) {
        console.error('Erro ao inicializar IMask:', error);
      }
    } else {
      console.error('Biblioteca IMask não carregada.');
    }
  }

  // ===================================================================
  // FUNÇÃO DE INICIALIZAÇÃO DA PÁGINA (ATUALIZADA)
  // ===================================================================
  async function initMyFilmsPage() {
    // 1. Popula selects estáticos (países, moedas, etc.)
    await populateSelects();

    // 2. Busca dados do user (role, plan, e MOEDA PREFERIDA)
    await populateProfileSelects();

    // 3. Ajusta a UI com base no role/plan
    updateFormVisibility(currentProfileRole, currentProfilePlan);

    // 4. Inicializa o resto
    initializeChoices();
    setupPosterUploadListeners();
    setupDynamicListListeners();
    initializeInputMasks();
    setupDependentDropdowns();
    updateCreditRoleSelects();

    // 5. Configura o Wizard
    setupWizardListeners();
    showStep(1);

    // 6. Carrega os cards de filmes (AGORA usa o currentCurrencyCode)
    await loadAndRenderFilms();

    // 7. Configura listeners de página (Novo/Editar/Cancelar)
    if (btnNewFilm) {
      btnNewFilm.addEventListener('click', () => showFormPanel(true, null));
    }

    // O listener de 'Cancelar' (btnPrevStep) já está em setupWizardListeners()

    if (myFilmsListContainer) {
      myFilmsListContainer.addEventListener('click', (e) => {
        const editButton = e.target.closest('.btn-edit-film');
        if (editButton) {
          const filmId = parseInt(editButton.dataset.filmId, 10);
          const filmToEdit = myFilms.find((f) => f.id == filmId);
          if (filmToEdit) {
            showFormPanel(true, filmToEdit); // Mostra o painel com dados (Etapa 3)
          } else {
            console.error(`Filme com ID ${filmId} não encontrado no estado global.`);
          }
        }
      });
    }

    // 8. Listener principal de submit
    if (filmForm) {
      filmForm.addEventListener('submit', handleFilmSubmit);
    } else {
      console.error("O formulário 'film-form' não foi encontrado.");
    }
    console.log("Página 'myfilms' inicializada com Wizard e Lista de Filmes.");
  }

  // Inicia a página
  initMyFilmsPage();
});
