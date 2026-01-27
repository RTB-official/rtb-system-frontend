alter table profiles add column if not exists profile_photo_bucket text;
alter table profiles add column if not exists profile_photo_path text;
alter table profiles add column if not exists profile_photo_name text;

alter table profile_passports add column if not exists passport_image_bucket text;
alter table profile_passports add column if not exists passport_image_path text;
alter table profile_passports add column if not exists passport_image_name text;
