import { getToken } from '../utils/auth';

const API_URL = 'http://localhost:5000/api';


export const offerInterviewSlots = async (applicationId, offerData) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/interviews/hr/applications/${applicationId}/offer`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(offerData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to offer interview slots');
    }

    return response.json();
};

export const getInterviewById = async (interviewId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/interviews/hr/${interviewId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch interview');
    }

    return response.json();
};

export const getInterviews = async (filters = {}) => {
    const token = getToken();
    
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.job_id) params.append('job_id', filters.job_id);
    if (filters.round) params.append('round', filters.round);
    if (filters.from_date) params.append('from_date', filters.from_date);
    if (filters.to_date) params.append('to_date', filters.to_date);
    
    const url = `${API_URL}/interviews/hr${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch interviews');
    }

    return response.json();
};

export const getPanelMembers = async () => {
    const token = getToken();

    const response = await fetch(`${API_URL}/interviews/hr/panel-members`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch panel members');
    }

    return response.json();
};

export const cancelInterview = async (interviewId, reason) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/interviews/hr/${interviewId}/cancel`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to cancel interview');
    }

    return response.json();
};

export const withdrawOffer = async (interviewId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/interviews/hr/${interviewId}/withdraw`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to withdraw offer');
    }

    return response.json();
};


export const getCandidateInterviews = async () => {
    const token = getToken();

    const response = await fetch(`${API_URL}/interviews/me`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch interviews');
    }

    return response.json();
};



export const confirmInterviewSlot = async (interviewId, slotId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/interviews/me/${interviewId}/confirm`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ slot_id: slotId })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));

        const conflict = error.error;
        const err = new Error(conflict?.message || error.message || 'Failed to confirm interview slot');
        if (conflict?.code) err.code = conflict.code;
        throw err;
    }

    return response.json();
};


export const getFeedback = async (interviewId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/interviews/hr/${interviewId}/feedback`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to fetch feedback');
    }

    return response.json();
};

export const submitFeedback = async (interviewId, interviewerId, feedbackData) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/interviews/hr/${interviewId}/feedback/${interviewerId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(feedbackData)
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit feedback');
    }

    return response.json();
};


export const submitDecision = async (applicationId, decisionData) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/interviews/hr/applications/${applicationId}/decision`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(decisionData)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to save decision');
    }

    return response.json();
};

export const reopenApplication = async (applicationId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/applications/${applicationId}/reopen`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to reopen application');
    }

    return response.json();
};