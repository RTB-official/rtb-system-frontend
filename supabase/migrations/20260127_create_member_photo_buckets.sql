do $$
begin
  if not exists (select 1 from storage.buckets where id = 'profile-photos') then
    perform storage.create_bucket('profile-photos', public := false);
  end if;
  if not exists (select 1 from storage.buckets where id = 'passport-photos') then
    perform storage.create_bucket('passport-photos', public := false);
  end if;
end $$;

drop policy if exists "Profile photos read" on storage.objects;
drop policy if exists "Profile photos write" on storage.objects;
drop policy if exists "Profile photos update" on storage.objects;
drop policy if exists "Profile photos delete" on storage.objects;

create policy "Profile photos read"
  on storage.objects for select
  using (
    bucket_id = 'profile-photos'
    and (
      exists (
        select 1
        from profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
      or name like auth.uid()::text || '/%'
    )
  );

create policy "Profile photos write"
  on storage.objects for insert
  with check (
    bucket_id = 'profile-photos'
    and (
      exists (
        select 1
        from profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
      or name like auth.uid()::text || '/%'
    )
  );

create policy "Profile photos update"
  on storage.objects for update
  using (
    bucket_id = 'profile-photos'
    and (
      exists (
        select 1
        from profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
      or name like auth.uid()::text || '/%'
    )
  );

create policy "Profile photos delete"
  on storage.objects for delete
  using (
    bucket_id = 'profile-photos'
    and (
      exists (
        select 1
        from profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
      or name like auth.uid()::text || '/%'
    )
  );

drop policy if exists "Passport photos read" on storage.objects;
drop policy if exists "Passport photos write" on storage.objects;
drop policy if exists "Passport photos update" on storage.objects;
drop policy if exists "Passport photos delete" on storage.objects;

create policy "Passport photos read"
  on storage.objects for select
  using (
    bucket_id = 'passport-photos'
    and (
      exists (
        select 1
        from profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
      or name like auth.uid()::text || '/%'
    )
  );

create policy "Passport photos write"
  on storage.objects for insert
  with check (
    bucket_id = 'passport-photos'
    and (
      exists (
        select 1
        from profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
      or name like auth.uid()::text || '/%'
    )
  );

create policy "Passport photos update"
  on storage.objects for update
  using (
    bucket_id = 'passport-photos'
    and (
      exists (
        select 1
        from profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
      or name like auth.uid()::text || '/%'
    )
  );

create policy "Passport photos delete"
  on storage.objects for delete
  using (
    bucket_id = 'passport-photos'
    and (
      exists (
        select 1
        from profiles
        where profiles.id = auth.uid()
          and profiles.role = 'admin'
      )
      or name like auth.uid()::text || '/%'
    )
  );
