# Hunchday — Social Layer Plan

The daily game is done and good. This plan adds the social layer on top of it without
disturbing the single-player feel: accounts, friends, daily scoring, friend leaderboards, and
per-player distributions, on Supabase.

## Locked decisions

- **Integrity: option A** — trust the client, harden-ready. Friends-only leaderboards are
  self-policing. The client submits its outcome; the **server recomputes the score** and the
  **date**, enforces one result per day, and rejects future/backfilled submissions. The submitted
  guesses are stored as `proof` so server-side validation (option B) can be added later with no
  schema change.
- **Auth: passwordless email OTP code** — `signInWithOtp` then `verifyOtp`. No password, email
  verified by construction, no redirect/callback page needed (the code is entered in-app), session
  persists in `localStorage`.
- **MVP = chunks 0–3.** Chunks 4–5 (distributions/streaks/all-time, then realtime/hardening) land
  later with **no schema change**.
- **Scoring:** per cracked machine, difficulty-weighted `super_easy 1 / easy 1 / medium 2 /
  hard 3`, plus a **+1 clean-crack bonus** when that machine was cracked with zero misses. A
  **failed (revealed) machine = flat 0.** Max 11/day. Tunable; lives in one SQL function.
- **Design philosophy is a first-class constraint** — see "Design fit" in every chunk. The
  components are the message; prose is capped. New screens reuse the game's own primitives.

## Architecture

The existing Vite SPA talks **directly to Supabase**; **RLS is the only security boundary**, so
there is no custom backend. The `anon` key is public and safe *because* every table has RLS.

- **Auth:** Supabase email OTP.
- **Postgres + RLS:** `profiles`, `friendships`, `daily_results`, plus `SECURITY DEFINER`
  functions for search, friend requests, the score, and the leaderboard.
- **Edge Functions:** none needed for the MVP. Reserved for option B (validate `proof` against a
  server-only answer table) and any future secret logic.
- **Realtime:** optional polish in chunk 5.

### Forward-compatibility rules (so chunks bolt on cleanly)

1. **Migrations are additive** (`supabase/migrations/*.sql`), never edited after the fact.
2. **Tables carry their full shape from day one** — `daily_results.per_machine` and `proof` exist
   in the first migration, so distributions and option B need no schema change.
3. **RLS and the score function exist from the start** — never retrofitted.
4. **All Supabase access goes through `src/social/`** — the UI never holds a raw query, so
   extending/replacing queries stays local.
5. **Anonymous play always works.** The account is an opt-in layer; signed-out players keep the
   exact current experience (localStorage save, no prompts).

## Logistics / foundation

- **Project:** one Supabase project. Public config in env: `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY` (Vite exposes `VITE_`-prefixed vars to the client). Set locally and in
  the deploy.
- **Schema as code:** Supabase CLI. `supabase init`, migrations in `supabase/migrations/`,
  `supabase start` for the full local stack, `supabase db push` to the hosted project.
- **Auth config (once):** enable email provider + email OTP; set Site URL; trim the OTP email
  template. No redirect URL handling (OTP code, not magic link).
- **Puzzle date:** the UTC calendar date, identical on client and server (matches the existing
  per-day localStorage key). The server trigger stamps `puzzle_date` from `now() at utc`.
- **Budgets:** Supabase free tier is ample (50k MAU, 500MB). Keep the added client JS small
  (`@supabase/supabase-js` is the only new dep) to respect the design-language perf budget.

### Client module boundary (`src/social/`)

```
src/social/
  client.ts       // the single supabase client
  types.ts        // Profile, Friendship, DailyResult, LeaderRow
  auth.ts         // requestCode(email), verifyCode(email, token), signOut(), useSession()
  profile.ts      // myProfile(), createProfile(username), isUsernameFree(username)
  results.ts      // submitResult(summary), myResult(date)
  friends.ts      // search(q), request(id), respond(id, accept), list(), inviteCode()
  leaderboard.ts  // today(date)
```

