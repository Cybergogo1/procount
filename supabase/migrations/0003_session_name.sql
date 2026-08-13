-- Session name (client request, Aug 2026): let the user name a count from the
-- export sheet (e.g. "Aisle 4", "Back stockroom"). The name is included in the
-- report email subject and attachment filename. Nullable — naming is optional.
alter table public.sessions add column name text;
