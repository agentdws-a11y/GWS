import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { IconCheck, IconX, IconClock, IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';
import { getMyAssessmentResult } from '../../../services/assessmentService';
import { notify } from '../../../utils/notify';
import './AssessmentResult.css';

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

function AssessmentResult() {
    const { assessmentId } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    useEffect(() => {
        fetchResult();
    }, [assessmentId]);

    const fetchResult = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await getMyAssessmentResult(assessmentId);
            setResult(data);
        } catch (err) {
            setError(err.message);
            notify.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="assessment-result-page">
                <div className="loading-message">Loading results...</div>
            </div>
        );
    }

    if (error || !result) {
        return (
            <div className="assessment-result-page">
                <div className="ares-error-state">
                    <IconAlertCircle size={40} />
                    <h3>{error || 'Unable to load results'}</h3>
                    <button className="btn-primary" onClick={() => navigate('/candidate/assessments')}>
                        Back to Assessments
                    </button>
                </div>
            </div>
        );
    }

    const { assessment, answers } = result;
    const scorePercentage = Number(assessment.score) || 0;
    const passed = assessment.passed === 1 || assessment.passed === true;
    const tier = passed ? 'tier-good' : (scorePercentage < 40 ? 'tier-poor' : 'tier-fair');

    return (
        <div className="assessment-result-page">
            <div className="ares-container">
                <Link to="/candidate/assessments" className="ares-back-link">
                    <IconArrowLeft size={16} />
                    <span>Back to Assessments</span>
                </Link>

                <div className={`ares-header ${tier}`}>
                    <div className="ares-icon">
                        {passed ? <IconCheck size={20} /> : <IconX size={20} />}
                    </div>
                    <h1 className="ares-title">
                        {passed ? 'You Passed!' : 'Assessment Completed'}
                    </h1>
                    <p className="ares-subtitle">{assessment.title}</p>
                    
                    <div className="ares-score-display">
                        <div className="ares-score-circle">
                            <svg viewBox="0 0 100 100">
                                <circle
                                    className="ares-score-circle-bg"
                                    cx="50"
                                    cy="50"
                                    r="40"
                                />
                                <circle
                                    className={`ares-score-circle-progress ${tier}`}
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    strokeDasharray={`${scorePercentage * 2.513} 251.3`}
                                />
                            </svg>
                            <div className="ares-score-text">
                                <span className="ares-score-number">{scorePercentage.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="ares-stats">
                        <div className="ares-stat-item">
                            <span className="ares-stat-label">Your Score</span>
                            <span className="ares-stat-value">{assessment.earned_score} / {assessment.max_score} points</span>
                        </div>
                        <div className="ares-stat-divider"></div>
                        <div className="ares-stat-item">
                            <span className="ares-stat-label">Passing Score</span>
                            <span className="ares-stat-value">{assessment.passing_score}%</span>
                        </div>
                        <div className="ares-stat-divider"></div>
                        <div className="ares-stat-item">
                            <span className="ares-stat-label">Time Taken</span>
                            <span className="ares-stat-value">{assessment.time_taken_minutes} min</span>
                        </div>
                    </div>

                    {assessment.submitted_at && (
                        <p className="ares-submitted-time">
                            <IconClock size={14} />
                            Submitted on {formatDateTime(assessment.submitted_at)}
                        </p>
                    )}
                </div>

                <div className="ares-answers-section">
                    <h2 className="ares-section-title">Your Answers</h2>
                    
                    {answers && answers.length > 0 ? (
                        <div className="ares-answers-list">
                            {answers.map((answer, index) => (
                                <div key={index} className="ares-answer-card">
                                    <div className="ares-answer-header">
                                        <span className="ares-answer-number">Question {index + 1}</span>
                                        {answer.is_correct !== null && (
                                            <span className={`ares-answer-result ${answer.is_correct ? 'correct' : 'incorrect'}`}>
                                                {answer.is_correct ? (
                                                    <>
                                                        <IconCheck size={13} />
                                                        Correct
                                                    </>
                                                ) : (
                                                    <>
                                                        <IconX size={13} />
                                                        Incorrect
                                                    </>
                                                )}
                                            </span>
                                        )}
                                        {answer.is_correct === null && (
                                            <span className="ares-answer-result pending">
                                                <IconClock size={13} />
                                                Under Review
                                            </span>
                                        )}
                                        <span className="ares-answer-points">
                                            {answer.points_earned || 0} / {answer.points} points
                                        </span>
                                    </div>

                                    <p className="ares-answer-question">{answer.question_text}</p>

                                    <div className="ares-answer-content">
                                        <div className="ares-answer-given">
                                            <strong>Your Answer:</strong>
                                            <p>{answer.answer_text || <em className="ares-no-answer">Not answered</em>}</p>
                                        </div>

                                        {answer.question_type === 'SHORT_ANSWER' && answer.is_correct === null && (
                                            <div className="ares-answer-note">
                                                <IconAlertCircle size={16} />
                                                <span>Short answer questions require manual grading by HR. Your score may be updated later.</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="ares-no-answers">No answer details available.</p>
                    )}
                </div>

                <div className="ares-actions">
                    <button
                        className="btn-secondary"
                        onClick={() => navigate('/candidate/assessments')}
                    >
                        View All Assessments
                    </button>
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/candidate/applications')}
                    >
                        View My Applications
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AssessmentResult;