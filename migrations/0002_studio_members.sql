-- Studio desk roles. First signed-in login becomes owner; everyone else needs
-- an invite matching their email before they can open the desk.
create table if not exists studio_members (
  id text primary key,
  user_id text,
  email text not null,
  name text not null default '',
  role text not null,
  staff_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists studio_members_email_lower_idx
  on studio_members (lower(email));

create unique index if not exists studio_members_user_id_idx
  on studio_members (user_id)
  where user_id is not null;

create index if not exists studio_members_role_idx on studio_members (role);
