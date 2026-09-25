import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getToken } from '../../../utils/auth';
import { notify } from '../../../utils/notify';
import { getAllTemplates, getJobAssessments, linkAssessmentToJob, unlinkAssessmentFromJob } from '../../../services/assessmentService';
import { getAllDepartments } from '../../../services/departmentService';
import './VacancyForm.css';

function EditAssessmentControls({ assessment, onSave, onCancel }) {
    const [isRequired, setIsRequired] = useState(assessment.is_required ?? true);
    const [deadlineHours, setDeadlineHours] = useState(assessment.deadline_hours || 48);

    const handleSave = () => {
        onSave(assessment.template_id, isRequired, deadlineHours);
    };

    return (
        <div className="edit-assessment-controls">
            <div className="edit-control-group">
                <label className="edit-control-label">
                    <input
                        type="checkbox"
                        checked={isRequired}
                        onChange={(e) => setIsRequired(e.target.checked)}
                        className="edit-control-checkbox"
                    />
                    <span>Required</span>
                </label>
            </div>
            <div className="edit-control-group">
                <label className="edit-control-label-inline">
                    <span>Deadline:</span>
                    <input
                        type="number"
                        value={deadlineHours}
                        onChange={(e) => setDeadlineHours(Math.max(1, parseInt(e.target.value) || 1))}
                        min="1"
                        className="edit-control-number"
                    />
                    <span>hours</span>
                </label>
            </div>
            <div className="edit-control-actions">
                <button type="button" onClick={handleSave} className="btn-save-edit">
                    Save
                </button>
                <button type="button" onClick={onCancel} className="btn-cancel-edit">
                    Cancel
                </button>
            </div>
        </div>
    );
}

