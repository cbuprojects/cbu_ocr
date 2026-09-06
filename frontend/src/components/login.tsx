import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CbuLogo from '../assets/CBU_Logo.png';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/* ─── Types ────────────────────────────────────────────────────────────── */
type LangCode = 'en' | 'uz-latin' | 'uz-cyril' | 'ru';

interface Translation {
  bankName: string;
  systemName: string;
  systemTagline: string;
  welcomeBack: string;
  signInToContinue: string;
  username: string;
  password: string;
  usernamePlaceholder: string;
  passwordPlaceholder: string;
  signIn: string;
  signingIn: string;
  invalidCredentials: string;
  networkError: string;
  userInactive: string;
  restricted: string;
  contact: string;
  copyright: string;
  emptyFields: string;
  sessionExpired: string;
}

/* ─── Translations ─────────────────────────────────────────────────────── */
const translations: Record<LangCode, Translation> = {
  en: {
    bankName: 'Central Bank of Uzbekistan',
    systemName: 'OCR — Optical Character Recognition',
    systemTagline: 'Text extraction for CBU document files',
    welcomeBack: 'Welcome back',
    signInToContinue: 'Sign in to the OCR system',
    username: 'Username',
    password: 'Password',
    usernamePlaceholder: 'Enter your username',
    passwordPlaceholder: 'Enter your password',
    signIn: 'Sign In',
    signingIn: 'Signing in…',
    invalidCredentials: 'Invalid username or password. Please try again.',
    networkError: 'Network error. Unable to connect to the server. Please check your connection.',
    userInactive: 'Your account is inactive. Please contact IT support.',
    restricted: 'Access is restricted to authorised CBU personnel.',
    contact: 'Contact your system administrator if you need access.',
    copyright: '© 2026 Central Bank of the Republic of Uzbekistan',
    emptyFields: 'Please enter both username and password.',
    sessionExpired: 'Session expired. Please sign in again.',
  },
  'uz-latin': {
    bankName: "O'zbekiston Respublikasi Markaziy Banki",
    systemName: 'OCR — Optik belgilarni aniqlash',
    systemTagline: 'MB hujjat fayllaridan matn ajratib olish',
    welcomeBack: 'Xush kelibsiz',
    signInToContinue: 'OCR tizimiga kirish',
    username: 'Foydalanuvchi nomi',
    password: 'Parol',
    usernamePlaceholder: 'Foydalanuvchi nomingizni kiriting',
    passwordPlaceholder: 'Parolingizni kiriting',
    signIn: 'Kirish',
    signingIn: 'Kirilmoqda…',
    invalidCredentials: "Noto'g'ri foydalanuvchi nomi yoki parol. Iltimos, qaytadan urinib ko'ring.",
    networkError: 'Tarmoq xatosi. Serverga ulanish mumkin emas. Iltimos, ulanishni tekshiring.',
    userInactive: "Hisobingiz faol emas. Iltimos, IT qo'llab-quvvatlash xizmatiga murojaat qiling.",
    restricted: 'Faqat vakolatli MB xodimlari kirishi mumkin.',
    contact: "Kirish uchun tizim administratori bilan bog'laning.",
    copyright: "© 2026 O'zbekiston Respublikasi Markaziy Banki",
    emptyFields: 'Iltimos, foydalanuvchi nomi va parolni kiriting.',
    sessionExpired: 'Sessiya tugadi. Iltimos, qayta kiring.',
  },
  'uz-cyril': {
    bankName: 'Ўзбекистон Республикаси Марказий Банки',
    systemName: 'OCR — Оптик белгиларни аниқлаш',
    systemTagline: 'МБ ҳужжат файлларидан матн ажратиб олиш',
    welcomeBack: 'Хуш келибсиз',
    signInToContinue: 'OCR тизимига кириш',
    username: 'Фойдаланувчи номи',
    password: 'Парол',
    usernamePlaceholder: 'Фойдаланувчи номингизни киритинг',
    passwordPlaceholder: 'Паролингизни киритинг',
    signIn: 'Кириш',
    signingIn: 'Кирилмоқда…',
    invalidCredentials: 'Нотўғри фойдаланувчи номи ёки парол. Илтимос, қайтадан уриниб кўринг.',
    networkError: 'Тармоқ хатоси. Серверга уланиш мумкин эмас. Илтимос, уланишни текширинг.',
    userInactive: 'Ҳисобингиз фаол эмас. Илтимос, IT қўллаб-қувватлаш хизматига мурожаат қилинг.',
    restricted: 'Фақат ваколатли МБ ходимлари кириши мумкин.',
    contact: 'Кириш учун тизим администратори билан боғланинг.',
    copyright: '© 2026 Ўзбекистон Республикаси Марказий Банки',
    emptyFields: 'Илтимос, фойдаланувчи номи ва паролни киритинг.',
    sessionExpired: 'Сессия тугади. Илтимос, қайта киринг.',
  },
  ru: {
    bankName: 'Центральный Банк Республики Узбекистан',
    systemName: 'OCR — Оптическое распознавание символов',
    systemTagline: 'Извлечение текста из документов ЦБ',
    welcomeBack: 'С возвращением',
    signInToContinue: 'Войдите в систему OCR',
    username: 'Имя пользователя',
    password: 'Пароль',
    usernamePlaceholder: 'Введите имя пользователя',
    passwordPlaceholder: 'Введите пароль',
    signIn: 'Войти',
    signingIn: 'Вход…',
    invalidCredentials: 'Неверное имя пользователя или пароль. Пожалуйста, попробуйте снова.',
    networkError: 'Ошибка сети. Невозможно подключиться к серверу. Пожалуйста, проверьте соединение.',
    userInactive: 'Ваш аккаунт неактивен. Пожалуйста, обратитесь в службу поддержки IT.',
    restricted: 'Доступ разрешён только авторизованным сотрудникам ЦБ.',
    contact: 'Обратитесь к системному администратору для получения доступа.',
    copyright: '© 2026 Центральный Банк Республики Узбекистан',
    emptyFields: 'Пожалуйста, введите имя пользователя и пароль.',
    sessionExpired: 'Сессия истекла. Пожалуйста, войдите снова.',
  },
};

