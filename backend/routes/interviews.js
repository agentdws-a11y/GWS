const express = require('express');
const pool = require('../db');
const authenticateToken = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

const toSqlDateTime = (v) => String(v).replace('T', ' ').slice(0, 19);

const nn = (v) => (v === undefined || v === '' ? null : v);

async function createApplicationEvent(connection, applicationId, actorType, actorUserId, eventType, title, note, visibleToCandidate = false) {
    await connection.execute(
        `INSERT INTO ApplicationEvents 
            (application_id, actor_type, actor_user_id, event_type, title, note, visible_to_candidate) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [applicationId, actorType, actorUserId, eventType, title, note, visibleToCandidate]
    );
}


router.post('/hr/applications/:id/offer', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const applicationId = req.params.id;
        const {
            round_name,
            duration_minutes,
            mode,
            meeting_link,
            location,
            panel_member_ids, 
            slots 
        } = req.body;

        if (!round_name || !duration_minutes || !mode || !panel_member_ids || !slots) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Round name, duration, mode, panel members, and slots are required'
            });
        }

        if (!['ZOOM', 'ONSITE'].includes(mode)) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Mode must be ZOOM or ONSITE'
            });
        }

        if (mode === 'ZOOM' && !meeting_link) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Meeting link is required for Zoom interviews'
            });
        }

        if (mode === 'ONSITE' && !location) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Location is required for on-site interviews'
            });
        }

        if (!Array.isArray(panel_member_ids) || panel_member_ids.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                message: 'At least one panel member is required'
            });
        }

        if (!Array.isArray(slots) || slots.length === 0 || slots.length > 5) {
            await connection.rollback();
            return res.status(400).json({
                message: 'You must offer between 1 and 5 time slots'
            });
        }

        const [applications] = await connection.execute(
            'SELECT id, stage, current_round FROM Applications WHERE id = ?',
            [applicationId]
        );

        if (applications.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        const application = applications[0];

        if (application.stage !== 'SHORTLISTED') {
            await connection.rollback();
            return res.status(400).json({
                message: `Can only offer interview slots to SHORTLISTED applications. Current stage: ${application.stage}`
            });
        }

        const round_number = application.current_round;

        await connection.execute(
            `DELETE FROM Interviews WHERE application_id = ? AND round_number = ? AND status IN ('CANCELLED','EXPIRED')`,
            [applicationId, round_number]
        );

        for (const userId of panel_member_ids) {
            const [users] = await connection.execute(
                'SELECT id, role FROM Users WHERE id = ? AND role = ?',
                [userId, 'HR_ADMIN']
            );

            if (users.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    message: `User ${userId} is not an HR admin or does not exist`
                });
            }
        }

        const now = new Date();
        const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);

        for (const slot of slots) {
            const slotStart = new Date(slot.start_time);
            const slotEnd = new Date(slot.end_time);

            if (isNaN(slotStart.getTime()) || isNaN(slotEnd.getTime())) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Invalid slot time format'
                });
            }

            if (slotStart < twelveHoursFromNow) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'All slots must be at least 12 hours in the future'
                });
            }

            if (slotEnd <= slotStart) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Slot end time must be after start time'
                });
            }
        }

        const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const earliestSlot = new Date(Math.min(...slots.map(s => new Date(s.start_time).getTime())));
        const twelveHoursBeforeEarliestSlot = new Date(earliestSlot.getTime() - 12 * 60 * 60 * 1000);
        const offer_expires_at = fortyEightHoursFromNow < twelveHoursBeforeEarliestSlot 
            ? fortyEightHoursFromNow 
            : twelveHoursBeforeEarliestSlot;

        const [interviewResult] = await connection.execute(
            `INSERT INTO Interviews 
                (application_id, round_number, round_name, duration_minutes, mode, meeting_link, location, 
                 status, offered_at, offer_expires_at, created_by) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
            [
                applicationId,
                round_number,
                round_name,
                duration_minutes,
                mode,
                mode === 'ZOOM' ? meeting_link : null,
                mode === 'ONSITE' ? location : null,
                'SLOTS_OFFERED',
                offer_expires_at,
                req.user.userId
            ]
        );

        const interviewId = interviewResult.insertId;

        for (const slot of slots) {
            await connection.execute(
                'INSERT INTO InterviewSlots (interview_id, start_time, end_time, is_chosen) VALUES (?, ?, ?, ?)',
                [interviewId, toSqlDateTime(slot.start_time), toSqlDateTime(slot.end_time), false]
            );
        }

        for (const userId of panel_member_ids) {
            await connection.execute(
                'INSERT INTO InterviewPanelMembers (interview_id, hr_user_id) VALUES (?, ?)',
                [interviewId, userId]
            );
        }

        await connection.execute(
            'UPDATE Applications SET stage = ? WHERE id = ?',
            ['SLOTS_OFFERED', applicationId]
        );

        await createApplicationEvent(
            connection,
            applicationId,
            'HR',
            req.user.userId,
            'SLOTS_OFFERED',
            `Interview slots offered for ${round_name}`,
            `${slots.length} time slots offered, expires at ${offer_expires_at.toISOString()}`,
            true
        );

        await connection.commit();

        res.status(201).json({
            message: 'Interview slots offered successfully',
            interviewId: interviewId,
            offer_expires_at: offer_expires_at
        });

    } catch (error) {
        await connection.rollback();
        console.error('Offer interview slots error:', error);
        
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'Interview already exists for this round'
            });
        }
        
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.get('/hr/:id', authenticateToken, authorize('HR_ADMIN'), async (req, res, next) => {
    if (req.params.id === 'panel-members') return next();
    try {
        const { id } = req.params;

        const [interviews] = await pool.execute(
            `SELECT 
                i.id,
                i.application_id,
                i.round_number,
                i.round_name,
                i.duration_minutes,
                i.mode,
                i.meeting_link,
                i.location,
                i.notes,
                i.scheduled_start,
                i.scheduled_end,
                i.offered_at,
                i.offer_expires_at,
                i.confirmed_at,
                i.status,
                i.cancelled_reason,
                i.created_by,
                i.created_at,
                a.candidate_id,
                a.job_id,
                a.stage as application_stage,
                u.name as candidate_name,
                u.email as candidate_email,
                j.title as job_title
            FROM Interviews i
            JOIN Applications a ON i.application_id = a.id
            JOIN Users u ON a.candidate_id = u.id
            JOIN Jobs j ON a.job_id = j.id
            WHERE i.id = ?`,
            [id]
        );

        if (interviews.length === 0) {
            return res.status(404).json({
                message: 'Interview not found'
            });
        }

        const interview = interviews[0];

        const [slots] = await pool.execute(
            'SELECT id, start_time, end_time, is_chosen FROM InterviewSlots WHERE interview_id = ? ORDER BY start_time ASC',
            [id]
        );

        const [panelMembers] = await pool.execute(
            `SELECT 
                u.id,
                u.name,
                u.email
            FROM InterviewPanelMembers ipm
            JOIN Users u ON ipm.hr_user_id = u.id
            WHERE ipm.interview_id = ?`,
            [id]
        );

        const [feedbackStatus] = await pool.execute(
            `SELECT 
                COUNT(*) as total_feedback,
                SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) as submitted_feedback
            FROM InterviewFeedback
            WHERE interview_id = ?`,
            [id]
        );

        interview.slots = slots;
        interview.panel_members = panelMembers;
        interview.feedback_submitted = feedbackStatus[0]?.submitted_feedback || 0;
        interview.feedback_total = panelMembers.length;

        res.json({
            interview
        });

    } catch (error) {
        console.error('Get interview error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.get('/hr', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { status, job_id, round, from_date, to_date } = req.query;

        let query = `
            SELECT 
                i.id,
                i.application_id,
                i.round_number,
                i.round_name,
                i.duration_minutes,
                i.mode,
                i.scheduled_start,
                i.status,
                i.offered_at,
                i.offer_expires_at,
                a.candidate_id,
                a.job_id,
                a.stage as application_stage,
                u.name as candidate_name,
                j.title as job_title,
                ai.match_percent,
                (SELECT COUNT(*) FROM InterviewSlots s WHERE s.interview_id = i.id) AS slot_count
            FROM Interviews i
            JOIN Applications a ON i.application_id = a.id
            JOIN Users u ON a.candidate_id = u.id
            JOIN Jobs j ON a.job_id = j.id
            LEFT JOIN AIScores ai ON ai.application_id = a.id
            WHERE 1=1
        `;

        const params = [];

        if (status) {
            query += ' AND i.status = ?';
            params.push(status);
        }

        if (job_id) {
            query += ' AND a.job_id = ?';
            params.push(job_id);
        }

        if (round) {
            query += ' AND i.round_number = ?';
            params.push(round);
        }

        if (from_date) {
            query += ' AND (i.scheduled_start >= ? OR i.offered_at >= ?)';
            params.push(from_date, from_date);
        }

        if (to_date) {
            query += ' AND (i.scheduled_start <= ? OR i.offered_at <= ?)';
            params.push(to_date, to_date);
        }

        query += ' ORDER BY COALESCE(i.scheduled_start, i.offered_at) DESC';

        const [interviews] = await pool.execute(query, params);

        for (const interview of interviews) {
            const [panelMembers] = await pool.execute(
                `SELECT 
                    u.id,
                    u.name
                FROM InterviewPanelMembers ipm
                JOIN Users u ON ipm.hr_user_id = u.id
                WHERE ipm.interview_id = ?`,
                [interview.id]
            );
            interview.panel = panelMembers;

            const [feedbackStatus] = await pool.execute(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) as submitted
                FROM InterviewFeedback
                WHERE interview_id = ?`,
                [interview.id]
            );

            interview.feedback_submitted = feedbackStatus[0]?.submitted || 0;
            interview.feedback_total = panelMembers.length;

            if (interview.status === 'SLOTS_OFFERED') {
                const slotsCount = await pool.execute(
                    'SELECT COUNT(*) as count FROM InterviewSlots WHERE interview_id = ?',
                    [interview.id]
                );
                interview.display_status = `${slotsCount[0][0].count} slots offered · Reply pending`;
            } else if (interview.status === 'SCHEDULED') {
                if (interview.feedback_submitted < interview.feedback_total) {
                    interview.display_status = `Feedback pending (${interview.feedback_submitted} of ${interview.feedback_total})`;
                } else {
                    interview.display_status = 'Feedback added';
                }
            } else if (interview.status === 'COMPLETED') {
                interview.display_status = 'Completed';
            } else if (interview.status === 'CANCELLED') {
                interview.display_status = 'Cancelled';
            } else if (interview.status === 'EXPIRED') {
                interview.display_status = 'Offer expired';
            }
        }

        res.json({
            interviews
        });

    } catch (error) {
        console.error('Get interviews error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.get('/hr/panel-members', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const [users] = await pool.execute(
            `SELECT 
                id,
                name,
                email
            FROM Users
            WHERE role = 'HR_ADMIN'
            ORDER BY name ASC`
        );

        res.json({
            panelMembers: users
        });

    } catch (error) {
        console.error('Get panel members error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.put('/hr/:id/slots', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const interviewId = req.params.id;
        const { slots } = req.body; 

        if (!Array.isArray(slots) || slots.length === 0 || slots.length > 5) {
            await connection.rollback();
            return res.status(400).json({
                message: 'You must offer between 1 and 5 time slots'
            });
        }

        const [interviews] = await connection.execute(
            'SELECT id, application_id, status FROM Interviews WHERE id = ?',
            [interviewId]
        );

        if (interviews.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Interview not found'
            });
        }

        if (interviews[0].status !== 'SLOTS_OFFERED') {
            await connection.rollback();
            return res.status(400).json({
                message: 'Can only re-offer slots for interviews in SLOTS_OFFERED status'
            });
        }

        const now = new Date();
        const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);

        for (const slot of slots) {
            const slotStart = new Date(slot.start_time);
            if (slotStart < twelveHoursFromNow) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'All slots must be at least 12 hours in the future'
                });
            }
        }

        await connection.execute(
            'DELETE FROM InterviewSlots WHERE interview_id = ?',
            [interviewId]
        );

        for (const slot of slots) {
            await connection.execute(
                'INSERT INTO InterviewSlots (interview_id, start_time, end_time, is_chosen) VALUES (?, ?, ?, ?)',
                [interviewId, toSqlDateTime(slot.start_time), toSqlDateTime(slot.end_time), false]
            );
        }

        const fortyEightHoursFromNow = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        const earliestSlot = new Date(Math.min(...slots.map(s => new Date(s.start_time).getTime())));
        const twelveHoursBeforeEarliestSlot = new Date(earliestSlot.getTime() - 12 * 60 * 60 * 1000);
        const offer_expires_at = fortyEightHoursFromNow < twelveHoursBeforeEarliestSlot 
            ? fortyEightHoursFromNow 
            : twelveHoursBeforeEarliestSlot;

        await connection.execute(
            'UPDATE Interviews SET offer_expires_at = ?, offered_at = NOW() WHERE id = ?',
            [offer_expires_at, interviewId]
        );

        await connection.commit();

        res.json({
            message: 'Interview slots updated successfully',
            offer_expires_at: offer_expires_at
        });

    } catch (error) {
        await connection.rollback();
        console.error('Update slots error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.post('/hr/:id/cancel', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const interviewId = req.params.id;
        const { reason } = req.body;

        const [interviews] = await connection.execute(
            'SELECT id, application_id, status, round_name FROM Interviews WHERE id = ?',
            [interviewId]
        );

        if (interviews.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Interview not found'
            });
        }

        const interview = interviews[0];

        if (interview.status !== 'SCHEDULED') {
            await connection.rollback();
            return res.status(400).json({
                message: 'Can only cancel SCHEDULED interviews'
            });
        }

        const applicationId = interview.application_id;

        await connection.execute(
            'UPDATE Interviews SET status = ?, cancelled_reason = ? WHERE id = ?',
            ['CANCELLED', reason || 'Interview cancelled by HR', interviewId]
        );

        await connection.execute(
            'UPDATE Applications SET stage = ? WHERE id = ?',
            ['SHORTLISTED', applicationId]
        );

        await createApplicationEvent(
            connection,
            applicationId,
            'HR',
            req.user.userId,
            'INTERVIEW_CANCELLED',
            `${interview.round_name} cancelled`,
            nn(reason),
            true
        );

        await connection.commit();

        res.json({
            message: 'Interview cancelled successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Cancel interview error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.post('/hr/:id/withdraw', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const interviewId = req.params.id;

        const [interviews] = await connection.execute(
            'SELECT id, application_id, status FROM Interviews WHERE id = ?',
            [interviewId]
        );

        if (interviews.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Interview not found'
            });
        }

        if (interviews[0].status !== 'SLOTS_OFFERED') {
            await connection.rollback();
            return res.status(400).json({
                message: 'Can only withdraw offers in SLOTS_OFFERED status'
            });
        }

        const applicationId = interviews[0].application_id;

        await connection.execute(
            'UPDATE Interviews SET status = ?, cancelled_reason = ? WHERE id = ?',
            ['CANCELLED', 'Offer withdrawn by HR', interviewId]
        );

        await connection.execute(
            'UPDATE Applications SET stage = ? WHERE id = ?',
            ['SHORTLISTED', applicationId]
        );

        await createApplicationEvent(
            connection,
            applicationId,
            'HR',
            req.user.userId,
            'OFFER_WITHDRAWN',
            'Interview offer withdrawn',
            null,
            false 
        );

        await connection.commit();

        res.json({
            message: 'Interview offer withdrawn successfully'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Withdraw offer error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});


router.get('/me', authenticateToken, authorize('CANDIDATE'), async (req, res) => {
    try {
        const candidateId = req.user.userId;

        const [interviews] = await pool.execute(
            `SELECT 
                i.id,
                i.application_id,
                i.round_number,
                i.round_name,
                i.duration_minutes,
                i.mode,
                i.meeting_link,
                i.location,
                i.scheduled_start,
                i.scheduled_end,
                i.offered_at,
                i.offer_expires_at,
                i.confirmed_at,
                i.status,
                a.job_id,
                a.stage as application_stage,
                j.title as job_title
            FROM Interviews i
            JOIN Applications a ON i.application_id = a.id
            JOIN Jobs j ON a.job_id = j.id
            WHERE a.candidate_id = ?
            ORDER BY COALESCE(i.scheduled_start, i.offered_at) ASC`,
            [candidateId]
        );

        for (const interview of interviews) {
            const [slots] = await pool.execute(
                'SELECT id, start_time, end_time, is_chosen FROM InterviewSlots WHERE interview_id = ? ORDER BY start_time ASC',
                [interview.id]
            );
            interview.slots = slots;

            const [panelMembers] = await pool.execute(
                `SELECT 
                    u.id,
                    u.name
                FROM InterviewPanelMembers ipm
                JOIN Users u ON ipm.hr_user_id = u.id
                WHERE ipm.interview_id = ?`,
                [interview.id]
            );
            interview.panel = panelMembers;
        }

        const needsReply = [];
        const upcoming = [];
        const past = [];
        const now = new Date();

        for (const interview of interviews) {
            if (interview.status === 'SLOTS_OFFERED') {
                needsReply.push(interview);
            } else if (interview.status === 'SCHEDULED' && new Date(interview.scheduled_start) > now) {
                upcoming.push(interview);
            } else if (interview.status === 'COMPLETED' || interview.status === 'CANCELLED' || 
                       (interview.status === 'SCHEDULED' && new Date(interview.scheduled_end) < now)) {
                past.push(interview);
            }
        }

        res.json({
            needsReply,
            upcoming,
            past
        });

    } catch (error) {
        console.error('Get candidate interviews error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.get('/me/:id', authenticateToken, authorize('CANDIDATE'), async (req, res) => {
    try {
        const { id } = req.params;
        const candidateId = req.user.userId;

        const [interviews] = await pool.execute(
            `SELECT 
                i.id,
                i.application_id,
                i.round_number,
                i.round_name,
                i.duration_minutes,
                i.mode,
                i.meeting_link,
                i.location,
                i.scheduled_start,
                i.scheduled_end,
                i.offered_at,
                i.offer_expires_at,
                i.confirmed_at,
                i.status,
                a.job_id,
                a.candidate_id,
                a.stage as application_stage,
                j.title as job_title
            FROM Interviews i
            JOIN Applications a ON i.application_id = a.id
            JOIN Jobs j ON a.job_id = j.id
            WHERE i.id = ? AND a.candidate_id = ?`,
            [id, candidateId]
        );

        if (interviews.length === 0) {
            return res.status(404).json({
                message: 'Interview not found'
            });
        }

        const interview = interviews[0];

        const [slots] = await pool.execute(
            'SELECT id, start_time, end_time, is_chosen FROM InterviewSlots WHERE interview_id = ? ORDER BY start_time ASC',
            [id]
        );
        interview.slots = slots;

        const [panelMembers] = await pool.execute(
            `SELECT 
                u.id,
                u.name
            FROM InterviewPanelMembers ipm
            JOIN Users u ON ipm.hr_user_id = u.id
            WHERE ipm.interview_id = ?`,
            [id]
        );
        interview.panel = panelMembers;

        res.json({
            interview
        });

    } catch (error) {
        console.error('Get interview detail error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.post('/me/:id/confirm', authenticateToken, authorize('CANDIDATE'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const interviewId = req.params.id;
        const { slot_id } = req.body;
        const candidateId = req.user.userId;

        if (!slot_id) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Slot ID is required'
            });
        }

        const [interviews] = await connection.execute(
            `SELECT 
                i.id,
                i.application_id,
                i.status,
                i.round_name,
                i.offer_expires_at,
                a.candidate_id
            FROM Interviews i
            JOIN Applications a ON i.application_id = a.id
            WHERE i.id = ? AND a.candidate_id = ?
            FOR UPDATE`,
            [interviewId, candidateId]
        );

        if (interviews.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Interview not found'
            });
        }

        const interview = interviews[0];

        if (interview.status !== 'SLOTS_OFFERED') {
            await connection.rollback();
            return res.status(400).json({
                message: `Cannot confirm interview. Current status: ${interview.status}`
            });
        }

        if (interview.offer_expires_at && new Date(interview.offer_expires_at) < new Date()) {
            await connection.rollback();
            return res.status(400).json({
                message: 'This offer has expired. Please contact HR.'
            });
        }

        const [slots] = await connection.execute(
            'SELECT id, start_time, end_time FROM InterviewSlots WHERE id = ? AND interview_id = ? FOR UPDATE',
            [slot_id, interviewId]
        );

        if (slots.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Slot not found'
            });
        }

        const slot = slots[0];
        const slotStart = new Date(slot.start_time);
        const slotEnd = new Date(slot.end_time);

        const [panelMembers] = await connection.execute(
            'SELECT hr_user_id FROM InterviewPanelMembers WHERE interview_id = ?',
            [interviewId]
        );

        for (const member of panelMembers) {
            const [conflicts] = await connection.execute(
                `SELECT i.id
                FROM Interviews i
                JOIN InterviewPanelMembers ipm ON i.id = ipm.interview_id
                WHERE ipm.hr_user_id = ?
                AND i.status = 'SCHEDULED'
                AND i.scheduled_start < ?
                AND i.scheduled_end > ?
                LIMIT 1`,
                [member.hr_user_id, slotEnd, slotStart]
            );

            if (conflicts.length > 0) {
                await connection.rollback();
                return res.status(409).json({
                    error: {
                        code: 'SLOT_CONFLICT',
                        message: 'This time is no longer available. Please choose another slot.'
                    }
                });
            }
        }

        
        await connection.execute(
            'UPDATE InterviewSlots SET is_chosen = true WHERE id = ?',
            [slot_id]
        );

        await connection.execute(
            `UPDATE Interviews 
             SET status = 'SCHEDULED',
                 scheduled_start = ?,
                 scheduled_end = ?,
                 confirmed_at = NOW()
             WHERE id = ?`,
            [slot.start_time, slot.end_time, interviewId]
        );

        await connection.execute(
            'UPDATE Applications SET stage = ? WHERE id = ?',
            ['INTERVIEW_SCHEDULED', interview.application_id]
        );

        await createApplicationEvent(
            connection,
            interview.application_id,
            'CANDIDATE',
            candidateId,
            'SLOT_CHOSEN',
            `Candidate chose interview time for ${interview.round_name}`,
            `Scheduled for ${slotStart.toISOString()}`,
            false
        );

        await createApplicationEvent(
            connection,
            interview.application_id,
            'SYSTEM',
            null,
            'INTERVIEW_CONFIRMED',
            `Interview confirmed for ${interview.round_name}`,
            `Scheduled for ${slotStart.toISOString()}`,
            true 
        );

        await connection.commit();

        res.json({
            message: 'Interview confirmed successfully',
            scheduled_start: slot.start_time,
            scheduled_end: slot.end_time
        });

    } catch (error) {
        await connection.rollback();
        console.error('Confirm interview error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.get('/me/:id/calendar.ics', authenticateToken, authorize('CANDIDATE'), async (req, res) => {
    try {
        const { id } = req.params;
        const candidateId = req.user.userId;

        const [interviews] = await pool.execute(
            `SELECT 
                i.round_name,
                i.mode,
                i.meeting_link,
                i.location,
                i.scheduled_start,
                i.scheduled_end,
                a.candidate_id,
                j.title as job_title
            FROM Interviews i
            JOIN Applications a ON i.application_id = a.id
            JOIN Jobs j ON a.job_id = j.id
            WHERE i.id = ? AND a.candidate_id = ? AND i.status = 'SCHEDULED'`,
            [id, candidateId]
        );

        if (interviews.length === 0) {
            return res.status(404).json({
                message: 'Interview not found or not scheduled'
            });
        }

        const interview = interviews[0];

        const [panelMembers] = await pool.execute(
            `SELECT u.name, u.email
            FROM InterviewPanelMembers ipm
            JOIN Users u ON ipm.hr_user_id = u.id
            WHERE ipm.interview_id = ?`,
            [id]
        );

      
        const formatICalDate = (date) => {
            return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        };

        const start = formatICalDate(interview.scheduled_start);
        const end = formatICalDate(interview.scheduled_end);
        const now = formatICalDate(new Date());

        let description = `Interview for ${interview.job_title} - ${interview.round_name}\\n\\n`;
        description += `Mode: ${interview.mode}\\n`;
        
        if (interview.mode === 'ZOOM' && interview.meeting_link) {
            description += `Zoom link: ${interview.meeting_link}\\n`;
        } else if (interview.mode === 'ONSITE' && interview.location) {
            description += `Location: ${interview.location}\\n`;
        }

        if (panelMembers.length > 0) {
            description += `\\nPanel members:\\n`;
            panelMembers.forEach(p => {
                description += `- ${p.name} (${p.email})\\n`;
            });
        }

        let locationStr = '';
        if (interview.mode === 'ZOOM' && interview.meeting_link) {
            locationStr = interview.meeting_link;
        } else if (interview.mode === 'ONSITE' && interview.location) {
            locationStr = interview.location;
        }

     
        const icalContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Hyre.AI//Interview//EN',
            'CALSCALE:GREGORIAN',
            'METHOD:REQUEST',
            'BEGIN:VEVENT',
            `UID:interview-${id}@hyre.ai`,
            `DTSTAMP:${now}`,
            `DTSTART:${start}`,
            `DTEND:${end}`,
            `SUMMARY:${interview.job_title} - ${interview.round_name}`,
            `DESCRIPTION:${description}`,
            locationStr ? `LOCATION:${locationStr}` : '',
            'STATUS:CONFIRMED',
            'SEQUENCE:0',
            'BEGIN:VALARM',
            'TRIGGER:-PT15M',
            'ACTION:DISPLAY',
            'DESCRIPTION:Interview starts in 15 minutes',
            'END:VALARM',
            'END:VEVENT',
            'END:VCALENDAR'
        ].filter(line => line !== '').join('\r\n');

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="interview-${id}.ics"`);
        res.send(icalContent);

    } catch (error) {
        console.error('Generate calendar error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});



router.get('/hr/:id/feedback', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;

        const [interviews] = await pool.execute(
            'SELECT id, round_name FROM Interviews WHERE id = ?',
            [id]
        );

        if (interviews.length === 0) {
            return res.status(404).json({
                message: 'Interview not found'
            });
        }

        const [feedback] = await pool.execute(
            `SELECT 
                f.id,
                f.interviewer_id,
                f.technical,
                f.problem_solving,
                f.communication,
                f.culture_fit,
                f.strengths,
                f.concerns,
                f.recommendation,
                f.status,
                f.submitted_at,
                u.name as interviewer_name,
                u.email as interviewer_email,
                entered.name as entered_by_name
            FROM InterviewFeedback f
            LEFT JOIN Users u ON f.interviewer_id = u.id
            JOIN Users entered ON f.entered_by = entered.id
            WHERE f.interview_id = ?
            ORDER BY f.submitted_at DESC`,
            [id]
        );

        res.json({
            feedback
        });

    } catch (error) {
        console.error('Get feedback error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.put('/hr/:id/feedback/:interviewerId', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const interviewId = req.params.id;
        const interviewerId = req.params.interviewerId;
        const {
            technical,
            problem_solving,
            communication,
            culture_fit,
            strengths,
            concerns,
            recommendation,
            status 
        } = req.body;

        if (!['DRAFT', 'SUBMITTED'].includes(status)) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Status must be DRAFT or SUBMITTED'
            });
        }

        if (status === 'SUBMITTED') {
            if (!technical || !problem_solving || !communication || !culture_fit) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'All four ratings are required to submit feedback'
                });
            }

            if (technical < 1 || technical > 5 || problem_solving < 1 || problem_solving > 5 ||
                communication < 1 || communication > 5 || culture_fit < 1 || culture_fit > 5) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'All ratings must be between 1 and 5'
                });
            }

            if (!recommendation || !['NEXT_ROUND', 'HIRE', 'HOLD', 'REJECT'].includes(recommendation)) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Valid recommendation is required (NEXT_ROUND, HIRE, HOLD, or REJECT)'
                });
            }

            if (!strengths && !concerns) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'At least one of Strengths or Concerns must be filled'
                });
            }
        }

        const [interviews] = await connection.execute(
            `SELECT i.id, i.application_id, i.scheduled_start, i.scheduled_end
             FROM Interviews i
             WHERE i.id = ?`,
            [interviewId]
        );

        if (interviews.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Interview not found'
            });
        }

        const interview = interviews[0];

        if (status === 'SUBMITTED') {
            const now = new Date();
            const interviewStart = new Date(interview.scheduled_start);

            if (interviewStart > now) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Cannot submit feedback before the interview has started'
                });
            }
        }

        const [panelCheck] = await connection.execute(
            'SELECT hr_user_id FROM InterviewPanelMembers WHERE interview_id = ? AND hr_user_id = ?',
            [interviewId, interviewerId]
        );

        if (panelCheck.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                message: 'This interviewer is not on the panel for this interview'
            });
        }

        const [existingFeedback] = await connection.execute(
            'SELECT id FROM InterviewFeedback WHERE interview_id = ? AND interviewer_id = ?',
            [interviewId, interviewerId]
        );

        if (existingFeedback.length > 0) {
            await connection.execute(
                `UPDATE InterviewFeedback
                 SET technical = ?,
                     problem_solving = ?,
                     communication = ?,
                     culture_fit = ?,
                     strengths = ?,
                     concerns = ?,
                     recommendation = ?,
                     status = ?,
                     submitted_at = ?,
                     entered_by = ?,
                     updated_at = NOW()
                 WHERE interview_id = ? AND interviewer_id = ?`,
                [
                    nn(technical), nn(problem_solving), nn(communication), nn(culture_fit),
                    nn(strengths), nn(concerns), nn(recommendation),
                    status,
                    status === 'SUBMITTED' ? new Date() : null,
                    req.user.userId,
                    interviewId, interviewerId
                ]
            );
        } else {
            await connection.execute(
                `INSERT INTO InterviewFeedback
                    (interview_id, interviewer_id, technical, problem_solving, communication, culture_fit,
                     strengths, concerns, recommendation, status, submitted_at, entered_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    interviewId, interviewerId,
                    nn(technical), nn(problem_solving), nn(communication), nn(culture_fit),
                    nn(strengths), nn(concerns), nn(recommendation),
                    status,
                    status === 'SUBMITTED' ? new Date() : null,
                    req.user.userId
                ]
            );
        }

        if (status === 'SUBMITTED') {
            await createApplicationEvent(
                connection,
                interview.application_id,
                'HR',
                req.user.userId,
                'FEEDBACK_SUBMITTED',
                'Interview feedback submitted',
                `Feedback submitted for interviewer ${interviewerId}`,
                false
            );
        }

        const [panelCount] = await connection.execute(
            'SELECT COUNT(*) as total FROM InterviewPanelMembers WHERE interview_id = ?',
            [interviewId]
        );

        const [submittedCount] = await connection.execute(
            `SELECT COUNT(*) as submitted 
             FROM InterviewFeedback 
             WHERE interview_id = ? AND status = 'SUBMITTED'`,
            [interviewId]
        );

        if (status === 'SUBMITTED' && submittedCount[0].submitted === panelCount[0].total) {
            await connection.execute(
                'UPDATE Interviews SET status = ? WHERE id = ?',
                ['COMPLETED', interviewId]
            );

            await connection.execute(
                'UPDATE Applications SET stage = ? WHERE id = ?',
                ['INTERVIEWED', interview.application_id]
            );

            await createApplicationEvent(
                connection,
                interview.application_id,
                'SYSTEM',
                null,
                'ALL_FEEDBACK_IN',
                'All interview feedback received',
                'Interview is ready for HR decision',
                false
            );
        }

        await connection.commit();

        res.json({
            message: status === 'SUBMITTED' ? 'Feedback submitted successfully' : 'Feedback draft saved'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Submit feedback error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});


router.post('/hr/applications/:id/decision', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();

        const applicationId = req.params.id;
        const { action, note, next_round_name, panel_member_ids, rejection_reason, rejection_note } = req.body;

        if (!action || !['NEXT_ROUND', 'HOLD', 'REJECT'].includes(action)) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Valid action is required (NEXT_ROUND, HOLD, or REJECT)'
            });
        }

        const [applications] = await connection.execute(
            'SELECT id, stage, current_round FROM Applications WHERE id = ?',
            [applicationId]
        );

        if (applications.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        const application = applications[0];

        if (application.stage !== 'INTERVIEWED') {
            await connection.rollback();
            return res.status(400).json({
                message: `Can only make decisions for INTERVIEWED applications. Current stage: ${application.stage}`
            });
        }

        if (action === 'NEXT_ROUND') {
            if (!next_round_name) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Next round name is required'
                });
            }

            if (!panel_member_ids || !Array.isArray(panel_member_ids) || panel_member_ids.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'At least one panel member is required for the next round'
                });
            }

            const newRound = application.current_round + 1;

            await connection.execute(
                'UPDATE Applications SET stage = ?, current_round = ? WHERE id = ?',
                ['SHORTLISTED', newRound, applicationId]
            );

            await createApplicationEvent(
                connection,
                applicationId,
                'HR',
                req.user.userId,
                'MOVED_TO_NEXT_ROUND',
                `Moved to ${next_round_name}`,
                nn(note),
                false
            );

            await connection.commit();

            res.json({
                message: 'Moved to next round successfully',
                new_round: newRound
            });

        } else if (action === 'HOLD') {
            await connection.execute(
                'UPDATE Applications SET stage = ? WHERE id = ?',
                ['ON_HOLD', applicationId]
            );

            await createApplicationEvent(
                connection,
                applicationId,
                'HR',
                req.user.userId,
                'PLACED_ON_HOLD',
                'Application placed on hold',
                nn(note),
                false
            );

            await connection.commit();

            res.json({
                message: 'Application placed on hold successfully'
            });

        } else if (action === 'REJECT') {
            if (!rejection_reason) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Rejection reason is required'
                });
            }

            const validReasons = ['SKILLS_MISMATCH', 'NOT_ENOUGH_EXPERIENCE', 'DUPLICATE_APPLICATION', 
                                  'POSITION_FILLED', 'FAILED_INTERVIEW', 'OTHER'];
            
            if (!validReasons.includes(rejection_reason)) {
                await connection.rollback();
                return res.status(400).json({
                    message: 'Invalid rejection reason'
                });
            }

            await connection.execute(
                `UPDATE Applications 
                 SET stage = ?, 
                     rejection_reason = ?, 
                     rejection_note = ?, 
                     rejected_at = NOW() 
                 WHERE id = ?`,
                ['REJECTED', rejection_reason, nn(rejection_note), applicationId]
            );

            await createApplicationEvent(
                connection,
                applicationId,
                'HR',
                req.user.userId,
                'REJECTED',
                'Application rejected',
                null,
                true 
            );

            await connection.commit();

            res.json({
                message: 'Application rejected successfully'
            });
        }

    } catch (error) {
        await connection.rollback();
        console.error('Decision error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});



router.get('/hr/jobs/:id/pipeline', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const jobId = req.params.id;

        const [jobs] = await pool.execute(
            'SELECT id, title FROM Jobs WHERE id = ?',
            [jobId]
        );

        if (jobs.length === 0) {
            return res.status(404).json({
                message: 'Job not found'
            });
        }

        const [counters] = await pool.execute(
            `SELECT 
                stage,
                COUNT(*) as count
             FROM Applications
             WHERE job_id = ?
             GROUP BY stage`,
            [jobId]
        );

        const stageMap = {
            APPLIED: 0,
            SHORTLISTED: 0,
            SLOTS_OFFERED: 0,
            INTERVIEW_SCHEDULED: 0,
            INTERVIEWED: 0,
            REJECTED: 0
        };

        counters.forEach(row => {
            if (stageMap.hasOwnProperty(row.stage)) {
                stageMap[row.stage] = row.count;
            }
        });

        const [interviews] = await pool.execute(
            `SELECT 
                i.id,
                i.application_id,
                i.round_number,
                i.round_name,
                i.duration_minutes,
                i.mode,
                i.scheduled_start,
                i.status,
                i.offered_at,
                i.offer_expires_at,
                a.candidate_id,
                a.stage as application_stage,
                u.name as candidate_name,
                ai.match_percent
            FROM Interviews i
            JOIN Applications a ON i.application_id = a.id
            JOIN Users u ON a.candidate_id = u.id
            LEFT JOIN AIScores ai ON ai.application_id = a.id
            WHERE a.job_id = ?
            ORDER BY COALESCE(i.scheduled_start, i.offered_at) DESC`,
            [jobId]
        );

        for (const interview of interviews) {
            const [panelMembers] = await pool.execute(
                `SELECT 
                    u.id,
                    u.name
                FROM InterviewPanelMembers ipm
                JOIN Users u ON ipm.hr_user_id = u.id
                WHERE ipm.interview_id = ?`,
                [interview.id]
            );
            interview.panel = panelMembers;

            const [feedbackStatus] = await pool.execute(
                `SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'SUBMITTED' THEN 1 ELSE 0 END) as submitted
                FROM InterviewFeedback
                WHERE interview_id = ?`,
                [interview.id]
            );

            interview.feedback_submitted = feedbackStatus[0]?.submitted || 0;
            interview.feedback_total = panelMembers.length;
        }

        const slotsOffered = interviews.filter(i => i.status === 'SLOTS_OFFERED');

        res.json({
            job: jobs[0],
            counters: stageMap,
            interviews,
            slotsOffered
        });

    } catch (error) {
        console.error('Get pipeline error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

module.exports = router;