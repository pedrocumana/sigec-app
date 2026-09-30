create table public.informes_medicos (
  id uuid default uuid_generate_v4() primary key,
  paciente_id uuid references public.pacientes(id) on delete cascade not null,
  paciente_nombre text not null,
  paciente_cedula text,
  fecha_emision date not null default current_date,
  informe text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index informes_medicos_paciente_id_idx on public.informes_medicos(paciente_id);
create index informes_medicos_fecha_idx on public.informes_medicos(fecha_emision);

alter table public.informes_medicos enable row level security;

create policy "Usuarios autenticados pueden ver informes médicos" on public.informes_medicos
for select using (auth.role() = 'authenticated');

create policy "Solo médicos pueden crear informes médicos" on public.informes_medicos
for insert with check (
  auth.role() = 'authenticated' and
  exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'medico'
  )
);

create policy "Solo médicos pueden actualizar informes médicos" on public.informes_medicos
for update using (
  auth.role() = 'authenticated' and
  exists (
    select 1 from public.profiles
    where id = auth.uid() and rol = 'medico'
  )
);
