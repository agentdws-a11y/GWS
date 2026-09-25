import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    motion,
    MotionConfig,
    AnimatePresence,
    animate,
    useInView,
    useMotionValue,
    useMotionValueEvent,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform
} from 'framer-motion';
import {
    IconArrowRight,
    IconCalendarEvent,
    IconChartBar,
    IconCheck,
    IconFileText,
    IconSearch,
    IconSparkles
} from '@tabler/icons-react';
import Logo from '../../components/common/Logo';
import ThemeToggle from '../../components/common/ThemeToggle';
import './Landing.css';

const EASE = [0.2, 0.8, 0.2, 1];

const HEADLINE = [
    [{ t: 'Find' }, { t: 'your' }, { t: 'next', g: true }, { t: 'role.', g: true }],
    [{ t: 'Apply' }, { t: 'with' }, { t: 'confidence.' }]
];

const TRACKER_STAGES = [
    { key: 'applied', label: 'Applied', hint: 'CV received and screened' },
    { key: 'shortlisted', label: 'Shortlisted', hint: 'HR picked your profile' },
    { key: 'interview', label: 'Interview', hint: 'You choose a time that suits you' },
    { key: 'offer', label: 'Offer', hint: 'Decision shared with you' }
];

const STEPS = [
    'Browse detailed, real job listings',
    'Apply with your CV and a short note',
    'Track your status from Applied to Offered'
];

const FEATURES = [
    {
        icon: IconSearch,
        tint: '#8f82f8',
        title: 'Real Job Details',
        text: 'See employment type, work mode, salary range, experience level, and deadlines upfront — not buried in a PDF.'
    },
    {
        icon: IconFileText,
        tint: '#5eb0ff',
        title: 'Simple Applications',
        text: 'Upload your CV, add a short note to HR, your expected salary and availability — done in one form.'
    },
    {
        icon: IconChartBar,
        tint: '#2dd4bf',
        title: 'Live Status Tracking',
        text: 'Know exactly where you stand — Applied, Screening, Interview, Offered — updated as HR reviews you.'
    },
    {
        icon: IconSparkles,
        tint: '#f472b6',
        title: 'AI Job Matching',
        text: 'Get matched to roles that actually fit your skills and experience, ranked by relevance.'
    }
];

const stagger = (gap = 0.12, delay = 0) => ({
    hidden: {},
    show: { transition: { staggerChildren: gap, delayChildren: delay } }
});

const fadeUp = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } }
};

const wordVariant = {
    hidden: { opacity: 0, y: 26, filter: 'blur(8px)' },
    show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.65, ease: EASE } }
};

