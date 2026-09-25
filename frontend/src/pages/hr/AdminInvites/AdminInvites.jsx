import { useState, useEffect } from 'react';
import { notify } from '../../../utils/notify';
import { getAllInvites, sendAdminInvite, cancelInvite } from '../../../services/adminInviteService';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import InviteModal from './InviteModal';
import './AdminInvites.css';

function AdminInvites() {
    const [invites, setInvites] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [inviteToCancel, setInviteToCancel] = useState(null);

    useEffect(() => {
        fetchInvites();
    }, []);

    const fetchInvites = async () => {
        try {
            setLoading(true);
            const data = await getAllInvites();
            setInvites(data.invites || []);
        } catch (error) {
            notify.error(error.message || 'Failed to fetch invitations');
        } finally {
            setLoading(false);
        }
    };

    const handleSendInvite = async (email, name) => {
        try {
            const result = await sendAdminInvite(email, name);
            
            if (result.emailSent) {
                notify.success(`Invitation email sent to ${email}`);
            } else {
                notify.info('Invitation created. Email not configured - check console for link');
                console.log('='.repeat(60));
                console.log('📧 EMAIL NOT CONFIGURED');
                console.log('Invite Link:', result.inviteLink);
                console.log('Share this link with:', email);
                console.log('='.repeat(60));
            }
            
            setShowInviteModal(false);
            fetchInvites();
        } catch (error) {
            throw error;
        }
    };

    const handleCancelClick = (invite) => {
        setInviteToCancel(invite);
        setShowCancelConfirm(true);
    };

    const confirmCancel = async () => {
        if (!inviteToCancel) return;

        try {
            await cancelInvite(inviteToCancel.id);
            notify.success('Invitation cancelled successfully');
            fetchInvites();
        } catch (error) {
            notify.error(error.message || 'Failed to cancel invitation');
        } finally {
            setShowCancelConfirm(false);
            setInviteToCancel(null);
        }
    };

    const cancelCancelDialog = () => {
        setShowCancelConfirm(false);
        setInviteToCancel(null);
    };

    const filteredInvites = invites.filter(invite => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            invite.email.toLowerCase().includes(query) ||
            (invite.invited_by_name && invite.invited_by_name.toLowerCase().includes(query))
        );
    });

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusClass = (status, expiresAt) => {
        if (status === 'ACCEPTED') return 'status-accepted';
        if (status === 'EXPIRED') return 'status-expired';
        
        if (status === 'PENDING') {
            const now = new Date();
            const expires = new Date(expiresAt);
            if (expires < now) return 'status-expired';
            return 'status-pending';
        }
        
        return 'status-pending';
    };

    const getStatusText = (status, expiresAt) => {
        if (status === 'ACCEPTED') return 'Accepted';
        if (status === 'EXPIRED') return 'Expired';
        
        if (status === 'PENDING') {
            const now = new Date();
            const expires = new Date(expiresAt);
            if (expires < now) return 'Expired';
            return 'Pending';
        }
        
        return status;
    };

    return (
        <div className="admin-invites-wrapper">
            <div className="admin-invites-header">
                <div className="admin-invites-title-section">
                    <h1 className="admin-invites-title">Admin Invitations</h1>
                    <p className="admin-invites-subtitle">
                        {invites.length} {invites.length === 1 ? 'invitation' : 'invitations'}
                    </p>
                </div>
                <button className="btn-send-invite" onClick={() => setShowInviteModal(true)}>
                    + Invite Admin
                </button>
            </div>

            <div className="admin-invites-search">
                <div className="search-box">
                    <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M7 12.5C10.0376 12.5 12.5 10.0376 12.5 7C12.5 3.96243 10.0376 1.5 7 1.5C3.96243 1.5 1.5 3.96243 1.5 7C1.5 10.0376 3.96243 12.5 7 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M14.5 14.5L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <input
                        type="text"
                        placeholder="Search by email or invited by"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>
            </div>

            {loading ? (
                <div className="loading-state">Loading invitations...</div>
            ) : invites.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📧</div>
                    <h3>No invitations yet</h3>
                    <p>Send your first admin invitation to expand your team</p>
                    <button className="btn-send-invite" onClick={() => setShowInviteModal(true)}>
                        Invite Admin
                    </button>
                </div>
            ) : filteredInvites.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">🔍</div>
                    <h3>No invitations found</h3>
                    <p>Try a different search query</p>
                </div>
            ) : (
                <div className="admin-invites-table-container">
                    <table className="admin-invites-table">
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Invited By</th>
                                <th>Status</th>
                                <th>Sent</th>
                                <th>Expires</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInvites.map(invite => (
                                <tr key={invite.id}>
                                    <td className="invite-email">{invite.email}</td>
                                    <td className="invite-by">{invite.invited_by_name}</td>
                                    <td>
                                        <span className={`status-badge ${getStatusClass(invite.status, invite.expires_at)}`}>
                                            {getStatusText(invite.status, invite.expires_at)}
                                        </span>
                                    </td>
                                    <td className="invite-date">{formatDate(invite.created_at)}</td>
                                    <td className="invite-expires">
                                        {invite.status === 'PENDING' ? formatDate(invite.expires_at) : '-'}
                                    </td>
                                    <td>
                                        <div className="invite-actions">
                                            {invite.status === 'PENDING' && new Date(invite.expires_at) > new Date() && (
                                                <button 
                                                    className="btn-cancel-invite"
                                                    onClick={() => handleCancelClick(invite)}
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showInviteModal && (
                <InviteModal 
                    onClose={() => setShowInviteModal(false)}
                    onSend={handleSendInvite}
                />
            )}

            <ConfirmDialog
                open={showCancelConfirm}
                title="Cancel invitation?"
                message={inviteToCancel ? `Are you sure you want to cancel the invitation for ${inviteToCancel.email}?` : ''}
                confirmLabel="Cancel Invitation"
                onConfirm={confirmCancel}
                onCancel={cancelCancelDialog}
                isDanger={true}
            />
        </div>
    );
}

export default AdminInvites;
