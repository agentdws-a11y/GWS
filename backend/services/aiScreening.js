const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const pool = require('../db');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001';

const MATCH_LABEL_TEXT = {
    STRONG: 'Strong match',
    POSSIBLE: 'Possible match',
    NOT_A_FIT: 'Not a fit'
};

const parseJson = (v, fallback) => {
    if (v === null || v === undefined) return fallback;
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return fallback; }
};


async function addAIEvents(applicationId, info) {
    await pool.execute(
        `DELETE FROM ApplicationEvents
         WHERE application_id = ? AND event_type IN ('RESUME_PARSED', 'DUPLICATE_CHECK', 'AI_RANKED')`,
        [applicationId]
    );

    const labelText = MATCH_LABEL_TEXT[info.matchLabel] || info.matchLabel;
    const score = info.predictedScore === null || info.predictedScore === undefined
        ? '-'
        : Number(info.predictedScore).toFixed(1);

    const events = [
        ['RESUME_PARSED', `Resume parsed, ${info.matchedCount} of ${info.requiredCount} required skills found`],
        ['DUPLICATE_CHECK', info.duplicateCount > 0
            ? `Possible duplicate found (${info.duplicateCount})`
            : 'Duplicate check passed'],
        ['AI_RANKED', `Ranked ${info.matchPercent}% ${labelText}, predicted score ${score} out of 10`]
    ];

    for (const [eventType, title] of events) {
        await pool.execute(
            `INSERT INTO ApplicationEvents
                (application_id, actor_type, actor_user_id, event_type, title, note, visible_to_candidate)
             VALUES (?, 'AI', NULL, ?, ?, NULL, 0)`,
            [applicationId, eventType, title]
        );
    }
}

async function processApplicationAI(applicationId) {
    try {
        const [appRows] = await pool.execute(
            `SELECT a.id, a.candidate_id, a.phone, a.cv_file_path, j.required_skills, j.description
             FROM Applications a
             JOIN Jobs j ON a.job_id = j.id
             WHERE a.id = ?`,
            [applicationId]
        );

        if (appRows.length === 0) {
            console.error(`AI processing: application ${applicationId} not found`);
            return;
        }

        const application = appRows[0];
        const cvFullPath = path.join(__dirname, '..', application.cv_file_path);

        const requiredSkillsArray = parseJson(application.required_skills, []);

        const form = new FormData();
        form.append('resume', fs.createReadStream(cvFullPath));
        form.append('required_skills', JSON.stringify(requiredSkillsArray));
        form.append('job_description', application.description);

        const aiResponse = await axios.post(`${AI_SERVICE_URL}/screen-application`, form, {
            headers: form.getHeaders(),
            timeout: 20000
        });

        const {
            parsed_json,
            match_percent,
            match_label,
            matched_skills,
            missing_skills,
            predicted_score,
            model_version,
            scored_at
        } = aiResponse.data;

        await pool.execute(
            `INSERT INTO AIScores
                (application_id, parsed_json, match_percent, match_label, matched_skills, missing_skills, predicted_score, model_version, scored_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                parsed_json = VALUES(parsed_json),
                match_percent = VALUES(match_percent),
                match_label = VALUES(match_label),
                matched_skills = VALUES(matched_skills),
                missing_skills = VALUES(missing_skills),
                predicted_score = VALUES(predicted_score),
                model_version = VALUES(model_version),
                scored_at = VALUES(scored_at)`,
            [
                applicationId,
                JSON.stringify(parsed_json),
                match_percent,
                match_label,
                JSON.stringify(matched_skills),
                JSON.stringify(missing_skills),
                predicted_score,
                model_version,
                scored_at
            ]
        );

        const duplicateCount = await checkDuplicates(
            applicationId,
            application.candidate_id,
            application.phone,
            parsed_json.email,
            parsed_json.text
        );

        try {
            await addAIEvents(applicationId, {
                matchedCount: matched_skills.length,
                requiredCount: requiredSkillsArray.length,
                duplicateCount,
                matchPercent: match_percent,
                matchLabel: match_label,
                predictedScore: predicted_score
            });
        } catch (eventError) {
            console.error(`Could not write AI activity events for application ${applicationId}:`, eventError.message);
        }

        await pool.execute(
            "UPDATE Applications SET ai_status = 'DONE' WHERE id = ?",
            [applicationId]
        );

        console.log(` AI processing completed for application ${applicationId}`);

    } catch (error) {
        console.error(` AI processing failed for application ${applicationId}:`, error.message);
        try {
            await pool.execute(
                "UPDATE Applications SET ai_status = 'FAILED' WHERE id = ?",
                [applicationId]
            );
        } catch (updateError) {
            console.error(`Could not mark application ${applicationId} as FAILED:`, updateError.message);
        }
    }
}

async function checkDuplicates(applicationId, candidateId, phone, extractedEmail, cvText) {
    const [existingApps] = await pool.execute(
        `SELECT 
            a.id as application_id,
            a.phone,
            ai.parsed_json
         FROM Applications a
         LEFT JOIN AIScores ai ON a.id = ai.application_id
         WHERE a.candidate_id != ? 
         AND a.id != ?
         AND a.ai_status = 'DONE'`,
        [candidateId, applicationId]
    );

    if (existingApps.length === 0) {
        return 0;
    }

    const existing = existingApps.map(app => {
        const parsedData = parseJson(app.parsed_json, {}) || {};
        
        return {
            application_id: app.application_id,
            email: parsedData.email || null,
            phone: app.phone || null,
            text: parsedData.text || ''
        };
    });

    const candidate = {
        email: extractedEmail,
        phone: phone,
        text: cvText
    };

    try {
        const dupResponse = await axios.post(`${AI_SERVICE_URL}/check-duplicates`, {
            candidate: candidate,
            existing: existing
        }, { timeout: 15000 });

        for (const dup of dupResponse.data.duplicates) {
            await insertDuplicateFlag(
                applicationId,
                dup.matched_application_id,
                dup.reason,  
                dup.similarity
            );
        }

        return dupResponse.data.duplicates.length;
    } catch (error) {
        console.error(`Duplicate check failed for application ${applicationId}:`, error.message);
        return 0;
    }
}

async function insertDuplicateFlag(applicationId, matchedApplicationId, reason, similarity) {
    const [existing] = await pool.execute(
        `SELECT id FROM DuplicateFlags 
         WHERE application_id = ? 
         AND matched_application_id = ? 
         AND reason = ?`,
        [applicationId, matchedApplicationId, reason]
    );
    
    if (existing.length === 0) {
        await pool.execute(
            `INSERT INTO DuplicateFlags 
             (application_id, matched_application_id, reason, similarity, status) 
             VALUES (?, ?, ?, ?, 'OPEN')`,
            [applicationId, matchedApplicationId, reason, similarity]
        );
        console.log(`🚩 Duplicate flag created: App ${applicationId} matches ${matchedApplicationId} (${reason})`);
    }
}

module.exports = { processApplicationAI };