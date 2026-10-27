-- Bajas lógicas de usuarios, tareas del catálogo y planes de mantenimiento.
-- Aplicar una sola vez sobre una base creada con una versión anterior de schema.sql.
-- Es idempotente: se puede volver a ejecutar sin error.
begin;

alter table usuarios             add column if not exists activo boolean not null default true;
alter table tareas_catalogo      add column if not exists activa boolean not null default true;
alter table planes_mantenimiento add column if not exists activo boolean not null default true;

commit;