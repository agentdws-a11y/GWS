import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus, IconEdit, IconTrash, IconClock, IconCheck, IconX } from '@tabler/icons-react';
import { getToken } from '../../../utils/auth';
import './AssessmentList.css';

function AssessmentList() {
    const navigate = useNavigate();
    
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            setError('');
            const token = getToken();
            
            const response = await fetch('http://localhost:5000/api/assessments/templates', {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setTemplates(data.templates || []);
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to fetch assessments');
            }
        } catch (error) {
            console.error('Failed to fetch templates:', error);
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (templateId) => {
        try {
            const token = getToken();
            
            const response = await fetch(`http://localhost:5000/api/assessments/templates/${templateId}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                setTemplates(templates.filter(t => t.id !== templateId));
                setDeleteConfirm(null);
            } else {
                const errorData = await response.json();
                alert(errorData.message || 'Failed to delete assessment');
            }
        } catch (error) {
            console.error('Failed to delete template:', error);
            alert('Network error. Please try again.');
        }
    };

    const getStatusBadgeClass = (status) => {
        return status === 'ACTIVE' ? 'status-badge-active' : 'status-badge-inactive';
    };

    if (loading) {
        return (
            <div className="assessments-page">
                <div className="loading-message">Loading assessments...</div>
            </div>
        );
    }

    return (
        <div className="assessments-page">
            <div className="assessments-header">
                <div>
                    <h1 className="page-title">Assessments</h1>
                    <p className="page-subtitle">Manage skills tests and link them to vacancies</p>
                </div>
                <button 
                    className="btn-primary"
                    onClick={() => navigate('/hr/assessments/new')}
                >
                    <IconPlus size={18} />
                    Create Assessment
                </button>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {templates.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">
                        <IconClock size={48} />
                    </div>
                    <h3>No assessments yet</h3>
                    <p>Create your first skills test to assign to job vacancies</p>
                    <button 
                        className="btn-primary"
                        onClick={() => navigate('/hr/assessments/new')}
                    >
                        <IconPlus size={18} />
                        Create Assessment
                    </button>
                </div>
            ) : (
                <div className="templates-grid">
                    {templates.map((template) => (
                        <div key={template.id} className="template-card">
                            <div className="template-header">
                                <h3 className="template-title">{template.title}</h3>
                                <span className={`status-badge ${getStatusBadgeClass(template.status)}`}>
                                    {template.status}
                                </span>
                            </div>

                            {template.description && (
                                <p className="template-description">{template.description}</p>
                            )}

                            <div className="template-meta">
                                <div className="meta-item">
                                    <IconClock size={16} />
                                    <span>{template.duration_minutes} minutes</span>
                                </div>
                                <div className="meta-item">
                                    <IconCheck size={16} />
                                    <span>{template.passing_score}% to pass</span>
                                </div>
                                <div className="meta-item">
                                    <span className="question-count">
                                        {template.question_count} {template.question_count === 1 ? 'question' : 'questions'}
                                    </span>
                                </div>
                            </div>

                            <div className="template-footer">
                                <span className="creator-info">
                                    Created by {template.creator_name || 'Unknown'}
                                </span>
                                <div className="template-actions">
                                    <button
                                        className="btn-icon"
                                        onClick={() => navigate(`/hr/assessments/${template.id}/edit`)}
                                        title="Edit assessment"
                                    >
                                        <IconEdit size={18} />
                                    </button>
                                    <button
                                        className="btn-icon btn-danger"
                                        onClick={() => setDeleteConfirm(template.id)}
                                        title="Delete assessment"
                                    >
                                        <IconTrash size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Delete Assessment</h3>
                        </div>
                        <div className="modal-body">
                            <p>Are you sure you want to delete this assessment?</p>
                            <p className="warning-text">
                                <IconX size={16} />
                                This action cannot be undone. If this assessment is linked to jobs, you must unlink it first.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="btn-secondary"
                                onClick={() => setDeleteConfirm(null)}
                            >
                                Cancel
                            </button>
                            <button 
                                className="btn-danger"
                                onClick={() => handleDelete(deleteConfirm)}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AssessmentList;
