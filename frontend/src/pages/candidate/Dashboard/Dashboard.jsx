import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
    IconSearch,
    IconArrowRight,
    IconSend,
    IconBriefcase,
    IconCalendarEvent,
    IconBellRinging,
    IconInbox,
    IconClipboard,
    IconClock
} from '@tabler/icons-react';
import { getUser } from '../../../utils/auth';
import { getMyCandidateAssessments } from '../../../services/assessmentService';
import './Dashboard.css';

const GROUPS = [
    { key: 'review', label: 'Under review', color: '#60a5fa', progress: 20, stages: ['APPLIED'] },
    { key: 'shortlisted', label: 'Shortlisted', color: '#a78bfa', progress: 40, stages: ['SHORTLISTED'] },
    { key: 'pick', label: 'Interview to schedule', color: '#fbbf24', progress: 60, stages: ['SLOTS_OFFERED'] },
    { key: 'scheduled', label: 'Interview scheduled', color: '#34d399', progress: 80, stages: ['INTERVIEW_SCHEDULED'] },
    { key: 'done', label: 'Interview completed', color: '#2dd4bf', progress: 90, stages: ['INTERVIEWED', 'READY_FOR_OFFER'] },
    { key: 'offer', label: 'Offer received', color: '#10b981', progress: 95, stages: ['OFFER_SENT'] },
    { key: 'hired', label: 'Hired', color: '#059669', progress: 100, stages: ['HIRED'] },
    { key: 'hold', label: 'HR is making a decision', color: '#f59e0b', progress: 50, stages: ['ON_HOLD'] },
    { key: 'declined', label: 'Offer declined', color: '#94a3b8', progress: 100, stages: ['OFFER_DECLINED'] },
    { key: 'rejected', label: 'Not selected', color: '#f87171', progress: 100, stages: ['REJECTED'] }
];

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.03 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }
};

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
}

