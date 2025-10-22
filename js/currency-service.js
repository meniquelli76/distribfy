// js/currency-service.js

window.CurrencyService = {

    /**
     * Busca a taxa de câmbio mais recente para converter USD para a moeda alvo.
     * @param {SupabaseClient} supabase - A instância do cliente Supabase.
     * @param {string} targetCurrencyCode - O código da moeda alvo (ex: "BRL").
     * @returns {Promise<number|null>} - A taxa de câmbio, ou null se não encontrada ou for USD.
     */
    async getExchangeRate(supabase, targetCurrencyCode) {
        if (targetCurrencyCode === 'USD') {
            return 1; // USD para USD é 1
        }
        try {
            const { data, error } = await supabase
                .from('exchange_rates')
                .select('usd_to_target_rate')
                .eq('target_currency_code', targetCurrencyCode)
                .order('last_updated', { ascending: false })
                .limit(1)
                .single();
            if (error) {
                if (error.code === 'PGRST116') { 
                    console.warn(`CurrencyService: Nenhuma taxa de câmbio encontrada para ${targetCurrencyCode}.`);
                    return null;
                }
                throw error;
            }
            return data.usd_to_target_rate;
        } catch (error) {
            console.error(`CurrencyService: Erro ao buscar taxa de câmbio para ${targetCurrencyCode}:`, error);
            return null;
        }
    },

    /**
     * Formata um valor numérico para uma string de moeda.
     * @param {number} value - O valor a ser formatado.
     * @param {string} currencyCode - O código ISO da moeda (ex: "BRL").
     * @returns {string} - O valor formatado (ex: "R$ 5.150").
     */
    formatCurrency(value, currencyCode) {
        try {
             return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: currencyCode,
                maximumFractionDigits: 0, 
                minimumFractionDigits: 0,
            }).format(value);
        } catch (e) {
             console.warn(`Intl.NumberFormat não suporta ${currencyCode}, usando fallback.`);
             return `${currencyCode} ${Math.round(value)}`;
        }
    },
    
    /**
     * ESTA É A NOVA FUNÇÃO QUE ESTAVA FALTANDO
     * Formata o texto de uma faixa aberta (ex: "Acima de R$ 50.000").
     * @param {number} value - O valor mínimo.
     * @param {string} currencyCode - O código da moeda.
     * @returns {string} - O label formatado.
     */
    formatOpenRange(value, currencyCode) {
        const prefix = "Acima de";
        const formatted_min = this.formatCurrency(value, currencyCode);
        return `${prefix} ${formatted_min}`;
    },


    /**
     * Busca as faixas de orçamento mestras (em USD) e as converte dinamicamente
     * (ESTA FUNÇÃO FOI ATUALIZADA)
     * @param {SupabaseClient} supabase - A instância do cliente Supabase.
     * @param {string} targetCurrencyCode - O código da moeda (ex: "BRL", "USD").
     * @returns {Promise<Array>} - Uma promessa que resolve para um array de faixas de orçamento formatadas.
     */
    async getDynamicBudgetRanges(supabase, targetCurrencyCode) {
    if (!supabase || !targetCurrencyCode) {
        console.warn("CurrencyService: Cliente Supabase ou código da moeda não fornecido.");
        return [];
    }

    try {
        console.log(`CurrencyService: Buscando faixas dinâmicas para ${targetCurrencyCode}...`);

        // 1. Buscar a taxa de câmbio
        const rate = await this.getExchangeRate(supabase, targetCurrencyCode);
        if (rate === null) {
            console.error(`Não foi possível obter a taxa de câmbio para ${targetCurrencyCode}.`);
            return [];
        }

        // 2. Buscar as faixas de orçamento mestras (que estão em USD)
        const { data: masterRanges, error: rangesError } = await supabase
            .from('budget_ranges')
            .select('id, min_usd, max_usd, label_usd') 
            .order('sort_order', { ascending: true });

        if (rangesError) {
            throw rangesError;
        }

        console.log('CurrencyService: Dados brutos recebidos:', masterRanges);

        // 3. Converter e formatar
        const convertedRanges = masterRanges.map(range => {
            let range_label;
            
            const min_converted = range.min_usd * rate;

            // LÓGICA MELHORADA - Verifica se é faixa aberta
            // Considera NULL, undefined ou valores muito altos como "faixa aberta"
            const isOpenRange = range.max_usd === null || 
                              range.max_usd === undefined || 
                              range.label_usd.toLowerCase().includes('above') ||
                              range.label_usd.toLowerCase().includes('acima');
            
            if (isOpenRange) {
                // Faixa aberta (sem limite superior)
                if (targetCurrencyCode === 'USD') {
                    range_label = range.label_usd; 
                } else {
                    range_label = this.formatOpenRange(min_converted, targetCurrencyCode);
                }
                
            } else {
                // Faixa normal (tem min e max)
                if (targetCurrencyCode === 'USD') {
                    range_label = range.label_usd;
                } else {
                    const max_converted = range.max_usd * rate;
                    const formatted_min = this.formatCurrency(min_converted, targetCurrencyCode);
                    const formatted_max = this.formatCurrency(max_converted, targetCurrencyCode);
                    range_label = `${formatted_min} - ${formatted_max}`;
                }
            }

            console.log(`Faixa ${range.id}: ${range_label}`);
            
            return {
                id: range.id, 
                range_label: range_label 
            };
        });
        
        console.log(`CurrencyService: ${convertedRanges.length} faixas convertidas para ${targetCurrencyCode}.`);
        return convertedRanges;

    } catch (error) {
        console.error("CurrencyService: Erro ao buscar faixas de orçamento dinâmicas:", error);
        return [];
    }
}
};