const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.post('/templates', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { title, description, duration_minutes, passing_score, status } = req.body;
        const hrUserId = req.user.userId; 

        if (!title || title.trim().length === 0) {
            return res.status(400).json({ message: 'Title is required' });
        }
        if (!duration_minutes || duration_minutes < 1) {
            return res.status(400).json({ message: 'Duration must be at least 1 minute' });
        }
        if (passing_score && (passing_score < 0 || passing_score > 100)) {
            return res.status(400).json({ message: 'Passing score must be between 0 and 100' });
        }

        const [result] = await db.query(
            `INSERT INTO AssessmentTemplates 
            (title, description, duration_minutes, passing_score, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                title.trim(),
                description?.trim() || null,
                duration_minutes,
                passing_score || 70,
                status || 'ACTIVE',
                hrUserId
            ]
        );

        res.status(201).json({
            message: 'Assessment template created',
            templateId: result.insertId
        });
    } catch (error) {
        console.error('Error creating assessment template:', error);
        res.status(500).json({ message: 'Failed to create assessment template' });
    }
});

router.get('/templates', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const [templates] = await db.query(
            `SELECT 
                t.id,
                t.title,
                t.description,
                t.duration_minutes,
                t.passing_score,
                t.status,
                t.created_at,
                u.name as creator_name,
                COUNT(q.id) as question_count
            FROM AssessmentTemplates t
            LEFT JOIN Users u ON t.created_by = u.id
            LEFT JOIN AssessmentQuestions q ON t.id = q.template_id
            GROUP BY t.id
            ORDER BY t.created_at DESC`
        );

        res.json({ templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ message: 'Failed to fetch templates' });
    }
});

router.get('/templates/:id', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        console.log('=== Fetching template ===');
        console.log('Template ID:', id);
        console.log('User:', req.user);

        const [templates] = await db.query(
            `SELECT 
                t.*,
                u.name as creator_name
            FROM AssessmentTemplates t
            LEFT JOIN Users u ON t.created_by = u.id
            WHERE t.id = ?`,
            [id]
        );

        console.log('Templates found:', templates.length);

        if (templates.length === 0) {
            console.log('Template not found with ID:', id);
            return res.status(404).json({ message: 'Template not found' });
        }

        console.log('Template data:', templates[0]);

        const [questions] = await db.query(
            `SELECT * FROM AssessmentQuestions
            WHERE template_id = ?
            ORDER BY order_index ASC`,
            [id]
        );

        console.log('Questions found:', questions.length);

        const questionsWithParsedOptions = questions.map(q => {
            let parsedOptions = null;
            
            if (q.options) {
                try {
                    parsedOptions = JSON.parse(q.options);
                } catch (e) {
                    if (Array.isArray(q.options)) {
                        parsedOptions = q.options;
                    } else if (typeof q.options === 'string') {
                        console.warn(`Question ${q.id} has invalid JSON options, converting to array`);
                        parsedOptions = [q.options];
                    } else {
                        console.warn(`Question ${q.id} has invalid options format, setting to null`);
                        parsedOptions = null;
                    }
                }
            }
            
            return {
                ...q,
                options: parsedOptions
            };
        });

        console.log('Sending response with template and questions');

        res.json({
            template: templates[0],
            questions: questionsWithParsedOptions
        });
    } catch (error) {
        console.error('=== ERROR fetching template ===');
        console.error('Error details:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ message: 'Failed to fetch template' });
    }
});

router.put('/templates/:id', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, duration_minutes, passing_score, status } = req.body;

        if (title && title.trim().length === 0) {
            return res.status(400).json({ message: 'Title cannot be empty' });
        }
        if (duration_minutes && duration_minutes < 1) {
            return res.status(400).json({ message: 'Duration must be at least 1 minute' });
        }
        if (passing_score && (passing_score < 0 || passing_score > 100)) {
            return res.status(400).json({ message: 'Passing score must be between 0 and 100' });
        }

        await db.query(
            `UPDATE AssessmentTemplates
            SET title = ?, description = ?, duration_minutes = ?, passing_score = ?, status = ?
            WHERE id = ?`,
            [
                title?.trim(),
                description?.trim() || null,
                duration_minutes,
                passing_score,
                status,
                id
            ]
        );

        res.json({ message: 'Template updated successfully' });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ message: 'Failed to update template' });
    }
});

router.delete('/templates/:id', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        const [linkedJobs] = await db.query(
            `SELECT COUNT(*) as count FROM JobAssessments WHERE template_id = ?`,
            [id]
        );

        if (linkedJobs[0].count > 0) {
            return res.status(400).json({
                message: 'Cannot delete template that is linked to jobs. Unlink it first.'
            });
        }

        await db.query(`DELETE FROM AssessmentTemplates WHERE id = ?`, [id]);

        res.json({ message: 'Template deleted successfully' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ message: 'Failed to delete template' });
    }
});

router.post('/templates/:templateId/questions', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { templateId } = req.params;
        const { questions } = req.body;

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(400).json({ message: 'Questions array is required' });
        }

        const [templates] = await db.query(
            `SELECT id FROM AssessmentTemplates WHERE id = ?`,
            [templateId]
        );
        if (templates.length === 0) {
            return res.status(404).json({ message: 'Template not found' });
        }

        const insertPromises = questions.map((q, index) => {
            if (!q.question_text || !q.question_type) {
                throw new Error('Question text and type are required');
            }
            if (!['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER'].includes(q.question_type)) {
                throw new Error('Invalid question type');
            }

            return db.query(
                `INSERT INTO AssessmentQuestions
                (template_id, question_text, question_type, options, correct_answer, points, order_index)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    templateId,
                    q.question_text.trim(),
                    q.question_type,
                    q.options ? JSON.stringify(q.options) : null,
                    q.correct_answer?.trim() || null,
                    q.points || 1,
                    q.order_index !== undefined ? q.order_index : index
                ]
            );
        });

        await Promise.all(insertPromises);

        res.status(201).json({ message: 'Questions added successfully' });
    } catch (error) {
        console.error('Error adding questions:', error);
        res.status(500).json({ message: error.message || 'Failed to add questions' });
    }
});

