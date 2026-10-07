import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const authorization = request.headers.get('Authorization');
    if (!supabaseUrl || !serviceRoleKey) return respond({ error: 'Configuración administrativa incompleta.' }, 500);
    if (!authorization) return respond({ error: 'Sesión requerida.' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const token = authorization.replace(/^Bearer\s+/i, '');
    const { data: { user: currentUser }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !currentUser) return respond({ error: 'Sesión inválida.' }, 401);

    const { data: currentProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('rol, is_active')
      .eq('id', currentUser.id)
      .maybeSingle();
    if (profileError) return respond({ error: 'No se pudo verificar el rol del usuario.' }, 500);
    if (currentProfile?.rol !== 'medico' || currentProfile.is_active === false) {
      return respond({ error: 'Solo un médico activo puede administrar accesos.' }, 403);
    }

    const body = await request.json();
    const targetId = typeof body.userId === 'string' ? body.userId : '';
    if (!targetId || typeof body.active !== 'boolean') {
      return respond({ error: 'Indica un usuario y el estado de acceso solicitado.' }, 400);
    }
    if (targetId === currentUser.id && body.active === false) {
      return respond({ error: 'No puedes inhabilitar tu propia cuenta.' }, 400);
    }

    const { data: target, error: targetError } = await adminClient
      .from('profiles')
      .select('id, rol, is_active, disabled_at, disabled_by')
      .eq('id', targetId)
      .maybeSingle();
    if (targetError) return respond({ error: 'No se pudo consultar la cuenta indicada.' }, 500);
    if (!target) return respond({ error: 'No se encontró el usuario.' }, 404);

    if (target.rol === 'medico' && target.is_active && body.active === false) {
      const { count, error: countError } = await adminClient
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('rol', 'medico')
        .eq('is_active', true);
      if (countError) return respond({ error: 'No se pudo verificar cuántos médicos activos quedan.' }, 500);
      if ((count || 0) <= 1) return respond({ error: 'No se puede inhabilitar al último médico activo.' }, 400);
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        is_active: body.active,
        disabled_at: body.active ? null : new Date().toISOString(),
        disabled_by: body.active ? null : currentUser.id
      })
      .eq('id', targetId);
    if (updateError) return respond({ error: 'No se pudo actualizar el estado del usuario.' }, 500);

    // Ban the Auth identity as defense in depth; keep the Auth user/profile rows and historical references.
    const { error: banError } = await adminClient.auth.admin.updateUserById(targetId, {
      ban_duration: body.active ? 'none' : '876000h'
    });
    if (banError) {
      await adminClient.from('profiles').update({
        is_active: target.is_active,
        disabled_at: target.disabled_at,
        disabled_by: target.disabled_by
      }).eq('id', targetId);
      return respond({ error: 'No se pudo aplicar el bloqueo de inicio de sesión.' }, 500);
    }

    return respond({ userId: targetId, active: body.active });
  } catch (error) {
    console.error('Error administrando acceso de usuario:', error);
    return respond({ error: 'Error interno al actualizar el acceso.' }, 500);
  }
});
