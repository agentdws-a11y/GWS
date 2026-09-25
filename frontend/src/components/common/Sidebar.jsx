import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { clearAuth } from '../../utils/auth';
import { useTheme } from '../../context/ThemeContext';
import { notify } from '../../utils/notify';
import ConfirmDialog from './ConfirmDialog';
import './Sidebar.css';

function Sidebar({ isOpen, onClose }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { theme, toggleTheme } = useTheme();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        setShowLogoutConfirm(false);
        onClose();
        clearAuth();
        navigate('/login');
        notify.success('You have been logged out');
    };

    const isActive = (path) => {
        if (path === '/hr') {
            return location.pathname === path;
        }
        return location.pathname.startsWith(path);
    };

    const sidebarItems = [
        { path: '/hr', label: 'Dashboard', icon: 'dashboard' },
        { path: '/hr/vacancies', label: 'Vacancies', icon: 'briefcase' },
        { path: '/hr/applications', label: 'Applications', icon: 'inbox' },
        { path: '/hr/analytics', label: 'Analytics & Reports', icon: 'chart' },
        { path: '/hr/departments', label: 'Departments', icon: 'building' },
        { path: '/hr/admin-invites', label: 'Admin Invites', icon: 'user-plus' },
        { path: '/hr/interviews', label: 'Interviews', icon: 'calendar' },
        { path: '/hr/assessments', label: 'Assessments', icon: 'clipboard' }
    ];

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
            case 'chart':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10"></line>
                        <line x1="12" y1="20" x2="12" y2="4"></line>
                        <line x1="6" y1="20" x2="6" y2="14"></line>
                    </svg>
                );
            case 'building':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                        <path d="M9 22v-4h6v4"></path>
                        <path d="M8 6h.01"></path>
                        <path d="M16 6h.01"></path>
                        <path d="M12 6h.01"></path>
                        <path d="M12 10h.01"></path>
                        <path d="M12 14h.01"></path>
                        <path d="M16 10h.01"></path>
                        <path d="M16 14h.01"></path>
                        <path d="M8 10h.01"></path>
                        <path d="M8 14h.01"></path>
                    </svg>
                );
            case 'user-plus':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="8.5" cy="7" r="4"></circle>
                        <line x1="20" y1="8" x2="20" y2="14"></line>
                        <line x1="23" y1="11" x2="17" y2="11"></line>
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
            case 'logout':
                return (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                );
            default:
                return null;
        }
    };

    const handleNavClick = (path) => {
        navigate(path);
        onClose();
    };

    return (
        <>
            <div 
                className={`sidebar-backdrop ${isOpen ? 'sidebar-backdrop-visible' : ''}`}
                onClick={onClose}
            />

            <div className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
                <div className="sidebar-header">
                    <h2 className="sidebar-title">Menu</h2>
                    <button className="sidebar-close" onClick={onClose}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div className="sidebar-content">
                    <div className="sidebar-section">
                        <div className="sidebar-section-label">Navigation</div>
                        {sidebarItems.map(item => (
                            <button
                                key={item.path}
                                onClick={() => handleNavClick(item.path)}
                                className={`sidebar-item ${isActive(item.path) ? 'sidebar-item-active' : ''}`}
                            >
                                <Icon name={item.icon} />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>

                    <div className="sidebar-section">
                        <div className="sidebar-section-label">Settings</div>
                        <button 
                            className="sidebar-item" 
                            onClick={toggleTheme}
                        >
                            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
                            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
                        </button>
                    </div>

                    <div className="sidebar-section">
                        <button 
                            className="sidebar-item sidebar-item-danger" 
                            onClick={handleLogout}
                        >
                            <Icon name="logout" />
                            <span>Log out</span>
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={showLogoutConfirm}
                title="Log out?"
                message="You will need to log in again to continue."
                confirmLabel="Log out"
                onConfirm={confirmLogout}
                onCancel={() => setShowLogoutConfirm(false)}
            />
        </>
    );
}

export default Sidebar;
