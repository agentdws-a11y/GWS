import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyInviteToken, acceptInvite } from '../../../services/adminInviteService';
import { notify } from '../../../utils/notify';
import Logo from '../../../components/common/Logo';
import './AdminRegister.css';

function AdminRegister() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [verifying, setVerifying] = useState(true);
    const [inviteData, setInviteData] = useState(null);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        password: '',
        confirmPassword: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        verifyToken();
    }, [token]);

    const verifyToken = async () => {
        try {
            setVerifying(true);
            const data = await verifyInviteToken(token);
            
            if (data.valid) {
                setInviteData(data);
            } else {
                setError(data.message || 'Invalid invitation link');
            }
        } catch (err) {
            setError(err.message || 'Failed to verify invitation');
        } finally {
            setVerifying(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.name.trim()) {
            setError('Name is required');
            return;
        }

        if (!formData.password) {
            setError('Password is required');
            return;
        }

        if (formData.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        try {
            setSubmitting(true);
            await acceptInvite(token, formData.name.trim(), formData.password);
            
            notify.success('Admin account created successfully! Please log in.');
            navigate('/login');
        } catch (err) {
            setError(err.message || 'Failed to create admin account');
        } finally {
            setSubmitting(false);
        }
    };

    if (verifying) {
        return (
            <div className="admin-register-page">
                <Logo className="admin-logo" />
                <div className="admin-register-container">
                    <div className="verify-loading">
                        <div className="spinner"></div>
                        <p>Verifying invitation...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error && !inviteData) {
        return (
            <div className="admin-register-page">
                <Logo className="admin-logo" />
                <div className="admin-register-container">
                    <div className="error-box">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <h2>Invalid Invitation</h2>
                        <p>{error}</p>
                        <button onClick={() => navigate('/login')} className="btn-back-to-login">
                            Go to Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-register-page">
            <Logo className="admin-logo" />
            <div className="admin-register-container">

                <div className="admin-register-content">
                    <h1>Create Admin Account</h1>
                    <p className="invite-info">
                        You've been invited by <strong>{inviteData?.invitedBy}</strong> to join as an HR Admin
                    </p>

                    {error && (
                        <div className="error-message">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="admin-register-form">
                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                value={inviteData?.email || ''}
                                disabled
                                className="input-disabled"
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="name">Full Name *</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Enter your full name"
                                disabled={submitting}
                                autoFocus
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Password *</label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="At least 6 characters"
                                disabled={submitting}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password *</label>
                            <input
                                type="password"
                                id="confirmPassword"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Re-enter your password"
                                disabled={submitting}
                                required
                            />
                        </div>

                        <button 
                            type="submit" 
                            className="btn-create-account"
                            disabled={submitting}
                        >
                            {submitting ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>

                    <div className="login-link">
                        Already have an account? <a href="/login">Log in</a>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdminRegister;
