document.addEventListener('DOMContentLoaded', () => {

    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    console.log("Form-Handler: DOM carregado. Iniciando lógica do formulário.");

    let supabaseClient = null;
    const FORM_ID = "festival-form";
    const CANCEL_SELECTOR = ".btn-secondary";
    const fieldMap = { festival_name: "festival-name", edition_id: "edition-number", premiere_id: "premiere-status", country_id: "country", month_opening_id: "open-month", month_held_id: "realization-month", fee_status_id: "fee-status", deadline_early: "deadline-early", deadline_late: "deadline-late", result_date: "results", fee_early_min: "fee-early-min", fee_early_max: "fee-early-max", fee_late_min: "fee-late-min", fee_late_max: "fee-late-max", synopsis: "synopsis", platform_id: "platform", platform_link: "platform-link", official_website: "festival-site", festival_social_link: "social-media", additional_info: "more-info" };

    function findForm() { return document.getElementById(FORM_ID); }
    function openForm() { const wrapper = document.querySelector(".form-panel-wrapper"); if (wrapper) wrapper.classList.remove("collapsed"); }
    function closeForm() { const wrapper = document.querySelector(".form-panel-wrapper"); if (wrapper) wrapper.classList.add("collapsed"); }
    
    // ######################################################################
    // ##### FUNÇÃO CORRIGIDA AQUI #####
    // ######################################################################
    function resetFormState(form) {
        if (form) {
            form.reset(); // Reseta os campos de input normais
            delete form.dataset.editingId;
            
            // CORREÇÃO: Em vez de apagar todas as opções com clearStore(),
            // apenas limpamos a seleção dos campos Choices.js.
            const choicesInstances = window.choicesInstances || {};
            Object.values(choicesInstances).forEach(instance => {
                instance.clearInput(); // Limpa o texto de busca
                instance.setValue([]); // Define a seleção como vazia
            });
        }
    }

    function getValueById(id) { const el = document.getElementById(id); if (!el) return null; if (el.multiple) { return Array.from(el.selectedOptions).map(o => o.value).filter(Boolean); } return el.value && el.value.trim() !== "" ? el.value.trim() : null; }
    function setValueById(id, value) { const el = document.getElementById(id); if (!el) return; if (el.multiple) { const values = Array.isArray(value) ? value.map(String) : [String(value)]; Array.from(el.options).forEach(option => { option.selected = values.includes(option.value); }); } else { el.value = value ?? ""; } }
    function parseCurrency(value) { if (typeof value !== 'string' || value === null || value.trim() === '') { return null; } if (value.includes(',')) { return parseFloat(value.replace(/\./g, '').replace(',', '.')); } else { return parseFloat(value); } }
    async function handleJunctionTable(festivalId, selectedIds, config) {
    console.log(`--- DEBUG: Dentro de handleJunctionTable para '${config.junctionTable}' ---`);
    console.log("Recebido festivalId:", festivalId);
    console.log("Recebido selectedIds:", selectedIds);

    if (!supabaseClient || !festivalId) {
        console.error("handleJunctionTable parou: supabaseClient ou festivalId ausente.");
        return;
    }
    const { junctionTable, festivalIdColumn, relatedIdColumn } = config;

    // DELETAR
    const { error: deleteError } = await supabaseClient.from(junctionTable).delete().eq(festivalIdColumn, festivalId);
    
    if (deleteError) {
        console.error(`--- ERRO FATAL no DELETE em '${junctionTable}' ---`, deleteError);
        throw deleteError;
    }
    console.log(`DELETE em '${junctionTable}' bem-sucedido.`);

    // INSERIR
    const idsArray = Array.isArray(selectedIds) ? selectedIds : [selectedIds].filter(Boolean);
    if (idsArray.length > 0) {
        const newLinks = idsArray.map(id => ({ [festivalIdColumn]: festivalId, [relatedIdColumn]: parseInt(id, 10) }));
        console.log(`Preparando para INSERIR em '${junctionTable}':`, newLinks);
        
        const { error: insertError } = await supabaseClient.from(junctionTable).insert(newLinks);
        if (insertError) {
            console.error(`--- ERRO FATAL no INSERT em '${junctionTable}' ---`, insertError);
            throw insertError;
        }
        console.log(`INSERT em '${junctionTable}' bem-sucedido.`);
    }
}
    function formToPayload() {
    const payload = {};
    const multiSelectIds = {};
    const currencyFields = ['fee-early-min', 'fee-early-max', 'fee-late-min', 'fee-late-max'];

    Object.entries(fieldMap).forEach(([dbField, inputId]) => {
        let val = getValueById(inputId);
        if (currencyFields.includes(inputId)) {
            val = parseCurrency(val);
        }
        if (dbField.endsWith('_id') && val) {
            const el = document.getElementById(inputId);
            if (el && !el.multiple) {
                payload[dbField] = parseInt(val, 10);
            }
        } else if (val !== null) {
            payload[dbField] = val;
        }
    });
    
    // Captura multi-selects
    multiSelectIds.genres = getValueById('genres');
    multiSelectIds.categories = getValueById('categories');
    multiSelectIds.qualifiers = getValueById('qualifying');

    // Captura o select simples 'Tipo' separadamente
    const typeId = getValueById('type');

    ["deadline_early", "deadline_late", "result_date"].forEach(k => {
        if (payload[k]) {
            const p = payload[k].split("/");
            if (p.length === 3) payload[k] = `${p[2]}-${p[1]}-${p[0]}`;
        }
    });
    
   
    return { payload, multiSelectIds, typeId };
}
    async function insertFestival(payload) { const { data, error } = await supabaseClient.from("festivals").insert([payload]).select(); if (error) throw error; return data?.[0]; }
    async function updateFestival(id, payload) { const { data, error } = await supabaseClient.from("festivals").update(payload).eq("id", id).select(); if (error) throw error; return data?.[0]; }
    async function handleSubmit(e) {
    e.preventDefault();

    // BLOCO DE VALIDAÇÃO DOS CAMPOS OBRIGATÓRIOS
    const { isValid, firstErrorField } = validateForm();
    if (!isValid) {
        console.warn("Validação falhou. Envio interrompido.");
        if (firstErrorField) {
            firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return; // Interrompe a execução aqui
    }

    // Se a validação passou, o código abaixo é executado.
    const form = findForm();
    if (!form) return;
    
    const { payload, multiSelectIds, typeId } = formToPayload();
    
    console.log("Payload sendo enviado ao Supabase:", payload);
    try {
        let savedFestival;
        if (form.dataset.editingId) {
            savedFestival = await updateFestival(parseInt(form.dataset.editingId, 10), payload);
        } else {
            savedFestival = await insertFestival(payload);
        }
        if (savedFestival?.id) {
            await handleJunctionTable(savedFestival.id, multiSelectIds.genres, { junctionTable: 'festival_genres_assignments', festivalIdColumn: 'festival_id', relatedIdColumn: 'genre_id' });
            await handleJunctionTable(savedFestival.id, multiSelectIds.categories, { junctionTable: 'festival_categories_assignments', festivalIdColumn: 'festival_id', relatedIdColumn: 'category_id' });
            await handleJunctionTable(savedFestival.id, multiSelectIds.qualifiers, { junctionTable: 'festival_qualifiers_assignments', festivalIdColumn: 'festival_id', relatedIdColumn: 'qualifier_id' });
            await handleJunctionTable(savedFestival.id, typeId, { junctionTable: 'festival_film_types', festivalIdColumn: 'festival_id', relatedIdColumn: 'film_type_id' });
        }
        resetFormState(form);
        closeForm();
        window.showFeedbackModal('Festival salvo com sucesso!');
        if (typeof window.triggerFestivalSearch === "function") {
            window.triggerFestivalSearch(null);
        }
    } catch (err) {
        console.error("Erro ao salvar festival:", err);
        window.showFeedbackModal('Ocorreu um erro ao salvar o festival.', 'error');
    }
}

    function populateFormForEdit(festivalData) {
        console.log("Form-Handler: Recebendo dados do cache para popular o formulário.", festivalData);
        const choicesInstances = window.choicesInstances || {};
        const form = findForm();
        if (!form) return;
        try {
            resetFormState(form);
            Object.entries(fieldMap).forEach(([dbField, inputId]) => {
                if (festivalData[dbField] !== undefined && festivalData[dbField] !== null) {
                    if (["deadline_early", "deadline_late", "result_date"].includes(dbField)) {
                        const dateParts = festivalData[dbField].split('-');
                        if (dateParts.length === 3) {
                           const formattedDate = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
                           setValueById(inputId, formattedDate);
                        }
                    } else {
                        setValueById(inputId, festivalData[dbField]);
                    }
                }
            });
            if (festivalData.film_types && festivalData.film_types.length > 0) {
                setValueById('type', festivalData.film_types[0].id);
            }
            const multiSelectMappings = {
                'qualifying': festivalData.qualifiers,
                'categories': festivalData.categories,
                'genres': festivalData.genres
            };
            Object.entries(multiSelectMappings).forEach(([elementId, items]) => {
                const choicesInstance = choicesInstances[elementId];
                if (!choicesInstance) return;
                
                // A função resetFormState já limpou a seleção,
                // então não precisamos mais do clearStore() aqui.
                if (items && items.length > 0) {
                    const ids = items.map(item => String(item.id));
                    choicesInstance.setChoiceByValue(ids);
                }
            });
            form.dataset.editingId = String(festivalData.id);
            openForm();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (err) {
            console.error("Erro ao popular formulário para edição com dados do cache:", err);
            alert("Erro ao popular formulário: " + err.message);
        }
    }

    function initUI() {
        const form = findForm();
        if (form && !form.__hasSubmitHandler) { form.addEventListener("submit", handleSubmit); form.__hasSubmitHandler = true; }
        const cancelBtn = document.querySelector(CANCEL_SELECTOR);
        if (cancelBtn && !cancelBtn.__hasHandler) { cancelBtn.addEventListener("click", (ev) => { ev.preventDefault(); const form = findForm(); resetFormState(form); closeForm(); }); cancelBtn.__hasHandler = true; }
        window.populateFormForEdit = populateFormForEdit;
        window.openFestivalForm = openForm;
        window.closeFestivalForm = closeForm;
    }
    
    async function populateSelectWithOptions(selectId, tableName, valueColumn, textColumn, orderByColumn = null) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement || !supabaseClient) return;
        try {
            const orderBy = orderByColumn || textColumn;
            const { data, error } = await supabaseClient.from(tableName).select(`${valueColumn}, ${textColumn}`).order(orderBy);
            if (error) throw error;
            const firstOption = selectElement.options[0]?.outerHTML || '<option value="">Selecione</option>';
            selectElement.innerHTML = firstOption;
            data.forEach(item => { const option = document.createElement("option"); option.value = item[valueColumn]; option.textContent = item[textColumn]; selectElement.appendChild(option); });
        } catch (e) { console.error(`Erro ao popular ${selectId}:`, e); }
    }

    function onSupabaseReady(callback) {
        const interval = setInterval(() => { if (window.supabase) { clearInterval(interval); supabaseClient = window.supabase; callback(); } }, 50);
    }

function initFestivalNameValidation() {
    const festivalNameInput = document.getElementById('festival-name');
    if (!festivalNameInput) return;
    const errorSpan = document.getElementById('festival-name-error');
    const formGroup = festivalNameInput.closest('.form-group');

    const checkFestivalName = async (name) => {
        // Limpa o erro se o campo estiver vazio
        if (!name.trim()) {
            formGroup.classList.remove('error');
            errorSpan.classList.remove('visible');
            return;
        }

        try {
            // Consulta o Supabase de forma eficiente, apenas para contar
            const { count, error } = await supabaseClient
                .from('festivals')
                .select('*', { count: 'exact', head: true })
                .ilike('festival_name', name.trim());

            if (error) throw error;

            if (count > 0) {
                // Duplicata encontrada: mostra o erro
                errorSpan.textContent = 'Este festival já existe';
                formGroup.classList.add('error');
                errorSpan.classList.add('visible');
            } else {
                // Sem duplicata: limpa o erro
                formGroup.classList.remove('error');
                errorSpan.classList.remove('visible');
            }

        } catch (err) {
            console.error("Erro na validação do nome do festival:", err);
        }
    };

    // Cria a versão "debounced" da nossa função de verificação
    const debouncedCheck = debounce(checkFestivalName, 500); // Aguarda 500ms após o usuário parar de digitar

    // Adiciona o "ouvinte" ao campo de input
    if (festivalNameInput) {
        festivalNameInput.addEventListener('input', (e) => {
            debouncedCheck(e.target.value);
        });
    }
}

function validateForm() {
    const form = findForm();
    if (!form) return { isValid: false, firstErrorField: null };

    // Limpa todos os erros de validação anteriores
    form.querySelectorAll('.form-group.error').forEach(el => el.classList.remove('error'));
    
    // Lista dos IDs dos campos que NÃO são obrigatórios
    const nonRequiredFields = [
        'deadline-early', 
        'deadline-late', 
        'results',
        'fee-early-min', 
        'fee-early-max', 
        'fee-late-min', 
        'fee-late-max',
        'additional-info' // Adicionando "Mais informações" como não obrigatório também
    ];

    // Lista de todos os IDs de campos que devem ser validados
    const fieldsToValidate = [
        // Campos do fieldMap
        ...Object.values(fieldMap),
        // Adicione aqui outros campos que não estão no fieldMap mas são obrigatórios
        'qualifying', 'categories', 'genres', 'type'
    ];

    let firstErrorField = null;
    let isValid = true;

    fieldsToValidate.forEach(fieldId => {
        // Pula a validação para campos não obrigatórios
        if (nonRequiredFields.includes(fieldId)) {
            return;
        }

        const value = getValueById(fieldId);
        const isEmpty = !value || (Array.isArray(value) && value.length === 0);

        if (isEmpty) {
            isValid = false;
            const fieldElement = document.getElementById(fieldId);
            if (fieldElement) {
                const formGroup = fieldElement.closest('.form-group');
                if (formGroup) {
                    formGroup.classList.add('error');
                    // Guarda a referência do primeiro campo com erro para poder rolar a tela até ele
                    if (!firstErrorField) {
                        firstErrorField = formGroup;
                    }
                }
            }
        }
    });

    return { isValid, firstErrorField };
}

    onSupabaseReady(() => {
        initUI(); 

        initFestivalNameValidation();
    console.log("Form-Handler: Conexão Supabase pronta. Populando selects...");

        console.log("Form-Handler: Conexão Supabase pronta. Populando selects...");
        const populatePromises = [
            populateSelectWithOptions("edition-number", "festival_edition", "id", "edition", "edition"),
            populateSelectWithOptions("premiere-status", "premiere", "id", "premiere_status"),
            populateSelectWithOptions("country", "countries", "id", "country"),
            populateSelectWithOptions("type", "film_types", "id", "type"),
            populateSelectWithOptions("realization-month", "months", "id", "months_id", "id"),
            populateSelectWithOptions("categories", "categories", "id", "category"),
            populateSelectWithOptions("genres", "genres", "id", "genre"),
            populateSelectWithOptions("fee-status", "fee_status", "id", "status_name"),
            populateSelectWithOptions("platform", "platforms", "id", "platform_name"),
            populateSelectWithOptions("qualifying", "qualifiers", "id", "name"),
            populateSelectWithOptions("open-month", "months", "id", "months_id", "id"),
        ];

        Promise.all(populatePromises).then(() => {
            console.log("Todos os selects foram populados. Inicializando Choices.js...");
            try {
                const multiSelectConfig = { removeItemButton: true, placeholder: true, placeholderValue: 'Selecione uma ou mais opções', searchPlaceholderValue: 'Buscar...', };
                const multiSelectIds = ['qualifying', 'categories', 'genres'];
                multiSelectIds.forEach(id => {
                    const element = document.getElementById(id);
                    if (element && element.multiple) {
                        window.choicesInstances = window.choicesInstances || {};
                        window.choicesInstances[id] = new Choices(element, multiSelectConfig);
                    }
                });
            } catch (error) { console.error("Erro ao inicializar Choices.js:", error); }
        });
    });

});