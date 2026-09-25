import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../../../utils/auth';
import { getAllDepartments } from '../../../services/departmentService';
import { deleteJob } from '../../../services/jobService';
import { notify } from '../../../utils/notify';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import './Vacancies.css';

const EMPTY_FORM = {
    title: '',
    description: '',
    department: '',
    location: '',
    job_type: 'FULL_TIME',
    required_skills: [],
    status: 'OPEN',
    closing_date: ''
};

function Vacancies() {
    const navigate = useNavigate();
    
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDepartment, setFilterDepartment] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [departments, setDepartments] = useState([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [jobToDelete, setJobToDelete] = useState(null);

    useEffect(() => {
        fetchData();
        fetchDepartments();
    }, []);

    const fetchData = async () => {
        try {
            const token = getToken();
            
            const jobsRes = await fetch('http://localhost:5000/api/jobs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (jobsRes.ok) {
                const jobsData = await jobsRes.json();
                setJobs(jobsData.jobs || jobsData);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchDepartments = async () => {
        try {
            const data = await getAllDepartments();
            setDepartments(data.departments || []);
        } catch (error) {
            console.error('Failed to fetch departments:', error);
        }
    };

    const countByStatus = (status) => {
        return jobs.filter(j => j.status === status).length;
    };

    const filteredJobs = jobs.filter(job => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const titleMatch = job.title?.toLowerCase().includes(query);
            const skillsMatch = Array.isArray(job.required_skills) 
                ? job.required_skills.some(skill => skill.toLowerCase().includes(query))
                : false;
            if (!titleMatch && !skillsMatch) return false;
        }

        if (filterDepartment && String(job.department_id) !== String(filterDepartment)) {
            return false;
        }

        if (filterStatus && job.status !== filterStatus) {
            return false;
        }

        return true;
    });

    const uniqueDepartments = [...new Set(jobs.map(j => j.department_name).filter(Boolean))];

    const handleCreateJob = () => {
        navigate('/hr/vacancies/new');
    };

    const handleEditJob = (job) => {
        navigate(`/hr/vacancies/${job.id}/edit`);
    };

    const handleViewPipeline = (jobId) => {
        navigate(`/hr/vacancies/${jobId}/applications`);
    };

    const handleDeleteJob = (job) => {
        setJobToDelete(job);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!jobToDelete) return;

        try {
            await deleteJob(jobToDelete.id);
            notify.success('Vacancy deleted successfully');
            fetchData();
        } catch (error) {
            notify.error(error.message || 'Failed to delete vacancy');
        } finally {
            setShowDeleteConfirm(false);
            setJobToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setJobToDelete(null);
    };

    const getStatusBadgeClass = (status) => {
        switch(status) {
            case 'OPEN': return 'badge-status-open';
            case 'DRAFT': return 'badge-status-draft';
            case 'CLOSED': return 'badge-status-closed';
            default: return 'badge-status-neutral';
        }
    };

    const getStatusText = (status) => {
        switch(status) {
            case 'OPEN': return 'Open';
            case 'DRAFT': return 'Draft';
            case 'CLOSED': return 'Closed';
            default: return status;
        }
    };

    return (
        <div className="vacancies-wrapper">
            <div className="vacancies-header">
                <div className="vacancies-title-section">
                    <h1 className="vacancies-title">Vacancies</h1>
                    <p className="vacancies-counts">
                        {countByStatus('OPEN')} open · {countByStatus('DRAFT')} draft · {countByStatus('CLOSED')} closed
                    </p>
                </div>
                <button className="btn-create-vacancy" onClick={handleCreateJob}>
                    + Create vacancy
                </button>
            </div>

            <div className="vacancies-filters">
                <div className="search-box">
                    <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M7 12.5C10.0376 12.5 12.5 10.0376 12.5 7C12.5 3.96243 10.0376 1.5 7 1.5C3.96243 1.5 1.5 3.96243 1.5 7C1.5 10.0376 3.96243 12.5 7 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14.5 14.5L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search by title or skill"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>

                <select 
                    className="filter-select"
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                >
                    <option value="">All departments</option>
                    {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                </select>

                <select 
                    className="filter-select"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="">All status</option>
                    <option value="OPEN">Open</option>
                    <option value="DRAFT">Draft</option>
                    <option value="CLOSED">Closed</option>
                </select>
            </div>

            {loading ? (
                <div className="loading-state">Loading vacancies...</div>
            ) : filteredJobs.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>No vacancies yet</h3>
                    <p>Create your first job vacancy to start recruiting</p>
                    <button className="btn-create-vacancy" onClick={handleCreateJob}>
                        Create vacancy
                    </button>
                </div>
            ) : (
                <div className="vacancies-table-container">
                    <table className="vacancies-table">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Department</th>
                                <th>Openings</th>
                                <th>Applicants</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredJobs.map(job => (
                                <tr key={job.id} className="vacancy-row">
                                    <td className="vacancy-title-cell">
                                        <div className="vacancy-title">{job.title}</div>
                                        <div className="vacancy-skills">
                                            {Array.isArray(job.required_skills) && job.required_skills.slice(0, 3).map((skill, idx) => (
                                                <span key={idx} className="skill-tag">{skill}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="vacancy-department">{job.department_name || 'N/A'}</td>
                                    <td className="vacancy-openings">{job.openings || 1}</td>
                                    <td className="vacancy-applicants">
                                        {job.total_applications || 0} · {job.strong_applications || 0} strong
                                    </td>
                                    <td className="vacancy-status">
                                        <span className={`status-badge ${getStatusBadgeClass(job.status)}`}>
                                            {getStatusText(job.status)}
                                        </span>
                                    </td>
                                    <td className="vacancy-action">
                                        {job.status === 'DRAFT' ? (
                                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                                <button 
                                                    className="action-link"
                                                    onClick={() => handleEditJob(job)}
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    className="action-link"
                                                    style={{ color: 'var(--error-color)' }}
                                                    onClick={() => handleDeleteJob(job)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                                <button 
                                                    className="action-link"
                                                    onClick={() => handleViewPipeline(job.id)}
                                                >
                                                    View pipeline
                                                </button>
                                                <button 
                                                    className="action-link"
                                                    style={{ color: 'var(--error-color)' }}
                                                    onClick={() => handleDeleteJob(job)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <ConfirmDialog
                open={showDeleteConfirm}
                title="Delete vacancy?"
                message={jobToDelete ? `Are you sure you want to delete "${jobToDelete.title}"? This will also delete all applications and related data. This action cannot be undone.` : ''}
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                onCancel={cancelDelete}
                isDanger={true}
            />
        </div>
    );
}

export default Vacancies;