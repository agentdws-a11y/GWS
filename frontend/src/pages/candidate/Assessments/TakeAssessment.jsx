import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { IconClock, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { startAssessment, submitAssessment } from '../../../services/assessmentService';
import { notify } from '../../../utils/notify';
import './TakeAssessment.css';

function TakeAssessment() {
    const { assessmentId } = useParams();
    const navigate = useNavigate();
    
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    
    const [assessment, setAssessment] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    
    const timerRef = useRef(null);
    const startTimeRef = useRef(null);
    const loadingRef = useRef(false);
    const autoSubmitRef = useRef(false);
    const timeExpiredRef = useRef(false);

    useEffect(() => {
        if (loadingRef.current) {
            console.log('Already loading assessment, skipping...');
            return;
        }
        
        loadAssessment();
        
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = '';
            return '';
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            loadingRef.current = false;
            autoSubmitRef.current = false;
            timeExpiredRef.current = false;
        };
    }, [assessmentId]);

    const loadAssessment = async () => {
        if (loadingRef.current) {
            console.log('Load already in progress, aborting...');
            return;
        }
        
        try {
            loadingRef.current = true;
            setLoading(true);
            setError('');
            console.log('Calling startAssessment API...');
            const data = await startAssessment(assessmentId);
            console.log('Received data:', data);
            
            setAssessment(data.assessment);
            setQuestions(data.questions || []);
            
            const initialAnswers = {};
            data.questions.forEach(q => {
                initialAnswers[q.id] = '';
            });
            setAnswers(initialAnswers);
            
            let durationSeconds;
            if (data.assessment.is_resume && data.assessment.time_remaining_seconds != null) {
                durationSeconds = data.assessment.time_remaining_seconds;
                console.log(`Resuming assessment with ${durationSeconds} seconds remaining`);
                if (durationSeconds <= 0) {
                    notify.info('Time has expired! Submitting assessment...');
                    setLoading(false);
                    loadingRef.current = false;
                    await handleAutoSubmit();
                    return;
                }
            } else {
                durationSeconds = data.assessment.duration_minutes * 60;
                console.log(`Starting new assessment with ${durationSeconds} seconds`);
            }
            
            setTimeRemaining(durationSeconds);
            startTimeRef.current = Date.now();
            
            timerRef.current = setInterval(() => {
                setTimeRemaining(prev => {
                    const newTime = Math.max(0, prev - 1);
                    if (newTime % 10 === 0 || newTime <= 5) {
                        console.log(`Timer: ${newTime} seconds remaining`);
                    }
                    return newTime;
                });
            }, 1000);
            
            console.log('Assessment loaded successfully');
        } catch (err) {
            console.error('Error loading assessment:', err);
            const errorMessage = err.message || 'Failed to load assessment';
            setError(errorMessage);
            notify.error(errorMessage);
            loadingRef.current = false;
            
            if (errorMessage.includes('already been submitted') || errorMessage.includes('not found')) {
                setTimeout(() => navigate('/candidate/assessments'), 2000);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAutoSubmit = useCallback(async () => {
        if (autoSubmitRef.current) {
            console.log('Auto-submit already in progress, skipping...');
            return;
        }
        
        autoSubmitRef.current = true;
        timeExpiredRef.current = true;
        
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        
        console.log('Time is up! Auto-submitting assessment...');
        notify.info('Time is up! Submitting your assessment...');
        
        try {
            setSubmitting(true);
            const result = await submitAssessment(assessmentId, answers);
            notify.success(`Assessment submitted! Score: ${result.score.toFixed(1)}%`);
            navigate(`/candidate/assessments/${assessmentId}/result`);
        } catch (err) {
            console.error('Auto-submit error:', err);
            notify.error(err.message);
            setSubmitting(false);
            autoSubmitRef.current = false;
        }
    }, [assessmentId, answers, navigate]);

    useEffect(() => {
        if (timeRemaining === 0 && !timeExpiredRef.current && !submitting && questions.length > 0) {
            console.log('Time reached 0, triggering auto-submit from useEffect');
            handleAutoSubmit();
        }
    }, [timeRemaining, submitting, questions.length, handleAutoSubmit]);

    const handleAnswerChange = (questionId, value) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: value
        }));
    };

    const handleSubmit = async (autoSubmit = false) => {
        if (!autoSubmit) {
            setShowSubmitConfirm(false);
        }
        
        try {
            setSubmitting(true);
            
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            
            const result = await submitAssessment(assessmentId, answers);
            
            notify.success(`Assessment submitted! Score: ${result.score.toFixed(1)}%`);
            navigate(`/candidate/assessments/${assessmentId}/result`);
            
        } catch (err) {
            notify.error(err.message);
            setSubmitting(false);
        }
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const getTimeWarningClass = () => {
        if (timeRemaining <= 60) return 'time-critical';
        if (timeRemaining <= 300) return 'time-warning';
        return '';
    };

    const getAnsweredCount = () => {
        return Object.values(answers).filter(a => a && a.trim()).length;
    };

    if (loading) {
        return (
            <div className="take-assessment-page">
                <div className="loading-message">Starting assessment...</div>
            </div>
        );
    }

    if (error || !assessment || !questions.length) {
        return (
            <div className="take-assessment-page">
                <div className="error-state">
                    <IconAlertCircle size={48} />
                    <h3>{error || 'Unable to load assessment'}</h3>
                    <button className="btn-primary" onClick={() => navigate('/candidate/assessments')}>
                        Back to Assessments
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="take-assessment-page">
            <div className="assessment-header-fixed">
                <div className="assessment-header-content">
                    <div className="header-left">
                        <h1 className="assessment-header-title">Assessment in Progress</h1>
                        <p className="progress-text">
                            {getAnsweredCount()} of {questions.length} questions answered
                        </p>
                    </div>
                    <div className="header-right">
                        <div className={`timer ${getTimeWarningClass()}`}>
                            <IconClock size={20} />
                            <span className="timer-text">{formatTime(timeRemaining)}</span>
                        </div>
                        <button
                            className="btn-submit"
                            onClick={() => setShowSubmitConfirm(true)}
                            disabled={submitting}
                        >
                            Submit Assessment
                        </button>
                    </div>
                </div>
            </div>

            <div className="questions-container">
                <div className="questions-wrapper">
                    <div className="assessment-instructions">
                        <IconAlertCircle size={20} />
                        <div>
                            <strong>Important:</strong> Do not refresh or close this page. 
                            Your progress will be lost. The assessment will auto-submit when time runs out.
                        </div>
                    </div>

                    {questions.map((question, index) => (
                        <div key={question.id} className="question-card">
                            <div className="question-header">
                                <span className="question-number">Question {index + 1}</span>
                                <span className="question-points">{question.points} {question.points === 1 ? 'point' : 'points'}</span>
                            </div>
                            
                            <p className="question-text">{question.question_text}</p>

                            {question.question_type === 'MULTIPLE_CHOICE' && question.options && (
                                <div className="question-options">
                                    {question.options.map((option, optIndex) => (
                                        <label key={optIndex} className="option-label">
                                            <input
                                                type="radio"
                                                name={`question-${question.id}`}
                                                value={option}
                                                checked={answers[question.id] === option}
                                                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                                disabled={submitting}
                                            />
                                            <span className="option-text">{option}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            {question.question_type === 'TRUE_FALSE' && (
                                <div className="question-options">
                                    <label className="option-label">
                                        <input
                                            type="radio"
                                            name={`question-${question.id}`}
                                            value="True"
                                            checked={answers[question.id] === 'True'}
                                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                            disabled={submitting}
                                        />
                                        <span className="option-text">True</span>
                                    </label>
                                    <label className="option-label">
                                        <input
                                            type="radio"
                                            name={`question-${question.id}`}
                                            value="False"
                                            checked={answers[question.id] === 'False'}
                                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                            disabled={submitting}
                                        />
                                        <span className="option-text">False</span>
                                    </label>
                                </div>
                            )}

                            {question.question_type === 'SHORT_ANSWER' && (
                                <textarea
                                    className="short-answer-input"
                                    rows="4"
                                    placeholder="Type your answer here..."
                                    value={answers[question.id] || ''}
                                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                                    disabled={submitting}
                                />
                            )}

                            {answers[question.id] && answers[question.id].trim() && (
                                <div className="question-answered">
                                    <IconCheck size={16} />
                                    <span>Answered</span>
                                </div>
                            )}
                        </div>
                    ))}

                    <div className="submit-section">
                        <button
                            className="btn-submit-large"
                            onClick={() => setShowSubmitConfirm(true)}
                            disabled={submitting}
                        >
                            {submitting ? 'Submitting...' : 'Submit Assessment'}
                        </button>
                    </div>
                </div>
            </div>

            {showSubmitConfirm && (
                <div className="modal-overlay" onClick={() => !submitting && setShowSubmitConfirm(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Submit Assessment?</h3>
                        </div>
                        <div className="modal-body">
                            <p>
                                You have answered <strong>{getAnsweredCount()} out of {questions.length}</strong> questions.
                            </p>
                            {getAnsweredCount() < questions.length && (
                                <p className="warning-text">
                                    <IconAlertCircle size={16} />
                                    Some questions are unanswered. They will be marked as incorrect.
                                </p>
                            )}
                            <p>
                                Once submitted, you cannot change your answers. Are you sure?
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button 
                                className="btn-secondary"
                                onClick={() => setShowSubmitConfirm(false)}
                                disabled={submitting}
                            >
                                Go Back
                            </button>
                            <button 
                                className="btn-primary"
                                onClick={() => handleSubmit(false)}
                                disabled={submitting}
                            >
                                {submitting ? 'Submitting...' : 'Yes, Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TakeAssessment;
