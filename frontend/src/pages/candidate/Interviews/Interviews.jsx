import { useState, useEffect } from 'react';
import { getCandidateInterviews } from '../../../services/interviewService';
import { notify } from '../../../utils/notify';
import InterviewCard from '../../../components/candidate/InterviewCard';
import InterviewSlotSelector from '../../../components/candidate/InterviewSlotSelector';
import './Interviews.css';

function Interviews() {
    const [needsReply, setNeedsReply] = useState([]);
    const [upcoming, setUpcoming] = useState([]);
    const [past, setPast] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [selection, setSelection] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setError('');
        try {
            const response = await getCandidateInterviews();
            setNeedsReply(response.needsReply || []);
            setUpcoming(response.upcoming || []);
            setPast(response.past || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChooseTime = (interview, slotId = null) => {
        setSelection({ interviewId: interview.id, slotId });
    };

    const handleConfirmed = () => {
        setSelection(null);
        notify.success('Interview confirmed');
        loadData({ silent: true });
    };

    const selectedInterview = selection
        ? needsReply.find(i => i.id === selection.interviewId)
        : null;

    const pastNewestFirst = [...past].reverse();

    const isEmpty = needsReply.length === 0 && upcoming.length === 0 && past.length === 0;

    const summaryParts = [];
    if (needsReply.length > 0) summaryParts.push(`${needsReply.length} needs your reply`);
    if (upcoming.length > 0) summaryParts.push(`${upcoming.length} upcoming`);
    const subtitle = summaryParts.length > 0
        ? summaryParts.join(' · ')
        : 'Reply to interview offers and see your upcoming interviews.';

    return (
        <div className="cip-page">
            <header className="cip-header">
                <h1 className="cip-title">My interviews</h1>
                <p className="cip-subtitle">{subtitle}</p>
            </header>

            {loading && <div className="cip-loading">Loading...</div>}

            {!loading && error && (
                <div className="cip-error">
                    <p>{error}</p>
                    <button type="button" className="cip-retry" onClick={() => loadData()}>
                        Try again
                    </button>
                </div>
            )}

            {!loading && !error && (
                <>
                    {needsReply.length > 0 && (
                        <section className="cip-section">
                            <h2 className="cip-section-label">Needs your reply</h2>
                            <div className="cip-list">
                                {needsReply.map(interview => (
                                    <InterviewCard
                                        key={interview.id}
                                        interview={interview}
                                        section="needsReply"
                                        onChooseTime={handleChooseTime}
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {upcoming.length > 0 && (
                        <section className="cip-section">
                            <h2 className="cip-section-label">Upcoming</h2>
                            <div className="cip-list">
                                {upcoming.map(interview => (
                                    <InterviewCard
                                        key={interview.id}
                                        interview={interview}
                                        section="upcoming"
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {past.length > 0 && (
                        <section className="cip-section">
                            <h2 className="cip-section-label">Past</h2>
                            <div className="cip-list">
                                {pastNewestFirst.map(interview => (
                                    <InterviewCard
                                        key={interview.id}
                                        interview={interview}
                                        section="past"
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {isEmpty && (
                        <div className="cip-empty">
                            <h3>No interviews yet</h3>
                            <p>When HR offers you interview times, they will show up here.</p>
                        </div>
                    )}
                </>
            )}

            {selectedInterview && (
                <InterviewSlotSelector
                    key={selectedInterview.id}
                    interview={selectedInterview}
                    initialSlotId={selection.slotId}
                    onClose={() => setSelection(null)}
                    onSuccess={handleConfirmed}
                    onConflict={() => loadData({ silent: true })}
                />
            )}
        </div>
    );
}

export default Interviews;