/* A worksheet read (several labelled lines in ONE call) returns more tokens: raise the per-call output cap. */
create or replace function public.record_ink_tokens(p_input integer, p_cached integer, p_output integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.ai_usage
     set input_tokens    = input_tokens + least(greatest(coalesce(p_input, 0), 0), 8000),
         cached_tokens   = cached_tokens + least(greatest(coalesce(p_cached, 0), 0), least(greatest(coalesce(p_input, 0), 0), 8000)),
         output_tokens   = output_tokens + least(greatest(coalesce(p_output, 0), 0), 1200),
         ink_token_calls = ink_token_calls + 1
   where user_id = (select auth.uid()) and day = public.addis_today() and ink_token_calls < ink_checks + ink_hints
$$;
revoke all on function public.record_ink_tokens(integer, integer, integer) from public, anon;
grant execute on function public.record_ink_tokens(integer, integer, integer) to authenticated;
