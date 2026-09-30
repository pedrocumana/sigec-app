-- Habilitar extensión UUID
create extension if not exists "uuid-ossp";

-- 1. Tabla de Perfiles vinculada con Supabase Auth
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nombre text not null,
  rol text check (rol in ('medico', 'secretaria')) not null default 'secretaria',
  created_at timestamptz default now()
);

-- 2. Secuencia para Historias Clínicas (HC-0001, etc.)
create sequence if not exists seq_historia_clinica start 1;

-- 3. Tabla de Configuración Médica
create table public.configuracion (
  id int primary key default 1 check (id = 1),
  tasa_bcv numeric(10,2) not null default 36.50,
  medico_nombre text not null default 'Dr. Leonel Fernández',
  especialidad text not null default 'Medicina General / Interna',
  mpps text not null default 'MPPS-70414',
  colegio_medicos text not null default 'CMEB-6459',
  rif text not null default 'V-11725969',
  direccion_clinica text not null default 'Av. Germania, Edif. San Pedro, Piso 2, Consultorio 2-B. Ciudad Bolívar.',
  updated_at timestamptz default now()
);

insert into public.configuracion (id) values (1) on conflict do nothing;

-- 4. Tabla de Pacientes
create table public.pacientes (
  id uuid default uuid_generate_v4() primary key,
  historia text unique not null,
  cedula text,
  nombres text not null,
  fecha_nacimiento date,
  fecha_primera_cita date default current_date,
  telefono_principal text,
  telefono_secundario text,
  correo text,
  ocupacion text,
  direccion text,
  examen_funcional jsonb default '{}'::jsonb,
  examen_fisico jsonb default '{}'::jsonb,
  planteamiento jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Trigger para autogenerar número de historia correlativo
create or replace function set_historia_number()
returns trigger as $$
begin
  if new.historia is null or new.historia = '' then
    new.historia := 'HC-' || lpad(nextval('seq_historia_clinica')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger tr_set_historia
before insert on public.pacientes
for each row execute function set_historia_number();

-- 5. Tabla de Evolución Médica
create table public.evoluciones (
  id uuid default uuid_generate_v4() primary key,
  paciente_id uuid references public.pacientes(id) on delete cascade not null,
  fecha date not null default current_date,
  hora time not null default current_time,
  motivo text not null,
  signos_vitales jsonb default '{}'::jsonb, -- {pa, fc, fr, temp, peso, talla, imc}
  sintomas text,
  examen_breve text,
  diagnostico text,
  plan text,
  observaciones text,
  proxima_cita text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. Tabla de Citas y Caja
create table public.citas (
  id uuid default uuid_generate_v4() primary key,
  paciente_id uuid references public.pacientes(id) on delete set null,
  paciente_nombre text not null,
  paciente_telefono_secundario text,
  paciente_correo text,
  paciente_ocupacion text,
  fecha date not null,
  hora time not null,
  motivo text,
  estatus text check (estatus in ('Pendiente', 'En sala de espera', 'Confirmada', 'Completada', 'Cancelada', 'No asistió')) default 'Pendiente',
  metodo_pago text check (metodo_pago in ('Pendiente de Pago','Pago Móvil','Zelle','Efectivo USD','Efectivo Bs','Transferencia','Exonerado')) default 'Pendiente de Pago',
  monto_usd numeric(10,2) default 0.00,
  tasa_bcv numeric(10,2) default 36.50,
  exonerado boolean default false,
  atendida_en timestamptz,
  atendida_por uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- 7. Seguridad: Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.configuracion enable row level security;
alter table public.pacientes enable row level security;
alter table public.evoluciones enable row level security;
alter table public.citas enable row level security;

-- Políticas de lectura/escritura para usuarios autenticados
create policy "Usuarios autenticados pueden ver perfiles" on public.profiles for select using (auth.role() = 'authenticated');
create policy "Configuración visible para autenticados" on public.configuracion for select using (auth.role() = 'authenticated');
create policy "Solo médico actualiza configuración" on public.configuracion for update using (
  exists (select 1 from public.profiles where id = auth.uid() and rol = 'medico')
);

create policy "Acceso total a pacientes a personal autenticado" on public.pacientes for all using (auth.role() = 'authenticated');
create policy "Acceso total a citas a personal autenticado" on public.citas for all using (auth.role() = 'authenticated');
create policy "Acceso a evoluciones a personal autenticado" on public.evoluciones for all using (auth.role() = 'authenticated');