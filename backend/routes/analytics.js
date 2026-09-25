const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.get('/dashboard', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { year, month } = req.query;
        
        let dateFilter = '';
        let dateParams = [];
        
        if (year && month) {
            dateFilter = ' AND YEAR(a.applied_at) = ? AND MONTH(a.applied_at) = ?';
            dateParams = [parseInt(year), parseInt(month)];
        }

        const [hiringTrends] = await pool.execute(`
            SELECT 
                DATE_FORMAT(applied_at, '%Y-%m') as month,
                COUNT(*) as applications,
                COUNT(CASE WHEN stage IN ('SLOTS_OFFERED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'ON_HOLD', 'READY_FOR_OFFER', 'OFFER_SENT', 'OFFER_DECLINED', 'HIRED') THEN 1 END) as interviews,
                COUNT(CASE WHEN stage IN ('READY_FOR_OFFER', 'OFFER_SENT', 'OFFER_DECLINED', 'HIRED') THEN 1 END) as offers
            FROM Applications
            WHERE applied_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            AND ai_status = 'DONE'
            GROUP BY DATE_FORMAT(applied_at, '%Y-%m')
            ORDER BY month ASC
        `);

        const vacancyQuery = `
            SELECT 
                j.id,
                j.title,
                j.status,
                d.name as department,
                j.openings,
                COUNT(a.id) as total_applications,
                COUNT(CASE WHEN a.stage = 'SHORTLISTED' THEN 1 END) as shortlisted,
                COUNT(CASE WHEN a.stage IN ('SLOTS_OFFERED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'ON_HOLD') THEN 1 END) as in_interview,
                COUNT(CASE WHEN a.stage IN ('READY_FOR_OFFER', 'OFFER_SENT') THEN 1 END) as offered,
                COUNT(CASE WHEN a.stage = 'HIRED' THEN 1 END) as hired,
                j.created_at,
                j.application_deadline
            FROM Jobs j
            LEFT JOIN Departments d ON j.department_id = d.id
            LEFT JOIN Applications a ON j.id = a.job_id AND a.ai_status = 'DONE' ${dateFilter}
            GROUP BY j.id, j.title, j.status, d.name, j.openings, j.created_at, j.application_deadline
            HAVING total_applications > 0 OR j.status = 'OPEN'
            ORDER BY j.created_at DESC
        `;
        const [vacancyStatus] = await pool.execute(vacancyQuery, dateParams);

        const pipelineQuery = `
            SELECT 
                stage,
                COUNT(*) as count
            FROM Applications a
            WHERE ai_status = 'DONE' ${dateFilter}
            GROUP BY stage
        `;
        const [pipelineCounts] = await pool.execute(pipelineQuery, dateParams);

        const departmentQuery = `
            SELECT 
                d.id,
                d.name as department,
                COUNT(DISTINCT CASE WHEN j.status = 'OPEN' THEN j.id END) as open_vacancies,
                COUNT(DISTINCT a.id) as total_applications,
                COUNT(DISTINCT CASE WHEN a.stage IN ('SLOTS_OFFERED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'ON_HOLD') THEN a.id END) as interviews_scheduled,
                COUNT(DISTINCT CASE WHEN a.stage IN ('READY_FOR_OFFER', 'OFFER_SENT') THEN a.id END) as offers_sent,
                COUNT(DISTINCT CASE WHEN a.stage = 'HIRED' THEN a.id END) as hired
            FROM Departments d
            LEFT JOIN Jobs j ON d.id = j.department_id
            LEFT JOIN Applications a ON j.id = a.job_id AND a.ai_status = 'DONE' ${dateFilter}
            GROUP BY d.id, d.name
            ORDER BY total_applications DESC
        `;
        const [departmentHiring] = await pool.execute(departmentQuery, dateParams);

        const summaryQuery = year && month ? `
            SELECT 
                (SELECT COUNT(DISTINCT job_id) FROM Applications a WHERE ai_status = 'DONE' AND YEAR(applied_at) = ? AND MONTH(applied_at) = ?) as total_jobs,
                (SELECT COUNT(*) FROM Applications WHERE ai_status = 'DONE' AND YEAR(applied_at) = ? AND MONTH(applied_at) = ?) as total_applications,
                (SELECT COUNT(*) FROM Applications WHERE ai_status = 'DONE' AND YEAR(applied_at) = ? AND MONTH(applied_at) = ?) as applications_this_period,
                (SELECT COUNT(*) FROM Interviews WHERE YEAR(created_at) = ? AND MONTH(created_at) = ? AND status = 'SCHEDULED') as scheduled_interviews,
                (SELECT COUNT(*) FROM Interviews WHERE YEAR(created_at) = ? AND MONTH(created_at) = ? AND status = 'COMPLETED') as completed_interviews,
                (SELECT COUNT(DISTINCT application_id) FROM Offers WHERE YEAR(created_at) = ? AND MONTH(created_at) = ? AND status IN ('SENT', 'ACCEPTED')) as active_offers,
                (SELECT COUNT(*) FROM Applications WHERE stage = 'HIRED' AND YEAR(applied_at) = ? AND MONTH(applied_at) = ?) as total_hired,
                (SELECT AVG(DATEDIFF(updated_at, applied_at)) FROM Applications WHERE stage = 'HIRED' AND YEAR(applied_at) = ? AND MONTH(applied_at) = ?) as avg_time_to_hire
        ` : `
            SELECT 
                (SELECT COUNT(*) FROM Jobs WHERE status = 'OPEN') as total_jobs,
                (SELECT COUNT(*) FROM Applications WHERE ai_status = 'DONE') as total_applications,
                (SELECT COUNT(*) FROM Applications WHERE ai_status = 'DONE' AND applied_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) as applications_this_period,
                (SELECT COUNT(*) FROM Interviews WHERE status = 'SCHEDULED') as scheduled_interviews,
                (SELECT COUNT(*) FROM Interviews WHERE status = 'COMPLETED') as completed_interviews,
                (SELECT COUNT(DISTINCT application_id) FROM Offers WHERE status IN ('SENT', 'ACCEPTED')) as active_offers,
                (SELECT COUNT(*) FROM Applications WHERE stage = 'HIRED') as total_hired,
                (SELECT AVG(DATEDIFF(updated_at, applied_at)) FROM Applications WHERE stage = 'HIRED') as avg_time_to_hire
        `;
        
        const summaryParams = year && month ? [year, month, year, month, year, month, year, month, year, month, year, month, year, month, year, month] : [];
        const [summaryStats] = await pool.execute(summaryQuery, summaryParams);

        res.json({
            hiringTrends,
            vacancyStatus,
            pipelineCounts,
            departmentHiring,
            summary: summaryStats[0],
            filters: {
                year: year ? parseInt(year) : null,
                month: month ? parseInt(month) : null
            }
        });

    } catch (error) {
        console.error('Analytics dashboard error:', error);
        res.status(500).json({ message: 'Server error fetching analytics' });
    }
});

