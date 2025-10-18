// supabase/functions/login-with-captcha/index.ts (Versão de Depuração)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  console.log('[DEBUG] 1. Função "login-with-captcha" foi chamada.');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { email, password, token } = body;
    console.log('[DEBUG] 2. Corpo da requisição recebido:', body);

    if (!email || !password || !token) {
      console.error('[DEBUG] ERRO: Faltando email, senha ou token.');
      return new Response(JSON.stringify({ error: 'Email, senha e token são obrigatórios.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    console.log('[DEBUG] 3. Dados de entrada validados com sucesso.');

    const recaptchaSecret = Deno.env.get('RECAPTCHA_SECRET_KEY')
    console.log('[DEBUG] 4. Chave secreta do reCAPTCHA carregada.');

    const recaptchaResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${recaptchaSecret}&response=${token}`,
    })
    console.log('[DEBUG] 5. Resposta da API do Google recebida.');

    const recaptchaData = await recaptchaResponse.json()
    console.log('[DEBUG] 6. Resposta do Google (JSON):', recaptchaData);

    if (!recaptchaData.success || recaptchaData.score < 0.5) {
      console.warn('[DEBUG] Verificação reCAPTCHA falhou:', recaptchaData['error-codes'])
      return new Response(JSON.stringify({ error: 'Verificação anti-robô falhou.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }
    console.log('[DEBUG] 7. Verificação reCAPTCHA bem-sucedida!');
    
    // O resto do código continua igual...
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    )

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: email,
      password: password,
    })

    if (error) {
      console.error('[DEBUG] Erro do Supabase ao tentar fazer login:', error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.status || 500,
      })
    }

    console.log('[DEBUG] 8. Login realizado com sucesso pelo Supabase!');
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('[DEBUG] Erro inesperado no bloco catch:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})