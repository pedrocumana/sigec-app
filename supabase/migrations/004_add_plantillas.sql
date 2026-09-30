create table public.plantillas (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  plan text,
  tratamiento text,
  activo boolean default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create or replace function public.set_updated_at_plantillas()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tr_set_updated_at_plantillas
before update on public.plantillas
for each row execute function public.set_updated_at_plantillas();

alter table public.plantillas enable row level security;

create policy "Usuarios autenticados pueden ver plantillas" on public.plantillas
for select using (auth.role() = 'authenticated');

create policy "Solo médicos pueden crear plantillas" on public.plantillas
for insert with check (
  auth.role() = 'authenticated' and
  exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'medico'
  )
);

create policy "Solo médicos pueden actualizar plantillas" on public.plantillas
for update using (
  auth.role() = 'authenticated' and
  exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'medico'
  )
);

create policy "Solo médicos pueden eliminar plantillas" on public.plantillas
for delete using (
  auth.role() = 'authenticated' and
  exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'medico'
  )
);