function VacancyForm() {
    const navigate = useNavigate();
    const { jobId } = useParams();
    const isEditing = !!jobId;

    const [loading, setLoading] = useState(isEditing);
    const [submitting, setSubmitting] = useState(false);
    const [publishingDraft, setPublishingDraft] = useState(false);

    const [availableTemplates, setAvailableTemplates] = useState([]);
    const [linkedAssessments, setLinkedAssessments] = useState([]);
    const [loadingAssessments, setLoadingAssessments] = useState(false);
    const [showAssessmentPicker, setShowAssessmentPicker] = useState(false);
    const [editingAssessment, setEditingAssessment] = useState(null);

    const [departments, setDepartments] = useState([]);
    const [loadingDepartments, setLoadingDepartments] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        department_id: '',
        location: '',
        work_mode: 'ONSITE',
        job_type: 'FULL_TIME',
        experience_level: 'ENTRY',
        min_salary: '',
        max_salary: '',
        openings: '1',
        required_skills: [],
        status: 'OPEN',
        closing_date: ''
    });

    const [skillInput, setSkillInput] = useState('');

    useEffect(() => {
        if (isEditing) {
            fetchJob();
        }
        fetchAssessmentTemplates();
        fetchDepartments();
    }, [jobId]);

    useEffect(() => {
        if (isEditing && jobId) {
            fetchLinkedAssessments();
        }
    }, [isEditing, jobId]);

    const fetchAssessmentTemplates = async () => {
        try {
            const data = await getAllTemplates();
            setAvailableTemplates(data.templates || []);
        } catch (error) {
            console.error('Failed to fetch assessment templates:', error);
        }
    };

    const fetchDepartments = async () => {
        try {
            setLoadingDepartments(true);
            const data = await getAllDepartments();
            setDepartments(data.departments || []);
        } catch (error) {
            console.error('Failed to fetch departments:', error);
            notify.error('Failed to load departments');
        } finally {
            setLoadingDepartments(false);
        }
    };

    const fetchLinkedAssessments = async () => {
        try {
            setLoadingAssessments(true);
            const data = await getJobAssessments(jobId);
            setLinkedAssessments(data.assessments || []);
        } catch (error) {
            console.error('Failed to fetch linked assessments:', error);
        } finally {
            setLoadingAssessments(false);
        }
    };

    const fetchJob = async () => {
        try {
            const token = getToken();
            const response = await fetch(`http://localhost:5000/api/jobs/${jobId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch job');
            }

            const data = await response.json();
            const job = data.job;

            let skillsArray = [];
            if (typeof job.required_skills === 'string') {
                try {
                    skillsArray = JSON.parse(job.required_skills);
                } catch {
                    skillsArray = job.required_skills.split(',').map(s => s.trim()).filter(Boolean);
                }
            } else if (Array.isArray(job.required_skills)) {
                skillsArray = job.required_skills;
            }

            setFormData({
                title: job.title || '',
                description: job.description || '',
                department_id: job.department_id || '',
                location: job.location || '',
                work_mode: job.work_mode || 'ONSITE',
                job_type: job.employment_type || 'FULL_TIME',
                experience_level: job.experience_level || 'ENTRY',
                min_salary: job.min_salary ? String(job.min_salary) : '',
                max_salary: job.max_salary ? String(job.max_salary) : '',
                openings: job.openings ? String(job.openings) : '1',
                required_skills: skillsArray,
                status: job.status || 'OPEN',
                closing_date: job.application_deadline ? job.application_deadline.slice(0, 10) : ''
            });
        } catch (error) {
            notify.error(error.message);
            navigate('/hr/vacancies');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSkillKeyDown = (e) => {
        if (e.key === 'Enter' && skillInput.trim()) {
            e.preventDefault();
            if (!formData.required_skills.includes(skillInput.trim())) {
                setFormData(prev => ({
                    ...prev,
                    required_skills: [...prev.required_skills, skillInput.trim()]
                }));
            }
            setSkillInput('');
        }
    };

    const removeSkill = (skillToRemove) => {
        setFormData(prev => ({
            ...prev,
            required_skills: prev.required_skills.filter(s => s !== skillToRemove)
        }));
    };

    const handleSubmit = async (e, isDraft = false) => {
        e.preventDefault();
        
        const targetSetter = isDraft ? setPublishingDraft : setSubmitting;
        targetSetter(true);

        try {
            const token = getToken();
            
            if (!token) {
                throw new Error('You are not logged in. Please log in again.');
            }

            const dataToSend = {
                title: formData.title,
                description: formData.description,
                department_id: formData.department_id,
                location: formData.location,
                work_mode: formData.work_mode,
                employment_type: formData.job_type,
                experience_level: formData.experience_level,
                min_salary: formData.min_salary || null,
                max_salary: formData.max_salary || null,
                openings: formData.openings || 1,
                required_skills: formData.required_skills,
                status: isDraft ? 'DRAFT' : formData.status,
                application_deadline: formData.closing_date || null
            };
            
            const url = isEditing 
                ? `http://localhost:5000/api/jobs/${jobId}`
                : 'http://localhost:5000/api/jobs';
            
            const method = isEditing ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(dataToSend)
            });

            if (response.status === 401) {
                throw new Error('Your session has expired. Please log out and log in again.');
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to save job');
            }

            if (isDraft) {
                notify.success('Draft saved');
            } else {
                notify.success(isEditing ? 'Vacancy updated' : 'Vacancy published');
            }

            navigate('/hr/vacancies');
        } catch (err) {
            notify.error(err.message);
        } finally {
            targetSetter(false);
        }
    };

    const handleLinkAssessment = async (templateId, isRequired = true, deadlineHours = 48) => {
        if (!isEditing || !jobId) {
            notify.error('Please save the job first before linking assessments');
            return;
        }

        try {
            await linkAssessmentToJob(jobId, templateId, isRequired, deadlineHours);
            notify.success('Assessment linked to job');
            await fetchLinkedAssessments();
            setShowAssessmentPicker(false);
        } catch (error) {
            notify.error(error.message);
        }
    };

    const handleUnlinkAssessment = async (templateId) => {
        try {
            await unlinkAssessmentFromJob(jobId, templateId);
            notify.success('Assessment unlinked from job');
            await fetchLinkedAssessments();
            setEditingAssessment(null);
        } catch (error) {
            notify.error(error.message);
        }
    };

    const handleUpdateAssessment = async (templateId, isRequired, deadlineHours) => {
        try {
            await unlinkAssessmentFromJob(jobId, templateId);
            await linkAssessmentToJob(jobId, templateId, isRequired, deadlineHours);
            notify.success('Assessment updated');
            await fetchLinkedAssessments();
            setEditingAssessment(null);
        } catch (error) {
            notify.error(error.message);
        }
    };

    const toggleEditAssessment = (templateId) => {
        setEditingAssessment(editingAssessment === templateId ? null : templateId);
    };

    if (loading) {
        return (
            <div className="vacancy-form-wrapper">
                <div className="vacancy-form-loading">Loading vacancy...</div>
            </div>
        );
    }

    return (
        <div className="vacancy-form-wrapper">
            <div className="vacancy-form-breadcrumb">
                <Link to="/hr/vacancies" className="breadcrumb-link">Vacancies</Link>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="breadcrumb-chevron">
                    <path d="M4.5 2.25L8.25 6L4.5 9.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="breadcrumb-current">{isEditing ? 'Edit vacancy' : 'Create vacancy'}</span>
            </div>

            <h1 className="vacancy-form-title">{isEditing ? 'Edit vacancy' : 'Create vacancy'}</h1>

            <form onSubmit={(e) => handleSubmit(e, false)} className="vacancy-form">
                <div className="vacancy-form-layout">
                    <div className="vacancy-form-left">
                        <div className="form-group">
                            <label>Job title</label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleChange}
                                placeholder="Senior React Developer"
                                className="form-input"
                                required
                            />
                        </div>

                        <div className="form-row-equal">
                            <div className="form-group">
                                <label>Department</label>
                                <select
                                    name="department_id"
                                    value={formData.department_id}
                                    onChange={handleChange}
                                    className="form-input"
                                    required
                                    disabled={loadingDepartments}
                                >
                                    <option value="">Select department</option>
                                    {departments.map(dept => (
                                        <option key={dept.id} value={dept.id}>
                                            {dept.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Closing date</label>
                                <input
                                    type="date"
                                    name="closing_date"
                                    value={formData.closing_date}
                                    onChange={handleChange}
                                    min={new Date().toISOString().slice(0, 10)}
                                    className="form-input form-input-date"
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Build and maintain the candidate portal and HR panel using React. Work closely with backend and AI teams to ship features in weekly sprints."
                                className="form-textarea"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Required skills</label>
                            <div className="skills-input-container">
                                {formData.required_skills.map((skill, idx) => (
                                    <span key={idx} className="skill-chip">
                                        {skill}
                                        <button
                                            type="button"
                                            onClick={() => removeSkill(skill)}
                                            className="skill-chip-remove"
                                            aria-label="Remove skill"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                                <input
                                    type="text"
                                    value={skillInput}
                                    onChange={(e) => setSkillInput(e.target.value)}
                                    onKeyDown={handleSkillKeyDown}
                                    placeholder="Type a skill and press enter"
                                    className="skills-inline-input"
                                />
                            </div>
                            <p className="form-helper-text">The AI engine ranks every applicant against these skills.</p>
                        </div>

                        <div className="form-group">
                            <div className="assessment-section-header">
                                <label>Skills assessments (optional)</label>
                                {isEditing && (
                                    <button
                                        type="button"
                                        className="btn-add-assessment"
                                        onClick={() => setShowAssessmentPicker(!showAssessmentPicker)}
                                    >
                                        + Add assessment
                                    </button>
                                )}
                                {!isEditing && (
                                    <p className="form-helper-text-inline">Save the job first to link assessments</p>
                                )}
                            </div>

                            {isEditing && (
                                <div className="linked-assessments-container">
                                    {loadingAssessments ? (
                                        <p className="assessment-loading">Loading assessments...</p>
                                    ) : linkedAssessments.length === 0 ? (
                                        <p className="assessment-empty">No assessments linked. Assessments will be auto-assigned to candidates when they apply.</p>
                                    ) : (
                                        <div className="linked-assessments-list">
                                            {linkedAssessments.map((assessment) => {
                                                const isEditing = editingAssessment === assessment.template_id;
                                                return (
                                                    <div key={assessment.template_id} className="linked-assessment-card">
                                                        <div className="linked-assessment-content">
                                                            <div className="linked-assessment-info">
                                                                <h4 className="linked-assessment-title">{assessment.title}</h4>
                                                                <div className="linked-assessment-meta">
                                                                    <span>{assessment.question_count} questions</span>
                                                                    <span>•</span>
                                                                    <span>{assessment.duration_minutes} min</span>
                                                                    <span>•</span>
                                                                    <span>Passing: {assessment.passing_score}%</span>
                                                                </div>
                                                            </div>
                                                            
                                                            {isEditing ? (
                                                                <EditAssessmentControls 
                                                                    assessment={assessment}
                                                                    onSave={handleUpdateAssessment}
                                                                    onCancel={() => setEditingAssessment(null)}
                                                                />
                                                            ) : (
                                                                <div className="linked-assessment-settings">
                                                                    <div className="assessment-setting-badge">
                                                                        {assessment.is_required ? (
                                                                            <span className="badge-required">Required</span>
                                                                        ) : (
                                                                            <span className="badge-optional">Optional</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="assessment-setting-info">
                                                                        <span className="setting-label">Deadline:</span>
                                                                        <span className="setting-value">{assessment.deadline_hours}h</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        {!isEditing && (
                                                            <div className="linked-assessment-actions">
                                                                <button
                                                                    type="button"
                                                                    className="btn-edit-assessment"
                                                                    onClick={() => toggleEditAssessment(assessment.template_id)}
                                                                    title="Edit settings"
                                                                >
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="btn-unlink-assessment"
                                                                    onClick={() => handleUnlinkAssessment(assessment.template_id)}
                                                                    title="Unlink assessment"
                                                                >
                                                                    ×
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {isEditing && showAssessmentPicker && (
                                <div className="assessment-picker-dropdown">
                                    <div className="assessment-picker-header">
                                        <h4>Available assessments</h4>
                                        <button
                                            type="button"
                                            className="assessment-picker-close"
                                            onClick={() => setShowAssessmentPicker(false)}
                                        >
                                            ×
                                        </button>
                                    </div>
                                    <div className="assessment-picker-list">
                                        {availableTemplates.length === 0 ? (
                                            <p className="assessment-picker-empty">
                                                No assessment templates available.{' '}
                                                <Link to="/hr/assessments/new" className="assessment-picker-link">
                                                    Create one
                                                </Link>
                                            </p>
                                        ) : (
                                            availableTemplates
                                                .filter(
                                                    (template) =>
                                                        !linkedAssessments.some(
                                                            (linked) => linked.template_id === template.id
                                                        )
                                                )
                                                .map((template) => (
                                                    <div key={template.id} className="assessment-picker-item">
                                                        <div className="assessment-picker-info">
                                                            <h5>{template.title}</h5>
                                                            <p>
                                                                {template.question_count} questions · {template.duration_minutes} min
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="btn-link-assessment"
                                                            onClick={() => handleLinkAssessment(template.id)}
                                                        >
                                                            Link
                                                        </button>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="vacancy-form-right">
                        <div className="form-card">
                            <h3 className="form-card-heading">Status</h3>
                            <div className="custom-radio-group">
                                <label className="custom-radio-label">
                                    <input
                                        type="radio"
                                        name="status"
                                        value="OPEN"
                                        checked={formData.status === 'OPEN'}
                                        onChange={handleChange}
                                        className="custom-radio-input"
                                    />
                                    <span className="custom-radio-circle"></span>
                                    <span className="custom-radio-text">Open</span>
                                </label>
                                <label className="custom-radio-label">
                                    <input
                                        type="radio"
                                        name="status"
                                        value="DRAFT"
                                        checked={formData.status === 'DRAFT'}
                                        onChange={handleChange}
                                        className="custom-radio-input"
                                    />
                                    <span className="custom-radio-circle"></span>
                                    <span className="custom-radio-text">Draft</span>
                                </label>
                                <label className="custom-radio-label">
                                    <input
                                        type="radio"
                                        name="status"
                                        value="CLOSED"
                                        checked={formData.status === 'CLOSED'}
                                        onChange={handleChange}
                                        className="custom-radio-input"
                                    />
                                    <span className="custom-radio-circle"></span>
                                    <span className="custom-radio-text">Closed</span>
                                </label>
                            </div>
                        </div>

                        <div className="form-card">
                            <h3 className="form-card-heading">Details</h3>
                            
                            <div className="form-group">
                                <label>Location</label>
                                <input
                                    type="text"
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    placeholder="Karachi"
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label>Work mode</label>
                                <select
                                    name="work_mode"
                                    value={formData.work_mode}
                                    onChange={handleChange}
                                    className="form-select"
                                >
                                    <option value="ONSITE">Onsite</option>
                                    <option value="REMOTE">Remote</option>
                                    <option value="HYBRID">Hybrid</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Job type</label>
                                <select
                                    name="job_type"
                                    value={formData.job_type}
                                    onChange={handleChange}
                                    className="form-select"
                                >
                                    <option value="FULL_TIME">Full-time</option>
                                    <option value="PART_TIME">Part-time</option>
                                    <option value="CONTRACT">Contract</option>
                                    <option value="INTERNSHIP">Internship</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Experience level</label>
                                <select
                                    name="experience_level"
                                    value={formData.experience_level}
                                    onChange={handleChange}
                                    className="form-select"
                                >
                                    <option value="ENTRY">Entry level</option>
                                    <option value="MID">Mid level</option>
                                    <option value="SENIOR">Senior level</option>
                                    <option value="LEAD">Lead</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Number of openings</label>
                                <input
                                    type="number"
                                    name="openings"
                                    value={formData.openings}
                                    onChange={handleChange}
                                    placeholder="1"
                                    min="1"
                                    className="form-input"
                                />
                            </div>

                            <div className="form-row-equal">
                                <div className="form-group">
                                    <label>Min salary (optional)</label>
                                    <input
                                        type="number"
                                        name="min_salary"
                                        value={formData.min_salary}
                                        onChange={handleChange}
                                        placeholder="50000"
                                        min="0"
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Max salary (optional)</label>
                                    <input
                                        type="number"
                                        name="max_salary"
                                        value={formData.max_salary}
                                        onChange={handleChange}
                                        placeholder="100000"
                                        min="0"
                                        className="form-input"
                                    />
                                </div>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="btn-form-primary"
                            disabled={submitting || publishingDraft}
                        >
                            {submitting ? (
                                <>
                                    <span className="btn-spinner"></span>
                                    Saving...
                                </>
                            ) : (
                                isEditing ? 'Save changes' : 'Publish vacancy'
                            )}
                        </button>

                        <button 
                            type="button" 
                            className="btn-form-secondary"
                            disabled={submitting || publishingDraft}
                            onClick={(e) => handleSubmit(e, true)}
                        >
                            {publishingDraft ? (
                                <>
                                    <span className="btn-spinner"></span>
                                    Saving...
                                </>
                            ) : (
                                'Save as draft'
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}

export default VacancyForm;
