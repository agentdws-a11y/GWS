import { useTheme } from '../../context/ThemeContext';

function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <button
            className={`theme-switch ${isDark ? 'is-dark' : 'is-light'}`}
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        >
            <span className="theme-switch-thumb">
                {isDark ? '🌙' : '☀️'}
            </span>
        </button>
    );
}

export default ThemeToggle;