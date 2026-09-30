import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = request.headers.get('Authorization');

    if (!authorization) {
      return new Response(JSON.stringify({ error: 'Sesión requerida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: authorization } }
    });
    const { data: { user: currentUser } } = await adminClient.auth.getUser(authorization.replace('Bearer ', ''));

    if (!currentUser) {
      return new Response(JSON.stringify({ error: 'Sesión inválida.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: currentProfile } = await adminClient
      .from('profiles')
      .select('rol')
      .eq('id', currentUser.id)
      .single();

    if (currentProfile?.rol !== 'medico') {
      return new Response(JSON.stringify({ error: 'Solo un médico puede crear usuarios.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { email, password, nombre, rol } = await request.json();
    const normalizedRole = String(rol || '').trim().toLowerCase();

    if (!email || !password || !nombre || !['medico', 'secretaria'].includes(normalizedRole)) {
      return new Response(JSON.stringify({ error: 'Completa email, contraseña, nombre y rol válido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (String(password).length < 6) {
      return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: createdUser, error: createError } = await adminClient.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password: String(password),
      email_confirm: true
    });

    if (createError || !createdUser.user) {
      return new Response(JSON.stringify({ error: createError?.message || 'No se pudo crear el usuario.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { error: profileError } = await adminClient.from('profiles').insert({
      id: createdUser.user.id,
      nombre: String(nombre).trim(),
      rol: normalizedRole
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(createdUser.user.id);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ id: createdUser.user.id, nombre: String(nombre).trim(), rol: normalizedRole }), {
      status: 201,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Error interno.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
