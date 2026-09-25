import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useOutletContext } from 'react-router-dom';
import {
    IconSend,
    IconFileSearch,
    IconShieldCheck,
    IconAlertTriangle,
    IconSparkles,
    IconNote,
    IconUserCheck,
    IconUserX,
    IconCalendarPlus,
    IconCalendarEvent,
    IconCalendarX,
    IconCalendarTime,
    IconMessage,
    IconCircleCheck,
    IconArrowRight,
    IconPlayerPause,
    IconRefresh,
    IconCircleDot
} from '@tabler/icons-react';
import {
    getApplicationDetail,
    getApplicationEvents,
    addApplicationNote,
    getApplicationDuplicates,
    downloadApplicationCV,
    shortlistApplication,
    rejectApplication
} from '../../../services/applicationService';
import { getApplicationAssessmentResults } from '../../../services/assessmentService';
import { notify } from '../../../utils/notify';
import { getApplicationDisplayStatus } from '../../../utils/applicationStatus';
import RejectModal from '../../../components/hr/RejectModal';
import './CandidateDetail.css';

const STAGE_META = {
    APPLIED: { label: 'Applied', tone: 'tone-neutral' },
    SHORTLISTED: { label: 'Shortlisted', tone: 'tone-violet' },
    SLOTS_OFFERED: { label: 'Slots offered', tone: 'tone-blue' },
    INTERVIEW_SCHEDULED: { label: 'Interview scheduled', tone: 'tone-green' },
    INTERVIEWED: { label: 'Interviewed', tone: 'tone-yellow' },
    ON_HOLD: { label: 'On hold', tone: 'tone-neutral' },
    REJECTED: { label: 'Rejected', tone: 'tone-red' },
    READY_FOR_OFFER: { label: 'Ready for offer', tone: 'tone-green' },
    OFFER_SENT: { label: 'Offer sent', tone: 'tone-blue' },
    OFFER_DECLINED: { label: 'Offer declined', tone: 'tone-red' },
    HIRED: { label: 'Hired', tone: 'tone-green' }
};

const MATCH_META = {
    STRONG: { label: 'Strong', tone: 'tone-green' },
    POSSIBLE: { label: 'Possible', tone: 'tone-yellow' },
    NOT_A_FIT: { label: 'Not a fit', tone: 'tone-red' }
};

const EVENT_META = {
    APPLICATION_SUBMITTED: { icon: IconSend, tone: 'blue' },
    RESUME_PARSED: { icon: IconFileSearch, tone: 'green' },
    DUPLICATE_CHECK: { icon: IconShieldCheck, tone: 'green' },
    AI_RANKED: { icon: IconSparkles, tone: 'green' },
    NOTE_ADDED: { icon: IconNote, tone: 'neutral' },
    SHORTLISTED: { icon: IconUserCheck, tone: 'violet' },
    REJECTED: { icon: IconUserX, tone: 'red' },
    SLOTS_OFFERED: { icon: IconCalendarPlus, tone: 'blue' },
    SLOT_CHOSEN: { icon: IconCalendarEvent, tone: 'blue' },
    INTERVIEW_CONFIRMED: { icon: IconCalendarEvent, tone: 'green' },
    INTERVIEW_CANCELLED: { icon: IconCalendarX, tone: 'red' },
    OFFER_WITHDRAWN: { icon: IconCalendarX, tone: 'neutral' },
    OFFER_EXPIRED: { icon: IconCalendarTime, tone: 'neutral' },
    FEEDBACK_SUBMITTED: { icon: IconMessage, tone: 'violet' },
    ALL_FEEDBACK_IN: { icon: IconCircleCheck, tone: 'green' },
    MOVED_TO_NEXT_ROUND: { icon: IconArrowRight, tone: 'violet' },
    PLACED_ON_HOLD: { icon: IconPlayerPause, tone: 'neutral' },
    REOPENED: { icon: IconRefresh, tone: 'neutral' },
    OFFER_DRAFT_CREATED: { icon: IconNote, tone: 'neutral' },
    OFFER_DRAFT_REGENERATED: { icon: IconRefresh, tone: 'neutral' },
    OFFER_DRAFT_EDITED: { icon: IconNote, tone: 'neutral' },
    OFFER_SENT: { icon: IconSend, tone: 'blue' },
    OFFER_ACCEPTED: { icon: IconUserCheck, tone: 'green' },
    OFFER_DECLINED: { icon: IconUserX, tone: 'red' }
};

