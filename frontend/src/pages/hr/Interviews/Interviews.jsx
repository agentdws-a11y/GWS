import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconCalendarPlus } from '@tabler/icons-react';
import { getInterviews } from '../../../services/interviewService';
import { parseLocalDateTime, formatDay, formatTime, getInitials } from '../../../utils/interviewTime';
import InterviewDetailModal from '../../../components/hr/InterviewDetailModal';
import SchedulePickerModal from '../../../components/hr/SchedulePickerModal';
import { notify } from '../../../utils/notify';
import './Interviews.css';

const MODE_LABELS = { ZOOM: 'Zoom', ONSITE: 'On-site' };

const STATE_META = {
    SLOTS_OFFERED: { label: 'Slots offered', tone: 'blue' },
    SCHEDULED: { label: 'Scheduled', tone: 'green' },
    FEEDBACK_PENDING: { label: 'Feedback pending', tone: 'yellow' },
    FEEDBACK_ADDED: { label: 'Feedback added', tone: 'green' },
    CANCELLED: { label: 'Cancelled', tone: 'neutral' },
    EXPIRED: { label: 'Offer expired', tone: 'neutral' }
};

const FILTERS = [
    { key: 'ALL', label: 'All' },
    { key: 'SLOTS_OFFERED', label: 'Slots offered' },
    { key: 'SCHEDULED', label: 'Scheduled' },
    { key: 'FEEDBACK_PENDING', label: 'Feedback pending' },
    { key: 'FEEDBACK_ADDED', label: 'Feedback added' }
];

const CLICKABLE_STATES = ['SLOTS_OFFERED', 'SCHEDULED', 'FEEDBACK_PENDING', 'FEEDBACK_ADDED'];

function getRowState(interview, now) {
    if (interview.status === 'SLOTS_OFFERED') return 'SLOTS_OFFERED';
    if (interview.status === 'CANCELLED') return 'CANCELLED';
    if (interview.status === 'EXPIRED') return 'EXPIRED';
    if (interview.status === 'COMPLETED') return 'FEEDBACK_ADDED';

    const total = Number(interview.feedback_total) || 0;
    const submitted = Number(interview.feedback_submitted) || 0;
    if (total > 0 && submitted >= total) return 'FEEDBACK_ADDED';

    const start = parseLocalDateTime(interview.scheduled_start);
    if (start && start > now) return 'SCHEDULED';
    return 'FEEDBACK_PENDING';
}

function getWeekRange(now) {
    const start = new Date(now);
    const day = start.getDay();
    start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
}

