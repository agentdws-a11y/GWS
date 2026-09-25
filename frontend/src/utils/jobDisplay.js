
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const WORK_MODE_TEXT = {
    ONSITE: 'on-site',
    HYBRID: 'hybrid',
    REMOTE: 'remote'
};

export const formatSalaryRange = (minSalary, maxSalary) => {
    const formatNumber = (num) => {
        if (!num) return null;
        return Number(num).toLocaleString('en-US');
    };

    const min = formatNumber(minSalary);
    const max = formatNumber(maxSalary);

    if (min && max) {
        return `${min} - ${max}`;
    }
    if (min) {
        return `${min}+`;
    }
    if (max) {
        return `Up to ${max}`;
    }
    return null;
};

export const toSkillList = (value) => {
    if (Array.isArray(value)) {
        return value.map((s) => String(s).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return toSkillList(parsed);
        } catch {
        }
        return value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
};

export const formatLocation = (job) => {
    if (job.work_mode === 'REMOTE') return 'Remote';

    const mode = WORK_MODE_TEXT[job.work_mode] || '';
    if (job.location && mode) return `${job.location}, ${mode}`;
    if (job.location) return job.location;
    if (mode) return mode.charAt(0).toUpperCase() + mode.slice(1);
    return '';
};

const readDateParts = (value) => {
    if (!value) return null;
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    return { year: match[1], month: Number(match[2]), day: Number(match[3]) };
};

export const formatClosingDate = (value) => {
    const parts = readDateParts(value);
    if (!parts) return '';
    return `${parts.day} ${MONTHS[parts.month - 1]} ${parts.year}`;
};

export const isPastDeadline = (value) => {
    const parts = readDateParts(value);
    if (!parts) return false;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const deadline = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;

    return deadline < today;
};

export const parseDescription = (text) => {
    const blocks = [];
    let paragraph = [];
    let list = null;

    const flushParagraph = () => {
        if (paragraph.length > 0) {
            blocks.push({ type: 'p', text: paragraph.join(' ') });
            paragraph = [];
        }
    };
    const flushList = () => {
        if (list) {
            blocks.push({ type: 'ul', items: list });
            list = null;
        }
    };

    for (const rawLine of String(text || '').split(/\r?\n/)) {
        const line = rawLine.trim();

        if (!line) {
            flushParagraph();
            flushList();
            continue;
        }

        const bullet = line.match(/^[-*•]\s+(.*)$/);
        if (bullet) {
            flushParagraph();
            if (!list) list = [];
            list.push(bullet[1]);
        } else {
            flushList();
            paragraph.push(line);
        }
    }

    flushParagraph();
    flushList();
    return blocks;
};