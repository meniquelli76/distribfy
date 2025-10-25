// js/supabase-client.js (VERSÃO ESTÁVEL E SINCRONIZADA)

const SUPABASE_URL = 'https://scwakrklvfrdgnrkcbaj.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd2FrcmtsdmZyZGducmtjYmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NzA1NjcsImV4cCI6MjA3NDI0NjU2N30.f992js7qDqFMtrQkDjQ8JtD9XWmVBpa0PBO3zITCExw';

(function initializeSupabase() {
  try {
    // Cria o cliente Supabase
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // Torna globalmente acessível
    window.supabase = supabaseClient;

    console.log('✅ Supabase Conectado com Sucesso!');

    // 🔔 Dispara evento global avisando que o Supabase está pronto
    const evt = new Event('supabaseReady');
    window.dispatchEvent(evt);
  } catch (e) {
    console.error('🚨 ERRO CRÍTICO ao inicializar o Supabase:', e);
  }
})();
