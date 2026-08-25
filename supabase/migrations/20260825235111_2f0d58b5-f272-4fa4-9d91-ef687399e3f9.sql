revoke all on function public.criar_etapas_padrao() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.set_updated_at() from public;
revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;