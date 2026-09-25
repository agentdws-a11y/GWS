import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
    IconArrowLeft,
    IconMapPin,
    IconClock,
    IconCalendarEvent,
    IconUpload,
    IconFileText,
    IconX,
    IconCheck,
    IconChevronDown,
    IconClipboard
} from '@tabler/icons-react';
import { getJobById } from '../../../services/jobService';
import { submitApplication } from '../../../services/applicationService';
import { getUser } from '../../../utils/auth';
import { notify } from '../../../utils/notify';
import { EMPLOYMENT_TYPE_LABELS, AVAILABILITY_LABELS, EXPERIENCE_LEVEL_LABELS, formatSalary } from '../../../utils/labels';
import { getCandidateStatus } from '../../../utils/candidateStatus';
import {
    toSkillList,
    formatLocation,
    formatClosingDate,
    isPastDeadline,
    parseDescription,
    formatSalaryRange
} from '../../../utils/jobDisplay';
import '../../../styles/toneBadges.css';
import './JobDetail.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

const checkCvFile = (file) => {
    const name = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
        return 'Only PDF or DOCX files are allowed';
    }
    if (file.size > MAX_FILE_SIZE) {
        return 'File is too large. The maximum size is 5 MB';
    }
    return '';
};

function AppliedSummary({ application, onViewStatus }) {
    const status = getCandidateStatus(application.stage);

    const rows = [
        { label: 'Applied on', value: formatClosingDate(application.applied_at) },
        { label: 'Phone number', value: application.phone },
        { label: 'Expected salary', value: application.expected_salary ? formatSalary(application.expected_salary) : '' },
        { label: 'Availability', value: AVAILABILITY_LABELS[application.availability] || '' },
        { label: 'Resume', value: application.cv_original_name }
    ].filter((row) => row.value);

    return (
        <div className="jd-applied">
            <div className="jd-applied-head">
                <span className="jd-applied-icon">
                    <IconCheck size={20} stroke={2} />
                </span>
                <div>
                    <h2 className="jd-apply-title">Application submitted</h2>
                    <span className={`tone-badge tone-${status.tone}`}>{status.label}</span>
                </div>
            </div>

            <dl className="jd-summary">
                {rows.map((row) => (
                    <div key={row.label} className="jd-summary-row">
                        <dt>{row.label}</dt>
                        <dd>{row.value}</dd>
                    </div>
                ))}
            </dl>

            {application.cover_note && (
                <>
                    <p className="jd-summary-label">Cover note</p>
                    <p className="jd-summary-note">{application.cover_note}</p>
                </>
            )}

            <button type="button" className="jd-submit" onClick={onViewStatus}>
                View status
            </button>
        </div>
    );
}