const NOTE_EVENT_TYPES = ['NOTE_ADDED', 'PLACED_ON_HOLD', 'MOVED_TO_NEXT_ROUND'];

function getEventMeta(ev) {
    if (ev.event_type === 'DUPLICATE_CHECK' && !/passed/i.test(ev.title || '')) {
        return { icon: IconAlertTriangle, tone: 'yellow' };
    }
    return EVENT_META[ev.event_type] || { icon: IconCircleDot, tone: 'neutral' };
}

function actorLabel(ev) {
    if (ev.actor_type === 'AI') return 'AI engine';
    if (ev.actor_type === 'SYSTEM') return 'System';
    if (ev.actor_type === 'CANDIDATE') return 'Candidate';
    return ev.actor_name || 'HR admin';
}

function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
}

function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d
        .toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        .replace(/\b(am|pm)\b/, m => m.toUpperCase());
}

function formatDate(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function CandidateDetail() {
    const { applicationId } = useParams();
    const navigate = useNavigate();
    const outlet = useOutletContext() || {};
    const reloadApplications = outlet.reloadApplications;

    const [application, setApplication] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [noteText, setNoteText] = useState('');
    const [noteSaving, setNoteSaving] = useState(false);

    const [duplicates, setDuplicates] = useState([]);
    const [duplicatesLoading, setDuplicatesLoading] = useState(true);

    const [assessments, setAssessments] = useState([]);
    const [assessmentsLoading, setAssessmentsLoading] = useState(true);

    const [rejectOpen, setRejectOpen] = useState(false);
    const [actionBusy, setActionBusy] = useState(false);

    useEffect(() => {
        loadApplication();
        loadEvents();
        loadDuplicates();
        loadAssessments();
    }, [applicationId]);

    const loadApplication = async () => {
        try {
            setLoading(true);
            setError('');
            const res = await getApplicationDetail(applicationId);
            setApplication(res.application);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadEvents = async () => {
        try {
            setEventsLoading(true);
            const res = await getApplicationEvents(applicationId);
            setEvents(res.events || []);
        } catch (err) {
            notify.error(err.message);
        } finally {
            setEventsLoading(false);
        }
    };

    const loadDuplicates = async () => {
        try {
            setDuplicatesLoading(true);
            const res = await getApplicationDuplicates(applicationId);
            setDuplicates(res.duplicateFlags || []);
        } catch (err) {
            setDuplicates([]);
        } finally {
            setDuplicatesLoading(false);
        }
    };

    const loadAssessments = async () => {
        try {
            setAssessmentsLoading(true);
            const res = await getApplicationAssessmentResults(applicationId);
            setAssessments(res.results || []);
        } catch (err) {
            setAssessments([]);
        } finally {
            setAssessmentsLoading(false);
        }
    };

    const handleAddNote = async () => {
        if (!noteText.trim()) return;
        setNoteSaving(true);
        try {
            await addApplicationNote(applicationId, noteText.trim());
            setNoteText('');
            loadEvents();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setNoteSaving(false);
        }
    };

    const handleDownload = () => {
        downloadApplicationCV(applicationId, application?.cv_original_name).catch(err => notify.error(err.message));
    };

    const handleShortlist = async () => {
        setActionBusy(true);
        try {
            await shortlistApplication(applicationId);
            notify.success('Candidate shortlisted');
            await loadApplication();
            loadEvents();
            reloadApplications?.();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setActionBusy(false);
        }
    };

    const handleRejectConfirm = async (reason, note) => {
        setActionBusy(true);
        try {
            await rejectApplication(applicationId, reason, note);
            notify.success('Application rejected');
            setRejectOpen(false);
            await loadApplication();
            loadEvents();
            reloadApplications?.();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setActionBusy(false);
        }
    };

    if (loading) {
        return (
            <div className="cdp-wrapper">
                <div className="cdp-loading">Loading candidate...</div>
            </div>
        );
    }

    if (error || !application) {
        return (
            <div className="cdp-wrapper">
                <div className="cdp-error-state">
                    <p>{error || 'Application not found'}</p>
                    <Link to="/hr/applications" className="cdp-link">Back to applications</Link>
                </div>
            </div>
        );
    }

    const stageMeta = STAGE_META[application.stage] || { label: application.stage, tone: 'tone-neutral' };
    const matchMeta = application.match_label ? MATCH_META[application.match_label] : null;
    const roundsDone = Number(application.interview_rounds) || 0;
    
    const displayStatus = getApplicationDisplayStatus(application, application.interview_scheduled_start);

    return (
        <div className="cdp-wrapper">
            <div className="cdp-breadcrumb">
                <Link to="/hr/applications" className="cdp-breadcrumb-link">Applications</Link>
                <span className="cdp-breadcrumb-sep">›</span>
                <span className="cdp-breadcrumb-mid">{application.job_title}</span>
                <span className="cdp-breadcrumb-sep">›</span>
                <span className="cdp-breadcrumb-current">{application.candidate_name}</span>
            </div>

            <div className="cdp-header">
                <div className="cdp-header-left">
                    <div className="cdp-avatar">{initials(application.candidate_name)}</div>
                    <div>
                        <div className="cdp-name-row">
                            <h1 className="cdp-name">{application.candidate_name}</h1>
                            <span className={`tone-badge ${displayStatus.tone}`}>{displayStatus.label}</span>
                        </div>
                        <p className="cdp-subline">{application.candidate_email} · Applied {formatDate(application.applied_at)}</p>
                    </div>
                </div>
                <div className="cdp-header-actions">
                    <button className="cdp-btn cdp-btn-secondary" onClick={handleDownload}>
                        Download CV
                    </button>
                    {application.stage === 'APPLIED' && (
                        <>
                            <button className="cdp-btn cdp-btn-danger" disabled={actionBusy} onClick={() => setRejectOpen(true)}>
                                Reject
                            </button>
                            <button className="cdp-btn cdp-btn-primary" disabled={actionBusy} onClick={handleShortlist}>
                                Shortlist
                            </button>
                        </>
                    )}
                    {application.stage === 'SHORTLISTED' && (
                        <>
                            <button className="cdp-btn cdp-btn-danger" disabled={actionBusy} onClick={() => setRejectOpen(true)}>
                                Reject
                            </button>
                            <button
                                className="cdp-btn cdp-btn-primary"
                                disabled={actionBusy}
                                onClick={() => navigate(`/hr/applications/${applicationId}/schedule`)}
                            >
                                Schedule interview
                            </button>
                        </>
                    )}
                    {application.stage === 'READY_FOR_OFFER' && (
                        <button
                            className="cdp-btn cdp-btn-primary"
                            onClick={() => navigate(`/hr/applications/${applicationId}/offer`)}
                        >
                            Continue offer
                        </button>
                    )}
                </div>
            </div>

            {application.stage === 'SHORTLISTED' && (
                <div className="cdp-banner">
                    <span className="cdp-banner-text">
                        <strong>{application.candidate_name} is shortlisted</strong>
                        <br />Next step: offer interview slots for Round {application.current_round || 1}.
                    </span>
                    <button
                        className="cdp-btn cdp-btn-primary"
                        onClick={() => navigate(`/hr/applications/${applicationId}/schedule`)}
                    >
                        Schedule interview
                    </button>
                </div>
            )}

            <div className="cdp-body">
                <div className="cdp-main">
                    <div className="cdp-tabs">
                        <span className="cdp-tab active">Activity</span>
                    </div>

                    {eventsLoading ? (
                        <div className="cdp-loading">Loading activity...</div>
                    ) : events.length === 0 ? (
                        <div className="cdp-empty-card">No activity yet.</div>
                    ) : (
                        <div className="cdp-timeline">
                            {events.map((ev, idx) => {
                                const meta = getEventMeta(ev);
                                const Icon = meta.icon;
                                const title = ev.event_type === 'NOTE_ADDED'
                                    ? 'Note added'
                                    : ev.event_type === 'SHORTLISTED'
                                        ? `Shortlisted for ${application.job_title}`
                                        : ev.title;

                                return (
                                    <div className="cdp-tl-item" key={ev.id}>
                                        <div className="cdp-tl-rail">
                                            <span className={`cdp-tl-icon cdp-tl-${meta.tone}`}>
                                                <Icon size={16} stroke={1.8} />
                                            </span>
                                            {idx < events.length - 1 && <span className="cdp-tl-line" />}
                                        </div>
                                        <div className="cdp-tl-content">
                                            <div className="cdp-tl-title">{title}</div>
                                            {ev.note && NOTE_EVENT_TYPES.includes(ev.event_type) && (
                                                <div className="cdp-tl-note">{ev.note}</div>
                                            )}
                                            <div className="cdp-tl-meta">
                                                {actorLabel(ev)} · {formatDateTime(ev.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="cdp-note-input-row">
                        <input
                            className="cdp-note-input"
                            type="text"
                            placeholder="Add an internal note"
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                        />
                        <button
                            className="cdp-btn cdp-btn-secondary"
                            disabled={noteSaving || !noteText.trim()}
                            onClick={handleAddNote}
                        >
                            Add note
                        </button>
                    </div>
                </div>

                <aside className="cdp-sidebar">
                    <div className="cdp-side-card">
                        <p className="cdp-side-title">Application</p>
                        <div className="cdp-detail-row">
                            <span>Stage</span>
                            <span className={`tone-badge ${displayStatus.tone}`}>{displayStatus.label}</span>
                        </div>
                        {matchMeta && (
                            <div className="cdp-detail-row">
                                <span>AI match</span>
                                <span className={`tone-badge ${matchMeta.tone}`}>{application.match_percent}% {matchMeta.label}</span>
                            </div>
                        )}
                        <div className="cdp-detail-row">
                            <span>Vacancy</span>
                            <span>{application.job_title}</span>
                        </div>
                        <div className="cdp-detail-row">
                            <span>Interview rounds</span>
                            <span>{roundsDone > 0 ? roundsDone : 'None yet'}</span>
                        </div>
                        <p className="cdp-side-note">Notes are visible to HR only. The candidate never sees this tab.</p>
                    </div>

                    {(application.matched_skills?.length > 0 || application.missing_skills?.length > 0) && (
                        <div className="cdp-side-card">
                            <p className="cdp-side-label">Skill match</p>
                            <ul className="cdp-skill-list">
                                {application.matched_skills?.map(skill => (
                                    <li key={`m-${skill}`} className="cdp-skill-item cdp-skill-matched">✓ {skill}</li>
                                ))}
                                {application.missing_skills?.map(skill => (
                                    <li key={`x-${skill}`} className="cdp-skill-item cdp-skill-missing">✕ {skill}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="cdp-side-card">
                        <p className="cdp-side-label">Duplicate check</p>
                        {duplicatesLoading ? (
                            <p className="cdp-side-subtext">Checking...</p>
                        ) : duplicates.length === 0 ? (
                            <p className="cdp-side-ok">🛡 No duplicates found</p>
                        ) : (
                            <ul className="cdp-dup-list">
                                {duplicates.map(d => (
                                    <li key={d.id}>
                                        {d.matched_candidate_name} · {d.reason.replace(/_/g, ' ').toLowerCase()}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="cdp-side-card">
                        <p className="cdp-side-label">Assessments</p>
                        {assessmentsLoading ? (
                            <p className="cdp-side-subtext">Loading...</p>
                        ) : assessments.length === 0 ? (
                            <p className="cdp-side-subtext">No assessments assigned</p>
                        ) : (
                            <div className="cdp-assessment-list">
                                {assessments.map((assessment) => (
                                    <div key={assessment.id} className="cdp-assessment-item">
                                        <div className="cdp-assessment-header">
                                            <span className="cdp-assessment-title">{assessment.template_title}</span>
                                            <span className={`cdp-assessment-status ${assessment.status.toLowerCase()}`}>
                                                {assessment.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        {assessment.status === 'GRADED' && (
                                            <>
                                                <div className="cdp-assessment-result">
                                                    <span className={`cdp-assessment-score ${assessment.passed ? 'passed' : 'failed'}`}>
                                                        {assessment.score != null ? Number(assessment.score).toFixed(1) : '0.0'}% {assessment.passed ? '✓' : '✕'}
                                                    </span>
                                                    <span className="cdp-assessment-meta">
                                                        {assessment.earned_score}/{assessment.max_score} points
                                                    </span>
                                                </div>
                                                <button
                                                    className="cdp-view-results-btn"
                                                    onClick={() => navigate(`/hr/assessments/results/${application?.id}`)}
                                                >
                                                    View Results
                                                </button>
                                            </>
                                        )}
                                        {assessment.status === 'IN_PROGRESS' && assessment.started_at && (
                                            <p className="cdp-assessment-meta">
                                                Started {formatDateTime(assessment.started_at)}
                                            </p>
                                        )}
                                        {assessment.status === 'PENDING' && assessment.deadline_at && (
                                            <p className="cdp-assessment-meta">
                                                Due {formatDateTime(assessment.deadline_at)}
                                            </p>
                                        )}
                                        {assessment.status === 'EXPIRED' && (
                                            <p className="cdp-assessment-meta-warning">
                                                Deadline passed
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>
            </div>

            {rejectOpen && (
                <RejectModal
                    application={application}
                    onCancel={() => setRejectOpen(false)}
                    onConfirm={handleRejectConfirm}
                    loading={actionBusy}
                />
            )}
        </div>
    );
}

export default CandidateDetail;