function Interviews() {
    const navigate = useNavigate();

    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('ALL');
    const [detailId, setDetailId] = useState(null);
    const [showPicker, setShowPicker] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setError('');
        try {
            const response = await getInterviews();
            setInterviews(response.interviews || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const rows = useMemo(() => {
        const now = new Date();
        return interviews.map(interview => ({
            interview,
            state: getRowState(interview, now)
        }));
    }, [interviews]);

    const counts = useMemo(() => {
        const result = { ALL: rows.length };
        rows.forEach(({ state }) => {
            result[state] = (result[state] || 0) + 1;
        });
        return result;
    }, [rows]);

    const thisWeekCount = useMemo(() => {
        const { start, end } = getWeekRange(new Date());
        return interviews.filter(interview => {
            if (interview.status !== 'SCHEDULED' && interview.status !== 'COMPLETED') return false;
            const when = parseLocalDateTime(interview.scheduled_start);
            return when && when >= start && when < end;
        }).length;
    }, [interviews]);

    const visibleRows = filter === 'ALL' ? rows : rows.filter(row => row.state === filter);

    const handleRowClick = (interview, state) => {
        if (state === 'FEEDBACK_PENDING') {
            navigate(`/hr/interviews/${interview.id}/feedback`);
        } else if (state === 'FEEDBACK_ADDED') {
            navigate(`/hr/applications/${interview.application_id}/review`);
        } else if (state === 'SLOTS_OFFERED' || state === 'SCHEDULED') {
            setDetailId(interview.id);
        }
    };

    const handleChanged = (message) => {
        notify.success(message);
        setDetailId(null);
        loadData({ silent: true });
    };

    const renderWhen = (interview, state) => {
        const start = parseLocalDateTime(interview.scheduled_start);

        if (state === 'SLOTS_OFFERED') {
            const count = Number(interview.slot_count) || 0;
            return (
                <>
                    <span className="hi-cell-main">No slot chosen</span>
                    <span className="hi-cell-sub">{count} {count === 1 ? 'slot' : 'slots'} offered</span>
                </>
            );
        }

        return (
            <>
                <span className="hi-cell-main">
                    {start ? `${formatDay(start)}, ${formatTime(start)}` : 'No slot chosen'}
                </span>
                <span className="hi-cell-sub">{MODE_LABELS[interview.mode] || interview.mode}</span>
            </>
        );
    };

    return (
        <div className="hi-page">
            <header className="hi-header">
                <div>
                    <h1 className="hi-title">Interviews</h1>
                    <p className="hi-subtitle">
                        {thisWeekCount} this week · {counts.FEEDBACK_PENDING || 0} waiting for feedback
                    </p>
                </div>
                <button type="button" className="hi-btn hi-btn-primary" onClick={() => setShowPicker(true)}>
                    <IconCalendarPlus size={20} stroke={1.5} />
                    Schedule interview
                </button>
            </header>

            {loading && <div className="hi-loading">Loading...</div>}

            {!loading && error && (
                <div className="hi-error">
                    <p>{error}</p>
                    <button type="button" className="hi-btn hi-btn-secondary" onClick={() => loadData()}>
                        Try again
                    </button>
                </div>
            )}

            {!loading && !error && (
                <>
                    <div className="hi-filters" role="tablist" aria-label="Filter interviews">
                        {FILTERS.map(item => (
                            <button
                                key={item.key}
                                type="button"
                                role="tab"
                                aria-selected={filter === item.key}
                                className={`hi-chip ${filter === item.key ? 'hi-chip-active' : ''}`}
                                onClick={() => setFilter(item.key)}
                            >
                                {item.label} {counts[item.key] || 0}
                            </button>
                        ))}
                    </div>

                    {visibleRows.length === 0 ? (
                        <div className="hi-empty">
                            <h3>{filter === 'ALL' ? 'No interviews yet' : 'Nothing here'}</h3>
                            <p>
                                {filter === 'ALL'
                                    ? 'Shortlist a candidate, then offer interview times to get started.'
                                    : 'No interviews match this filter.'}
                            </p>
                        </div>
                    ) : (
                        <div className="hi-table-card">
                            <table className="hi-table">
                                <thead>
                                    <tr>
                                        <th>Candidate</th>
                                        <th>Date and time</th>
                                        <th>Interviewers</th>
                                        <th>Round</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visibleRows.map(({ interview, state }) => {
                                        const clickable = CLICKABLE_STATES.includes(state);
                                        const meta = STATE_META[state];
                                        const panel = interview.panel || [];

                                        return (
                                            <tr
                                                key={interview.id}
                                                className={`hi-row ${clickable ? 'hi-row-clickable' : ''}`}
                                                onClick={clickable ? () => handleRowClick(interview, state) : undefined}
                                                onKeyDown={clickable ? (e) => {
                                                    if (e.key === 'Enter') handleRowClick(interview, state);
                                                } : undefined}
                                                tabIndex={clickable ? 0 : undefined}
                                            >
                                                <td>
                                                    <div className="hi-candidate">
                                                        <span className="hi-avatar hi-avatar-blue hi-avatar-lg">
                                                            {getInitials(interview.candidate_name)}
                                                        </span>
                                                        <div>
                                                            <span className="hi-cell-main">{interview.candidate_name}</span>
                                                            <span className="hi-cell-sub">{interview.job_title}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="hi-cell">{renderWhen(interview, state)}</div>
                                                </td>
                                                <td>
                                                    <div className="hi-avatars">
                                                        {panel.map(member => (
                                                            <span key={member.id} className="hi-avatar hi-avatar-violet">
                                                                {getInitials(member.name)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className="hi-cell-main">Round {interview.round_number}</span>
                                                </td>
                                                <td>
                                                    <span className={`hi-badge hi-badge-${meta.tone}`}>{meta.label}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <p className="hi-footnote">
                        Clicking a row opens the interview. Feedback pending rows open the feedback form.
                    </p>
                </>
            )}

            {detailId && (
                <InterviewDetailModal
                    interviewId={detailId}
                    onClose={() => setDetailId(null)}
                    onChanged={handleChanged}
                />
            )}

            {showPicker && (
                <SchedulePickerModal
                    onClose={() => setShowPicker(false)}
                    onContinue={(applicationId) => navigate(`/hr/applications/${applicationId}/schedule`)}
                />
            )}
        </div>
    );
}

export default Interviews;