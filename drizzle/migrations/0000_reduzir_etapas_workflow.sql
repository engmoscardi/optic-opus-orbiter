CREATE OR REPLACE FUNCTION public.criar_etapas_padrao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare etapas text[] := array['Projetos','Protocolos de Licenças','Dependência Extra','Execução','Aceitação'];
  i int;
begin
  for i in 1..array_length(etapas,1) loop
    insert into public.obra_etapas (obra_id, ordem, nome) values (new.id, i, etapas[i]);
  end loop;
  return new;
end;
$function$;
REVOKE EXECUTE ON FUNCTION public.criar_etapas_padrao() FROM public, anon, authenticated;