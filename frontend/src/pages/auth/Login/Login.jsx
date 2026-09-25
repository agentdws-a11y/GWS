import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser } from '../../../services/authService';
import { validateEmail } from '../../../utils/validation';
import { saveToken, saveUser } from '../../../utils/auth';
import Logo from '../../../components/common/Logo';
import './Login.css';

function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError('');

        const emailError = validateEmail(email);

        if (emailError) {
            setError(emailError);
            return;
        }

        if (!password) {
            setError('Password is required');
            return;
        }

        setLoading(true);

        try {
            const data = await loginUser(email, password);

            saveToken(data.token);
            saveUser(data.user);

            console.log('Login successful:', data);

            if (data.user.role === 'HR_ADMIN') {
                navigate('/hr');
            } else if (data.user.role === 'CANDIDATE') {
                navigate('/candidate');
            }
        } catch (error) {
            setError(error.message);
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
                    <h1>Welcome back</h1>
                    <p>Sign in to continue to your hiring workspace</p>
                </div>

                <form className="modern-auth-form" onSubmit={handleSubmit}>

                    <div className="modern-form-field">
                        <label htmlFor="email">Email</label>

                        <div className="modern-input-wrapper">
                            <svg
                                className="modern-input-icon"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect x="3" y="5" width="18" height="14" rx="2" />
                                <polyline points="3 7 12 13 21 7" />
                            </svg>

                            <input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                autoComplete="email"
                            />
                        </div>
                    </div>

                    <div className="modern-form-field">
                        <label htmlFor="password">Password</label>

                        <div className="modern-input-wrapper">
                            <svg
                                className="modern-input-icon"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <rect x="5" y="11" width="14" height="10" rx="2" />
                                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                            </svg>

                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="current-password"
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
                    </div>

                    {error && <div className="modern-error-message">{error}</div>}

                    <button
                        type="submit"
                        className="modern-submit-button"
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="modern-register-text">
                    Don't have an account?{' '}
                    <button
                        type="button"
                        className="modern-register-link"
                        onClick={() => navigate('/register')}
                    >
                        Create account
                    </button>
                </p>

            </div>
        </div>
    );
}

export default Login;