import { useState, useEffect } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
    IconArrowRight,
    IconChevronDown,
    IconCircleCheck,
    IconCircleX,
    IconFileText,
    IconPlayerPause
} from '@tabler/icons-react';
import { getApplicationDetail } from '../../../services/applicationService';
import {
    getInterviews,
    getFeedback,
    getPanelMembers,
    submitDecision,
    reopenApplication
} from '../../../services/interviewService';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { notify } from '../../../utils/notify';
import { getInitials } from '../../../utils/interviewTime';
import '../../../styles/toneBadges.css';
import './InterviewReview.css';

const RATING_FIELDS = [
    { key: 'technical', label: 'Technical' },
    { key: 'problem_solving', label: 'Problem solving' },
    { key: 'communication', label: 'Communication' },
    { key: 'culture_fit', label: 'Culture fit' }
];

const REC_LABELS = { NEXT_ROUND: 'Next round', HIRE: 'Hire', HOLD: 'Hold', REJECT: 'Reject' };
const REC_TONES = { NEXT_ROUND: 'green', HIRE: 'green', HOLD: 'yellow', REJECT: 'red' };

const MATCH = {
    STRONG: { label: 'Strong', tone: 'green' },
    POSSIBLE: { label: 'Possible', tone: 'yellow' },
    NOT_A_FIT: { label: 'Not a fit', tone: 'red' }
};

const CHOICES = [
    { value: 'NEXT_ROUND', label: 'Move to next round', tone: 'green', Icon: IconCircleCheck },
    { value: 'HIRE', label: 'Hire (prepare offer)', tone: 'green', Icon: IconFileText },
    { value: 'HOLD', label: 'Hold for later', tone: 'yellow', Icon: IconPlayerPause },
    { value: 'REJECT', label: 'Reject', tone: 'red', Icon: IconCircleX }
];

const ROUND_NAMES = ['Technical interview', 'Final interview', 'HR interview'];
const ROUND_NAME_BY_NUMBER = { 1: ROUND_NAMES[0], 2: ROUND_NAMES[1], 3: ROUND_NAMES[2] };

const REJECTION_REASONS = [
    { value: 'FAILED_INTERVIEW', label: 'Failed interview' },
    { value: 'SKILLS_MISMATCH', label: 'Skills mismatch' },
    { value: 'NOT_ENOUGH_EXPERIENCE', label: 'Not enough experience' },
    { value: 'POSITION_FILLED', label: 'Position filled' },
    { value: 'DUPLICATE_APPLICATION', label: 'Duplicate application' },
    { value: 'OTHER', label: 'Other' }
];

function suggestChoice(submitted) {
    const counts = { NEXT_ROUND: 0, HIRE: 0, HOLD: 0, REJECT: 0 };
    submitted.forEach(f => {
        if (counts[f.recommendation] !== undefined) counts[f.recommendation] += 1;
    });
    return CHOICES.reduce((best, c) => (counts[c.value] > counts[best] ? c.value : best), 'NEXT_ROUND');
}

