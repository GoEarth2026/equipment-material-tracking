create table if not exists public.equipment_material_app_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.equipment_material_app_state enable row level security;

drop policy if exists "Allow public read app state" on public.equipment_material_app_state;
create policy "Allow public read app state"
on public.equipment_material_app_state
for select
to anon
using (true);

drop policy if exists "Allow public insert app state" on public.equipment_material_app_state;
create policy "Allow public insert app state"
on public.equipment_material_app_state
for insert
to anon
with check (true);

drop policy if exists "Allow public update app state" on public.equipment_material_app_state;
create policy "Allow public update app state"
on public.equipment_material_app_state
for update
to anon
using (true)
with check (true);

create or replace function public.set_equipment_material_app_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_equipment_material_app_state_updated_at on public.equipment_material_app_state;
create trigger set_equipment_material_app_state_updated_at
before update on public.equipment_material_app_state
for each row
execute function public.set_equipment_material_app_state_updated_at();
