import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { clearAuth, getUser } from '../../utils/auth';
import { useTheme } from '../../context/ThemeContext';
import { notify } from '../../utils/notify';
import ConfirmDialog from './ConfirmDialog';
import Sidebar from './Sidebar';
import logoDark from '../../assets/logo-dark.png';
import logoLight from '../../assets/logo.png';
import './TopNav.css';

function TopNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const user = getUser();
    const { theme, toggleTheme } = useTheme();

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        setShowLogoutConfirm(false);
        clearAuth();
        navigate('/login');
        notify.success('You have been logged out');
    };

    const isActive = (path) => {
        if (path === '/hr' || path === '/candidate') {
            return location.pathname === path;
        }
        return location.pathname.startsWith(path);
    };

    const navItems = user?.role === 'HR_ADMIN' ? [
        { path: '/hr', label: 'Dashboard', icon: 'dashboard' },
        { path: '/hr/vacancies', label: 'Vacancies', icon: 'briefcase' },
        { path: '/hr/applications', label: 'Applications', icon: 'inbox' }
    ] : [
        { path: '/candidate', label: 'Dashboard', icon: 'dashboard' },
        { path: '/candidate/jobs', label: 'Jobs', icon: 'briefcase' },
        { path: '/candidate/applications', label: 'My applications', icon: 'inbox' },
        { path: '/candidate/interviews', label: 'Interviews', icon: 'calendar' },
        { path: '/candidate/assessments', label: 'Assessments', icon: 'clipboard' }
    ];

    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const Icon = ({ name }) => {
        switch(name) {
            case 'dashboard':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                    </svg>
                );
            case 'briefcase':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                    </svg>
                );
            case 'inbox':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline>
                        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path>
                    </svg>
                );
            case 'calendar':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                );
            case 'clipboard':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    </svg>
                );
            case 'menu':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                );
            case 'sun':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5"></circle>
                        <line x1="12" y1="1" x2="12" y2="3"></line>
                        <line x1="12" y1="21" x2="12" y2="23"></line>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                        <line x1="1" y1="12" x2="3" y2="12"></line>
                        <line x1="21" y1="12" x2="23" y2="12"></line>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                );
            case 'moon':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                );
            default:
                return null;
        }
    };

    return (
        <nav className="top-nav">
            <div className="top-nav-content">
                {user?.role === 'HR_ADMIN' && (
                    <button 
                        className="top-nav-hamburger" 
                        onClick={() => setSidebarOpen(true)}
                        title="Menu"
                    >
                        <Icon name="menu" />
                    </button>
                )}

                <Link to={user?.role === 'HR_ADMIN' ? '/hr' : '/candidate/jobs'} className="top-nav-logo">
                    <img src={theme === 'dark' ? logoDark : logoLight} alt="Hyre.AI" className="logo-img" />
                </Link>

                <div className="top-nav-items">
                    {navItems.map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`top-nav-item ${isActive(item.path) ? 'active' : ''}`}
                        >
                            <Icon name={item.icon} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </div>

                <div className="top-nav-right">
                    {user?.role !== 'HR_ADMIN' && (
                        <button 
                            className="top-nav-icon-btn" 
                            onClick={toggleTheme}
                            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
                        </button>
                    )}

                    <div className="top-nav-user">
                        <div className="top-nav-avatar">
                            {getInitials(user?.name || 'User')}
                        </div>
                    </div>

                    {user?.role !== 'HR_ADMIN' && (
                        <button 
                            className="top-nav-logout-btn" 
                            onClick={handleLogout}
                            title="Logout"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                <polyline points="16 17 21 12 16 7"></polyline>
                                <line x1="21" y1="12" x2="9" y2="12"></line>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {user?.role === 'HR_ADMIN' && (
                <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            )}

            <ConfirmDialog
                open={showLogoutConfirm}
                title="Log out?"
                message="You will need to log in again to continue."
                confirmLabel="Log out"
                onConfirm={confirmLogout}
                onCancel={() => setShowLogoutConfirm(false)}
            />
        </nav>
    );
}

export default TopNav;
