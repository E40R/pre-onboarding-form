# Pre-onboarding form

Standalone public form (no login) that collects a new hire's personal,
professional and KYC details before onboarding, and writes them into the
`kerugkjoaqfgyeerajqo` Supabase project.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_ANON_KEY` (Project
   Settings → API → anon public key, in the Supabase dashboard for
   `kerugkjoaqfgyeerajqo`).
3. Run `db/schema.sql` once in that project's SQL editor — creates the
   `pre_onboarding_submissions` table and the `pre-onboarding-docs` storage
   bucket, both insert-only for the anon key.
4. `npm run dev`

## Notes

- Anon key can only INSERT — no read/update/delete, on the table or the
  storage bucket. HR review of submissions happens with the service_role key,
  not from this app.
- File previews before submit ("View" / "Change") use a local object URL from
  the browser, not a round-trip to storage — files upload only on final
  submit.
