
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseLocalDateTime(value) {
    if (!value) return null;
    const match = String(value)
        .replace('T', ' ')
        .match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return null;
    const [, y, mo, d, h, mi, s] = match;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0));
}

export function formatDay(date) {
    return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatDayComma(date) {
    return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatDayLong(date) {
    return `${DAYS_LONG[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

export function formatDayWithYear(date) {
    return `${formatDay(date)} ${date.getFullYear()}`;
}

export function formatTime(date) {
    const hours24 = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const suffix = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 || 12;
    return `${hours12}:${minutes} ${suffix}`;
}

export function getInitials(name) {
    if (!name || !name.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0][0];
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
}

export function isSafeUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
}