function getFormattedDate() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const now = new Date();
    return `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function getInitials(text) {
    if (!text) return '?';
    return text.split(' ').filter(Boolean).map((w) => w[0]).join('').toUpperCase().substring(0, 2);
}

function getStage(application) {
    return application.stage || application.status;
}

function getJobTitle(application) {
    return (
        application.job_title ||
        application.jobTitle ||
        application.title ||
        (application.job && application.job.title) ||
        'Application'
    );
}

function useCountUp(target, enabled = true, duration = 1000) {
    const [value, setValue] = useState(enabled ? 0 : target);

    useEffect(() => {
        if (!enabled) {
            setValue(target);
            return undefined;
        }

        let startTime;
        let raf;

        const step = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) raf = requestAnimationFrame(step);
        };

        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [target, duration, enabled]);

    return value;
}

function Dashboard() {
    const navigate = useNavigate();
    const reduce = useReducedMotion();
    const user = getUser();
    const { jobs = [], applications = [] } = useOutletContext() || {};
    const [ringMounted, setRingMounted] = useState(false);
    const [pendingAssessments, setPendingAssessments] = useState([]);

    useEffect(() => {
        const t = setTimeout(() => setRingMounted(true), 150);
        return () => clearTimeout(t);
    }, []);

    useEffect(() => {
        const loadAssessments = async () => {
            try {
                const data = await getMyCandidateAssessments();
                const pending = (data.assessments || []).filter(a => {
                    const isPending = a.status === 'PENDING' || a.status === 'IN_PROGRESS';
                    const notExpired = !a.deadline_at || new Date(a.deadline_at) >= new Date();
                    return isPending && notExpired;
                });
                setPendingAssessments(pending);
            } catch (err) {
                console.error('Failed to load assessments:', err);
            }
        };
        
        loadAssessments();
    }, []);

    const firstName = user?.name?.split(' ')[0] || user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
    const openPositions = jobs.length;
    const totalApplications = applications.length;
    const pendingAssessmentsCount = pendingAssessments.length;

    const counts = GROUPS.map((g) => ({
        ...g,
        count: applications.filter((a) => g.stages.includes(getStage(a))).length
    }));
    const visibleGroups = counts.filter((g) => g.count > 0);
    const needsReply = counts.find((g) => g.key === 'pick').count;
    const scheduledCount = counts.find((g) => g.key === 'scheduled').count;

    const animatedTotal = useCountUp(totalApplications, !reduce);
    const animatedOpen = useCountUp(openPositions, !reduce);
    const animatedScheduled = useCountUp(scheduledCount, !reduce);
    const animatedReply = useCountUp(needsReply, !reduce);
    const animatedPendingAssessments = useCountUp(pendingAssessmentsCount, !reduce);

    const gap = visibleGroups.length > 1 ? 4 : 0;
    let cumulative = 0;
    const segments = visibleGroups.map((g) => {
        const full = (g.count / Math.max(1, totalApplications)) * CIRCUMFERENCE;
        const length = Math.max(full - gap, 0.5);
        const start = cumulative;
        cumulative += full;
        return { ...g, length, start };
    });

    const recent = applications.slice(0, 5).map((a) => {
        const group = GROUPS.find((g) => g.stages.includes(getStage(a)));
        return { app: a, group };
    });

    return (
        <motion.div
            className="candidate-dashboard cdb"
            variants={containerVariants}
            initial={reduce ? false : 'hidden'}
            animate="show"
        >
            <motion.div className="cdb-greeting" variants={itemVariants}>
                <div>
                    <h1 className="cdb-greeting-title">
                        {getGreeting()}
                        {firstName ? `, ${firstName}` : ''}
                    </h1>
                    <p className="cdb-greeting-date">{getFormattedDate()}</p>
                </div>
                <button type="button" className="cdb-cta" onClick={() => navigate('/candidate/jobs')}>
                    <IconSearch size={17} /> Browse jobs
                </button>
            </motion.div>

            {needsReply > 0 && (
                <motion.div className="cdb-alert" variants={itemVariants}>
                    <span className="cdb-alert-icon">
                        <IconBellRinging size={20} />
                    </span>
                    <div className="cdb-alert-text">
                        <strong>
                            {needsReply} {needsReply === 1 ? 'interview is' : 'interviews are'} waiting for your reply
                        </strong>
                        <span>HR has offered you times. Pick one to confirm it.</span>
                    </div>
                    <button
                        type="button"
                        className="cdb-alert-btn"
                        onClick={() => navigate('/candidate/interviews')}
                    >
                        Pick a time <IconArrowRight size={16} />
                    </button>
                </motion.div>
            )}

            {pendingAssessments.length > 0 && (
                <motion.div className="cdb-alert cdb-alert-blue" variants={itemVariants}>
                    <span className="cdb-alert-icon">
                        <IconClipboard size={20} />
                    </span>
                    <div className="cdb-alert-text">
                        <strong>
                            {pendingAssessments.length} {pendingAssessments.length === 1 ? 'assessment' : 'assessments'} waiting to be completed
                        </strong>
                        <span>Complete your skills tests to progress your applications.</span>
                    </div>
                    <button
                        type="button"
                        className="cdb-alert-btn"
                        onClick={() => navigate('/candidate/assessments')}
                    >
                        Take assessments <IconArrowRight size={16} />
                    </button>
                </motion.div>
            )}

            <div className="cdb-counters">
                <motion.div className="cdb-counter" variants={itemVariants}>
                    <span className="cdb-counter-icon cdb-tone-accent"><IconSend size={18} /></span>
                    <div className="cdb-counter-label">Applications submitted</div>
                    <div className="cdb-counter-value">{animatedTotal}</div>
                </motion.div>
                <motion.div className="cdb-counter" variants={itemVariants}>
                    <span className="cdb-counter-icon cdb-tone-blue"><IconBriefcase size={18} /></span>
                    <div className="cdb-counter-label">Open positions</div>
                    <div className="cdb-counter-value">{animatedOpen}</div>
                </motion.div>
                <motion.div className="cdb-counter" variants={itemVariants}>
                    <span className="cdb-counter-icon cdb-tone-green"><IconCalendarEvent size={18} /></span>
                    <div className="cdb-counter-label">Interviews scheduled</div>
                    <div className="cdb-counter-value">{animatedScheduled}</div>
                </motion.div>
                <motion.div
                    className={`cdb-counter ${pendingAssessmentsCount > 0 ? 'cdb-counter-attention' : ''}`}
                    variants={itemVariants}
                    onClick={() => pendingAssessmentsCount > 0 && navigate('/candidate/assessments')}
                    style={{ cursor: pendingAssessmentsCount > 0 ? 'pointer' : 'default' }}
                >
                    <span className="cdb-counter-icon cdb-tone-cyan"><IconClipboard size={18} /></span>
                    <div className="cdb-counter-label">Pending assessments</div>
                    <div className="cdb-counter-value">{animatedPendingAssessments}</div>
                </motion.div>
            </div>

            <div className="cdb-sections">
                <motion.div className="cdb-section" variants={itemVariants}>
                    <div className="cdb-section-header">
                        <h2 className="cdb-section-title">My applications</h2>
                        <button type="button" className="cdb-section-link" onClick={() => navigate('/candidate/applications')}>
                            View all
                        </button>
                    </div>

                    <div className="cdb-section-content">
                        {recent.length === 0 ? (
                            <div className="cdb-section-empty">
                                <span className="cdb-empty-icon"><IconInbox size={24} /></span>
                                <p>You have not applied to any job yet.</p>
                                <button type="button" className="cdb-cta" onClick={() => navigate('/candidate/jobs')}>
                                    Browse jobs
                                </button>
                            </div>
                        ) : (
                            <div className="cdb-list">
                                {recent.map(({ app, group }, i) => {
                                    const title = getJobTitle(app);
                                    const color = group ? group.color : '#9ca3af';
                                    return (
                                        <motion.div
                                            key={app.id || i}
                                            className="cdb-row"
                                            onClick={() => navigate('/candidate/applications')}
                                            initial={reduce ? false : { opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.3 + i * 0.06, duration: 0.35 }}
                                        >
                                            <div className="cdb-avatar">{getInitials(title)}</div>
                                            <div className="cdb-row-info">
                                                <div className="cdb-row-title">{title}</div>
                                                <div className="cdb-bar">
                                                    <motion.div
                                                        className="cdb-bar-fill"
                                                        style={{ background: color }}
                                                        initial={reduce ? false : { width: 0 }}
                                                        animate={{ width: `${group ? group.progress : 0}%` }}
                                                        transition={{ delay: 0.5 + i * 0.06, duration: 0.7, ease: 'easeOut' }}
                                                    />
                                                </div>
                                            </div>
                                            <span
                                                className="cdb-pill"
                                                style={{
                                                    background: `color-mix(in srgb, ${color} 18%, transparent)`,
                                                    color
                                                }}
                                            >
                                                {group ? group.label : 'Under review'}
                                            </span>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </motion.div>

                <motion.div className="cdb-section" variants={itemVariants}>
                    <div className="cdb-section-header">
                        <h2 className="cdb-section-title">Application breakdown</h2>
                    </div>

                    <div className="cdb-section-content">
                        {totalApplications === 0 ? (
                            <div className="cdb-section-empty">
                                <span className="cdb-empty-icon"><IconInbox size={24} /></span>
                                <p>Apply to your first job to see your breakdown here.</p>
                            </div>
                        ) : (
                            <div className="cdb-donut-body">
                                <div className="cdb-donut-wrap">
                                    <svg viewBox="0 0 140 140" className="cdb-donut-svg" role="img" aria-label="Applications by status">
                                        <circle cx="70" cy="70" r={RADIUS} className="cdb-donut-track" strokeWidth="14" fill="none" />
                                        <g transform="rotate(-90 70 70)">
                                            {segments.map((seg, i) => (
                                                <circle
                                                    key={seg.key}
                                                    cx="70"
                                                    cy="70"
                                                    r={RADIUS}
                                                    fill="none"
                                                    strokeWidth="14"
                                                    stroke={seg.color}
                                                    strokeDasharray={
                                                        ringMounted
                                                            ? `${seg.length} ${CIRCUMFERENCE - seg.length}`
                                                            : `0 ${CIRCUMFERENCE}`
                                                    }
                                                    strokeDashoffset={-seg.start}
                                                    className="cdb-donut-segment"
                                                    style={{ transitionDelay: `${0.2 + i * 0.1}s` }}
                                                />
                                            ))}
                                        </g>
                                    </svg>
                                    <div className="cdb-donut-center">
                                        <span className="cdb-donut-value">{animatedTotal}</span>
                                        <span className="cdb-donut-label">Applications</span>
                                    </div>
                                </div>

                                <div className="cdb-legend">
                                    {visibleGroups.map((g, i) => (
                                        <motion.div
                                            className="cdb-legend-row"
                                            key={g.key}
                                            initial={reduce ? false : { opacity: 0, x: 12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.5 + i * 0.07, duration: 0.35 }}
                                        >
                                            <span className="cdb-legend-dot" style={{ background: g.color }} />
                                            <span className="cdb-legend-label">{g.label}</span>
                                            <span className="cdb-legend-count">{g.count}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}

export default Dashboard;