function JobDetail() {
    const { jobId } = useParams();
    const navigate = useNavigate();
    const { applications, reloadApplications } = useOutletContext();
    const user = getUser();
    const fileInputRef = useRef(null);

    const [job, setJob] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [phone, setPhone] = useState('');
    const [expectedSalary, setExpectedSalary] = useState('');
    const [availability, setAvailability] = useState('');
    const [coverNote, setCoverNote] = useState('');
    const [cvFile, setCvFile] = useState(null);
    const [fileError, setFileError] = useState('');
    const [formError, setFormError] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const loadJob = async () => {
            try {
                setLoading(true);
                setLoadError('');
                const response = await getJobById(jobId);
                if (!cancelled) setJob(response.job);
            } catch (err) {
                if (!cancelled) setLoadError(err.message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadJob();
        return () => { cancelled = true; };
    }, [jobId]);

    const myApplication = applications.find((app) => String(app.job_id) === String(jobId));

    const pickFile = (file) => {
        if (!file) return;

        const problem = checkCvFile(file);
        if (problem) {
            setCvFile(null);
            setFileError(problem);
            return;
        }

        setCvFile(file);
        setFileError('');
        setFormError('');
    };

    const handleFileInput = (e) => {
        pickFile(e.target.files[0]);
        e.target.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        pickFile(e.dataTransfer.files[0]);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        setDragOver(true);
    };

    const openFilePicker = () => fileInputRef.current?.click();

    const handleDropZoneKey = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openFilePicker();
        }
    };

    const removeFile = () => {
        setCvFile(null);
        setFileError('');
    };

    const handlePhoneChange = (e) => {
        setPhone(e.target.value.replace(/\D/g, '').slice(0, 11));
    };

    const handleSalaryChange = (e) => {
        setExpectedSalary(e.target.value.replace(/\D/g, '').slice(0, 8));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;

        if (!/^\d{11}$/.test(phone)) {
            setFormError('Phone number must be exactly 11 digits');
            return;
        }
        if (!cvFile) {
            setFormError('Please upload your resume');
            return;
        }

        try {
            setSubmitting(true);
            setFormError('');

            await submitApplication(job.id, cvFile, {
                phone,
                cover_note: coverNote.trim(),
                expected_salary: expectedSalary,
                availability
            });

            await reloadApplications();
            notify.success('Application submitted');
            navigate('/candidate/applications');
        } catch (err) {
            setFormError(err.message);
            if (err.status === 409) reloadApplications();
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="jd-page">
                <p className="jd-state">Loading job...</p>
            </div>
        );
    }

    if (loadError || !job) {
        return (
            <div className="jd-page">
                <Link to="/candidate/jobs" className="jd-back">
                    <IconArrowLeft size={18} stroke={1.75} />
                    Back to jobs
                </Link>
                <div className="jd-missing">
                    <h2>This job is not available</h2>
                    <p>{loadError || 'It may have been closed or removed.'}</p>
                </div>
            </div>
        );
    }

    const skills = toSkillList(job.required_skills);
    const descriptionBlocks = parseDescription(job.description);
    const location = formatLocation(job);
    const jobType = EMPLOYMENT_TYPE_LABELS[job.employment_type] || job.employment_type;
    const experienceLevel = EXPERIENCE_LEVEL_LABELS[job.experience_level];
    const salaryRange = formatSalaryRange(job.min_salary, job.max_salary);
    const closingDate = formatClosingDate(job.application_deadline);
    const closed = isPastDeadline(job.application_deadline);

    return (
        <div className="jd-page">
            <Link to="/candidate/jobs" className="jd-back">
                <IconArrowLeft size={18} stroke={1.75} />
                Back to jobs
            </Link>

            <div className="jd-layout">
                <div className="jd-main">
                    <h1 className="jd-title">{job.title}</h1>
                    <p className="jd-dept">{job.department}</p>

                    <div className="jd-meta">
                        {location && (
                            <span><IconMapPin size={18} stroke={1.75} />{location}</span>
                        )}
                        {jobType && (
                            <span><IconClock size={18} stroke={1.75} />{jobType}</span>
                        )}
                        {experienceLevel && (
                            <span><IconClock size={18} stroke={1.75} />{experienceLevel}</span>
                        )}
                        {salaryRange && (
                            <span><IconClock size={18} stroke={1.75} />{salaryRange}</span>
                        )}
                        {closingDate && (
                            <span><IconCalendarEvent size={18} stroke={1.75} />Closes {closingDate}</span>
                        )}
                    </div>

                    {job.openings && job.openings > 1 && (
                        <div className="jd-notice" style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--color-bg-secondary)', borderRadius: '0.5rem' }}>
                            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                                <strong>{job.openings} positions</strong> available for this role
                            </p>
                        </div>
                    )}

                    <section className="jd-card">
                        <h2 className="jd-card-title">About the role</h2>
                        {descriptionBlocks.map((block, index) =>
                            block.type === 'ul' ? (
                                <ul key={index} className="jd-list">
                                    {block.items.map((item, i) => <li key={i}>{item}</li>)}
                                </ul>
                            ) : (
                                <p key={index} className="jd-text">{block.text}</p>
                            )
                        )}
                    </section>

                    {skills.length > 0 && (
                        <section className="jd-card">
                            <h2 className="jd-card-title">Required skills</h2>
                            <div className="jd-skills">
                                {skills.map((skill) => (
                                    <span key={skill} className="jd-skill">{skill}</span>
                                ))}
                            </div>
                        </section>
                    )}

                    {job.assessments && job.assessments.length > 0 && (
                        <section className="jd-card">
                            <h2 className="jd-card-title">
                                <IconClipboard size={20} stroke={1.75} />
                                Required Assessments
                            </h2>
                            <p className="jd-text" style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                                You will be required to complete {job.assessments.length === 1 ? 'this assessment' : 'these assessments'} after submitting your application.
                            </p>
                            <div className="jd-assessments">
                                {job.assessments.map((assessment) => (
                                    <div key={assessment.id} className="jd-assessment-item">
                                        <div className="jd-assessment-header">
                                            <h3 className="jd-assessment-title">{assessment.title}</h3>
                                            {assessment.is_required && (
                                                <span className="jd-assessment-badge">Required</span>
                                            )}
                                        </div>
                                        {assessment.description && (
                                            <p className="jd-assessment-desc">{assessment.description}</p>
                                        )}
                                        <div className="jd-assessment-meta">
                                            <span><IconClock size={16} stroke={1.75} /> {assessment.duration_minutes} minutes</span>
                                            <span><IconCheck size={16} stroke={1.75} /> {assessment.passing_score}% to pass</span>
                                            <span>{assessment.question_count} {assessment.question_count === 1 ? 'question' : 'questions'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                <aside className="jd-apply">
                    {myApplication ? (
                        <AppliedSummary
                            application={myApplication}
                            onViewStatus={() => navigate('/candidate/applications')}
                        />
                    ) : closed ? (
                        <div className="jd-notice">
                            <h2 className="jd-apply-title">Applications are closed</h2>
                            <p>The closing date for this job has passed.</p>
                        </div>
                    ) : (
                        <form className="jd-form" onSubmit={handleSubmit} noValidate>
                            <h2 className="jd-apply-title">Apply for this job</h2>

                            <label className="jd-label" htmlFor="jd-name">Full name</label>
                            <input
                                id="jd-name"
                                className="jd-input"
                                type="text"
                                value={user?.name || ''}
                                readOnly
                            />

                            <label className="jd-label" htmlFor="jd-email">Email</label>
                            <input
                                id="jd-email"
                                className="jd-input"
                                type="email"
                                value={user?.email || ''}
                                readOnly
                            />

                            <label className="jd-label" htmlFor="jd-phone">Phone number</label>
                            <input
                                id="jd-phone"
                                className="jd-input jd-input-editable"
                                type="tel"
                                inputMode="numeric"
                                maxLength={11}
                                placeholder="03001234567"
                                value={phone}
                                onChange={handlePhoneChange}
                            />

                            <label className="jd-label" htmlFor="jd-salary">Expected salary (optional)</label>
                            <input
                                id="jd-salary"
                                className="jd-input jd-input-editable"
                                type="text"
                                inputMode="numeric"
                                placeholder="e.g. 150000"
                                value={expectedSalary}
                                onChange={handleSalaryChange}
                            />

                            <label className="jd-label" htmlFor="jd-availability">Availability (optional)</label>
                            <div className="jd-select-wrap">
                                <select
                                    id="jd-availability"
                                    className="jd-input jd-input-editable jd-select"
                                    value={availability}
                                    onChange={(e) => setAvailability(e.target.value)}
                                >
                                    <option value="">Select an option</option>
                                    {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
                                        <option key={value} value={value}>{label}</option>
                                    ))}
                                </select>
                                <IconChevronDown className="jd-select-chevron" size={16} stroke={1.75} />
                            </div>

                            <span className="jd-label">Resume (PDF or DOCX)</span>
                            <div
                                className={`jd-drop${dragOver ? ' is-over' : ''}`}
                                role="button"
                                tabIndex={0}
                                onClick={openFilePicker}
                                onKeyDown={handleDropZoneKey}
                                onDragOver={handleDragOver}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleDrop}
                            >
                                <IconUpload size={24} stroke={1.75} />
                                <span>Drag a file here or browse</span>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.docx"
                                hidden
                                onChange={handleFileInput}
                            />

                            {cvFile && (
                                <div className="jd-file">
                                    <IconFileText size={20} stroke={1.75} />
                                    <span className="jd-file-name">{cvFile.name}</span>
                                    <button
                                        type="button"
                                        className="jd-file-remove"
                                        aria-label="Remove file"
                                        onClick={removeFile}
                                    >
                                        <IconX size={18} stroke={1.75} />
                                    </button>
                                </div>
                            )}
                            {fileError && <p className="jd-error">{fileError}</p>}

                            <label className="jd-label" htmlFor="jd-note">Cover note (optional)</label>
                            <textarea
                                id="jd-note"
                                className="jd-input jd-input-editable jd-textarea"
                                rows={5}
                                maxLength={2000}
                                value={coverNote}
                                onChange={(e) => setCoverNote(e.target.value)}
                            />

                            {formError && <p className="jd-error jd-error-form">{formError}</p>}

                            <button type="submit" className="jd-submit" disabled={submitting}>
                                {submitting ? 'Submitting...' : 'Submit application'}
                            </button>
                        </form>
                    )}
                </aside>
            </div>
        </div>
    );
}

export default JobDetail;