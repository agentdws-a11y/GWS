import {
    IconAlertCircle,
    IconCircleCheck,
    IconCalendar,
    IconVideo,
    IconMapPin,
    IconUsers
} from '@tabler/icons-react';
import {
    parseLocalDateTime,
    formatDay,
    formatDayWithYear,
    formatTime,
    getInitials,
    isSafeUrl
} from '../../utils/interviewTime';
import './InterviewCard.css';

function getBadge(section, interview, isExpired) {
    if (section === 'needsReply') {
        return isExpired
            ? { label: 'Offer expired', tone: 'bad', icon: null }
            : { label: 'Action needed', tone: 'warn', icon: IconAlertCircle };
    }
    if (section === 'upcoming') {
        return { label: 'Confirmed', tone: 'ok', icon: IconCircleCheck };
    }
    if (interview.status === 'CANCELLED') {
        return { label: 'Cancelled', tone: 'bad', icon: null };
    }
    return { label: 'Completed', tone: 'neutral', icon: null };
}

function InterviewCard({ interview, section, onChooseTime }) {

    const start = parseLocalDateTime(interview.scheduled_start);
    const expiresAt = parseLocalDateTime(interview.offer_expires_at);
    const slots = interview.slots || [];
    const panel = interview.panel || [];

    const isExpired = section === 'needsReply' && expiresAt !== null && expiresAt < new Date();
    const badge = getBadge(section, interview, isExpired);
    const BadgeIcon = badge.icon;

    const roundLabel = interview.round_number ? `Round ${interview.round_number}` : null;
    const durationLabel = interview.duration_minutes ? `${interview.duration_minutes} min` : null;

    let subtitleParts;
    if (section === 'needsReply') {
        subtitleParts = [roundLabel, interview.round_name, durationLabel];
    } else if (section === 'upcoming') {
        subtitleParts = [roundLabel, interview.round_name];
    } else {
        subtitleParts = [roundLabel, start ? formatDayWithYear(start) : 'No time was confirmed'];
    }
    const subtitle = subtitleParts.filter(Boolean).join(' · ');

    const isZoom = interview.mode === 'ZOOM';


    let offerText = '';
    if (section === 'needsReply') {
        if (isExpired) {
            offerText = 'This offer has expired. Please contact HR.';
        } else {
            const count = slots.length;
            offerText = `HR offered you ${count} ${count === 1 ? 'time' : 'times'}.`;
            if (expiresAt) offerText += ` Choose one by ${formatDay(expiresAt)}.`;
        }
    }

    return (
        <article className={`cic-card cic-card-${section}`}>
            <div className="cic-head">
                <div>
                    <h3 className="cic-title">{interview.job_title}</h3>
                    {subtitle && <p className="cic-meta">{subtitle}</p>}
                </div>
                <span className={`cic-badge cic-badge-${badge.tone}`}>
                    {BadgeIcon && <BadgeIcon size={16} stroke={1.75} />}
                    {badge.label}
                </span>
            </div>

            {section === 'needsReply' && (
                <>
                    <p className="cic-offer">{offerText}</p>

                    <div className="cic-chips">
                        {slots.map(slot => {
                            const slotStart = parseLocalDateTime(slot.start_time);
                            if (!slotStart) return null;
                            return (
                                <button
                                    key={slot.id}
                                    type="button"
                                    className="cic-chip"
                                    onClick={() => onChooseTime(interview, slot.id)}
                                    disabled={isExpired}
                                >
                                    {formatDay(slotStart)} · {formatTime(slotStart)}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        type="button"
                        className="cic-btn cic-btn-primary"
                        onClick={() => onChooseTime(interview)}
                        disabled={isExpired || slots.length === 0}
                    >
                        Choose a time
                    </button>
                </>
            )}

            {section === 'upcoming' && (
                <>
                    <div className="cic-info">
                        {start && (
                            <span className="cic-info-item">
                                <IconCalendar size={20} stroke={1.5} />
                                {formatDay(start)}, {formatTime(start)}
                            </span>
                        )}
                        <span className="cic-info-item">
                            {isZoom ? <IconVideo size={20} stroke={1.5} /> : <IconMapPin size={20} stroke={1.5} />}
                            {[isZoom ? 'Zoom' : 'On-site', durationLabel].filter(Boolean).join(' · ')}
                        </span>
                        {panel.length > 0 && (
                            <span className="cic-info-item">
                                <IconUsers size={20} stroke={1.5} />
                                Panel of {panel.length}
                                <span className="cic-avatars">
                                    {panel.map(member => (
                                        <span key={member.id} className="cic-avatar">
                                            {getInitials(member.name)}
                                        </span>
                                    ))}
                                </span>
                            </span>
                        )}
                    </div>

                    {isZoom && interview.meeting_link && (
                        <p className="cic-note">
                            {isSafeUrl(interview.meeting_link) ? (
                                <a
                                    className="cic-link"
                                    href={interview.meeting_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Join Zoom meeting
                                </a>
                            ) : (
                                `Zoom link: ${interview.meeting_link}`
                            )}
                        </p>
                    )}
                    {!isZoom && interview.location && (
                        <p className="cic-note">Location: {interview.location}</p>
                    )}
                </>
            )}
        </article>
    );
}

export default InterviewCard;