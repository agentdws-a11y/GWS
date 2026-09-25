import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerCandidate } from '../../../services/authService';
import Logo from '../../../components/common/Logo';
import {
    validateName,
    validateEmail,
    validatePassword,
    validateConfirmPassword
} from '../../../utils/validation';
import './Register.css';

function Register() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [errors, setErrors] = useState({});
    const [serverMessage, setServerMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        setErrors({});
        setServerMessage('');
        setSuccessMessage('');

        const nameError = validateName(name);
        const emailError = validateEmail(email);
        const passwordError = validatePassword(password);
        const confirmPasswordError = validateConfirmPassword(
            password,
            confirmPassword
        );

        const validationErrors = {};

        if (nameError) {
            validationErrors.name = nameError;
        }

        if (emailError) {
            validationErrors.email = emailError;
        }

        if (passwordError) {
            validationErrors.password = passwordError;
        }

        if (confirmPasswordError) {
            validationErrors.confirmPassword = confirmPasswordError;
        }

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setLoading(true);

        try {
            const data = await registerCandidate(name, email, password);
            setSuccessMessage(data.message || 'Registration successful! Redirecting to login...');
            
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (error) {
            setServerMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modern-auth-screen">
            <div className="modern-brand-logo">
                <Logo className="modern-logo-img" />
            </div>

            <div className="modern-auth-card">
                <div className="modern-card-heading">
                    <h1>Create account</h1>
                    <p>Join Hyre.AI and start your career journey</p>
                </div>

                <form className="modern-auth-form" onSubmit={handleSubmit}>
                    <div className="modern-form-field">
                        <label htmlFor="name">Full Name</label>
                        <div className="modern-input-wrapper">
                            <svg className="modern-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                            <input
                                id="name"
                                type="text"
                                placeholder="Enter your full name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="name"
                            />
                        </div>
                        {errors.name && <p className="modern-field-error">{errors.name}</p>}
                    </div>

                    <div className="modern-form-field">
                        <label htmlFor="email">Email</label>
                        <div className="modern-input-wrapper">
                            <svg className="modern-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="5" width="18" height="14" rx="2" />
                                <polyline points="3 7 12 13 21 7" />
                            </svg>
                            <input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                            />
                        </div>
                        {errors.email && <p className="modern-field-error">{errors.email}</p>}
                    </div>

                    <div className="modern-form-field">
                        <label htmlFor="password">Password</label>
                        <div className="modern-input-wrapper">
                            <svg className="modern-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="5" y="11" width="14" height="10" rx="2" />
                                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                            </svg>
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Create a password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="modern-password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 3l18 18" />
                                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                                        <path d="M9.9 4.2A10.6 10.6 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-3.1 4.4" />
                                        <path d="M6.6 6.6C3.5 8.7 2 12 2 12s3 8 10 8a10.7 10.7 0 0 0 3.4-.5" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        {errors.password && <p className="modern-field-error">{errors.password}</p>}
                    </div>

                    <div className="modern-form-field">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <div className="modern-input-wrapper">
                            <svg className="modern-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="5" y="11" width="14" height="10" rx="2" />
                                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                            </svg>
                            <input
                                id="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                placeholder="Confirm your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                            <button
                                type="button"
                                className="modern-password-toggle"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                            >
                                {showConfirmPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M3 3l18 18" />
                                        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                                        <path d="M9.9 4.2A10.6 10.6 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-3.1 4.4" />
                                        <path d="M6.6 6.6C3.5 8.7 2 12 2 12s3 8 10 8a10.7 10.7 0 0 0 3.4-.5" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        {errors.confirmPassword && <p className="modern-field-error">{errors.confirmPassword}</p>}
                    </div>

                    {serverMessage && (
                        <div className="modern-error-message">
                            {serverMessage}
                        </div>
                    )}

                    {successMessage && (
                        <div className="modern-success-message">
                            {successMessage}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="modern-submit-button"
                        disabled={loading}
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <p className="modern-register-text">
                    Already have an account?{' '}
                    <button
                        type="button"
                        className="modern-register-link"
                        onClick={() => navigate('/login')}
                    >
                        Sign in
                    </button>
                </p>
            </div>
        </div>
    );
}

export default Register;