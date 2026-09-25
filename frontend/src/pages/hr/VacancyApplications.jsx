import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { IconChevronDown } from '@tabler/icons-react';
import { getJobById } from '../../services/jobService';
import { getJobApplications } from '../../services/applicationService';
import { getInterviews } from '../../services/interviewService';
import { toSkillList, formatClosingDate } from '../../utils/jobDisplay';
import { parseLocalDateTime, formatDay, formatTime, getInitials } from '../../utils/interviewTime';
import { getApplicationDisplayStatus } from '../../utils/applicationStatus';
import './VacancyApplications.css';

const STAGE_LABELS = {
    APPLIED: 'Applied',
    SHORTLISTED: 'Shortlisted',
    SLOTS_OFFERED: 'Slots offered',
    INTERVIEW_SCHEDULED: 'Interview scheduled',
    INTERVIEWED: 'Interviewed',
    ON_HOLD: 'On hold',
    REJECTED: 'Rejected',
    READY_FOR_OFFER: 'Ready for offer',
    OFFER_SENT: 'Offer sent',
    OFFER_DECLINED: 'Offer declined',
    HIRED: 'Hired'
};

const MATCH_LABELS = {
    STRONG: 'Strong',
    POSSIBLE: 'Possible',
    NOT_A_FIT: 'Not a fit'
};

const MATCH_CLASSES = {
    STRONG: 'vpipe-match-strong',
    POSSIBLE: 'vpipe-match-possible',
    NOT_A_FIT: 'vpipe-match-weak'
};

const INTERVIEW_STATUS_OPTIONS = [
    { value: 'slots', label: 'Slots offered' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'pending', label: 'Feedback pending' },
    { value: 'added', label: 'Feedback added' },
    { value: 'closed', label: 'Cancelled or expired' }
];

function getInterviewState(interview) {
    const start = parseLocalDateTime(interview.scheduled_start);
    const total = interview.feedback_total || 0;
    const submitted = Number(interview.feedback_submitted) || 0;
    const feedbackLine = `${submitted} of ${total} ${total === 1 ? 'interviewer' : 'interviewers'}`;

    if (interview.status === 'SLOTS_OFFERED') {
        const count = interview.slot_count || 0;
        return {
            key: 'slots',
            label: 'Slots offered',
            sub: `${count} ${count === 1 ? 'slot' : 'slots'} · reply pending`
        };
    }

    if (interview.status === 'SCHEDULED') {
        if (start && start > new Date()) {
            return { key: 'scheduled', label: 'Scheduled', sub: 'Confirmed by candidate' };
        }
        return { key: 'pending', label: 'Feedback pending', sub: feedbackLine };
    }

    if (interview.status === 'COMPLETED') {
        return { key: 'added', label: 'Feedback added', sub: feedbackLine };
    }

    if (interview.status === 'EXPIRED') {
        return { key: 'closed', label: 'Offer expired', sub: '' };
    }

    return { key: 'closed', label: 'Cancelled', sub: '' };
}

