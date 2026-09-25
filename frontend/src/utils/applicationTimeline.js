import { formatClosingDate } from './jobDisplay';
import { formatDateTime } from './dateTime';

const STEP_TITLES = [
    'Application submitted',
    'CV reviewed',
    'Shortlisted',
    'Choose an interview time',
    'Interview',
    'Decision'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MODE_TEXT = { ZOOM: 'Zoom', ONSITE: 'On-site' };

export const formatWeekdayDate = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

export const buildTimeline = ({ application, events = [], interviews = [] }) => {
    const latest = (type) => events.find((e) => e.event_type === type);
    const earliest = (type) => [...events].reverse().find((e) => e.event_type === type);
    const dateOf = (event) => (event ? formatClosingDate(event.created_at) : '');

    const aiDone = application.ai_status === 'DONE';
    const round = application.current_round || 1;

    const mine = interviews.filter((i) => i.application_id === application.id);
    const offered = mine.find((i) => i.status === 'SLOTS_OFFERED');
    const scheduled = mine.find((i) => i.status === 'SCHEDULED');
    const held = mine.find((i) => i.status === 'COMPLETED' || i.status === 'SCHEDULED');

    const doneDetail = (index) => {
        switch (index) {
            case 0: return formatClosingDate(application.applied_at);
            case 2: return dateOf(earliest('SHORTLISTED'));
            case 3: return dateOf(latest('INTERVIEW_CONFIRMED'));
            case 4: return held && held.scheduled_start ? formatDateTime(held.scheduled_start) : '';
            default: return '';
        }
    };

    if (application.stage === 'REJECTED') {
        const reached = latest('INTERVIEW_CONFIRMED') ? 4
            : earliest('SHORTLISTED') ? 2
            : aiDone ? 1
            : 0;

        const steps = STEP_TITLES.slice(0, reached + 1).map((title, index) => ({
            title,
            state: 'done',
            detail: doneDetail(index)
        }));
        steps.push({ title: 'Not selected', state: 'rejected', detail: dateOf(latest('REJECTED')) });
        return steps;
    }

    if (['OFFER_SENT', 'OFFER_DECLINED', 'HIRED'].includes(application.stage)) {
        const steps = STEP_TITLES.map((title, index) => ({
            title,
            state: 'done',
            detail: index === 5 ? 'You were selected' : doneDetail(index)
        }));

        if (application.stage === 'OFFER_SENT') {
            steps.push({
                title: 'Offer',
                state: 'current',
                detail: 'Your offer letter is ready',
                action: { label: 'View offer', to: '/candidate/offers' }
            });
        } else if (application.stage === 'HIRED') {
            steps.push({ title: 'Offer accepted', state: 'done', detail: dateOf(latest('OFFER_ACCEPTED')) });
        } else {
            steps.push({ title: 'Offer declined', state: 'rejected', detail: dateOf(latest('OFFER_DECLINED')) });
        }
        return steps;
    }

    let current;
    switch (application.stage) {
        case 'APPLIED': current = aiDone ? 1 : 0; break;
        case 'SHORTLISTED': current = 2; break;
        case 'SLOTS_OFFERED': current = 3; break;
        case 'INTERVIEW_SCHEDULED':
        case 'INTERVIEWED': current = 4; break;
        case 'READY_FOR_OFFER': current = 5; break;
        case 'ON_HOLD':
            if (latest('INTERVIEW_CONFIRMED')) current = 5;
            else if (earliest('SHORTLISTED')) current = 2;
            else current = aiDone ? 1 : 0;
            break;
        default: current = 1;
    }

    const currentInfo = () => {
        switch (current) {
            case 0:
                return { detail: 'Your CV is being checked' };
            case 1:
                return { detail: 'Waiting for HR to review' };
            case 2:
                return {
                    detail: round > 1
                        ? `Round ${round}: HR will offer interview times soon`
                        : 'HR will offer interview times soon'
                };
            case 3: {
                if (!offered) return { detail: 'HR is preparing interview times' };
                const count = (offered.slots || []).length;
                const replyBy = formatWeekdayDate(offered.offer_expires_at);
                const parts = [`${count} ${count === 1 ? 'slot' : 'slots'} offered`];
                if (replyBy) parts.push(`reply by ${replyBy}`);
                return {
                    detail: parts.join(' · '),
                    action: { label: 'Pick a slot', to: '/candidate/interviews' }
                };
            }
            case 4: {
                if (application.stage === 'INTERVIEWED') {
                    return { detail: 'Interview completed. HR will share a decision soon.' };
                }
                if (scheduled) {
                    const when = formatDateTime(scheduled.scheduled_start);
                    const how = MODE_TEXT[scheduled.mode] || '';
                    return { detail: [when, how].filter(Boolean).join(' · ') };
                }
                return { detail: 'Interview scheduled' };
            }
            default:
                return { detail: 'HR is making a decision' };
        }
    };

    return STEP_TITLES.map((title, index) => {
        if (index < current) return { title, state: 'done', detail: doneDetail(index) };
        if (index > current) return { title, state: 'upcoming', detail: '' };
        return { title, state: 'current', ...currentInfo() };
    });
};