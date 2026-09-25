import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
    IconPlus, 
    IconTrash, 
    IconGripVertical, 
    IconArrowLeft,
    IconDeviceFloppy
} from '@tabler/icons-react';
import { getToken } from '../../../utils/auth';
import './AssessmentForm.css';

const EMPTY_TEMPLATE = {
    title: '',
    description: '',
    duration_minutes: 30,
    passing_score: 70,
    status: 'ACTIVE'
};

const EMPTY_QUESTION = {
    question_text: '',
    question_type: 'MULTIPLE_CHOICE',
    options: ['', '', '', ''],
    correct_answer: '',
    points: 1
};

function AssessmentForm() {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = Boolean(id);

    const [template, setTemplate] = useState(EMPTY_TEMPLATE);
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isEditing) {
            fetchTemplate();
        }
    }, [id, isEditing]);

    const fetchTemplate = async () => {
        try {
            setLoading(true);
            setError('');
            const token = getToken();
            
            console.log('Fetching template with ID:', id);
            
            const response = await fetch(`http://localhost:5000/api/assessments/templates/${id}`, {
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Response status:', response.status);

            if (response.ok) {
                const data = await response.json();
                console.log('Loaded template:', data);
                setTemplate(data.template);
                setQuestions(data.questions || []);
            } else {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                setError(errorData.message || 'Failed to load assessment');
            }
        } catch (error) {
            console.error('Failed to fetch template:', error);
            setError('Network error: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTemplateChange = (field, value) => {
        setTemplate(prev => ({ ...prev, [field]: value }));
    };

    const addQuestion = () => {
        setQuestions(prev => [...prev, { ...EMPTY_QUESTION, order_index: prev.length }]);
    };

    const removeQuestion = (index) => {
        setQuestions(prev => prev.filter((_, i) => i !== index));
    };

    const updateQuestion = (index, field, value) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i === index) {
                if (field === 'question_type') {
                    if (value === 'TRUE_FALSE') {
                        return { ...q, [field]: value, options: ['True', 'False'], correct_answer: '' };
                    } else if (value === 'SHORT_ANSWER') {
                        return { ...q, [field]: value, options: null, correct_answer: '' };
                    } else if (value === 'MULTIPLE_CHOICE') {
                        return { ...q, [field]: value, options: ['', '', '', ''], correct_answer: '' };
                    }
                }
                return { ...q, [field]: value };
            }
            return q;
        }));
    };

    const updateOption = (questionIndex, optionIndex, value) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i === questionIndex) {
                const newOptions = [...(q.options || [])];
                newOptions[optionIndex] = value;
                return { ...q, options: newOptions };
            }
            return q;
        }));
    };

    const addOption = (questionIndex) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i === questionIndex) {
                return { ...q, options: [...(q.options || []), ''] };
            }
            return q;
        }));
    };

    const removeOption = (questionIndex, optionIndex) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i === questionIndex) {
                const newOptions = q.options.filter((_, oi) => oi !== optionIndex);
                return { ...q, options: newOptions };
            }
            return q;
        }));
    };

    const validateForm = () => {
        if (!template.title.trim()) {
            setError('Assessment title is required');
            return false;
        }
        if (template.duration_minutes < 1) {
            setError('Duration must be at least 1 minute');
            return false;
        }
        if (template.passing_score < 0 || template.passing_score > 100) {
            setError('Passing score must be between 0 and 100');
            return false;
        }
        if (questions.length === 0) {
            setError('Add at least one question');
            return false;
        }

        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.question_text.trim()) {
                setError(`Question ${i + 1}: Question text is required`);
                return false;
            }
            if (q.question_type === 'MULTIPLE_CHOICE') {
                const validOptions = q.options.filter(o => o.trim().length > 0);
                if (validOptions.length < 2) {
                    setError(`Question ${i + 1}: At least 2 options required`);
                    return false;
                }
                if (!q.correct_answer || !q.correct_answer.trim()) {
                    setError(`Question ${i + 1}: Correct answer is required`);
                    return false;
                }
            }
            if (q.question_type === 'TRUE_FALSE' && !q.correct_answer) {
                setError(`Question ${i + 1}: Select correct answer (True or False)`);
                return false;
            }
            if (q.points < 1) {
                setError(`Question ${i + 1}: Points must be at least 1`);
                return false;
            }
        }

        return true;
    };

    const handleSubmit = async () => {
        if (!validateForm()) return;

        try {
            setSaving(true);
            setError('');
            const token = getToken();

            const templateData = {
                title: template.title.trim(),
                description: template.description?.trim() || null,
                duration_minutes: parseInt(template.duration_minutes),
                passing_score: parseFloat(template.passing_score),
                status: template.status
            };

            let templateId = id;

            if (isEditing) {
                const updateRes = await fetch(`http://localhost:5000/api/assessments/templates/${id}`, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(templateData)
                });

                if (!updateRes.ok) {
                    const errorData = await updateRes.json();
                    throw new Error(errorData.message || 'Failed to update template');
                }

                const existingQuestions = await fetch(`http://localhost:5000/api/assessments/templates/${id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(r => r.json());

                for (const q of existingQuestions.questions || []) {
                    await fetch(`http://localhost:5000/api/assessments/questions/${q.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                }
            } else {
                const createRes = await fetch('http://localhost:5000/api/assessments/templates', {
                    method: 'POST',
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(templateData)
                });

                if (!createRes.ok) {
                    const errorData = await createRes.json();
                    throw new Error(errorData.message || 'Failed to create template');
                }

                const createData = await createRes.json();
                templateId = createData.templateId;
            }

            const questionsData = questions.map((q, index) => ({
                question_text: q.question_text.trim(),
                question_type: q.question_type,
                options: q.question_type === 'MULTIPLE_CHOICE' || q.question_type === 'TRUE_FALSE' 
                    ? q.options.filter(o => o.trim().length > 0) 
                    : null,
                correct_answer: q.correct_answer?.trim() || null,
                points: parseInt(q.points),
                order_index: index
            }));

            const questionsRes = await fetch(`http://localhost:5000/api/assessments/templates/${templateId}/questions`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ questions: questionsData })
            });

            if (!questionsRes.ok) {
                const errorData = await questionsRes.json();
                throw new Error(errorData.message || 'Failed to save questions');
            }

            navigate('/hr/assessments');

        } catch (error) {
            console.error('Failed to save assessment:', error);
            setError(error.message || 'Failed to save assessment');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="assessment-form-page">
                <div className="loading-message">Loading assessment...</div>
            </div>
        );
    }

    return (
        <div className="assessment-form-page">
            <div className="form-header">
                <button 
                    className="btn-back"
                    onClick={() => navigate('/hr/assessments')}
                >
                    <IconArrowLeft size={18} />
                    Back to Assessments
                </button>
                <h1 className="form-title">
                    {isEditing ? 'Edit Assessment' : 'Create New Assessment'}
                </h1>
            </div>

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}

            <div className="form-container">
                <div className="form-section">
                    <h2 className="section-title">Assessment Details</h2>
                    
                    <div className="form-row">
                        <label className="form-label">
                            Title <span className="required">*</span>
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            value={template.title}
                            onChange={(e) => handleTemplateChange('title', e.target.value)}
                            placeholder="e.g., JavaScript Developer Skills Test"
                        />
                    </div>

                    <div className="form-row">
                        <label className="form-label">Description</label>
                        <textarea
                            className="form-textarea"
                            rows={3}
                            value={template.description}
                            onChange={(e) => handleTemplateChange('description', e.target.value)}
                            placeholder="Brief description of what this assessment tests"
                        />
                    </div>

                    <div className="form-row-group">
                        <div className="form-row">
                            <label className="form-label">
                                Duration (minutes) <span className="required">*</span>
                            </label>
                            <input
                                type="number"
                                className="form-input"
                                min="1"
                                value={template.duration_minutes}
                                onChange={(e) => handleTemplateChange('duration_minutes', e.target.value)}
                            />
                        </div>

                        <div className="form-row">
                            <label className="form-label">
                                Passing Score (%) <span className="required">*</span>
                            </label>
                            <input
                                type="number"
                                className="form-input"
                                min="0"
                                max="100"
                                value={template.passing_score}
                                onChange={(e) => handleTemplateChange('passing_score', e.target.value)}
                            />
                        </div>

                        <div className="form-row">
                            <label className="form-label">Status</label>
                            <select
                                className="form-select"
                                value={template.status}
                                onChange={(e) => handleTemplateChange('status', e.target.value)}
                            >
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="form-section">
                    <div className="section-header">
                        <h2 className="section-title">Questions</h2>
                        <button 
                            className="btn-add-question"
                            onClick={addQuestion}
                        >
                            <IconPlus size={18} />
                            Add Question
                        </button>
                    </div>

                    {questions.length === 0 ? (
                        <div className="empty-questions">
                            <p>No questions yet. Add your first question to get started.</p>
                        </div>
                    ) : (
                        <div className="questions-list">
                            {questions.map((question, qIndex) => (
                                <div key={qIndex} className="question-card">
                                    <div className="question-header">
                                        <div className="question-number">
                                            <IconGripVertical size={18} />
                                            Question {qIndex + 1}
                                        </div>
                                        <button
                                            className="btn-remove"
                                            onClick={() => removeQuestion(qIndex)}
                                            title="Remove question"
                                        >
                                            <IconTrash size={18} />
                                        </button>
                                    </div>

                                    <div className="question-body">
                                        <div className="form-row">
                                            <label className="form-label">
                                                Question Text <span className="required">*</span>
                                            </label>
                                            <textarea
                                                className="form-textarea"
                                                rows={2}
                                                value={question.question_text}
                                                onChange={(e) => updateQuestion(qIndex, 'question_text', e.target.value)}
                                                placeholder="Enter your question..."
                                            />
                                        </div>

                                        <div className="form-row-group">
                                            <div className="form-row">
                                                <label className="form-label">Type</label>
                                                <select
                                                    className="form-select"
                                                    value={question.question_type}
                                                    onChange={(e) => updateQuestion(qIndex, 'question_type', e.target.value)}
                                                >
                                                    <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                                                    <option value="TRUE_FALSE">True/False</option>
                                                    <option value="SHORT_ANSWER">Short Answer</option>
                                                </select>
                                            </div>

                                            <div className="form-row">
                                                <label className="form-label">Points</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    min="1"
                                                    value={question.points}
                                                    onChange={(e) => updateQuestion(qIndex, 'points', e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {question.question_type === 'MULTIPLE_CHOICE' && (
                                            <div className="options-section">
                                                <label className="form-label">Options</label>
                                                {question.options.map((option, oIndex) => (
                                                    <div key={oIndex} className="option-row">
                                                        <input
                                                            type="text"
                                                            className="form-input"
                                                            value={option}
                                                            onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                                            placeholder={`Option ${oIndex + 1}`}
                                                        />
                                                        {question.options.length > 2 && (
                                                            <button
                                                                className="btn-remove-option"
                                                                onClick={() => removeOption(qIndex, oIndex)}
                                                            >
                                                                <IconTrash size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                                <button
                                                    className="btn-add-option"
                                                    onClick={() => addOption(qIndex)}
                                                >
                                                    <IconPlus size={16} />
                                                    Add Option
                                                </button>
                                            </div>
                                        )}

                                        {question.question_type === 'MULTIPLE_CHOICE' && (
                                            <div className="form-row">
                                                <label className="form-label">
                                                    Correct Answer <span className="required">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={question.correct_answer}
                                                    onChange={(e) => updateQuestion(qIndex, 'correct_answer', e.target.value)}
                                                    placeholder="Enter the exact text of the correct option"
                                                />
                                            </div>
                                        )}

                                        {question.question_type === 'TRUE_FALSE' && (
                                            <div className="form-row">
                                                <label className="form-label">
                                                    Correct Answer <span className="required">*</span>
                                                </label>
                                                <select
                                                    className="form-select"
                                                    value={question.correct_answer}
                                                    onChange={(e) => updateQuestion(qIndex, 'correct_answer', e.target.value)}
                                                >
                                                    <option value="">Select...</option>
                                                    <option value="True">True</option>
                                                    <option value="False">False</option>
                                                </select>
                                            </div>
                                        )}

                                        {question.question_type === 'SHORT_ANSWER' && (
                                            <div className="form-row">
                                                <label className="form-label">Expected Answer (for reference)</label>
                                                <input
                                                    type="text"
                                                    className="form-input"
                                                    value={question.correct_answer || ''}
                                                    onChange={(e) => updateQuestion(qIndex, 'correct_answer', e.target.value)}
                                                    placeholder="This will require manual grading by HR"
                                                />
                                                <small className="form-hint">
                                                    Short answer questions cannot be auto-graded. HR will review and grade manually.
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="form-actions">
                    <button 
                        className="btn-secondary"
                        onClick={() => navigate('/hr/assessments')}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button 
                        className="btn-primary"
                        onClick={handleSubmit}
                        disabled={saving}
                    >
                        <IconDeviceFloppy size={18} />
                        {saving ? 'Saving...' : (isEditing ? 'Update Assessment' : 'Create Assessment')}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AssessmentForm;