function InterviewReview() {
    const { applicationId } = useParams();
    const navigate = useNavigate();
    const outletContext = useOutletContext();
    const reloadApplications = outletContext?.reloadApplications;

    const [application, setApplication] = useState(null);
    const [interviews, setInterviews] = useState([]);
    const [panelMembers, setPanelMembers] = useState([]);
    const [feedbackByInterview, setFeedbackByInterview] = useState({});
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [choice, setChoice] = useState('NEXT_ROUND');
    const [nextRoundName, setNextRoundName] = useState(ROUND_NAMES[1]);
    const [interviewerIds, setInterviewerIds] = useState([]);
    const [holdNote, setHoldNote] = useState('');
    const [rejectReason, setRejectReason] = useState('FAILED_INTERVIEW');
    const [rejectNote, setRejectNote] = useState('');
    const [confirmReject, setConfirmReject] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadAll();
    }, [applicationId]);

    const loadAll = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const [appRes, listRes, panelRes] = await Promise.all([
                getApplicationDetail(applicationId),
                getInterviews(),
                getPanelMembers()
            ]);
            const app = appRes.application;

            const mine = (listRes.interviews || [])
                .filter(iv => String(iv.application_id) === String(applicationId)
                    && ['SCHEDULED', 'COMPLETED'].includes(iv.status))
                .sort((a, b) => a.round_number - b.round_number);

            setApplication(app);
            setInterviews(mine);
            setPanelMembers(panelRes.panelMembers || []);
            setNextRoundName(ROUND_NAME_BY_NUMBER[app.current_round + 1] || ROUND_NAMES[1]);

            const latest = mine[mine.length - 1];
            if (latest) {
                setActiveId(latest.id);
                setInterviewerIds((latest.panel || []).map(p => p.id));
            }
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!activeId || feedbackByInterview[activeId]) return;
        let cancelled = false;
        getFeedback(activeId)
            .then(res => {
                if (cancelled) return;
                const list = res.feedback || [];
                setFeedbackByInterview(prev => ({ ...prev, [activeId]: list }));
                setChoice(suggestChoice(list.filter(f => f.status === 'SUBMITTED')));
            })
            .catch(err => {
                if (cancelled) return;
                notify.error(err.message);
                setFeedbackByInterview(prev => ({ ...prev, [activeId]: [] }));
            });
        return () => { cancelled = true; };
    }, [activeId]);

    const refreshApplication = async () => {
        const res = await getApplicationDetail(applicationId);
        setApplication(res.application);
        if (reloadApplications) reloadApplications();
    };

    const toggleInterviewer = (id) => {
        setInterviewerIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
    };

    const handleNextRound = async () => {
        if (saving || interviewerIds.length === 0) return;
        setSaving(true);
        try {
            await submitDecision(applicationId, {
                action: 'NEXT_ROUND',
                next_round_name: nextRoundName,
                panel_member_ids: interviewerIds
            });
            notify.success('Moved to the next round');
            if (reloadApplications) reloadApplications();
            navigate(`/hr/applications/${applicationId}/schedule`, {
                state: { interviewerIds, roundName: nextRoundName }
            });
        } catch (err) {
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleHold = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await submitDecision(applicationId, { action: 'HOLD', note: holdNote.trim() || undefined });
            notify.success('Candidate put on hold');
            await refreshApplication();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async () => {
        setConfirmReject(false);
        if (saving) return;
        setSaving(true);
        try {
            await submitDecision(applicationId, {
                action: 'REJECT',
                rejection_reason: rejectReason,
                rejection_note: rejectNote.trim() || undefined
            });
            notify.success('Candidate rejected');
            await refreshApplication();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleReopen = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await reopenApplication(applicationId);
            notify.success('Decision reopened');
            await refreshApplication();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="hrv-page"><p className="hrv-state">Loading...</p></div>;
    }

    if (loadError || !application) {
        return (
            <div className="hrv-page">
                <div className="hrv-notice">
                    <h2>Could not open this review</h2>
                    <p>{loadError || 'Application not found.'}</p>
                    <Link to="/hr/applications" className="hrv-btn hrv-btn-secondary">Back to applications</Link>
                </div>
            </div>
        );
    }

    if (interviews.length === 0) {
        return (
            <div className="hrv-page">
                <div className="hrv-notice">
                    <h2>No interview to review yet</h2>
                    <p>{application.candidate_name} has no interview that has been confirmed. Reviews open after an interview is scheduled.</p>
                    <Link to="/hr/applications" className="hrv-btn hrv-btn-secondary">Back to applications</Link>
                </div>
            </div>
        );
    }

    const active = interviews.find(iv => iv.id === activeId) || interviews[interviews.length - 1];
    const feedback = feedbackByInterview[active.id];
    const feedbackLoading = !feedback;
    const submitted = (feedback || [])
        .filter(f => f.status === 'SUBMITTED')
        .sort((a, b) => (a.interviewer_name || '').localeCompare(b.interviewer_name || ''));

    const panelSize = (active.panel || []).length || active.feedback_total || 0;
    const scores = submitted.flatMap(f => RATING_FIELDS.map(r => f[r.key]).filter(v => v !== null && v !== undefined));
    const average = scores.length ? (scores.reduce((sum, v) => sum + v, 0) / scores.length).toFixed(1) : '–';
    const recommendNext = submitted.filter(f => f.recommendation === 'NEXT_ROUND').length;

    const nextRoundNumber = application.current_round + 1;
    const canDecide = application.stage === 'INTERVIEWED' && active.round_number === application.current_round;
    const match = MATCH[application.match_label];

    const renderPanel = (value) => {
        if (value === 'NEXT_ROUND') {
            return (
                <div className="hrv-panel">
                    <label className="hrv-label" htmlFor="hrv-next-round">Next round</label>
                    <div className="hrv-select-wrap">
                        <select
                            id="hrv-next-round"
                            className="hrv-select"
                            value={nextRoundName}
                            onChange={(e) => setNextRoundName(e.target.value)}
                        >
                            {ROUND_NAMES.map(name => (
                                <option key={name} value={name}>Round {nextRoundNumber} · {name}</option>
                            ))}
                        </select>
                        <IconChevronDown className="hrv-select-chevron" size={18} stroke={1.75} />
                    </div>

                    <span className="hrv-label" id="hrv-interviewers-label">Interviewers</span>
                    <div className="hrv-chips" role="group" aria-labelledby="hrv-interviewers-label">
                        {panelMembers.map(member => {
                            const on = interviewerIds.includes(member.id);
                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    aria-pressed={on}
                                    className={`hrv-chip ${on ? 'hrv-chip-on' : ''}`}
                                    onClick={() => toggleInterviewer(member.id)}
                                >
                                    {member.name}
                                </button>
                            );
                        })}
                    </div>
                    {interviewerIds.length === 0 && (
                        <p className="hrv-hint">Choose at least one interviewer.</p>
                    )}

                    <button
                        type="button"
                        className="hrv-btn hrv-btn-primary"
                        onClick={handleNextRound}
                        disabled={saving || interviewerIds.length === 0}
                    >
                        <IconArrowRight size={18} stroke={1.75} />
                        {saving ? 'Saving...' : 'Continue to offer slots'}
                    </button>
                </div>
            );
        }
        if (value === 'HIRE') {
            return (
                <div className="hrv-panel">
                    <p className="hrv-hint">
                        Next you will enter the salary and start date and generate the offer letter.
                    </p>
                    <button
                        type="button"
                        className="hrv-btn hrv-btn-primary"
                        onClick={() => navigate(`/hr/applications/${applicationId}/offer`)}
                    >
                        <IconFileText size={18} stroke={1.75} />
                        Prepare offer
                    </button>
                </div>
            );
        }

        if (value === 'HOLD') {
            return (
                <div className="hrv-panel">
                    <label className="hrv-label" htmlFor="hrv-hold-note">Note (optional)</label>
                    <textarea
                        id="hrv-hold-note"
                        className="hrv-textarea"
                        rows={3}
                        value={holdNote}
                        onChange={(e) => setHoldNote(e.target.value)}
                        placeholder="Why is this candidate on hold?"
                    />
                    <button type="button" className="hrv-btn hrv-btn-primary" onClick={handleHold} disabled={saving}>
                        {saving ? 'Saving...' : 'Put on hold'}
                    </button>
                </div>
            );
        }

        return (
            <div className="hrv-panel">
                <label className="hrv-label" htmlFor="hrv-reject-reason">Reason</label>
                <div className="hrv-select-wrap">
                    <select
                        id="hrv-reject-reason"
                        className="hrv-select"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                    >
                        {REJECTION_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <IconChevronDown className="hrv-select-chevron" size={18} stroke={1.75} />
                </div>

                <label className="hrv-label" htmlFor="hrv-reject-note">Internal note (optional)</label>
                <textarea
                    id="hrv-reject-note"
                    className="hrv-textarea"
                    rows={3}
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Only HR can see this"
                />
                <button type="button" className="hrv-btn hrv-btn-danger" onClick={() => setConfirmReject(true)} disabled={saving}>
                    Reject candidate
                </button>
            </div>
        );
    };

    const renderStatus = () => {
        let text = `Current stage: ${application.stage}.`;
        let action = null;

        switch (application.stage) {
            case 'INTERVIEWED':
                text = `Round ${application.current_round} is the latest round. Open that tab to make the decision.`;
                break;
            case 'SHORTLISTED':
                text = `Moved on to round ${application.current_round}. Offer interview times to continue.`;
                action = (
                    <Link to={`/hr/applications/${applicationId}/schedule`} className="hrv-btn hrv-btn-primary">
                        Offer interview slots
                    </Link>
                );
                break;
            case 'SLOTS_OFFERED':
                text = 'Waiting for the candidate to choose a time for the next round.';
                break;
            case 'INTERVIEW_SCHEDULED':
                text = `Waiting for feedback: ${submitted.length} of ${panelSize} submitted.`;
                action = (
                    <Link to={`/hr/interviews/${active.id}/feedback`} className="hrv-btn hrv-btn-secondary">
                        Add feedback
                    </Link>
                );
                break;
            case 'ON_HOLD':
                text = 'This candidate is on hold.';
                action = (
                    <button type="button" className="hrv-btn hrv-btn-secondary" onClick={handleReopen} disabled={saving}>
                        {saving ? 'Saving...' : 'Reopen decision'}
                    </button>
                );
                break;
            case 'REJECTED':
                text = 'This candidate was rejected.';
                break;
            case 'READY_FOR_OFFER':
                text = 'An offer letter has been drafted for this candidate.';
                action = (
                    <Link to={`/hr/applications/${applicationId}/offer`} className="hrv-btn hrv-btn-primary">
                        Continue offer
                    </Link>
                );
                break;
            default:
                break;
        }

        return (
            <div className="hrv-status">
                <p>{text}</p>
                {action}
            </div>
        );
    };

    return (
        <div className="hrv-page">
            <nav className="hrv-breadcrumb" aria-label="Breadcrumb">
                <Link to="/hr/applications" className="hrv-breadcrumb-link">Applications</Link>
                <span className="hrv-breadcrumb-sep" aria-hidden="true">›</span>
                <span className="hrv-breadcrumb-link">{application.candidate_name}</span>
                <span className="hrv-breadcrumb-sep" aria-hidden="true">›</span>
                <span className="hrv-breadcrumb-current">Interview review</span>
            </nav>

            <header className="hrv-header">
                <div className="hrv-header-main">
                    <span className="hrv-avatar">{getInitials(application.candidate_name)}</span>
                    <div>
                        <h1 className="hrv-title">Interview review</h1>
                        <p className="hrv-subtitle">{application.candidate_name} · {application.job_title}</p>
                    </div>
                </div>
                {match && application.match_percent !== null && application.match_percent !== undefined && (
                    <span className={`tone-badge tone-${match.tone}`}>
                        {application.match_percent}% {match.label}
                    </span>
                )}
            </header>

            <div className="hrv-tabs" role="tablist" aria-label="Interview rounds">
                {interviews.map(iv => (
                    <button
                        key={iv.id}
                        type="button"
                        role="tab"
                        aria-selected={iv.id === active.id}
                        className={`hrv-tab ${iv.id === active.id ? 'hrv-tab-on' : ''}`}
                        onClick={() => setActiveId(iv.id)}
                    >
                        Round {iv.round_number}
                    </button>
                ))}
            </div>

            <div className="hrv-grid">
                <div className="hrv-main">
                    <div className="hrv-stats">
                        <div className="hrv-stat">
                            <span className="hrv-stat-label">Average score</span>
                            <span className="hrv-stat-value">{average}{scores.length > 0 && <small> / 5</small>}</span>
                        </div>
                        <div className="hrv-stat">
                            <span className="hrv-stat-label">Feedback received</span>
                            <span className="hrv-stat-value">{submitted.length} of {panelSize}</span>
                        </div>
                        <div className="hrv-stat">
                            <span className="hrv-stat-label">Recommend next round</span>
                            <span className="hrv-stat-value">{recommendNext} of {submitted.length}</span>
                        </div>
                    </div>

                    {feedbackLoading && <p className="hrv-state">Loading feedback...</p>}

                    {!feedbackLoading && submitted.length === 0 && (
                        <div className="hrv-card hrv-empty">
                            <p>No feedback has been submitted for this round yet.</p>
                            <Link to={`/hr/interviews/${active.id}/feedback`} className="hrv-btn hrv-btn-secondary">
                                Add feedback
                            </Link>
                        </div>
                    )}

                    {submitted.map(item => (
                        <section key={item.id} className="hrv-card">
                            <div className="hrv-card-head">
                                <div className="hrv-person">
                                    <span className="hrv-person-avatar">{getInitials(item.interviewer_name || 'HR')}</span>
                                    <div>
                                        <span className="hrv-person-name">{item.interviewer_name}</span>
                                        <span className="hrv-person-sub">{item.interviewer_email}</span>
                                    </div>
                                </div>
                                {item.recommendation && (
                                    <span className={`tone-badge tone-${REC_TONES[item.recommendation]}`}>
                                        {REC_LABELS[item.recommendation]}
                                    </span>
                                )}
                            </div>

                            <div className="hrv-scores">
                                {RATING_FIELDS.map(r => (
                                    <span key={r.key} className="hrv-score">
                                        {r.label} <strong>{item[r.key] ?? '–'}</strong>
                                    </span>
                                ))}
                            </div>

                            {item.strengths && (
                                <p className="hrv-comment"><span>Strengths</span>{item.strengths}</p>
                            )}
                            {item.concerns && (
                                <p className="hrv-comment"><span>Concerns</span>{item.concerns}</p>
                            )}
                        </section>
                    ))}
                </div>

                <aside className="hrv-decision">
                    <h2 className="hrv-decision-title">Decision</h2>

                    {canDecide ? (
                        <>
                            <div className="hrv-options" role="radiogroup" aria-label="Decision">
                                {CHOICES.map(({ value, label, tone, Icon }) => {
                                    const on = choice === value;
                                    return (
                                        <div key={value} className="hrv-option">
                                            <button
                                                type="button"
                                                role="radio"
                                                aria-checked={on}
                                                className={`hrv-choice ${on ? `hrv-choice-on hrv-choice-${tone}` : ''}`}
                                                onClick={() => setChoice(value)}
                                                disabled={saving}
                                            >
                                                <Icon size={20} stroke={1.75} />
                                                {label}
                                            </button>
                                            {on && renderPanel(value)}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        renderStatus()
                    )}
                </aside>
            </div>

            <ConfirmDialog
                open={confirmReject}
                title="Reject this candidate?"
                message={`${application.candidate_name} will be marked as not selected and will see "Not selected" on their application.`}
                confirmLabel="Reject"
                cancelLabel="Cancel"
                danger
                onConfirm={handleReject}
                onCancel={() => setConfirmReject(false)}
            />
        </div>
    );
}

export default InterviewReview;