-- Periods
INSERT INTO period (id, start_year, end_year) VALUES 
('2025', 2025, 2026)
ON CONFLICT (id) DO NOTHING;

-- User Levels
INSERT INTO user_level (id, name) VALUES 
(1, 'Admin'), 
(2, 'Coordinador')
ON CONFLICT (id) DO NOTHING;

-- Users
INSERT INTO user (id, name, password, user_level_id) VALUES 
(1, 'Admin', '1234', 1), 
(2, 'Valeria', '1234', 2)
ON CONFLICT (id) DO NOTHING;

-- Years
INSERT INTO year (id, name) VALUES 
(1, '1er Año'), 
(2, '2do Año'), 
(3, '3er Año'), 
(4, '4to Año'), 
(5, '5to Año')
ON CONFLICT (id) DO NOTHING;

-- Subjects
INSERT INTO subject (id, name, abbr, minimum_grade) VALUES 
(1, 'Castellano', 'CA', 10),
(2, 'Inglés y otras Lenguas Extranjeras', 'ILE', 10),
(3, 'Matemáticas', 'MA', 10),
(4, 'Educación Física', 'EF', 10),
(5, 'Arte y Patrimonio', 'FI', 10),
(6, 'Ciencias Naturales', 'CN', 10),
(7, 'Física', 'FS', 10),
(8, 'Química', 'QU', 10),
(9, 'Biología', 'BI', 10),
(10, 'Ciencias de la Tierra', 'CT', 10),
(11, 'Geografía, Historia y Ciudadanía', 'GHC', 10),
(12, 'Formación para la Soberanía Nacional', 'FSN', 10),
(13, 'Orientación y Convivencia', 'OC', 10), 
(14, 'Participación en Grupos de Creación , recreación y Producción', 'PG', 10)
ON CONFLICT (id) DO NOTHING;