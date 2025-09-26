--------------------------------------------------------------------------------
--
-- This schema is created for the purpose of COSC345 Software Engineering grouo
-- project, Course Cupid.
--
-- Team Members:
-- Katrina Hogg
-- Benjamin Hunt
-- Shyamalima Das
-- Ned Redmond
-- Matthew Greer
--
-- Created by Katrina Hogg, 2025-08-21.
--
--------------------------------------------------------------------------------

-- Use the following block of code to drop all elements of the schema.
/*
begin;

drop table if exists Recommendation_FB cascade;
drop table if exists Recommendation cascade;
drop table if exists Chat_Message cascade;
drop table if exists Saved_Item cascade;
drop table if exists Minor_Req cascade;
drop table if exists Major_Req cascade;
drop table if exists Paper cascade;
drop table if exists Minor cascade;
drop table if exists Major cascade;
drop table if exists Subject cascade;
drop table if exists Qualification cascade;
drop table if exists Chat_Session cascade;
drop table if exists Web_User cascade;

commit;
*/

--------------------------------------------------------------------------------
--
-- The Web_User table holds .. information
-- The .. table has a foreign key to this table.
--
create table Web_User
(   user_id UUID PRIMARY KEY,
    username VARCHAR UNIQUE,
    email VARCHAR(255) UNIQUE ,
    password_hash VARCHAR(255),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    is_registered BOOLEAN NOT NULL
);