router.put('/questions/:id', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { question_text, question_type, options, correct_answer, points, order_index } = req.body;

        await db.query(
            `UPDATE AssessmentQuestions
            SET question_text = ?, question_type = ?, options = ?, correct_answer = ?, points = ?, order_index = ?
            WHERE id = ?`,
            [
                question_text?.trim(),
                question_type,
                options ? JSON.stringify(options) : null,
                correct_answer?.trim() || null,
                points,
                order_index,
                id
            ]
        );

        res.json({ message: 'Question updated successfully' });
    } catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json({ message: 'Failed to update question' });
    }
});

router.delete('/questions/:id', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(`DELETE FROM AssessmentQuestions WHERE id = ?`, [id]);

        res.json({ message: 'Question deleted successfully' });
    } catch (error) {
        console.error('Error deleting question:', error);
        res.status(500).json({ message: 'Failed to delete question' });
    }
});

router.post('/jobs/:jobId/link', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { jobId } = req.params;
        const { template_id, is_required, deadline_hours } = req.body;

        if (!template_id) {
            return res.status(400).json({ message: 'Template ID is required' });
        }

        const [existing] = await db.query(
            `SELECT id FROM JobAssessments WHERE job_id = ? AND template_id = ?`,
            [jobId, template_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({ message: 'Assessment already linked to this job' });
        }

        await db.query(
            `INSERT INTO JobAssessments (job_id, template_id, is_required, deadline_hours)
            VALUES (?, ?, ?, ?)`,
            [jobId, template_id, is_required !== false, deadline_hours || 48]
        );

        res.status(201).json({ message: 'Assessment linked to job' });
    } catch (error) {
        console.error('Error linking assessment:', error);
        res.status(500).json({ message: 'Failed to link assessment' });
    }
});

router.get('/jobs/:jobId', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { jobId } = req.params;

        const [assessments] = await db.query(
            `SELECT 
                ja.id as job_assessment_id,
                ja.is_required,
                ja.deadline_hours,
                t.id as template_id,
                t.title,
                t.description,
                t.duration_minutes,
                t.passing_score,
                COUNT(q.id) as question_count
            FROM JobAssessments ja
            JOIN AssessmentTemplates t ON ja.template_id = t.id
            LEFT JOIN AssessmentQuestions q ON t.id = q.template_id
            WHERE ja.job_id = ?
            GROUP BY ja.id`,
            [jobId]
        );

        res.json({ assessments });
    } catch (error) {
        console.error('Error fetching job assessments:', error);
        res.status(500).json({ message: 'Failed to fetch assessments' });
    }
});


