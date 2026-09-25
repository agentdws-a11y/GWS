import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { IconClipboard, IconClock } from '@tabler/icons-react';
import { getCandidateInterviews } from '../../../services/interviewService';
import { getMyApplicationDetail } from '../../../services/applicationService';
import ApplicationCard from '../../../components/candidate/ApplicationCard';
import ApplicationTimeline from '../../../components/candidate/ApplicationTimeline';
import { buildTimeline } from '../../../utils/applicationTimeline';
import './Applications.css';

function Applications() {
    const navigate = useNavigate();
    const { applications, loading } = useOutletContext();

    const [interviews, setInterviews] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [detail, setDetail] = useState({ id: null, events: [] });

    useEffect(() => {
        const loadInterviews = async () => {
            try {
                const response = await getCandidateInterviews();
                setInterviews([
                    ...(response.needsReply || []),
                    ...(response.upcoming || []),
                    ...(response.past || [])
                ]);
            } catch (err) {
                console.error('Failed to load interviews:', err);
            }
        };
        loadInterviews();
    }, []);

    const selected = applications.find((app) => app.id === selectedId) || applications[0] || null;
    const selectedKey = selected ? selected.id : null;
    const selectedStage = selected ? selected.stage : null;

    useEffect(() => {
        if (selectedKey === null) return;
        let cancelled = false;

        const loadDetail = async () => {
            try {
                const response = await getMyApplicationDetail(selectedKey);
                if (!cancelled) {
                    setDetail({ id: selectedKey, events: response.application.timeline || [] });
                }
            } catch (err) {
                console.error('Failed to load application timeline:', err);
                if (!cancelled) setDetail({ id: selectedKey, events: [] });
            }
        };

        loadDetail();
        return () => { cancelled = true; };
    }, [selectedKey, selectedStage]);

    const steps = selected && detail.id === selected.id
        ? buildTimeline({ application: selected, events: detail.events, interviews })
        : null;

    return (
        <div className="ma-page">
            <header className="ma-header">
                <h1 className="ma-title">My applications</h1>
                <p className="ma-subtitle">
                    {applications.length} {applications.length === 1 ? 'application' : 'applications'}
                </p>
            </header>

            {applications.length === 0 ? (
                loading ? (
                    <p className="ma-state">Loading applications...</p>
                ) : (
                    <div className="ma-empty">
                        <h3>No applications yet</h3>
                        <p>Apply to a job and you can follow its progress here.</p>
                        <button type="button" className="ma-empty-btn" onClick={() => navigate('/candidate/jobs')}>
                            Browse jobs
                        </button>
                    </div>
                )
            ) : (
                <div className="ma-layout">
                    <div className="ma-list">
                        {applications.map((application) => (
                            <ApplicationCard
                                key={application.id}
                                application={application}
                                selected={selected && application.id === selected.id}
                                onSelect={setSelectedId}
                            />
                        ))}
                    </div>

                    <section className="ma-panel">
                        <h2 className="ma-panel-title">{selected.job_title}</h2>
                        <p className="ma-panel-sub">Application status</p>

                        {(selected.assessment_count > 0) && (
                            <div className="ma-assessment-status">
                                <div className="ma-assessment-header">
                                    <IconClipboard size={18} />
                                    <span>Assessments</span>
                                </div>
                                <div className="ma-assessment-progress">
                                    <span className="ma-assessment-text">
                                        {selected.assessment_completed} of {selected.assessment_count} completed
                                    </span>
                                    <button 
                                        className="ma-assessment-btn"
                                        onClick={() => navigate('/candidate/assessments')}
                                    >
                                        {selected.assessment_completed < selected.assessment_count ? 'Complete' : 'View Results'}
                                    </button>
                                </div>
                                {selected.assessment_completed < selected.assessment_count && (
                                    <p className="ma-assessment-note">
                                        <IconClock size={14} />
                                        Complete your skills tests to progress your application
                                    </p>
                                )}
                            </div>
                        )}

                        {steps ? (
                            <ApplicationTimeline steps={steps} onAction={(action) => navigate(action.to)} />
                        ) : (
                            <p className="ma-state">Loading status...</p>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}

export default Applications;