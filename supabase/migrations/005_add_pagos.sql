create table public.pagos (
  id uuid default uuid_generate_v4() primary key,
  cita_id uuid references public.citas(id) on delete set null,
  paciente_id uuid references public.pacientes(id) on delete set null,
  paciente_nombre text not null,
  metodo_pago text check (metodo_pago in ('Pago Móvil', 'Zelle', 'Efectivo USD', 'Efectivo Bs', 'Transferencia', 'Exonerado')) not null,
  monto numeric(10,2) not null default 0 check (monto >= 0),
  fecha date not null default current_date,
  descripcion text not null,
  referencia text,
  registrado_por uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index pagos_fecha_idx on public.pagos(fecha);
create index pagos_cita_id_idx on public.pagos(cita_id);

alter table public.pagos enable row level security;

create policy "Usuarios autenticados pueden ver pagos" on public.pagos
for select using (auth.role() = 'authenticated');

create policy "Usuarios autenticados pueden registrar pagos" on public.pagos
for insert with check (auth.role() = 'authenticated');

create policy "Usuarios autenticados pueden actualizar pagos" on public.pagos
for update using (auth.role() = 'authenticated');