UI screens live in `src/ui/social/` and import only from `src/social/`.

---

## Chunk 0 — Foundation (accounts exist)

**Scope:** Supabase wired in, passwordless sign-in, profiles + usernames, the `src/social/`
scaffold. The game is unchanged for signed-out players.

**Migration:**

```sql
create extension if not exists citext;

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     citext unique not null,
  display_name text,
  created_at   timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,20}$')
);

alter table profiles enable row level security;
create policy profiles_select on profiles for select to authenticated using (true);
create policy profiles_insert on profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
```

Usernames are public handles (email lives in `auth.users`, never exposed), so `select` is open to
authenticated users — this makes friend search a plain query later.

**Client:** `auth.ts` (request/verify OTP, `useSession`), `profile.ts` (create/read,
`isUsernameFree`), `client.ts`.

**Screens:** sign-in (one email field on the intro background → 6-box code), username setup (one
field, availability as a quiet ✓/amber). An account entry point in a corner of the navbar; the
game itself stays open to anonymous players.

**Design fit:** sign-in reuses the intro layout + the bot; the code input echoes a chip row; the
username ✓ uses green, taken uses amber — no helper sentences.

**Done when:** a new email can sign in via code and pick a unique username; refresh keeps the
session; signed-out play is untouched.

---

## Chunk 1 — Results submission (scores persist, authoritatively)

**Scope:** record each finished day server-side, scored by the server.

**Client capture:** the reducer already tracks `results` (per-machine cracked) and cumulative
`misses`. Add a small per-machine summary recorded at each reveal — `{ slot, difficulty, cracked,
misses, method }` (`method` = `guess | recipe | null`) — accumulated and submitted on `finish`.
This is the only game-side change and it is purely additive.

**Migration:**

```sql
create table daily_results (
  user_id     uuid not null references profiles(id) on delete cascade,
  puzzle_date date not null,
  score       int  not null default 0,
  cracked     smallint not null default 0,
  misses      smallint not null default 0,
  per_machine jsonb not null,   -- [{slot,difficulty,cracked,misses,method}]
  proof       jsonb,            -- submitted guesses/recipes, for option B later
  created_at  timestamptz not null default now(),
  primary key (user_id, puzzle_date)
);

-- One place for the scoring rule.
create or replace function compute_daily_score(per_machine jsonb)
returns int language sql immutable as $$
  select coalesce(sum(
    case when (m->>'cracked')::boolean then
      (case m->>'difficulty'
        when 'super_easy' then 1 when 'easy' then 1
        when 'medium' then 2 when 'hard' then 3 else 0 end)
      + (case when coalesce((m->>'misses')::int, 0) = 0 then 1 else 0 end)  -- clean-crack bonus
    else 0 end
  ), 0)::int
  from jsonb_array_elements(per_machine) m;
$$;

-- Server is authoritative for date, score, and the derived tallies.
create or replace function before_daily_result()
returns trigger language plpgsql as $$
begin
  new.puzzle_date := (now() at time zone 'utc')::date;
  new.score   := compute_daily_score(new.per_machine);
  new.cracked := (select count(*) from jsonb_array_elements(new.per_machine) m
                  where (m->>'cracked')::boolean);
  new.misses  := (select coalesce(sum((m->>'misses')::int), 0)
                  from jsonb_array_elements(new.per_machine) m);
  return new;
end; $$;
create trigger trg_before_daily_result before insert on daily_results
  for each row execute function before_daily_result();

alter table daily_results enable row level security;
create policy dr_insert on daily_results for insert to authenticated
  with check (user_id = auth.uid());
create policy dr_select_self on daily_results for select to authenticated
  using (user_id = auth.uid());
-- friends-read policy added in chunk 2 (needs the friendships table).
-- No update/delete policy: a day's result is immutable once submitted.
```

