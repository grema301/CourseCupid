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
drop table if exists Message cascade;
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
-- The Web_User table holds all regisetered website user information
-- The Chat_Session table has a foreign key to this table
--
create table Web_User
(   user_id UUID PRIMARY KEY,
    username VARCHAR,
    email VARCHAR(255) UNIQUE ,
    password_hash VARCHAR(255),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

--------------------------------------------------------------------------------
--
-- The Chat_Session table holds AI chat session information for each user
--
create table Chat_Session 
(   session_id UUID PRIMARY KEY,
    user_id UUID REFERENCES Web_User (user_id),
    session_code VARCHAR(8) UNIQUE NOT NULL,
    recovery_email VARCHAR,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP,
    is_registered BOOLEAN NOT NULL,
    starred BOOLEAN,
    title VARCHAR,
    is_anonymous BOOLEAN GENERATED ALWAYS AS (user_id IS NULL) STORED
);

--------------------------------------------------------------------------------
--
-- The Qualification table holds University "degree" information
-- The Major table has a FK that references this table
-- The Minor table has a FK that references this table
--
create table Qualification
(   qualification_id UUID PRIMARY KEY,
    qual_code VARCHAR NOT NULL,
    qual_name VARCHAR NOT NULL,
    qual_description TEXT,
    keywords TEXT[]
);

--------------------------------------------------------------------------------
--
-- The Subject table holds all information about University offered subjects
-- The Major table has a FK that references this table
-- The Minor table has a FK that references this table
-- The Paper table has a FK that references this table
--
create table Subject
(   subject_id UUID PRIMARY KEY,
    sub_code VARCHAR NOT NULL,
    sub_name VARCHAR NOT NULL,
    sub_description TEXT,
    keywords TEXT[],
    available_as_major BOOLEAN,
    available_as_minor BOOLEAN,
    is_active BOOLEAN DEFAULT TRUE
);


--------------------------------------------------------------------------------
--
-- The Major table holds information about subjects you can take as Majors
--
create table Major
(   major_id UUID PRIMARY KEY,
    qualification_id UUID REFERENCES Qualification(qualification_id),
    subject_id UUID REFERENCES Subject(subject_id),
    major_name VARCHAR NOT NULL,
    major_description TEXT,
    keywords TEXT[],
    min_points INT
);


--------------------------------------------------------------------------------
--
-- The Minor table holds information about subjects you can take as Minors
--
create table Minor
(   minor_id UUID PRIMARY KEY,
    qualification_id UUID REFERENCES Qualification(qualification_id),
    subject_id UUID REFERENCES Subject(subject_id),
    minor_name VARCHAR NOT NULL,
    minor_description TEXT,
    keywords TEXT[],
    min_points INT
);


--------------------------------------------------------------------------------
--
-- The Paper table holds information about individual course papers
--
create table Paper
(   paper_code VARCHAR PRIMARY KEY,
    subject_id UUID REFERENCES Subject(subject_id),
    title VARCHAR NOT NULL,
    points INT NOT NULL,
    paper_description TEXT,
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
-- The Major_Req is a join table holds between the Paper table and the Major table
--
create table Major_Req
(   major_id UUID REFERENCES Major(major_id),
    paper_code VARCHAR REFERENCES Paper(paper_code),
    requirement_type VARCHAR CHECK (requirement_type IN ('core','elective')),
    is_prerequisite BOOLEAN,
    PRIMARY KEY (major_id, paper_code)
);


--------------------------------------------------------------------------------
--
-- The Minor_Req is a join table holds between the Paper table and the Minor table--
--
create table Minor_Req
(   minor_id UUID REFERENCES Minor(minor_id),
    paper_code VARCHAR REFERENCES Paper(paper_code),
    requirement_type VARCHAR CHECK (requirement_type IN ('core','elective')),
    PRIMARY KEY (minor_id, paper_code)
);


-- ===================
-- SAVED ITEMS
-- ===================

--------------------------------------------------------------------------------
--
-- The Saved_Item table holds information about chat entities a user may want to bookmark
--
create table Saved_Item
(   saved_id UUID PRIMARY KEY,
    session_id UUID REFERENCES Chat_Session(session_id),
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
-- The Message table holds information about individual message between AI and user
--
create table Message
(   message_id UUID PRIMARY KEY,
    session_id UUID REFERENCES Chat_Session(session_id),
    role VARCHAR CHECK (role IN ('user','assistant')) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    user_preferences JSONB
);


--------------------------------------------------------------------------------
--
-- The Recommendation table holds information regarding papers or courses that
-- course cupid will reccomend to the user
--
create table Recommendation
(   recommendation_id UUID PRIMARY KEY,
    message_id UUID REFERENCES Message(message_id),
    paper_code VARCHAR REFERENCES Paper(paper_code),
    match_score FLOAT,
    match_reason TEXT,
    recommendation_type VARCHAR CHECK (recommendation_type IN ('paper','major','qualification')),
    created_at TIMESTAMP NOT NULL
);


--------------------------------------------------------------------------------
--
-- The Recommendation_FB table holds information regarding feedback user may
-- suggest to the chatbot in the form of swiping on reccomendations
--
create table Recommendation_FB
(   feedback_id UUID PRIMARY KEY,
    recommendation_id UUID REFERENCES Recommendation(recommendation_id),
    feedback_type VARCHAR CHECK (feedback_type IN ('swipe_right','swipe_left','super_like','saved','skip')),
    swipe_direction VARCHAR CHECK (swipe_direction IN ('left','right','up')),
    created_at TIMESTAMP NOT NULL,
    interaction_duration INT
);


--------------------------------------------------------------------------------
--
-- End of schema.
--
--------------------------------------------------------------------------------
