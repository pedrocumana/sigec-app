create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select coalesce((
    select p.is_active
    from public.profiles as p
    where p.id = auth.uid()
  ), false);
$$;

grant execute on function public.is_active_user() to authenticated;

-- A user may read their own inactive profile so the client can end the stale session.
drop policy if exists "Usuarios autenticados pueden ver perfiles" on public.profiles;
create policy "Usuarios autenticados pueden ver perfiles" on public.profiles
for select using (
  auth.role() = 'authenticated'
  and (id = auth.uid() or public.is_active_user())
);

drop policy if exists "Configuración visible para autenticados" on public.configuracion;
create policy "Configuración visible para autenticados" on public.configuracion
for select using (auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Solo médico actualiza configuración" on public.configuracion;
create policy "Solo médico actualiza configuración" on public.configuracion
for update using (
  auth.role() = 'authenticated' and public.is_active_user()
  and exists (select 1 from public.profiles where id = auth.uid() and rol = 'medico' and is_active)
) with check (
  auth.role() = 'authenticated' and public.is_active_user()
  and exists (select 1 from public.profiles where id = auth.uid() and rol = 'medico' and is_active)
);

drop policy if exists "Acceso total a pacientes a personal autenticado" on public.pacientes;
create policy "Acceso total a pacientes a personal autenticado" on public.pacientes
for all using (auth.role() = 'authenticated' and public.is_active_user())
with check (auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Acceso total a citas a personal autenticado" on public.citas;
create policy "Acceso total a citas a personal autenticado" on public.citas
for all using (auth.role() = 'authenticated' and public.is_active_user())
with check (auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Acceso a evoluciones a personal autenticado" on public.evoluciones;
create policy "Acceso a evoluciones a personal autenticado" on public.evoluciones
for all using (auth.role() = 'authenticated' and public.is_active_user())
with check (auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Usuarios autenticados pueden ver plantillas" on public.plantillas;
create policy "Usuarios autenticados pueden ver plantillas" on public.plantillas
for select using (auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Solo médicos pueden crear plantillas" on public.plantillas;
create policy "Solo médicos pueden crear plantillas" on public.plantillas
for insert with check (
  auth.role() = 'authenticated' and public.is_active_user()
  and exists (select 1 from public.profiles where id = auth.uid() and rol = 'medico' and is_active)
);

drop policy if exists "Solo médicos pueden actualizar plantillas" on public.plantillas;
create policy "Solo médicos pueden actualizar plantillas" on public.plantillas
for update using (
  auth.role() = 'authenticated' and public.is_active_user()
  and exists (select 1 from public.profiles where id = auth.uid() and rol = 'medico' and is_active)
) with check (
  auth.role() = 'authenticated' and public.is_active_user()
  and exists (select 1 from public.profiles where id = auth.uid() and rol = 'medico' and is_active)
);

drop policy if exists "Solo médicos pueden eliminar plantillas" on public.plantillas;
create policy "Solo médicos pueden eliminar plantillas" on public.plantillas
for delete using (
  auth.role() = 'authenticated' and public.is_active_user()
  and exists (select 1 from public.profiles where id = auth.uid() and rol = 'medico' and is_active)
);

drop policy if exists "Usuarios autenticados pueden ver pagos" on public.pagos;
create policy "Usuarios autenticados pueden ver pagos" on public.pagos
for select using (auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Usuarios autenticados pueden registrar pagos" on public.pagos;
create policy "Usuarios autenticados pueden registrar pagos" on public.pagos
for insert with check (auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Usuarios autenticados pueden actualizar pagos" on public.pagos;
create policy "Usuarios autenticados pueden actualizar pagos" on public.pagos
for update using (auth.role() = 'authenticated' and public.is_active_user())
with check (auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Usuarios autenticados pueden ver informes médicos" on public.informes_medicos;
create policy "Usuarios autenticados pueden ver informes médicos" on public.informes_medicos
for select using (auth.role() = 'authenticated' and public.is_active_user());

drop policy if exists "Solo médicos pueden crear informes médicos" on public.informes_medicos;
create policy "Solo médicos pueden crear informes médicos" on public.informes_medicos
for insert with check (
  auth.role() = 'authenticated' and public.is_active_user()
  and exists (select 1 from public.profiles where id = auth.uid() and rol = 'medico' and is_active)
);

drop policy if exists "Solo médicos pueden actualizar informes médicos" on public.informes_medicos;
create policy "Solo médicos pueden actualizar informes médicos" on public.informes_medicos
for update using (
  auth.role() = 'authenticated' and public.is_active_user()
  and exists (select 1 from public.profiles where id = auth.uid() and rol = 'medico' and is_active)
) with check (
  auth.role() = 'authenticated' and public.is_active_user()
  and exists (select 1 from public.profiles where id = auth.uid() and rol = 'medico' and is_active)
);
