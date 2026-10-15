create table if not exists public.participants (
  id smallint primary key check (id between 1 and 20),
  name text not null unique,
  auth_user_id uuid unique references auth.users (id) on delete set null
);

insert into public.participants (id, name) values
  (1, 'Nicolly'),
  (2, 'Leonardo Senerine'),
  (3, 'Leo Denardi'),
  (4, 'Vanda'),
  (5, 'Alex'),
  (6, 'Pérola'),
  (7, 'Tayonan'),
  (8, 'Vânia'),
  (9, 'Gabs'),
  (10, 'Vitor'),
  (11, 'Aurora'),
  (12, 'Rodrigo'),
  (13, 'Aguinaldo'),
  (14, 'Bárbara'),
  (15, 'Nilza'),
  (16, 'Gabi'),
  (17, 'Ingrid'),
  (18, 'Amanda'),
  (19, 'Andrey'),
  (20, 'Sheila')
on conflict (id) do nothing;

create table if not exists public.assignments (
  giver_id smallint primary key references public.participants (id) on delete cascade,
  recipient_id smallint not null unique references public.participants (id) on delete cascade,
  check (giver_id <> recipient_id)
);

create table if not exists public.wish_items (
  id uuid primary key default gen_random_uuid(),
  owner_id smallint not null references public.participants (id) on delete cascade,
  item text not null check (char_length(item) between 1 and 100),
  created_at timestamptz not null default now()
);

alter table public.participants enable row level security;
alter table public.assignments enable row level security;
alter table public.wish_items enable row level security;

create or replace function public.get_participants()
returns table (id smallint, name text, is_claimed boolean, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.name,
    p.auth_user_id is not null,
    case when p.auth_user_id is null then null else p.auth_user_id::text || '/avatar.jpg' end
  from public.participants p
  order by p.id;
$$;

grant execute on function public.get_participants() to anon, authenticated;

create or replace function public.get_my_participant()
returns table (id smallint, name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.name, auth.uid()::text || '/avatar.jpg'
  from public.participants p
  where p.auth_user_id = auth.uid();
$$;

grant execute on function public.get_my_participant() to authenticated;

create or replace function public.claim_participant(participant_id smallint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.participants
  set auth_user_id = auth.uid()
  where id = participant_id
    and auth_user_id is null;

  get diagnostics affected_rows = row_count;
  if affected_rows > 0 then
    return true;
  end if;

  return exists (
    select 1 from public.participants p
    where p.id = participant_id and p.auth_user_id = auth.uid()
  );
end;
$$;

grant execute on function public.claim_participant(smallint) to authenticated;

create or replace function public.draw_once()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipients smallint[];
begin
  if auth.uid() is null or not exists (
    select 1 from public.participants p where p.auth_user_id = auth.uid()
  ) then
    raise exception 'Participant sign-in required';
  end if;

  perform pg_advisory_xact_lock(4202026);

  if exists (select 1 from public.assignments) then
    return true;
  end if;

  if (select count(*) from public.participants) <> 20 then
    raise exception 'The draw requires 20 participants';
  end if;

  loop
    select array_agg(p.id order by random())
    into recipients
    from public.participants p;

    exit when not exists (
      select 1
      from unnest(recipients) with ordinality as r(id, position)
      where r.id = r.position
    );
  end loop;

  insert into public.assignments (giver_id, recipient_id)
  select p.id, recipients[p.id]
  from public.participants p;

  return true;
end;
$$;

grant execute on function public.draw_once() to authenticated;

create or replace function public.current_participant_id()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select p.id from public.participants p where p.auth_user_id = auth.uid();
$$;

grant execute on function public.current_participant_id() to authenticated;

drop policy if exists "assignments read own recipient" on public.assignments;

create policy "assignments read own recipient"
on public.assignments for select to authenticated
using (giver_id = public.current_participant_id());

grant select on public.assignments to authenticated;

grant select, insert, delete on public.wish_items to authenticated;

drop policy if exists "wish items read owner or assigned giver" on public.wish_items;
drop policy if exists "wish items insert owner" on public.wish_items;
drop policy if exists "wish items delete owner" on public.wish_items;

create policy "wish items read owner or assigned giver"
on public.wish_items for select to authenticated
using (
  owner_id = public.current_participant_id()
  or exists (
    select 1 from public.assignments a
    where a.giver_id = public.current_participant_id()
      and a.recipient_id = owner_id
  )
);

create policy "wish items insert owner"
on public.wish_items for insert to authenticated
with check (owner_id = public.current_participant_id());

create policy "wish items delete owner"
on public.wish_items for delete to authenticated
using (owner_id = public.current_participant_id());

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create or replace function public.can_read_avatar(owner_user_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participants owner
    join public.assignments a on a.recipient_id = owner.id
    where owner.auth_user_id::text = owner_user_id
      and a.giver_id = public.current_participant_id()
  );
$$;

drop policy if exists "avatar owner upload" on storage.objects;
drop policy if exists "avatar owner or assigned giver read" on storage.objects;
drop policy if exists "avatar owner update" on storage.objects;
drop policy if exists "avatar owner delete" on storage.objects;

create policy "avatar owner upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatar owner or assigned giver read"
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.can_read_avatar((storage.foldername(name))[1])
  )
);

create policy "avatar owner update"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatar owner delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
