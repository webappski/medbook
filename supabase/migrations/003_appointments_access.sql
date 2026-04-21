-- =============================================
-- MedBook: Appointments RLS Policies
-- patient_id is set server-side by looking up profile by email
-- email fallback covers old records created before this fix
-- =============================================

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Helper function: check admin role without triggering profiles RLS recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "allow_select_own_appointments" ON appointments;
DROP POLICY IF EXISTS "allow_insert_appointments" ON appointments;
DROP POLICY IF EXISTS "allow_update_own_appointments" ON appointments;

-- Anyone can INSERT (widget bookings are anonymous)
CREATE POLICY "allow_insert_appointments"
  ON appointments FOR INSERT
  WITH CHECK (true);

-- Authenticated users see their own appointments:
-- primary: patient_id match (set server-side after this fix)
-- fallback: email match (covers bookings before the fix)
-- admins see everything
CREATE POLICY "allow_select_own_appointments"
  ON appointments FOR SELECT
  USING (
    patient_id = auth.uid()
    OR email = (auth.jwt() ->> 'email')
    OR is_admin()
  );

-- Users can update (cancel) their own appointments
CREATE POLICY "allow_update_own_appointments"
  ON appointments FOR UPDATE
  USING (
    patient_id = auth.uid()
    OR email = (auth.jwt() ->> 'email')
    OR is_admin()
  );
