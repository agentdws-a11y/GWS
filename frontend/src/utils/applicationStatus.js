
const STAGE_META = {
    APPLIED: { label: 'Applied', tone: 'tone-neutral' },
    SHORTLISTED: { label: 'Shortlisted', tone: 'tone-violet' },
    SLOTS_OFFERED: { label: 'Slots offered', tone: 'tone-blue' },
    INTERVIEW_SCHEDULED: { label: 'Interview scheduled', tone: 'tone-green' },
    FEEDBACK_PENDING: { label: 'Feedback pending', tone: 'tone-yellow' },
    INTERVIEWED: { label: 'Interviewed', tone: 'tone-yellow' },
    ON_HOLD: { label: 'On hold', tone: 'tone-neutral' },
    REJECTED: { label: 'Rejected', tone: 'tone-red' },
    READY_FOR_OFFER: { label: 'Ready for offer', tone: 'tone-green' },
    OFFER_SENT: { label: 'Offer sent', tone: 'tone-blue' },
    OFFER_DECLINED: { label: 'Offer declined', tone: 'tone-red' },
    HIRED: { label: 'Hired', tone: 'tone-green' }
};

export function getApplicationDisplayStatus(application, interviewScheduledStart = null) {
    const stage = application.stage;
    
    if (stage === 'INTERVIEW_SCHEDULED' && interviewScheduledStart) {
        try {
            const interviewTime = new Date(interviewScheduledStart);
            const now = new Date();
            
            if (interviewTime < now && !isNaN(interviewTime.getTime())) {
                return {
                    stage: 'FEEDBACK_PENDING',
                    label: 'Feedback pending',
                    tone: 'tone-yellow',
                    isTimeBased: true
                };
            }
        } catch (error) {
            console.warn('Failed to parse interview scheduled start time:', error);
        }
    }
    
    const meta = STAGE_META[stage] || { label: stage, tone: 'tone-neutral' };
    return {
        stage,
        label: meta.label,
        tone: meta.tone,
        isTimeBased: false
    };
}

export { STAGE_META };
