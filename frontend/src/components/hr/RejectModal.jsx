import { useState } from 'react';
import './RejectModal.css';

const REJECTION_REASONS = [
    { value: 'SKILLS_MISMATCH', label: 'Skills mismatch' },
    { value: 'NOT_ENOUGH_EXPERIENCE', label: 'Not enough experience' },
    { value: 'DUPLICATE_APPLICATION', label: 'Duplicate application' },
    { value: 'POSITION_FILLED', label: 'Position filled' },
    { value: 'FAILED_INTERVIEW', label: 'Failed interview' },
    { value: 'OTHER', label: 'Other' }
];

function RejectModal({ application, onCancel, onConfirm, loading }) {
    const [reason, setReason] = useState('');
    const [note, setNote] = useState('');

    const handleConfirm = () => {
        if (!reason) return;
        onConfirm(reason, note.trim());
    };

    return (
        <div className="hrm-overlay" onClick={onCancel}>
            <div className="hrm-dialog" onClick={(e) => e.stopPropagation()}>
                <h2 className="hrm-title">Reject application</h2>
                <p className="hrm-subtitle">{application.candidate_name} · {application.job_title}</p>

                <div className="hrm-field">
                    <label>Reason *</label>
                    <select value={reason} onChange={(e) => setReason(e.target.value)}>
                        <option value="">Select a reason...</option>
                        {REJECTION_REASONS.map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                </div>

                <div className="hrm-field">
                    <label>Note (optional)</label>
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Internal note, not shown to the candidate"
                        rows={3}
                    />
                </div>

                <div className="hrm-actions">
                    <button className="hrm-btn hrm-btn-secondary" onClick={onCancel} disabled={loading}>
                        Cancel
                    </button>
                    <button
                        className="hrm-btn hrm-btn-danger"
                        onClick={handleConfirm}
                        disabled={loading || !reason}
                    >
                        {loading ? 'Rejecting...' : 'Reject application'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RejectModal;