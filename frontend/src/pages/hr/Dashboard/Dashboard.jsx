import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, getToken } from '../../../utils/auth';
import './Dashboard.css';

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
}

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

function getFormattedDate() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    const now = new Date();
    const dayName = days[now.getDay()];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    
    return `${dayName}, ${day} ${month} ${year}`;
}

function formatTime(datetime) {
    if (!datetime) return '';
    const date = new Date(datetime);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
}

function Dashboard() {
    const navigate = useNavigate();
    const user = getUser();
    
    const [homeData, setHomeData] = useState({
        counters: {
            openVacancies: 0,
            newApplications: 0,
            interviewsThisWeek: 0,
            duplicateFlags: 0
        },
        newestApplications: [],
        interviewsToday: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHomeData();
    }, []);

    const fetchHomeData = async () => {
        try {
            const token = getToken();
            const response = await fetch('http://localhost:5000/api/applications/hr/home', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setHomeData(data);
            }
        } catch (error) {
            console.error('Failed to fetch home data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getMatchBadgeClass = (label) => {
        switch(label) {
            case 'STRONG': return 'match-badge-strong';
            case 'POSSIBLE': return 'match-badge-possible';
            case 'NOT_A_FIT': return 'match-badge-weak';
            default: return 'match-badge-neutral';
        }
    };

    return (
        <div className="hr-dashboard">
            <div className="dashboard-greeting">
                <h1 className="greeting-title">{getGreeting()}, {user?.name || 'HR Admin'}</h1>
                <p className="greeting-date">{getFormattedDate()}</p>
            </div>

            <div className="counter-grid">
                <div className="counter-card">
                    <div className="counter-label">Open vacancies</div>
                    <div className="counter-value">{homeData.counters.openVacancies}</div>
                </div>
                <div className="counter-card">
                    <div className="counter-label">New applications</div>
                    <div className="counter-value">{homeData.counters.newApplications}</div>
                </div>
                <div className="counter-card">
                    <div className="counter-label">Interviews this week</div>
                    <div className="counter-value">{homeData.counters.interviewsThisWeek}</div>
                </div>
                <div className="counter-card">
                    <div className="counter-label">Duplicate flags</div>
                    <div className="counter-value">{homeData.counters.duplicateFlags}</div>
                </div>
            </div>

            <div className="dashboard-sections">
                <div className="dashboard-section">
                    <div className="section-header">
                        <h2 className="section-title">Newest applications</h2>
                        <button 
                            className="section-link"
                            onClick={() => navigate('/hr/applications')}
                        >
                            View all
                        </button>
                    </div>

                    <div className="section-content">
                        {loading ? (
                            <div className="section-empty">Loading...</div>
                        ) : homeData.newestApplications.length === 0 ? (
                            <div className="section-empty">No applications yet</div>
                        ) : (
                            <div className="applications-list">
                                {homeData.newestApplications.map((app) => (
                                    <div 
                                        key={app.id} 
                                        className="application-row"
                                        onClick={() => navigate(`/hr/applications/${app.id}`)}
                                    >
                                        <div className="app-avatar">{getInitials(app.candidate_name)}</div>
                                        <div className="app-info">
                                            <div className="app-name">{app.candidate_name}</div>
                                            <div className="app-job">{app.job_title}</div>
                                        </div>
                                        <div className={`app-match ${getMatchBadgeClass(app.match_label)}`}>
                                            {app.match_percent}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="dashboard-section">
                    <div className="section-header">
                        <h2 className="section-title">Interviews today</h2>
                        <button 
                            className="section-link"
                            onClick={() => navigate('/hr/interviews')}
                        >
                            Open
                        </button>
                    </div>

                    <div className="section-content">
                        {loading ? (
                            <div className="section-empty">Loading...</div>
                        ) : homeData.interviewsToday.length === 0 ? (
                            <div className="section-empty">No interviews today</div>
                        ) : (
                            <div className="interviews-list">
                                {homeData.interviewsToday.map((interview) => (
                                    <div 
                                        key={interview.id} 
                                        className="interview-row"
                                        onClick={() => navigate(`/hr/interviews/${interview.id}`)}
                                    >
                                        <div className="interview-time">{formatTime(interview.scheduled_start)}</div>
                                        <div className="interview-info">
                                            <div className="interview-name">{interview.candidate_name}</div>
                                            <div className="interview-details">
                                                {interview.round_name} · {interview.mode === 'ZOOM' ? 'Zoom' : 'On-site'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;