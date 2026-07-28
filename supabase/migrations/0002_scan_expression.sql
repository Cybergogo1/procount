-- Calculator feature (client request, June 2026): store the +/× expression that
-- produced each scan's quantity, so it can be shown in-app and included in the
-- export. Nullable for backward compatibility with rows created before this.
alter table public.scans add column expression text;