router.delete('/jobs/:jobId/link/:templateId', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { jobId, templateId } = req.params;

        await db.query(
            `DELETE FROM JobAssessments WHERE job_id = ? AND template_id = ?`,
            [jobId, templateId]
        );

        res.json({ message: 'Assessment unlinked from job' });
    } catch (error) {
        console.error('Error unlinking assessment:', error);
        res.status(500).json({ message: 'Failed to unlink assessment' });
    }
});

router.get('/applications/:applicationId/results', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { applicationId } = req.params;

        const [results] = await db.query(
            `SELECT 
                ca.id,
                ca.status,
                ca.started_at,
                ca.submitted_at,
                ca.deadline_at,
                ca.score,
                ca.max_score,
                ca.earned_score,
                ca.passed,
                ca.time_taken_minutes,
                t.title as template_title,
                t.duration_minutes,
                t.passing_score
            FROM CandidateAssessments ca
            JOIN AssessmentTemplates t ON ca.template_id = t.id
            WHERE ca.application_id = ?
            ORDER BY ca.created_at ASC`,
            [applicationId]
        );

        for (const result of results) {
            const [answers] = await db.query(
                `SELECT 
                    ca.id as answer_id,
                    ca.answer_text,
                    ca.is_correct,
                    ca.points_earned,
                    q.id as question_id,
                    q.question_text,
                    q.question_type,
                    q.correct_answer,
                    q.points,
                    q.order_index
                FROM CandidateAnswers ca
                JOIN AssessmentQuestions q ON ca.question_id = q.id
                WHERE ca.candidate_assessment_id = ?
                ORDER BY q.order_index ASC`,
                [result.id]
            );
            result.answers = answers;
        }

        res.json({ results });
    } catch (error) {
        console.error('Error fetching assessment results:', error);
        res.status(500).json({ message: 'Failed to fetch results' });
    }
});

router.get('/:assessmentId/grading', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { assessmentId } = req.params;

        const [assessments] = await db.query(
            `SELECT 
                ca.id,
                ca.status,
                ca.submitted_at,
                ca.score,
                ca.max_score,
                ca.earned_score,
                ca.passed,
                t.title as template_title,
                t.passing_score,
                a.candidate_id,
                u.name as candidate_name,
                u.email as candidate_email
            FROM CandidateAssessments ca
            JOIN AssessmentTemplates t ON ca.template_id = t.id
            JOIN Applications a ON ca.application_id = a.id
            JOIN Users u ON a.candidate_id = u.id
            WHERE ca.id = ?`,
            [assessmentId]
        );

        if (assessments.length === 0) {
            return res.status(404).json({ message: 'Assessment not found' });
        }

        const assessment = assessments[0];

        const [answers] = await db.query(
            `SELECT 
                ca.id as answer_id,
                ca.answer_text,
                ca.is_correct,
                ca.points_earned,
                ca.graded_by,
                ca.graded_at,
                ca.grader_note,
                q.id as question_id,
                q.question_text,
                q.question_type,
                q.correct_answer,
                q.points,
                q.order_index
            FROM CandidateAnswers ca
            JOIN AssessmentQuestions q ON ca.question_id = q.id
            WHERE ca.candidate_assessment_id = ?
            ORDER BY q.order_index ASC`,
            [assessmentId]
        );

        res.json({
            assessment,
            answers
        });
    } catch (error) {
        console.error('Error fetching assessment for grading:', error);
        res.status(500).json({ message: 'Failed to fetch assessment details' });
    }
});


