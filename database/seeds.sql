TRUNCATE TABLE waiting_list, registrations, activities, members, facilities, associations, families RESTART IDENTITY CASCADE;

INSERT INTO families (family_code, quotient_familial) VALUES
('FAM-001', 450.00), 
('FAM-002', 750.00), 
('FAM-003', 1200.00);

INSERT INTO associations (name, email) VALUES
('Club de Judo Municipal', 'contact@judo-municipality.fr'),
('Association Aquatique Métropolitaine', 'info@aqa-metropole.fr'),
('Basket-Ball Club 93', 'secretariat@bbc93.fr');

INSERT INTO facilities (name, capacity, sub_zone) VALUES
('Gymnase Central - Dojo', 30, 'Zone Combat'),
('Piscine Olympique - Bassin A', 50, 'Grand Bassin'),
('Piscine Olympique - Bassin B', 20, 'Petit Bassin');

INSERT INTO members (family_id, firstname, lastname, birth_date, is_resident, cert_medical_date, passport_code) VALUES
(1, 'Sami', 'Benali', '2012-05-14', TRUE, CURRENT_DATE - INTERVAL '3 months', 'PASS-2026-11'),  
(1, 'Aminux', 'Benali', '2015-08-22', TRUE, CURRENT_DATE - INTERVAL '2 months', 'PASS-2026-12'),    
(2, 'Lucas', 'Dupont', '2005-01-10', FALSE, CURRENT_DATE - INTERVAL '14 months', NULL),         
(3, 'Sarah', 'El Amrani', '1998-11-03', TRUE, CURRENT_DATE - INTERVAL '1 month', NULL);         

INSERT INTO activities (association_id, facility_id, title, base_price, max_capacity, day_of_week, start_time, end_time, min_age, max_age, is_high_risk_sport) VALUES
(1, 1, 'Judo Poussin', 150.00, 2, 3, '14:00:00', '15:30:00', 6, 12, FALSE),                 
(2, 2, 'Natation Adultes', 200.00, 15, 1, '18:00:00', '19:30:00', 18, 99, FALSE),
(1, 1, 'Ju-Jitsu Combat (Risk)', 180.00, 10, 5, '19:00:00', '20:30:00', 16, 99, TRUE);      