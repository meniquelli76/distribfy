// js/auth-manager.js - VERSÃO CORRIGIDA
const onSupabaseReady = (callback) => {
    const interval = setInterval(() => {
        if (window.supabase) {
            clearInterval(interval);
            callback(window.supabase);
        }
    }, 50);
};

onSupabaseReady(async (supabase) => {
    console.log("Auth Manager: Supabase pronto");

    // ============================================================
    // LÓGICA DE LOGIN CORRIGIDA
    // ============================================================
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const email = loginForm.email.value;
            const password = loginForm.senha.value;
            
            const submitButton = loginForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Entrando...';

            try {
                console.log("Iniciando processo de login...");
                
                // VERIFICA SE reCAPTCHA ESTÁ CARREGADO
                if (typeof grecaptcha === 'undefined') {
                    throw new Error("reCAPTCHA não carregado");
                }

                // OBTÉM TOKEN reCAPTCHA
                const token = await grecaptcha.execute('6LfRcOwrAAAAAOCLiPzBCxk18HjwbdjIUsfEJGEB', { action: 'login' });
                console.log("Token reCAPTCHA obtido");

                // ⚠️ SOLUÇÃO TEMPORÁRIA: Login direto enquanto Edge Functions não estão prontas
                console.log("Fazendo login direto com Supabase...");
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) {
                    console.error("Erro no login:", error);
                    alert("Erro no login: " + error.message);
                    submitButton.disabled = false;
                    submitButton.textContent = 'Entrar';
                    return;
                }

                // LOGIN BEM-SUCEDIDO
                console.log("Login bem-sucedido, redirecionando...", data);
                window.location.href = '/userpage.html';

            } catch (error) {
                console.error("Erro no processo de login:", error);
                alert("Erro no processo: " + error.message);
                submitButton.disabled = false;
                submitButton.textContent = 'Entrar';
            }
        });
    }

    // ============================================================
    // LÓGICA DE CADASTRO CORRIGIDA
    // ============================================================
    const signUpForm = document.getElementById('form-cadastro');
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const email = signUpForm.email.value;
            const password = signUpForm.senha.value;
            const fullName = `${signUpForm.nome.value} ${signUpForm.sobrenome.value}`.trim();

            // Validação básica de senha
            if (signUpForm.senha.value !== signUpForm.repita.value) {
                alert("As senhas não coincidem");
                return;
            }

            const submitButton = signUpForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Processando...';

            try {
                console.log("Iniciando cadastro...");
                
                if (typeof grecaptcha === 'undefined') {
                    throw new Error("reCAPTCHA não carregado");
                }

                const token = await grecaptcha.execute('6LfRcOwrAAAAAOCLiPzBCxk18HjwbdjIUsfEJGEB', { action: 'signup' });
                console.log("Token reCAPTCHA obtido para cadastro");

                // ⚠️ SOLUÇÃO TEMPORÁRIA: Cadastro direto
                console.log("Fazendo cadastro direto com Supabase...");
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password,
                    options: {
                        data: {
                            full_name: fullName
                        }
                    }
                });

                if (error) {
                    console.error("Erro no cadastro:", error);
                    alert("Erro no cadastro: " + error.message);
                } else {
                    console.log("Cadastro realizado:", data);
                    alert("Cadastro realizado! Verifique seu e-mail para confirmar a conta.");
                    signUpForm.reset();
                }
                
            } catch (error) {
                console.error("Erro no processo de cadastro:", error);
                alert("Erro no processo: " + error.message);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Inscreva-se';
            }
        });
    }

    // ============================================================
    // LÓGICA DE LOGIN COM GOOGLE (mantida)
    // ============================================================
    const googleLoginBtn = document.getElementById('google-login');
    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/userpage.html' }
            });
        });
    }
    
    const googleSignUpBtn = document.getElementById('google-signup');
    if (googleSignUpBtn) {
        googleSignUpBtn.addEventListener('click', async () => {
            await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/userpage.html' }
            });
        });
    }
});