Submission is idempotent: `insert ... on conflict (user_id, puzzle_date) do nothing` — first
(final) submission wins, so a replay can't overwrite.

**Client:** `results.ts` — `submitResult(summary)` (called from `finish` when signed in),
`myResult(date)`.

**Design fit:** no new UI yet; the end screen can quietly show "saved" state via existing tokens.

**Done when:** finishing a day while signed in stores a row whose `score` matches the formula
regardless of any client-sent score; a second submit is a no-op; signed-out finish is unchanged.

---

## Chunk 2 — Friends (a social graph)

**Scope:** request/accept friends by username and by invite link.

**Migration:**

```sql
create type friend_status as enum ('pending','accepted','blocked');

create table friendships (
  requester_id uuid not null references profiles(id) on delete cascade,
  addressee_id uuid not null references profiles(id) on delete cascade,
  status       friend_status not null default 'pending',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  constraint no_self check (requester_id <> addressee_id)
);

alter table friendships enable row level security;
create policy fr_select on friendships for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy fr_delete on friendships for delete to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());
-- inserts/updates go through the definer functions below.

-- Accepted friend ids of the caller, for reuse in policies and queries.
create or replace function friend_ids()
returns table (id uuid) language sql stable security definer set search_path = public as $$
  select case when requester_id = auth.uid() then addressee_id else requester_id end
  from friendships
  where status = 'accepted' and (requester_id = auth.uid() or addressee_id = auth.uid());
$$;

-- Send a request, collapsing a reverse-pending into an immediate accept.
create or replace function send_friend_request(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if target = auth.uid() then raise exception 'cannot friend yourself'; end if;
  if exists (select 1 from friendships
             where requester_id = target and addressee_id = auth.uid() and status = 'pending') then
    update friendships set status = 'accepted', updated_at = now()
      where requester_id = target and addressee_id = auth.uid();
  else
    insert into friendships (requester_id, addressee_id)
      values (auth.uid(), target)
      on conflict do nothing;
  end if;
end; $$;

create or replace function respond_friend_request(other uuid, accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  update friendships
    set status = case when accept then 'accepted'::friend_status else 'blocked'::friend_status end,
        updated_at = now()
    where requester_id = other and addressee_id = auth.uid() and status = 'pending';
end; $$;

create or replace function search_profiles(q text)
returns table (id uuid, username citext, display_name text)
language sql stable security definer set search_path = public as $$
  select id, username, display_name from profiles
  where username = q::citext and id <> auth.uid()
  limit 5;
$$;
```

Add the friends-read policy to `daily_results`:

```sql
create policy dr_select_friends on daily_results for select to authenticated
  using (user_id in (select id from friend_ids()));
```

**Invite link:** `hunchday.com/add/<username>` opens the app with a pre-filled request to that
handle (no extra table — the username is the code).

**Client:** `friends.ts` — `search`, `request`, `respond`, `list`, `inviteCode`.

**Screens:** a friends roster + a small "requests" area.

**Design fit:** friends render as **chips** (initials, machine accent), reusing the chip
primitive. Pending requests in **amber**, accepted in **green**. "Add" is a **Share-style button**
(the Share component already exists) for the invite link. It reads as a roster, not a form.

**Done when:** two accounts can friend each other by username and by link; a reverse request
auto-accepts; either can unfriend; only the parties can see the edge.

---

## Chunk 3 — Today's leaderboard (the payoff)

**Scope:** rank you + friends on today's score.

**Migration:**

```sql
create or replace function friend_leaderboard(on_date date)
returns table (user_id uuid, username citext, display_name text,
               score int, cracked smallint, misses smallint, per_machine jsonb)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.display_name, d.score, d.cracked, d.misses, d.per_machine
  from daily_results d
  join profiles p on p.id = d.user_id
  where d.puzzle_date = on_date
    and (d.user_id = auth.uid() or d.user_id in (select id from friend_ids()))
  order by d.score desc, d.misses asc, d.created_at asc;
$$;
```

