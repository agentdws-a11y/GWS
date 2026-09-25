import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useOutletContext } from 'react-router-dom';
import { getApplicationDetail } from '../../../services/applicationService';
import {
    getApplicationOffer,
    saveOfferDraft,
    updateOfferLetter,
    sendOffer
} from '../../../services/offerService';
import { notify } from '../../../utils/notify';
import './OfferScreen.css';

const STATUS_META = {
    DRAFT: { label: 'Draft', tone: 'tone-neutral' },
    SENT: { label: 'Sent', tone: 'tone-blue' },
    ACCEPTED: { label: 'Accepted', tone: 'tone-green' },
    DECLINED: { label: 'Declined', tone: 'tone-red' }
};

function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
}

function formatDate(value) {
    if (!value) return '';
    const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function tomorrowLocal() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function OfferScreen() {
    const { applicationId } = useParams();
    const navigate = useNavigate();
    const outlet = useOutletContext() || {};
    const reloadApplications = outlet.reloadApplications;

    const [application, setApplication] = useState(null);
    const [offer, setOffer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [salary, setSalary] = useState('');
    const [startDate, setStartDate] = useState('');
    const [guidelines, setGuidelines] = useState('');
    const [letterBody, setLetterBody] = useState('');

    const [generating, setGenerating] = useState(false);
    const [savingLetter, setSavingLetter] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        loadAll();
    }, [applicationId]);

    const loadAll = async () => {
        try {
            setLoading(true);
            setError('');
            const [appRes, offerRes] = await Promise.all([
                getApplicationDetail(applicationId),
                getApplicationOffer(applicationId)
            ]);
            setApplication(appRes.application);
            const existing = offerRes.offer;
            setOffer(existing);
            if (existing) {
                setSalary(String(existing.salary ?? ''));
                setStartDate(existing.start_date || '');
                setGuidelines(existing.guidelines || '');
                setLetterBody(existing.letter_body || '');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerate = async () => {
        if (!salary || Number(salary) <= 0) {
            notify.error('Enter a salary greater than 0');
            return;
        }
        if (!startDate) {
            notify.error('Pick a start date');
            return;
        }

        setGenerating(true);
        try {
            const res = await saveOfferDraft(applicationId, {
                salary: Number(salary),
                start_date: startDate,
                guidelines
            });
            setLetterBody(res.letter_body || '');
            notify.success(offer ? 'Offer letter regenerated' : 'Offer letter drafted');
            await loadAll();
            reloadApplications?.();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setGenerating(false);
        }
    };

    const handleSaveLetter = async () => {
        if (!offer) return;
        if (!letterBody.trim()) {
            notify.error('Letter text cannot be empty');
            return;
        }

        setSavingLetter(true);
        try {
            await updateOfferLetter(offer.id, letterBody);
            notify.success('Offer letter saved');
            await loadAll();
        } catch (err) {
            notify.error(err.message);
        } finally {
            setSavingLetter(false);
        }
    };

    const handleSend = async () => {
        if (!offer) return;

        setSending(true);
        try {
            await sendOffer(offer.id);
            notify.success('Offer sent to the candidate');
            reloadApplications?.();
            navigate(`/hr/applications/${applicationId}`);
        } catch (err) {
            notify.error(err.message);
        } finally {
            setSending(false);
        }
    };

    if (loading) {
        return (
            <div className="hro-wrapper">
                <div className="hro-loading">Loading offer...</div>
            </div>
        );
    }

    if (error || !application) {
        return (
            <div className="hro-wrapper">
                <div className="hro-error-state">
                    <p>{error || 'Application not found'}</p>
                    <Link to="/hr/applications" className="hro-link">Back to applications</Link>
                </div>
            </div>
        );
    }

    const canPrepareOffer = ['INTERVIEWED', 'READY_FOR_OFFER'].includes(application.stage);
    const canViewOffer = ['OFFER_SENT', 'OFFER_DECLINED', 'HIRED'].includes(application.stage);
    const eligible = canPrepareOffer || canViewOffer;
    const isDraft = offer && offer.status === 'DRAFT';
    const isFinal = offer && offer.status !== 'DRAFT';
    const statusMeta = offer ? STATUS_META[offer.status] : null;
    const letterChanged = offer && letterBody !== offer.letter_body;

    return (
        <div className="hro-wrapper">
            <div className="hro-breadcrumb">
                <Link to="/hr/applications" className="hro-breadcrumb-link">Applications</Link>
                <span className="hro-breadcrumb-sep">›</span>
                <Link to={`/hr/applications/${applicationId}`} className="hro-breadcrumb-link">
                    {application.candidate_name}
                </Link>
                <span className="hro-breadcrumb-sep">›</span>
                <span className="hro-breadcrumb-current">Offer</span>
            </div>

            <div className="hro-header">
                <div className="hro-header-left">
                    <div className="hro-avatar">{initials(application.candidate_name)}</div>
                    <div>
                        <h1 className="hro-name">{application.candidate_name}</h1>
                        <p className="hro-subline">{application.job_title}</p>
                    </div>
                </div>
                {statusMeta && (
                    <span className={`tone-badge ${statusMeta.tone}`}>{statusMeta.label}</span>
                )}
            </div>

            {!eligible && !offer && (
                <div className="hro-empty-card">
                    <p>An offer can only be prepared once this application is Interviewed or Ready for offer.</p>
                    <Link to={`/hr/applications/${applicationId}`} className="hro-link">Back to candidate</Link>
                </div>
            )}

            {(eligible || offer) && (
                <div className="hro-body">
                    <div className="hro-main">
                        {(!offer || isDraft) && (
                            <div className="hro-card">
                                <p className="hro-card-title">Offer details</p>
                                <div className="hro-form-row">
                                    <label className="hro-label" htmlFor="hro-salary">Salary (PKR per month)</label>
                                    <input
                                        id="hro-salary"
                                        className="hro-input"
                                        type="number"
                                        min="1"
                                        placeholder="e.g. 150000"
                                        value={salary}
                                        onChange={(e) => setSalary(e.target.value)}
                                        disabled={isFinal}
                                    />
                                </div>
                                <div className="hro-form-row">
                                    <label className="hro-label" htmlFor="hro-start-date">Start date</label>
                                    <input
                                        id="hro-start-date"
                                        className="hro-input"
                                        type="date"
                                        min={tomorrowLocal()}
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        disabled={isFinal}
                                    />
                                </div>
                                <div className="hro-form-row">
                                    <label className="hro-label" htmlFor="hro-guidelines">
                                        Additional terms <span className="hro-label-hint">(one per line, optional)</span>
                                    </label>
                                    <textarea
                                        id="hro-guidelines"
                                        className="hro-textarea"
                                        rows={4}
                                        placeholder={'e.g.\nProbation period of 3 months\nLaptop provided on joining'}
                                        value={guidelines}
                                        onChange={(e) => setGuidelines(e.target.value)}
                                        disabled={isFinal}
                                    />
                                </div>
                                <button
                                    className="hro-btn hro-btn-primary"
                                    disabled={generating}
                                    onClick={handleGenerate}
                                >
                                    {generating ? 'Generating...' : offer ? 'Regenerate letter' : 'Generate offer letter'}
                                </button>
                                {offer && (
                                    <p className="hro-hint">
                                        Regenerating replaces the letter text below with a fresh template using these details.
                                    </p>
                                )}
                            </div>
                        )}

                        {offer && (
                            <div className="hro-card">
                                <p className="hro-card-title">Offer letter</p>
                                <textarea
                                    className="hro-letter"
                                    rows={16}
                                    value={letterBody}
                                    onChange={(e) => setLetterBody(e.target.value)}
                                    disabled={isFinal}
                                />
                                {isDraft && (
                                    <div className="hro-letter-actions">
                                        <button
                                            className="hro-btn hro-btn-secondary"
                                            disabled={savingLetter || !letterChanged}
                                            onClick={handleSaveLetter}
                                        >
                                            {savingLetter ? 'Saving...' : 'Save letter'}
                                        </button>
                                        <button
                                            className="hro-btn hro-btn-primary"
                                            disabled={sending || letterChanged}
                                            onClick={handleSend}
                                            title={letterChanged ? 'Save your letter changes first' : ''}
                                        >
                                            {sending ? 'Sending...' : 'Send offer to candidate'}
                                        </button>
                                    </div>
                                )}
                                {isFinal && (
                                    <p className="hro-hint">
                                        This offer has been sent and can no longer be edited.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <aside className="hro-sidebar">
                        <div className="hro-side-card">
                            <p className="hro-side-title">Summary</p>
                            <div className="hro-detail-row">
                                <span>Candidate</span>
                                <span>{application.candidate_name}</span>
                            </div>
                            <div className="hro-detail-row">
                                <span>Vacancy</span>
                                <span>{application.job_title}</span>
                            </div>
                            {offer?.start_date && (
                                <div className="hro-detail-row">
                                    <span>Start date</span>
                                    <span>{formatDate(offer.start_date)}</span>
                                </div>
                            )}
                            {offer?.salary && (
                                <div className="hro-detail-row">
                                    <span>Salary</span>
                                    <span>PKR {Number(offer.salary).toLocaleString()}</span>
                                </div>
                            )}
                            {offer?.sent_at && (
                                <div className="hro-detail-row">
                                    <span>Sent</span>
                                    <span>{formatDate(offer.sent_at)}</span>
                                </div>
                            )}
                            {offer?.responded_at && (
                                <div className="hro-detail-row">
                                    <span>Responded</span>
                                    <span>{formatDate(offer.responded_at)}</span>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            )}
        </div>
    );
}

export default OfferScreen;