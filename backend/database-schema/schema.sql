CREATE DATABASE IF NOT EXISTS hyre_ai
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE hyre_ai;
CREATE TABLE IF NOT EXISTS Users (
    id INT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('HR_ADMIN', 'CANDIDATE') NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS AdminInvites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) NOT NULL,
    invited_by INT NOT NULL,
    status ENUM('PENDING', 'ACCEPTED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (invited_by) REFERENCES Users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_token (token),
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id INT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (manager_id) REFERENCES Users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_department_name (name),
    INDEX idx_manager (manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Jobs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    department_id INT NOT NULL,
    employment_type ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP') NOT NULL DEFAULT 'FULL_TIME',
    work_mode ENUM('ONSITE', 'REMOTE', 'HYBRID') NOT NULL DEFAULT 'ONSITE',
    location VARCHAR(150),
    experience_level ENUM('ENTRY', 'MID', 'SENIOR', 'LEAD') NOT NULL DEFAULT 'ENTRY',
    min_salary DECIMAL(10,2),
    max_salary DECIMAL(10,2),
    openings INT NOT NULL DEFAULT 1,
    application_deadline DATE,
    required_skills JSON NOT NULL,
    status ENUM('OPEN', 'CLOSED', 'DRAFT') NOT NULL DEFAULT 'OPEN',
    created_by INT NULL,
    published_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by) REFERENCES Users(id),
    FOREIGN KEY (department_id) REFERENCES Departments(id) ON DELETE RESTRICT,
    INDEX idx_status (status),
    INDEX idx_department_id (department_id),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    candidate_id INT NOT NULL,

    phone VARCHAR(20),
    cover_note TEXT,
    expected_salary DECIMAL(10,2),
    availability ENUM(
        'IMMEDIATE',
        'ONE_WEEK',
        'TWO_WEEKS',
        'ONE_MONTH',
        'MORE_THAN_ONE_MONTH'
    ),

    stage ENUM(
        'APPLIED',
        'SHORTLISTED',
        'SLOTS_OFFERED',
        'INTERVIEW_SCHEDULED',
        'INTERVIEWED',
        'ON_HOLD',
        'REJECTED',
        'READY_FOR_OFFER',
        'OFFER_SENT',
        'OFFER_DECLINED',
        'HIRED'
    ) NOT NULL DEFAULT 'APPLIED',

    cv_file_path VARCHAR(500),
    cv_original_name VARCHAR(255),
    cv_mime VARCHAR(100),
    cv_size_bytes INT,

    ai_status ENUM(
        'PENDING',
        'PROCESSING',
        'DONE',
        'FAILED'
    ) NOT NULL DEFAULT 'PENDING',

    current_round TINYINT DEFAULT 1,

    applied_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    rejection_reason ENUM(
        'SKILLS_MISMATCH',
        'NOT_ENOUGH_EXPERIENCE',
        'DUPLICATE_APPLICATION',
        'POSITION_FILLED',
        'FAILED_INTERVIEW',
        'OTHER'
    ),
    rejection_note TEXT,
    rejected_at TIMESTAMP NULL DEFAULT NULL,

    FOREIGN KEY (job_id) REFERENCES Jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES Users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_application (job_id, candidate_id),
    INDEX idx_candidate (candidate_id),
    INDEX idx_job (job_id),
    INDEX idx_stage (stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS AIScores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,

    parsed_json JSON,

    match_percent TINYINT,
    match_label ENUM('STRONG', 'POSSIBLE', 'NOT_A_FIT'),
    matched_skills JSON,
    missing_skills JSON,

    predicted_score DECIMAL(3,1),

    model_version VARCHAR(50),
    scored_at TIMESTAMP NULL DEFAULT NULL,

    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (application_id) REFERENCES Applications(id) ON DELETE CASCADE,
    UNIQUE KEY unique_application_score (application_id),
    INDEX idx_match_percent (match_percent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ApplicationEvents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,

    actor_type ENUM('CANDIDATE', 'HR', 'AI', 'SYSTEM') NOT NULL,
    actor_user_id INT NULL,

    event_type VARCHAR(40) NOT NULL,
    title VARCHAR(200) NOT NULL,
    note TEXT NULL,
    metadata JSON NULL,

    visible_to_candidate TINYINT(1) DEFAULT 0,

    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (application_id) REFERENCES Applications(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES Users(id) ON DELETE SET NULL,
    INDEX idx_application (application_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS DuplicateFlags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    matched_application_id INT NOT NULL,

    reason ENUM('SAME_EMAIL', 'SAME_PHONE', 'SIMILAR_CV') NOT NULL,
    similarity DECIMAL(4,3),

    status ENUM('OPEN', 'DISMISSED', 'CONFIRMED') NOT NULL DEFAULT 'OPEN',
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL DEFAULT NULL,

    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (application_id) REFERENCES Applications(id) ON DELETE CASCADE,
    FOREIGN KEY (matched_application_id) REFERENCES Applications(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES Users(id),

    INDEX idx_application (application_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Interviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,

    round_number TINYINT NOT NULL,
    round_name VARCHAR(60),

    duration_minutes SMALLINT DEFAULT 45,
    mode ENUM('ZOOM', 'ONSITE') NOT NULL,
    meeting_link VARCHAR(500),
    location VARCHAR(255),
    notes TEXT,

    scheduled_start DATETIME,
    scheduled_end DATETIME,

    offered_at TIMESTAMP NULL DEFAULT NULL,
    offer_expires_at TIMESTAMP NULL DEFAULT NULL,
    confirmed_at TIMESTAMP NULL DEFAULT NULL,

    status ENUM('SLOTS_OFFERED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'EXPIRED') NOT NULL DEFAULT 'SLOTS_OFFERED',
    cancelled_reason TEXT,

    created_by INT NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (application_id) REFERENCES Applications(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES Users(id),
    UNIQUE KEY unique_round (application_id, round_number),
    INDEX idx_application (application_id),
    INDEX idx_status (status),
    INDEX idx_scheduled_start (scheduled_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS InterviewSlots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    interview_id INT NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    is_chosen TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (interview_id) REFERENCES Interviews(id) ON DELETE CASCADE,
    INDEX idx_interview (interview_id),
    INDEX idx_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS InterviewPanelMembers (
    interview_id INT NOT NULL,
    hr_user_id INT NOT NULL,

    PRIMARY KEY (interview_id, hr_user_id),
    FOREIGN KEY (interview_id) REFERENCES Interviews(id) ON DELETE CASCADE,
    FOREIGN KEY (hr_user_id) REFERENCES Users(id) ON DELETE CASCADE,

    INDEX idx_interview (interview_id),
    INDEX idx_hr_user (hr_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS InterviewFeedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    interview_id INT NOT NULL,
    interviewer_id INT NOT NULL,

    technical TINYINT NULL,
    problem_solving TINYINT NULL,
    communication TINYINT NULL,
    culture_fit TINYINT NULL,

    strengths TEXT,
    concerns TEXT,

    recommendation ENUM('NEXT_ROUND', 'HIRE', 'HOLD', 'REJECT') NULL,

    status ENUM('DRAFT', 'SUBMITTED') NOT NULL DEFAULT 'DRAFT',
    entered_by INT NOT NULL,
    submitted_at TIMESTAMP NULL DEFAULT NULL,

    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (interview_id) REFERENCES Interviews(id) ON DELETE CASCADE,
    FOREIGN KEY (interviewer_id) REFERENCES Users(id),
    FOREIGN KEY (entered_by) REFERENCES Users(id),

    UNIQUE KEY unique_feedback (interview_id, interviewer_id),
    INDEX idx_interview (interview_id),
    INDEX idx_interviewer (interviewer_id),
    INDEX idx_status (status),

    CONSTRAINT interviewfeedback_chk_1 CHECK ((technical IS NULL) OR (technical >= 1 AND technical <= 5)),
    CONSTRAINT interviewfeedback_chk_2 CHECK ((problem_solving IS NULL) OR (problem_solving >= 1 AND problem_solving <= 5)),
    CONSTRAINT interviewfeedback_chk_3 CHECK ((communication IS NULL) OR (communication >= 1 AND communication <= 5)),
    CONSTRAINT interviewfeedback_chk_4 CHECK ((culture_fit IS NULL) OR (culture_fit >= 1 AND culture_fit <= 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS Offers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,

    salary DECIMAL(10,2) NOT NULL,
    start_date DATE NOT NULL,
    guidelines TEXT,
    letter_body TEXT NOT NULL,

    status ENUM('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED') NOT NULL DEFAULT 'DRAFT',

    created_by INT NOT NULL,
    sent_at TIMESTAMP NULL DEFAULT NULL,
    responded_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (application_id) REFERENCES Applications(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES Users(id),
    UNIQUE KEY unique_offer (application_id),
    INDEX idx_offer_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS AssessmentTemplates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 30,
    passing_score DECIMAL(5,2) NOT NULL DEFAULT 70.00,
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_by INT NOT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (created_by) REFERENCES Users(id),
    INDEX idx_status (status),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS AssessmentQuestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT NOT NULL,
    question_text TEXT NOT NULL,
    question_type ENUM('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER') NOT NULL,
    options JSON,
    correct_answer TEXT,
    points INT NOT NULL DEFAULT 1,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (template_id) REFERENCES AssessmentTemplates(id) ON DELETE CASCADE,
    INDEX idx_template (template_id),
    INDEX idx_order (template_id, order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS JobAssessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    template_id INT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    deadline_hours INT DEFAULT 48,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (job_id) REFERENCES Jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES AssessmentTemplates(id) ON DELETE CASCADE,
    UNIQUE KEY unique_job_template (job_id, template_id),
    INDEX idx_job (job_id),
    INDEX idx_template (template_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS CandidateAssessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    template_id INT NOT NULL,
    job_assessment_id INT NOT NULL,
    
    status ENUM('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'GRADED') NOT NULL DEFAULT 'PENDING',
    
    started_at TIMESTAMP NULL DEFAULT NULL,
    submitted_at TIMESTAMP NULL DEFAULT NULL,
    deadline_at TIMESTAMP NULL DEFAULT NULL,
    
    score DECIMAL(5,2) DEFAULT NULL,
    max_score INT DEFAULT NULL,
    earned_score INT DEFAULT NULL,
    
    passed BOOLEAN DEFAULT FALSE,
    time_taken_minutes INT DEFAULT NULL,
    
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (application_id) REFERENCES Applications(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES AssessmentTemplates(id),
    FOREIGN KEY (job_assessment_id) REFERENCES JobAssessments(id) ON DELETE CASCADE,
    INDEX idx_application (application_id),
    INDEX idx_status (status),
    INDEX idx_deadline (deadline_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS CandidateAnswers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_assessment_id INT NOT NULL,
    question_id INT NOT NULL,
    answer_text TEXT,
    is_correct BOOLEAN DEFAULT NULL,
    points_earned INT DEFAULT 0,
    graded_by INT DEFAULT NULL,
    graded_at TIMESTAMP NULL DEFAULT NULL,
    grader_note TEXT DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (candidate_assessment_id) REFERENCES CandidateAssessments(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES AssessmentQuestions(id) ON DELETE CASCADE,
    FOREIGN KEY (graded_by) REFERENCES Users(id),
    UNIQUE KEY unique_answer (candidate_assessment_id, question_id),
    INDEX idx_assessment (candidate_assessment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;