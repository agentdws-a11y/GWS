import { useNavigate, useOutletContext } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { shortlistApplication, rejectApplication, downloadApplicationCV } from '../../../services/applicationService';
import { getAllJobs } from '../../../services/jobService';
import { notify } from '../../../utils/notify';
import ApplicationCard from '../../../components/hr/ApplicationCard';
import RejectModal from '../../../components/hr/RejectModal';
import './Applications.css';

const FILTERS = [
    { key: 'ALL', label: 'All', match: () => true },
    { key: 'APPLIED', label: 'Applied', match: (a) => a.stage === 'APPLIED' },
    { key: 'SHORTLISTED', label: 'Shortlisted', match: (a) => a.stage === 'SHORTLISTED' },
    {
        key: 'IN_INTERVIEW',
        label: 'In interview',
        match: (a) => ['SLOTS_OFFERED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'ON_HOLD'].includes(a.stage)
    },
    {
        key: 'OFFER',
        label: 'Offer',
        match: (a) => ['READY_FOR_OFFER', 'OFFER_SENT', 'OFFER_DECLINED', 'HIRED'].includes(a.stage)
    },
    { key: 'REJECTED', label: 'Rejected', match: (a) => a.stage === 'REJECTED' }
];

function Applications() {
    const navigate = useNavigate();
    const { applications, reloadApplications } = useOutletContext();

    const [activeFilter, setActiveFilter] = useState('ALL');
    const [search, setSearch] = useState('');
    const [selectedJobId, setSelectedJobId] = useState('');
    const [jobs, setJobs] = useState([]);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [rejectLoading, setRejectLoading] = useState(false);
    const [busyId, setBusyId] = useState(null);

    useEffect(() => {
        loadJobs();
    }, []);

    const loadJobs = async () => {
        try {
            const response = await getAllJobs();
            setJobs(response.jobs || []);
        } catch (err) {
            console.error('Failed to load jobs:', err);
        }
    };

    const counts = useMemo(() => {
        const result = {};
        FILTERS.forEach(f => {
            result[f.key] = applications.filter(f.match).length;
        });
        return result;
    }, [applications]);

    const visibleApplications = useMemo(() => {
        const filterDef = FILTERS.find(f => f.key === activeFilter) || FILTERS[0];
        let list = applications.filter(filterDef.match);

        if (selectedJobId) {
            list = list.filter(a => String(a.job_id) === String(selectedJobId));
        }

        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(a =>
                a.candidate_name?.toLowerCase().includes(q) ||
                a.candidate_email?.toLowerCase().includes(q) ||
                a.job_title?.toLowerCase().includes(q)
            );
        }

        return [...list].sort((a, b) => (b.match_percent || 0) - (a.match_percent || 0));
    }, [applications, activeFilter, search, selectedJobId]);

    const selectedJob = useMemo(() => {
        if (!selectedJobId) return null;
        return jobs.find(j => String(j.id) === String(selectedJobId));
    }, [selectedJobId, jobs]);

    const selectedJobAppCount = useMemo(() => {
        if (!selectedJobId) {
            return applications.length;
        }
        return applications.filter(a => String(a.job_id) === String(selectedJobId)).length;
    }, [applications, selectedJobId]);

    const handleDownloadCV = async (applicationId, filename) => {
        try {
            await downloadApplicationCV(applicationId, filename);
        } catch (err) {
            notify.error(err.message);
        }
    };

    const handleShortlist = async (applicationId) => {
        setBusyId(applicationId);
        try {
            await shortlistApplication(applicationId);
            notify.success('Candidate shortlisted');
            reloadApplications();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const handleRejectConfirm = async (reason, note) => {
        setRejectLoading(true);
        try {
            await rejectApplication(rejectTarget.id, reason, note);
            notify.success('Application rejected');
            setRejectTarget(null);
            reloadApplications();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setRejectLoading(false);
        }
    };

    const handleScheduleInterview = (application) => {
        navigate(`/hr/applications/${application.id}/schedule`);
    };

    const handleViewJob = (jobId) => {
        navigate(`/hr/vacancies/${jobId}/applications`);
    };

    const handleViewInterviews = () => {
        navigate('/hr/interviews');
    };

    return (
        <div className="ha-page">
            <header className="ha-header">
                <h1 className="ha-title">Application inbox</h1>
                <p className="ha-subtitle">
                    {selectedJob 
                        ? `${selectedJob.title} · ${selectedJobAppCount} applications, ranked by AI`
                        : 'Review, shortlist and reject candidates across all vacancies'
                    }
                </p>
            </header>

            <div className="ha-controls">
                <div className="ha-filters">
                    {FILTERS.map(f => (
                        <button
                            key={f.key}
                            className={`ha-filter-chip ${activeFilter === f.key ? 'active' : ''}`}
                            onClick={() => setActiveFilter(f.key)}
                        >
                            {f.label} {counts[f.key]}
                        </button>
                    ))}
                </div>
                <div className="ha-right-controls">
                    <select 
                        className="ha-vacancy-select"
                        value={selectedJobId}
                        onChange={(e) => setSelectedJobId(e.target.value)}
                    >
                        <option value="">All vacancies</option>
                        {jobs.map(job => (
                            <option key={job.id} value={job.id}>
                                {job.title}
                            </option>
                        ))}
                    </select>
                    <input
                        className="ha-search"
                        type="text"
                        placeholder="Search candidates or jobs"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {visibleApplications.length === 0 ? (
                <div className="ha-empty">
                    <div className="ha-empty-icon">👥</div>
                    <h3>No applications here</h3>
                    <p>Try a different filter or search term</p>
                </div>
            ) : (
                <div className="ha-list">
                    {visibleApplications.map(application => (
                        <div key={application.id} className={busyId === application.id ? 'ha-row-busy' : ''}>
                            <ApplicationCard
                                application={application}
                                onDownloadCV={handleDownloadCV}
                                onShortlist={handleShortlist}
                                onReject={setRejectTarget}
                                onScheduleInterview={handleScheduleInterview}
                                onViewJob={handleViewJob}
                                onViewInterviews={handleViewInterviews}
                            />
                        </div>
                    ))}
                </div>
            )}

            {rejectTarget && (
                <RejectModal
                    application={rejectTarget}
                    onCancel={() => setRejectTarget(null)}
                    onConfirm={handleRejectConfirm}
                    loading={rejectLoading}
                />
            )}
        </div>
    );
}

export default Applications;