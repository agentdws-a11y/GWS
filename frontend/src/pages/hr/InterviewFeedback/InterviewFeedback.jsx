import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { IconChevronDown, IconCircleCheck, IconCircleX, IconPlayerPause, IconUserCheck } from '@tabler/icons-react';
import { getInterviewById, getFeedback, submitFeedback } from '../../../services/interviewService';
import { getUser } from '../../../utils/auth';
import { notify } from '../../../utils/notify';
import { parseLocalDateTime, formatDay, formatTime, getInitials } from '../../../utils/interviewTime';
import './InterviewFeedback.css';

const MODE_LABELS = { ZOOM: 'Zoom', ONSITE: 'On-site' };

const RATING_FIELDS = [
    { key: 'technical', label: 'Technical skills' },
    { key: 'problem_solving', label: 'Problem solving' },
    { key: 'communication', label: 'Communication' },
    { key: 'culture_fit', label: 'Culture fit' }
];

const RECOMMENDATIONS = [
    { value: 'NEXT_ROUND', label: 'Move to next round', tone: 'green', Icon: IconCircleCheck },
    { value: 'HIRE', label: 'Hire', tone: 'green', Icon: IconUserCheck },
    { value: 'HOLD', label: 'Hold', tone: 'yellow', Icon: IconPlayerPause },
    { value: 'REJECT', label: 'Reject', tone: 'red', Icon: IconCircleX }
];

const EMPTY_FORM = {
    technical: null,
    problem_solving: null,
    communication: null,
    culture_fit: null,
    strengths: '',
    concerns: '',
    recommendation: ''
};

function toForm(saved) {
    if (!saved) return { ...EMPTY_FORM };
    return {
        technical: saved.technical ?? null,
        problem_solving: saved.problem_solving ?? null,
        communication: saved.communication ?? null,
        culture_fit: saved.culture_fit ?? null,
        strengths: saved.strengths || '',
        concerns: saved.concerns || '',
        recommendation: saved.recommendation || ''
    };
}

function getSubmitProblem(form) {
    if (RATING_FIELDS.some(field => !form[field.key])) {
        return 'Rate all four areas before you submit.';
    }
    if (!form.recommendation) {
        return 'Choose a recommendation before you submit.';
    }
    if (!form.strengths.trim() && !form.concerns.trim()) {
        return 'Write something under Strengths or Concerns before you submit.';
    }
    return '';
}

