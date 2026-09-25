import { getToken } from '../utils/auth';

const API_URL = 'http://localhost:5000/api/analytics';

export const getDashboardAnalytics = async (year = null, month = null) => {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (month) params.append('month', month);
    
    const url = `${API_URL}/dashboard${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    });
    
    if (!response.ok) {
        throw new Error('Failed to fetch dashboard analytics');
    }
    
    return response.json();
};

export const getMonthlyReport = async (year, month) => {
    const params = new URLSearchParams();
    if (year) params.append('year', year);
    if (month) params.append('month', month);
    
    const response = await fetch(`${API_URL}/reports/monthly?${params}`, {
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    });
    
    if (!response.ok) {
        throw new Error('Failed to fetch monthly report');
    }
    
    return response.json();
};

export const exportMonthlyReportCSV = async (reportData) => {
    const { period, overview, applicationsByJob, departmentBreakdown, topCandidates, interviewStats } = reportData;
    
    let csv = `HYRE.AI - MONTHLY HIRING REPORT\n`;
    csv += `Period: ${period.monthName} ${period.year}\n`;
    csv += `Generated: ${new Date(reportData.generatedAt).toLocaleString()}\n\n`;
    
    csv += `OVERVIEW\n`;
    csv += `Metric,Value\n`;
    csv += `Total Applications,${overview.total_applications || 0}\n`;
    csv += `Shortlisted,${overview.shortlisted || 0}\n`;
    csv += `Interviews Conducted,${overview.interviews || 0}\n`;
    csv += `Offers Sent,${overview.offers_sent || 0}\n`;
    csv += `Hired,${overview.hired || 0}\n`;
    csv += `Rejected,${overview.rejected || 0}\n`;
    csv += `Active Jobs,${overview.active_jobs || 0}\n`;
    
    const avgMatchScore = overview.avg_match_score;
    const avgMatchScoreText = (avgMatchScore !== null && avgMatchScore !== undefined && typeof avgMatchScore === 'number') 
        ? avgMatchScore.toFixed(1) + '%' 
        : 'N/A';
    csv += `Average Match Score,${avgMatchScoreText}\n\n`;
    
    csv += `APPLICATIONS BY JOB\n`;
    csv += `Job Title,Department,Applications,Shortlisted,Interviewed,Hired,Avg Match Score\n`;
    applicationsByJob.forEach(job => {
        const jobMatchScore = job.avg_match_score;
        const jobMatchScoreText = (jobMatchScore !== null && jobMatchScore !== undefined && typeof jobMatchScore === 'number')
            ? jobMatchScore.toFixed(1) + '%'
            : 'N/A';
        csv += `"${job.job_title}","${job.department || 'N/A'}",${job.applications},${job.shortlisted},${job.interviewed},${job.hired},${jobMatchScoreText}\n`;
    });
    csv += `\n`;
    
    csv += `DEPARTMENT BREAKDOWN\n`;
    csv += `Department,Applications,Hired,Jobs Posted\n`;
    departmentBreakdown.forEach(dept => {
        csv += `"${dept.department}",${dept.applications},${dept.hired},${dept.jobs_posted}\n`;
    });
    csv += `\n`;
    
    csv += `TOP CANDIDATES HIRED\n`;
    csv += `Name,Email,Job Title,Department,Applied Date,Hired Date,Match Score,Predicted Score\n`;
    topCandidates.forEach(candidate => {
        const appliedDate = new Date(candidate.applied_at).toLocaleDateString();
        const hiredDate = new Date(candidate.hired_at).toLocaleDateString();
        csv += `"${candidate.candidate_name}","${candidate.candidate_email}","${candidate.job_title}","${candidate.department || 'N/A'}",${appliedDate},${hiredDate},${candidate.match_percent || 'N/A'}%,${candidate.predicted_score || 'N/A'}\n`;
    });
    csv += `\n`;
    
    csv += `INTERVIEW STATISTICS\n`;
    csv += `Metric,Value\n`;
    csv += `Total Interviews,${interviewStats.total_interviews || 0}\n`;
    csv += `Completed,${interviewStats.completed || 0}\n`;
    csv += `Scheduled,${interviewStats.scheduled || 0}\n`;
    csv += `Cancelled,${interviewStats.cancelled || 0}\n`;
    csv += `Expired,${interviewStats.expired || 0}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `HyreAI_Monthly_Report_${period.monthName}_${period.year}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
