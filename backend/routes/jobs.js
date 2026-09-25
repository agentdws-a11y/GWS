const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'];
const WORK_MODES = ['ONSITE', 'REMOTE', 'HYBRID'];
const EXPERIENCE_LEVELS = ['ENTRY', 'MID', 'SENIOR', 'LEAD'];

router.get('/', authenticateToken, async (req, res) => {
    try {
        let query = '';
        let params = [];

        if (req.user.role === 'HR_ADMIN') {
            query = `
                SELECT j.*,
                    d.name AS department_name,
                    (SELECT COUNT(*) FROM Applications a
                     WHERE a.job_id = j.id AND a.ai_status = 'DONE') AS total_applications,
                    (SELECT COUNT(*) FROM Applications a
                     JOIN AIScores ai ON ai.application_id = a.id
                     WHERE a.job_id = j.id AND a.ai_status = 'DONE' AND ai.match_label = 'STRONG') AS strong_applications
                FROM Jobs j
                LEFT JOIN Departments d ON j.department_id = d.id`;
        } else {
            query = `
                SELECT j.*,
                    d.name AS department_name
                FROM Jobs j
                LEFT JOIN Departments d ON j.department_id = d.id`;
        }

        if (req.user.role === 'CANDIDATE') {
            query += ' WHERE j.status = ?';
            params.push('OPEN');
        }

        query += ' ORDER BY j.created_at DESC';

        const [jobs] = await pool.execute(query, params);

        res.json({
            jobs
        });

    } catch (error) {
        console.error('Get jobs error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        let query = `
            SELECT j.*,
                d.name AS department_name
            FROM Jobs j
            LEFT JOIN Departments d ON j.department_id = d.id
            WHERE j.id = ?`;
        let params = [id];

        if (req.user.role === 'CANDIDATE') {
            query += ' AND j.status = ?';
            params.push('OPEN');
        }

        const [jobs] = await pool.execute(query, params);

        if (jobs.length === 0) {
            return res.status(404).json({
                message: 'Job not found'
            });
        }

        const job = jobs[0];

        if (req.user.role === 'CANDIDATE') {
            const [assessments] = await pool.execute(
                `SELECT 
                    t.id,
                    t.title,
                    t.description,
                    t.duration_minutes,
                    t.passing_score,
                    ja.is_required,
                    ja.deadline_hours,
                    COUNT(q.id) as question_count
                FROM JobAssessments ja
                JOIN AssessmentTemplates t ON ja.template_id = t.id
                LEFT JOIN AssessmentQuestions q ON t.id = q.template_id
                WHERE ja.job_id = ? AND t.status = 'ACTIVE'
                GROUP BY t.id, t.title, t.description, t.duration_minutes, t.passing_score, ja.is_required, ja.deadline_hours`,
                [id]
            );

            job.assessments = assessments;
        }

        res.json({
            job
        });

    } catch (error) {
        console.error('Get job error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

function validateJobFields(body) {
    const {
        title, description, department_id, required_skills,
        employment_type, work_mode, experience_level,
        min_salary, max_salary, openings, application_deadline
    } = body;

    if (!title || !description || !department_id || !required_skills) {
        return 'Title, description, department, and required skills are required';
    }

    if (title.trim().length < 3) {
        return 'Title must be at least 3 characters';
    }

    if (description.trim().length < 10) {
        return 'Description must be at least 10 characters';
    }

    if (isNaN(Number(department_id)) || Number(department_id) < 1) {
        return 'Valid department is required';
    }

    if (Array.isArray(required_skills)) {
        if (required_skills.length === 0) {
            return 'At least one required skill must be specified';
        }
    } else if (typeof required_skills === 'string') {
        if (required_skills.trim().length < 2) {
            return 'Required skills must be specified';
        }
    } else {
        return 'Required skills must be an array or string';
    }

    if (employment_type && !EMPLOYMENT_TYPES.includes(employment_type)) {
        return 'Invalid employment type';
    }

    if (work_mode && !WORK_MODES.includes(work_mode)) {
        return 'Invalid work mode';
    }

    if (experience_level && !EXPERIENCE_LEVELS.includes(experience_level)) {
        return 'Invalid experience level';
    }

    if (min_salary !== undefined && min_salary !== null && min_salary !== '' && isNaN(Number(min_salary))) {
        return 'Minimum salary must be a number';
    }

    if (max_salary !== undefined && max_salary !== null && max_salary !== '' && isNaN(Number(max_salary))) {
        return 'Maximum salary must be a number';
    }

    if (min_salary && max_salary && Number(min_salary) > Number(max_salary)) {
        return 'Minimum salary cannot be greater than maximum salary';
    }

    if (openings !== undefined && openings !== null && openings !== '' && (isNaN(Number(openings)) || Number(openings) < 1)) {
        return 'Number of openings must be at least 1';
    }

    if (application_deadline) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlineDate = new Date(application_deadline);
        if (deadlineDate < today) {
            return 'Application deadline cannot be in the past';
        }
    }

    return null;
}

router.post('/', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const {
            title, description, department_id, required_skills, status,
            employment_type, work_mode, location, experience_level,
            min_salary, max_salary, openings, application_deadline
        } = req.body;

        const validationError = validateJobFields(req.body);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const validStatuses = ['OPEN', 'CLOSED', 'DRAFT'];
        const jobStatus = status || 'OPEN';

        if (!validStatuses.includes(jobStatus)) {
            return res.status(400).json({
                message: 'Status must be OPEN, CLOSED, or DRAFT'
            });
        }

        const [departments] = await pool.execute(
            'SELECT id FROM Departments WHERE id = ?',
            [department_id]
        );

        if (departments.length === 0) {
            return res.status(404).json({
                message: 'Department not found'
            });
        }

        let requiredSkillsJson;
        if (Array.isArray(required_skills)) {
            requiredSkillsJson = JSON.stringify(required_skills);
        } else if (typeof required_skills === 'string') {
            const skillsArray = required_skills.split(',').map(s => s.trim()).filter(s => s.length > 0);
            requiredSkillsJson = JSON.stringify(skillsArray);
        } else {
            return res.status(400).json({ message: 'Required skills must be an array or comma-separated string' });
        }

        const publishedAt = jobStatus === 'OPEN' ? new Date() : null;

        const minSalaryValue = min_salary !== undefined && min_salary !== null && min_salary !== '' ? Number(min_salary) : null;
        const maxSalaryValue = max_salary !== undefined && max_salary !== null && max_salary !== '' ? Number(max_salary) : null;
        const openingsValue = openings !== undefined && openings !== null && openings !== '' ? Number(openings) : 1;

        const [result] = await pool.execute(
            `INSERT INTO Jobs 
                (title, description, department_id, employment_type, work_mode, location, experience_level, min_salary, max_salary, openings, application_deadline, required_skills, status, created_by, published_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title.trim(),
                description.trim(),
                Number(department_id),
                employment_type || 'FULL_TIME',
                work_mode || 'ONSITE',
                location ? location.trim() : null,
                experience_level || 'ENTRY',
                minSalaryValue,
                maxSalaryValue,
                openingsValue,
                application_deadline || null,
                requiredSkillsJson,
                jobStatus,
                req.user.userId,
                publishedAt
            ]
        );

        res.status(201).json({
            message: 'Job created successfully',
            jobId: result.insertId
        });

    } catch (error) {
        console.error('Create job error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.put('/:id', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, description, department_id, required_skills, status,
            employment_type, work_mode, location, experience_level,
            min_salary, max_salary, openings, application_deadline
        } = req.body;

        const [existingJobs] = await pool.execute(
            'SELECT status, published_at FROM Jobs WHERE id = ?',
            [id]
        );

        if (existingJobs.length === 0) {
            return res.status(404).json({
                message: 'Job not found'
            });
        }

        const validationError = validateJobFields(req.body);
        if (validationError) {
            return res.status(400).json({ message: validationError });
        }

        const validStatuses = ['OPEN', 'CLOSED', 'DRAFT'];
        const jobStatus = status || 'OPEN';

        if (!validStatuses.includes(jobStatus)) {
            return res.status(400).json({
                message: 'Status must be OPEN, CLOSED, or DRAFT'
            });
        }

        const [departments] = await pool.execute(
            'SELECT id FROM Departments WHERE id = ?',
            [department_id]
        );

        if (departments.length === 0) {
            return res.status(404).json({
                message: 'Department not found'
            });
        }

        let requiredSkillsJson;
        if (Array.isArray(required_skills)) {
            requiredSkillsJson = JSON.stringify(required_skills);
        } else if (typeof required_skills === 'string') {
            const skillsArray = required_skills.split(',').map(s => s.trim()).filter(s => s.length > 0);
            requiredSkillsJson = JSON.stringify(skillsArray);
        } else {
            return res.status(400).json({ message: 'Required skills must be an array or comma-separated string' });
        }

        const existingStatus = existingJobs[0].status;
        const existingPublishedAt = existingJobs[0].published_at;
        let publishedAt = existingPublishedAt;
        
        if (jobStatus === 'OPEN' && existingStatus !== 'OPEN' && !existingPublishedAt) {
            publishedAt = new Date();
        }

        const minSalaryValue = min_salary !== undefined && min_salary !== null && min_salary !== '' ? Number(min_salary) : null;
        const maxSalaryValue = max_salary !== undefined && max_salary !== null && max_salary !== '' ? Number(max_salary) : null;
        const openingsValue = openings !== undefined && openings !== null && openings !== '' ? Number(openings) : 1;

        await pool.execute(
            `UPDATE Jobs SET 
                title = ?, description = ?, department_id = ?, employment_type = ?, work_mode = ?, location = ?, 
                experience_level = ?, min_salary = ?, max_salary = ?, openings = ?, application_deadline = ?, 
                required_skills = ?, status = ?, published_at = ? 
             WHERE id = ?`,
            [
                title.trim(),
                description.trim(),
                Number(department_id),
                employment_type || 'FULL_TIME',
                work_mode || 'ONSITE',
                location ? location.trim() : null,
                experience_level || 'ENTRY',
                minSalaryValue,
                maxSalaryValue,
                openingsValue,
                application_deadline || null,
                requiredSkillsJson,
                jobStatus,
                publishedAt,
                id
            ]
        );

        res.json({
            message: 'Job updated successfully'
        });

    } catch (error) {
        console.error('Update job error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.delete('/:id', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.execute(
            'DELETE FROM Jobs WHERE id = ?',
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Job not found'
            });
        }

        res.json({
            message: 'Job deleted successfully'
        });

    } catch (error) {
        console.error('Delete job error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

module.exports = router;