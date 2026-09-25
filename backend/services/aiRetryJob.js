const pool = require('../db');
const { processApplicationAI } = require('./aiScreening');

const RETRY_INTERVAL_MS = 5 * 60 * 1000;

async function retryPendingApplications() {
    try {
        const [applications] = await pool.execute(
            `SELECT id FROM Applications
             WHERE ai_status IN ('PENDING', 'FAILED')
             AND applied_at < (NOW() - INTERVAL 1 MINUTE)`
        );

        if (applications.length === 0) return;

        console.log(`AI retry job: reprocessing ${applications.length} application(s)`);

        for (const app of applications) {
            await processApplicationAI(app.id);
        }
    } catch (error) {
        console.error('AI retry job error:', error.message);
    }
}

function startAIRetryJob() {
    setInterval(retryPendingApplications, RETRY_INTERVAL_MS);
    console.log(`AI retry job started — checking every ${RETRY_INTERVAL_MS / 60000} minute(s)`);
}

module.exports = { startAIRetryJob };