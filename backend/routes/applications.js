const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processApplicationAI } = require('../services/aiScreening');

const router = express.Router();


const parseJson = (v, fallback) => {
    if (v === null || v === undefined) return fallback;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return fallback; }
};

const AVAILABILITY_OPTIONS = ['IMMEDIATE', 'ONE_WEEK', 'TWO_WEEKS', 'ONE_MONTH', 'MORE_THAN_ONE_MONTH'];

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'cvs');
        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const filename = `${req.user.userId}_${req.body.job_id}_${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];
const ALLOWED_MIMETYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const extOk = ALLOWED_EXTENSIONS.includes(ext);
    const mimeOk = ALLOWED_MIMETYPES.includes(file.mimetype);

    if (extOk && mimeOk) {
        return cb(null, true);
    } else {
        cb(new Error('Only PDF and DOCX files are allowed'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});


router.get('/hr/home', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const [openVacancies] = await pool.execute(
            'SELECT COUNT(*) as count FROM Jobs WHERE status = ?',
            ['OPEN']
        );

        const [newApplications] = await pool.execute(
            `SELECT COUNT(*) as count 
             FROM Applications 
             WHERE ai_status = 'DONE' 
             AND applied_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
            []
        );

        const [interviewsThisWeek] = await pool.execute(
            `SELECT COUNT(*) as count 
             FROM Interviews 
             WHERE status = 'SCHEDULED'
             AND scheduled_start >= DATE_SUB(NOW(), INTERVAL WEEKDAY(NOW()) DAY)
             AND scheduled_start < DATE_ADD(DATE_SUB(NOW(), INTERVAL WEEKDAY(NOW()) DAY), INTERVAL 7 DAY)`,
            []
        );

        const [duplicateFlags] = await pool.execute(
            `SELECT COUNT(*) as count 
             FROM DuplicateFlags 
             WHERE status = 'OPEN'`,
            []
        );

        const [newestApplications] = await pool.execute(
            `SELECT 
                a.id,
                a.candidate_id,
                a.job_id,
                a.stage,
                a.applied_at,
                u.name as candidate_name,
                u.email as candidate_email,
                j.title as job_title,
                ai.match_percent,
                ai.match_label
            FROM Applications a
            JOIN Users u ON a.candidate_id = u.id
            JOIN Jobs j ON a.job_id = j.id
            LEFT JOIN AIScores ai ON ai.application_id = a.id
            WHERE a.ai_status = 'DONE'
            ORDER BY a.applied_at DESC
            LIMIT 4`,
            []
        );

        const [interviewsToday] = await pool.execute(
            `SELECT 
                i.id,
                i.round_name,
                i.mode,
                i.scheduled_start,
                a.candidate_id,
                a.job_id,
                u.name as candidate_name,
                j.title as job_title
            FROM Interviews i
            JOIN Applications a ON i.application_id = a.id
            JOIN Users u ON a.candidate_id = u.id
            JOIN Jobs j ON a.job_id = j.id
            WHERE i.status = 'SCHEDULED'
            AND DATE(i.scheduled_start) = CURDATE()
            ORDER BY i.scheduled_start ASC`,
            []
        );

        res.json({
            counters: {
                openVacancies: openVacancies[0].count,
                newApplications: newApplications[0].count,
                interviewsThisWeek: interviewsThisWeek[0].count,
                duplicateFlags: duplicateFlags[0].count
            },
            newestApplications,
            interviewsToday
        });

    } catch (error) {
        console.error('Get HR home error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});



router.get('/', authenticateToken, async (req, res) => {
    try {
        let query = `
            SELECT 
                a.id,
                a.job_id,
                a.candidate_id,
                a.phone,
                a.cover_note,
                a.expected_salary,
                a.availability,
                a.cv_file_path,
                a.cv_original_name,
                a.cv_mime,
                a.cv_size_bytes,
                a.stage,
                a.current_round,
                a.ai_status,
                a.applied_at,
                a.updated_at,
                a.rejection_reason,
                a.rejection_note,
                a.rejected_at,
                j.title as job_title,
                d.name as job_department,
                u.name as candidate_name,
                u.email as candidate_email,
                ai.match_percent,
                ai.match_label,
                ai.matched_skills,
                ai.missing_skills,
                ai.predicted_score,
                (SELECT GROUP_CONCAT(DISTINCT df.reason) FROM DuplicateFlags df WHERE df.application_id = a.id AND df.status = 'OPEN') as duplicate_reasons,
                (SELECT i.scheduled_start FROM Interviews i WHERE i.application_id = a.id AND i.status = 'SCHEDULED' ORDER BY i.round_number DESC LIMIT 1) as interview_scheduled_start,
                (SELECT COUNT(*) FROM CandidateAssessments ca WHERE ca.application_id = a.id) as assessment_count,
                (SELECT COUNT(*) FROM CandidateAssessments ca WHERE ca.application_id = a.id AND ca.status = 'GRADED') as assessment_completed
            FROM Applications a
            JOIN Jobs j ON a.job_id = j.id
            LEFT JOIN Departments d ON j.department_id = d.id
            JOIN Users u ON a.candidate_id = u.id
            LEFT JOIN AIScores ai ON ai.application_id = a.id
        `;

        let params = [];

        if (req.user.role === 'CANDIDATE') {
            query += ' WHERE a.candidate_id = ?';
            params.push(req.user.userId);
        } else if (req.user.role === 'HR_ADMIN') {
            query += " WHERE a.ai_status = 'DONE'";
        }

        query += ' ORDER BY a.applied_at DESC';

        const [applications] = await pool.execute(query, params);


        const parsedApplications = applications.map(app => ({
            ...app,
            matched_skills: parseJson(app.matched_skills, []),
            missing_skills: parseJson(app.missing_skills, [])
        }));

        const safeApplications = req.user.role === 'CANDIDATE'
            ? parsedApplications.map(({ match_percent, match_label, matched_skills, missing_skills, predicted_score, duplicate_reasons, rejection_reason, rejection_note, rejected_at, ...rest }) => rest)
            : parsedApplications;

        res.json({
            applications: safeApplications
        });

    } catch (error) {
        console.error('Get applications error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.get('/job/:jobId', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { jobId } = req.params;

        const query = `
            SELECT 
                a.id,
                a.job_id,
                a.candidate_id,
                a.phone,
                a.cover_note,
                a.expected_salary,
                a.availability,
                a.cv_file_path,
                a.cv_original_name,
                a.cv_mime,
                a.cv_size_bytes,
                a.stage,
                a.current_round,
                a.ai_status,
                a.applied_at,
                a.updated_at,
                u.name as candidate_name,
                u.email as candidate_email,
                ai.match_percent,
                ai.match_label,
                ai.matched_skills,
                ai.missing_skills,
                ai.predicted_score,
                (SELECT GROUP_CONCAT(DISTINCT df.reason) FROM DuplicateFlags df WHERE df.application_id = a.id AND df.status = 'OPEN') as duplicate_reasons,
                (SELECT i.scheduled_start FROM Interviews i WHERE i.application_id = a.id AND i.status = 'SCHEDULED' ORDER BY i.round_number DESC LIMIT 1) as interview_scheduled_start,
                (SELECT COUNT(*) FROM CandidateAssessments ca WHERE ca.application_id = a.id) as assessment_count,
                (SELECT COUNT(*) FROM CandidateAssessments ca WHERE ca.application_id = a.id AND ca.status = 'GRADED') as assessment_completed
            FROM Applications a
            JOIN Users u ON a.candidate_id = u.id
            LEFT JOIN AIScores ai ON ai.application_id = a.id
            WHERE a.job_id = ? AND a.ai_status = 'DONE'
            ORDER BY ai.match_percent DESC, a.applied_at DESC
        `;

        const [applications] = await pool.execute(query, [jobId]);

        const parsedApplications = applications.map(app => ({
            ...app,
            matched_skills: parseJson(app.matched_skills, []),
            missing_skills: parseJson(app.missing_skills, [])
        }));

        res.json({
            applications: parsedApplications
        });

    } catch (error) {
        console.error('Get job applications error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.post('/', authenticateToken, authorize('CANDIDATE'), upload.single('cv'), async (req, res) => {
    try {
        const { job_id, phone, cover_note, expected_salary, availability } = req.body;
        const candidate_id = req.user.userId;

        if (!job_id) {
            if (req.file) {
                fs.unlinkSync(req.file.path);
            }
            return res.status(400).json({
                message: 'Job ID is required'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                message: 'CV file is required'
            });
        }

        if (!phone || !phone.trim()) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: 'Phone number is required'
            });
        }

        if (!/^\d{11}$/.test(phone.trim())) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: 'Phone number must be exactly 11 digits'
            });
        }

        if (availability && !AVAILABILITY_OPTIONS.includes(availability)) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: 'Invalid availability option'
            });
        }

        if (expected_salary && isNaN(Number(expected_salary))) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: 'Expected salary must be a number'
            });
        }

        const [jobs] = await pool.execute(
            'SELECT id, status, application_deadline FROM Jobs WHERE id = ?',
            [job_id]
        );

        if (jobs.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(404).json({
                message: 'Job not found'
            });
        }

        if (jobs[0].status !== 'OPEN') {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({
                message: 'This job is no longer accepting applications'
            });
        }

        if (jobs[0].application_deadline) {
            const closingDay = String(jobs[0].application_deadline).slice(0, 10);
            const now = new Date();
            const pad = (n) => String(n).padStart(2, '0');
            const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

            if (closingDay < today) {
                fs.unlinkSync(req.file.path);
                return res.status(409).json({
                    message: 'The closing date for this job has passed'
                });
            }
        }

        const [existingApplications] = await pool.execute(
            'SELECT id FROM Applications WHERE job_id = ? AND candidate_id = ?',
            [job_id, candidate_id]
        );

        if (existingApplications.length > 0) {
            fs.unlinkSync(req.file.path);
            return res.status(409).json({
                message: 'You have already applied for this job'
            });
        }

        const cv_file_path = `uploads/cvs/${req.file.filename}`;

        const [result] = await pool.execute(
            `INSERT INTO Applications 
                (job_id, candidate_id, cv_file_path, cv_original_name, cv_mime, cv_size_bytes, phone, cover_note, expected_salary, availability, stage) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                job_id,
                candidate_id,
                cv_file_path,
                req.file.originalname,
                req.file.mimetype,
                req.file.size,
                phone.trim(),
                cover_note ? cover_note.trim() : null,
                expected_salary || null,
                availability || null,
                'APPLIED'
            ]
        );

        await createApplicationEvent(
            pool, result.insertId, 'CANDIDATE', candidate_id,
            'APPLICATION_SUBMITTED', 'Application submitted with CV', null, false
        ).catch(err => console.error('Could not log submitted event:', err.message));

        const [jobAssessments] = await pool.execute(
            `SELECT ja.id as job_assessment_id, ja.template_id, ja.deadline_hours
             FROM JobAssessments ja
             WHERE ja.job_id = ?`,
            [job_id]
        );

        for (const ja of jobAssessments) {
            const deadlineDate = new Date();
            deadlineDate.setHours(deadlineDate.getHours() + ja.deadline_hours);

            await pool.execute(
                `INSERT INTO CandidateAssessments 
                (application_id, template_id, job_assessment_id, status, deadline_at)
                VALUES (?, ?, ?, 'PENDING', ?)`,
                [result.insertId, ja.template_id, ja.job_assessment_id, deadlineDate]
            );

            await createApplicationEvent(
                pool, result.insertId, 'SYSTEM', null,
                'ASSESSMENT_ASSIGNED', 'Skills assessment assigned', null, true
            ).catch(err => console.error('Could not log assessment assignment:', err.message));
        }


        processApplicationAI(result.insertId);

        res.status(201).json({
            message: 'Application submitted successfully',
            applicationId: result.insertId
        });

    } catch (error) {
        console.error('Create application error:', error);

        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (unlinkError) {
                console.error('Failed to delete uploaded file:', unlinkError);
            }
        }

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'You have already applied for this job'
            });
        }

        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.put('/:id', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { stage } = req.body;

        const validStages = ['APPLIED', 'SHORTLISTED', 'SLOTS_OFFERED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'ON_HOLD', 'REJECTED', 'READY_FOR_OFFER'];
        if (!validStages.includes(stage)) {
            return res.status(400).json({
                message: 'Invalid stage'
            });
        }

        const [applications] = await pool.execute(
            'SELECT id FROM Applications WHERE id = ?',
            [id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        await pool.execute(
            'UPDATE Applications SET stage = ? WHERE id = ?',
            [stage, id]
        );

        res.json({
            message: 'Application stage updated successfully'
        });

    } catch (error) {
        console.error('Update application error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.delete('/:id', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        const [applications] = await pool.execute(
            'SELECT cv_file_path FROM Applications WHERE id = ?',
            [id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        await pool.execute(
            'DELETE FROM Applications WHERE id = ?',
            [id]
        );

        if (applications[0].cv_file_path) {
            const filePath = path.join(__dirname, '..', applications[0].cv_file_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.json({
            message: 'Application deleted successfully'
        });

    } catch (error) {
        console.error('Delete application error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.get('/:id/duplicates', authenticateToken, authorize('HR_ADMIN'), async (req, res, next) => {
    if (req.params.id === 'hr') return next();
    try {
        const { id } = req.params;

        const [flags] = await pool.execute(
            `SELECT
                df.id,
                df.reason,
                df.similarity,
                df.status,
                df.matched_application_id,
                u.name as matched_candidate_name,
                u.email as matched_candidate_email
             FROM DuplicateFlags df
             JOIN Applications a ON df.matched_application_id = a.id
             JOIN Users u ON a.candidate_id = u.id
             WHERE df.application_id = ?`,
            [id]
        );

        res.json({ duplicateFlags: flags });

    } catch (error) {
        console.error('Get duplicate flags error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

router.get('/:id/cv', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [applications] = await pool.execute(
            'SELECT cv_file_path, candidate_id FROM Applications WHERE id = ?',
            [id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        if (req.user.role === 'CANDIDATE' && applications[0].candidate_id !== req.user.userId) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        const filePath = path.join(__dirname, '..', applications[0].cv_file_path);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                message: 'CV file not found'
            });
        }

        const originalFilename = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        let contentType = 'application/octet-stream';
        if (ext === '.pdf') {
            contentType = 'application/pdf';
        } else if (ext === '.docx') {
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${originalFilename}"`);
        
        res.sendFile(filePath);

    } catch (error) {
        console.error('Download CV error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});



async function createApplicationEvent(connection, applicationId, actorType, actorUserId, eventType, title, note, visibleToCandidate = false) {
    await connection.execute(
        `INSERT INTO ApplicationEvents 
            (application_id, actor_type, actor_user_id, event_type, title, note, visible_to_candidate) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [applicationId, actorType, actorUserId, eventType, title, note, visibleToCandidate]
    );
}

router.post('/:id/shortlist', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { id } = req.params;

        const [applications] = await connection.execute(
            'SELECT id, stage, candidate_id FROM Applications WHERE id = ?',
            [id]
        );

        if (applications.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        const currentStage = applications[0].stage;

        if (currentStage !== 'APPLIED') {
            await connection.rollback();
            return res.status(400).json({
                message: `Cannot shortlist application from ${currentStage} stage`
            });
        }

        const [requiredAssessments] = await connection.execute(
            `SELECT 
                COUNT(*) as total_required,
                SUM(CASE WHEN ca.status = 'GRADED' AND ca.passed = true THEN 1 ELSE 0 END) as passed_count,
                SUM(CASE WHEN ca.status = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN ca.status = 'GRADED' AND ca.passed = false THEN 1 ELSE 0 END) as failed_count
            FROM CandidateAssessments ca
            JOIN JobAssessments ja ON ca.job_assessment_id = ja.id
            WHERE ca.application_id = ? AND ja.is_required = true`,
            [id]
        );

        const assessmentStatus = requiredAssessments[0];

        if (assessmentStatus.total_required > 0) {
            if (assessmentStatus.pending_count > 0) {
                console.log(`Warning: Shortlisting application ${id} with ${assessmentStatus.pending_count} pending required assessments`);
            }
            if (assessmentStatus.failed_count > 0 && assessmentStatus.passed_count === 0) {
                console.log(`Warning: Shortlisting application ${id} despite ${assessmentStatus.failed_count} failed assessments`);
            }
        }

        await connection.execute(
            'UPDATE Applications SET stage = ? WHERE id = ?',
            ['SHORTLISTED', id]
        );

        await createApplicationEvent(
            connection,
            id,
            'HR',
            req.user.userId,
            'SHORTLISTED',
            'Shortlisted by HR',
            null,
            true
        );

        await connection.commit();

        res.json({
            message: 'Application shortlisted successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Shortlist application error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.post('/:id/reject', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { rejection_reason, rejection_note } = req.body;

        const validReasons = ['SKILLS_MISMATCH', 'NOT_ENOUGH_EXPERIENCE', 'DUPLICATE_APPLICATION', 'POSITION_FILLED', 'FAILED_INTERVIEW', 'OTHER'];
        
        if (!rejection_reason || !validReasons.includes(rejection_reason)) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Valid rejection reason is required'
            });
        }

        const [applications] = await connection.execute(
            'SELECT id, stage, candidate_id FROM Applications WHERE id = ?',
            [id]
        );

        if (applications.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        if (applications[0].stage === 'REJECTED') {
            await connection.rollback();
            return res.status(400).json({
                message: 'Application is already rejected'
            });
        }

        await connection.execute(
            'UPDATE Applications SET stage = ?, rejection_reason = ?, rejection_note = ?, rejected_at = NOW() WHERE id = ?',
            ['REJECTED', rejection_reason, rejection_note || null, id]
        );

        await createApplicationEvent(
            connection,
            id,
            'HR',
            req.user.userId,
            'REJECTED',
            'Application not selected',
             null,
            true 
        );

        await connection.commit();

        res.json({
            message: 'Application rejected successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Reject application error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.post('/:id/hold', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { note } = req.body;

        const [applications] = await connection.execute(
            'SELECT id, stage FROM Applications WHERE id = ?',
            [id]
        );

        if (applications.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        const currentStage = applications[0].stage;

        if (currentStage === 'REJECTED') {
            await connection.rollback();
            return res.status(400).json({
                message: 'Cannot place rejected application on hold'
            });
        }

        if (currentStage === 'ON_HOLD') {
            await connection.rollback();
            return res.status(400).json({
                message: 'Application is already on hold'
            });
        }

        await connection.execute(
            'UPDATE Applications SET stage = ? WHERE id = ?',
            ['ON_HOLD', id]
        );

        await createApplicationEvent(
            connection,
            id,
            'HR',
            req.user.userId,
            'PLACED_ON_HOLD',
            'Placed on hold',
            note || null,
            false 
        );

        await connection.commit();

        res.json({
            message: 'Application placed on hold successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Hold application error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.post('/:id/reopen', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { id } = req.params;

        const [applications] = await connection.execute(
            'SELECT id, stage FROM Applications WHERE id = ?',
            [id]
        );

        if (applications.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        if (applications[0].stage !== 'ON_HOLD') {
            await connection.rollback();
            return res.status(400).json({
                message: 'Only applications on hold can be reopened'
            });
        }

    
        await connection.execute(
            'UPDATE Applications SET stage = ? WHERE id = ?',
            ['INTERVIEWED', id]
        );

        await createApplicationEvent(
            connection,
            id,
            'HR',
            req.user.userId,
            'REOPENED',
            'Reopened from hold',
            null,
            false 
        );

        await connection.commit();

        res.json({
            message: 'Application reopened successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Reopen application error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.post('/:id/notes', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { note } = req.body;

        if (!note || !note.trim()) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Note is required'
            });
        }

        const [applications] = await connection.execute(
            'SELECT id FROM Applications WHERE id = ?',
            [id]
        );

        if (applications.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        await createApplicationEvent(
            connection,
            id,
            'HR',
            req.user.userId,
            'NOTE_ADDED',
            'Internal note added',
            note.trim(),
            false 
        );

        await connection.commit();

        res.json({
            message: 'Note added successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Add note error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.get('/:id/events', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const [applications] = await pool.execute(
            'SELECT id, candidate_id FROM Applications WHERE id = ?',
            [id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        if (req.user.role === 'CANDIDATE' && applications[0].candidate_id !== req.user.userId) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        let query = `
            SELECT 
                e.id,
                e.application_id,
                e.actor_type,
                e.actor_user_id,
                e.event_type,
                e.title,
                e.note,
                e.metadata,
                e.visible_to_candidate,
                e.created_at,
                u.name as actor_name,
                u.email as actor_email
            FROM ApplicationEvents e
            LEFT JOIN Users u ON e.actor_user_id = u.id
            WHERE e.application_id = ?
        `;

        const params = [id];

        if (req.user.role === 'CANDIDATE') {
            query += ' AND e.visible_to_candidate = true';
        }

        query += ' ORDER BY e.created_at DESC';

        const [events] = await pool.execute(query, params);

        res.json({
            events: req.user.role === 'CANDIDATE'
                ? events.map(({ id, event_type, title, created_at }) => ({ id, event_type, title, created_at }))
                : events
        });

    } catch (error) {
        console.error('Get application events error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.get('/:id/detail', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                a.id,
                a.job_id,
                a.candidate_id,
                a.phone,
                a.cover_note,
                a.expected_salary,
                a.availability,
                a.cv_file_path,
                a.cv_original_name,
                a.cv_mime,
                a.cv_size_bytes,
                a.stage,
                a.current_round,
                a.ai_status,
                a.applied_at,
                a.updated_at,
                a.rejection_reason,
                a.rejection_note,
                a.rejected_at,
                j.title as job_title,
                d.name as job_department,
                j.description as job_description,
                u.name as candidate_name,
                u.email as candidate_email,
                ai.match_percent,
                ai.match_label,
                ai.matched_skills,
                ai.missing_skills,
                ai.predicted_score,
                (SELECT COUNT(*) FROM Interviews iv WHERE iv.application_id = a.id AND iv.status IN ('SCHEDULED', 'COMPLETED')) AS interview_rounds,
                (SELECT i.scheduled_start FROM Interviews i WHERE i.application_id = a.id AND i.status = 'SCHEDULED' ORDER BY i.round_number DESC LIMIT 1) as interview_scheduled_start
            FROM Applications a
            JOIN Jobs j ON a.job_id = j.id
            LEFT JOIN Departments d ON j.department_id = d.id
            JOIN Users u ON a.candidate_id = u.id
            LEFT JOIN AIScores ai ON ai.application_id = a.id
            WHERE a.id = ?
        `;

        const [applications] = await pool.execute(query, [id]);

        if (applications.length === 0) {
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        const application = applications[0];

        if (req.user.role === 'CANDIDATE' && application.candidate_id !== req.user.userId) {
            return res.status(403).json({
                message: 'Access denied'
            });
        }

        application.matched_skills = parseJson(application.matched_skills, []);
        application.missing_skills = parseJson(application.missing_skills, []);

  
        if (req.user.role === 'CANDIDATE') {
            for (const key of ['rejection_reason', 'rejection_note', 'rejected_at', 'match_percent', 'match_label', 'matched_skills', 'missing_skills', 'predicted_score']) {
                delete application[key];
            }
        }

        res.json({
            application
        });

    } catch (error) {
        console.error('Get application detail error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

module.exports = router;



router.get('/me/applications', authenticateToken, authorize('CANDIDATE'), async (req, res) => {
    try {
        const candidateId = req.user.userId;

        const [applications] = await pool.execute(
            `SELECT 
                a.id,
                a.job_id,
                a.stage,
                a.current_round,
                a.applied_at,
                j.title as job_title,
                j.department as job_department,
                j.location as job_location
            FROM Applications a
            JOIN Jobs j ON a.job_id = j.id
            WHERE a.candidate_id = ?
            ORDER BY a.applied_at DESC`,
            [candidateId]
        );

        res.json({
            applications
        });

    } catch (error) {
        console.error('Get candidate applications error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.get('/me/applications/:id', authenticateToken, authorize('CANDIDATE'), async (req, res) => {
    try {
        const { id } = req.params;
        const candidateId = req.user.userId;

        const [applications] = await pool.execute(
            `SELECT 
                a.id,
                a.job_id,
                a.candidate_id,
                a.stage,
                a.current_round,
                a.ai_status,
                a.applied_at,
                j.title as job_title,
                j.department as job_department,
                j.location as job_location,
                j.employment_type AS job_type
            FROM Applications a
            JOIN Jobs j ON a.job_id = j.id
            WHERE a.id = ? AND a.candidate_id = ?`,
            [id, candidateId]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        const application = applications[0];

        const [events] = await pool.execute(
            `SELECT 
                event_type,
                title,
                note,
                created_at,
                actor_type
            FROM ApplicationEvents
            WHERE application_id = ? AND visible_to_candidate = true
            ORDER BY created_at DESC`,
            [id]
        );

        application.timeline = events;

        res.json({
            application
        });

    } catch (error) {
        console.error('Get candidate application detail error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});



router.get('/hr/duplicates', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const [flags] = await pool.execute(
            `SELECT 
                df.id,
                df.application_id,
                df.matched_application_id,
                df.reason,
                df.similarity,
                df.status,
                df.created_at,
                a1.job_id as app1_job_id,
                a1.applied_at as app1_applied_at,
                u1.name as app1_candidate_name,
                u1.email as app1_candidate_email,
                a1.phone as app1_candidate_phone,
                j1.title as app1_job_title,
                a2.job_id as app2_job_id,
                a2.applied_at as app2_applied_at,
                u2.name as app2_candidate_name,
                u2.email as app2_candidate_email,
                a2.phone as app2_candidate_phone,
                j2.title as app2_job_title
            FROM DuplicateFlags df
            JOIN Applications a1 ON df.application_id = a1.id
            JOIN Users u1 ON a1.candidate_id = u1.id
            JOIN Jobs j1 ON a1.job_id = j1.id
            JOIN Applications a2 ON df.matched_application_id = a2.id
            JOIN Users u2 ON a2.candidate_id = u2.id
            JOIN Jobs j2 ON a2.job_id = j2.id
            WHERE df.status = 'OPEN'
            ORDER BY df.created_at DESC`
        );

        res.json({
            duplicateFlags: flags
        });

    } catch (error) {
        console.error('Get duplicate flags error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.post('/hr/duplicates/:id/dismiss', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { id } = req.params;

        const [flags] = await connection.execute(
            'SELECT id, application_id, status FROM DuplicateFlags WHERE id = ?',
            [id]
        );

        if (flags.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Duplicate flag not found'
            });
        }

        if (flags[0].status !== 'OPEN') {
            await connection.rollback();
            return res.status(400).json({
                message: 'Can only dismiss OPEN duplicate flags'
            });
        }

        await connection.execute(
            'UPDATE DuplicateFlags SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
            ['DISMISSED', req.user.userId, id]
        );

        await connection.commit();

        res.json({
            message: 'Duplicate flag dismissed successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Dismiss duplicate flag error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.post('/hr/duplicates/:id/confirm', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const { id } = req.params;
        const { rejection_note } = req.body;

        const [flags] = await connection.execute(
            'SELECT id, application_id, status FROM DuplicateFlags WHERE id = ?',
            [id]
        );

        if (flags.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Duplicate flag not found'
            });
        }

        if (flags[0].status !== 'OPEN') {
            await connection.rollback();
            return res.status(400).json({
                message: 'Can only confirm OPEN duplicate flags'
            });
        }

        const applicationId = flags[0].application_id;

        await connection.execute(
            'UPDATE DuplicateFlags SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
            ['CONFIRMED', req.user.userId, id]
        );

        await connection.execute(
            'UPDATE Applications SET stage = ?, rejection_reason = ?, rejection_note = ?, rejected_at = NOW() WHERE id = ?',
            ['REJECTED', 'DUPLICATE_APPLICATION', rejection_note || 'Confirmed as duplicate application', applicationId]
        );

        await createApplicationEvent(
            connection,
            applicationId,
            'HR',
            req.user.userId,
            'REJECTED',
            'Application not selected',
            null,
            true 
        );

        await connection.commit();

        res.json({
            message: 'Duplicate confirmed and application rejected successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Confirm duplicate flag error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

module.exports = router;

router.get('/hr/:id/events', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        const [applications] = await pool.execute(
            'SELECT id FROM Applications WHERE id = ?',
            [id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        const [events] = await pool.execute(
            `SELECT 
                e.id,
                e.actor_type,
                e.actor_user_id,
                e.event_type,
                e.title,
                e.note,
                e.metadata,
                e.visible_to_candidate,
                e.created_at,
                u.name as actor_name
            FROM ApplicationEvents e
            LEFT JOIN Users u ON e.actor_user_id = u.id
            WHERE e.application_id = ?
            ORDER BY e.created_at DESC, e.id DESC`,
            [id]
        );

        res.json({
            events
        });

    } catch (error) {
        console.error('Get application events error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.post('/hr/:id/reprocess', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        const [applications] = await pool.execute(
            'SELECT id, ai_status FROM Applications WHERE id = ?',
            [id]
        );

        if (applications.length === 0) {
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        const aiStatus = applications[0].ai_status;

        if (aiStatus === 'DONE') {
            return res.status(400).json({
                message: 'Application has already been successfully processed'
            });
        }

        if (aiStatus === 'PROCESSING') {
            return res.status(400).json({
                message: 'Application is currently being processed'
            });
        }

        await pool.execute(
            "UPDATE Applications SET ai_status = 'PENDING' WHERE id = ?",
            [id]
        );

        processApplicationAI(id);

        res.json({
            message: 'Application reprocessing started'
        });

    } catch (error) {
        console.error('Reprocess application error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});
