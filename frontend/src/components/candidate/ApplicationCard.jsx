import { getCandidateStatus } from '../../utils/candidateStatus';
import { formatClosingDate } from '../../utils/jobDisplay';
import '../../styles/toneBadges.css';
import './ApplicationCard.css';

function ApplicationCard({ application, selected, onSelect }) {
    const status = getCandidateStatus(application.stage);

    return (
        <button
            type="button"
            className={`ac-card${selected ? ' is-selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onSelect(application.id)}
        >
            <span className="ac-text">
                <span className="ac-title">{application.job_title}</span>
                <span className="ac-date">Applied {formatClosingDate(application.applied_at)}</span>
            </span>
            <span className={`tone-badge tone-${status.tone}`}>{status.label}</span>
        </button>
    );
}

export default ApplicationCard;