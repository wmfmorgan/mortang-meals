-- Optional remote https image for library / plan cards.
alter table public.meals
  add column if not exists image_url text;
