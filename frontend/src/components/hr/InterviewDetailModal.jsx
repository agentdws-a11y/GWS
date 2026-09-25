import { useState, useEffect } from 'react';
import { IconX } from '@tabler/icons-react';
import { getInterviewById, withdrawOffer, cancelInterview } from '../../services/interviewService';
import { notify } from '../../utils/notify';
import {
    parseLocalDateTime,
    formatDay,
    formatDayLong,
    formatTime,
    isSafeUrl
} from '../../utils/interviewTime';
import './InterviewDetailModal.css';

const MODE_LABELS = { ZOOM: 'Zoom', ONSITE: 'On-site' };

function InterviewDetailModal({ interviewId, onClose, onChanged }) {
    const [interview, setInterview] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const response = await getInterviewById(interviewId);
                setInterview(response.interview);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [interviewId]);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape' && !busy) onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [busy, onClose]);

    const isOffer = interview?.status === 'SLOTS_OFFERED';
    const isScheduled = interview?.status === 'SCHEDULED';

    const handleConfirmAction = async () => {
        setBusy(true);
        try {
            if (isOffer) {
                await withdrawOffer(interview.id);
                onChanged('Offer withdrawn');
            } else {
                await cancelInterview(interview.id, reason.trim() || undefined);
                onChanged('Interview cancelled');
            }
        } catch (err) {
            notify.error(err.message);
            setBusy(false);
        }
    };

    const renderMode = () => {
        const label = MODE_LABELS[interview.mode] || interview.mode;
        if (interview.mode === 'ZOOM' && interview.meeting_link) {
            return (
                <>
                    {label},{' '}
                    {isSafeUrl(interview.meeting_link) ? (
                        <a
                            className="hid-link"
                            href={interview.meeting_link}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            open link
                        </a>
                    ) : (
                        interview.meeting_link
                    )}
                </>
            );
        }
        if (interview.mode === 'ONSITE' && interview.location) {
            return `${label}, ${interview.location}`;
        }
        return label;
    };

    const start = interview ? parseLocalDateTime(interview.scheduled_start) : null;
    const expiresAt = interview ? parseLocalDateTime(interview.offer_expires_at) : null;

    return (
        <div className="hid-overlay" onClick={() => { if (!busy) onClose(); }}>
            <div
                className="hid-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hid-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="hid-header">
                    <div>
                        <h2 className="hid-title" id="hid-title">
                            {isOffer ? 'Slots offered' : 'Interview details'}
                        </h2>
                        {interview && (
                            <p className="hid-subtitle">
                                {interview.candidate_name}, {interview.job_title}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        className="hid-close"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close"
                    >
                        <IconX size={22} stroke={1.5} />
                    </button>
                </div>

                {loading && <p className="hid-message">Loading...</p>}
                {!loading && error && <p className="hid-message hid-message-error">{error}</p>}

                {interview && (
                    <>
                        <dl className="hid-details">
                            <div className="hid-detail">
                                <dt>Round</dt>
                                <dd>
                                    Round {interview.round_number}
                                    {interview.round_name ? `, ${interview.round_name}` : ''}
                                </dd>
                            </div>

                            {isScheduled && start && (
                                <div className="hid-detail">
                                    <dt>When</dt>
                                    <dd>{formatDayLong(start)}, {formatTime(start)}</dd>
                                </div>
                            )}

                            <div className="hid-detail">
                                <dt>Duration</dt>
                                <dd>{interview.duration_minutes} minutes</dd>
                            </div>

                            <div className="hid-detail">
                                <dt>Mode</dt>
                                <dd>{renderMode()}</dd>
                            </div>

                            <div className="hid-detail">
                                <dt>Panel</dt>
                                <dd>{(interview.panel_members || []).map(m => m.name).join(', ') || 'None'}</dd>
                            </div>

                            {isOffer && (
                                <div className="hid-detail hid-detail-slots">
                                    <dt>Times offered</dt>
                                    <dd>
                                        <ul className="hid-slots">
                                            {(interview.slots || []).map(slot => {
                                                const slotStart = parseLocalDateTime(slot.start_time);
                                                if (!slotStart) return null;
                                                return (
                                                    <li key={slot.id}>
                                                        {formatDayLong(slotStart)}, {formatTime(slotStart)}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </dd>
                                </div>
                            )}

                            {isOffer && expiresAt && (
                                <div className="hid-detail">
                                    <dt>Reply by</dt>
                                    <dd>{formatDay(expiresAt)}, {formatTime(expiresAt)}</dd>
                                </div>
                            )}
                        </dl>

                        {confirming ? (
                            <div className="hid-confirm">
                                <p className="hid-confirm-text">
                                    {isOffer
                                        ? `Withdraw the offer to ${interview.candidate_name}? They will no longer be able to pick a time.`
                                        : `Cancel this interview with ${interview.candidate_name}? The candidate will see it as cancelled and the application goes back to Shortlisted.`}
                                </p>

                                {isScheduled && (
                                    <input
                                        type="text"
                                        className="hid-input"
                                        placeholder="Reason (optional)"
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        disabled={busy}
                                    />
                                )}

                                <div className="hid-actions">
                                    <button
                                        type="button"
                                        className="hid-btn hid-btn-secondary"
                                        onClick={() => setConfirming(false)}
                                        disabled={busy}
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        className="hid-btn hid-btn-danger"
                                        onClick={handleConfirmAction}
                                        disabled={busy}
                                    >
                                        {busy ? 'Please wait...' : (isOffer ? 'Withdraw offer' : 'Cancel interview')}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="hid-actions">
                                <button type="button" className="hid-btn hid-btn-secondary" onClick={onClose}>
                                    Close
                                </button>
                                {(isOffer || isScheduled) && (
                                    <button
                                        type="button"
                                        className="hid-btn hid-btn-danger"
                                        onClick={() => setConfirming(true)}
                                    >
                                        {isOffer ? 'Withdraw offer' : 'Cancel interview'}
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default InterviewDetailModal;