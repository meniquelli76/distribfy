// js/myfilms.js (Revisão 6 - Wizard Multi-Step)

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
    let credits = []; // Armazena { id: Date.now(), name: 'Nome', roleId: 1, roleName: 'Diretor', personId: 123 (do DB crew_members) }
    let moreLinks = [];
    let collaborators = [];
    let currentlyEditingCreditId = null;
    let currentlyEditingLinkId = null;
    let posterFileForUpload = null;
    let croppieInstance = null;
    let choicesInstances = {};

    // Estado do Perfil do Usuário
    let currentAuthUserId = null; // Armazena o UUID do Auth
    let currentProfileId = null;  // Armazena o ID INT4 da tabela users
    let currentProfileName = "Meu Perfil"; // Valor Padrão
    let currentProfileRole = null;
    let currentProfilePlan = null;

    const filmForm = document.getElementById('film-form');
    const posterUploadBtn = document.getElementById('poster-upload-btn');
    const posterUploadInput = document.getElementById('poster-upload');
    const posterPreviewContainer = document.getElementById('poster-preview');
    const posterPreviewImage = posterPreviewContainer ? posterPreviewContainer.querySelector('img') : null;
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

    // NOVOS Seletores para Produtor/Responsável (baseado nos créditos)
    const producerPersonSelect = document.getElementById('producer_person_id');
    const distributionLeadPersonSelect = document.getElementById('distribution_lead_person_id');

    // Seletores para o campo fixo da Distribuidora
    const distributorDisplayGroup = document.getElementById('distributor-display-group');
    const distributorNameDisplay = document.getElementById('distributor_name_display');
    const distributorProfileIdInput = document.getElementById('distributor_profile_id'); // O hidden input
    const distributorSelectGroup = document.getElementById('distributor-select-group'); // O select antigo (agora escondido)

    const distributorFieldsWrapper = document.getElementById('distributor-fields-wrapper');
    const invitesWrapper = document.getElementById('invites-wrapper');

    // ===================================================================
    // ESTADO E SELETORES DO WIZARD (FORMULÁRIO MULTI-ETAPAS) - (PARTE 1)
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
        
        // Validação final (segurança) - valida o último passo antes de submeter
        if (!validateStep(currentStep)) {
            alert("Por favor, corrija os erros no passo atual antes de salvar.");
            return;
        }
        
        const submitButton = btnSubmitFilm; // Usa o botão correto do wizard
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando...';

        try {
            // Garante que temos os IDs (UUID e INT4)
            if (!currentProfileId || !currentAuthUserId) {
                 await populateProfileSelects(); // Tenta buscar de novo
                 if (!currentProfileId || !currentAuthUserId) throw new Error('Não foi possível identificar o perfil completo do usuário.');
            }
            const ownerIdToSave = currentProfileId; // INT4
            const ownerUuidToSave = currentAuthUserId; // UUID

            let posterThumbnailUrl = null;
            if (posterFileForUpload) {
                // Usa o UUID do Auth (ownerUuidToSave) para o path do storage
                const fileExt = 'jpeg';
                const fileName = `${ownerUuidToSave}-${Date.now()}.${fileExt}`;
                const filePath = `${ownerUuidToSave}/${fileName}`;
                const { error: uploadError } = await supabase.storage.from('film-posters').upload(filePath, posterFileForUpload);
                if (uploadError) throw new Error(`Falha no upload do cartaz: ${uploadError.message}`);
                const { data: urlData } = supabase.storage.from('film-posters').getPublicUrl(filePath);
                posterThumbnailUrl = urlData.publicUrl;
            }


            const formData = new FormData(filmForm);
            const filmObject = {};
            for (const [key, value] of formData.entries()) {
                 // Pega apenas valores não vazios
                 if (value && value !== '') filmObject[key] = value;
            }

            if (filmObject.completion_date) {
                try {
                    const parts = filmObject.completion_date.split('/'); // Ex: ["30", "01", "2025"]
                    if (parts.length === 3) {
                        const isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // Ex: "2025-01-30"
                        filmObject.completion_date = isoDate;
                    } else {
                        throw new Error("Formato de data inesperado.");
                    }
                } catch (e) {
                    console.error("Erro ao formatar data:", e, filmObject.completion_date);
                    throw new Error(`Data de finalização inválida: ${filmObject.completion_date}`);
                }
            }

            if (filmObject.duration_in_seconds) {
                 const parts = filmObject.duration_in_seconds.split(':');
                 const minutes = parseInt(parts[0], 10) || 0;
                 const seconds = parseInt(parts[1], 10) || 0;
                 filmObject.duration_in_seconds = (minutes * 60) + seconds;
            }


            // Define o owner_profile_id (INT4)
            filmObject.owner_profile_id = ownerIdToSave;
            if(posterThumbnailUrl) filmObject.poster_thumbnail_url = posterThumbnailUrl;

            filmObject.is_debut = filmObject.is_debut === 'true';
            filmObject.is_student_project = filmObject.is_student_project === 'true';

            // Define o distributor_profile_id (UUID)
            if (currentProfileRole === 'distribuidora') {
                 // Pega o UUID do usuário logado (armazenado ao buscar perfil)
                 filmObject.distributor_profile_id = ownerUuidToSave;
                 // Pega o valor do input hidden (que deve conter o mesmo UUID) - redundante mas seguro
                 if (distributorProfileIdInput && distributorProfileIdInput.value) {
                    filmObject.distributor_profile_id = distributorProfileIdInput.value;
                 }
            } else {
                 // Realizador Solo se auto-distribui (salva seu próprio UUID)
                 filmObject.distributor_profile_id = ownerUuidToSave;
            }
            // As colunas producer_person_id (INT4) e distribution_lead_person_id (INT4) já vêm do form data

            // Limpa campos que não pertencem à tabela 'films' ou são gerenciados separadamente
            ['poster_thumbnail', 'credit_name', 'credit_role_id', 'link_name', 'external_link',
             'category_ids', 'genre_ids', 'invite_name', 'invite_email',
             'distributor_profile_id_fallback' // Remove o select antigo
            ].forEach(key => delete filmObject[key]);

            // DEBUG: Loga o objeto final antes de inserir
            console.log("Objeto a ser inserido em 'films':", JSON.stringify(filmObject, null, 2));


            // Insere o filme
            const { data: newFilm, error: filmInsertError } = await supabase.from('films').insert([filmObject]).select().single();
            if (filmInsertError) {
                 console.error("Erro detalhado do Supabase ao inserir filme:", filmInsertError);
                 let userMessage = `Falha ao salvar o filme: ${filmInsertError.message}`;
                 if (filmInsertError.message.includes('violates foreign key constraint') && (filmInsertError.message.includes('producer_person_id') || filmInsertError.message.includes('distribution_lead_person_id'))) {
                    userMessage += "\nVerifique se o Produtor Principal e o Responsável pela Inscrição foram selecionados corretamente a partir dos créditos.";
                 } else if (filmInsertError.message.includes('violates foreign key constraint') && filmInsertError.message.includes('distributor_profile_id')) {
                     userMessage += "\nOcorreu um problema ao identificar a distribuidora (UUID inválido?).";
                 }
                 throw new Error(userMessage);
            }
             if (!newFilm && !filmInsertError) {
                 console.warn("Filme inserido, mas RLS impediu o SELECT de retorno.");
             }

             // Busca o ID do filme recém-criado (Fallback se RLS bloqueou o SELECT)
             let newFilmId = null; // INT4
             if (newFilm) {
                 newFilmId = newFilm.id;
             } else {
                 const { data: latestFilm, error: fetchError } = await supabase.from('films').select('id').eq('owner_profile_id', ownerIdToSave).order('created_at', { ascending: false }).limit(1).single();
                 if (fetchError || !latestFilm) throw new Error("Falha ao obter ID do filme após a criação.");
                 newFilmId = latestFilm.id;
             }
             console.log("ID do filme salvo/recuperado:", newFilmId);


            // Salva Categorias e Gêneros
             if (choicesInstances.category_ids) {
                 const categoryIds = choicesInstances.category_ids.getValue(true);
                 if (categoryIds && categoryIds.length > 0) {
                     const categoriesToInsert = categoryIds.map(id => ({ film_id: newFilmId, category_id: id }));
                     await supabase.from('film_category_assignments').insert(categoriesToInsert);
                 }
             }
             if (choicesInstances.genre_ids) {
                  const genreIds = choicesInstances.genre_ids.getValue(true);
                  if (genreIds && genreIds.length > 0) {
                      const genresToInsert = genreIds.map(id => ({ film_id: newFilmId, genre_id: id }));
                      await supabase.from('film_genre_assignments').insert(genresToInsert);
                  }
             }


            // Salva Créditos
            if (credits.length > 0) {
                 const validCredits = credits.filter(c => c.personId); // Garante que temos personId (INT4)
                 if (validCredits.length !== credits.length) {
                     console.warn("Alguns créditos foram adicionados sem um ID de pessoa válido e não serão salvos.");
                 }
                 if (validCredits.length > 0) {
                     const creditsToInsert = validCredits.map(credit => ({
                         film_id: newFilmId,
                         person_id: credit.personId, // INT4
                         role_id: credit.roleId
                     }));
                     const { error: creditError } = await supabase.from('film_credits').insert(creditsToInsert);
                     if (creditError) {
                          console.warn("Filme salvo, mas falha ao salvar créditos:", creditError.message);
                     }
                 }
            }

            // Salva Colaboradores (Convites) - Usa UUID
            if (collaborators.length > 0) {
                 const invitesToInsert = collaborators.map(invite => ({
                     film_id: newFilmId, // INT4
                     invited_by_profile_id: ownerUuidToSave, // UUID de quem convidou
                     invited_email: invite.email,
                     invited_name: invite.name,
                     status: 'pending'
                 }));
                 const { error: inviteError } = await supabase.from('film_invitations').insert(invitesToInsert);
                 if (inviteError) {
                     console.warn("Filme salvo, mas falha ao salvar convites:", inviteError.message);
                 }
            }


            alert('Filme salvo com sucesso!');
            filmForm.reset();
            // Reset completo
            if (posterPreviewImage) posterPreviewImage.src = "";
            if (posterPreviewContainer) posterPreviewContainer.style.display = 'none';
            posterFileForUpload = null;
            if(croppieInstance) { croppieInstance.destroy(); croppieInstance = null; }
            credits = []; renderCredits(); updateCreditRoleSelects();
            moreLinks = []; renderLinks();
            collaborators = []; renderInvites();
            if (choicesInstances.category_ids) choicesInstances.category_ids.clearStore();
            if (choicesInstances.genre_ids) choicesInstances.genre_ids.clearStore();
            await populateProfileSelects(); // Repopula "Meu Perfil"
            updateFormVisibility(currentProfileRole, currentProfilePlan); // Reaplica visibilidade
            document.getElementById('production_budget_range_id').innerHTML = '<option value="">Escolha a moeda primeiro</option>';
            document.getElementById('production_budget_range_id').disabled = true;
            
            // RESET DO WIZARD
            currentStep = 1;
            showStep(1);

        } catch (error) {
            console.error("ERRO GERAL AO SALVAR O FILME:", error); // Log completo no console
            alert(`Ocorreu um erro ao salvar:\n${error.message}`); // Mensagem para o usuário
        } finally {
            if(submitButton) {
               submitButton.disabled = false;
               submitButton.textContent = 'Salvar Filme'; // Texto correto do botão de submit
            }
        }
    }


    // ===================================================================
    // LÓGICA DE UI "INTELIGENTE" (ATUALIZADA para campo fixo)
    // ===================================================================
    function updateFormVisibility(role, plan) {
        console.log(`Atualizando UI para Role: ${role}, Plan: ${plan}`);

        // Esconde tudo por padrão para evitar piscar
        if (distributorFieldsWrapper) distributorFieldsWrapper.style.display = 'none';
        if (invitesWrapper) invitesWrapper.style.display = 'none';
        if (distributorDisplayGroup) distributorDisplayGroup.style.display = 'none';
        if (distributorSelectGroup) distributorSelectGroup.style.display = 'none';

        if (role === 'realizador_solo') {
            // Realizador Solo não vê campos de distribuição
            if (plan !== 'free' && invitesWrapper) { // Mostra convites apenas se não for free
                 invitesWrapper.style.display = 'block';
            }
        } else if (role === 'distribuidora') {
            // Distribuidora vê tudo e tem campo fixo
            if (distributorFieldsWrapper) {
                 distributorFieldsWrapper.style.display = 'block';
                 if (distributorDisplayGroup && distributorNameDisplay && distributorProfileIdInput) {
                     distributorDisplayGroup.style.display = 'block'; // Mostra o campo fixo
                     // O preenchimento do nome e ID foi movido para populateProfileSelects
                     console.log("Campo fixo da distribuidora (wrapper) habilitado.");
                 } else {
                      console.error("Elementos do campo fixo da distribuidora não encontrados!");
                 }
            }
            if (invitesWrapper) {
                invitesWrapper.style.display = 'block';
            }
        } else {
             console.warn("Role do usuário desconhecido ou não definido:", role);
             // Default: esconde tudo se o role for desconhecido
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
         if (!currencySelect || !budgetRangeSelect) return;
         currencySelect.addEventListener('change', async (event) => {
             const selectedOption = currencySelect.options[currencySelect.selectedIndex];
             const currencyCode = selectedOption.dataset.code;
             budgetRangeSelect.innerHTML = '<option value="">Carregando faixas...</option>';
             budgetRangeSelect.disabled = true;
             if (!currencyCode) {
                 budgetRangeSelect.innerHTML = '<option value="">Escolha a moeda primeiro</option>';
                 return;
             }
             const ranges = await window.CurrencyService.getDynamicBudgetRanges(supabase, currencyCode);
             if (ranges && ranges.length > 0) {
                 budgetRangeSelect.innerHTML = '<option value="">Selecione uma faixa...</option>';
                 ranges.forEach(range => {
                     budgetRangeSelect.appendChild(new Option(range.range_label, range.id));
                 });
                 budgetRangeSelect.disabled = false;
             } else {
                 budgetRangeSelect.innerHTML = '<option value="">Nenhuma faixa encontrada</option>';
             }
         });
         console.log("Listeners para dropdowns dependentes (DINÂMICOS) configurados.");
     }

    // ===================================================================
    // LÓGICA DE VALIDAÇÃO DO WIZARD (MULTI-ETAPAS) - (PARTE 2)
    // ===================================================================

    /**
     * Exibe uma mensagem de erro de validação para um campo.
     * @param {HTMLElement} element - O elemento do formulário (input, select) que falhou.
     * @param {string} message - A mensagem de erro a ser exibida.
     */
    function showValidationError(element, message) {
        // Encontra o .form-group pai para aplicar a classe de erro
        const formGroup = element.closest('.form-group');
        if (!formGroup) return;
        formGroup.classList.add('error');

        // Encontra ou cria o elemento da mensagem de erro
        let messageEl = formGroup.querySelector('.validation-message');
        if (!messageEl) {
            messageEl = document.createElement('span');
            messageEl.className = 'validation-message';
            // Insere a mensagem após o elemento ou seu 'wrapper' (como .select-wrapper)
            const inputWrapper = formGroup.querySelector('.select-wrapper, .input-icon, .choices') || element;
            inputWrapper.parentNode.insertBefore(messageEl, inputWrapper.nextSibling);
        }
        
        messageEl.textContent = message;
        messageEl.classList.add('visible');
    }

    /**
     * Limpa a mensagem de erro de validação de um campo.
     * @param {HTMLElement} element - O elemento do formulário.
     */
    function clearValidationError(element) {
        const formGroup = element.closest('.form-group');
        if (!formGroup) return;
        formGroup.classList.remove('error');
        
        const messageEl = formGroup.querySelector('.validation-message');
        if (messageEl) {
            messageEl.classList.remove('visible');
        }
    }

    /**
     * Validador genérico para um campo (input, select).
     * @param {string} elementId - O ID do elemento a ser validado.
     * @param {string} message - A mensagem de erro.
     * @returns {boolean} - true se for válido, false se não.
     */
    function validateField(elementId, message) {
        const element = document.getElementById(elementId);
        if (!element) return false; // Segurança

        if (!element.value || (element.type === 'select-one' && element.value === '')) {
            showValidationError(element, message);
            return false;
        }
        
        clearValidationError(element);
        return true;
    }

    /**
     * Validador específico para campos Choices.js (múltipla seleção).
     * @param {string} elementId - O ID do <select> original.
     * @param {string} message - A mensagem de erro.
     * @returns {boolean} - true se for válido, false se não.
     */
    function validateChoices(elementId, message) {
        const instance = choicesInstances[elementId];
        const element = document.getElementById(elementId); // O <select> original
        
        if (!instance || instance.getValue(true).length === 0) {
            showValidationError(element, message);
            return false;
        }
        
        clearValidationError(element);
        return true;
    }


    /**
     * Roda a validação para um passo específico do wizard.
     * @param {number} stepNumber - O número do passo a ser validado.
     * @returns {boolean} - true se o passo for válido.
     */
    function validateStep(stepNumber) {
        let isValid = true;
        // Limpa todos os erros antes de revalidar
        document.querySelectorAll(`#form-step-${stepNumber} .form-group.error`).forEach(group => {
            group.classList.remove('error');
            const msg = group.querySelector('.validation-message');
            if (msg) msg.classList.remove('visible');
        });

        switch (stepNumber) {
            case 1: // Básico
                isValid = validateField('title', 'O título é obrigatório.') && isValid;
                isValid = validateField('completion_date', 'A data é obrigatória.') && isValid;
                isValid = validateField('currency_id', 'A moeda é obrigatória.') && isValid;
                isValid = validateField('production_budget_range_id', 'A faixa de orçamento é obrigatória.') && isValid;
                isValid = validateField('distribution_budget_amount', 'O orçamento é obrigatório.') && isValid;
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
                // Só valida se os campos estiverem visíveis (ex: Role 'distribuidora')
                if (distributorFieldsWrapper && distributorFieldsWrapper.style.display !== 'none') {
                    isValid = validateField('producer_person_id', 'Selecione o Produtor Principal.') && isValid;
                    isValid = validateField('distribution_lead_person_id', 'Selecione o Responsável pela Inscrição.') && isValid;
                }
                break;
            
            case 5: // Mídia
                isValid = validateField('media_link', 'O link do filme é obrigatório.') && isValid;
                break;
        }
        
        // Se houver erros, foca no primeiro campo inválido
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
    // LÓGICA DE NAVEGAÇÃO DO WIZARD (MULTI-ETAPAS) - (PARTE 3)
    // ===================================================================

    /**
     * Atualiza a barra de progresso e a visibilidade dos botões.
     */
    function updateWizardUI() {
        // Atualiza a barra de progresso
        allProgressSteps.forEach((step, index) => {
            const stepNum = index + 1;
            step.classList.remove('active', 'completed');
            if (stepNum < currentStep) {
                step.classList.add('completed');
            } else if (stepNum === currentStep) {
                step.classList.add('active');
            }
        });

        // Atualiza os botões
        if (currentStep === 1) {
            btnPrevStep.style.display = 'none';
            btnNextStep.style.display = 'inline-flex';
            btnSubmitFilm.style.display = 'none';
        } else if (currentStep === totalSteps) {
            btnPrevStep.style.display = 'inline-flex';
            btnNextStep.style.display = 'none';
            btnSubmitFilm.style.display = 'inline-flex';
        } else {
            btnPrevStep.style.display = 'inline-flex';
            btnNextStep.style.display = 'inline-flex';
            btnSubmitFilm.style.display = 'none';
        }
    }

    /**
     * Exibe o passo desejado e oculta os outros.
     * @param {number} stepNumber - O número do passo a ser exibido.
     */
    function showStep(stepNumber) {
        allSteps.forEach((step, index) => {
            step.classList.toggle('active', (index + 1) === stepNumber);
        });
        updateWizardUI();
        // Rola a página para o topo do formulário
        document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Manipulador do clique "Avançar".
     */
    function handleNextStep() {
        if (validateStep(currentStep)) {
            if (currentStep < totalSteps) {
                currentStep++;
                showStep(currentStep);
            }
        }
    }

    /**
     * Manipulador do clique "Voltar".
     */
    function handlePrevStep() {
        if (currentStep > 1) {
            currentStep--;
            showStep(currentStep);
        }
    }

    /**
     * Adiciona os event listeners aos botões do wizard.
     */
    function setupWizardListeners() {
        btnNextStep.addEventListener('click', handleNextStep);
        btnPrevStep.addEventListener('click', handlePrevStep);
        
        // O btnSubmitFilm já é 'type="submit"' e será pego pelo listener principal
        console.log("Listeners do Wizard (Próximo/Voltar) configurados.");
    }


    // ===================================================================
    // LÓGICA DAS LISTAS DINÂMICAS (CRÉDITOS - ATUALIZADA)
    // ===================================================================

    // ATUALIZADA: Agora busca/cria personId ao adicionar
    async function handleAddCredit() {
        if (!creditNameInput || !creditRoleSelect) return;
        const name = creditNameInput.value.trim();
        const roleId = creditRoleSelect.value;
        const roleName = creditRoleSelect.options[creditRoleSelect.selectedIndex].text;

        if (!name || !roleId) {
            alert("Por favor, preencha o nome e a função do crédito.");
            return;
        }

        let personId = null; // INT4
        try {
            // Lógica para dividir 'full_name' em 'first_name' e 'last_name'
            const nameParts = name.split(' ');
            const firstName = nameParts[0] || ''; 
            const lastName = nameParts.slice(1).join(' ') || '';

            if (!firstName && !lastName) {
                 if (nameParts.length === 1 && nameParts[0]) {
                     console.warn(`Salvando crédito com nome único: ${name}`);
                 } else {
                     alert("Nome inválido.");
                     return;
                 }
            }

            // ======================================================
            // CORREÇÃO: Apontando para 'crew_members'
            // ======================================================
            const { data: existingPerson, error: findError } = await supabase
                .from('crew_members') // <-- CORRIGIDO (era 'people')
                .select('id')
                 .eq('first_name', firstName) // <-- CORRIGIDO (era 'full_name')
                 .eq('last_name', lastName)  // <-- CORRIGIDO
                .maybeSingle();

            if (findError) throw findError;

            if (existingPerson) {
                personId = existingPerson.id;
                console.log(`Pessoa encontrada em 'crew_members': ${name} (ID: ${personId})`);
            } else {
                console.log(`Pessoa não encontrada, criando em 'crew_members': ${name}`);
                const { data: newPerson, error: insertError } = await supabase
                    .from('crew_members') // <-- CORRIGIDO (era 'people')
                     .insert({ first_name: firstName, last_name: lastName }) // <-- CORRIGIDO (era {full_name: name})
                    .select('id')
                    .single();

                if (insertError) throw insertError;
                if (!newPerson) throw new Error("Falha ao criar nova pessoa, ID não retornado.");

                personId = newPerson.id;
                console.log(`Pessoa criada: ${name} (ID: ${personId})`);
            }
            // ======================================================
            // FIM DA CORREÇÃO
            // ======================================================

        } catch (error) {
             console.error("Erro ao buscar/criar pessoa:", error.message);
             // Ajuste na mensagem de erro para refletir a RLS
             if (error.message.includes('violates row level security policy')) {
                 alert("Falha ao adicionar pessoa. Você não tem permissão (RLS) para inserir na tabela 'crew_members'.");
             } else {
                alert(`Ocorreu um erro ao verificar/adicionar a pessoa '${name}'. O crédito não será adicionado.`);
             }
             return;
        }

        credits.push({ id: Date.now(), name, roleId, roleName, personId });
        renderCredits();
        updateCreditRoleSelects();
        creditNameInput.value = '';
        creditRoleSelect.value = '';
    }

    // ATUALIZADA: Apenas atualiza dados locais
    // NOTA: Se o nome for editado, o personId pode ficar dessincronizado.
    //       Uma solução mais robusta exigiria re-buscar/criar a pessoa aqui.
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
             // Apenas atualiza o nome e role no array local
             credits[creditIndex].name = name;
             credits[creditIndex].roleId = roleId;
             credits[creditIndex].roleName = roleName;
             // O personId original é mantido
         }
         resetCreditForm();
         renderCredits();
         updateCreditRoleSelects();
     }

     function handleDeleteCredit(id) {
         credits = credits.filter(credit => credit.id !== id);
         if (currentlyEditingCreditId === id) resetCreditForm();
         renderCredits();
         updateCreditRoleSelects();
     }

    function renderCredits() {
        // Verificação dos seletores (incluindo o novo título)
        if (!creditsList || !creditsListTitle) return;

        creditsList.innerHTML = '';

        // Lógica de visibilidade do título
        if (credits.length === 0) {
            creditsListTitle.style.display = 'none'; // Esconde o título
            return; // Sai se não houver créditos
        }

        // Mostra o título e renderiza a lista
        creditsListTitle.style.display = 'block';
        
        credits.forEach(credit => {
            const listItem = document.createElement('li');
            listItem.className = 'credit-item';
            listItem.style = 'display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--color-border);';
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
         const creditToEdit = credits.find(credit => credit.id === id);
         if (!creditToEdit || !creditNameInput || !creditRoleSelect || !addCreditBtn) return;
         creditNameInput.value = creditToEdit.name;
         creditRoleSelect.value = creditToEdit.roleId;
         currentlyEditingCreditId = id;
         // Muda o botão para "Salvar" (ícone de check)
         addCreditBtn.innerHTML = '<img src="public/icons/icon-check.svg" alt="Salvar alteração" style="width: 16px; height: 16px;" />';
         addCreditBtn.title = 'Salvar alteração';
         creditNameInput.focus();
     }
    function resetCreditForm() {
         if (!creditNameInput || !creditRoleSelect || !addCreditBtn) return;
         creditNameInput.value = '';
         creditRoleSelect.value = '';
         currentlyEditingCreditId = null;
          // Volta o botão para "+"
         addCreditBtn.innerHTML = originalAddCreditIcon;
         addCreditBtn.title = 'Adicionar crédito';
     }

    // ===================================================================
    // NOVA FUNÇÃO: Popular Selects de Produtor/Responsável
    // ===================================================================
    function updateCreditRoleSelects() {
        if (!producerPersonSelect || !distributionLeadPersonSelect) {
            // console.warn("Selects de Produtor/Responsável não encontrados."); // Comentado para reduzir logs
            return;
        }

        const currentProducerId = producerPersonSelect.value;
        const currentLeadId = distributionLeadPersonSelect.value;

        producerPersonSelect.innerHTML = '<option value="">Selecione nos créditos...</option>';
        distributionLeadPersonSelect.innerHTML = '<option value="">Selecione nos créditos...</option>';

        if (credits.length === 0) {
            producerPersonSelect.innerHTML = '<option value="">Adicione créditos primeiro</option>';
            distributionLeadPersonSelect.innerHTML = '<option value="">Adicione créditos primeiro</option>';
            return;
        }

        const uniquePeopleInCredits = new Map();
        credits.forEach(credit => {
            // Apenas adiciona se tivermos um personId válido
            if (credit.personId && !uniquePeopleInCredits.has(credit.personId)) {
                uniquePeopleInCredits.set(credit.personId, credit.name);
            }
        });

        if (uniquePeopleInCredits.size === 0) {
             producerPersonSelect.innerHTML = '<option value="">Nenhuma pessoa válida nos créditos</option>';
             distributionLeadPersonSelect.innerHTML = '<option value="">Nenhuma pessoa válida nos créditos</option>';
             return;
        }

        uniquePeopleInCredits.forEach((name, personId) => {
            const optionP = new Option(name, personId);
            const optionL = new Option(name, personId);
            if (personId == currentProducerId) optionP.selected = true;
            if (personId == currentLeadId) optionL.selected = true;
            producerPersonSelect.appendChild(optionP);
            distributionLeadPersonSelect.appendChild(optionL);
        });
         // console.log("Selects de Produtor/Responsável atualizados."); // Comentado para reduzir logs
    }


    // --- Funções de Links ---
    function renderLinks() {
        // Verificação dos seletores (incluindo o novo título)
        if (!linksList || !linksListTitle) return;

        linksList.innerHTML = '';

        // Lógica de visibilidade do título
        if (moreLinks.length === 0) {
            linksListTitle.style.display = 'none'; // Esconde o título
            return; // Sai se não houver links
        }

        // Mostra o título e renderiza a lista
        linksListTitle.style.display = 'block';

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
        if (currentlyEditingLinkId !== null) handleUpdateLink(currentlyEditingLinkId);
        else handleAddLink();
    }
    function handleAddLink() {
        if (!linkNameInput || !externalLinkInput) return;
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
        if (!linkToEdit || !linkNameInput || !externalLinkInput || !addLinkBtn) return;
        linkNameInput.value = linkToEdit.name;
        externalLinkInput.value = linkToEdit.url;
        currentlyEditingLinkId = id;
        addLinkBtn.innerHTML = '<img src="public/icons/icon-check.svg" alt="Salvar alteração" style="width: 16px; height: 16px;" />';
        addLinkBtn.title = 'Salvar alteração';
        linkNameInput.focus();
    }
    function handleUpdateLink(id) {
        if (!linkNameInput || !externalLinkInput) return;
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
        // Task 3: Verificação do título adicionada
        if (!invitesList || !invitesListTitle) return;

        invitesList.innerHTML = '';

        // Task 3: LÓGICA DE VISIBILIDADE DO TÍTULO
        if (collaborators.length === 0) {
            invitesListTitle.style.display = 'none'; // Esconde o título
            return; // Sai da função se não houver colaboradores
        }
        
        // Se houver colaboradores, mostra o título e continua
        invitesListTitle.style.display = 'block';

        collaborators.forEach(invite => {
            const listItem = document.createElement('li');
            listItem.className = 'invite-item';
            listItem.style = 'display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--color-border);';
            listItem.innerHTML = `
                <span class="invite-text" style="font-size:0.85rem; color:var(--color-text-primary);">
                    <strong>${invite.name || 'N/A'}</strong> — ${invite.email}
                </span>
                <div class="actions">
                    <button type="button" class="btn-gst-film btn-delete-invite" data-email="${invite.email}" title="Remover convite"><img src="public/icons/icon-film-x.svg" alt="Excluir" style="pointer-events: none;"/></button>
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
            alert("Por favor, preencha o email do colaborador.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
             alert("Por favor, insira um email válido.");
            return;
        }
        if (collaborators.some(invite => invite.email === email)) {
            alert("Este email já foi adicionado à lista.");
            return;
        }
        if (currentProfilePlan === 'free' && collaborators.length >= 2) {
            alert("Seu plano gratuito permite apenas 2 colaboradores. Faça upgrade para adicionar mais!");
            return;
        }
        collaborators.push({ name, email });
        renderInvites();
        inviteNameInput.value = '';
        inviteEmailInput.value = '';
    }
    function handleDeleteInvite(email) {
        collaborators = collaborators.filter(invite => invite.email !== email);
        renderInvites();
    }

    // --- Event Listeners ---
    function setupDynamicListListeners() {
         // Agora o botão "+" só adiciona/salva, não alterna mais
         if (addCreditBtn) addCreditBtn.addEventListener('click', () => {
             if (currentlyEditingCreditId !== null) {
                 // Se estava editando, chama a função de update local
                 handleUpdateCredit(currentlyEditingCreditId);
             } else {
                 // Senão, chama a função async de adicionar (que busca/cria pessoa)
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
                 const id = parseInt(button.dataset.id); // ID do item da lista (Date.now())
                 if (button.classList.contains('btn-delete-credit')) handleDeleteCredit(id);
                  // O botão Edit agora só preenche o formulário para update local
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
         console.log("Listeners para listas dinâmicas configurados.");
     }

    // ===================================================================
    // LÓGICA DE UPLOAD DO CARTAZ
    // ===================================================================
    function setupPosterUploadListeners() {
        if (!posterUploadBtn || !posterUploadInput) return;
        posterUploadBtn.addEventListener('click', () => posterUploadInput.click());
        posterUploadInput.addEventListener('change', handlePosterFileSelection);
        console.log("Listeners para upload de cartaz configurados.");
    }
    function handlePosterFileSelection(event) {
        const file = event.target.files[0];
        if (!file) return;
        const MAX_FILE_SIZE = 5 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
            alert(`O arquivo é muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). O tamanho máximo permitido é de 5MB.`);
            posterUploadInput.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            if (croppieInstance) croppieInstance.destroy();
             if (!posterPreviewImage || !posterPreviewContainer) return; // Add check
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
        if (!croppieInstance || !posterPreviewImage) return; // Add check
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
    // ===================================================================

    async function populateSelects() {
        console.log("Iniciando a população dos campos de seleção (Estáticos)...");
        const displayColumnMap = {
            countries: 'country', currencies: 'name', film_types: 'type',
            languages: 'name', categories: 'category', genres: 'genre',
            crew_roles: 'role_name', aspect_ratios: 'name', color_modes: 'name',
            recording_formats: 'name',
        };
        const selects = document.querySelectorAll('select[data-source]:not([data-source="users"])'); // Exclui selects de users

        let validCurrencyCodes = null;
        try {
            const { data, error } = await supabase.from('exchange_rates').select('target_currency_code');
            if (error) throw error;
            validCurrencyCodes = data.map(item => item.target_currency_code);
            if (!validCurrencyCodes.includes('USD')) validCurrencyCodes.push('USD');
        } catch (error) {
            console.error("Erro ao buscar lista de moedas válidas:", error.message);
        }

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
                    const { data, error } = await supabase.from('currencies').select('id, name, iso_code').in('iso_code', validCurrencyCodes).order('name', { ascending: true });
                    if (error) throw error;
                    data.forEach(item => {
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
                try {
                    const displayColumn = displayColumnMap[tableName] || 'name';
                    const { data, error } = await supabase.from(tableName).select(`id, ${displayColumn}`).order(displayColumn, { ascending: true });
                    if (error) throw error;
                    data.forEach(item => {
                        select.appendChild(new Option(item[displayColumn], item.id));
                    });
                } catch (error) {
                    console.error(`Erro ao buscar dados para ${tableName}:`, error.message);
                    select.innerHTML = `<option value="">Erro ao carregar</option>`;
                }
            }
        }
        console.log("População dos campos de seleção (Estáticos) finalizada.");
    }

    // ATUALIZADA - Usa auth.getUser(), busca INT4 id, role, plan
    // ATUALIZADA - Usa auth.getUser() (para UUID) e RPC (para INT4)
    async function populateProfileSelects() {
        console.log("Populando selects de perfil...");
        try {
            // 1. Obter o usuário autenticado (UUID)
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) throw new Error(`Usuário não autenticado: ${authError?.message}`);
            
            // Armazena o UUID (usado para 'distributor_profile_id' e convites)
            currentAuthUserId = user.id; 

            // 2. Chamar a RPC para obter o ID INT4 (para 'owner_profile_id')
            // (Conforme o dossiê, esta RPC busca o INT4 do perfil logado)
            const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_profile_id');
            if (rpcError || rpcData === null) {
                // Se a RPC não existir, logue um erro claro.
                // Para testes, pode-se mockar: currentProfileId = 1;
                console.error("Erro na RPC 'get_my_profile_id':", rpcError);
                throw new Error(`Falha ao buscar ID INT4 do perfil (RPC 'get_my_profile_id'): ${rpcError?.message || 'Nenhum dado retornado'}. Esta RPC é essencial.`);
            }
            
            // Armazena o ID INT4 (usado para 'owner_profile_id')
            currentProfileId = rpcData; 
            console.log(`ID INT4 (Owner) obtido via RPC: ${currentProfileId}`);
            console.log(`ID UUID (Auth) obtido: ${currentAuthUserId}`);

            // 3. Buscar o 'role' e 'plan' usando o UUID (da tabela 'users')
            const { data: profileData, error: profileError } = await supabase
                .from('users')
                .select('role, plan') // Busca apenas o que falta
                .eq('id', currentAuthUserId) // Usa o UUID para buscar
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
            // currentProfileName = "Meu Perfil" (padrão) - Pode buscar o nome aqui se precisar

            // 4. Preencher a UI (Lógica original mantida)
            if (currentProfileRole === 'distribuidora') {
                 if (distributorDisplayGroup && distributorNameDisplay && distributorProfileIdInput) {
                     // Task 2: MUDANÇA de .value para .textContent para popular o <span>
                     distributorNameDisplay.textContent = currentProfileName || "Distribuidora Logada"; // Placeholder
                     distributorProfileIdInput.value = currentAuthUserId; 
                 }
            } else {
                 // Preenche o select escondido (fallback) para o Realizador Solo
                 const select = document.getElementById('distributor_profile_id_fallback'); // Usa o ID do select de fallback
                 if (select) {
                     // Realizador solo se auto-distribui, mas o campo distributor_profile_id é UUID
                     // Portanto, o valor deste select deve ser o UUID
                     const defaultOption = new Option(currentProfileName, currentAuthUserId);
                     defaultOption.selected = true;
                     select.innerHTML = '';
                     select.appendChild(defaultOption);
                 }
            }
             console.log("Dados do perfil (INT4 e UUID) carregados e UI (campo distribuidora) ajustada.");

        } catch (error) {
            console.error("Erro CRÍTICO ao popular selects de perfil:", error.message);
            currentProfileRole = 'realizador_solo'; // Define um padrão seguro
            currentProfilePlan = 'free';
            // Não tenta preencher selects em caso de erro
        }
    }


    function initializeChoices() {
         console.log("Inicializando Choices.js...");
         const categorySelect = document.getElementById('category_ids');
         const genreSelect = document.getElementById('genre_ids');
         // Adiciona verificação de nulidade antes de usar Choices
         if (typeof Choices !== 'undefined') {
             if (categorySelect) {
                 try {
                     choicesInstances.category_ids = new Choices(categorySelect, { removeItemButton: true, placeholder: true, placeholderValue: 'Selecione categorias', noResultsText: 'Nenhum resultado', itemSelectText: '' });
                 } catch(e) { console.error("Erro Choices Categoria:", e); }
             } else { console.warn("Select de categoria não encontrado."); }

             if (genreSelect) {
                  try {
                     choicesInstances.genre_ids = new Choices(genreSelect, { removeItemButton: true, placeholder: true, placeholderValue: 'Selecione gêneros', noResultsText: 'Nenhum resultado', itemSelectText: '' });
                  } catch(e) { console.error("Erro Choices Gênero:", e); }
             } else { console.warn("Select de gênero não encontrado."); }

             if (choicesInstances.category_ids || choicesInstances.genre_ids) {
                 console.log("Choices.js inicializado.");
             }
         } else {
             console.error("Biblioteca Choices.js não carregada.");
         }
     }


    function initializeInputMasks() {
        const durationInput = document.getElementById('duration_in_seconds');
        if (!durationInput) return;
        // Adiciona verificação se IMask está carregado
         if (typeof IMask !== 'undefined') {
             try {
                 const durationMask = IMask(durationInput, {
                     mask: 'MM:SS',
                     blocks: {
                         MM: { mask: Number, min: 0, max: 999 },
                         SS: { mask: IMask.MaskedRange, from: 0, to: 59, maxLength: 2 }
                     }
                 });
                 console.log("Máscara de duração inicializada.");
             } catch(error) {
                  console.error("Erro ao inicializar IMask:", error);
             }
         } else {
              console.error("Biblioteca IMask não carregada.");
         }
    }

    // ===================================================================
    // FUNÇÃO DE INICIALIZAÇÃO DA PÁGINA (ATUALIZADA) - (PARTE 4)
    // ===================================================================
    async function initMyFilmsPage() {
        await populateProfileSelects(); // Busca dados do user (role, plan, ids)
        updateFormVisibility(currentProfileRole, currentProfilePlan); // Ajusta a UI
        await populateSelects(); // Popula selects estáticos (países, moedas, etc.)

        initializeChoices();
        setupPosterUploadListeners();
        setupDynamicListListeners();
        initializeInputMasks();
        setupDependentDropdowns();
        updateCreditRoleSelects(); // Inicializa os selects de Produtor/Responsável (vazios)

        // --- NOVA INICIALIZAÇÃO DO WIZARD ---
        setupWizardListeners(); // Configura "Avançar" e "Voltar"
        showStep(1); // Garante que apenas o passo 1 esteja visível
        // --- FIM DA INICIALIZAÇÃO DO WIZARD ---

        if(filmForm) {
            // Este listener agora só será acionado no último passo
            filmForm.addEventListener('submit', handleFilmSubmit); 
        } else {
            console.error("O formulário 'film-form' não foi encontrado.");
        }
        console.log("Página 'myfilms' inicializada com Wizard.");
    }

    // Inicia a página
    initMyFilmsPage();
});