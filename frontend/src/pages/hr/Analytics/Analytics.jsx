import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardAnalytics, getMonthlyReport, exportMonthlyReportCSV } from '../../../services/analyticsService';
import { notify } from '../../../utils/notify';
import './Analytics.css';

function Analytics() {
    const navigate = useNavigate();
    const [analytics, setAnalytics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exportingReport, setExportingReport] = useState(false);
    
    const [dashboardMonth, setDashboardMonth] = useState(null);
    const [dashboardYear, setDashboardYear] = useState(null);
    const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
    const [reportYear, setReportYear] = useState(new Date().getFullYear());

    useEffect(() => {
        fetchAnalytics();
    }, [dashboardMonth, dashboardYear]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const data = await getDashboardAnalytics(dashboardYear, dashboardMonth);
            setAnalytics(data);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
            notify.error('Failed to load analytics data');
        } finally {
            setLoading(false);
        }
    };

    const handleExportReport = async () => {
        setExportingReport(true);
        try {
            const report = await getMonthlyReport(reportYear, reportMonth);
            await exportMonthlyReportCSV(report);
            notify.success('Report exported successfully');
        } catch (error) {
            console.error('Failed to export report:', error);
            notify.error('Failed to export report');
        } finally {
            setExportingReport(false);
        }
    };

    if (loading) {
        return (
            <div className="analytics-page">
                <div className="loading-state">Loading analytics...</div>
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="analytics-page">
                <div className="error-state">Failed to load analytics data</div>
            </div>
        );
    }

    const { summary, hiringTrends, vacancyStatus, pipelineCounts, departmentHiring } = analytics;

    const pipelineStages = [
        { key: 'APPLIED', label: 'Applied', color: '#3b82f6', dbStages: ['APPLIED'] },
        { key: 'SHORTLISTED', label: 'Shortlisted', color: '#8b5cf6', dbStages: ['SHORTLISTED'] },
        { key: 'INTERVIEW', label: 'Interview', color: '#f59e0b', dbStages: ['SLOTS_OFFERED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'ON_HOLD'] },
        { key: 'OFFER', label: 'Offer', color: '#10b981', dbStages: ['READY_FOR_OFFER', 'OFFER_SENT', 'OFFER_DECLINED'] },
        { key: 'HIRED', label: 'Hired', color: '#059669', dbStages: ['HIRED'] }
    ];

    const pipelineData = pipelineStages.map(stage => {
        const count = pipelineCounts
            .filter(p => stage.dbStages.includes(p.stage))
            .reduce((sum, p) => sum + p.count, 0);
        
        return {
            key: stage.key,
            label: stage.label,
            color: stage.color,
            count: count
        };
    });

    const totalInPipeline = pipelineData.reduce((sum, stage) => sum + stage.count, 0);

    return (
        <div className="analytics-page">
            <div className="analytics-header">
                <div>
                    <h1 className="analytics-title">Analytics & Reports</h1>
                    <p className="analytics-subtitle">Comprehensive hiring insights and performance metrics</p>
                </div>
            </div>

            <div className="analytics-filters">
                <div className="filter-group">
                    <label className="filter-label">View Data For:</label>
                    <select 
                        className="filter-select"
                        value={dashboardMonth || ''}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                                setDashboardMonth(null);
                                setDashboardYear(null);
                            } else {
                                setDashboardMonth(Number(value));
                                if (!dashboardYear) {
                                    setDashboardYear(new Date().getFullYear());
                                }
                            }
                        }}
                    >
                        <option value="">All Time</option>
                        {[...Array(12)].map((_, i) => {
                            const month = i + 1;
                            const currentDate = new Date();
                            const currentYear = dashboardYear || currentDate.getFullYear();
                            const currentMonth = currentDate.getMonth() + 1;
                            
                            if (dashboardYear === currentDate.getFullYear() && month > currentMonth) {
                                return null;
                            }
                            
                            return (
                                <option key={month} value={month}>
                                    {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                                </option>
                            );
                        })}
                    </select>
                    {dashboardMonth && (
                        <select 
                            className="filter-select"
                            value={dashboardYear}
                            onChange={(e) => {
                                const newYear = Number(e.target.value);
                                setDashboardYear(newYear);
                                
                                const currentDate = new Date();
                                const currentYear = currentDate.getFullYear();
                                const currentMonth = currentDate.getMonth() + 1;
                                if (newYear === currentYear && dashboardMonth > currentMonth) {
                                    setDashboardMonth(currentMonth);
                                }
                            }}
                        >
                            {[...Array(3)].map((_, i) => {
                                const year = new Date().getFullYear() - i;
                                return <option key={year} value={year}>{year}</option>;
                            })}
                        </select>
                    )}
                </div>

                <div className="export-section">
                    <span className="export-label">Export Report:</span>
                    <select 
                        className="report-month-select"
                        value={reportMonth}
                        onChange={(e) => setReportMonth(Number(e.target.value))}
                    >
                        {[...Array(12)].map((_, i) => {
                            const month = i + 1;
                            const currentDate = new Date();
                            const currentYear = currentDate.getFullYear();
                            const currentMonth = currentDate.getMonth() + 1;
                            
                            if (reportYear === currentYear && month > currentMonth) {
                                return null;
                            }
                            
                            return (
                                <option key={month} value={month}>
                                    {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                                </option>
                            );
                        })}
                    </select>
                    <select 
                        className="report-year-select"
                        value={reportYear}
                        onChange={(e) => {
                            const newYear = Number(e.target.value);
                            setReportYear(newYear);
                            
                            const currentDate = new Date();
                            const currentYear = currentDate.getFullYear();
                            const currentMonth = currentDate.getMonth() + 1;
                            if (newYear === currentYear && reportMonth > currentMonth) {
                                setReportMonth(currentMonth);
                            }
                        }}
                    >
                        {[...Array(3)].map((_, i) => {
                            const year = new Date().getFullYear() - i;
                            return <option key={year} value={year}>{year}</option>;
                        })}
                    </select>
                    <button 
                        className="btn-export-report"
                        onClick={handleExportReport}
                        disabled={exportingReport}
                    >
                        {exportingReport ? 'Exporting...' : 'Export Monthly Report'}
                    </button>
                </div>
            </div>

            <div className="summary-grid">
                <div className="summary-card">
                    <div className="summary-label">Total Applications</div>
                    <div className="summary-value">{summary.total_applications}</div>
                    <div className="summary-sub">{dashboardMonth ? 'Selected period' : 'All time'}</div>
                </div>
                <div className="summary-card">
                    <div className="summary-label">{dashboardMonth ? 'This Period' : 'This Month'}</div>
                    <div className="summary-value">{summary.applications_this_period}</div>
                    <div className="summary-sub">New applications</div>
                </div>
                <div className="summary-card">
                    <div className="summary-label">Active Offers</div>
                    <div className="summary-value">{summary.active_offers}</div>
                    <div className="summary-sub">Pending or accepted</div>
                </div>
                <div className="summary-card">
                    <div className="summary-label">Total Hired</div>
                    <div className="summary-value">{summary.total_hired}</div>
                    <div className="summary-sub">{summary.avg_time_to_hire ? `Avg ${Math.round(summary.avg_time_to_hire)} days` : dashboardMonth ? 'Selected period' : 'All time'}</div>
                </div>
            </div>

            <div className="analytics-section">
                <h2 className="section-title">Candidate Pipeline</h2>
                <p className="section-subtitle">Current candidates at each hiring stage</p>
                
                <div className="pipeline-container">
                    {pipelineData.map((stage) => (
                        <div key={stage.key} className="pipeline-stage">
                            <div className="pipeline-stage-header">
                                <span className="pipeline-stage-label">{stage.label}</span>
                                <span className="pipeline-stage-count">{stage.count}</span>
                            </div>
                            <div className="pipeline-stage-bar-container">
                                <div 
                                    className="pipeline-stage-bar"
                                    style={{
                                        width: totalInPipeline > 0 ? `${(stage.count / totalInPipeline) * 100}%` : '0%',
                                        backgroundColor: stage.color
                                    }}
                                />
                            </div>
                            <div className="pipeline-stage-percent">
                                {totalInPipeline > 0 ? Math.round((stage.count / totalInPipeline) * 100) : 0}%
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="analytics-section">
                <div className="section-header-row">
                    <div>
                        <h2 className="section-title">Vacancy Status</h2>
                        <p className="section-subtitle">All vacancies {dashboardMonth ? 'with activity in selected period' : '(open and closed with applications)'}</p>
                    </div>
                    <button className="btn-view-all" onClick={() => navigate('/hr/vacancies')}>
                        View All Vacancies
                    </button>
                </div>
                
                {vacancyStatus.length === 0 ? (
                    <div className="empty-state">No open vacancies</div>
                ) : (
                    <div className="vacancy-table-container">
                        <table className="vacancy-table">
                            <thead>
                                <tr>
                                    <th>Job Title</th>
                                    <th>Department</th>
                                    <th>Openings</th>
                                    <th>Applications</th>
                                    <th>Shortlisted</th>
                                    <th>Interview</th>
                                    <th>Offered</th>
                                    <th>Hired</th>
                                </tr>
                            </thead>
                            <tbody>
                                {vacancyStatus.map(vacancy => (
                                    <tr key={vacancy.id} onClick={() => navigate(`/hr/vacancies/${vacancy.id}/applications`)}>
                                        <td className="vacancy-title-cell">{vacancy.title}</td>
                                        <td>{vacancy.department || 'N/A'}</td>
                                        <td>{vacancy.openings}</td>
                                        <td><span className="count-badge">{vacancy.total_applications}</span></td>
                                        <td><span className="count-badge">{vacancy.shortlisted}</span></td>
                                        <td><span className="count-badge">{vacancy.in_interview}</span></td>
                                        <td><span className="count-badge">{vacancy.offered}</span></td>
                                        <td><span className="count-badge success-badge">{vacancy.hired}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="analytics-section">
                <h2 className="section-title">Department-wise Hiring</h2>
                <p className="section-subtitle">Recruitment activity breakdown by department</p>
                
                {departmentHiring.length === 0 ? (
                    <div className="empty-state">No department data available</div>
                ) : (
                    <div className="department-grid">
                        {departmentHiring.map(dept => (
                            <div key={dept.id} className="department-card">
                                <h3 className="department-name">{dept.department}</h3>
                                <div className="department-stats">
                                    <div className="dept-stat">
                                        <span className="dept-stat-label">Open Vacancies</span>
                                        <span className="dept-stat-value">{dept.open_vacancies}</span>
                                    </div>
                                    <div className="dept-stat">
                                        <span className="dept-stat-label">Applications</span>
                                        <span className="dept-stat-value">{dept.total_applications}</span>
                                    </div>
                                    <div className="dept-stat">
                                        <span className="dept-stat-label">Interviews</span>
                                        <span className="dept-stat-value">{dept.interviews_scheduled}</span>
                                    </div>
                                    <div className="dept-stat">
                                        <span className="dept-stat-label">Offers</span>
                                        <span className="dept-stat-value">{dept.offers_sent}</span>
                                    </div>
                                    <div className="dept-stat">
                                        <span className="dept-stat-label">Hired</span>
                                        <span className="dept-stat-value success-text">{dept.hired}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {hiringTrends.length > 0 && (
                <div className="analytics-section">
                    <h2 className="section-title">Hiring Trends</h2>
                    <p className="section-subtitle">Applications, interviews, and offers over time</p>
                    
                    <div className="trends-table-container">
                        <table className="trends-table">
                            <thead>
                                <tr>
                                    <th>Month</th>
                                    <th>Applications</th>
                                    <th>Interviews</th>
                                    <th>Offers</th>
                                </tr>
                            </thead>
                            <tbody>
                                {hiringTrends.map(trend => (
                                    <tr key={trend.month}>
                                        <td>{new Date(trend.month + '-01').toLocaleDateString('default', { month: 'short', year: 'numeric' })}</td>
                                        <td><span className="trend-value">{trend.applications}</span></td>
                                        <td><span className="trend-value">{trend.interviews}</span></td>
                                        <td><span className="trend-value">{trend.offers}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Analytics;
