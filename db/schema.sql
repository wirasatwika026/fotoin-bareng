create table if not exists sessions (
  id bigint generated always as identity primary key,
  code text unique not null,
  template text not null default 'couple',
  photo_a_keys text[] not null default '{}',
  photo_b_keys text[] not null default '{}',
  mode text not null default 'async',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

-- Untuk tabel yang sudah ada sebelum kolom-kolom ini diperkenalkan.
alter table sessions
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days');
alter table sessions
  add column if not exists mode text not null default 'async';
