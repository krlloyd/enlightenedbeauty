-- Live mode and snapshots of the book. One salon row; backups are history.
create table if not exists salon_state (
  id text primary key,
  production boolean not null default false,
  backup_cadence text not null default 'daily',
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into salon_state (id) values ('salon')
  on conflict (id) do nothing;

create table if not exists salon_backups (
  id text primary key,
  kind text not null,
  note text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists salon_backups_created_idx on salon_backups (created_at desc);
