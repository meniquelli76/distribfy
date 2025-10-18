// js/supabase-client.js (VERSÃO FINAL E CORRETA)

const SUPABASE_URL = "https://scwakrklvfrdgnrkcbaj.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd2FrcmtsdmZyZGducmtjYmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NzA1NjcsImV4cCI6MjA3NDI0NjU2N30.f992js7qDqFMtrQkDjQ8JtD9XWmVBpa0PBO3zITCExw";

try {
    // Tenta criar o cliente usando o objeto 'supabase' global que o script local carregou
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Se bem-sucedido, disponibiliza a conexão para todos os outros scripts
    window.supabase = supabaseClient;
    console.log("✅ Supabase Conectado com Sucesso!");

} catch (e) {
    console.error("ERRO CRÍTICO: Falha ao inicializar o cliente Supabase. Verifique se o arquivo 'supabase.min.js' foi carregado antes deste.", e);
}