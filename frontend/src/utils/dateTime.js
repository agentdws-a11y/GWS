
const parseAsLocalTime = (dateString) => {
    if (!dateString) return null;
    
    const normalized = dateString.replace('T', ' ');
    
    const parts = normalized.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!parts) return null;
    
    const [, year, month, day, hour, minute, second] = parts;
    return new Date(year, month - 1, day, hour, minute, second);
};

export const formatDateTime = (dateString) => {
    const date = parseAsLocalTime(dateString);
    if (!date) return '';
    
    const dateOptions = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    };
    
    const timeOptions = { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    };
    
    const datePart = date.toLocaleDateString('en-US', dateOptions);
    const timePart = date.toLocaleTimeString('en-US', timeOptions);
    
    return `${datePart} at ${timePart}`;
};

export const formatDate = (dateString) => {
    const date = parseAsLocalTime(dateString);
    if (!date) return '';
    
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
};

export const formatTime = (dateString) => {
    const date = parseAsLocalTime(dateString);
    if (!date) return '';
    
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    });
};

export const isUpcoming = (dateString) => {
    const date = parseAsLocalTime(dateString);
    if (!date) return false;
    return date > new Date();
};

export const isPast = (dateString) => {
    const date = parseAsLocalTime(dateString);
    if (!date) return false;
    return date < new Date();
};

export const toBackendDateTime = (datetimeLocalValue) => {
    if (!datetimeLocalValue) return '';
    return datetimeLocalValue + ':00';
};

export const toDateTimeLocal = (dateString) => {
    const date = parseAsLocalTime(dateString);
    if (!date) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const getMinDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};
