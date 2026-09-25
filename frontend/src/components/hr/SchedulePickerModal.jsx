import { useState, useEffect, useMemo } from 'react';
import { IconX } from '@tabler/icons-react';
import { getAllApplications } from '../../services/applicationService';
import { getInitials } from '../../utils/interviewTime';
import './SchedulePickerModal.css';

function SchedulePickerModal({ onClose, onContinue }) {
    const [shortlisted, setShortlisted] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [jobId, setJobId] = useState('');
    const [applicationId, setApplicationId] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const response = await getAllApplications();
                const list = Array.isArray(response) ? response : (response.applications || []);
                const onlyShortlisted = list.filter(app => app.stage === 'SHORTLISTED');
                setShortlisted(onlyShortlisted);
                if (onlyShortlisted.length > 0) setJobId(String(onlyShortlisted[0].job_id));
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const vacancies = useMemo(() => {
        const map = new Map();
        shortlisted.forEach(app => {
            const key = String(app.job_id);
            if (!map.has(key)) map.set(key, { id: key, title: app.job_title, count: 0 });
            map.get(key).count += 1;
        });
        return Array.from(map.values());
    }, [shortlisted]);

    const candidates = shortlisted.filter(app => String(app.job_id) === jobId);

    const handleVacancyChange = (e) => {
        setJobId(e.target.value);
        setApplicationId(null);
    };

    return (
        <div className="hsp-overlay" onClick={onClose}>
            <div
                className="hsp-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="hsp-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="hsp-header">
                    <div>
                        <h2 className="hsp-title" id="hsp-title">Schedule interview</h2>
                        <p className="hsp-subtitle">Choose a vacancy and a shortlisted candidate.</p>
                    </div>
                    <button type="button" className="hsp-close" onClick={onClose} aria-label="Close">
                        <IconX size={22} stroke={1.5} />
                    </button>
                </div>

                {loading && <p className="hsp-message">Loading...</p>}

                {!loading && error && <p className="hsp-message hsp-message-error">{error}</p>}

                {!loading && !error && shortlisted.length === 0 && (
                    <p className="hsp-message">
                        No one is shortlisted yet. Shortlist a candidate from Applications first.
                    </p>
                )}

                {!loading && !error && shortlisted.length > 0 && (
                    <>
                        <label className="hsp-label" htmlFor="hsp-vacancy">Vacancy</label>
                        <select
                            id="hsp-vacancy"
                            className="hsp-select"
                            value={jobId}
                            onChange={handleVacancyChange}
                        >
                            {vacancies.map(vacancy => (
                                <option key={vacancy.id} value={vacancy.id}>
                                    {vacancy.title} ({vacancy.count})
                                </option>
                            ))}
                        </select>

                        <p className="hsp-label">Shortlisted candidates</p>
                        <div className="hsp-list" role="radiogroup" aria-label="Shortlisted candidates">
                            {candidates.map(app => {
                                const selected = applicationId === app.id;
                                const round = app.current_round || 1;
                                return (
                                    <button
                                        key={app.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        className={`hsp-row ${selected ? 'hsp-row-selected' : ''}`}
                                        onClick={() => setApplicationId(app.id)}
                                    >
                                        <span className="hsp-avatar">{getInitials(app.candidate_name)}</span>
                                        <span className="hsp-row-text">
                                            <strong>{app.candidate_name}</strong>
                                            <span>{round > 1 ? `Round ${round} not scheduled yet` : 'Not scheduled yet'}</span>
                                        </span>
                                        {app.match_percent !== null && app.match_percent !== undefined && (
                                            <span className="hsp-match">{app.match_percent}% match</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                <div className="hsp-actions">
                    <button type="button" className="hsp-btn hsp-btn-secondary" onClick={onClose}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="hsp-btn hsp-btn-primary"
                        onClick={() => onContinue(applicationId)}
                        disabled={!applicationId}
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SchedulePickerModal;