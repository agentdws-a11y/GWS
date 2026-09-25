import { useState, useEffect } from 'react';
import { IconClock, IconVideo, IconMapPin, IconUsers, IconX } from '@tabler/icons-react';
import { confirmInterviewSlot } from '../../services/interviewService';
import {
    parseLocalDateTime,
    formatDay,
    formatDayComma,
    formatDayLong,
    formatTime,
    getInitials
} from '../../utils/interviewTime';
import './InterviewSlotSelector.css';

const CONFLICT_MESSAGE = 'This time is no longer available. Choose another.';

function InterviewSlotSelector({ interview, initialSlotId, onClose, onSuccess, onConflict }) {
    const [selectedSlotId, setSelectedSlotId] = useState(initialSlotId || null);
    const [unavailableIds, setUnavailableIds] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape' && !submitting) onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [submitting, onClose]);

    const slots = interview.slots || [];
    const panel = interview.panel || [];
    const isZoom = interview.mode === 'ZOOM';
    const expiresAt = parseLocalDateTime(interview.offer_expires_at);

    const selectedSlot = slots.find(s => s.id === selectedSlotId) || null;
    const selectedStart = selectedSlot ? parseLocalDateTime(selectedSlot.start_time) : null;

    const subtitle = [
        interview.job_title,
        interview.round_number ? `Round ${interview.round_number}` : null,
        interview.round_name
    ].filter(Boolean).join(' · ');

    const handleConfirm = async () => {
        if (!selectedSlotId || submitting) return;

        setSubmitting(true);
        setErrorMessage('');

        try {
            await confirmInterviewSlot(interview.id, selectedSlotId);
            onSuccess();
        } catch (err) {
            if (err.code === 'SLOT_CONFLICT') {
                setUnavailableIds(prev => [...prev, selectedSlotId]);
                setSelectedSlotId(null);
                setErrorMessage(CONFLICT_MESSAGE);
                if (onConflict) onConflict();
            } else {
                setErrorMessage(err.message);
            }
            setSubmitting(false);
        }
    };

    return (
        <div className="iss-overlay" onClick={() => { if (!submitting) onClose(); }}>
            <div
                className="iss-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="iss-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="iss-header">
                    <div>
                        <h2 className="iss-title" id="iss-title">Choose your interview time</h2>
                        {subtitle && <p className="iss-subtitle">{subtitle}</p>}
                    </div>
                    <button
                        type="button"
                        className="iss-close"
                        onClick={onClose}
                        disabled={submitting}
                        aria-label="Close"
                    >
                        <IconX size={22} stroke={1.5} />
                    </button>
                </div>

                <div className="iss-grid">
                    <section className="iss-card">
                        <div className="iss-card-head">
                            <h3 className="iss-card-title">Times offered by HR</h3>
                            <span className="iss-card-meta">
                                PKT{expiresAt ? ` · reply by ${formatDay(expiresAt)}` : ''}
                            </span>
                        </div>

                        {errorMessage && (
                            <div className="iss-error" role="alert">{errorMessage}</div>
                        )}

                        <div className="iss-list" role="radiogroup" aria-label="Offered times">
                            {slots.map(slot => {
                                const start = parseLocalDateTime(slot.start_time);
                                if (!start) return null;

                                const unavailable = unavailableIds.includes(slot.id);
                                const selected = selectedSlotId === slot.id;

                                return (
                                    <button
                                        key={slot.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        className={`iss-row ${selected ? 'iss-row-selected' : ''} ${unavailable ? 'iss-row-unavailable' : ''}`}
                                        onClick={() => {
                                            setSelectedSlotId(slot.id);
                                            setErrorMessage('');
                                        }}
                                        disabled={unavailable || submitting}
                                    >
                                        <span className="iss-radio" aria-hidden="true" />
                                        <span className="iss-row-day">{formatDayLong(start)}</span>
                                        <span className="iss-row-time">
                                            {unavailable ? 'No longer available' : formatTime(start)}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <p className="iss-hint">None of these work? Contact HR before choosing.</p>
                    </section>

                    <aside className="iss-card iss-side">
                        <p className="iss-side-label">Your selection</p>
                        {selectedStart ? (
                            <p className="iss-side-time">
                                {formatDayComma(selectedStart)} · {formatTime(selectedStart)}
                            </p>
                        ) : (
                            <p className="iss-side-empty">Pick a time from the list</p>
                        )}

                        <ul className="iss-side-list">
                            <li>
                                <IconClock size={22} stroke={1.5} />
                                <span>{interview.duration_minutes} minutes</span>
                            </li>
                            <li>
                                {isZoom ? <IconVideo size={22} stroke={1.5} /> : <IconMapPin size={22} stroke={1.5} />}
                                <span>
                                    {isZoom
                                        ? 'Zoom, link shown after you confirm'
                                        : `On-site${interview.location ? `, ${interview.location}` : ''}`}
                                </span>
                            </li>
                            {panel.length > 0 && (
                                <li>
                                    <IconUsers size={22} stroke={1.5} />
                                    <span>Panel</span>
                                    <span className="iss-avatars">
                                        {panel.map(member => (
                                            <span key={member.id} className="iss-avatar">
                                                {getInitials(member.name)}
                                            </span>
                                        ))}
                                    </span>
                                </li>
                            )}
                        </ul>

                        <button
                            type="button"
                            className="iss-btn"
                            onClick={handleConfirm}
                            disabled={!selectedSlotId || submitting}
                        >
                            {submitting ? 'Confirming...' : 'Confirm interview'}
                        </button>
                    </aside>
                </div>
            </div>
        </div>
    );
}

export default InterviewSlotSelector;