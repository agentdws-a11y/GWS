import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    IconArrowLeft, 
    IconClock, 
    IconCheck, 
    IconX,
    IconCircleCheck,
    IconCircleX,
    IconEdit
} from '@tabler/icons-react';
import { getToken } from '../../../utils/auth';
import { getAssessmentForGrading, gradeAssessment } from '../../../services/assessmentService';
import { notify } from '../../../utils/notify';
import './AssessmentResults.css';

function AssessmentResults() {
    const navigate = useNavigate();
    const { applicationId } = useParams();

    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    
    const [gradingModal, setGradingModal] = useState(null);
    const [grading, setGrading] = useState(false);

    useEffect(() => {
        fetchResults();
    }, [applicationId]);

    const fetchResults = async () => {
        try {
            setLoading(true);
            setError('');
            const token = getToken();
            
            const response = await fetch(
                `http://localhost:5000/api/assessments/applications/${applicationId}/results`,
                {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                setResults(data.results || []);
            } else {
                const errorData = await response.json();
                setError(errorData.message || 'Failed to fetch results');
            }
        } catch (error) {
            console.error('Failed to fetch results:', error);
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING':
                return { label: 'Pending', class: 'status-pending' };
            case 'IN_PROGRESS':
                return { label: 'In Progress', class: 'status-in-progress' };
            case 'GRADED':
                return { label: 'Completed', class: 'status-completed' };
            default:
                return { label: status, class: 'status-default' };
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleGradeClick = async (assessmentId) => {
        try {
            setLoading(true);
            const data = await getAssessmentForGrading(assessmentId);
            setGradingModal({ assessmentId, ...data });
        } catch (err) {
            notify.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const hasUngradedShortAnswers = (answers) => {
        return answers && answers.some(a => 
            a.question_type === 'SHORT_ANSWER' && a.is_correct === null
        );
    };

    if (loading) {
        return (
            <div className="assessment-results-page">
                <div className="loading-message">Loading assessment results...</div>
            </div>
        );
    }

    return (
        <div className="assessment-results-page">
            <div className="results-header">
                <button 
                    className="btn-back"
                    onClick={() => navigate(`/hr/applications/${applicationId}`)}
                >
                    <IconArrowLeft size={18} />
                    Back to Candidate
                </button>
                <h1 className="page-title">Assessment Results</h1>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            {results.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">
                        <IconClock size={48} />
                    </div>
                    <h3>No assessments assigned</h3>
                    <p>This candidate has not been assigned any assessments for this application.</p>
                </div>
            ) : (
                <div className="results-grid">
                    {results.map((result) => {
                        const statusBadge = getStatusBadge(result.status);
                        const isPassed = result.passed === 1 || result.passed === true;
                        const isCompleted = result.status === 'GRADED';
                        
                        return (
                            <div key={result.id} className="result-card">
                                <div className="result-header">
                                    <h3 className="result-title">{result.template_title}</h3>
                                    <span className={`status-badge ${statusBadge.class}`}>
                                        {statusBadge.label}
                                    </span>
                                </div>

                                <div className="result-meta">
                                    <div className="meta-row">
                                        <span className="meta-label">Duration:</span>
                                        <span className="meta-value">
                                            <IconClock size={16} />
                                            {result.duration_minutes} minutes
                                        </span>
                                    </div>
                                    <div className="meta-row">
                                        <span className="meta-label">Passing Score:</span>
                                        <span className="meta-value">
                                            {result.passing_score}%
                                        </span>
                                    </div>
                                </div>

                                {result.status === 'PENDING' && (
                                    <div className="result-pending">
                                        <p>Waiting for candidate to start</p>
                                        {result.deadline_at && (
                                            <p className="deadline-text">
                                                Deadline: {formatDate(result.deadline_at)}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {result.status === 'IN_PROGRESS' && (
                                    <div className="result-in-progress">
                                        <p>Candidate is currently taking this test</p>
                                        <p className="started-text">
                                            Started: {formatDate(result.started_at)}
                                        </p>
                                    </div>
                                )}

                                {isCompleted && (
                                    <>
                                        <div className="result-score">
                                            <div className="score-circle">
                                                <div className={`score-value ${isPassed ? 'passed' : 'failed'}`}>
                                                    {result.score ? Math.round(result.score) : 0}%
                                                </div>
                                                <div className="score-label">Score</div>
                                            </div>

                                            <div className="score-details">
                                                <div className="score-row">
                                                    <span>Points Earned:</span>
                                                    <strong>{result.earned_score || 0} / {result.max_score || 0}</strong>
                                                </div>
                                                <div className="score-row">
                                                    <span>Time Taken:</span>
                                                    <strong>{result.time_taken_minutes || 0} min</strong>
                                                </div>
                                                <div className="score-row">
                                                    <span>Status:</span>
                                                    {isPassed ? (
                                                        <span className="pass-badge">
                                                            <IconCircleCheck size={16} />
                                                            Passed
                                                        </span>
                                                    ) : (
                                                        <span className="fail-badge">
                                                            <IconCircleX size={16} />
                                                            Failed
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="result-footer">
                                            <span className="submitted-text">
                                                Submitted: {formatDate(result.submitted_at)}
                                            </span>
                                            {hasUngradedShortAnswers(result.answers) && (
                                                <button
                                                    className="btn-grade"
                                                    onClick={() => handleGradeClick(result.id)}
                                                >
                                                    <IconEdit size={16} />
                                                    Grade Short Answers
                                                </button>
                                            )}
                                        </div>

                                        {result.answers && result.answers.length > 0 && (
                                            <div className="questions-answers-section">
                                                <h3 className="section-title">Questions & Answers</h3>
                                                <div className="qa-list">
                                                    {result.answers.map((answer, index) => (
                                                        <div key={answer.question_id} className="qa-card">
                                                            <div className="qa-header">
                                                                <span className="qa-number">Question {index + 1}</span>
                                                                {answer.is_correct !== null && (
                                                                    <span className={`qa-result ${answer.is_correct ? 'correct' : 'incorrect'}`}>
                                                                        {answer.is_correct ? (
                                                                            <>
                                                                                <IconCheck size={16} />
                                                                                Correct
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <IconX size={16} />
                                                                                Incorrect
                                                                            </>
                                                                        )}
                                                                    </span>
                                                                )}
                                                                {answer.is_correct === null && (
                                                                    <span className="qa-result pending">
                                                                        <IconClock size={16} />
                                                                        Under Review
                                                                    </span>
                                                                )}
                                                                <span className="qa-points">
                                                                    {answer.points_earned || 0} / {answer.points} pts
                                                                </span>
                                                            </div>
                                                            <div className="qa-question">
                                                                <strong>Q:</strong> {answer.question_text}
                                                            </div>
                                                            <div className="qa-answer">
                                                                <strong>A:</strong> {answer.answer_text || <em className="no-answer">Not answered</em>}
                                                            </div>
                                                            {answer.correct_answer && answer.question_type !== 'SHORT_ANSWER' && (
                                                                <div className="qa-correct-answer">
                                                                    <strong>Correct Answer:</strong> {answer.correct_answer}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {gradingModal && (
                <GradingModal
                    data={gradingModal}
                    onClose={() => setGradingModal(null)}
                    onSave={async (grades) => {
                        setGrading(true);
                        try {
                            await gradeAssessment(gradingModal.assessmentId, grades);
                            notify.success('Assessment graded successfully');
                            setGradingModal(null);
                            fetchResults();
                        } catch (err) {
                            notify.error(err.message);
                        } finally {
                            setGrading(false);
                        }
                    }}
                    loading={grading}
                />
            )}
        </div>
    );
}

function GradingModal({ data, onClose, onSave, loading }) {
    const { assessment, answers } = data;
    const [grades, setGrades] = useState({});

    useEffect(() => {
        const initialGrades = {};
        answers.forEach(answer => {
            if (answer.question_type === 'SHORT_ANSWER') {
                initialGrades[answer.answer_id] = {
                    points_earned: answer.points_earned || 0,
                    is_correct: answer.is_correct !== null ? answer.is_correct : null,
                    grader_note: answer.grader_note || ''
                };
            }
        });
        setGrades(initialGrades);
    }, [answers]);

    const handleGradeChange = (answerId, field, value) => {
        setGrades(prev => ({
            ...prev,
            [answerId]: {
                ...prev[answerId],
                [field]: value
            }
        }));
    };

    const handleSave = () => {
        onSave(grades);
    };

    const shortAnswers = answers.filter(a => a.question_type === 'SHORT_ANSWER');

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="grading-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2>Grade Assessment</h2>
                        <p className="modal-subtitle">
                            {assessment.candidate_name} - {assessment.template_title}
                        </p>
                    </div>
                    <button className="btn-close" onClick={onClose}>
                        <IconX size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {shortAnswers.length === 0 ? (
                        <div className="no-short-answers">
                            <p>This assessment has no short answer questions to grade.</p>
                            <p>All questions were auto-graded.</p>
                        </div>
                    ) : (
                        <div className="grading-list">
                            {shortAnswers.map((answer, index) => {
                                const grade = grades[answer.answer_id] || {};
                                
                                return (
                                    <div key={answer.answer_id} className="grading-item">
                                        <div className="grading-question">
                                            <span className="question-number">Question {index + 1}</span>
                                            <p className="question-text">{answer.question_text}</p>
                                            <span className="question-points">
                                                Worth {answer.points} {answer.points === 1 ? 'point' : 'points'}
                                            </span>
                                        </div>

                                        <div className="grading-answer">
                                            <strong>Candidate's Answer:</strong>
                                            <p className="answer-text">
                                                {answer.answer_text || <em>No answer provided</em>}
                                            </p>
                                        </div>

                                        {answer.correct_answer && (
                                            <div className="grading-correct">
                                                <strong>Expected Answer (Reference):</strong>
                                                <p className="correct-text">{answer.correct_answer}</p>
                                            </div>
                                        )}

                                        <div className="grading-controls">
                                            <div className="control-group">
                                                <label>Points to Award:</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={answer.points}
                                                    value={grade.points_earned || 0}
                                                    onChange={(e) => {
                                                        const val = Math.min(Math.max(0, Number(e.target.value)), answer.points);
                                                        handleGradeChange(answer.answer_id, 'points_earned', val);
                                                        handleGradeChange(answer.answer_id, 'is_correct', val === answer.points);
                                                    }}
                                                    className="points-input"
                                                />
                                                <span>/ {answer.points}</span>
                                            </div>

                                            <div className="control-group">
                                                <label>Grader Note (optional):</label>
                                                <textarea
                                                    value={grade.grader_note || ''}
                                                    onChange={(e) => handleGradeChange(answer.answer_id, 'grader_note', e.target.value)}
                                                    placeholder="Add feedback for this answer..."
                                                    rows="2"
                                                    className="note-input"
                                                />
                                            </div>
                                        </div>

                                        {answer.graded_at && (
                                            <div className="previously-graded">
                                                Previously graded on {new Date(answer.graded_at).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button 
                        className="btn-primary" 
                        onClick={handleSave}
                        disabled={loading || shortAnswers.length === 0}
                    >
                        {loading ? 'Saving...' : 'Save Grades'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AssessmentResults;
