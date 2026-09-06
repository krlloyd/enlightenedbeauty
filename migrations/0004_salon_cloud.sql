-- Off-site backup copies (Google Drive or an S3-compatible bucket).
alter table salon_state add column if not exists cloud_kind text not null default 'off';
alter table salon_state add column if not exists cloud_config jsonb not null default '{}'::jsonb;
alter table salon_state add column if not exists cloud_error text;
alter table salon_state add column if not exists last_cloud_at timestamptz;

create table if not exists salon_cloud_files (
  id text primary key,
  kind text not null,
  remote_id text not null default '',
  name text not null,
  note text not null default '',
  clients integer not null default 0,
  appointments integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists salon_cloud_files_created_idx on salon_cloud_files (created_at desc);
