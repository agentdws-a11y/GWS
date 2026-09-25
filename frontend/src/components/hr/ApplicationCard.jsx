import { useNavigate } from 'react-router-dom';
import { AVAILABILITY_LABELS, formatSalary } from '../../utils/labels';
import { getApplicationDisplayStatus } from '../../utils/applicationStatus';
import './ApplicationCard.css';

const MATCH_META = {
    STRONG: { label: 'Strong', tone: 'tone-green' },
    POSSIBLE: { label: 'Possible', tone: 'tone-yellow' },
    NOT_A_FIT: { label: 'Not a fit', tone: 'tone-red' }
};

const DUPLICATE_REASON_LABELS = {
    SAME_EMAIL: 'Same email as another candidate',
    SAME_PHONE: 'Same phone number as another candidate',
    SIMILAR_CV: 'Resume looks similar to another candidate'
};

function initials(name) {
    if (!name) return '?';
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('');
}

function ApplicationCard({ application, onDownloadCV, onShortlist, onReject, onScheduleInterview, onViewJob, onViewInterviews }) {
    const navigate = useNavigate();
    
    const displayStatus = getApplicationDisplayStatus(application, application.interview_scheduled_start);
    const stageMeta = { label: displayStatus.label, tone: displayStatus.tone };
    
    const matchMeta = application.match_label ? MATCH_META[application.match_label] : null;
    const duplicateReasons = application.duplicate_reasons ? application.duplicate_reasons.split(',') : [];

    const handleDownload = () => {
        onDownloadCV(application.id, application.cv_original_name);
    };

    return (
        <div className="hac-card">
            <div className="hac-main">
                <div className="hac-avatar">{initials(application.candidate_name)}</div>

                <div className="hac-body">
                    <div className="hac-top-row">
                        <div>
                            <h3
                                className="hac-name hac-name-link"
                                onClick={() => navigate(`/hr/applications/${application.id}`)}
                            >
                                {application.candidate_name}
                            </h3>
                            <p className="hac-email">{application.candidate_email}</p>
                        </div>
                        <span className={`tone-badge ${stageMeta.tone}`}>{stageMeta.label}</span>
                    </div>

                    {application.job_title && (
                        <p className="hac-job-line">
                            Applied for{' '}
                            {onViewJob ? (
                                <span className="hac-job-link" onClick={() => onViewJob(application.job_id)}>
                                    {application.job_title}
                                </span>
                            ) : (
                                <strong>{application.job_title}</strong>
                            )}
                            {application.job_department ? ` · ${application.job_department}` : ''}
                        </p>
                    )}

                    <div className="hac-extra-row">
                        {application.phone && <span>{application.phone}</span>}
                        {application.expected_salary && <span>Expects PKR {formatSalary(application.expected_salary)}</span>}
                        {application.availability && (
                            <span>{AVAILABILITY_LABELS[application.availability] || application.availability}</span>
                        )}
                    </div>

                    {matchMeta && (
                        <div className="hac-match-row">
                            <span className={`tone-badge ${matchMeta.tone}`}>
                                {application.match_percent}% · {matchMeta.label}
                            </span>
                            {application.matched_skills?.length > 0 && (
                                <div className="hac-chip-group">
                                    {application.matched_skills.map(skill => (
                                        <span key={skill} className="hac-chip hac-chip-matched">{skill}</span>
                                    ))}
                                </div>
                            )}
                            {application.missing_skills?.length > 0 && (
                                <div className="hac-chip-group">
                                    {application.missing_skills.map(skill => (
                                        <span key={skill} className="hac-chip hac-chip-missing">{skill}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {duplicateReasons.length > 0 && (
                        <div className="hac-duplicate-warning">
                            <strong>Possible duplicate</strong>
                            <p>{duplicateReasons.map(r => DUPLICATE_REASON_LABELS[r] || r).join('; ')}</p>
                        </div>
                    )}

                    {application.assessment_count > 0 && (
                        <div className="hac-assessment-row">
                            <span className="hac-assessment-badge">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                                </svg>
                                {application.assessment_completed || 0} / {application.assessment_count || 0} assessments completed
                            </span>
                            <button 
                                className="hac-btn-text"
                                onClick={() => navigate(`/hr/assessments/results/${application.id}`)}
                            >
                                View results
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="hac-actions">
                <button className="hac-btn hac-btn-secondary" onClick={handleDownload}>
                    Download CV
                </button>

                {application.stage === 'APPLIED' && (
                    <>
                        <button className="hac-btn hac-btn-primary" onClick={() => onShortlist(application.id)}>
                            Shortlist
                        </button>
                        <button className="hac-btn hac-btn-danger" onClick={() => onReject(application)}>
                            Reject
                        </button>
                    </>
                )}

                {application.stage === 'SHORTLISTED' && (
                    <>
                        <button className="hac-btn hac-btn-primary" onClick={() => onScheduleInterview(application)}>
                            Schedule interview
                        </button>
                        <button className="hac-btn hac-btn-danger" onClick={() => onReject(application)}>
                            Reject
                        </button>
                    </>
                )}

                {['SLOTS_OFFERED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'ON_HOLD'].includes(application.stage) && (
                    <button className="hac-btn hac-btn-secondary" onClick={() => onViewInterviews(application.id)}>
                        {displayStatus.stage === 'FEEDBACK_PENDING' ? 'Add feedback' : 'View interview'}
                    </button>
                )}

                {['READY_FOR_OFFER', 'OFFER_SENT', 'OFFER_DECLINED', 'HIRED'].includes(application.stage) && (
                    <button
                        className="hac-btn hac-btn-primary"
                        onClick={() => navigate(`/hr/applications/${application.id}/offer`)}
                    >
                        {application.stage === 'READY_FOR_OFFER' ? 'Continue offer' : 'View offer'}
                    </button>
                )}
            </div>
        </div>
    );
}

export default ApplicationCard;