router.post('/:assessmentId/grade', authenticate, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { grades } = req.body; 
        const graderId = req.user.userId;

        if (!grades || typeof grades !== 'object') {
            return res.status(400).json({ message: 'Grades object is required' });
        }

        const [assessments] = await db.query(
            `SELECT ca.id, ca.template_id, ca.application_id
            FROM CandidateAssessments ca
            WHERE ca.id = ?`,
            [assessmentId]
        );

        if (assessments.length === 0) {
            return res.status(404).json({ message: 'Assessment not found' });
        }

        for (const [answerId, grade] of Object.entries(grades)) {
            const { points_earned, is_correct, grader_note } = grade;

            await db.query(
                `UPDATE CandidateAnswers
                SET is_correct = ?, 
                    points_earned = ?,
                    graded_by = ?,
                    graded_at = NOW(),
                    grader_note = ?
                WHERE id = ? AND candidate_assessment_id = ?`,
                [
                    is_correct,
                    points_earned || 0,
                    graderId,
                    grader_note?.trim() || null,
                    answerId,
                    assessmentId
                ]
            );
        }

        const [answers] = await db.query(
            `SELECT 
                SUM(points_earned) as total_earned,
                SUM(q.points) as total_max
            FROM CandidateAnswers ca
            JOIN AssessmentQuestions q ON ca.question_id = q.id
            WHERE ca.candidate_assessment_id = ?`,
            [assessmentId]
        );

        const earnedScore = answers[0].total_earned || 0;
        const maxScore = answers[0].total_max || 1;
        const scorePercentage = (earnedScore / maxScore) * 100;

        const [templateInfo] = await db.query(
            `SELECT t.passing_score
            FROM CandidateAssessments ca
            JOIN AssessmentTemplates t ON ca.template_id = t.id
            WHERE ca.id = ?`,
            [assessmentId]
        );

        const passingScore = templateInfo[0]?.passing_score || 70;
        const passed = scorePercentage >= passingScore;

        await db.query(
            `UPDATE CandidateAssessments
            SET score = ?,
                earned_score = ?,
                max_score = ?,
                passed = ?
            WHERE id = ?`,
            [scorePercentage, earnedScore, maxScore, passed, assessmentId]
        );

        res.json({
            message: 'Assessment graded successfully',
            score: scorePercentage,
            passed,
            earned_score: earnedScore,
            max_score: maxScore
        });
    } catch (error) {
        console.error('Error grading assessment:', error);
        res.status(500).json({ message: 'Failed to grade assessment' });
    }
});