function CountUp({ to, duration = 1.6 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    const reduce = useReducedMotion();
    const [value, setValue] = useState(reduce ? to : 0);

    useEffect(() => {
        if (!inView || reduce) return undefined;
        const controls = animate(0, to, {
            duration,
            ease: 'easeOut',
            onUpdate: (v) => setValue(Math.round(v))
        });
        return () => controls.stop();
    }, [inView, to, duration, reduce]);

    return <span ref={ref}>{value}</span>;
}

function HeroTracker() {
    const reduce = useReducedMotion();
    const [step, setStep] = useState(reduce ? 4 : 0);

    useEffect(() => {
        if (reduce) {
            setStep(4);
            return undefined;
        }
        const id = setInterval(() => setStep((s) => (s + 1) % 6), 1600);
        return () => clearInterval(id);
    }, [reduce]);

    const active = Math.min(step, 3);
    const finished = step >= 4;

    return (
        <div className="lp-tracker-wrap">
            <div className="lp-tracker">
                <div className="lp-tracker-head">
                    <div>
                        <p className="lp-tracker-kicker">Your application</p>
                        <p className="lp-tracker-title">Senior React Developer</p>
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={active}
                            className={`lp-stage-badge lp-stage-${active}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.2 }}
                        >
                            {TRACKER_STAGES[active].label}
                        </motion.span>
                    </AnimatePresence>
                </div>

                <ul className="lp-stages">
                    <li className="lp-stages-line" aria-hidden="true">
                        <motion.span
                            className="lp-stages-fill"
                            animate={{ height: `${(active / 3) * 100}%` }}
                            transition={{ duration: 0.6, ease: EASE }}
                        />
                    </li>
                    {TRACKER_STAGES.map((s, i) => {
                        const done = i < active || (finished && i === 3);
                        const current = i === active && !finished;
                        return (
                            <li
                                key={s.key}
                                className={`lp-stage ${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}
                            >
                                <motion.span
                                    className="lp-node"
                                    animate={{ scale: current ? 1.12 : 1 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                                >
                                    {done ? <IconCheck size={16} stroke={2.6} /> : <span className="lp-node-dot" />}
                                </motion.span>
                                <div className="lp-stage-text">
                                    <span className="lp-stage-label">{s.label}</span>
                                    <span className="lp-stage-hint">{s.hint}</span>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <motion.div
                className="lp-chip lp-chip-match"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
                <IconSparkles size={16} stroke={2} />
                <span>
                    <CountUp to={92} />% AI match
                </span>
            </motion.div>

            <AnimatePresence>
                {active >= 2 && (
                    <motion.div
                        className="lp-chip lp-chip-event"
                        initial={{ opacity: 0, y: 16, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.35, ease: EASE }}
                    >
                        <IconCalendarEvent size={16} stroke={2} />
                        <span>Interview time confirmed</span>
                    </motion.div>
                )}
            </AnimatePresence>

            <p className="lp-tracker-note">Sample application</p>
        </div>
    );
}

function HeroVisual() {
    const reduce = useReducedMotion();
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [6, -6]), { stiffness: 140, damping: 18 });
    const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 140, damping: 18 });

    const handleMove = (e) => {
        if (reduce) return;
        const rect = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - rect.left) / rect.width - 0.5);
        my.set((e.clientY - rect.top) / rect.height - 0.5);
    };

    const handleLeave = () => {
        mx.set(0);
        my.set(0);
    };

    return (
        <motion.div
            className="lp-hero-visual"
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.85, ease: EASE }}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
        >
            <motion.div style={{ rotateX, rotateY, transformPerspective: 900 }}>
                <HeroTracker />
            </motion.div>
        </motion.div>
    );
}

const handleSpotlight = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
};

const scrollToId = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

