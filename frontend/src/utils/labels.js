export const EMPLOYMENT_TYPE_LABELS = {
    FULL_TIME: 'Full-time',
    PART_TIME: 'Part-time',
    CONTRACT: 'Contract',
    INTERNSHIP: 'Internship'
};

export const WORK_MODE_LABELS = {
    ONSITE: 'Onsite',
    REMOTE: 'Remote',
    HYBRID: 'Hybrid'
};

export const EXPERIENCE_LEVEL_LABELS = {
    ENTRY: 'Entry level',
    MID: 'Mid level',
    SENIOR: 'Senior level',
    LEAD: 'Lead'
};

export const AVAILABILITY_LABELS = {
    IMMEDIATE: 'Immediately',
    ONE_WEEK: 'In 1 week',
    TWO_WEEKS: 'In 2 weeks',
    ONE_MONTH: 'In 1 month',
    MORE_THAN_ONE_MONTH: 'More than 1 month'
};

export const formatSalary = (value) => {
    if (value === null || value === undefined || value === '') return null;
    return Number(value).toLocaleString('en-US');
};