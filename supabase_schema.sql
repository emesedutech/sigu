-- ================================================================
-- ASISTEN GURU PINTAR — Supabase SQL Schema
-- Jalankan ini di Supabase → SQL Editor
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- profiles (linked 1:1 to auth.users)
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  school_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, school_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'school_name'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- students
CREATE TABLE students (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nisn       VARCHAR(20),
  name       TEXT NOT NULL,
  class      TEXT NOT NULL,
  gender     VARCHAR(1) CHECK (gender IN ('L','P')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, nisn)
);
CREATE INDEX idx_students_teacher ON students(teacher_id);

-- attendance
CREATE TABLE attendance (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  status     VARCHAR(10) NOT NULL CHECK (status IN ('Hadir','Izin','Sakit','Alpa')),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);
CREATE INDEX idx_attendance_date    ON attendance(date);
CREATE INDEX idx_attendance_student ON attendance(student_id);

-- behavior_logs
CREATE TABLE behavior_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  type        VARCHAR(10) NOT NULL CHECK (type IN ('positive','negative')),
  description TEXT NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_behavior_student ON behavior_logs(student_id);

-- grades
CREATE TABLE grades (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject         TEXT NOT NULL,
  score           NUMERIC(5,2) CHECK (score >= 0 AND score <= 100),
  remarks         TEXT,
  assessment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject, assessment_date)
);

-- schedules
CREATE TABLE schedules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  subject     TEXT NOT NULL,
  class       TEXT,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  room        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE students      ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance    ENABLE ROW LEVEL SECURITY;
ALTER TABLE behavior_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades        ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self"     ON profiles      FOR ALL USING (auth.uid() = id);
CREATE POLICY "students_owner"    ON students      FOR ALL USING (auth.uid() = teacher_id);
CREATE POLICY "schedules_owner"   ON schedules     FOR ALL USING (auth.uid() = teacher_id);
CREATE POLICY "attendance_owner"  ON attendance    FOR ALL USING (student_id IN (SELECT id FROM students WHERE teacher_id = auth.uid()));
CREATE POLICY "behavior_owner"    ON behavior_logs FOR ALL USING (student_id IN (SELECT id FROM students WHERE teacher_id = auth.uid()));
CREATE POLICY "grades_owner"      ON grades        FOR ALL USING (student_id IN (SELECT id FROM students WHERE teacher_id = auth.uid()));
