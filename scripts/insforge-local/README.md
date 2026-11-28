# Local InsForge SQL harness

Run against a dedicated, disposable PostgreSQL 17 cluster. The runner uses only
its Unix socket, verifies the server's data directory, and **drops and recreates
`tempo_test` on every run**. Never reuse another project's cluster directory.

From the repository root on the VPS, initialize the cluster once and start it:

```bash
pg="$HOME/kitchen-omniagent/runtime/pg"
cluster="$HOME/work/captain/pg-loop1-a"
port=55432
export LD_LIBRARY_PATH="$pg/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
mkdir -p -m 700 "$cluster"
"$pg/bin/initdb" -D "$cluster/data" -U postgres --auth-local=trust --auth-host=reject
"$pg/bin/pg_ctl" -D "$cluster/data" -l "$cluster/postgres.log" \
  -o "-k '$cluster' -p $port -c listen_addresses=''" -w start
bash scripts/insforge-local/run.sh
"$pg/bin/pg_ctl" -D "$cluster/data" -w stop
```

With an existing test cluster, omit `initdb`. For another binary installation,
set `PG_BIN` to its binary directory. To supply draft migrations or fixtures
and use a different local socket, run:

```bash
PGPORT=55433 bash scripts/insforge-local/run.sh /path/to/migrations /path/to/fixtures "$HOME/work/captain/pg-loop1-c"
```

The three arguments are optional. The first two default to `insforge/migrations`
and `insforge/tests` in this checkout (pass an empty string to keep a default).
The third defaults to `~/work/captain/pg-loop1-a`; its `data/` subdirectory
must be the cluster's actual data directory. Use matching ports at startup and
on the command line. A missing default migrations or fixtures directory is an
empty set, which lets the runner work before the first migration lands.

Name migrations with a leading timestamp. The runner visits `*.sql` in
bytewise filename order and applies each migration in one transaction as
`project_admin`, matching the current user of the InsForge Cloud migration
path. It installs the stub as `postgres`, sets the migration role inside
each transaction, then seeds users and runs fixtures in separate `postgres`
sessions. The summary counts migration and fixture files; any failed step
exits non-zero. This harness is not wired into CI yet.

## Fixture contract

After the migrations, the runner seeds two `auth.users` rows and passes their
UUIDs to every fixture as the psql variables `owner_id` and `other_id`. Use
`:'owner_id'` or `:'other_id'` for a quoted SQL literal outside a dollar-quoted
block. Wrap fixture changes in `begin;` and `rollback;` so fixtures are
independent. To exercise RLS, use `set local role authenticated;` and set
`request.jwt.claims` with the matching `sub` and `role`. If using a `DO` block,
call `auth.uid()` or read a setting populated outside the block, since psql
doesn't expand variables inside it. Raise an exception on any failed assertion.

## Migration role and grants

On the managed `tempo-flow` project, measurements for P50 confirmed that
`project_admin` is the current user of both the migration and strict raw
SQL paths (`postgres` is the session user). It owns its created tables,
has `BYPASSRLS`, is not a superuser, cannot create roles, and has no role
memberships. Measured object privileges:

- `CREATE` on the database and `public`; `USAGE`, but not `CREATE`, on
  `auth` and `realtime`.
- `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRIGGER` and `REFERENCES` on
  `auth.users`, including `REFERENCES` on `id`.
- `SELECT`, `INSERT`, `UPDATE` and `DELETE` on `realtime.channels`;
  `SELECT` and `INSERT` on `realtime.messages`.
- `EXECUTE` on `realtime.publish(text, text, jsonb)`,
  `realtime.channel_name()` and `auth.uid()`. `gen_random_uuid()` is
  available.

In Cloud, a superuser owns both realtime tables. The strict raw-SQL path
still allowed enabling RLS as `project_admin`, and migration 02 created the
owner-channel policy there. Stock PostgreSQL requires ownership for those
statements, so the stub makes `project_admin` the owner of the two realtime
tables. It removes the implicit owner table privileges and explicitly
grants back only the measured permissions; the local ownership is a DDL
emulation, not an assertion about Cloud ownership.

The stub preserves the InsForge OSS fixture convention of granting both
`anon` and `authenticated` CRUD on new public tables, with default privileges
set for the role that now creates those tables. RLS rejects writes and hides
rows when there is no matching policy. Unlike a superuser, `project_admin`
is subject to object privileges, including any removed from itself by a
migration. The local harness does not model the Auth API, SDK behavior, or
WebSocket delivery.

## Third-party license

`stub.sql` is adapted from [InsForge](https://github.com/InsForge/InsForge),
copyright 2025 Insforge Inc., under the Apache License, Version 2.0.

<details>
<summary>Apache License, Version 2.0</summary>

```text
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2025 Insforge Inc.

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

</details>
