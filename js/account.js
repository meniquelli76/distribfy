document.addEventListener('DOMContentLoaded', () => {
    console.log('[DEBUG] 1. DOMContentLoaded disparado. A página HTML foi carregada.');

    // ============================================================
    // VALIDAÇÃO INICIAL E CLIENTE SUPABASE
    // ============================================================
    const supabase = window.supabase;
    if (!supabase) {
        console.error("[DEBUG] ERRO CRÍTICO: Cliente Supabase não encontrado. Verifique se 'supabase-client.js' foi carregado antes deste script.");
        return;
    }
    console.log('[DEBUG] 2. Cliente Supabase encontrado com sucesso.');

    // ============================================================
    // SELEÇÃO E VALIDAÇÃO DOS ELEMENTOS DO DOM
    // ============================================================
    console.log('[DEBUG] 3. Tentando selecionar os elementos essenciais do DOM...');
    
    const avatarUploadInput = document.getElementById('avatar-upload');
    const cropModal = document.getElementById('crop-modal');
    const cropContainer = document.getElementById('crop-container');
    const saveCropBtn = document.getElementById('save-crop-btn');
    const cancelCropBtn = document.getElementById('cancel-crop-btn');
    const avatarDisplay = document.getElementById('avatar-display');
    const userEmail = document.getElementById('email');
    const userName = document.getElementById('full_name');

    if (!avatarUploadInput || !cropModal || !cropContainer || !saveCropBtn || !cancelCropBtn || !avatarDisplay) {
        console.error('[DEBUG] ERRO FATAL: Um ou mais elementos essenciais para o upload de avatar não foram encontrados. Verifique os IDs no HTML.');
        console.log({ avatarUploadInput, cropModal, cropContainer, saveCropBtn, cancelCropBtn, avatarDisplay });
        return;
    }
    console.log('[DEBUG] 4. Todos os elementos essenciais para o upload foram encontrados com sucesso.');

    // ============================================================
    // VARIÁVEIS DE ESTADO
    // ============================================================
    let croppieInstance = null;
    let currentUser = null;

    // ============================================================
    // FUNÇÕES DO UPLOAD E CROPPIE
    // ============================================================

    // Esta função será chamada quando um arquivo for selecionado
    function handleFileSelection(e) {
        console.log('[DEBUG] 6. Evento "change" DETECTADO no input de arquivo!');
        const file = e.target.files[0];
        
        if (!file) {
            console.warn('[DEBUG] 7. Nenhum arquivo foi selecionado no seletor.');
            return;
        }
        console.log('[DEBUG] 7. Arquivo selecionado:', file);

        const reader = new FileReader();
        
        reader.onload = (event) => {
            console.log('[DEBUG] 8. FileReader terminou de ler o arquivo.');
            if (croppieInstance) {
                croppieInstance.destroy();
                console.log('[DEBUG] Instância antiga do Croppie destruída.');
            }
            
            cropModal.style.display = 'flex';
            console.log('[DEBUG] 9. Modal de recorte ativado (display: flex).');

            croppieInstance = new Croppie(cropContainer, {
                viewport: { width: 200, height: 200, type: 'circle' },
                boundary: { width: 300, height: 300 },
                showZoomer: true,
            });
            console.log('[DEBUG] 10. Nova instância do Croppie criada.');

            croppieInstance.bind({ url: event.target.result });
            console.log('[DEBUG] 11. Imagem vinculada ao Croppie. A ferramenta deve estar visível.');
        };

        reader.onerror = () => {
            console.error('[DEBUG] ERRO: O FileReader falhou ao tentar ler o arquivo.');
        };
        
        reader.readAsDataURL(file);
        console.log('[DEBUG] FileReader iniciado para ler o arquivo como Data URL.');
    }

    function closeCropModal() {
        if (croppieInstance) {
            croppieInstance.destroy();
            croppieInstance = null;
        }
        cropModal.style.display = 'none';
        avatarUploadInput.value = ''; // Limpa o input para permitir selecionar o mesmo arquivo novamente
    }
    
    // ============================================================
    // CONFIGURAÇÃO DOS EVENT LISTENERS
    // ============================================================
    try {
        avatarUploadInput.addEventListener('change', handleFileSelection);
        console.log('[DEBUG] 5. Event listener "change" adicionado com SUCESSO ao input de upload.');
        
        saveCropBtn.addEventListener('click', async () => {
            if (!croppieInstance) return;
            const blob = await croppieInstance.result({ type: 'blob', size: 'viewport', format: 'png', quality: 0.9 });
            await uploadAvatar(blob);
        });

        cancelCropBtn.addEventListener('click', closeCropModal);

    } catch (error) {
        console.error('[DEBUG] ERRO ao tentar adicionar os event listeners:', error);
    }
    
    // ============================================================
    // LÓGICA PRINCIPAL DA PÁGINA (CARREGAMENTO DE DADOS, ETC.)
    // ============================================================
    async function initPage() {
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                window.location.href = '/login.html';
                return;
            }
            currentUser = session.user;
            loadUserProfile(currentUser);
        } catch (error) {
            console.error('Erro na inicialização da página:', error);
        } finally {
            document.body.style.visibility = 'visible';
        }
    }

    function loadUserProfile(user) {
        if (!user) return;
        userEmail.value = user.email || '';
        if (user.user_metadata) {
            userName.value = user.user_metadata.full_name || '';
            avatarDisplay.src = user.user_metadata.avatar_url || 'https://via.placeholder.com/150';
        }
    }

    async function uploadAvatar(blob) {
        if (!currentUser || !blob) return;
        const filePath = `${currentUser.id}/avatar.png`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, blob, { upsert: true });
        if (uploadError) {
            alert('Falha ao enviar a imagem.');
            console.error('Erro no upload do avatar:', uploadError);
            return;
        }
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
        if (updateError) {
            alert('Falha ao salvar o novo avatar.');
            console.error('Erro ao atualizar o usuário:', updateError);
            return;
        }
        avatarDisplay.src = publicUrl;
        closeCropModal();
        alert('Avatar atualizado com sucesso!');
    }

    // Inicia a execução da lógica da página
    initPage();
});