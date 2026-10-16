import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

type Action = 'create' | 'set_password' | 'delete';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Validate caller is an admin
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'No auth token' }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Invalid session' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) return json({ error: 'Admin role required' }, 403);

    const body = await req.json();
    const action = body.action as Action;
    const client_id = body.client_id as string;
    if (!client_id) return json({ error: 'client_id required' }, 400);

    if (action === 'create') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      if (!email || password.length < 8) {
        return json({ error: 'Email y contraseña (mín 8) requeridos' }, 400);
      }

      // Try to find existing auth user by email
      let portalUserId: string | null = null;
      const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = existing?.users?.find((u) => (u.email ?? '').toLowerCase() === email);
      if (found) {
        portalUserId = found.id;
        const { error: upErr } = await admin.auth.admin.updateUserById(found.id, {
          password,
          email_confirm: true,
        });
        if (upErr) throw upErr;
      } else {
        const { data: created, error: crErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { portal_client_id: client_id },
        });
        if (crErr) throw crErr;
        portalUserId = created.user!.id;
      }

      // Grant client_access (idempotent)
      const { data: existAccess } = await admin
        .from('client_access')
        .select('id')
        .eq('client_id', client_id)
        .eq('user_id', portalUserId!)
        .maybeSingle();
      if (!existAccess) {
        const { error: acErr } = await admin
          .from('client_access')
          .insert({ client_id, user_id: portalUserId });
        if (acErr) throw acErr;
      }

      // Upsert credentials record
      const { error: credErr } = await admin.from('client_portal_credentials').upsert(
        {
          client_id,
          portal_user_id: portalUserId,
          portal_email: email,
          created_by: userData.user.id,
        },
        { onConflict: 'client_id' },
      );
      if (credErr) throw credErr;

      return json({ ok: true, portal_user_id: portalUserId, email });
    }

    if (action === 'set_password') {
      const password = String(body.password ?? '');
      if (password.length < 8) return json({ error: 'Contraseña mín 8 caracteres' }, 400);
      const { data: cred } = await admin
        .from('client_portal_credentials')
        .select('portal_user_id')
        .eq('client_id', client_id)
        .maybeSingle();
      if (!cred?.portal_user_id) return json({ error: 'No hay usuario portal creado' }, 404);
      const { error } = await admin.auth.admin.updateUserById(cred.portal_user_id, { password });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === 'delete') {
      const { data: cred } = await admin
        .from('client_portal_credentials')
        .select('portal_user_id')
        .eq('client_id', client_id)
        .maybeSingle();
      if (cred?.portal_user_id) {
        await admin.from('client_access').delete()
          .eq('client_id', client_id).eq('user_id', cred.portal_user_id);
        await admin.auth.admin.deleteUser(cred.portal_user_id);
      }
      await admin.from('client_portal_credentials').delete().eq('client_id', client_id);
      return json({ ok: true });
    }

    // Usuarios adicionales: solo ven ESTE portal (client_access), sin rol de Operación.
    if ((action as string) === 'list_members') {
      const { data: rows } = await admin.from('client_access').select('id, user_id, created_at').eq('client_id', client_id);
      const { data: usersRes } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const members = (rows ?? []).map((r: any) => {
        const u = usersRes?.users?.find((x) => x.id === r.user_id);
        return { ...r, email: u?.email ?? null, full_name: (u?.user_metadata as any)?.full_name ?? null, last_sign_in_at: u?.last_sign_in_at ?? null };
      });
      return json({ members });
    }

    if ((action as string) === 'add_member') {
      const email = String(body.email ?? '').trim().toLowerCase();
      const password = String(body.password ?? '');
      const full_name = String(body.full_name ?? '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'Correo inválido' }, 400);
      if (password.length < 8) return json({ error: 'Contraseña mín 8 caracteres' }, 400);
      const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const found = existing?.users?.find((u) => (u.email ?? '').toLowerCase() === email);
      let uid: string;
      if (found) {
        uid = found.id;
        const { error } = await admin.auth.admin.updateUserById(uid, { password, email_confirm: true });
        if (error) throw error;
      } else {
        const { data: created, error } = await admin.auth.admin.createUser({
          email, password, email_confirm: true,
          user_metadata: { portal_client_id: client_id, ...(full_name ? { full_name } : {}) },
        });
        if (error) throw error;
        uid = created.user!.id;
      }
      const { data: ex } = await admin.from('client_access').select('id')
        .eq('client_id', client_id).eq('user_id', uid).maybeSingle();
      if (!ex) {
        const { error } = await admin.from('client_access').insert({ client_id, user_id: uid });
        if (error) throw error;
      }
      return json({ ok: true, user_id: uid });
    }

    return json({ error: 'Acción inválida' }, 400);
  } catch (e: any) {
    return json({ error: e.message ?? String(e) }, 500);
  }
});