router.get('/me', authenticate, authorize('CANDIDATE'), async (req, res) => {
    try {
        const candidateId = req.user.userId; 

        const [assessments] = await db.query(
            `SELECT 
                ca.id,
                ca.status,
                ca.deadline_at,
                ca.score,
                ca.passed,
                ca.submitted_at,
                t.title as assessment_title,
                t.description,
                t.duration_minutes,
                t.passing_score,
                j.title as job_title,
                j.id as job_id,
                a.id as application_id
            FROM CandidateAssessments ca
            JOIN AssessmentTemplates t ON ca.template_id = t.id
            JOIN Applications a ON ca.application_id = a.id
            JOIN Jobs j ON a.job_id = j.id
            WHERE a.candidate_id = ?
            ORDER BY ca.deadline_at ASC, ca.created_at DESC`,
            [candidateId]
        );

        res.json({ assessments });
    } catch (error) {
        console.error('Error fetching candidate assessments:', error);
        res.status(500).json({ message: 'Failed to fetch assessments' });
    }
});

 
router.get('/:assessmentId/start', authenticate, authorize('CANDIDATE'), async (req, res) => {
    try {
        console.log('=== START ASSESSMENT REQUEST ===');
        const { assessmentId } = req.params;
        const candidateId = req.user.userId; 
        console.log(`Assessment ID: ${assessmentId}, Candidate ID: ${candidateId}`);

        const [assessments] = await db.query(
            `SELECT ca.*, a.candidate_id, t.duration_minutes
            FROM CandidateAssessments ca
            JOIN Applications a ON ca.application_id = a.id
            JOIN AssessmentTemplates t ON ca.template_id = t.id
            WHERE ca.id = ? AND a.candidate_id = ?`,
            [assessmentId, candidateId]
        );

        console.log(`Assessments found: ${assessments.length}`);
        if (assessments.length === 0) {
            console.log('Assessment not found');
            return res.status(404).json({ message: 'Assessment not found' });
        }

        const assessment = assessments[0];
        console.log(`Assessment status: ${assessment.status}`);

        if (assessment.status === 'COMPLETED' || assessment.status === 'GRADED') {
            console.log('Assessment already completed/graded');
            return res.status(400).json({ message: 'Assessment has already been submitted' });
        }

        if (assessment.deadline_at && new Date(assessment.deadline_at) < new Date()) {
            console.log('Assessment deadline passed');
            return res.status(400).json({ message: 'Assessment deadline has passed' });
        }

        let isResume = false;
        if (assessment.status === 'IN_PROGRESS') {
            console.log('Resuming in-progress assessment');
            isResume = true;
        } else if (assessment.status === 'PENDING') {
            console.log('Starting new assessment');
            await db.query(
                `UPDATE CandidateAssessments
                SET status = 'IN_PROGRESS', started_at = NOW()
                WHERE id = ?`,
                [assessmentId]
            );
            console.log('Status updated to IN_PROGRESS');
        } else {
            console.log('Invalid assessment status:', assessment.status);
            return res.status(400).json({ message: 'Assessment cannot be started' });
        }

        console.log(`Fetching questions for template ${assessment.template_id}...`);
        const [questions] = await db.query(
            `SELECT id, question_text, question_type, options, points, order_index
            FROM AssessmentQuestions
            WHERE template_id = ?
            ORDER BY order_index ASC`,
            [assessment.template_id]
        );
        console.log(`Found ${questions.length} questions`);

        console.log(`Found ${questions.length} questions`);

        console.log('Parsing options...');
        const questionsWithParsedOptions = questions.map(q => {
            let parsedOptions = null;
            if (q.options) {
                if (Array.isArray(q.options)) {
                    parsedOptions = q.options;
                    console.log(`Question ${q.id}: Already an array`);
                } else if (typeof q.options === 'object') {
                    parsedOptions = q.options;
                    console.log(`Question ${q.id}: Already an object`);
                } else if (typeof q.options === 'string') {
                    console.log(`Question ${q.id}: String type, parsing...`);
                    try {
                        parsedOptions = JSON.parse(q.options);
                        console.log(`Question ${q.id}: Parsed successfully`);
                    } catch (error) {
                        console.error(`Invalid JSON in question ${q.id} options:`, q.options);
                        console.error(`Parse error:`, error.message);
                        parsedOptions = (q.question_type === 'MULTIPLE_CHOICE' || q.question_type === 'TRUE_FALSE') ? [] : null;
                    }
                }
            }
            return {
                ...q,
                options: parsedOptions
            };
        });
        console.log('Options parsed successfully');

        let timeRemaining = null;
        if (isResume && assessment.started_at) {
            const startedAt = new Date(assessment.started_at);
            const now = new Date();
            const elapsedMinutes = (now - startedAt) / (1000 * 60);
            const remainingMinutes = Math.max(0, assessment.duration_minutes - elapsedMinutes);
            timeRemaining = Math.floor(remainingMinutes * 60);
            console.log(`Resume: Elapsed ${elapsedMinutes.toFixed(1)} min, Remaining ${remainingMinutes.toFixed(1)} min`);
        }

        console.log('Sending response...');
        res.json({
            assessment: {
                id: assessment.id,
                duration_minutes: assessment.duration_minutes,
                deadline_at: assessment.deadline_at,
                started_at: assessment.started_at,
                is_resume: isResume,
                time_remaining_seconds: timeRemaining
            },
            questions: questionsWithParsedOptions
        });
        console.log('=== Response sent successfully ===');
    } catch (error) {
        console.error('=== Error starting assessment ===');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
        res.status(500).json({ message: 'Failed to start assessment' });
    }
});


