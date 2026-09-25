import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { IconSearch, IconChevronDown } from '@tabler/icons-react';
import JobCard from '../../../components/candidate/JobCard';
import { EMPLOYMENT_TYPE_LABELS, EXPERIENCE_LEVEL_LABELS } from '../../../utils/labels';
import { toSkillList, isPastDeadline } from '../../../utils/jobDisplay';
import './Vacancies.css';

function Vacancies() {
    const { jobs, applications, loading, error } = useOutletContext();
    const navigate = useNavigate();

    const [search, setSearch] = useState('');
    const [department, setDepartment] = useState('');
    const [jobType, setJobType] = useState('');
    const [experienceLevel, setExperienceLevel] = useState('');

    const appliedJobIds = useMemo(
        () => new Set(applications.map((app) => app.job_id)),
        [applications]
    );

    const openJobs = useMemo(
        () => jobs.filter((job) => !isPastDeadline(job.application_deadline)),
        [jobs]
    );

    const departments = useMemo(
        () => [...new Set(openJobs.map((job) => job.department_name).filter(Boolean))].sort(),
        [openJobs]
    );

    const visibleJobs = useMemo(() => {
        const query = search.trim().toLowerCase();

        return openJobs.filter((job) => {
            if (department && job.department_name !== department) return false;
            if (jobType && job.employment_type !== jobType) return false;
            if (experienceLevel && job.experience_level !== experienceLevel) return false;
            if (!query) return true;

            const inTitle = job.title.toLowerCase().includes(query);
            const inSkills = toSkillList(job.required_skills)
                .some((skill) => skill.toLowerCase().includes(query));
            return inTitle || inSkills;
        });
    }, [openJobs, search, department, jobType, experienceLevel]);

    const openJob = (jobId) => navigate(`/candidate/jobs/${jobId}`);
    const viewStatus = () => navigate('/candidate/applications');

    const clearFilters = () => {
        setSearch('');
        setDepartment('');
        setJobType('');
        setExperienceLevel('');
    };

    return (
        <div className="jb-page">
            <header className="jb-header">
                <h1 className="jb-title">Find your next role</h1>
                <p className="jb-subtitle">
                    {openJobs.length} open {openJobs.length === 1 ? 'position' : 'positions'}
                </p>
            </header>

            <div className="jb-filters">
                <div className="jb-search">
                    <IconSearch className="jb-search-icon" size={18} stroke={1.75} />
                    <input
                        type="text"
                        className="jb-search-input"
                        placeholder="Job title or skill"
                        aria-label="Search jobs by title or skill"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="jb-select-wrap">
                    <select
                        className="jb-select"
                        aria-label="Filter by department"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                    >
                        <option value="">All departments</option>
                        {departments.map((name) => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                    <IconChevronDown className="jb-select-chevron" size={16} stroke={1.75} />
                </div>

                <div className="jb-select-wrap">
                    <select
                        className="jb-select"
                        aria-label="Filter by job type"
                        value={jobType}
                        onChange={(e) => setJobType(e.target.value)}
                    >
                        <option value="">All job types</option>
                        {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <IconChevronDown className="jb-select-chevron" size={16} stroke={1.75} />
                </div>

                <div className="jb-select-wrap">
                    <select
                        className="jb-select"
                        aria-label="Filter by experience level"
                        value={experienceLevel}
                        onChange={(e) => setExperienceLevel(e.target.value)}
                    >
                        <option value="">All experience levels</option>
                        {Object.entries(EXPERIENCE_LEVEL_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                    <IconChevronDown className="jb-select-chevron" size={16} stroke={1.75} />
                </div>
            </div>

            {error && <div className="jb-alert">{error}</div>}

            {loading ? (
                <p className="jb-state">Loading jobs...</p>
            ) : openJobs.length === 0 ? (
                <div className="jb-empty">
                    <h3>No open positions right now</h3>
                    <p>New roles show up here as soon as HR publishes them.</p>
                </div>
            ) : visibleJobs.length === 0 ? (
                <div className="jb-empty">
                    <h3>No jobs match your search</h3>
                    <p>Try a different title or skill, or clear the filters.</p>
                    <button type="button" className="jb-clear" onClick={clearFilters}>
                        Clear filters
                    </button>
                </div>
            ) : (
                <div className="jb-grid">
                    {visibleJobs.map((job) => (
                        <JobCard
                            key={job.id}
                            job={job}
                            applied={appliedJobIds.has(job.id)}
                            onOpen={openJob}
                            onViewStatus={viewStatus}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Vacancies;