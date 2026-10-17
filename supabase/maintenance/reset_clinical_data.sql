-- LIMPIEZA DE DATOS CLÍNICOS — EJECUCIÓN MANUAL Y DESTRUCTIVA
-- Ejecutar únicamente en el proyecto Supabase de DESARROLLO autorizado.
-- Elimina todos los registros de citas, pagos, evoluciones, informes médicos y pacientes.
-- No elimina perfiles ni configuración.
-- Reinicia seq_historia_clinica para que el siguiente paciente reciba HC-0001.
-- Verifique el proyecto seleccionado en Supabase Dashboard antes de ejecutar.

begin;

-- Evita escrituras concurrentes mientras se realiza la limpieza.
lock table
  public.citas,
  public.evoluciones,
  public.informes_medicos,
  public.pacientes,
  public.pagos
in access exclusive mode;

-- Se eliminan primero las tablas relacionadas y luego los pacientes.
delete from public.pagos;
delete from public.citas;
delete from public.evoluciones;
delete from public.informes_medicos;
delete from public.pacientes;

-- RESTART WITH 1 hace que el siguiente nextval() devuelva exactamente 1.
alter sequence public.seq_historia_clinica restart with 1;

-- Si alguna tabla no quedó vacía, aborta la transacción.
do $$
begin
  if exists (select 1 from public.citas limit 1)
    or exists (select 1 from public.evoluciones limit 1)
    or exists (select 1 from public.informes_medicos limit 1)
    or exists (select 1 from public.pacientes limit 1)
    or exists (select 1 from public.pagos limit 1) then
    raise exception 'La verificación de limpieza falló; se cancela la transacción.';
  end if;
end;
$$;

commit;

-- Resultado esperado: las cinco cantidades son 0 y la secuencia queda sin consumir.
select
  (select count(*) from public.citas) as citas,
  (select count(*) from public.evoluciones) as evoluciones,
  (select count(*) from public.informes_medicos) as informes_medicos,
  (select count(*) from public.pacientes) as pacientes,
  (select count(*) from public.pagos) as pagos;

select last_value, is_called
from public.seq_historia_clinica;
