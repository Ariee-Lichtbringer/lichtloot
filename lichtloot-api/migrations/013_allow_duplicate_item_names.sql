alter table items drop constraint if exists items_raid_type_name_key;

create index if not exists items_raid_type_name_idx
  on items (lower(raid_type), lower(name));

create index if not exists items_raid_type_item_id_idx
  on items (lower(raid_type), item_id)
  where item_id is not null;