function Landing() {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);

    const { scrollY, scrollYProgress } = useScroll();
    const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, restDelta: 0.001 });
    const orbOneY = useTransform(scrollY, [0, 1400], [0, -170]);
    const orbTwoY = useTransform(scrollY, [0, 1400], [0, 150]);

    useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 24));

    return (
        <MotionConfig reducedMotion="user">
            <div className="lp-page">
                <motion.div className="lp-progress" style={{ scaleX: progress }} />

                <div className="lp-bg" aria-hidden="true">
                    <div className="lp-bg-grid" />
                    <motion.div className="lp-orb-wrap lp-orb-wrap-1" style={{ y: orbOneY }}>
                        <div className="lp-orb lp-orb-1" />
                    </motion.div>
                    <motion.div className="lp-orb-wrap lp-orb-wrap-2" style={{ y: orbTwoY }}>
                        <div className="lp-orb lp-orb-2" />
                    </motion.div>
                </div>

                <motion.nav
                    className={`lp-nav ${scrolled ? 'lp-nav-scrolled' : ''}`}
                    initial={{ y: -24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.6, ease: EASE }}
                >
                    <div className="lp-nav-inner">
                        <div className="lp-brand">
                            <Logo className="lp-logo" />
                        </div>
                        <div className="lp-nav-actions">
                            <ThemeToggle />
                            <button className="lp-nav-link" onClick={() => navigate('/login')}>
                                Sign In
                            </button>
                            <motion.button
                                className="lp-btn lp-btn-primary lp-btn-sm"
                                onClick={() => navigate('/register')}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                Get Started
                            </motion.button>
                        </div>
                    </div>
                </motion.nav>

                <header className="lp-hero">
                    <div className="lp-hero-copy">
                        <motion.span
                            className="lp-badge"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            ✦ For Job Seekers
                        </motion.span>

                        <motion.h1 className="lp-h1" variants={stagger(0.07, 0.15)} initial="hidden" animate="show">
                            {HEADLINE.map((line, li) => (
                                <span className="lp-line" key={li}>
                                    {line.map((w, wi) => (
                                        <motion.span
                                            key={wi}
                                            className={`lp-word ${w.g ? 'lp-grad-text' : ''}`}
                                            variants={wordVariant}
                                        >
                                            {w.t}
                                        </motion.span>
                                    ))}
                                </span>
                            ))}
                        </motion.h1>

                        <motion.p
                            className="lp-hero-sub"
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.55, duration: 0.6, ease: EASE }}
                        >
                            Browse detailed job listings, apply in minutes with your CV
                            and a few key details, and track exactly where your
                            application stands — no more wondering if anyone saw it.
                        </motion.p>

                        <motion.div
                            className="lp-hero-actions"
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.68, duration: 0.6, ease: EASE }}
                        >
                            <motion.button
                                className="lp-btn lp-btn-primary"
                                onClick={() => navigate('/register')}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                Create Your Account
                                <IconArrowRight size={18} stroke={2.2} />
                            </motion.button>
                            <motion.button
                                className="lp-btn lp-btn-ghost"
                                onClick={() => navigate('/login')}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                Sign In
                            </motion.button>
                        </motion.div>
                    </div>

                    <HeroVisual />
                </header>

                <section className="lp-steps" id="how-it-works">
                    <motion.h2
                        className="lp-h2"
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease: EASE }}
                    >
                        How it works
                    </motion.h2>

                    <motion.div
                        className="lp-steps-grid"
                        variants={stagger(0.2, 0.1)}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: '-80px' }}
                    >
                        <motion.span
                            className="lp-steps-line"
                            aria-hidden="true"
                            variants={{
                                hidden: { scaleX: 0 },
                                show: { scaleX: 1, transition: { duration: 1.2, ease: EASE } }
                            }}
                        />
                        {STEPS.map((text, i) => (
                            <motion.div className="lp-step" key={text} variants={fadeUp}>
                                <span className="lp-step-num">{i + 1}</span>
                                <p>{text}</p>
                            </motion.div>
                        ))}
                    </motion.div>
                </section>

                <section className="lp-features" id="features">
                    <motion.h2
                        className="lp-h2"
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-80px' }}
                        transition={{ duration: 0.6, ease: EASE }}
                    >
                        Job hunting, without the guesswork
                    </motion.h2>

                    <motion.div
                        className="lp-features-grid"
                        variants={stagger(0.12)}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true, margin: '-80px' }}
                    >
                        {FEATURES.map((f) => {
                            const Icon = f.icon;
                            return (
                                <motion.article
                                    key={f.title}
                                    className="lp-feature"
                                    style={{ '--lp-tint': f.tint }}
                                    variants={fadeUp}
                                    whileHover={{ y: -6 }}
                                    onMouseMove={handleSpotlight}
                                >
                                    <span className="lp-feature-icon">
                                        <Icon size={24} stroke={1.8} />
                                    </span>
                                    <h3>{f.title}</h3>
                                    <p>{f.text}</p>
                                </motion.article>
                            );
                        })}
                    </motion.div>
                </section>

                <motion.section
                    className="lp-cta"
                    initial={{ opacity: 0, y: 40, scale: 0.97 }}
                    whileInView={{ opacity: 1, y: 0, scale: 1 }}
                    viewport={{ once: true, margin: '-60px' }}
                    transition={{ duration: 0.7, ease: EASE }}
                >
                    <div className="lp-cta-inner">
                        <div className="lp-cta-glow" />
                        <h2>Ready to start applying?</h2>
                        <p>Create your account and apply to your first role today.</p>
                        <motion.button
                            className="lp-btn lp-btn-primary"
                            onClick={() => navigate('/register')}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.97 }}
                        >
                            Create Free Account
                            <IconArrowRight size={18} stroke={2.2} />
                        </motion.button>
                    </div>
                </motion.section>

                <footer className="lp-footer">
                    <div className="lp-footer-main">
                        <div className="lp-footer-brand">
                            <div className="lp-brand">
                                <Logo className="lp-logo-footer" />
                            </div>
                            <p className="lp-footer-tagline">
                                Job hunting, without the guesswork. Apply, track, get hired.
                            </p>
                        </div>

                        <div className="lp-footer-col">
                            <h4>Explore</h4>
                            <a href="#how-it-works" onClick={scrollToId('how-it-works')}>How It Works</a>
                            <a href="#features" onClick={scrollToId('features')}>Features</a>
                        </div>

                        <div className="lp-footer-col">
                            <h4>Get Started</h4>
                            <button onClick={() => navigate('/register')}>Create Account</button>
                            <button onClick={() => navigate('/login')}>Sign In</button>
                        </div>
                    </div>

                    <div className="lp-footer-bottom">
                        <p>© {new Date().getFullYear()} Hyre.AI. All rights reserved.</p>
                    </div>
                </footer>
            </div>
        </MotionConfig>
    );
}

export default Landing;