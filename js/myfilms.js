// js/myfilms.js

const onSupabaseReady = (callback) => {
    const interval = setInterval(() => {
        if (window.supabase) {
            clearInterval(interval);
            callback(window.supabase);
        }
    }, 50);
};

onSupabaseReady((supabase) => {
    console.log("myfilms.js: Supabase está pronto. Iniciando a lógica da página.");

    // ===================================================================
    // ESTADO DA APLICAÇÃO E SELETORES DO DOM
    // ===================================================================
    let credits = [];
    let moreLinks = [];
    let currentlyEditingCreditId = null;
    let currentlyEditingLinkId = null;
    let posterFileForUpload = null;
    let croppieInstance = null;
    let choicesInstances = {};

    const filmForm = document.getElementById('film-form');
    const posterUploadBtn = document.getElementById('poster-upload-btn');
    const posterUploadInput = document.getElementById('poster-upload');
    const posterPreviewContainer = document.getElementById('poster-preview');
    const posterPreviewImage = posterPreviewContainer ? posterPreviewContainer.querySelector('img') : null;
    const creditNameInput = document.getElementById('credit-name');
    const creditRoleSelect = document.getElementById('credit_role_id');
    const addCreditBtn = document.getElementById('add-credit-btn');
    const creditsList = document.getElementById('credits-list');
    const linkNameInput = document.getElementById('link-name');
    const externalLinkInput = document.getElementById('external-link');
    const addLinkBtn = document.getElementById('add-link-btn');
    const linksList = document.getElementById('links-list');
    const originalAddCreditIcon = addCreditBtn.innerHTML;
    const originalAddLinkIcon = addLinkBtn.innerHTML;

    // ===================================================================
    // FUNÇÃO PRINCIPAL: SUBMISSÃO DO FORMULÁRIO
    // ===================================================================
    async function handleFilmSubmit(event) {
        event.preventDefault();
        const submitButton = filmForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado.');

            const { data: profileId, error: rpcError } = await supabase.rpc('get_my_profile_id');
            if (rpcError || !profileId) throw new Error(`Não foi possível identificar o perfil do usuário: ${rpcError?.message || 'ID de perfil não retornado.'}`);
            
            let posterThumbnailUrl = null;

            if (posterFileForUpload) {
                const fileExt = 'jpeg';
                const fileName = `${user.id}-${Date.now()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('film-posters').upload(filePath, posterFileForUpload);
                if (uploadError) throw new Error(`Falha no upload do cartaz: ${uploadError.message}`);
                const { data: urlData } = supabase.storage.from('film-posters').getPublicUrl(filePath);
                posterThumbnailUrl = urlData.publicUrl;
            }

            const formData = new FormData(filmForm);
            const filmObject = {};
            for (const [key, value] of formData.entries()) {
                 if (value) filmObject[key] = value;
            }
            
            if (filmObject.duration_in_seconds) {
                const parts = filmObject.duration_in_seconds.split(':');
                const minutes = parseInt(parts[0], 10) || 0;
                const seconds = parseInt(parts[1], 10) || 0;
                filmObject.duration_in_seconds = (minutes * 60) + seconds;
            }

            filmObject.owner_profile_id = profileId;
            if(posterThumbnailUrl) filmObject.poster_thumbnail_url = posterThumbnailUrl;
            
            filmObject.is_debut = filmObject.is_debut === 'true';
            filmObject.is_student_project = filmObject.is_student_project === 'true';

            ['poster_thumbnail', 'credit_name', 'credit_role_id', 'link_name', 'external_link', 'category_ids', 'genre_ids'].forEach(key => delete filmObject[key]);
            
            // O ID salvo em 'production_budget_range_id' é o ID mestre em USD.
            const { data: newFilm, error: filmInsertError } = await supabase.from('films').insert([filmObject]).select().single();
            if (filmInsertError) throw new Error(`Falha ao salvar o filme: ${filmInsertError.message}`);
            
            const newFilmId = newFilm.id;

            const categoryIds = choicesInstances.category_ids.getValue(true);
            if (categoryIds && categoryIds.length > 0) {
                const categoriesToInsert = categoryIds.map(id => ({ film_id: newFilmId, category_id: id }));
                await supabase.from('film_category_assignments').insert(categoriesToInsert);
            }

            const genreIds = choicesInstances.genre_ids.getValue(true);
            if (genreIds && genreIds.length > 0) {
                const genresToInsert = genreIds.map(id => ({ film_id: newFilmId, genre_id: id }));
                await supabase.from('film_genre_assignments').insert(genresToInsert);
            }
            
            if (credits.length > 0) {
                const creditsToInsert = await Promise.all(credits.map(async (credit) => {
                    let personId;
                    const { data: existingPerson } = await supabase.from('people').select('id').eq('full_name', credit.name).single();
                    if (existingPerson) {
                        personId = existingPerson.id;
                    } else {
                        const { data: newPerson } = await supabase.from('people').insert({ full_name: credit.name }).select().single();
                        personId = newPerson.id;
                    }
                    return { film_id: newFilmId, person_id: personId, role_id: credit.roleId };
                }));
                 await supabase.from('film_credits').insert(creditsToInsert);
            }

            alert('Filme salvo com sucesso!');
            filmForm.reset();
            posterPreviewImage.src = "";
            posterPreviewContainer.style.display = 'none';
            credits = [];
            renderCredits();
            moreLinks = [];
            renderLinks();
            choicesInstances.category_ids.clearStore();
            choicesInstances.genre_ids.clearStore();
            
            // Resetar os dropdowns de orçamento
            document.getElementById('production_budget_range_id').innerHTML = '<option value="">Escolha a moeda primeiro</option>';
            document.getElementById('production_budget_range_id').disabled = true;

        } catch (error) {
            console.error("ERRO GERAL AO SALVAR O FILME:", error);
            alert(`Ocorreu um erro: ${error.message}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'salvar filme';
        }
    }

    // ===================================================================
    // LÓGICA DE DROPDOWNS DEPENDENTES (DINÂMICA) - ATUALIZADA
    // ===================================================================
    function setupDependentDropdowns() {
        const currencySelect = document.getElementById('currency_id');
        const budgetRangeSelect = document.getElementById('production_budget_range_id');

        if (!currencySelect || !budgetRangeSelect) {
            console.warn("Dropdowns de moeda ou faixa de orçamento não encontrados.");
            return;
        }

        currencySelect.addEventListener('change', async (event) => {
            const selectedOption = currencySelect.options[currencySelect.selectedIndex];
            
            // A MÁGICA ACONTECE AQUI: Lemos o data-code (ex: "BRL", "USD")
            const currencyCode = selectedOption.dataset.code;

            budgetRangeSelect.innerHTML = '<option value="">Carregando faixas...</option>';
            budgetRangeSelect.disabled = true;

            if (!currencyCode) {
                budgetRangeSelect.innerHTML = '<option value="">Escolha a moeda primeiro</option>';
                return;
            }

            // AQUI ESTÁ A MUDANÇA: Chamamos a nova função dinâmica do serviço
            const ranges = await window.CurrencyService.getDynamicBudgetRanges(supabase, currencyCode);

            if (ranges && ranges.length > 0) {
                budgetRangeSelect.innerHTML = '<option value="">Selecione uma faixa...</option>';
                ranges.forEach(range => {
                    // O 'range.range_label' é o valor formatado (ex: "R$ 5.150 - R$ 25.750")
                    // O 'range.id' é o ID da faixa mestre em USD.
                    budgetRangeSelect.appendChild(new Option(range.range_label, range.id));
                });
                budgetRangeSelect.disabled = false;
            } else {
                budgetRangeSelect.innerHTML = '<option value="">Nenhuma faixa encontrada</option>';
                console.warn(`Nenhuma faixa de orçamento retornada pelo CurrencyService para ${currencyCode}.`);
            }
        });
        console.log("Listeners para dropdowns dependentes (DINÂMICOS) configurados.");
    }

    // ===================================================================
    // LÓGICA DAS LISTAS DINÂMICAS (CRÉDITOS E LINKS)
    // (Nenhuma alteração aqui, código 100% idêntico ao original)
    // ===================================================================
    function renderCredits() {
        creditsList.innerHTML = '';
        if (credits.length === 0) return;
        credits.forEach(credit => {
            const listItem = document.createElement('li');
            listItem.className = 'credit-item';
            listItem.style = 'display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--color-border);';
            listItem.innerHTML = `
                <span class="credit-text" style="font-size:0.85rem; color:var(--color-text-primary);">
                    <strong>${credit.name}</strong> — ${credit.roleName}
                </span>
                <div class="actions">
                    <button type="button" class="btn-gst-film btn-edit-credit" data-id="${credit.id}" title="Editar crédito"><img src="public/icons/icon-film-edit.svg" alt="Editar" style="pointer-events: none;"/></button>
                    <button type="button" class="btn-gst-film btn-delete-credit" data-id="${credit.id}" title="Excluir crédito"><img src="public/icons/icon-film-x.svg" alt="Excluir" style="pointer-events: none;"/></button>
                </div>
            `;
            creditsList.appendChild(listItem);
        });
    }

    function handleAddOrUpdateCredit() {
        if (currentlyEditingCreditId !== null) {
            handleUpdateCredit(currentlyEditingCreditId);
        } else {
            handleAddCredit();
        }
    }

    function handleAddCredit() {
        const name = creditNameInput.value.trim();
        const roleId = creditRoleSelect.value;
        const roleName = creditRoleSelect.options[creditRoleSelect.selectedIndex].text;
        if (!name || !roleId) {
            alert("Por favor, preencha o nome e a função do crédito.");
            return;
        }
        credits.push({ id: Date.now(), name, roleId, roleName });
        renderCredits();
        creditNameInput.value = '';
        creditRoleSelect.value = '';
    }

    function handleEditCredit(id) {
        const creditToEdit = credits.find(credit => credit.id === id);
        if (!creditToEdit) return;
        creditNameInput.value = creditToEdit.name;
        creditRoleSelect.value = creditToEdit.roleId;
        currentlyEditingCreditId = id;
        addCreditBtn.innerHTML = '<img src="public/icons/icon-check.svg" alt="Salvar alteração" style="width: 16px; height: 16px;" />';
        addCreditBtn.title = 'Salvar alteração';
        creditNameInput.focus();
    }

    function handleUpdateCredit(id) {
        const name = creditNameInput.value.trim();
        const roleId = creditRoleSelect.value;
        const roleName = creditRoleSelect.options[creditRoleSelect.selectedIndex].text;
        if (!name || !roleId) {
            alert("Por favor, preencha o nome e a função do crédito.");
            return;
        }
        const creditIndex = credits.findIndex(credit => credit.id === id);
        if (creditIndex > -1) {
            credits[creditIndex] = { ...credits[creditIndex], name, roleId, roleName };
        }
        resetCreditForm();
        renderCredits();
    }

    function handleDeleteCredit(id) {
        credits = credits.filter(credit => credit.id !== id);
        if (currentlyEditingCreditId === id) {
            resetCreditForm();
        }
        renderCredits();
    }

    function resetCreditForm() {
        creditNameInput.value = '';
        creditRoleSelect.value = '';
        currentlyEditingCreditId = null;
        addCreditBtn.innerHTML = originalAddCreditIcon;
        addCreditBtn.title = 'Adicionar crédito';
    }

    function renderLinks() {
        linksList.innerHTML = '';
        if (moreLinks.length === 0) return;
        moreLinks.forEach(link => {
            const listItem = document.createElement('li');
            listItem.className = 'link-item';
            listItem.style = 'display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--color-border);';
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
        if (currentlyEditingLinkId !== null) {
            handleUpdateLink(currentlyEditingLinkId);
        } else {
            handleAddLink();
        }
    }

    function handleAddLink() {
        const name = linkNameInput.value.trim();
        const url = externalLinkInput.value.trim();
        if (!name || !url) {
            alert("Por favor, preencha o nome e a URL do link.");
            return;
        }
        try { new URL(url); } catch (_) {
            alert("Por favor, insira uma URL válida (ex: https://exemplo.com).");
            return;
        }
        moreLinks.push({ id: Date.now(), name, url });
        renderLinks();
        linkNameInput.value = '';
        externalLinkInput.value = '';
    }

    function handleEditLink(id) {
        const linkToEdit = moreLinks.find(link => link.id === id);
        if (!linkToEdit) return;
        linkNameInput.value = linkToEdit.name;
        externalLinkInput.value = linkToEdit.url;
        currentlyEditingLinkId = id;
        addLinkBtn.innerHTML = '<img src="public/icons/icon-check.svg" alt="Salvar alteração" style="width: 16px; height: 16px;" />';
        addLinkBtn.title = 'Salvar alteração';
        linkNameInput.focus();
    }

    function handleUpdateLink(id) {
        const name = linkNameInput.value.trim();
        const url = externalLinkInput.value.trim();
        if (!name || !url) { alert("Por favor, preencha o nome e a URL do link."); return; }
        try { new URL(url); } catch (_) { alert("Por favor, insira uma URL válida (ex: https://exemplo.com)."); return; }
        const linkIndex = moreLinks.findIndex(link => link.id === id);
        if (linkIndex > -1) {
            moreLinks[linkIndex] = { ...moreLinks[linkIndex], name, url };
        }
        resetLinkForm();
        renderLinks();
    }

    function handleDeleteLink(id) {
        moreLinks = moreLinks.filter(link => link.id !== id);
        if (currentlyEditingLinkId === id) {
            resetLinkForm();
        }
        renderLinks();
    }
    
    function resetLinkForm() {
        linkNameInput.value = '';
        externalLinkInput.value = '';
        currentlyEditingLinkId = null;
        addLinkBtn.innerHTML = originalAddLinkIcon;
        addLinkBtn.title = 'Adicionar link';
    }
    
    function setupDynamicListListeners() {
        addCreditBtn.addEventListener('click', handleAddOrUpdateCredit);
        addLinkBtn.addEventListener('click', handleAddOrUpdateLink);
        creditsList.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const id = parseInt(button.dataset.id);
            if (button.classList.contains('btn-delete-credit')) {
                handleDeleteCredit(id);
            }
            if (button.classList.contains('btn-edit-credit')) {
                handleEditCredit(id);
            }
        });
        linksList.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            const id = parseInt(button.dataset.id);
            if (button.classList.contains('btn-delete-link')) {
                handleDeleteLink(id);
            }
            if (button.classList.contains('btn-edit-link')) {
                 handleEditLink(id);
            }
        });
        console.log("Listeners para listas dinâmicas configurados.");
    }

    // ===================================================================
    // LÓGICA DE UPLOAD DO CARTAZ
    // (Nenhuma alteração aqui, código 100% idêntico ao original)
    // ===================================================================
    function setupPosterUploadListeners() {
        if (!posterUploadBtn || !posterUploadInput) {
            console.error("Botão ou input de upload do cartaz não encontrado.");
            return;
        }
        posterUploadBtn.addEventListener('click', () => posterUploadInput.click());
        posterUploadInput.addEventListener('change', handlePosterFileSelection);
        console.log("Listeners para upload de cartaz configurados.");
    }

    function handlePosterFileSelection(event) {
        const file = event.target.files[0];
        if (!file) return;
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_FILE_SIZE) {
            alert(`O arquivo é muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). O tamanho máximo permitido é de 5MB.`);
            posterUploadInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            if (croppieInstance) {
                croppieInstance.destroy();
            }
            posterPreviewContainer.style.display = 'block';
            croppieInstance = new Croppie(posterPreviewImage, {
                viewport: { width: 200, height: 300 },
                boundary: { width: '100%', height: 320 },
                showZoomer: true,
                enableOrientation: true
            });
            croppieInstance.bind({ url: e.target.result }).then(() => {
                 generateOptimizedBlob();
            });
        };
        reader.readAsDataURL(file);
    }
    
    async function generateOptimizedBlob() {
        if (!croppieInstance) return;
        console.log("Gerando blob otimizado...");
        const blob = await croppieInstance.result({
            type: 'blob', size: { width: 400 }, format: 'jpeg',
            quality: 0.75, circle: false
        });
        const previewUrl = URL.createObjectURL(blob);
        croppieInstance.destroy();
        croppieInstance = null;
        posterPreviewImage.src = previewUrl;
        posterPreviewImage.style.display = 'block';
        posterFileForUpload = blob;
        console.log("Arquivo de cartaz processado e pronto para envio. Tamanho:", `${(blob.size / 1024).toFixed(1)} KB`);
    }

    // ===================================================================
    // FUNÇÕES DE INICIALIZAÇÃO (Populate, Choices, Mask)
    // (Nenhuma alteração aqui, código 100% idêntico ao original)
    // ===================================================================
    async function populateSelects() {
    console.log("Iniciando a população dos campos de seleção...");
    const displayColumnMap = {
        countries: 'country',
        currencies: 'name', // Usado para popular o select de moedas
        film_types: 'type',
        languages: 'name',
        // 'budget_ranges' não é mais populado aqui, é dinâmico
        categories: 'category',
        genres: 'genre',
        crew_roles: 'role_name',
        aspect_ratios: 'name',
        color_modes: 'name',
        recording_formats: 'name'
    };
    const selects = document.querySelectorAll('select[data-source]');

    // ===================================================================
    // INÍCIO DA MUDANÇA (LÓGICA DO "MATCH")
    // ===================================================================

    // 1. Primeiro, buscamos a lista de TODOS os códigos de moeda válidos 
    //    da nossa tabela de taxas de câmbio (que é preenchida pela API)
    let validCurrencyCodes = null;
    try {
        const { data, error } = await supabase
            .from('exchange_rates')
            .select('target_currency_code'); // Ex: [{target_currency_code: 'BRL'}, {target_currency_code: 'AOA'}, ...]
        
        if (error) throw error;
        
        // Converte o array de objetos em um array simples de strings: ['BRL', 'AOA', 'USD', ...]
        validCurrencyCodes = data.map(item => item.target_currency_code);
        
        // Adicionamos 'USD' manualmente caso a API não o inclua (base vs target)
        if (!validCurrencyCodes.includes('USD')) {
            validCurrencyCodes.push('USD');
        }
        
    } catch (error) {
        console.error("Erro crítico ao buscar lista de moedas válidas em 'exchange_rates':", error.message);
        // Se isso falhar, não podemos popular o dropdown de moedas corretamente.
    }
    // ===================================================================
    // FIM DA MUDANÇA
    // ===================================================================

    for (const select of selects) {
        const tableName = select.dataset.source;
        if (!tableName) continue;

        select.innerHTML = '';
        if (!select.multiple) {
            select.appendChild(new Option('Selecione...', ''));
        }

        // Lógica especial para a tabela de moedas (AGORA COM FILTRO)
        if (tableName === 'currencies') {
            
            // ===================================================================
            // INÍCIO DA MUDANÇA (LÓGICA DO "MATCH")
            // ===================================================================
            if (!validCurrencyCodes) {
                 select.innerHTML = `<option value="">Erro ao carregar moedas</option>`;
                 continue; // Pula para o próximo select no loop
            }
            
            try {
                // 2. AGORA, buscamos na tabela 'currencies', MAS FILTRAMOS 
                //    usando o operador '.in()' para pegar apenas as moedas 
                //    cujo 'iso_code' está na nossa lista 'validCurrencyCodes'.
                const { data, error } = await supabase
                    .from('currencies')
                    .select('id, name, iso_code')
                    .in('iso_code', validCurrencyCodes) // <-- A MÁGICA DO "MATCH"
                    .order('name', { ascending: true });
                
                if (error) throw error;
                
                data.forEach(item => {
                    const optionText = `${item.name} (${item.iso_code})`;
                    const option = new Option(optionText, item.id);
                    option.dataset.code = item.iso_code; // Essencial para o dropdown dependente
                    select.appendChild(option);
                });
            // ===================================================================
            // FIM DA MUDANÇA
            // ===================================================================
            
            } catch (error) {
                console.error(`Erro ao buscar dados filtrados para a tabela ${tableName}:`, error.message);
                select.innerHTML = `<option value="">Erro ao carregar</option>`;
            }
        
        } else if (tableName === 'crew_roles') {
            // Lógica de agrupamento para crew_roles (sem alterações)
            try {
                const { data, error } = await supabase.from('crew_roles').select('id, role_name, department').order('department').order('role_name');
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
                    groupedByDept[department].forEach(role => {
                        optgroup.appendChild(new Option(role.role_name, role.id));
                    });
                    select.appendChild(optgroup);
                }
            } catch (error) {
                 console.error(`Erro ao buscar e agrupar dados para ${tableName}:`, error.message);
                 select.innerHTML = `<option value="">Erro ao carregar</option>`;
            }
        } else {
            // Lógica padrão para todos os outros selects (sem alterações)
            try {
                const displayColumn = displayColumnMap[tableName] || 'name';
                const { data, error } = await supabase.from(tableName).select(`id, ${displayColumn}`).order(displayColumn, { ascending: true });
                if (error) throw error;
                data.forEach(item => {
                    select.appendChild(new Option(item[displayColumn], item.id));
                });
            } catch (error) {
                console.error(`Erro ao buscar dados para a tabela ${tableName}:`, error.message);
                select.innerHTML = `<option value="">Erro ao carregar</option>`;
            }
        }
    }
    console.log("População dos campos de seleção finalizada.");
}
    
    function initializeChoices() {
        console.log("Inicializando Choices.js...");
        const categorySelect = document.getElementById('category_ids');
        const genreSelect = document.getElementById('genre_ids');
        if (categorySelect && genreSelect) {
            choicesInstances.category_ids = new Choices(categorySelect, {
                removeItemButton: true, placeholder: true, placeholderValue: 'Selecione uma ou mais categorias',
                noResultsText: 'Nenhum resultado encontrado', itemSelectText: 'Pressione para selecionar',
            });
            choicesInstances.genre_ids = new Choices(genreSelect, {
                removeItemButton: true, placeholder: true, placeholderValue: 'Selecione um ou mais gêneros',
                noResultsText: 'Nenhum resultado encontrado', itemSelectText: 'Pressione para selecionar',
            });
            console.log("Choices.js inicializado com sucesso.");
        } else {
            console.warn("Não foi possível encontrar os selects de categoria ou gênero.");
        }
    }

    function initializeInputMasks() {
        const durationInput = document.getElementById('duration_in_seconds');
        if (!durationInput) {
            console.warn("Input de duração não encontrado para aplicar a máscara.");
            return;
        }
        const durationMask = IMask(durationInput, {
            mask: 'MM:SS',
            blocks: {
                MM: {
                    mask: Number,
                    min: 0,
                    max: 999
                },
                SS: {
                    mask: IMask.MaskedRange,
                    from: 0,
                    to: 59,
                    maxLength: 2
                }
            }
        });
        console.log("Máscara de duração inicializada.");
    }

    // ===================================================================
    // FUNÇÃO DE INICIALIZAÇÃO DA PÁGINA
    // ===================================================================
    async function initMyFilmsPage() {
        await populateSelects();
        initializeChoices();
        setupPosterUploadListeners();
        setupDynamicListListeners();
        initializeInputMasks();
        setupDependentDropdowns(); // Chama a nova versão dinâmica
        filmForm.addEventListener('submit', handleFilmSubmit);
    }

    initMyFilmsPage();
});