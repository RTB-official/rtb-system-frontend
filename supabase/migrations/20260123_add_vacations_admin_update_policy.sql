-- Allow admins/대표 to approve/reject any vacation
-- Adjust role/position values to match your profiles table

create policy "Admins can update any vacations"
  on vacations for update
  using (
    exists (
      select 1
      from profiles
      where profiles.id = auth.uid()
        and (profiles.role = 'admin' or profiles.position = '대표')
    )
  )
  with check (true);