router.get('/reports/monthly', authenticateToken, authorize('HR_ADMIN'), async (req, res) => {
    try {
        const { year, month } = req.query;
        
        const targetYear = year || new Date().getFullYear();
        const targetMonth = month || (new Date().getMonth() + 1);

        const [overview] = await pool.execute(`
            SELECT 
                COUNT(DISTINCT a.id) as total_applications,
                COUNT(DISTINCT CASE WHEN a.stage = 'SHORTLISTED' THEN a.id END) as shortlisted,
                COUNT(DISTINCT CASE WHEN a.stage IN ('SLOTS_OFFERED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'ON_HOLD') THEN a.id END) as interviews,
                COUNT(DISTINCT CASE WHEN a.stage IN ('READY_FOR_OFFER', 'OFFER_SENT') THEN a.id END) as offers_sent,
                COUNT(DISTINCT CASE WHEN a.stage = 'HIRED' THEN a.id END) as hired,
                COUNT(DISTINCT CASE WHEN a.stage = 'REJECTED' THEN a.id END) as rejected,
                COUNT(DISTINCT j.id) as active_jobs,
                AVG(ai.match_percent) as avg_match_score
            FROM Applications a
            LEFT JOIN Jobs j ON a.job_id = j.id
            LEFT JOIN AIScores ai ON a.id = ai.application_id
            WHERE YEAR(a.applied_at) = ? AND MONTH(a.applied_at) = ?
            AND a.ai_status = 'DONE'
        `, [targetYear, targetMonth]);

        const [applicationsByJob] = await pool.execute(`
            SELECT 
                j.title as job_title,
                d.name as department,
                COUNT(a.id) as applications,
                COUNT(CASE WHEN a.stage = 'SHORTLISTED' THEN 1 END) as shortlisted,
                COUNT(CASE WHEN a.stage IN ('SLOTS_OFFERED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'ON_HOLD') THEN 1 END) as interviewed,
                COUNT(CASE WHEN a.stage = 'HIRED' THEN 1 END) as hired,
                AVG(ai.match_percent) as avg_match_score
            FROM Applications a
            JOIN Jobs j ON a.job_id = j.id
            LEFT JOIN Departments d ON j.department_id = d.id
            LEFT JOIN AIScores ai ON a.id = ai.application_id
            WHERE YEAR(a.applied_at) = ? AND MONTH(a.applied_at) = ?
            AND a.ai_status = 'DONE'
            GROUP BY j.id, j.title, d.name
            ORDER BY applications DESC
        `, [targetYear, targetMonth]);

        const [departmentBreakdown] = await pool.execute(`
            SELECT 
                d.name as department,
                COUNT(DISTINCT a.id) as applications,
                COUNT(DISTINCT CASE WHEN a.stage = 'HIRED' THEN a.id END) as hired,
                COUNT(DISTINCT j.id) as jobs_posted
            FROM Departments d
            LEFT JOIN Jobs j ON d.id = j.department_id
            LEFT JOIN Applications a ON j.id = a.job_id 
                AND YEAR(a.applied_at) = ? 
                AND MONTH(a.applied_at) = ?
                AND a.ai_status = 'DONE'
            GROUP BY d.id, d.name
            HAVING applications > 0
            ORDER BY applications DESC
        `, [targetYear, targetMonth]);

        const [topCandidates] = await pool.execute(`
            SELECT 
                u.name as candidate_name,
                u.email as candidate_email,
                j.title as job_title,
                d.name as department,
                a.applied_at,
                a.updated_at as hired_at,
                ai.match_percent,
                ai.predicted_score
            FROM Applications a
            JOIN Users u ON a.candidate_id = u.id
            JOIN Jobs j ON a.job_id = j.id
            LEFT JOIN Departments d ON j.department_id = d.id
            LEFT JOIN AIScores ai ON a.id = ai.application_id
            WHERE a.stage = 'HIRED'
            AND YEAR(a.applied_at) = ? 
            AND MONTH(a.applied_at) = ?
            ORDER BY a.updated_at DESC
            LIMIT 20
        `, [targetYear, targetMonth]);

        const [interviewStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_interviews,
                COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'SCHEDULED' THEN 1 END) as scheduled,
                COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
                COUNT(CASE WHEN status = 'EXPIRED' THEN 1 END) as expired
            FROM Interviews
            WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
        `, [targetYear, targetMonth]);

        res.json({
            period: {
                year: parseInt(targetYear),
                month: parseInt(targetMonth),
                monthName: new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' })
            },
            overview: overview[0],
            applicationsByJob,
            departmentBreakdown,
            topCandidates,
            interviewStats: interviewStats[0],
            generatedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Monthly report error:', error);
        res.status(500).json({ message: 'Server error generating report' });
    }
});

module.exports = router;
