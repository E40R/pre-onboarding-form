-- Pre-onboarding intake form: one table, one storage bucket.
-- Run this whole file once in the Supabase SQL editor for the target project
-- (kerugkjoaqfgyeerajqo). The anon key is the only credential the deployed
-- form ever holds, so RLS below is write-once: insert, never read/update/delete.

create extension if not exists pgcrypto;

create table if not exists pre_onboarding_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'submitted',

  -- Personal details
  full_name text not null,
  email text not null,
  phone text not null,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  blood_group text,

  -- Professional details: up to 4 entries, one array element each.
  -- Each element: { company_name, job_title, date_of_joining, date_of_relieving,
  --   joining_letter_path, relieving_letter_path, payslip_paths: [..up to 3],
  --   ctc_at_exit }
  experience jsonb not null default '[]',

  -- KYC
  aadhaar_number text,
  aadhaar_file_path text,
  pan_number text,
  pan_file_path text,
  account_type text check (account_type in ('passbook', 'cancelled_cheque')),
  account_number text,
  bank_proof_file_path text
);

alter table pre_onboarding_submissions enable row level security;

drop policy if exists "anon can submit" on pre_onboarding_submissions;
create policy "anon can submit"
  on pre_onboarding_submissions
  for insert
  to anon
  with check (true);

-- No select/update/delete policy for anon: once submitted, only someone
-- reading via the service_role key (HR side, later) can see it.

insert into storage.buckets (id, name, public)
values ('pre-onboarding-docs', 'pre-onboarding-docs', false)
on conflict (id) do nothing;

drop policy if exists "anon can upload onboarding docs" on storage.objects;
create policy "anon can upload onboarding docs"
  on storage.objects
  for insert
  to anon
  with check (bucket_id = 'pre-onboarding-docs');

-- No select/update/delete policy on the bucket for anon either: files are
-- write-once from the browser's point of view. The form previews a file the
-- visitor just chose from their own device (a local object URL), not from
-- storage, so it never needs to read anything back.