router.post('/:assessmentId/submit', authenticate, authorize('CANDIDATE'), async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const { answers } = req.body; 
        const candidateId = req.user.userId; 

        if (!answers || typeof answers !== 'object') {
            return res.status(400).json({ message: 'Answers are required' });
        }

        const [assessments] = await db.query(
            `SELECT ca.*, a.candidate_id, t.passing_score
            FROM CandidateAssessments ca
            JOIN Applications a ON ca.application_id = a.id
            JOIN AssessmentTemplates t ON ca.template_id = t.id
            WHERE ca.id = ? AND a.candidate_id = ?`,
            [assessmentId, candidateId]
        );

        if (assessments.length === 0) {
            return res.status(404).json({ message: 'Assessment not found' });
        }

        const assessment = assessments[0];

        if (assessment.status !== 'IN_PROGRESS') {
            return res.status(400).json({ message: 'Assessment is not in progress' });
        }

        const [questions] = await db.query(
            `SELECT id, question_type, correct_answer, points
            FROM AssessmentQuestions
            WHERE template_id = ?`,
            [assessment.template_id]
        );

        await db.query(
            `DELETE FROM CandidateAnswers WHERE candidate_assessment_id = ?`,
            [assessmentId]
        );

        let totalPoints = 0;
        let earnedPoints = 0;

        for (const question of questions) {
            totalPoints += question.points;

            const candidateAnswer = answers[question.id] || '';
            let isCorrect = false;
            let pointsEarned = 0;

            if (question.question_type === 'MULTIPLE_CHOICE' || question.question_type === 'TRUE_FALSE') {
                isCorrect = candidateAnswer.trim().toLowerCase() === question.correct_answer?.trim().toLowerCase();
                pointsEarned = isCorrect ? question.points : 0;
            } else if (question.question_type === 'SHORT_ANSWER') {
                isCorrect = null;
                pointsEarned = 0;
            }

            earnedPoints += pointsEarned;

            await db.query(
                `INSERT INTO CandidateAnswers (candidate_assessment_id, question_id, answer_text, is_correct, points_earned)
                VALUES (?, ?, ?, ?, ?)`,
                [assessmentId, question.id, candidateAnswer, isCorrect, pointsEarned]
            );
        }

        const scorePercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
        const passed = scorePercentage >= assessment.passing_score;

        const startedAt = new Date(assessment.started_at);
        const now = new Date();
        const timeTakenMinutes = Math.round((now - startedAt) / 1000 / 60);

        await db.query(
            `UPDATE CandidateAssessments
            SET status = 'GRADED',
                submitted_at = NOW(),
                score = ?,
                max_score = ?,
                earned_score = ?,
                passed = ?,
                time_taken_minutes = ?
            WHERE id = ?`,
            [scorePercentage, totalPoints, earnedPoints, passed, timeTakenMinutes, assessmentId]
        );

        await db.query(
            `INSERT INTO ApplicationEvents 
            (application_id, actor_type, actor_user_id, event_type, title, note, visible_to_candidate)
            VALUES (?, 'CANDIDATE', ?, 'ASSESSMENT_COMPLETED', 'Skills assessment completed', ?, true)`,
            [
                assessment.application_id,
                candidateId,
                `Score: ${scorePercentage.toFixed(1)}% (${passed ? 'Passed' : 'Failed'})`
            ]
        );

        res.json({
            message: 'Assessment submitted successfully',
            score: scorePercentage,
            passed,
            earned_score: earnedPoints,
            max_score: totalPoints
        });
    } catch (error) {
        console.error('Error submitting assessment:', error);
        res.status(500).json({ message: 'Failed to submit assessment' });
    }
});


router.get('/:assessmentId/result', authenticate, authorize('CANDIDATE'), async (req, res) => {
    try {
        const { assessmentId } = req.params;
        const candidateId = req.user.userId; 

        const [assessments] = await db.query(
            `SELECT ca.*, t.title, t.passing_score, a.candidate_id
            FROM CandidateAssessments ca
            JOIN AssessmentTemplates t ON ca.template_id = t.id
            JOIN Applications a ON ca.application_id = a.id
            WHERE ca.id = ? AND a.candidate_id = ?`,
            [assessmentId, candidateId]
        );

        if (assessments.length === 0) {
            return res.status(404).json({ message: 'Assessment not found' });
        }

        const assessment = assessments[0];

        if (assessment.status !== 'GRADED') {
            return res.status(400).json({ message: 'Assessment has not been graded yet' });
        }

        const [answers] = await db.query(
            `SELECT 
                ca.answer_text,
                ca.is_correct,
                ca.points_earned,
                q.question_text,
                q.question_type,
                q.points
            FROM CandidateAnswers ca
            JOIN AssessmentQuestions q ON ca.question_id = q.id
            WHERE ca.candidate_assessment_id = ?
            ORDER BY q.order_index`,
            [assessmentId]
        );

        res.json({
            assessment: {
                title: assessment.title,
                score: assessment.score,
                passed: assessment.passed,
                max_score: assessment.max_score,
                earned_score: assessment.earned_score,
                time_taken_minutes: assessment.time_taken_minutes,
                submitted_at: assessment.submitted_at,
                passing_score: assessment.passing_score
            },
            answers
        });
    } catch (error) {
        console.error('Error fetching result:', error);
        res.status(500).json({ message: 'Failed to fetch result' });
    }
});

module.exports = router;
