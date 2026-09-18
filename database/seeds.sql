TRUNCATE TABLE waiting_list, registrations, activities, members, facilities, associations, families RESTART IDENTITY CASCADE;

-- 1. INSERTION DES FOYERS FISCAUX (FAMILIES)
INSERT INTO families (family_code, quotient_familial) VALUES
('FAM-001', 450.00), -- QF < 600€ (Bourse -30%)
('FAM-002', 750.00), -- 600€ <= QF <= 900€ (Bourse -15%)
('FAM-003', 1200.00);-- QF > 900€ (Pas de bourse)

-- 2. INSERTION DES CLUBS / ASSOCIATIONS PARTENAIRES
INSERT INTO associations (name, email) VALUES
('Club de Judo Municipal', 'contact@judo-municipality.fr'),
('Association Aquatique Métropolitaine', 'info@aqa-metropole.fr'),
('Basket-Ball Club 93', 'secretariat@bbc93.fr');

-- 3. INSERTION DES INFRASTRUCTURES MUNICIPALES (FACILITIES)
INSERT INTO facilities (name, capacity, sub_zone) VALUES
('Gymnase Central - Dojo', 30, 'Zone Combat'),
('Piscine Olympique - Bassin A', 50, 'Grand Bassin'),
('Piscine Olympique - Bassin B', 20, 'Petit Bassin');

-- 4. INSERTION DES ADHÉRENTS (MEMBERS)
INSERT INTO members (family_id, firstname, lastname, birth_date, is_resident, cert_medical_date, passport_code) VALUES
(1, 'Sami', 'Benali', '2012-05-14', TRUE, CURRENT_DATE - INTERVAL '3 months', 'PASS-2026-11'), -- Enfant 1 (Famille 1)
(1, 'Aminux', 'Benali', '2015-08-22', TRUE, CURRENT_DATE - INTERVAL '2 months', 'PASS-2026-12'), -- Enfant 2 (Famille 1 - Réduction Fratrie)
(2, 'Lucas', 'Dupont', '2005-01-10', FALSE, CURRENT_DATE - INTERVAL '14 months', NULL),        -- Extérieur (+35% / Certificat expiré si sport à risque)
(3, 'Sarah', 'El Amrani', '1998-11-03', TRUE, CURRENT_DATE - INTERVAL '1 month', NULL);        -- Adulte Résident

-- 5. INSERTION DU CATALOGUE D'ACTIVITÉS (ACTIVITIES)
INSERT INTO activities (association_id, facility_id, title, base_price, max_capacity, day_of_week, start_time, end_time, min_age, max_age, is_high_risk_sport) VALUES
(1, 1, 'Judo Poussin', 150.00, 2, 3, '14:00:00', '15:30:00', 6, 12, FALSE),              -- Max capacity = 2 (Pour tester la WaitingList facilement)
(2, 2, 'Natation Adultes', 200.00, 15, 1, '18:00:00', '19:30:00', 18, 99, FALSE),
(1, 1, 'Ju-Jitsu Combat (Risk)', 180.00, 10, 5, '19:00:00', '20:30:00', 16, 99, TRUE);    -- Sport à risque (Nécessite Certificat < 1 an)