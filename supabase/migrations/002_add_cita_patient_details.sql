-- Keep the deployed citas table compatible with the current appointment form.
alter table public.citas
  add column if not exists paciente_telefono_secundario text,
  add column if not exists paciente_correo text,
  add column if not exists paciente_ocupacion text;
