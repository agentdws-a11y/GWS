import { IconCheck, IconX } from '@tabler/icons-react';
import './ApplicationTimeline.css';

function ApplicationTimeline({ steps, onAction }) {
    return (
        <ol className="at-list">
            {steps.map((step) => (
                <li key={step.title} className={`at-step at-${step.state}`}>
                    <span className="at-icon">
                        {step.state === 'done' && <IconCheck size={14} stroke={3} />}
                        {step.state === 'rejected' && <IconX size={14} stroke={3} />}
                        {step.state === 'current' && <span className="at-dot" />}
                    </span>

                    <div className="at-body">
                        <p className="at-title">{step.title}</p>
                        {step.detail && <p className="at-detail">{step.detail}</p>}
                        {step.action && (
                            <button type="button" className="at-action" onClick={() => onAction(step.action)}>
                                {step.action.label}
                            </button>
                        )}
                    </div>
                </li>
            ))}
        </ol>
    );
}

export default ApplicationTimeline;