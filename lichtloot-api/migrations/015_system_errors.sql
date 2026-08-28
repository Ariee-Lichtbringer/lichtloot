alter table issue_reports add column if not exists status text not null default 'new';
alter table issue_reports add column if not exists reference_id text;
alter table issue_reports add column if not exists technical_details text;
alter table issue_reports add column if not exists action_name text;
alter table issue_reports add column if not exists http_status text;
alter table issue_reports add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_issue_reports_system_errors
  on issue_reports(guild_id, category, created_at desc);
