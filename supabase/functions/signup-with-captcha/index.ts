// supabase/functions/signup-with-captcha/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, token, fullName } = await req.json()

    if (!email || !password || !token) {
      return new Response(JSON.stringify({ error: 'Email, senha e token são obrigatórios.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const recaptchaSecret = Deno.env.get('RECAPTCHA_SECRET_KEY')
    const recaptchaUrl = 'https://www.google.com/recaptcha/api/siteverify'
    
    const recaptchaResponse = await fetch(recaptchaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${recaptchaSecret}&response=${token}`,
    })

    const recaptchaData = await recaptchaResponse.json()

    if (!recaptchaData.success || recaptchaData.score < 0.5) {
      console.warn('Verificação reCAPTCHA falhou:', recaptchaData['error-codes'])
      return new Response(JSON.stringify({ error: 'Verificação anti-robô falhou.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }
    
    // CORREÇÃO APLICADA AQUI: Usando o novo nome da variável
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '' // <--- MUDANÇA AQUI
    )

    const { data: { user }, error } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName }
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.status || 500,
      })
    }

    return new Response(JSON.stringify({ user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})