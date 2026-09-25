import { IconMapPin, IconClock, IconBriefcase, IconCurrencyDollar } from '@tabler/icons-react';
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from '../../utils/labels';
import { toSkillList, formatLocation, formatClosingDate, formatSalaryRange } from '../../utils/jobDisplay';
import './JobCard.css';

const MAX_SKILLS_SHOWN = 4;

function JobCard({ job, applied, onOpen, onViewStatus }) {
    const skills = toSkillList(job.required_skills);
    const shownSkills = skills.slice(0, MAX_SKILLS_SHOWN);
    const hiddenCount = skills.length - shownSkills.length;

    const location = formatLocation(job);
    const jobType = EMPLOYMENT_TYPE_LABELS[job.employment_type] || job.employment_type;
    const experienceLevel = EXPERIENCE_LEVEL_LABELS[job.experience_level] || job.experience_level;
    const salaryRange = formatSalaryRange(job.min_salary, job.max_salary);
    const closingDate = formatClosingDate(job.application_deadline);

    return (
        <article className="jc-card">
            <div className="jc-top">
                <div className="jc-heading">
                    <h3 className="jc-title">
                        <button type="button" className="jc-title-link" onClick={() => onOpen(job.id)}>
                            {job.title}
                        </button>
                    </h3>
                    <p className="jc-dept">{job.department}</p>
                </div>
                {applied && <span className="jc-applied">Applied</span>}
            </div>

            <div className="jc-meta">
                {location && (
                    <span><IconMapPin size={16} stroke={1.75} />{location}</span>
                )}
                {jobType && (
                    <span><IconClock size={16} stroke={1.75} />{jobType}</span>
                )}
                {experienceLevel && (
                    <span><IconBriefcase size={16} stroke={1.75} />{experienceLevel}</span>
                )}
                {salaryRange && (
                    <span><IconCurrencyDollar size={16} stroke={1.75} />{salaryRange}</span>
                )}
            </div>

            {skills.length > 0 && (
                <div className="jc-skills">
                    {shownSkills.map((skill) => (
                        <span key={skill} className="jc-chip">{skill}</span>
                    ))}
                    {hiddenCount > 0 && <span className="jc-chip">+{hiddenCount}</span>}
                </div>
            )}

            <div className="jc-footer">
                <span className="jc-closes">
                    {closingDate ? `Closes ${closingDate}` : 'Open until filled'}
                </span>
                {applied ? (
                    <button type="button" className="jc-btn" onClick={onViewStatus}>
                        View status
                    </button>
                ) : (
                    <button type="button" className="jc-btn" onClick={() => onOpen(job.id)}>
                        Apply now
                    </button>
                )}
            </div>
        </article>
    );
}

export default JobCard;