--------------------------------------------------------------------------------
--
-- The Chat_Session table holds .. information
-- The .. table has a foreign key to this table.
--
create table Chat_Session 
(   session_id UUID PRIMARY KEY,
    user_id UUID REFERENCES Web_User (user_id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    starred BOOLEAN,
    title VARCHAR
);

--------------------------------------------------------------------------------
--
-- The Qualification table holds .. information
-- The .. table has a foreign key to this table.
--
create table Qualification
(   qualification_id UUID PRIMARY KEY,
    code VARCHAR NOT NULL,
    qual_name VARCHAR NOT NULL,
    description TEXT,
    keywords TEXT[]
);

--------------------------------------------------------------------------------
--
-- The Subject table holds .. information
-- The .. table has a foreign key to this table.
--
create table Subject
(   subject_id UUID PRIMARY KEY,
    code VARCHAR NOT NULL,
    sub_name VARCHAR NOT NULL,
    description TEXT,
    keywords TEXT[],
    available_as_major BOOLEAN,
    available_as_minor BOOLEAN,
    is_active BOOLEAN DEFAULT TRUE
);


--------------------------------------------------------------------------------
--
-- The Major table holds .. information
-- The .. table has a foreign key to this table.
--
create table Major
(   major_id UUID PRIMARY KEY,
    qualification_id UUID REFERENCES Qualification(qualification_id) ON DELETE CASCADE,
    subject_id UUID REFERENCES Subject(subject_id) ON DELETE CASCADE,
    major_name VARCHAR NOT NULL,
    description TEXT,
    keywords TEXT[],
    min_points INT
);


--------------------------------------------------------------------------------
--
-- The Minor table holds .. information
-- The .. table has a foreign key to this table.
--
create table Minor
(   minor_id UUID PRIMARY KEY,
    qualification_id UUID REFERENCES Qualification(qualification_id) ON DELETE CASCADE,
    subject_id UUID REFERENCES Subject(subject_id) ON DELETE CASCADE,
    minor_name VARCHAR NOT NULL,
    description TEXT,
    keywords TEXT[],
    min_points INT
);


--------------------------------------------------------------------------------
--
-- The Paper table holds .. information
-- The .. table has a foreign key to this table.
--
create table Paper
(   paper_code VARCHAR PRIMARY KEY,
    subject_id UUID REFERENCES Subject(subject_id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    points INT NOT NULL,
    description TEXT,
    teaching_periods TEXT[],
    prerequisites TEXT[],
    restrictions TEXT,
    keywords TEXT[],
    is_active BOOLEAN DEFAULT TRUE
);


-- ===================
-- REQUIREMENTS (Major & Minor)
-- ===================

--------------------------------------------------------------------------------
--
-- The Major_Req table holds .. information
-- The .. table has a foreign key to this table.
--
--
create table Major_Req
(   major_id UUID REFERENCES Major(major_id) ON DELETE CASCADE,
    paper_code VARCHAR REFERENCES Paper(paper_code) ON DELETE CASCADE,
    requirement_type VARCHAR CHECK (requirement_type IN ('core','elective')),
    is_prerequisite BOOLEAN,
    PRIMARY KEY (major_id, paper_code)
);


--------------------------------------------------------------------------------
--
-- The Minor_Req table holds .. information
-- The .. table has a foreign key to this table.
--
--
create table Minor_Req
(   minor_id UUID REFERENCES Minor(minor_id) ON DELETE CASCADE,
    paper_code VARCHAR REFERENCES Paper(paper_code) ON DELETE CASCADE,
    requirement_type VARCHAR CHECK (requirement_type IN ('core','elective')),
    PRIMARY KEY (minor_id, paper_code)
);


-- ===================
-- SAVED ITEMS
-- ===================

--------------------------------------------------------------------------------
--
-- The Saved_Item table holds .. information
-- The .. table has a foreign key to this table.
--
--
create table Saved_Item
(   saved_id UUID PRIMARY KEY,
    session_id UUID REFERENCES Chat_Session(session_id) ON DELETE CASCADE,
    item_type VARCHAR CHECK (item_type IN ('paper','major','minor','qualification','session')),
    item_id VARCHAR NOT NULL,
    created_at TIMESTAMP NOT NULL,
    notes TEXT,
    is_starred BOOLEAN
);


-- ===================
-- MESSAGES + RECOMMENDATIONS + FEEDBACK
-- ===================

--------------------------------------------------------------------------------
--
-- The Message table holds .. information
-- The .. table has a foreign key to this table.
--
create table Chat_Message
(    message_id UUID PRIMARY KEY,
    session_id UUID REFERENCES Chat_Session(session_id) ON DELETE CASCADE,
    role VARCHAR CHECK (role IN ('user','assistant')) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    user_preferences JSONB
);


--------------------------------------------------------------------------------
--
-- The Recommendation table holds .. information
-- The .. table has a foreign key to this table.
--
create table Recommendation
(   recommendation_id UUID PRIMARY KEY,
    message_id UUID REFERENCES Chat_Message(message_id) ON DELETE CASCADE,
    paper_code VARCHAR REFERENCES Paper(paper_code) ON DELETE CASCADE,
    match_score FLOAT,
    match_reason TEXT,
    recommendation_type VARCHAR CHECK (recommendation_type IN ('paper','major','qualification')),
    created_at TIMESTAMP NOT NULL
);


--------------------------------------------------------------------------------
--
-- The Recommendation_FB table holds .. information
-- The .. table has a foreign key to this table.
--
create table Recommendation_FB
(   feedback_id UUID PRIMARY KEY,
    recommendation_id UUID REFERENCES Recommendation(recommendation_id) ON DELETE CASCADE,
    feedback_type VARCHAR CHECK (feedback_type IN ('swipe_right','swipe_left','super_like','saved','skip')),
    swipe_direction VARCHAR CHECK (swipe_direction IN ('left','right','up')),
    created_at TIMESTAMP NOT NULL,
    interaction_duration INT
);

CREATE TABLE IF NOT EXISTS user_paper_matches (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES web_user(user_id) ON DELETE CASCADE,
  paper_code VARCHAR(20) NOT NULL,
  matched_at TIMESTAMP DEFAULT NOW()
);

--------------------------------------------------------------------------------
--
-- End of schema.
--
--------------------------------------------------------------------------------
