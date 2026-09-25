import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link, useOutletContext } from 'react-router-dom';
import { IconCheck } from '@tabler/icons-react';
import { getApplicationDetail } from '../../../services/applicationService';
import { getPanelMembers, getInterviews, offerInterviewSlots } from '../../../services/interviewService';
import { notify } from '../../../utils/notify';
import { parseLocalDateTime, getInitials } from '../../../utils/interviewTime';
import './ScheduleInterview.css';

const FIRST_HOUR = 9;
const LAST_HOUR = 17;
const DURATIONS = [30, 45, 60];
const MIN_NOTICE_HOURS = 12;
const MAX_SLOTS = 5;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ROUND_NAME_BY_NUMBER = {
    1: 'Technical interview',
    2: 'Final interview',
    3: 'HR interview'
};

function pad(n) {
    return String(n).padStart(2, '0');
}

const SLOT_TIMES = Array.from(
    { length: LAST_HOUR - FIRST_HOUR + 1 },
    (_, i) => `${pad(FIRST_HOUR + i)}:00`
);

function formatSlotTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

function toBackendDateTimeString(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
    d.setHours(0, 0, 0, 0);
    return d;
}

function getMinWeekStart() {
    const now = new Date();
    const monday = getMonday(now);
    if (now.getDay() === 0) monday.setDate(monday.getDate() + 7);
    return monday;
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function combineDateAndTime(date, timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d;
}

function ScheduleInterview() {
    const { applicationId } = useParams();
    const navigate = useNavigate();
    const routeLocation = useLocation();
    const outletContext = useOutletContext();
    const reloadApplications = outletContext?.reloadApplications;

    const [application, setApplication] = useState(null);
    const [panelMembers, setPanelMembers] = useState([]);
    const [scheduledInterviews, setScheduledInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [selectedInterviewerIds, setSelectedInterviewerIds] = useState(routeLocation.state?.interviewerIds || []);
    const [roundName, setRoundName] = useState('');
    const [duration, setDuration] = useState(45);
    const [mode, setMode] = useState('ZOOM');
    const [meetingLink, setMeetingLink] = useState('');
    const [location, setLocation] = useState('');
    const [offeredSlots, setOfferedSlots] = useState([]);
    const [weekStart, setWeekStart] = useState(getMinWeekStart);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadData();
    }, [applicationId]);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [appRes, panelRes, interviewsRes] = await Promise.all([
                getApplicationDetail(applicationId),
                getPanelMembers(),
                getInterviews({ status: 'SCHEDULED' })
            ]);
            const loaded = appRes.application;
            setApplication(loaded);
            setPanelMembers(panelRes.panelMembers || []);
            setScheduledInterviews(interviewsRes.interviews || []);
            setRoundName(routeLocation.state?.roundName || ROUND_NAME_BY_NUMBER[loaded.current_round] || `Round ${loaded.current_round}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const minWeekStart = getMinWeekStart();
    const weekDays = useMemo(() => DAY_LABELS.map((_, i) => addDays(weekStart, i)), [weekStart]);
    const canGoToPreviousWeek = weekStart.getTime() > minWeekStart.getTime();

    const isInterviewerBusy = (interviewerId, slotStart, slotEnd) => {
        return scheduledInterviews.some(iv => {
            if (!iv.panel?.some(p => p.id === interviewerId)) return false;
            const start = parseLocalDateTime(iv.scheduled_start);
            if (!start) return false;
            const end = new Date(start.getTime() + (iv.duration_minutes || 45) * 60000);
            return slotStart < end && slotEnd > start;
        });
    };

    const getCellState = (date, timeStr) => {
        const slotStart = combineDateAndTime(date, timeStr);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);
        const minStart = new Date(Date.now() + MIN_NOTICE_HOURS * 60 * 60 * 1000);
        const isOffered = offeredSlots.some(s => s.getTime() === slotStart.getTime());

        if (slotStart < minStart) return isOffered ? 'invalid' : 'too-soon';
        if (selectedInterviewerIds.some(id => isInterviewerBusy(id, slotStart, slotEnd))) {
            return isOffered ? 'invalid' : 'busy';
        }
        return isOffered ? 'offered' : 'free';
    };

    const toggleInterviewer = (id) => {
        setSelectedInterviewerIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleCellClick = (date, timeStr) => {
        if (selectedInterviewerIds.length === 0) {
            notify.info('Select at least one interviewer first');
            return;
        }
        const slotStart = combineDateAndTime(date, timeStr);
        const state = getCellState(date, timeStr);

        if (state === 'offered' || state === 'invalid') {
            setOfferedSlots(prev => prev.filter(s => s.getTime() !== slotStart.getTime()));
            return;
        }
        if (state !== 'free') return;

        if (offeredSlots.length >= MAX_SLOTS) {
            notify.error(`You can offer up to ${MAX_SLOTS} time slots`);
            return;
        }
        setOfferedSlots(prev => [...prev, slotStart].sort((a, b) => a - b));
    };

    const removeOfferedSlot = (date) => {
        setOfferedSlots(prev => prev.filter(s => s.getTime() !== date.getTime()));
    };

    const invalidOfferedSlots = offeredSlots.filter(slot =>
        getCellState(slot, `${pad(slot.getHours())}:${pad(slot.getMinutes())}`) === 'invalid'
    );

    const missingReasons = [];
    if (selectedInterviewerIds.length === 0) missingReasons.push('select at least one interviewer');
    if (offeredSlots.length === 0) missingReasons.push('add at least one time slot');
    if (mode === 'ZOOM' && !meetingLink.trim()) missingReasons.push('add a Zoom link');
    if (mode === 'ONSITE' && !location.trim()) missingReasons.push('add a location');
    if (!roundName.trim()) missingReasons.push('add a round name');
    if (invalidOfferedSlots.length > 0) missingReasons.push('remove the red slot(s)');

    const handleSubmit = async () => {
        if (missingReasons.length > 0 || submitting) return;
        setSubmitting(true);
        try {
            const slots = offeredSlots.map(start => ({
                start_time: toBackendDateTimeString(start),
                end_time: toBackendDateTimeString(new Date(start.getTime() + duration * 60000))
            }));

            await offerInterviewSlots(applicationId, {
                round_name: roundName.trim(),
                duration_minutes: duration,
                mode,
                meeting_link: mode === 'ZOOM' ? meetingLink.trim() : undefined,
                location: mode === 'ONSITE' ? location.trim() : undefined,
                panel_member_ids: selectedInterviewerIds,
                slots
            });

            notify.success(`Slots sent to ${application.candidate_name}`);
            if (reloadApplications) reloadApplications();
            navigate('/hr/applications');
        } catch (err) {
            notify.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="sis-page"><div className="sis-loading">Loading...</div></div>;
    }

    if (error || !application) {
        return (
            <div className="sis-page">
                <div className="sis-error-state">
                    <p>{error || 'Application not found.'}</p>
                    <Link to="/hr/applications" className="sis-back-link">Back to applications</Link>
                </div>
            </div>
        );
    }

    if (application.stage !== 'SHORTLISTED') {
        return (
            <div className="sis-page">
                <div className="sis-error-state">
                    <p>{application.candidate_name} is not shortlisted (current stage: {application.stage}). Slots can only be offered to shortlisted candidates.</p>
                    <Link to="/hr/applications" className="sis-back-link">Back to applications</Link>
                </div>
            </div>
        );
    }

    const weekLabel = `${weekDays[0].toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} – ${weekDays[5].toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    return (
        <div className="sis-page">
            <div className="sis-breadcrumb">
                <Link to="/hr/applications">Applications</Link>
                <span>›</span>
                <span>{application.candidate_name}</span>
                <span>›</span>
                <span>Offer interview slots</span>
            </div>

            <h1 className="sis-title">Offer interview slots</h1>

            <div className="sis-candidate-banner">
                <div className="sis-avatar">{getInitials(application.candidate_name)}</div>
                <div className="sis-candidate-info">
                    <strong>{application.candidate_name}</strong>
                    <p>{application.job_title}{application.job_department ? ` · ${application.job_department}` : ''}</p>
                </div>
            </div>

            <div className="sis-layout">
                <div className="sis-grid-card">
                    <div className="sis-week-nav">
                        <button
                            type="button"
                            className="sis-week-btn"
                            aria-label="Previous week"
                            disabled={!canGoToPreviousWeek}
                            onClick={() => setWeekStart(prev => addDays(prev, -7))}
                        >
                            ‹
                        </button>
                        <span className="sis-week-label">{weekLabel}</span>
                        <button
                            type="button"
                            className="sis-week-btn"
                            aria-label="Next week"
                            onClick={() => setWeekStart(prev => addDays(prev, 7))}
                        >
                            ›
                        </button>
                        <span className="sis-week-hint">Local time · PKT</span>
                    </div>

                    <div className="sis-grid-header">
                        {weekDays.map((d, i) => (
                            <div key={i} className="sis-grid-day-label">
                                <span>{DAY_LABELS[i]}</span>
                                <strong>{d.getDate()}</strong>
                            </div>
                        ))}
                    </div>

                    {SLOT_TIMES.map(timeStr => (
                        <div key={timeStr} className="sis-grid-row">
                            {weekDays.map((d, i) => {
                                const state = getCellState(d, timeStr);
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        className={`sis-cell sis-cell-${state}`}
                                        aria-pressed={state === 'offered' || state === 'invalid'}
                                        aria-label={`${DAY_LABELS[i]} ${d.getDate()}, ${formatSlotTime(timeStr)}`}
                                        onClick={() => handleCellClick(d, timeStr)}
                                    >
                                        {formatSlotTime(timeStr)}
                                    </button>
                                );
                            })}
                        </div>
                    ))}

                    <div className="sis-legend">
                        <span><i className="sis-legend-dot"></i> Free</span>
                        <span><i className="sis-legend-dot sis-dot-offered"></i> Offered to candidate</span>
                        <span><i className="sis-legend-dot sis-dot-busy"></i> Interviewer busy</span>
                        <span><i className="sis-legend-dot sis-dot-off"></i> Not available</span>
                    </div>
                </div>

                <div className="sis-sidebar">
                    <div className="sis-side-card">
                        <h3>1. Round</h3>
                        <label className="sis-label" htmlFor="sis-round">Round name</label>
                        <input
                            id="sis-round"
                            className="sis-input"
                            type="text"
                            value={roundName}
                            onChange={(e) => setRoundName(e.target.value)}
                        />

                        <div className="sis-field-row">
                            <div>
                                <label className="sis-label" htmlFor="sis-duration">Duration</label>
                                <select
                                    id="sis-duration"
                                    className="sis-input"
                                    value={duration}
                                    onChange={(e) => setDuration(Number(e.target.value))}
                                >
                                    {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="sis-label" htmlFor="sis-mode">Mode</label>
                                <select
                                    id="sis-mode"
                                    className="sis-input"
                                    value={mode}
                                    onChange={(e) => setMode(e.target.value)}
                                >
                                    <option value="ZOOM">Zoom</option>
                                    <option value="ONSITE">On-site</option>
                                </select>
                            </div>
                        </div>

                        {mode === 'ZOOM' ? (
                            <>
                                <label className="sis-label" htmlFor="sis-link">Zoom link *</label>
                                <input
                                    id="sis-link"
                                    className="sis-input"
                                    type="text"
                                    value={meetingLink}
                                    onChange={(e) => setMeetingLink(e.target.value)}
                                    placeholder="https://zoom.us/j/..."
                                />
                            </>
                        ) : (
                            <>
                                <label className="sis-label" htmlFor="sis-location">Location *</label>
                                <input
                                    id="sis-location"
                                    className="sis-input"
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="Office address or room"
                                />
                            </>
                        )}
                    </div>

                    <div className="sis-side-card">
                        <h3>2. Interviewers</h3>
                        {panelMembers.length === 0 ? (
                            <p className="sis-empty-hint">No HR admins found to add as interviewers</p>
                        ) : (
                            <div className="sis-people">
                                {panelMembers.map(member => {
                                    const checked = selectedInterviewerIds.includes(member.id);
                                    return (
                                        <label key={member.id} className={`sis-person ${checked ? 'sis-person-on' : ''}`}>
                                            <input
                                                type="checkbox"
                                                className="sis-person-input"
                                                checked={checked}
                                                onChange={() => toggleInterviewer(member.id)}
                                            />
                                            <span className="sis-person-box" aria-hidden="true">
                                                {checked && <IconCheck size={14} stroke={3} />}
                                            </span>
                                            <span className="sis-person-avatar">{getInitials(member.name)}</span>
                                            <span className="sis-person-text">
                                                <span className="sis-person-name">{member.name}</span>
                                                <span className="sis-person-email">{member.email}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="sis-side-card">
                        <h3>3. Slots offered · {offeredSlots.length}</h3>
                        {offeredSlots.length === 0 ? (
                            <p className="sis-empty-hint">Click free cells on the grid to add up to {MAX_SLOTS} times</p>
                        ) : (
                            <div className="sis-slot-list">
                                {offeredSlots.map(slot => {
                                    const isInvalid = invalidOfferedSlots.some(s => s.getTime() === slot.getTime());
                                    const timeLabel = formatSlotTime(`${pad(slot.getHours())}:${pad(slot.getMinutes())}`);
                                    return (
                                        <div key={slot.getTime()} className={`sis-slot-chip ${isInvalid ? 'sis-slot-chip-invalid' : ''}`}>
                                            <span>
                                                {slot.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' })} · {timeLabel}
                                            </span>
                                            <button type="button" aria-label="Remove this time" onClick={() => removeOfferedSlot(slot)}>×</button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <p className="sis-reply-hint">
                            The candidate must reply within 48 hours, or 12 hours before the first slot, whichever comes sooner.
                        </p>

                        {missingReasons.length > 0 && (
                            <p className="sis-missing-hint">To send: {missingReasons.join(', ')}.</p>
                        )}

                        <div className="sis-side-actions">
                            <button
                                type="button"
                                className="sis-btn sis-btn-secondary"
                                onClick={() => navigate('/hr/applications')}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="sis-btn sis-btn-primary"
                                onClick={handleSubmit}
                                disabled={submitting || missingReasons.length > 0}
                            >
                                {submitting ? 'Sending...' : 'Send slots to candidate'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ScheduleInterview;