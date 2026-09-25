const express = require('express');
const axios = require('axios');
const pool = require('../db');
const authenticateToken = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';

const nn = (v) => (v === undefined || v === '' ? null : v);

async function createApplicationEvent(connection, applicationId, actorType, actorUserId, eventType, title, note, visibleToCandidate = false) {
    await connection.execute(
        `INSERT INTO ApplicationEvents 
            (application_id, actor_type, actor_user_id, event_type, title, note, visible_to_candidate) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [applicationId, actorType, actorUserId, eventType, title, note, visibleToCandidate]
    );
}

const pad = (n) => String(n).padStart(2, '0');

const todayLocal = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const isValidDate = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(`${s}T00:00:00`);
    if (isNaN(d.getTime())) return false;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === s;
};

const OFFER_COLUMNS = `
    o.id,
    o.application_id,
    o.salary,
    DATE_FORMAT(o.start_date, '%Y-%m-%d') AS start_date,
    o.letter_body,
    o.status,
    o.sent_at,
    o.responded_at,
    o.created_at,
    o.updated_at`;


router.post('/hr/applications/:id', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const applicationId = req.params.id;
        const { salary, start_date, guidelines } = req.body;

        const salaryNumber = Number(salary);
        if (!Number.isFinite(salaryNumber) || salaryNumber <= 0 || salaryNumber > 99999999.99) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Salary must be a number greater than 0'
            });
        }

        const startDate = String(start_date || '').slice(0, 10);
        if (!isValidDate(startDate)) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Start date is required (format 2026-10-15)'
            });
        }

        if (startDate < todayLocal()) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Start date cannot be in the past'
            });
        }

        const guidelinesText = String(guidelines || '').trim();
        if (guidelinesText.length > 5000) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Guidelines are too long (max 5000 characters)'
            });
        }

        const [applications] = await connection.execute(
            `SELECT 
                a.id,
                a.stage,
                u.name AS candidate_name,
                j.title AS job_title,
                d.name AS department,
                j.employment_type,
                j.work_mode,
                j.location
            FROM Applications a
            JOIN Users u ON a.candidate_id = u.id
            JOIN Jobs j ON a.job_id = j.id
            LEFT JOIN Departments d ON j.department_id = d.id
            WHERE a.id = ?
            FOR UPDATE OF a`,
            [applicationId]
        );

        if (applications.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Application not found'
            });
        }

        const application = applications[0];

        if (!['INTERVIEWED', 'READY_FOR_OFFER'].includes(application.stage)) {
            await connection.rollback();
            return res.status(400).json({
                message: `Can only prepare an offer for INTERVIEWED applications. Current stage: ${application.stage}`
            });
        }

        const [existingOffers] = await connection.execute(
            'SELECT id, status FROM Offers WHERE application_id = ? FOR UPDATE',
            [applicationId]
        );

        if (existingOffers.length > 0 && existingOffers[0].status !== 'DRAFT') {
            await connection.rollback();
            return res.status(400).json({
                message: `An offer already exists for this application (${existingOffers[0].status})`
            });
        }

        let letterBody;
        try {
            const aiResponse = await axios.post(
                `${AI_SERVICE_URL}/generate-offer`,
                {
                    candidate_name: application.candidate_name,
                    job_title: application.job_title,
                    department: application.department,
                    employment_type: application.employment_type,
                    work_mode: application.work_mode,
                    location: application.location,
                    salary: salaryNumber,
                    start_date: startDate,
                    guidelines: guidelinesText
                },
                { timeout: 10000 }
            );
            letterBody = aiResponse.data && aiResponse.data.letter_body;
        } catch (aiError) {
            await connection.rollback();
            console.error('Generate offer (AI service) error:', aiError.message);

            if (aiError.response && aiError.response.status === 400) {
                return res.status(400).json({
                    message: (aiError.response.data && aiError.response.data.error) || 'Could not generate the offer letter'
                });
            }

            return res.status(502).json({
                message: 'Could not reach the AI service. Please try again.'
            });
        }

        if (!letterBody) {
            await connection.rollback();
            return res.status(502).json({
                message: 'The AI service did not return a letter'
            });
        }

        let offerId;
        const isRegenerate = existingOffers.length > 0;

        if (isRegenerate) {
            offerId = existingOffers[0].id;
            await connection.execute(
                `UPDATE Offers 
                 SET salary = ?, start_date = ?, guidelines = ?, letter_body = ?
                 WHERE id = ?`,
                [salaryNumber, startDate, nn(guidelinesText), letterBody, offerId]
            );
        } else {
            const [result] = await connection.execute(
                `INSERT INTO Offers 
                    (application_id, salary, start_date, guidelines, letter_body, status, created_by) 
                 VALUES (?, ?, ?, ?, ?, 'DRAFT', ?)`,
                [applicationId, salaryNumber, startDate, nn(guidelinesText), letterBody, req.user.userId]
            );
            offerId = result.insertId;
        }

        await connection.execute(
            'UPDATE Applications SET stage = ? WHERE id = ?',
            ['READY_FOR_OFFER', applicationId]
        );

        await createApplicationEvent(
            connection,
            applicationId,
            'HR',
            req.user.userId,
            isRegenerate ? 'OFFER_DRAFT_REGENERATED' : 'OFFER_DRAFT_CREATED',
            isRegenerate ? 'Offer letter draft regenerated' : 'Offer letter draft prepared',
            null,
            false
        );

        await connection.commit();

        res.status(isRegenerate ? 200 : 201).json({
            message: isRegenerate ? 'Offer draft regenerated' : 'Offer draft created',
            offerId,
            letter_body: letterBody
        });

    } catch (error) {
        await connection.rollback();
        console.error('Create offer error:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({
                message: 'An offer already exists for this application'
            });
        }

        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.get('/hr/applications/:id', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const [offers] = await pool.execute(
            `SELECT 
                ${OFFER_COLUMNS},
                o.guidelines,
                o.created_by,
                u.name AS created_by_name
            FROM Offers o
            LEFT JOIN Users u ON o.created_by = u.id
            WHERE o.application_id = ?`,
            [req.params.id]
        );

        res.json({
            offer: offers[0] || null
        });

    } catch (error) {
        console.error('Get offer error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

router.put('/hr/:offerId', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { offerId } = req.params;
        const letterBody = String(req.body.letter_body || '').trim();

        if (!letterBody) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Letter text cannot be empty'
            });
        }

        if (letterBody.length > 20000) {
            await connection.rollback();
            return res.status(400).json({
                message: 'Letter text is too long (max 20000 characters)'
            });
        }

        const [offers] = await connection.execute(
            'SELECT id, application_id, status FROM Offers WHERE id = ? FOR UPDATE',
            [offerId]
        );

        if (offers.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Offer not found'
            });
        }

        if (offers[0].status !== 'DRAFT') {
            await connection.rollback();
            return res.status(400).json({
                message: 'Only DRAFT offers can be edited'
            });
        }

        await connection.execute(
            'UPDATE Offers SET letter_body = ? WHERE id = ?',
            [letterBody, offerId]
        );

        await createApplicationEvent(
            connection,
            offers[0].application_id,
            'HR',
            req.user.userId,
            'OFFER_DRAFT_EDITED',
            'Offer letter draft edited',
            null,
            false
        );

        await connection.commit();

        res.json({
            message: 'Offer draft saved'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Edit offer error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});

router.post('/hr/:offerId/send', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { offerId } = req.params;

        const [offers] = await connection.execute(
            `SELECT 
                o.id,
                o.application_id,
                o.status,
                a.stage
            FROM Offers o
            JOIN Applications a ON o.application_id = a.id
            WHERE o.id = ?
            FOR UPDATE`,
            [offerId]
        );

        if (offers.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Offer not found'
            });
        }

        const offer = offers[0];

        if (offer.status !== 'DRAFT') {
            await connection.rollback();
            return res.status(400).json({
                message: `Only DRAFT offers can be sent. Current status: ${offer.status}`
            });
        }

        if (offer.stage !== 'READY_FOR_OFFER') {
            await connection.rollback();
            return res.status(400).json({
                message: `Application must be READY_FOR_OFFER. Current stage: ${offer.stage}`
            });
        }

        await connection.execute(
            "UPDATE Offers SET status = 'SENT', sent_at = NOW() WHERE id = ?",
            [offerId]
        );

        await connection.execute(
            'UPDATE Applications SET stage = ? WHERE id = ?',
            ['OFFER_SENT', offer.application_id]
        );

        await createApplicationEvent(
            connection,
            offer.application_id,
            'HR',
            req.user.userId,
            'OFFER_SENT',
            'Offer letter sent',
            null,
            true 
        );

        await connection.commit();

        res.json({
            message: 'Offer sent to the candidate'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Send offer error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
});


router.get('/me', authenticateToken, authorize('CANDIDATE'), async (req, res) => {
    try {
        const [offers] = await pool.execute(
            `SELECT 
                ${OFFER_COLUMNS},
                a.stage AS application_stage,
                j.title AS job_title,
                d.name AS job_department
            FROM Offers o
            JOIN Applications a ON o.application_id = a.id
            JOIN Jobs j ON a.job_id = j.id
            LEFT JOIN Departments d ON j.department_id = d.id
            WHERE a.candidate_id = ?
            AND o.status IN ('SENT', 'ACCEPTED', 'DECLINED')
            ORDER BY o.sent_at DESC`,
            [req.user.userId]
        );

        res.json({
            offers
        });

    } catch (error) {
        console.error('Get candidate offers error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    }
});

async function respondToOffer(req, res, decision) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { offerId } = req.params;
        const candidateId = req.user.userId;
        const reason = String(req.body.reason || '').trim().slice(0, 500);

        const [offers] = await connection.execute(
            `SELECT 
                o.id,
                o.application_id,
                o.status,
                a.stage
            FROM Offers o
            JOIN Applications a ON o.application_id = a.id
            WHERE o.id = ? AND a.candidate_id = ?
            FOR UPDATE`,
            [offerId, candidateId]
        );

        if (offers.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                message: 'Offer not found'
            });
        }

        const offer = offers[0];

        if (offer.status !== 'SENT') {
            await connection.rollback();
            return res.status(400).json({
                message: `This offer can no longer be answered. Current status: ${offer.status}`
            });
        }

        if (offer.stage !== 'OFFER_SENT') {
            await connection.rollback();
            return res.status(400).json({
                message: 'This offer is no longer active. Please contact HR.'
            });
        }

        const accepted = decision === 'ACCEPTED';

        await connection.execute(
            'UPDATE Offers SET status = ?, responded_at = NOW() WHERE id = ?',
            [decision, offerId]
        );

        await connection.execute(
            'UPDATE Applications SET stage = ? WHERE id = ?',
            [accepted ? 'HIRED' : 'OFFER_DECLINED', offer.application_id]
        );

        await createApplicationEvent(
            connection,
            offer.application_id,
            'CANDIDATE',
            candidateId,
            accepted ? 'OFFER_ACCEPTED' : 'OFFER_DECLINED',
            accepted ? 'Offer accepted' : 'Offer declined',
            nn(reason),
            true 
        );

        await connection.commit();

        res.json({
            message: accepted ? 'Offer accepted' : 'Offer declined'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Respond to offer error:', error);
        res.status(500).json({
            message: 'Server error'
        });
    } finally {
        connection.release();
    }
}

router.post('/me/:offerId/accept', authenticateToken, authorize('CANDIDATE'), (req, res) => {
    return respondToOffer(req, res, 'ACCEPTED');
});

router.post('/me/:offerId/decline', authenticateToken, authorize('CANDIDATE'), (req, res) => {
    return respondToOffer(req, res, 'DECLINED');
});

module.exports = router;