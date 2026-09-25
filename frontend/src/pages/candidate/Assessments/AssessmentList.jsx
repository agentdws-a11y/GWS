import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconClock, IconCheck, IconX, IconAlertCircle, IconPlayerPlay } from '@tabler/icons-react';
import { getMyCandidateAssessments } from '../../../services/assessmentService';
import { notify } from '../../../utils/notify';
import './AssessmentList.css';

function formatDateTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    }).replace(/\b(am|pm)\b/, m => m.toUpperCase());
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric'
    });
}

function getStatusBadge(assessment) {
    const now = new Date();
    const deadline = assessment.deadline_at ? new Date(assessment.deadline_at) : null;
    
    if (assessment.status === 'GRADED') {
        return {
            label: assessment.passed ? 'Passed' : 'Failed',
            className: assessment.passed ? 'status-passed' : 'status-failed',
            icon: assessment.passed ? IconCheck : IconX
        };
    }
    
    if (assessment.status === 'IN_PROGRESS') {
        return {
            label: 'In Progress',
            className: 'status-in-progress',
            icon: IconPlayerPlay
        };
    }
    
    if (deadline && deadline < now) {
        return {
            label: 'Expired',
            className: 'status-expired',
            icon: IconAlertCircle
        };
    }
    
    return {
        label: 'Pending',
        className: 'status-pending',
        icon: IconClock
    };
}

