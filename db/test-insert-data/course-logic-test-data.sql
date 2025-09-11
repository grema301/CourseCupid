-- Sessions
INSERT INTO Chat_Session (session_id, user_id, created_at, updated_at, expires_at, starred, title)
VALUES
    (gen_random_uuid(), (SELECT user_id FROM Web_User WHERE username='katrina'), NOW(), NOW(), NOW() + INTERVAL '8 hours', FALSE, 'Katrina Course Ideas'),
    (gen_random_uuid(), (SELECT user_id FROM Web_User WHERE username='george'), NOW(), NOW(), NOW() + INTERVAL '8 hours', TRUE, 'George First Year');

-- Qualifications
INSERT INTO Qualification (qualification_id, code, qual_name, description, keywords)
VALUES
    (gen_random_uuid(), 'BCom', 'Bachelor of Commerce', 'Undergraduate business degree', ARRAY['business','commerce','accounting','economics','finance']),
    (gen_random_uuid(), 'BSc', 'Bachelor of Science', 'Undergraduate science degree', ARRAY['science','biology','health','math']),
    (gen_random_uuid(), 'LLB', 'Bachelor of Laws', 'Law degree for legal practice', ARRAY['law','justice','legal']);

-- Subjects
INSERT INTO Subject (subject_id, code, sub_name, description, keywords, available_as_major, available_as_minor)
VALUES
    (gen_random_uuid(), 'BSNS', 'Business', 'Commerce core papers', ARRAY['commerce','business','accounting','economics','finance'], TRUE, TRUE),
    (gen_random_uuid(), 'COMP', 'Computer Science', 'Intro to computing and programming', ARRAY['computing','programming','software'], TRUE, TRUE),
    (gen_random_uuid(), 'SPEX', 'Sport & Exercise Science', 'Sport and exercise science', ARRAY['sport','exercise','health'], TRUE, TRUE),
    (gen_random_uuid(), 'PHIL', 'Philosophy', 'Critical thinking and philosophy', ARRAY['philosophy','ethics'], TRUE, TRUE),
    (gen_random_uuid(), 'LAWS', 'Law', 'Foundations of law', ARRAY['law','justice'], TRUE, FALSE),
    (gen_random_uuid(), 'SURV', 'Surveying', 'Land surveying & spatial sciences', ARRAY['surveying','maps','geospatial'], TRUE, FALSE),
    (gen_random_uuid(), 'HUBS', 'Human Body Systems', 'Health science first-year paper', ARRAY['biology','anatomy','health'], TRUE, TRUE);

-- Papers
INSERT INTO Paper (paper_code, subject_id, title, points, description, teaching_periods, prerequisites, restrictions, keywords, is_active)
VALUES
    ('BSNS112', (SELECT subject_id FROM Subject WHERE code='BSNS'), 'Statistics in Business', 18, 'Introductory statistics for business', ARRAY['S1','S2'], ARRAY[]::TEXT[], NULL, ARRAY['stats','business'], TRUE),
    ('COMP161', (SELECT subject_id FROM Subject WHERE code='COMP'), 'Computer Programming', 18, 'Intro to programming with Python', ARRAY['S1','S2'], ARRAY[]::TEXT[], NULL, ARRAY['python','programming','software'], TRUE),
    ('SPEX101', (SELECT subject_id FROM Subject WHERE code='SPEX'), 'Introduction to Exercise and Sport Science', 18, 'Core concepts in exercise science', ARRAY['S1'], ARRAY[]::TEXT[], NULL, ARRAY['sport','exercise'], TRUE),
    ('PHIL105', (SELECT subject_id FROM Subject WHERE code='PHIL'), 'Critical Thinking', 18, 'Introduction to logic and critical thinking', ARRAY['S1','S2'], ARRAY[]::TEXT[], NULL, ARRAY['logic','argument'], TRUE),
    ('LAWS101', (SELECT subject_id FROM Subject WHERE code='LAWS'), 'Law and Society', 18, 'Foundations of law in NZ society', ARRAY['FY'], ARRAY[]::TEXT[], NULL, ARRAY['law','society'], TRUE),
    ('SURV101', (SELECT subject_id FROM Subject WHERE code='SURV'), 'Intro to Surveying', 18, 'Introduction to surveying and spatial science', ARRAY['S1'], ARRAY[]::TEXT[], NULL, ARRAY['surveying','maps'], TRUE),
    ('HUBS191', (SELECT subject_id FROM Subject WHERE code='HUBS'), 'Human Body Systems I', 18, 'Introduction to anatomy and physiology', ARRAY['S1'], ARRAY[]::TEXT[], NULL, ARRAY['anatomy','health','biology'], TRUE);
