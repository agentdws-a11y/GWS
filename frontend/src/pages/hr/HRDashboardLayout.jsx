import { useState, useEffect } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { getUser, clearAuth } from '../../utils/auth';
import { getAllJobs } from '../../services/jobService';
import { getAllApplications } from '../../services/applicationService';
import TopNav from '../../components/common/TopNav';

function HRDashboardLayout() {
    const navigate = useNavigate();
    const user = getUser();

    const [jobs, setJobs] = useState([]);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadJobs();
        loadApplications();
    }, []);

    const loadJobs = async () => {
        try {
            setLoading(true);
            setError('');
            const response = await getAllJobs();
            setJobs(response.jobs || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const loadApplications = async () => {
        try {
            const response = await getAllApplications();
            setApplications(response.applications || []);
        } catch (err) {
            console.error('Failed to load applications:', err);
        }
    };

    const handleLogout = () => {
        clearAuth();
        navigate('/login');
    };

    return (
        <div className="app-container">
            <TopNav />
            
            <main className="app-main">
                <div className="app-content">
                    <Outlet context={{ jobs, applications, loading, error, reloadJobs: loadJobs, reloadApplications: loadApplications }} />
                </div>
            </main>
        </div>
    );
}

export default HRDashboardLayout;