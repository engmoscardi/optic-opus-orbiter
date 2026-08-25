create type public.app_role as enum ('admin','atualizador');
create type public.etapa_status as enum ('pendente','em_andamento','concluida','bloqueada');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "perfis visiveis para autenticados" on public.profiles for select to authenticated using (true);
create policy "usuario atualiza proprio perfil" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "papeis visiveis para autenticados" on public.user_roles for select to authenticated using (true);
create policy "admin gerencia papeis" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  cidade text,
  uf text,
  extensao_km numeric,
  responsavel text,
  prazo date,
  observacoes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.obras to authenticated;
grant all on public.obras to service_role;
alter table public.obras enable row level security;
create policy "obras visiveis para autenticados" on public.obras for select to authenticated using (true);
create policy "admin cria obras" on public.obras for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admin edita obras" on public.obras for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin exclui obras" on public.obras for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.obra_etapas (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras(id) on delete cascade,
  ordem int not null,
  nome text not null,
  status public.etapa_status not null default 'pendente',
  responsavel text,
  observacao text,
  data_conclusao date,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (obra_id, ordem)
);
grant select, insert, update, delete on public.obra_etapas to authenticated;
grant all on public.obra_etapas to service_role;
alter table public.obra_etapas enable row level security;
create policy "etapas visiveis para autenticados" on public.obra_etapas for select to authenticated using (true);
create policy "autenticados atualizam etapas" on public.obra_etapas for update to authenticated using (true) with check (true);
create policy "admin gerencia etapas" on public.obra_etapas for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger obras_updated_at before update on public.obras for each row execute function public.set_updated_at();
create trigger obra_etapas_updated_at before update on public.obra_etapas for each row execute function public.set_updated_at();

create or replace function public.criar_etapas_padrao() returns trigger language plpgsql security definer set search_path = public as $$
declare etapas text[] := array['Planejamento','Projetos','Protocolos de Licenças','Licenças para Obras','Fornecimento de Materiais','Dependência Extra','Execução','Baixa da Obra','Aceitação'];
  i int;
begin
  for i in 1..array_length(etapas,1) loop
    insert into public.obra_etapas (obra_id, ordem, nome) values (new.id, i, etapas[i]);
  end loop;
  return new;
end; $$;
create trigger obras_criar_etapas after insert on public.obras for each row execute function public.criar_etapas_padrao();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)), new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, case when (select count(*) from public.user_roles) = 0 then 'admin'::public.app_role else 'atualizador'::public.app_role end)
  on conflict do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();