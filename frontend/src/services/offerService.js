import { getToken } from '../utils/auth';

const API_URL = 'http://localhost:5000/api';


export const getApplicationOffer = async (applicationId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/offers/hr/applications/${applicationId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to fetch offer');
    }

    return response.json();
};

export const saveOfferDraft = async (applicationId, offerData) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/offers/hr/applications/${applicationId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(offerData)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to generate offer letter');
    }

    return response.json();
};

export const updateOfferLetter = async (offerId, letterBody) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/offers/hr/${offerId}`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ letter_body: letterBody })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to save offer letter');
    }

    return response.json();
};

export const sendOffer = async (offerId) => {
    const token = getToken();

    const response = await fetch(`${API_URL}/offers/hr/${offerId}/send`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to send offer');
    }

    return response.json();
};


export const getMyOffers = async () => {
    const response = await fetch(`${API_URL}/offers/me`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${getToken()}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to fetch offers');
    }

    return response.json();
};

const respondToOffer = async (offerId, decision, reason) => {
    const response = await fetch(`${API_URL}/offers/me/${offerId}/${decision}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: reason || '' })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Failed to ${decision} offer`);
    }

    return response.json();
};

export const acceptOffer = (offerId) => respondToOffer(offerId, 'accept');
export const declineOffer = (offerId, reason) => respondToOffer(offerId, 'decline', reason);

