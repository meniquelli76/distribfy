// js/test-connection.js
// Um script simples para testar a conexão com o Supabase de forma isolada.

console.log("--- INICIANDO TESTE DE CONEXÃO ISOLADO ---");

async function runConnectionTest() {
    // 1. Verifica se o SDK do Supabase (o script da CDN) foi carregado
    if (typeof supabase === 'undefined') {
        console.error("FALHA NA ETAPA 1: O SDK global 'supabase' não foi encontrado. Verifique se o script da CDN está sendo carregado corretamente no HTML e não está sendo bloqueado.");
        return;
    }
    console.log("SUCESSO NA ETAPA 1: SDK global 'supabase' encontrado.");

    const SUPABASE_URL = "https://scwakrklvfrdgnrkcbaj.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjd2FrcmtsdmZyZGducmtjYmFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2NzA1NjcsImV4cCI6MjA3NDI0NjU2N30.f992js7qDqFMtrQkDjQ8JtD9XWmVBpa0PBO3zITCExw";

    try {
        // 2. Tenta criar um cliente Supabase
        const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("SUCESSO NA ETAPA 2: Cliente Supabase criado.");

        // 3. Tenta buscar dados da tabela 'festivals'
        console.log("Tentando buscar 1 festival da tabela 'festivals'...");
        let { data, error } = await supabaseClient
            .from('festivals')
            .select('id, festival_name')
            .limit(1);

        if (error) {
            console.error("FALHA NA ETAPA 3: Erro na busca de dados:", error);
        } else {
            console.log(">>> SUCESSO TOTAL! Conexão com o banco de dados funcionando. <<<");
            console.log("Dados recebidos:", data);
        }
    } catch (e) {
        console.error("FALHA CRÍTICA NA ETAPA 2: Erro ao tentar criar o cliente Supabase.", e);
    }
}

// Roda o teste
runConnectionTest();