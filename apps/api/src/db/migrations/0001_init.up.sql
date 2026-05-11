CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  cref          TEXT NOT NULL,
  signature_url TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE patients (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           TEXT NOT NULL,
  address             TEXT NOT NULL,
  phone               TEXT NOT NULL,
  session_price_cents INTEGER NOT NULL CHECK (session_price_cents >= 0),
  notes               TEXT,
  active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schedules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  weekdays   INTEGER[] NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE
);

CREATE TYPE session_status AS ENUM ('SCHEDULED', 'REALIZADA', 'FALTA', 'REMARCADA');

CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      session_status NOT NULL DEFAULT 'SCHEDULED',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  note        TEXT,
  UNIQUE (patient_id, date)
);

CREATE INDEX sessions_date_idx ON sessions (date);
