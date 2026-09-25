import { useState, useEffect } from 'react';
import { getMyOffers, acceptOffer, declineOffer } from '../../../services/offerService';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import { notify } from '../../../utils/notify';
import '../../../styles/toneBadges.css';
import './Offers.css';

const STATUS_META = {
    SENT: { label: 'Awaiting your reply', tone: 'blue' },
    ACCEPTED: { label: 'Accepted', tone: 'green' },
    DECLINED: { label: 'Declined', tone: 'red' }
};

function formatDate(value) {
    if (!value) return '';
    const d = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Offers() {
    const [offers, setOffers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pending, setPending] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadOffers();
    }, []);

    const loadOffers = async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        setError('');
        try {
            const response = await getMyOffers();
            setOffers(response.offers || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!pending || saving) return;
        setSaving(true);
        try {
            if (pending.decision === 'ACCEPT') {
                await acceptOffer(pending.offer.id);
                notify.success('Offer accepted. Congratulations!');
            } else {
                await declineOffer(pending.offer.id);
                notify.success('Offer declined');
            }
            setPending(null);
            loadOffers({ silent: true });
        } catch (err) {
            notify.error(err.message);
            setPending(null);
        } finally {
            setSaving(false);
        }
    };

    const isAccept = pending?.decision === 'ACCEPT';

    return (
        <div className="co-page">
            <header className="co-header">
                <h1 className="co-title">My offers</h1>
                <p className="co-subtitle">Read your offer letters and reply to them here.</p>
            </header>

            {loading && <p className="co-state">Loading...</p>}

            {!loading && error && (
                <div className="co-state">
                    <p>{error}</p>
                    <button type="button" className="co-btn co-btn-secondary" onClick={() => loadOffers()}>
                        Try again
                    </button>
                </div>
            )}

            {!loading && !error && offers.length === 0 && (
                <div className="co-empty">
                    <h3>No offers yet</h3>
                    <p>When HR sends you an offer letter, it will show up here.</p>
                </div>
            )}

            {!loading && !error && offers.map((offer) => {
                const meta = STATUS_META[offer.status] || { label: offer.status, tone: 'neutral' };
                return (
                    <section key={offer.id} className="co-card">
                        <div className="co-card-head">
                            <div>
                                <h2 className="co-job">{offer.job_title}</h2>
                                <p className="co-dept">{offer.job_department}</p>
                            </div>
                            <span className={`tone-badge tone-${meta.tone}`}>{meta.label}</span>
                        </div>

                        <div className="co-facts">
                            <div>
                                <span className="co-fact-label">Salary</span>
                                <span className="co-fact-value">PKR {Number(offer.salary).toLocaleString()} / month</span>
                            </div>
                            <div>
                                <span className="co-fact-label">Start date</span>
                                <span className="co-fact-value">{formatDate(offer.start_date)}</span>
                            </div>
                            <div>
                                <span className="co-fact-label">Sent</span>
                                <span className="co-fact-value">{formatDate(offer.sent_at)}</span>
                            </div>
                        </div>

                        <pre className="co-letter">{offer.letter_body}</pre>

                        {offer.status === 'SENT' ? (
                            <div className="co-actions">
                                <button
                                    type="button"
                                    className="co-btn co-btn-danger"
                                    onClick={() => setPending({ offer, decision: 'DECLINE' })}
                                >
                                    Decline offer
                                </button>
                                <button
                                    type="button"
                                    className="co-btn co-btn-primary"
                                    onClick={() => setPending({ offer, decision: 'ACCEPT' })}
                                >
                                    Accept offer
                                </button>
                            </div>
                        ) : (
                            <p className="co-answered">
                                You {offer.status === 'ACCEPTED' ? 'accepted' : 'declined'} this offer on {formatDate(offer.responded_at)}.
                            </p>
                        )}
                    </section>
                );
            })}

            <ConfirmDialog
                open={!!pending}
                title={isAccept ? 'Accept this offer?' : 'Decline this offer?'}
                message={isAccept
                    ? 'HR will be told that you accepted. You cannot undo this.'
                    : 'HR will be told that you declined. You cannot undo this.'}
                confirmLabel={isAccept ? 'Accept' : 'Decline'}
                cancelLabel="Cancel"
                danger={!isAccept}
                onConfirm={handleConfirm}
                onCancel={() => setPending(null)}
            />
        </div>
    );
}

export default Offers;