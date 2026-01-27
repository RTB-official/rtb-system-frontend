-- Allow admin and staff to manage vehicles
drop policy if exists "Admins can read vehicles" on vehicles;
drop policy if exists "Admins can insert vehicles" on vehicles;
drop policy if exists "Admins can update vehicles" on vehicles;
drop policy if exists "Admins can delete vehicles" on vehicles;

create policy "Admin or staff can read vehicles"
  on vehicles for select
  using (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  );

create policy "Admin or staff can insert vehicles"
  on vehicles for insert
  with check (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  );

create policy "Admin or staff can update vehicles"
  on vehicles for update
  using (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  )
  with check (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  );

create policy "Admin or staff can delete vehicles"
  on vehicles for delete
  using (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'staff')
    )
  );