const LANG_STORAGE_KEY = 'ui_lang';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();

  const [language, setLanguage] = useState<LangCode>(
    () => (localStorage.getItem(LANG_STORAGE_KEY) as LangCode) || 'uz-latin'
  );
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [toast, setToast] = useState<string | null>(null);

  const t = translations[language];

  const languages: { code: LangCode; label: string; full: string }[] = [
    { code: 'en', label: 'EN', full: 'English' },
    { code: 'uz-latin', label: "O'zb", full: "O'zbek (Lotin)" },
    { code: 'uz-cyril', label: 'Ўзб', full: 'Ўзбек (Кирил)' },
    { code: 'ru', label: 'РУ', full: 'Русский' },
  ];

  const changeLanguage = (code: LangCode) => {
    setLanguage(code);
    localStorage.setItem(LANG_STORAGE_KEY, code);
  };

  /* ── Redirect if already signed in ── */
  useEffect(() => {
    if (localStorage.getItem('session_id')) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  /* ── Reset body margins, load fonts, responsive helper ── */
  useEffect(() => {
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';

    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const fontLink = document.createElement('link');
    fontLink.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.documentElement.style.margin = '';
      document.documentElement.style.padding = '';
      document.documentElement.style.height = '';
      document.body.style.height = '';
    };
  }, []);

  /* ── "Session expired" toast, shown in the currently selected language ── */
  useEffect(() => {
    if (!sessionStorage.getItem('session_expired')) return;

    sessionStorage.removeItem('session_expired');
    setToast(translations[language].sessionExpired);

    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Login submit ── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError(t.emptyFields);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = String(data.detail ?? data.message ?? '').toLowerCase();
        if (detail.includes('inactive') || detail.includes('disabled') || detail.includes('active')) {
          setError(t.userInactive);
        } else {
          setError(t.invalidCredentials);
        }
        return;
      }

      localStorage.setItem('session_id', data.session_id);
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Login error:', err);
      setError(t.networkError);
    } finally {
      setLoading(false);
    }
  };

  /* ────────────────────────────── Render ────────────────────────────── */
  return (
    <div
      style={{
        minHeight: '100vh',
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 50%, #f1f5f9 100%)',
        fontFamily: '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        margin: 0,
        padding: 0,
      }}
    >
      {toast && (
        <div
          role="status"
          style={{
            position: 'fixed',
            top: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#1e293b',
            color: 'white',
            padding: '12px 18px',
            borderRadius: '10px',
            zIndex: 9999,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          {toast}
        </div>
      )}

      {/* ── Floating orbs ── */}
      <div
        style={{
          position: 'absolute',
          width: '800px',
          height: '800px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(233,183,65,0.08) 0%, rgba(233,183,65,0.02) 50%, transparent 70%)',
          top: '-400px',
          right: '-200px',
          pointerEvents: 'none',
          animation: 'float 20s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '600px',
          height: '600px',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(10,59,92,0.06) 0%, rgba(10,59,92,0.01) 60%, transparent 80%)',
          bottom: '-300px',
          left: '-150px',
          pointerEvents: 'none',
          animation: 'float 25s ease-in-out infinite reverse',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '400px',
          height: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(233,183,65,0.05) 0%, transparent 70%)',
          top: '50%',
          left: '20%',
          pointerEvents: 'none',
          animation: 'float 18s ease-in-out infinite 2s',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(10,59,92,0.04) 0%, transparent 70%)',
          bottom: '20%',
          right: '15%',
          pointerEvents: 'none',
          animation: 'float 22s ease-in-out infinite 1s',
        }}
      />

      {/* ── Animated wave at the bottom ── */}
      <svg
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '200px',
          pointerEvents: 'none',
          zIndex: 1,
        }}
        preserveAspectRatio="none"
        viewBox="0 0 1440 320"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'rgba(10,59,92,0.15)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'rgba(10,59,92,0.05)', stopOpacity: 1 }} />
          </linearGradient>
        </defs>

        {/* Wave 1 — slow and large */}
        <path
          fill="url(#waveGradient)"
          fillOpacity="0.7"
          d="M0,256L48,245.3C96,235,192,213,288,208C384,203,480,219,576,229.3C672,240,768,245,864,234.7C960,224,1056,197,1152,192C1248,187,1344,203,1392,213.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        >
          <animate
            attributeName="d"
            dur="8s"
            repeatCount="indefinite"
            values="
              M0,256L48,245.3C96,235,192,213,288,208C384,203,480,219,576,229.3C672,240,768,245,864,234.7C960,224,1056,197,1152,192C1248,187,1344,203,1392,213.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z;

              M0,224L48,234.7C96,245,192,267,288,272C384,277,480,267,576,250.7C672,235,768,213,864,213.3C960,213,1056,224,1152,234.7C1248,245,1344,256,1392,261.3L1440,267L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z;

              M0,256L48,245.3C96,235,192,213,288,208C384,203,480,219,576,229.3C672,240,768,245,864,234.7C960,224,1056,197,1152,192C1248,187,1344,203,1392,213.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z
            "
          />
        </path>

        {/* Wave 2 — faster and smaller */}
        <path
          fill="rgba(10,59,92,0.12)"
          fillOpacity="0.6"
          d="M0,192L48,197.3C96,203,192,213,288,208C384,203,480,181,576,176C672,171,768,181,864,197.3C960,213,1056,235,1152,234.7C1248,235,1344,213,1392,202.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        >
          <animate
            attributeName="d"
            dur="5s"
            repeatCount="indefinite"
            values="
              M0,192L48,197.3C96,203,192,213,288,208C384,203,480,181,576,176C672,171,768,181,864,197.3C960,213,1056,235,1152,234.7C1248,235,1344,213,1392,202.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z;

              M0,224L48,213.3C96,203,192,181,288,176C384,171,480,181,576,197.3C672,213,768,235,864,234.7C960,235,1056,213,1152,202.7C1248,192,1344,192,1392,197.3L1440,203L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z;

              M0,192L48,197.3C96,203,192,213,288,208C384,203,480,181,576,176C672,171,768,181,864,197.3C960,213,1056,235,1152,234.7C1248,235,1344,213,1392,202.7L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z
            "
          />
        </path>

        {/* Wave 3 — subtle gold accent ripple */}
        <path
          fill="rgba(233,183,65,0.08)"
          fillOpacity="0.5"
          d="M0,288L48,277.3C96,267,192,245,288,240C384,235,480,245,576,250.7C672,256,768,256,864,250.7C960,245,1056,235,1152,234.7C1248,235,1344,245,1392,250.7L1440,256L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
        >
          <animate
            attributeName="d"
            dur="3.5s"
            repeatCount="indefinite"
            values="
              M0,288L48,277.3C96,267,192,245,288,240C384,235,480,245,576,250.7C672,256,768,256,864,250.7C960,245,1056,235,1152,234.7C1248,235,1344,245,1392,250.7L1440,256L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z;

              M0,256L48,266.7C96,277,192,299,288,304C384,309,480,299,576,282.7C672,267,768,245,864,245.3C960,245,1056,256,1152,266.7C1248,277,1344,288,1392,293.3L1440,299L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z;

              M0,288L48,277.3C96,267,192,245,288,240C384,235,480,245,576,250.7C672,256,768,256,864,250.7C960,245,1056,235,1152,234.7C1248,235,1344,245,1392,250.7L1440,256L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z
            "
          />
        </path>
      </svg>

      {/* ── Subtle grid texture ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(10,59,92,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(10,59,92,0.02) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }}
      />

      {/* ── Top brand strip ── */}
      <header
        style={{
          width: '100%',
          padding: isMobile ? '14px 24px' : '16px 48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(233,183,65,0.2)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
          boxSizing: 'border-box',
          zIndex: 2,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: isMobile ? '44px' : '52px',
              height: isMobile ? '44px' : '52px',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '5px',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(10,59,92,0.1)',
              border: '1px solid rgba(233,183,65,0.2)',
            }}
          >
            <img
              src={CbuLogo}
              alt="CBU Logo"
              style={{ width: '140%', height: '140%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div
              style={{
                color: '#0a3b5c',
                fontWeight: 700,
                fontSize: isMobile ? '15px' : '18px',
                lineHeight: '1.2',
                letterSpacing: '-0.2px',
              }}
            >
              {t.bankName}
            </div>
            <div style={{ color: '#e9b741', fontSize: '14px', marginTop: '2px', fontWeight: 500 }}>
              {t.systemName}
            </div>
          </div>
        </div>

        {/* Language switcher */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '12px',
            padding: '4px',
            border: '1px solid rgba(233,183,65,0.3)',
            gap: '2px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
          }}
        >
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              title={lang.full}
              style={{
                padding: isMobile ? '6px 10px' : '7px 13px',
                fontSize: isMobile ? '11px' : '12px',
                fontWeight: language === lang.code ? 600 : 500,
                border: 'none',
                borderRadius: '9px',
                backgroundColor: language === lang.code ? '#0a3b5c' : 'transparent',
                color: language === lang.code ? 'white' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                fontFamily: '"Inter", sans-serif',
                letterSpacing: '0.02em',
                minWidth: isMobile ? '36px' : '42px',
              }}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main centred card ── */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: isMobile ? '32px 16px' : '48px 24px',
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0',
          }}
        >
          {/* Gold accent bar */}
          <div
            style={{
              height: '5px',
              background: 'linear-gradient(90deg, #e9b741 0%, #f5d078 50%, #e9b741 100%)',
              borderRadius: '5px 5px 0 0',
              boxShadow: '0 2px 8px rgba(233,183,65,0.2)',
            }}
          />

          {/* Card body */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(10px)',
              borderRadius: '0 0 24px 24px',
              padding: isMobile ? '36px 24px 40px' : '44px 44px 48px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.02)',
              border: '1px solid rgba(233,183,65,0.15)',
              borderTop: 'none',
            }}
          >
            {/* Icon + heading */}
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div
                style={{
                  position: 'relative',
                  width: '64px',
                  height: '64px',
                  background: 'linear-gradient(135deg, #0a3b5c 0%, #1a4b70 100%)',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  boxShadow: '0 12px 24px rgba(10,59,92,0.2)',
                  border: '1px solid rgba(233,183,65,0.3)',
                  overflow: 'hidden',
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '32px', color: '#e9b741' }}
                >
                  document_scanner
                </span>
                {/* Scan line — a single quiet nod to what this system does */}
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '10%',
                    width: '80%',
                    height: '2px',
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(233,183,65,0.9) 50%, transparent 100%)',
                    animation: 'scan 3.2s ease-in-out infinite',
                  }}
                />
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '28px',
                  fontWeight: 700,
                  color: '#0a3b5c',
                  letterSpacing: '-0.5px',
                }}
              >
                {t.welcomeBack}
              </h1>
              <p style={{ margin: '10px 0 0', fontSize: '14px', color: '#64748b', fontWeight: 400 }}>
                {t.signInToContinue}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8', fontWeight: 400 }}>
                {t.systemTagline}
              </p>
            </div>

            {/* Form */}
            <form
              onSubmit={handleLogin}
              style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}
            >
              {/* Username */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label
                  htmlFor="username"
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#334155',
                    letterSpacing: '0.3px',
                  }}
                >
                  {t.username}
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    className="material-symbols-outlined"
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '20px',
                      color: '#94a3b8',
                      pointerEvents: 'none',
                    }}
                  >
                    person
                  </span>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t.usernamePlaceholder}
                    autoComplete="username"
                    style={{
                      width: '100%',
                      padding: '13px 16px 13px 44px',
                      fontSize: '14px',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '12px',
                      outline: 'none',
                      background: '#ffffff',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      fontFamily: '"Inter", sans-serif',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#e9b741';
                      e.target.style.boxShadow = '0 0 0 4px rgba(233,183,65,0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label
                  htmlFor="password"
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#334155',
                    letterSpacing: '0.3px',
                  }}
                >
                  {t.password}
                </label>
                <div style={{ position: 'relative' }}>
                  <span
                    className="material-symbols-outlined"
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '20px',
                      color: '#94a3b8',
                      pointerEvents: 'none',
                    }}
                  >
                    key
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    autoComplete="current-password"
                    style={{
                      width: '100%',
                      padding: '13px 48px 13px 44px',
                      fontSize: '14px',
                      border: '1.5px solid #e2e8f0',
                      borderRadius: '12px',
                      outline: 'none',
                      background: '#ffffff',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      transition: 'all 0.2s',
                      fontFamily: '"Inter", sans-serif',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#e9b741';
                      e.target.style.boxShadow = '0 0 0 4px rgba(233,183,65,0.1)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e2e8f0';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '8px',
                      transition: 'color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#e9b741')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Error banner */}
              {error && (
                <div
                  role="alert"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '12px',
                    color: '#dc2626',
                    fontSize: '13px',
                    animation: 'fadeIn 0.3s ease',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '18px', flexShrink: 0 }}
                  >
                    error
                  </span>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loading ? '#cbd5e1' : 'linear-gradient(135deg, #0a3b5c 0%, #1a5080 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '15px',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: loading ? 'none' : '0 6px 20px rgba(10,59,92,0.25)',
                  letterSpacing: '0.3px',
                  marginTop: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(10,59,92,0.35)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  if (!loading) {
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(10,59,92,0.25)';
                  }
                }}
              >
                {loading ? (
                  <>
                    <span
                      style={{
                        width: '18px',
                        height: '18px',
                        border: '2.5px solid rgba(255,255,255,0.3)',
                        borderTopColor: 'white',
                        borderRadius: '50%',
                        animation: 'spin 0.7s linear infinite',
                        flexShrink: 0,
                      }}
                    />
                    {t.signingIn}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                      login
                    </span>
                    {t.signIn}
                  </>
                )}
              </button>
            </form>

            {/* Access note */}
            <p
              style={{
                marginTop: '28px',
                textAlign: 'center',
                fontSize: '12px',
                color: '#94a3b8',
                fontWeight: 600,
                lineHeight: '1.6',
              }}
            >
              {t.restricted}
              <br />
              {t.contact}
            </p>
          </div>

          {/* Below-card note */}
          <p
            style={{
              textAlign: 'center',
              fontSize: '12px',
              color: '#94a3b8',
              marginTop: '24px',
              opacity: 0.7,
            }}
          >
            {t.copyright}
          </p>
        </div>
      </main>

      {/* Animations and global styles */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33%      { transform: translate(30px, -30px) rotate(120deg); }
          66%      { transform: translate(-20px, 20px) rotate(240deg); }
        }
        @keyframes scan {
          0%, 100% { top: 18%; opacity: 0; }
          15%      { opacity: 1; }
          85%      { opacity: 1; }
          50%      { top: 78%; }
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #root {
          width: 100%;
          height: 100%;
          margin: 0;
          padding: 0;
        }
        body { overflow-x: hidden; }
        .material-symbols-outlined {
          font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        button:focus-visible, input:focus-visible {
          outline: 2px solid #e9b741;
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};

export default LoginPage;