// js/currency-service.js

// Criamos um objeto global para nosso serviço, para ser acessado por outros scripts.
window.CurrencyService = {

    /**
     * Busca na tabela budget_ranges as faixas de orçamento para uma moeda específica.
     * @param {SupabaseClient} supabase - A instância do cliente Supabase.
     * @param {string} currencyCode - O código da moeda (ex: "BRL", "USD").
     * @returns {Promise<Array>} - Uma promessa que resolve para um array de faixas de orçamento.
     */
    async getBudgetRangesByCurrency(supabase, currencyCode) {
        if (!supabase || !currencyCode) {
            console.warn("CurrencyService: Supabase client ou código da moeda não fornecido.");
            return []; // Retorna um array vazio se não houver código de moeda
        }

        try {
            console.log(`CurrencyService: Buscando faixas de orçamento para a moeda ${currencyCode}...`);
            const { data, error } = await supabase
                .from('budget_ranges')
                .select('id, range_label')
                .eq('currency_code', currencyCode)
                .order('sort_order');

            if (error) {
                throw error;
            }

            console.log(`CurrencyService: ${data.length} faixas encontradas.`);
            return data;

        } catch (error) {
            console.error("CurrencyService: Erro ao buscar faixas de orçamento:", error);
            return []; // Retorna array vazio em caso de erro
        }
    }

 
};