**Client:** `leaderboard.ts` — `today(date)`.

**Screen:** a ranked list, reachable from the end screen.

**Design fit:** each row renders the player's day in the **end-screen language** — the **four
result dots** (cracked filled / revealed hollow, the same component), a small **score**, the
**name**. You are highlighted in **machine purple**. Position is the rank — no "1st/2nd," no prose.
A row never says "Alice cracked 3 of 4 for 5"; it shows three filled dots and a 5.

**Done when:** finishing a day surfaces "how friends did today," ranked, in the game's visual
language; non-friends never appear.

**— End of MVP (chunks 0–3). —**

---

## Chunk 4 — Distributions, streaks, all-time (no schema change)

**Scope:** a profile view aggregated from `daily_results`, plus streaks and an all-time board.

**Functions (read-only aggregates):**

- `my_distribution()` → score-per-day series + counts (the "1/1/2 distribution").
- `my_slot_rates()` → crack rate per slot (how often each of the four machines is cracked).
- `streaks(uid)` → current and best streak via a SQL window over consecutive `puzzle_date`s.
- `friend_alltime()` → total score, current streak, days played, ranked.

**Design fit:** **no number tables.** Score-over-time is a tiny **machine-purple histogram**
(sparkline feel); per-slot crack rate is the **four tier-colored dots filled proportionally** (the
same dots doing double duty); streak is a single number. Glanceable, not read.

**Done when:** a profile shows distribution, per-slot rates, and streak with charts only; an
all-time friend board ranks totals/streaks.

---

## Chunk 5 — Polish / hardening (optional)

- **Realtime:** subscribe to `daily_results` so the leaderboard updates live as friends finish.
- **Option B hardening:** a server-only `answers` table + an Edge Function (or trigger) that
  validates the already-captured `proof` against the truth. Because `proof` has been stored since
  chunk 1, this is additive — no migration to the result shape, no client rework beyond pointing
  submission at the validator.

---

## Chunk 6 — Telemetry capture + dataset (the analytics workstream)

**Scope:** record one structured row per machine played, with timing and attempt detail, so a
real dataset accumulates. This is a distinct workstream that depends on the auth + results layer
(chunks 0–1). No model here — just clean capture.

**Client capture (extends chunk 1, additive):** stamp machine start (on `loadMachine`) and end (on
reveal); record each attempt as a compact event `{ t, kind: test|guess|recipe, ok }`; tally
guesses/recipes/tests/misses; compute `duration_ms`. Accumulate per machine, submit at `finish`.

**The machine's identity is its signature**, not the date — the same pipeline recurs across days,
so pooling by signature is what gives each machine a real sample. `machine_sig` is built the same
way as the determinism day signature, per machine (`opId + JSON.stringify(params)`, joined).
**Features are derived from `machine_sig` at training time** (op set/count, rungs, list-length and
param stats, tier) by a shared extractor — so feature engineering evolves with no migration, and
the same extractor featurizes a fresh machine at precompute.

**Migration:**

```sql
create table machine_plays (
  id          bigint generated always as identity primary key,
  user_id     uuid references profiles(id) on delete cascade,
  puzzle_date date not null,
  slot        smallint not null,
  difficulty  text not null,        -- displayed tier
  machine_sig text not null,        -- ops+params; the machine identity across dates
  cracked     boolean not null,
  method      text,                 -- guess | recipe | null
  guesses     smallint not null default 0,
  recipes     smallint not null default 0,
  tests       smallint not null default 0,
  misses      smallint not null default 0,
  duration_ms int,
  events      jsonb,                -- [{t, kind, ok}] per-attempt timeline
  created_at  timestamptz not null default now()
);
create index machine_plays_sig_idx  on machine_plays (machine_sig);
create index machine_plays_date_idx on machine_plays (puzzle_date);

alter table machine_plays enable row level security;
create policy mp_insert on machine_plays for insert to authenticated with check (user_id = auth.uid());
create policy mp_select_self on machine_plays for select to authenticated using (user_id = auth.uid());
-- All cross-user analysis uses the service-role key (bypasses RLS); never exposed to clients.
```

