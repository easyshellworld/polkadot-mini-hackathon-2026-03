\c graph-node
create extension if not exists pg_trgm;
create extension if not exists btree_gist;
create extension if not exists postgres_fdw;
grant usage on foreign data wrapper postgres_fdw to graph;
