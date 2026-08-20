do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'plant_id' and table_name = 'garden_plants' and column_name = 'garden_name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'plant_id' and table_name = 'garden_plants' and column_name = 'plant_name'
  ) then
    alter table plant_id.garden_plants rename column garden_name to plant_name;
  end if;
end $$;

alter table plant_id.garden_plants
  drop constraint if exists garden_plants_name_check;

alter table plant_id.garden_plants
  drop constraint if exists garden_plants_plant_name_check;

alter table plant_id.garden_plants
  add constraint garden_plants_plant_name_check check (length(trim(plant_name)) > 0);