function InterviewFeedback() {
    const { interviewId } = useParams();
    const navigate = useNavigate();
    const currentUserId = getUser()?.id;

    const [interview, setInterview] = useState(null);
    const [feedbackList, setFeedbackList] = useState([]);
    const [interviewerId, setInterviewerId] = useState(null);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState('');
    const [formError, setFormError] = useState('');

    useEffect(() => {
        loadAll();
    }, [interviewId]);

    const loadAll = async () => {
        setLoading(true);
        setLoadError('');
        try {
            const [interviewResponse, feedbackResponse] = await Promise.all([
                getInterviewById(interviewId),
                getFeedback(interviewId)
            ]);

            const loadedInterview = interviewResponse.interview;
            const list = feedbackResponse.feedback || [];
            const panel = loadedInterview.panel_members || [];

            const owesFeedback = (id) => !list.some(f => f.interviewer_id === id && f.status === 'SUBMITTED');
            const firstChoice =
                panel.find(m => m.id === currentUserId && owesFeedback(m.id)) ||
                panel.find(m => owesFeedback(m.id)) ||
                panel[0];

            setInterview(loadedInterview);
            setFeedbackList(list);
            if (firstChoice) {
                setInterviewerId(firstChoice.id);
                setForm(toForm(list.find(f => f.interviewer_id === firstChoice.id)));
            }
        } catch (err) {
            setLoadError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const panel = interview?.panel_members || [];
    const savedFor = (id) => feedbackList.find(f => f.interviewer_id === id);
    const savedForCurrent = savedFor(interviewerId);
    const locked = savedForCurrent?.status === 'SUBMITTED';
    const submittedCount = feedbackList.filter(f => f.status === 'SUBMITTED').length;

    const start = interview ? parseLocalDateTime(interview.scheduled_start) : null;
    const hasStarted = !!start && start <= new Date();
    const canGiveFeedback = interview && ['SCHEDULED', 'COMPLETED'].includes(interview.status);

    const handleInterviewerChange = (e) => {
        const id = Number(e.target.value);
        setInterviewerId(id);
        setForm(toForm(savedFor(id)));
        setFormError('');
    };

    const setField = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setFormError('');
    };

    const handleSave = async (status) => {
        if (saving || locked || !interviewerId) return;

        if (status === 'SUBMITTED') {
            const problem = getSubmitProblem(form);
            if (problem) {
                setFormError(problem);
                return;
            }
        }

        setSaving(status);
        setFormError('');

        try {
            await submitFeedback(interview.id, interviewerId, {
                technical: form.technical,
                problem_solving: form.problem_solving,
                communication: form.communication,
                culture_fit: form.culture_fit,
                strengths: form.strengths.trim(),
                concerns: form.concerns.trim(),
                recommendation: form.recommendation,
                status
            });

            const refreshed = (await getFeedback(interview.id)).feedback || [];
            setFeedbackList(refreshed);

            if (status === 'DRAFT') {
                notify.success('Draft saved');
                return;
            }

            notify.success('Feedback submitted');

            const doneIds = refreshed.filter(f => f.status === 'SUBMITTED').map(f => f.interviewer_id);
            const nextMember = panel.find(m => !doneIds.includes(m.id));

            if (nextMember) {
                setInterviewerId(nextMember.id);
                setForm(toForm(refreshed.find(f => f.interviewer_id === nextMember.id)));
            } else {
                notify.info('All feedback is in for this interview');
                navigate('/hr/interviews');
            }
        } catch (err) {
            setFormError(err.message);
        } finally {
            setSaving('');
        }
    };

    if (loading) {
        return (
            <div className="hf-page">
                <p className="hf-state">Loading...</p>
            </div>
        );
    }

    if (loadError || !interview) {
        return (
            <div className="hf-page">
                <div className="hf-notice">
                    <h2>Could not open this interview</h2>
                    <p>{loadError || 'Interview not found.'}</p>
                    <Link to="/hr/interviews" className="hf-btn hf-btn-secondary">Back to interviews</Link>
                </div>
            </div>
        );
    }

    if (!canGiveFeedback) {
        return (
            <div className="hf-page">
                <div className="hf-notice">
                    <h2>Feedback is not open yet</h2>
                    <p>You can add feedback after the candidate confirms a time and the interview has taken place.</p>
                    <Link to="/hr/interviews" className="hf-btn hf-btn-secondary">Back to interviews</Link>
                </div>
            </div>
        );
    }

    const subtitle = [
        `Round ${interview.round_number}`,
        start ? `${formatDay(start)}, ${formatTime(start)}` : null,
        MODE_LABELS[interview.mode] || interview.mode
    ].filter(Boolean).join(' · ');

    return (
        <div className="hf-page">
            <nav className="hf-breadcrumb" aria-label="Breadcrumb">
                <Link to="/hr/interviews" className="hf-breadcrumb-link">Interviews</Link>
                <span className="hf-breadcrumb-sep" aria-hidden="true">/</span>
                <span className="hf-breadcrumb-current">Interview feedback</span>
            </nav>

            <header className="hf-header">
                <div>
                    <h1 className="hf-title">Interview feedback</h1>
                    <p className="hf-subtitle">{subtitle}</p>
                </div>
                <div className="hf-candidate">
                    <span className="hf-avatar">{getInitials(interview.candidate_name)}</span>
                    <div>
                        <span className="hf-candidate-name">{interview.candidate_name}</span>
                        <span className="hf-candidate-job">{interview.job_title}</span>
                    </div>
                </div>
            </header>

            <div className="hf-grid">
                <div className="hf-main">
                    <section className="hf-card">
                        <h2 className="hf-card-title">Feedback from</h2>
                        {panel.length === 0 ? (
                            <p className="hf-hint">This interview has no panel members.</p>
                        ) : (
                            <>
                                <div className="hf-select-wrap">
                                    <select
                                        className="hf-select"
                                        aria-label="Interviewer"
                                        value={interviewerId ?? ''}
                                        onChange={handleInterviewerChange}
                                        disabled={!!saving}
                                    >
                                        {panel.map(member => {
                                            const saved = savedFor(member.id);
                                            const tag = saved?.status === 'SUBMITTED'
                                                ? ' · Submitted'
                                                : saved ? ' · Draft saved' : '';
                                            return (
                                                <option key={member.id} value={member.id}>
                                                    {member.name}{tag}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <IconChevronDown className="hf-select-chevron" size={18} stroke={1.75} />
                                </div>
                                <p className="hf-hint">
                                    Add one form per interviewer on the panel. {submittedCount} of {panel.length} submitted.
                                </p>
                            </>
                        )}
                    </section>

                    <section className="hf-card">
                        <h2 className="hf-card-title">
                            Ratings <span className="hf-card-title-note">1 is weak, 5 is excellent</span>
                        </h2>
                        <div className="hf-ratings">
                            {RATING_FIELDS.map(field => (
                                <div key={field.key} className="hf-rating-row">
                                    <span className="hf-rating-label" id={`hf-${field.key}`}>{field.label}</span>
                                    <div className="hf-rating-dots" role="radiogroup" aria-labelledby={`hf-${field.key}`}>
                                        {[1, 2, 3, 4, 5].map(value => (
                                            <button
                                                key={value}
                                                type="button"
                                                role="radio"
                                                aria-checked={form[field.key] === value}
                                                className={`hf-dot ${form[field.key] && value <= form[field.key] ? 'hf-dot-on' : ''}`}
                                                onClick={() => setField(field.key, value)}
                                                disabled={locked || !!saving}
                                            >
                                                {value}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="hf-card">
                        <h2 className="hf-card-title">Comments</h2>

                        <label className="hf-label" htmlFor="hf-strengths">Strengths</label>
                        <textarea
                            id="hf-strengths"
                            className="hf-textarea"
                            rows={3}
                            value={form.strengths}
                            onChange={(e) => setField('strengths', e.target.value)}
                            disabled={locked || !!saving}
                        />

                        <label className="hf-label" htmlFor="hf-concerns">Concerns</label>
                        <textarea
                            id="hf-concerns"
                            className="hf-textarea"
                            rows={3}
                            value={form.concerns}
                            onChange={(e) => setField('concerns', e.target.value)}
                            disabled={locked || !!saving}
                        />
                    </section>
                </div>

                <aside className="hf-side">
                    <section className="hf-card">
                        <h2 className="hf-card-title">Recommendation</h2>
                        <div className="hf-recs" role="radiogroup" aria-label="Recommendation">
                            {RECOMMENDATIONS.map(({ value, label, tone, Icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={form.recommendation === value}
                                    className={`hf-rec ${form.recommendation === value ? `hf-rec-on hf-rec-${tone}` : ''}`}
                                    onClick={() => setField('recommendation', value)}
                                    disabled={locked || !!saving}
                                >
                                    <Icon size={20} stroke={1.75} />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </section>

                    {locked ? (
                        <p className="hf-note">
                            This form was already submitted. Choose another interviewer above to add their form.
                        </p>
                    ) : (
                        <>
                            {!hasStarted && (
                                <p className="hf-note">
                                    You can submit once the interview has started. Until then you can save a draft.
                                </p>
                            )}

                            {formError && <div className="hf-error" role="alert">{formError}</div>}

                            <button
                                type="button"
                                className="hf-btn hf-btn-primary"
                                onClick={() => handleSave('SUBMITTED')}
                                disabled={!!saving || !hasStarted || !interviewerId}
                            >
                                {saving === 'SUBMITTED' ? 'Submitting...' : 'Submit feedback'}
                            </button>
                            <button
                                type="button"
                                className="hf-btn hf-btn-secondary"
                                onClick={() => handleSave('DRAFT')}
                                disabled={!!saving || !interviewerId}
                            >
                                {saving === 'DRAFT' ? 'Saving...' : 'Save draft'}
                            </button>
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}

export default InterviewFeedback;