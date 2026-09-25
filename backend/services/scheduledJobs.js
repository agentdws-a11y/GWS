const cron = require('node-cron');
const pool = require('../db');

async function createApplicationEvent(connection, applicationId, actorType, actorUserId, eventType, title, note, visibleToCandidate = false) {
    await connection.execute(
        `INSERT INTO ApplicationEvents 
            (application_id, actor_type, actor_user_id, event_type, title, note, visible_to_candidate) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [applicationId, actorType, actorUserId, eventType, title, note, visibleToCandidate]
    );
}

function startExpiryJob() {
    cron.schedule('*/15 * * * *', async () => {
        console.log('[Expiry Job] Checking for expired interview offers...');
        
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            const [expiredInterviews] = await connection.execute(
                `SELECT 
                    i.id,
                    i.application_id,
                    i.round_name,
                    i.offer_expires_at,
                    a.candidate_id,
                    u.name as candidate_name
                FROM Interviews i
                JOIN Applications a ON i.application_id = a.id
                JOIN Users u ON a.candidate_id = u.id
                WHERE i.status = 'SLOTS_OFFERED'
                AND i.offer_expires_at < NOW()`
            );

            if (expiredInterviews.length === 0) {
                await connection.commit();
                console.log('[Expiry Job] No expired offers found.');
                return;
            }

            console.log(`[Expiry Job] Found ${expiredInterviews.length} expired offers. Processing...`);

            for (const interview of expiredInterviews) {
                await connection.execute(
                    'UPDATE Interviews SET status = ? WHERE id = ?',
                    ['EXPIRED', interview.id]
                );

                await connection.execute(
                    'UPDATE Applications SET stage = ? WHERE id = ?',
                    ['SHORTLISTED', interview.application_id]
                );

                await createApplicationEvent(
                    connection,
                    interview.application_id,
                    'SYSTEM',
                    null,
                    'OFFER_EXPIRED',
                    `Interview offer expired for ${interview.round_name}`,
                    `Candidate ${interview.candidate_name} did not respond before ${interview.offer_expires_at}`,
                    false 
                );

                console.log(`[Expiry Job] Expired interview ${interview.id} for application ${interview.application_id}`);
            }

            await connection.commit();
            console.log(`[Expiry Job] Successfully processed ${expiredInterviews.length} expired offers.`);

        } catch (error) {
            await connection.rollback();
            console.error('[Expiry Job] Error:', error);
        } finally {
            connection.release();
        }
    });

    console.log('[Scheduled Jobs] Expiry job started (runs every 15 minutes)');
}


function startAssessmentExpiryJob() {
    cron.schedule('*/30 * * * *', async () => {
        console.log('[Assessment Expiry Job] Checking for expired assessments...');
        
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            const [expiredAssessments] = await connection.execute(
                `SELECT 
                    ca.id,
                    ca.application_id,
                    ca.status,
                    ca.deadline_at,
                    t.title as assessment_title,
                    a.candidate_id,
                    u.name as candidate_name
                FROM CandidateAssessments ca
                JOIN AssessmentTemplates t ON ca.template_id = t.id
                JOIN Applications a ON ca.application_id = a.id
                JOIN Users u ON a.candidate_id = u.id
                WHERE ca.status IN ('PENDING', 'IN_PROGRESS')
                AND ca.deadline_at IS NOT NULL
                AND ca.deadline_at < NOW()`
            );

            if (expiredAssessments.length === 0) {
                await connection.commit();
                console.log('[Assessment Expiry Job] No expired assessments found.');
                return;
            }

            console.log(`[Assessment Expiry Job] Found ${expiredAssessments.length} expired assessments. Processing...`);

            for (const assessment of expiredAssessments) {
                await connection.execute(
                    `UPDATE CandidateAssessments
                    SET status = 'GRADED',
                        submitted_at = NOW(),
                        score = 0,
                        max_score = 0,
                        earned_score = 0,
                        passed = false
                    WHERE id = ?`,
                    [assessment.id]
                );

                await createApplicationEvent(
                    connection,
                    assessment.application_id,
                    'SYSTEM',
                    null,
                    'ASSESSMENT_EXPIRED',
                    `Assessment expired: ${assessment.assessment_title}`,
                    `Deadline was ${assessment.deadline_at}. Assessment marked as not completed.`,
                    false 
                );

                console.log(`[Assessment Expiry Job] Expired assessment ${assessment.id} for application ${assessment.application_id}`);
            }

            await connection.commit();
            console.log(`[Assessment Expiry Job] Successfully processed ${expiredAssessments.length} expired assessments.`);

        } catch (error) {
            await connection.rollback();
            console.error('[Assessment Expiry Job] Error:', error);
        } finally {
            connection.release();
        }
    });

    console.log('[Scheduled Jobs] Assessment expiry job started (runs every 30 minutes)');
}

function startAllJobs() {
    startExpiryJob();
    startAssessmentExpiryJob();
}

module.exports = { startAllJobs };
