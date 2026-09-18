DROP TABLE IF EXISTS waiting_list CASCADE;
DROP TABLE IF EXISTS registrations CASCADE;
DROP TABLE IF EXISTS activities CASCADE;
DROP TABLE IF EXISTS associations CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS families CASCADE;

DROP TYPE IF EXISTS registration_status CASCADE;
DROP TYPE IF EXISTS waiting_status CASCADE;

CREATE TYPE registration_status AS ENUM ('confirmed', 'cancelled', 'medical_non_compliant');
CREATE TYPE waiting_status AS ENUM ('waiting', 'promoted_pending', 'expired', 'converted');

CREATE TABLE families (
    id SERIAL PRIMARY KEY,
    family_code VARCHAR(50) UNIQUE NOT NULL,
    quotient_familial NUMERIC(8, 2) NOT NULL DEFAULT 1000.00 CHECK (quotient_familial >= 0)
);

CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE SET NULL,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    birth_date DATE NOT NULL,
    is_resident BOOLEAN NOT NULL DEFAULT TRUE,
    cert_medical_date DATE NOT NULL,
    passport_code VARCHAR(50) DEFAULT NULL
);

CREATE TABLE associations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL
);

CREATE TABLE facilities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    sub_zone VARCHAR(50) DEFAULT NULL
);

CREATE TABLE activities (
    id SERIAL PRIMARY KEY,
    association_id INT REFERENCES associations(id) ON DELETE CASCADE,
    facility_id INT REFERENCES facilities(id) ON DELETE RESTRICT,
    title VARCHAR(150) NOT NULL,
    base_price NUMERIC(8, 2) NOT NULL CHECK (base_price >= 0),
    max_capacity INT NOT NULL CHECK (max_capacity > 0),
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    min_age INT NOT NULL DEFAULT 0,
    max_age INT NOT NULL DEFAULT 99,
    is_high_risk_sport BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT check_time_order CHECK (start_time < end_time)
);

CREATE TABLE registrations (
    id SERIAL PRIMARY KEY,
    member_id INT REFERENCES members(id) ON DELETE CASCADE,
    activity_id INT REFERENCES activities(id) ON DELETE RESTRICT,
    final_price NUMERIC(8, 2) NOT NULL CHECK (final_price >= 15.00),
    status registration_status NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_member_activity UNIQUE (member_id, activity_id)
);

CREATE TABLE waiting_list (
    id SERIAL PRIMARY KEY,
    activity_id INT REFERENCES activities(id) ON DELETE CASCADE,
    member_id INT REFERENCES members(id) ON DELETE CASCADE,
    score INT NOT NULL DEFAULT 0,
    status waiting_status NOT NULL DEFAULT 'waiting',
    promoted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    confirmation_deadline TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_waiting_member UNIQUE (activity_id, member_id)
);