// ============================================================
// FESTMUNDI - SCRIPT.JS PRINCIPAL
// Gerencia UI geral e estado de autenticação global.
// ============================================================

// --- FUNÇÕES UTILITÁRIAS GLOBAIS ---
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================================
// GERENCIAMENTO GLOBAL DE AUTENTICAÇÃO E ROTAS
// ============================================================
const setupAuthUI = () => {
    const supabase = window.supabase;
    if (!supabase) {
        console.error("Auth UI: Cliente Supabase não encontrado.");
        return;
    }

    const userMenu = document.getElementById('user-menu');
    const loginContainer = document.getElementById('login-container');
    const headerAvatar = document.getElementById('header-avatar');
    const logoutButton = document.getElementById('logout-button');

    // Listener principal que reage a login, logout, etc. em tempo real.
    supabase.auth.onAuthStateChange((event, session) => {
        const user = session?.user;
        
        // --- 1. ATUALIZA A UI DO HEADER ---
        if (user) {
            if (userMenu) userMenu.style.display = 'block';
            if (loginContainer) loginContainer.style.display = 'none';
            
            const avatarUrl = user.user_metadata?.avatar_url;
            if (headerAvatar && avatarUrl) {
                headerAvatar.src = avatarUrl;
            } else if (headerAvatar) {
                // Garante que uma imagem padrão seja exibida se não houver avatar
                headerAvatar.src = 'https://via.placeholder.com/36'; 
            }
        } else {
            if (userMenu) userMenu.style.display = 'none';
            if (loginContainer) loginContainer.style.display = 'block';
            if (headerAvatar) headerAvatar.src = 'https://via.placeholder.com/36';
        }

        // --- 2. LÓGICA DE PROTEÇÃO DE ROTAS ---
        const currentPage = window.location.pathname;
        const isProtectedPage = document.querySelector(`a[href*="${currentPage.split('/').pop()}"]`)?.hasAttribute('data-protected');
        const isAuthPage = currentPage.includes('/login.html') || currentPage.includes('/register.html');

        if (isProtectedPage && !user) {
            // Se o usuário tenta acessar uma página protegida sem estar logado,
            // redireciona para o login.
            console.warn('Acesso a página protegida negado. Redirecionando para /login.html');
            window.location.href = '/login.html';
        } else if (isAuthPage && user) {
            // Se o usuário já está logado e tenta acessar a página de login/registro,
            // redireciona para a página de usuário.
            console.log('Usuário já logado. Redirecionando para /userpage.html');
            window.location.href = '/userpage.html';
        }
    });
    
    // Configuração do botão de logout
    if(logoutButton) {
        logoutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('Erro ao fazer logout:', error);
            } else {
                // Redireciona para a home ou login após o logout
                window.location.href = '/login.html';
            }
        });
    }
};


// --- INICIALIZAÇÃO QUANDO O DOM ESTIVER PRONTO ---
document.addEventListener("DOMContentLoaded", () => {
  
  // Inicializa a lógica de autenticação e UI
  setupAuthUI();
  
  // ============================================================
  // OUTRAS FUNCIONALIDADES GERAIS DE UI (MENU MOBILE, ETC.)
  // ============================================================
  
  const menuToggle = document.querySelector(".menu-toggle");
  const menu = document.querySelector(".menu");
  let overlay = document.querySelector(".menu-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.classList.add("menu-overlay");
    document.body.appendChild(overlay);
  }

  const toggleMenu = (forceClose = false) => {
    const isOpen = forceClose ? false : !menu.classList.contains("active");
    
    if (isOpen) {
      menuToggle.classList.add("open");
      menu.classList.add("active");
      overlay.classList.add("visible");
      document.body.classList.add("no-scroll");
    } else {
      menuToggle.classList.remove("open");
      menu.classList.remove("active");
      overlay.classList.remove("visible");
      document.body.classList.remove("no-scroll");
    }
  };

  if (menuToggle) {
    menuToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleMenu();
    });
  }

  if (overlay) {
    overlay.addEventListener("click", () => {
      toggleMenu(true);
    });
  }
  
  // (Adicione aqui quaisquer outras funções gerais do seu script.js original)
  
  console.log("✅ Main.js carregado com sucesso!");
});

// js/main.js

document.addEventListener('DOMContentLoaded', () => {

    // (setupAuthUI() e outras lógicas continuam aqui...)
    setupAuthUI();
    
    // ==========================================================
    // ##### LÓGICA DO MENU DROPDOWN (VERSÃO CORRIGIDA) #####
    // ==========================================================
    const userMenuContainer = document.getElementById('user-menu');
    const triggerButton = document.getElementById('user-menu-trigger');

    // Só executa se os elementos do menu existirem na página
    if (userMenuContainer && triggerButton) {

        function toggleDropdown(event) {
            event.stopPropagation();
            // CORREÇÃO: Adiciona/remove a classe 'active' no CONTAINER, não no dropdown
            userMenuContainer.classList.toggle('active');
            
            // Atualiza o atributo para acessibilidade
            const isExpanded = userMenuContainer.classList.contains('active');
            triggerButton.setAttribute('aria-expanded', isExpanded);
        }

        // Adiciona o evento de clique ao botão
        triggerButton.addEventListener('click', toggleDropdown);

        // Listener para fechar o menu ao clicar fora
        document.addEventListener('click', (event) => {
            // Se o clique foi fora do container E o menu está ativo
            if (!userMenuContainer.contains(event.target) && userMenuContainer.classList.contains('active')) {
                userMenuContainer.classList.remove('active');
                triggerButton.setAttribute('aria-expanded', 'false');
            }
        });
    }
    // --- FIM DA LÓGICA DO MENU ---

    // (O resto do seu código de menu mobile, etc. continua aqui...)

});