import { getToken } from '../utils/auth';

const API_URL = 'http://localhost:5000/api/admin-invites';

export const sendAdminInvite = async (email, name) => {
    const token = getToken();
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email, name })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send invitation');
    }

    return response.json();
};

export const getAllInvites = async () => {
    const token = getToken();
    const response = await fetch(API_URL, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch invitations');
    }

    return response.json();
};

export const verifyInviteToken = async (token) => {
    const response = await fetch(`${API_URL}/verify/${token}`);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to verify invitation');
    }

    return response.json();
};

export const acceptInvite = async (token, name, password) => {
    const response = await fetch(`${API_URL}/accept`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, name, password })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to accept invitation');
    }

    return response.json();
};

export const cancelInvite = async (inviteId) => {
    const token = getToken();
    const response = await fetch(`${API_URL}/${inviteId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel invitation');
    }

    return response.json();
};