function AssessmentList() {
    const navigate = useNavigate();
    
    const [assessments, setAssessments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchAssessments();
    }, []);

    const fetchAssessments = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await getMyCandidateAssessments();
            setAssessments(data.assessments || []);
        } catch (err) {
            setError(err.message);
            notify.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleStartAssessment = (assessmentId) => {
        navigate(`/candidate/assessments/${assessmentId}/take`);
    };

    const handleViewResult = (assessmentId) => {
        navigate(`/candidate/assessments/${assessmentId}/result`);
    };

    if (loading) {
        return (
            <div className="candidate-assessments-page">
                <div className="loading-message">Loading assessments...</div>
            </div>
        );
    }

    const pendingAssessments = assessments.filter(a => a.status === 'PENDING' && (!a.deadline_at || new Date(a.deadline_at) >= new Date()));
    const inProgressAssessments = assessments.filter(a => a.status === 'IN_PROGRESS');
    const completedAssessments = assessments.filter(a => a.status === 'GRADED');
    const expiredAssessments = assessments.filter(a => a.status === 'PENDING' && a.deadline_at && new Date(a.deadline_at) < new Date());

    return (
        <div className="candidate-assessments-page">
            <div className="assessments-header">
                <div>
                    <h1 className="page-title">My Assessments</h1>
                    <p className="page-subtitle">Skills tests assigned to your applications</p>
                </div>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {assessments.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">
                        <IconClock size={48} />
                    </div>
                    <h3>No assessments yet</h3>
                    <p>Assessments will appear here once you apply for jobs that require skills tests</p>
                </div>
            ) : (
                <div className="assessments-sections">
                    {pendingAssessments.length > 0 && (
                        <section className="assessment-section">
                            <h2 className="section-title">
                                <IconClock size={20} />
                                Pending ({pendingAssessments.length})
                            </h2>
                            <div className="assessment-grid">
                                {pendingAssessments.map((assessment) => {
                                    const statusBadge = getStatusBadge(assessment);
                                    const StatusIcon = statusBadge.icon;
                                    
                                    return (
                                        <div key={assessment.id} className="assessment-card">
                                            <div className="assessment-card-header">
                                                <h3 className="assessment-title">{assessment.assessment_title}</h3>
                                                <span className={`status-badge ${statusBadge.className}`}>
                                                    <StatusIcon size={14} />
                                                    {statusBadge.label}
                                                </span>
                                            </div>

                                            {assessment.description && (
                                                <p className="assessment-description">{assessment.description}</p>
                                            )}

                                            <div className="assessment-meta">
                                                <div className="meta-item">
                                                    <span className="meta-label">For Job:</span>
                                                    <span className="meta-value">{assessment.job_title}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-label">Duration:</span>
                                                    <span className="meta-value">{assessment.duration_minutes} minutes</span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-label">Passing Score:</span>
                                                    <span className="meta-value">{assessment.passing_score}%</span>
                                                </div>
                                                {assessment.deadline_at && (
                                                    <div className="meta-item">
                                                        <span className="meta-label">Deadline:</span>
                                                        <span className="meta-value deadline">{formatDateTime(assessment.deadline_at)}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="assessment-actions">
                                                <button
                                                    className="btn-primary"
                                                    onClick={() => handleStartAssessment(assessment.id)}
                                                >
                                                    <IconPlayerPlay size={18} />
                                                    Start Assessment
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {inProgressAssessments.length > 0 && (
                        <section className="assessment-section">
                            <h2 className="section-title">
                                <IconPlayerPlay size={20} />
                                In Progress ({inProgressAssessments.length})
                            </h2>
                            <div className="assessment-grid">
                                {inProgressAssessments.map((assessment) => {
                                    const statusBadge = getStatusBadge(assessment);
                                    const StatusIcon = statusBadge.icon;
                                    
                                    return (
                                        <div key={assessment.id} className="assessment-card">
                                            <div className="assessment-card-header">
                                                <h3 className="assessment-title">{assessment.assessment_title}</h3>
                                                <span className={`status-badge ${statusBadge.className}`}>
                                                    <StatusIcon size={14} />
                                                    {statusBadge.label}
                                                </span>
                                            </div>

                                            <div className="assessment-meta">
                                                <div className="meta-item">
                                                    <span className="meta-label">For Job:</span>
                                                    <span className="meta-value">{assessment.job_title}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-label">Duration:</span>
                                                    <span className="meta-value">{assessment.duration_minutes} minutes</span>
                                                </div>
                                            </div>

                                            <div className="assessment-warning">
                                                <IconAlertCircle size={16} />
                                                <span>You started this assessment. Continue where you left off.</span>
                                            </div>

                                            <div className="assessment-actions">
                                                <button
                                                    className="btn-primary"
                                                    onClick={() => handleStartAssessment(assessment.id)}
                                                >
                                                    Continue Assessment
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {completedAssessments.length > 0 && (
                        <section className="assessment-section">
                            <h2 className="section-title">
                                <IconCheck size={20} />
                                Completed ({completedAssessments.length})
                            </h2>
                            <div className="assessment-grid">
                                {completedAssessments.map((assessment) => {
                                    const statusBadge = getStatusBadge(assessment);
                                    const StatusIcon = statusBadge.icon;
                                    
                                    return (
                                        <div key={assessment.id} className="assessment-card">
                                            <div className="assessment-card-header">
                                                <h3 className="assessment-title">{assessment.assessment_title}</h3>
                                                <span className={`status-badge ${statusBadge.className}`}>
                                                    <StatusIcon size={14} />
                                                    {statusBadge.label}
                                                </span>
                                            </div>

                                            <div className="assessment-meta">
                                                <div className="meta-item">
                                                    <span className="meta-label">For Job:</span>
                                                    <span className="meta-value">{assessment.job_title}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-label">Score:</span>
                                                    <span className={`meta-value score ${assessment.passed ? 'passed' : 'failed'}`}>
                                                        {assessment.score != null ? Number(assessment.score).toFixed(1) : '0.0'}%
                                                    </span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-label">Submitted:</span>
                                                    <span className="meta-value">{formatDate(assessment.submitted_at)}</span>
                                                </div>
                                            </div>

                                            <div className="assessment-actions">
                                                <button
                                                    className="btn-secondary"
                                                    onClick={() => handleViewResult(assessment.id)}
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {expiredAssessments.length > 0 && (
                        <section className="assessment-section">
                            <h2 className="section-title">
                                <IconAlertCircle size={20} />
                                Expired ({expiredAssessments.length})
                            </h2>
                            <div className="assessment-grid">
                                {expiredAssessments.map((assessment) => {
                                    const statusBadge = getStatusBadge(assessment);
                                    const StatusIcon = statusBadge.icon;
                                    
                                    return (
                                        <div key={assessment.id} className="assessment-card expired">
                                            <div className="assessment-card-header">
                                                <h3 className="assessment-title">{assessment.assessment_title}</h3>
                                                <span className={`status-badge ${statusBadge.className}`}>
                                                    <StatusIcon size={14} />
                                                    {statusBadge.label}
                                                </span>
                                            </div>

                                            <div className="assessment-meta">
                                                <div className="meta-item">
                                                    <span className="meta-label">For Job:</span>
                                                    <span className="meta-value">{assessment.job_title}</span>
                                                </div>
                                                <div className="meta-item">
                                                    <span className="meta-label">Deadline Passed:</span>
                                                    <span className="meta-value">{formatDateTime(assessment.deadline_at)}</span>
                                                </div>
                                            </div>

                                            <div className="assessment-warning">
                                                <IconX size={16} />
                                                <span>This assessment deadline has passed</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}

export default AssessmentList;
