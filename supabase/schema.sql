create table public.ebc_states (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 state jsonb not null check (jsonb_typeof(state)='object' and octet_length(state::text)<2000000),
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.ebc_states enable row level security;
revoke all on public.ebc_states from anon;
grant select,insert,update on public.ebc_states to authenticated;
create policy owner_read on public.ebc_states for select to authenticated using ((select auth.uid())=owner_id);
create policy owner_insert on public.ebc_states for insert to authenticated with check ((select auth.uid())=owner_id);
create policy owner_update on public.ebc_states for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create function public.ebc_save_state(p_expected_revision bigint,p_state jsonb) returns bigint language plpgsql security invoker set search_path='' as $$
declare r bigint;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 if p_expected_revision=0 then
 insert into public.ebc_states(owner_id,state) values(auth.uid(),p_state) on conflict do nothing returning revision into r;
 else
 update public.ebc_states set state=p_state,revision=revision+1,updated_at=now() where owner_id=auth.uid() and revision=p_expected_revision returning revision into r;
 end if;
 if r is null then raise exception 'EBC_CONFLICT'; end if;
 return r;
end $$;
revoke all on function public.ebc_save_state(bigint,jsonb) from public,anon;
grant execute on function public.ebc_save_state(bigint,jsonb) to authenticated;
create table public.ebc_signup_limits (bucket text primary key, attempts integer not null);
alter table public.ebc_signup_limits enable row level security;
revoke all on public.ebc_signup_limits from anon,authenticated;
create function public.ebc_signup_budget(p_bucket text) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
 delete from public.ebc_signup_limits where bucket < to_char(now()-interval '2 hour','YYYYMMDDHH24');
 insert into public.ebc_signup_limits values(p_bucket,1) on conflict(bucket) do update set attempts=public.ebc_signup_limits.attempts+1 returning attempts into n;
 return n<=20;
end $$;
revoke all on function public.ebc_signup_budget(text) from public,anon,authenticated;
grant execute on function public.ebc_signup_budget(text) to service_role;
-- This table is server-only. The service_role budget function bypasses RLS.
create policy deny_client_signup_budget on public.ebc_signup_limits for all to anon,authenticated using(false) with check(false);