**Privacy:** telemetry is **opt-in** — a single switch in account settings, gated by a
`profiles.telemetry_opt_in boolean default false` column added here; off → nothing written.
Machine-level aggregates carry no PII.

**Client:** `src/social/telemetry.ts` — `recordPlays(rows)`; the capture lives in the reducer/App
as an additive per-machine summary, written only when signed in + opted in.

**Design fit:** invisible in play. One opt-in toggle in settings (a switch, no prose).

**Done when:** an opted-in player's finished day writes one `machine_plays` row per machine with
signature, timing, attempt counts, and outcome.

---

## Chunk 7 — Ratings & prediction (train a model on the recorded dataset)

**Scope:** the recorded `machine_plays` rows are the **training set**. A batch training step (Python
/ scikit-learn) fits ratings and a difficulty predictor; the trained model is then used to score
future machines and to validate fairness. This is the loop-closer.

**Pipeline (run when enough data has accrued; versioned model artifact):**

1. **Pull the dataset** via the service-role key (full read, bypasses RLS).
2. **Empirical stats per `machine_sig`** — plays, crack rate, median duration, attempts by method.
   Cheap to also materialize in Postgres (`pg_cron`) for a live dev dashboard.
3. **Ratings via item response / Elo** — fit each play as `P(crack) = σ(θ_p − β_m)`: `θ` a player
   ability, `β` a machine difficulty. This separates "hard machine" from "weak player," giving a
   principled **general rating** per machine (`β`) and per player (`θ`) that raw crack rate can't.
4. **Feature extraction** — `machine_sig → features` (op ids/count, rung sum, list-length and param
   stats, tier). The same extractor runs at precompute on un-played machines.
5. **Predictor** — train a **scikit-learn regressor** (e.g., gradient boosting / random forest) on
   `features → β` (and/or → crack rate, time), validated on held-out plays. This is what
   **predicts a fresh machine's rating before anyone plays it**.
6. **Fairness flags** — extreme `β`, high outcome variance, or anomalous time/attempts flag a
   machine for review; and test whether the structural fairness rejects (C/L patterns) actually
   correlate with healthier play, so the catalog is validated against evidence.
7. **Feedback into generation** — serialize the predictor; at build-time `precompute`, featurize
   each generated machine, predict its `β`, then calibrate slot assignment, drop predicted-unfair
   machines, and tune the [[difficulty-model]] knobs. The loop closes here.

**Where inference runs:** scoring a machine is cheap — load the serialized model at `precompute`
and predict. Surfacing a predicted tier in-game is deferred (build-time input only for now).

**Design fit:** none in-game yet; if a predicted tier is ever shown, reuse the tier dots/colors.

**Done when:** the dataset trains a validated `features → rating` model, and `precompute` can score
a generated machine with it before launch.

---

## Scoring reference (one source of truth)

| machine | weight | clean-crack bonus | failed |
|---|---|---|---|
| super_easy (slot 0) | 1 | +1 | 0 |
| easy (slot 1) | 1 | +1 | 0 |
| medium (slot 2) | 2 | +1 | 0 |
| hard (slot 3) | 3 | +1 | 0 |

Max 11/day (7 base + 4 clean bonuses). Strategy-agnostic: Test/Guess/Recipe never change the
score; only the outcome and misses do. The rule lives only in `compute_daily_score`; tuning is a
one-function migration.

## Tunable knobs (deliberately easy to change later)

- Per-slot weights and the clean-crack bonus size.
- Whether to add a small all-cracked ("sweep") bonus.
- Tiebreak order on the leaderboard.
- Streak definition (any submission vs. ≥N score).
- Move to partial credit for cracked-some-challenges if flat-0 ever feels harsh.
