-- Users
INSERT INTO Web_User (user_id, username, email, password_hash, created_at, updated_at, is_registered)
VALUES
    (gen_random_uuid(), 'katrina', 'katrina@otago.ac.nz', 'hashed_pw1', NOW(), NOW(), true),
    (gen_random_uuid(), 'george', 'george@otago.ac.nz', 'hashed_pw2', NOW(), NOW(), false);