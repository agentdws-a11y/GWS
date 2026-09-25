import { useTheme } from '../../context/ThemeContext';
import logoLight from '../../assets/logo.png';
import logoDark from '../../assets/logo-dark.png';

function Logo({ className }) {
    const { theme } = useTheme();
    const src = theme === 'dark' ? logoDark : logoLight;

    return <img src={src} alt="Hyre.AI" className={className} />;
}

export default Logo;