function VacancyApplications() {
    const { jobId } = useParams();
    const navigate = useNavigate();
    const outlet = useOutletContext() || {};
    const jobs = outlet.jobs || [];

    const [job, setJob] = useState(null);
    const [applications, setApplications] = useState([]);
    const [interviews, setInterviews] = useState([]);
    const [activeTab, setActiveTab] = useState('candidates');
    const [roundFilter, setRoundFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [interviewsLoading, setInterviewsLoading] = useState(true);
    const [error, setError] = useState('');
    const [interviewsError, setInterviewsError] = useState('');

    useEffect(() => {
        loadJob();
        loadApplications();
        loadInterviews();
    }, [jobId]);

    const loadJob = async () => {
        const cached = jobs.find(j => String(j.id) === jobId);
        if (cached) {
            setJob(cached);
            return;
        }
        try {
            const response = await getJobById(jobId);
            setJob(response.job);
        } catch (err) {
            setError('Could not load this vacancy');
        }
    };

    const loadApplications = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await getJobApplications(jobId);
            setApplications(response.applications || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadInterviews = async () => {
        try {
            setInterviewsLoading(true);
            setInterviewsError('');
            const response = await getInterviews({ job_id: jobId });
            setInterviews(response.interviews || []);
        } catch (err) {
            setInterviewsError(err.message);
        } finally {
            setInterviewsLoading(false);
        }
    };

    const counts = useMemo(() => {
        const count = (stage) => applications.filter(a => a.stage === stage).length;
        return {
            applied: count('APPLIED'),
            shortlisted: count('SHORTLISTED'),
            slotsOffered: count('SLOTS_OFFERED'),
            scheduled: count('INTERVIEW_SCHEDULED'),
            interviewed: count('INTERVIEWED'),
            hired: count('HIRED'),
            rejected: count('REJECTED')
        };
    }, [applications]);

    const interviewRows = useMemo(
        () => interviews.map(interview => ({ interview, state: getInterviewState(interview) })),
        [interviews]
    );

    const slotRows = useMemo(
        () => interviewRows.filter(row => row.state.key === 'slots'),
        [interviewRows]
    );

    const rounds = useMemo(
        () => [...new Set(interviews.map(i => i.round_number))].sort((a, b) => a - b),
        [interviews]
    );

    const filteredInterviewRows = useMemo(() => {
        return interviewRows.filter(({ interview, state }) => {
            if (roundFilter && String(interview.round_number) !== roundFilter) return false;
            if (statusFilter && state.key !== statusFilter) return false;
            return true;
        });
    }, [interviewRows, roundFilter, statusFilter]);

    const skillsArray = job ? toSkillList(job.required_skills) : [];

    const getStatusClass = (status) => {
        switch (status?.toUpperCase()) {
            case 'OPEN': return 'vpipe-status-badge-open';
            case 'DRAFT': return 'vpipe-status-badge-draft';
            case 'CLOSED': return 'vpipe-status-badge-closed';
            default: return 'vpipe-status-badge-draft';
        }
    };

    const getStatusText = (status) => {
        if (!status) return 'Draft';
        return status.charAt(0) + status.slice(1).toLowerCase();
    };

    const buildMeta = () => {
        if (!job) return '';
        const place = [job.location, job.work_mode ? job.work_mode.toLowerCase() : null]
            .filter(Boolean)
            .join(', ');
        const parts = [job.department, place];
        if (job.application_deadline) {
            parts.push(`Closes ${formatClosingDate(job.application_deadline)}`);
        }
        return parts.filter(Boolean).join(' · ');
    };

    const getRowAction = ({ interview, state }) => {
        switch (state.key) {
            case 'slots':
                return { label: 'View slots', to: '/hr/interviews' };
            case 'scheduled':
                return { label: 'View', to: '/hr/interviews' };
            case 'pending':
                return { label: 'Add feedback', to: `/hr/interviews/${interview.id}/feedback` };
            case 'added':
                return {
                    label: interview.application_stage === 'INTERVIEWED' ? 'Decide' : 'View review',
                    to: `/hr/applications/${interview.application_id}/review`
                };
            default:
                return null;
        }
    };

    const renderWhen = ({ interview, state }) => {
        if (state.key === 'slots') {
            const offered = parseLocalDateTime(interview.offered_at);
            return (
                <>
                    <div className="vpipe-when-main">Not chosen</div>
                    {offered && <div className="vpipe-when-sub">Offered {formatDay(offered)}</div>}
                </>
            );
        }

        const start = parseLocalDateTime(interview.scheduled_start);
        if (!start) return <span className="vpipe-when-sub">-</span>;

        return (
            <>
                <div className="vpipe-when-main">{formatDay(start)}</div>
                <div className="vpipe-when-sub">{formatTime(start)}</div>
            </>
        );
    };

    const renderInterviewTable = (rows, totalCount) => {
        if (interviewsLoading) {
            return <div className="vpipe-loading">Loading interviews...</div>;
        }

        if (interviewsError) {
            return (
                <div className="vpipe-error">
                    {interviewsError}{' '}
                    <button type="button" className="vpipe-retry" onClick={loadInterviews}>
                        Try again
                    </button>
                </div>
            );
        }

        if (rows.length === 0) {
            const nothingYet = totalCount === 0;
            return (
                <div className="vpipe-empty-card">
                    <h3 className="vpipe-empty-title">
                        {nothingYet ? 'No interviews yet' : 'No interviews match these filters'}
                    </h3>
                    <p className="vpipe-empty-text">
                        {nothingYet
                            ? 'Shortlist a candidate and offer interview times to see them here.'
                            : 'Change the round or status filter to see more.'}
                    </p>
                </div>
            );
        }

        return (
            <div className="vpipe-table-container">
                <table className="vpipe-table">
                    <thead>
                        <tr>
                            <th>Candidate</th>
                            <th>Round</th>
                            <th>Status</th>
                            <th>When</th>
                            <th>Panel</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const { interview, state } = row;
                            const action = getRowAction(row);

                            return (
                                <tr key={interview.id}>
                                    <td>
                                        <div className="vpipe-candidate-cell">
                                            <div className="vpipe-avatar">{getInitials(interview.candidate_name || '')}</div>
                                            <div>
                                                <div className="vpipe-candidate-name">{interview.candidate_name || 'Unknown'}</div>
                                                {interview.match_percent != null && (
                                                    <div className="vpipe-match-sub">{interview.match_percent}% match</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="vpipe-round-cell">Round {interview.round_number}</td>
                                    <td>
                                        <span className={`vpipe-ipill vpipe-ipill-${state.key}`}>{state.label}</span>
                                        {state.sub && <div className="vpipe-status-sub">{state.sub}</div>}
                                    </td>
                                    <td>{renderWhen(row)}</td>
                                    <td>
                                        <div className="vpipe-panel">
                                            {(interview.panel || []).map(member => (
                                                <span key={member.id} className="vpipe-panel-avatar" title={member.name}>
                                                    {getInitials(member.name)}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="vpipe-action-cell">
                                        {action && (
                                            <button
                                                type="button"
                                                className="vpipe-action-btn"
                                                onClick={() => navigate(action.to)}
                                            >
                                                {action.label}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                <div className="vpipe-table-footer">
                    Showing {rows.length} of {totalCount} {totalCount === 1 ? 'interview' : 'interviews'} for this vacancy.
                </div>
            </div>
        );
    };

    if (loading && !job) {
        return (
            <div className="vpipe-wrapper">
                <div className="vpipe-loading">Loading vacancy...</div>
            </div>
        );
    }

    return (
        <div className="vpipe-wrapper">
            <div className="vpipe-breadcrumb">
                <Link to="/hr/vacancies" className="vpipe-breadcrumb-link">Vacancies</Link>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="vpipe-breadcrumb-chevron">
                    <path d="M4.5 2.25L8.25 6L4.5 9.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="vpipe-breadcrumb-current">{job?.title || 'Vacancy'}</span>
            </div>

            <div className="vpipe-header">
                <div className="vpipe-header-left">
                    <div className="vpipe-title-row">
                        <h1 className="vpipe-title">{job?.title || 'Vacancy'}</h1>
                        {job && (
                            <span className={`vpipe-status-badge ${getStatusClass(job.status)}`}>
                                {getStatusText(job.status)}
                            </span>
                        )}
                    </div>
                    {job && <p className="vpipe-meta">{buildMeta()}</p>}
                </div>
                <div className="vpipe-header-actions">
                    <button
                        className="vpipe-btn-outlined"
                        onClick={() => navigate(`/hr/vacancies/${jobId}/edit`)}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M11.333 2.00004C11.5081 1.82494 11.716 1.68605 11.9447 1.59129C12.1735 1.49653 12.4187 1.44775 12.6663 1.44775C12.914 1.44775 13.1592 1.49653 13.3879 1.59129C13.6167 1.68605 13.8246 1.82494 13.9997 2.00004C14.1748 2.17513 14.3137 2.383 14.4084 2.61178C14.5032 2.84055 14.552 3.08575 14.552 3.33337C14.552 3.58099 14.5032 3.82619 14.4084 4.05497C14.3137 4.28374 14.1748 4.49161 13.9997 4.66671L5.33301 13.3334L2.66634 14L3.33301 11.3334L11.333 2.00004Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Edit vacancy
                    </button>
                    <button
                        className="vpipe-btn-outlined"
                        onClick={() => navigate('/hr/applications')}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M10 2H13.3333C13.5101 2 13.6797 2.07024 13.8047 2.19526C13.9298 2.32029 14 2.48986 14 2.66667V13.3333C14 13.5101 13.9298 13.6797 13.8047 13.8047C13.6797 13.9298 13.5101 14 13.3333 14H2.66667C2.48986 14 2.32029 13.9298 2.19526 13.8047C2.07024 13.6797 2 13.5101 2 13.3333V2.66667C2 2.48986 2.07024 2.32029 2.19526 2.19526C2.32029 2.07024 2.48986 2 2.66667 2H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M10 5.33333V1.33333H6V5.33333H10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Open inbox
                    </button>
                </div>
            </div>

            {skillsArray.length > 0 && (
                <div className="vpipe-skills-section">
                    <p className="vpipe-skills-label">Required skills</p>
                    <div className="vpipe-skills-list">
                        {skillsArray.map((skill, idx) => (
                            <span key={idx} className="vpipe-skill-chip">{skill}</span>
                        ))}
                    </div>
                </div>
            )}

            <div className="vpipe-stats-grid">
                <div className="vpipe-stat-card vpipe-stat-applied">
                    <div className="vpipe-stat-label">Applied</div>
                    <div className="vpipe-stat-number">{counts.applied}</div>
                </div>
                <div className="vpipe-stat-card vpipe-stat-shortlisted">
                    <div className="vpipe-stat-label">Shortlisted</div>
                    <div className="vpipe-stat-number">{counts.shortlisted}</div>
                </div>
                <div className="vpipe-stat-card vpipe-stat-slots">
                    <div className="vpipe-stat-label">Slots offered</div>
                    <div className="vpipe-stat-number">{counts.slotsOffered}</div>
                </div>
                <div className="vpipe-stat-card vpipe-stat-scheduled">
                    <div className="vpipe-stat-label">Scheduled</div>
                    <div className="vpipe-stat-number">{counts.scheduled}</div>
                </div>
                <div className="vpipe-stat-card vpipe-stat-interviewed">
                    <div className="vpipe-stat-label">Interviewed</div>
                    <div className="vpipe-stat-number">{counts.interviewed}</div>
                </div>
                <div className="vpipe-stat-card vpipe-stat-hired">
                    <div className="vpipe-stat-label">Hired</div>
                    <div className="vpipe-stat-number">{counts.hired}</div>
                </div>
                <div className="vpipe-stat-card vpipe-stat-rejected">
                    <div className="vpipe-stat-label">Rejected</div>
                    <div className="vpipe-stat-number">{counts.rejected}</div>
                </div>
            </div>

            <div className="vpipe-tabs">
                <button
                    className={`vpipe-tab ${activeTab === 'candidates' ? 'active' : ''}`}
                    onClick={() => setActiveTab('candidates')}
                >
                    Candidates {applications.length}
                </button>
                <button
                    className={`vpipe-tab ${activeTab === 'interviews' ? 'active' : ''}`}
                    onClick={() => setActiveTab('interviews')}
                >
                    Interviews {interviews.length}
                </button>
                <button
                    className={`vpipe-tab ${activeTab === 'slots' ? 'active' : ''}`}
                    onClick={() => setActiveTab('slots')}
                >
                    Slots offered {slotRows.length}
                </button>
            </div>

            {error && <div className="vpipe-error">{error}</div>}

            {activeTab === 'candidates' && (
                <>
                    {loading ? (
                        <div className="vpipe-loading">Loading applications...</div>
                    ) : applications.length === 0 ? (
                        <div className="vpipe-empty-card">
                            <div className="vpipe-empty-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="9" cy="7" r="4"></circle>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                                </svg>
                            </div>
                            <h3 className="vpipe-empty-title">No applications yet</h3>
                            <p className="vpipe-empty-text">Applications for this vacancy will appear here once candidates apply</p>
                        </div>
                    ) : (
                        <div className="vpipe-table-container">
                            <table className="vpipe-table">
                                <thead>
                                    <tr>
                                        <th>Candidate</th>
                                        <th>Stage</th>
                                        <th>Applied</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {applications.map(app => {
                                        const displayStatus = getApplicationDisplayStatus(app, app.interview_scheduled_start);
                                        
                                        return (
                                            <tr key={app.id}>
                                                <td>
                                                    <div className="vpipe-candidate-cell">
                                                        <div className="vpipe-avatar">{getInitials(app.candidate_name || '')}</div>
                                                        <div>
                                                            <div className="vpipe-candidate-name">{app.candidate_name || 'Unknown'}</div>
                                                            {app.match_label && (
                                                                <div className={`vpipe-match-badge ${MATCH_CLASSES[app.match_label] || 'vpipe-match-possible'}`}>
                                                                    {app.match_percent ?? 0}% {MATCH_LABELS[app.match_label] || ''}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className={`vpipe-status-pill vpipe-status-pill-${displayStatus.stage?.toLowerCase()}`}>
                                                        {displayStatus.label}
                                                    </div>
                                                </td>
                                                <td className="vpipe-date-cell">
                                                    {app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-GB', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    }) : '-'}
                                                </td>
                                                <td className="vpipe-action-cell">
                                                    <button
                                                        className="vpipe-action-btn"
                                                        onClick={() => navigate('/hr/applications')}
                                                    >
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="vpipe-table-footer">
                                Showing {applications.length} of {applications.length} candidates for this vacancy.
                            </div>
                        </div>
                    )}
                </>
            )}

            {activeTab === 'interviews' && (
                <>
                    <div className="vpipe-filters">
                        <div className="vpipe-select-wrap">
                            <select
                                className="vpipe-select"
                                aria-label="Filter by round"
                                value={roundFilter}
                                onChange={(e) => setRoundFilter(e.target.value)}
                            >
                                <option value="">All rounds</option>
                                {rounds.map(round => (
                                    <option key={round} value={String(round)}>Round {round}</option>
                                ))}
                            </select>
                            <IconChevronDown className="vpipe-select-chevron" size={16} stroke={1.75} />
                        </div>

                        <div className="vpipe-select-wrap">
                            <select
                                className="vpipe-select"
                                aria-label="Filter by status"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="">All statuses</option>
                                {INTERVIEW_STATUS_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                            <IconChevronDown className="vpipe-select-chevron" size={16} stroke={1.75} />
                        </div>
                    </div>

                    {renderInterviewTable(filteredInterviewRows, interviews.length)}
                </>
            )}

            {activeTab === 'slots' && renderInterviewTable(slotRows, slotRows.length)}
        </div>
    );
}

export default VacancyApplications;