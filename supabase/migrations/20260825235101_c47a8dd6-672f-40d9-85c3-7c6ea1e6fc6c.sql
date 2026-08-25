revoke execute on function public.criar_etapas_padrao() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from anon;