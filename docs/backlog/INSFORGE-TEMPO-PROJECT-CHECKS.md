# Tempo InsForge project checks (P07)

Checked 2026-11-26, 21:10 Asia/Jerusalem, by the Capy loop lead for Amit (ticket #1973). Read-only. No user was created, no SQL was applied, no setting was changed and no email was sent.

Vault item: "InsForge tempo-flow" in the 1Password dev vault, read through Executor only. Values were never printed, logged, written to a file or put on a command line.

## Verdict

The project answers and its public auth settings are readable. Two things block the rest:

1. **Project identity is not confirmed.** The item's `project_name` does not contain "tempo" (or "flow"). It is a different project from the "InsForge omniagent" item (different project_id, API_BASE_URL and project_name). Grok Bot must confirm that this item is the Tempo project.
2. **No key-safe route for admin reads.** Executor has no InsForge app or HTTP source that can send the API key. So admin-only reads (grants, auth config, migration history) can't be made without putting the key somewhere this repo's rules forbid. A connector is needed (see Needs).

## Vault item (names only)

| Field | State |
|---|---|
| credential | SET |
| API_BASE_URL | SET (https, `*.insforge.app`) |
| project_id | SET |
| project_name | SET (12 characters, does not contain "tempo") |
| anon key | **UNSET**: the item has no anon-key field |

Item category: API_CREDENTIAL. Last updated 2026-11-26 18:23 UTC.

## Checks

| # | Check | Result | Proof |
|---|---|---|---|
| 1 | Project is Tempo (by project_name) | **UNKNOWN**: name does not contain "tempo"; not the omniagent project | Executor read of the vault item, compared in-program; only booleans returned |
| 2 | Project is up | **PROVEN**: InsForge OSS Backend 2.3.5, status ok | `GET <API_BASE_URL>/api/health` (public) |
| 3 | Public auth settings | **PROVEN**: OAuth github and google; requireEmailVerification true; verifyEmailMethod code; resetPasswordMethod code; disableSignup false; passwordMinLength 6 | `GET <API_BASE_URL>/api/auth/public-config` (public) |
| 4 | Email OTP sign-in is on | **UNKNOWN**: public-config does not expose it. The endpoint exists (`POST /api/auth/email/send-otp`, 6-digit code, 5-minute expiry, then `POST /api/auth/sessions` with `method: otp`). Testing it sends email, so it was not called. | [auth.yaml](https://raw.githubusercontent.com/InsForge/InsForge/main/openapi/auth.yaml) |
| 5 | Allowed redirect URLs include the preview | **UNKNOWN**: `allowedRedirectUrls` is only in the admin `GET /api/auth/config` | needs the admin read (Needs 2) |
| 6 | Default grants for anon/authenticated | **UNKNOWN on this project.** OSS default: `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated, project_admin` plus the same `ALTER DEFAULT PRIVILEGES`. The P01 harness stub already follows that. | [db-init.sql](https://raw.githubusercontent.com/InsForge/InsForge/main/deploy/docker-init/db/db-init.sql); the read-only query below needs Needs 2 |
| 7 | Remote migration apply path | **FOUND (docs), not executed.** `@insforge/cli db migrations up` or `POST /api/database/migrations` (admin). 14-digit timestamp versions (ours: `20261127NN0000`), one transaction per file, `BEGIN/COMMIT/ROLLBACK` rejected (our two migrations have none), history in `system.custom_migrations`, PostgREST reloads automatically. | [migrations](https://docs.insforge.dev/core-concepts/database/migrations), [REST database](https://docs.insforge.dev/sdks/rest/database) |
| 8 | Raw SQL path for the loader | **FOUND (docs), not executed.** `POST /api/database/advance/rawsql` (strict; blocks auth.users) and `/rawsql/unrestricted` (allows INSERT into system tables such as auth.users). CLI: `db query [--unrestricted]`. Both enforce a 30 s `statement_timeout`. | [REST database](https://docs.insforge.dev/sdks/rest/database), [migrations](https://docs.insforge.dev/core-concepts/database/migrations) |
| 9 | Admin user-creation path | **FOUND (docs), not executed.** `POST /api/auth/users` requires email and password, so it does not fit passwordless imported users. The loader's path is SQL into `auth.users` through `/rawsql/unrestricted`. Whether an SQL-created user can then sign in by email OTP is **UNKNOWN** until one test user is tried (Needs 3). | [auth.yaml](https://raw.githubusercontent.com/InsForge/InsForge/main/openapi/auth.yaml) |
| 10 | Anon key source | **FOUND (docs).** `GET /api/metadata/anon-key` (admin); `POST /api/auth/tokens/anon` is deprecated. Not read: the key isn't in the vault and an admin call needs Needs 2. | [auth.yaml](https://raw.githubusercontent.com/InsForge/InsForge/main/openapi/auth.yaml) |

Read-only query for check 6, once a key-safe route exists:

```sql
select r.rolname as role, p.privilege,
  count(*) filter (where has_table_privilege(r.rolname, c.oid, p.privilege)) as tables_granted,
  count(*) as tables
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join (values ('anon'), ('authenticated')) as r(rolname)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) as p(privilege)
where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
group by 1, 2 order by 1, 2;
select defaclrole::regrole as owner_role,
  case when defaclnamespace = 0 then '(all schemas)' else defaclnamespace::regnamespace::text end as schema,
  defaclobjtype, defaclacl
from pg_default_acl
where defaclnamespace in (0, 'public'::regnamespace)
order by 1, 2, 3;
```

The first query reports effective privileges per role and privilege, using `has_table_privilege`, so grants that come through PUBLIC count as well as direct grants. The second also lists global default privileges (`defaclnamespace = 0`), with the object class in `defaclobjtype`. Both were checked for syntax on the local harness cluster only.

## What this unblocks for P45 (remote load)

- **Unblocked:** the apply design. Migrations go through `db migrations up` (or `POST /api/database/migrations`) as-is. The loader's `load.sql` goes through `/rawsql/unrestricted`, split into statements that each finish within 30 s, because auth.users inserts need the unrestricted path.
- **Still blocked:** (1) project identity; (2) a key-safe connector for admin calls; (3) one approved test of OTP sign-in for an SQL-created user; (4) the anon key in the vault for the web preview (`NEXT_PUBLIC_INSFORGE_ANON_KEY`).

## Needs (in order)

1. **Grok Bot:** confirm "InsForge tempo-flow" is the Tempo project (its project_name doesn't say so), and add the anon key to that item as a field (for example `anon_key`).
2. **Amit / Grok Bot:** an Executor connection to this InsForge project, with the API key bound in Executor, for admin read-only calls (OpenAPI source or HTTP app). Without it, checks 5 and 6 and every remote step of P45 stay blocked under the Executor-only key rule.
3. **Amit:** approve one test user (created by SQL on this project) to confirm email OTP sign-in for imported users. This sends one email, so it's an AT step.
