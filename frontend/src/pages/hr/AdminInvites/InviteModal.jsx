import { useState } from 'react';
import './InviteModal.css';

function InviteModal({ onClose, onSend }) {
    const [formData, setFormData] = useState({
        email: '',
        name: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.email.trim()) {
            setError('Email is required');
            return;
        }

        if (!formData.name.trim()) {
            setError('Name is required');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Invalid email format');
            return;
        }

        try {
            setSubmitting(true);
            await onSend(formData.email.trim(), formData.name.trim());
        } catch (err) {
            setError(err.message || 'Failed to send invitation');
        } finally {
            setSubmitting(false);
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="invite-modal-backdrop" onClick={handleBackdropClick}>
            <div className="invite-modal">
                <div className="invite-modal-header">
                    <h2>Invite Admin</h2>
                    <button className="invite-modal-close" onClick={onClose}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="invite-modal-body">
                        {error && (
                            <div className="invite-error-message">
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="name">Name *</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Enter admin's full name"
                                disabled={submitting}
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email *</label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="admin@company.com"
                                disabled={submitting}
                            />
                        </div>

                        <div className="invite-info-box">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            <p>An invitation email will be sent with a registration link. The link will be valid for 7 days.</p>
                        </div>
                    </div>

                    <div className="invite-modal-footer">
                        <button 
                            type="button" 
                            className="btn-cancel" 
                            onClick={onClose}
                            disabled={submitting}
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="btn-send"
                            disabled={submitting}
                        >
                            {submitting ? 'Sending...' : 'Send Invitation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default InviteModal;
