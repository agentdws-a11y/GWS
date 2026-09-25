const CANDIDATE_STATUS = {
    APPLIED: { label: 'Under review', tone: 'blue' },
    ON_HOLD: { label: 'Under review', tone: 'blue' },
    SHORTLISTED: { label: 'Shortlisted', tone: 'violet' },
    SLOTS_OFFERED: { label: 'Interview to schedule', tone: 'yellow' },
    INTERVIEW_SCHEDULED: { label: 'Interview scheduled', tone: 'green' },
    INTERVIEWED: { label: 'Interview completed', tone: 'neutral' },
    READY_FOR_OFFER: { label: 'Interview completed', tone: 'neutral' },
    OFFER_SENT: { label: 'Offer received', tone: 'green' },
    OFFER_DECLINED: { label: 'Offer declined', tone: 'neutral' },
    HIRED: { label: 'Hired', tone: 'green' },
    REJECTED: { label: 'Not selected', tone: 'red' }
};

export const getCandidateStatus = (stage) =>
    CANDIDATE_STATUS[stage] || { label: 'Under review', tone: 'blue' };