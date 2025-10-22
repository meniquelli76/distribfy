// supabase/functions/update-exchange-rates/index.ts (Versão Bulletproof)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

console.log('Iniciando a função: update-exchange-rates')

Deno.serve(async (req) => {
  // 1. Verificação de segurança
  const authHeader = req.headers.get('Authorization')
  const cronSecret = Deno.env.get('CRON_SECRET')

  if (!cronSecret) {
    console.error('CRON_SECRET não está configurado. Função será encerrada.')
    return new Response(JSON.stringify({ error: 'CRON_SECRET não está configurado.' }), { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.warn('Falha na autenticação do cron job. Header recebido:', authHeader)
    return new Response(JSON.stringify({ error: 'Não autorizado.' }), { status: 401 })
  }

  // Se a autorização passar...
  console.log('Autenticação do cron job bem-sucedida.')
  try {
    // 2. Obter os segredos de ambiente
    const supabaseUrl = Deno.env.get('PROJECT_URL')
    const serviceRoleKey = Deno.env.get('PROJECT_SERVICE_ROLE_KEY')
    const apiKey = Deno.env.get('EXCHANGE_RATE_API_KEY')

    if (!supabaseUrl || !serviceRoleKey || !apiKey) {
      throw new Error('Variáveis de ambiente (PROJECT_URL, PROJECT_SERVICE_ROLE_KEY, EXCHANGE_RATE_API_KEY) não estão configuradas.')
    }

    // 3. Iniciar o cliente Supabase
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // 4. Chamar a API de câmbio
    console.log('Buscando taxas da API externa...')
    const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
    const response = await fetch(apiUrl)
    if (!response.ok) throw new Error(`Falha ao buscar dados da API: ${response.statusText}`)

    const data = await response.json()
    if (data.result !== 'success') throw new Error(`API de câmbio retornou um erro: ${data['error-type']}`)

    const rates = data.conversion_rates
    console.log(`Taxas recebidas para ${Object.keys(rates).length} moedas.`)

    // 5. Transformar os dados
    const ratesToInsert = Object.keys(rates).map(currencyCode => ({
      source_currency_code: 'USD',
      target_currency_code: currencyCode,
      usd_to_target_rate: rates[currencyCode],
      last_updated: new Date().toISOString()
    }))

    // 6. Fazer o UPSERT
    console.log('Realizando UPSERT no banco de dados...')
    const { error: upsertError } = await supabase
      .from('exchange_rates')
      .upsert(ratesToInsert, {
        onConflict: 'source_currency_code,target_currency_code',
      })

    if (upsertError) throw upsertError

    const successMessage = `Taxas de câmbio atualizadas com sucesso. ${ratesToInsert.length} registros processados.`
    console.log(successMessage)

    // 7. Retornar sucesso
    return new Response(JSON.stringify({ message: successMessage }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    const errorMessage = `Erro na Edge Function: ${error.message}`
    console.error(errorMessage)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})