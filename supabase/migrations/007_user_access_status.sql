alter table public.profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references public.profiles(id);

create index if not exists profiles_is_active_idx on public.profiles(is_active);
