import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CbuLogo   from '../assets/CBU_Logo.png';
import facebook  from '../assets/facebook.png';
import telegram  from '../assets/telegram.png';
import linkedin  from '../assets/linkedin.png';
import twitter   from '../assets/twitter.png';
import instagram from '../assets/instagram.png';
import youtube   from '../assets/youtube.png';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const authHeader = () => `Bearer ${localStorage.getItem('session_id') ?? ''}`;

let isLoggingOut = false;
const doLogout = async () => {
  if (isLoggingOut) return;
  isLoggingOut = true;
  try {
    const sid = localStorage.getItem('session_id');
    if (sid) {
      await fetch(`${API_BASE_URL}/api/logout`, {
        method: 'POST',
        headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
  } finally {
    localStorage.removeItem('session_id');
    isLoggingOut = false;
    window.location.href = '/login';
  }
};

const killSession = () => {
  localStorage.removeItem('session_id');
  sessionStorage.setItem('session_expired', '1');
  window.location.replace('/login');
};

const apiFetch = async (url: string, options: RequestInit = {}) => {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    killSession();
    return new Promise<Response>(() => {});
  }
  return res;
};

const GOLD = '#e9b741';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation
// ─────────────────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    key: 'ocr',
    icon: 'document_scanner',
    mainPath: '/',              mainLabelKey: 'navUpload' as const,
    uploadsPath: '/my_uploads', uploadsLabelKey: 'navMyUploads' as const,
    uploadsIcon: 'history',
  },
] as const;

const ADMIN_LINKS = [
  { icon: 'inbox',          labelKey: 'navInternalAll' as const, route: '/internal_uploads',  color: '#0d9488', bg: '#f0fdfa' },
  { icon: 'api',            labelKey: 'navExternalAll' as const, route: '/external_requests', color: '#0369a1', bg: '#f0f9ff' },
  { icon: 'monitor_heart',  labelKey: 'navOcrStatus'   as const, route: '/ocr_status',        color: '#c2410c', bg: '#fff7ed' },
  { icon: 'group',          labelKey: 'usersBtn'       as const, route: '/users_data',        color: '#3b82f6', bg: '#eff6ff' },
  { icon: 'manage_history', labelKey: 'sessionsBtn'    as const, route: '/user_sessions',     color: '#8b5cf6', bg: '#f5f3ff' },
  { icon: 'timeline',       labelKey: 'actionsBtn'     as const, route: '/user_actions',      color: '#f59e0b', bg: '#fffbeb' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Upload rules — mirror the backend exactly
// ─────────────────────────────────────────────────────────────────────────────
const ALLOWED_EXT = ['.docx', '.pdf', '.png', '.jpg', '.jpeg'];
const ACCEPT_ATTR = '.docx,.pdf,.png,.jpg,.jpeg';
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    bankName: 'Central Bank of Uzbekistan',
    deptSubtitle: 'Optical Character Recognition Service',
    appName: 'OCR',
    navUpload: 'Extract Text',
    navMyUploads: 'My Extractions',
    navInternalAll: 'All Internal Jobs',
    navExternalAll: 'External API Jobs',
    navOcrStatus: 'Engine Status',
    usersBtn: 'Users',
    sessionsBtn: 'Sessions',
    actionsBtn: 'Actions',
    administration: 'Administration',
    signOut: 'Sign Out',

    pageTitle: 'Extract text from a document',
    pageDesc: 'Word files and PDFs with a text layer go to Docling. Scans, photographs and image-only PDFs go to PaddleOCR.',

    dropTitle: 'Drop a file here, or choose one',
    dropHint: 'DOCX, PDF, PNG, JPG or JPEG — up to 25 MB',
    chooseFile: 'Choose file',
    removeFile: 'Remove',
    extract: 'Extract text',
    extracting: 'Extracting',
    extractingHint: 'Large scans take longer — roughly 30 seconds per page',
    newFile: 'Extract another',

    resultTitle: 'Extracted text',
    resultCached: 'Processed before — showing the stored result',
    copyText: 'Copy text',
    copied: 'Text copied.',
    downloadText: 'Download .txt',
    noText: 'The extractor returned no text for this file.',

    fFilename: 'Stored name',
    fExtension: 'Extension',
    fMime: 'Content type',
    fSize: 'File size',
    fPages: 'Pages',
    fLanguage: 'Detected language',
    fStatus: 'Status',
    fChars: 'Characters',
    fDuration: 'Duration',
    fPerPage: 'Per page',
    fCreated: 'Started',
    fFinished: 'Finished',

    stSuccess: 'Success',
    stFailed: 'Failed',
    stTimeout: 'Timed out',
    stProcessing: 'Processing',
    stInterrupted: 'Interrupted',

    errNoFile: 'Choose a file first.',
    errExt: 'That file type is not supported. Use DOCX, PDF, PNG, JPG or JPEG.',
    errSize: 'That file is larger than 25 MB.',
    errEmpty: 'That file is empty.',
    errMismatch: 'The file contents do not match its extension.',
    errTimeout: 'Extraction timed out. Try a smaller file or fewer pages.',
    errFailed: 'Extraction failed. The file may be corrupt or unreadable.',
    errNoTextServer: 'The extractor produced no text from this file.',
    errNetwork: 'Cannot reach the server. Check your connection.',
    errServer: 'Server error. Try again.',

    langConfirmTitle: 'Change Language',
    langConfirmMsg: (lang: string) => `Switch the interface language to ${lang}?`,
    confirm: 'Yes, change',
    cancel: 'Cancel',
    sessionExpired: 'Session expired. Please log in again.',

    officialDesc: 'OCR — Text extraction service for Central Bank document files',
    aboutCbu: 'About CBU',
    executiveB: 'The Executive Board',
    legislation: 'Legislation',
    publications: 'Publications',
    dataStats: 'Data & Stats',
    services: 'Services',
    exchangeR: 'Exchange Rates',
    policyR: 'Policy Rate',
    paymentS: 'Payment Systems',
    licensing: 'Licensing',
    pressCenter: 'Press Centre',
    contact: 'Contact',
    addressS: 'Islam Karimov St. 6',
    copyright: '© 2026 Central Bank of the Republic of Uzbekistan. All rights reserved.',
    privacyPolicy: 'Privacy Policy',
    termsOfUse: 'Terms of Use',
  },

  ru: {
    bankName: 'Центральный Банк Республики Узбекистан',
    deptSubtitle: 'Служба оптического распознавания символов',
    appName: 'OCR',
    navUpload: 'Извлечь текст',
    navMyUploads: 'Мои извлечения',
    navInternalAll: 'Все внутренние задания',
    navExternalAll: 'Задания внешнего API',
    navOcrStatus: 'Состояние движков',
    usersBtn: 'Пользователи',
    sessionsBtn: 'Сессии',
    actionsBtn: 'Действия',
    administration: 'Администрирование',
    signOut: 'Выйти',

    pageTitle: 'Извлечение текста из документа',
    pageDesc: 'Файлы Word и PDF с текстовым слоем обрабатывает Docling. Сканы, фотографии и PDF из изображений — PaddleOCR.',

    dropTitle: 'Перетащите файл сюда или выберите его',
    dropHint: 'DOCX, PDF, PNG, JPG или JPEG — до 25 МБ',
    chooseFile: 'Выбрать файл',
    removeFile: 'Убрать',
    extract: 'Извлечь текст',
    extracting: 'Извлечение',
    extractingHint: 'Большие сканы обрабатываются дольше — около 30 секунд на страницу',
    newFile: 'Извлечь ещё',

    resultTitle: 'Извлечённый текст',
    resultCached: 'Уже обрабатывался — показан сохранённый результат',
    copyText: 'Копировать текст',
    copied: 'Текст скопирован.',
    downloadText: 'Скачать .txt',
    noText: 'Для этого файла текст не получен.',

    fFilename: 'Имя в системе',
    fExtension: 'Расширение',
    fMime: 'Тип содержимого',
    fSize: 'Размер файла',
    fPages: 'Страниц',
    fLanguage: 'Определённый язык',
    fStatus: 'Статус',
    fChars: 'Символов',
    fDuration: 'Длительность',
    fPerPage: 'На страницу',
    fCreated: 'Начато',
    fFinished: 'Завершено',

    stSuccess: 'Успешно',
    stFailed: 'Ошибка',
    stTimeout: 'Тайм-аут',
    stProcessing: 'Обработка',
    stInterrupted: 'Прервано',

    errNoFile: 'Сначала выберите файл.',
    errExt: 'Такой тип файла не поддерживается. Используйте DOCX, PDF, PNG, JPG или JPEG.',
    errSize: 'Файл больше 25 МБ.',
    errEmpty: 'Файл пустой.',
    errMismatch: 'Содержимое файла не соответствует его расширению.',
    errTimeout: 'Время извлечения истекло. Попробуйте файл меньше или с меньшим числом страниц.',
    errFailed: 'Извлечение не удалось. Файл может быть повреждён или нечитаем.',
    errNoTextServer: 'Извлечение не дало текста для этого файла.',
    errNetwork: 'Сервер недоступен. Проверьте подключение.',
    errServer: 'Ошибка сервера. Попробуйте снова.',

    langConfirmTitle: 'Изменить язык',
    langConfirmMsg: (lang: string) => `Сменить язык интерфейса на ${lang}?`,
    confirm: 'Да, изменить',
    cancel: 'Отмена',
    sessionExpired: 'Сессия истекла. Пожалуйста, войдите снова.',

    officialDesc: 'OCR — Служба извлечения текста из документов Центрального банка',
    aboutCbu: 'О ЦБУ',
    executiveB: 'Правление',
    legislation: 'Законодательство',
    publications: 'Публикации',
    dataStats: 'Данные & Статистика',
    services: 'Услуги',
    exchangeR: 'Курсы валют',
    policyR: 'Ключевая ставка',
    paymentS: 'Платёжные системы',
    licensing: 'Лицензирование',
    pressCenter: 'Пресс-центр',
    contact: 'Контакты',
    addressS: 'Улица Ислама Каримова, 6',
    copyright: '© 2026 Центральный Банк Республики Узбекистан. Все права защищены.',
    privacyPolicy: 'Политика конфиденциальности',
    termsOfUse: 'Условия использования',
  },

  uz_c: {
    bankName: 'Ўзбекистон Республикаси Марказий Банки',
    deptSubtitle: 'Оптик белгиларни аниқлаш хизмати',
    appName: 'OCR',
    navUpload: 'Матн ажратиш',
    navMyUploads: 'Менинг ажратмаларим',
    navInternalAll: 'Барча ички ишлар',
    navExternalAll: 'Ташқи API ишлари',
    navOcrStatus: 'Двигателлар ҳолати',
    usersBtn: 'Фойдаланувчилар',
    sessionsBtn: 'Сессиялар',
    actionsBtn: 'Ҳаракатлар',
    administration: 'Администрация',
    signOut: 'Чиқиш',

    pageTitle: 'Ҳужжатдан матн ажратиш',
    pageDesc: 'Word файллари ва матн қатлами бор PDF‑лар Docling орқали. Сканерлар, суратлар ва фақат расмли PDF‑лар PaddleOCR орқали.',

    dropTitle: 'Файлни бу ерга ташланг ёки танланг',
    dropHint: 'DOCX, PDF, PNG, JPG ёки JPEG — 25 МБ гача',
    chooseFile: 'Файл танлаш',
    removeFile: 'Олиб ташлаш',
    extract: 'Матн ажратиш',
    extracting: 'Ажратилмоқда',
    extractingHint: 'Катта сканерлар кўпроқ вақт олади — тахминан саҳифасига 30 сония',
    newFile: 'Яна ажратиш',

    resultTitle: 'Ажратилган матн',
    resultCached: 'Аввал ишланган — сақланган натижа кўрсатилмоқда',
    copyText: 'Матнни нусхалаш',
    copied: 'Матн нусхаланди.',
    downloadText: '.txt юклаш',
    noText: 'Бу файл учун матн олинмади.',

    fFilename: 'Тизимдаги номи',
    fExtension: 'Кенгайтма',
    fMime: 'Контент тури',
    fSize: 'Файл ҳажми',
    fPages: 'Саҳифалар',
    fLanguage: 'Аниқланган тил',
    fStatus: 'Ҳолат',
    fChars: 'Белгилар',
    fDuration: 'Давомийлиги',
    fPerPage: 'Саҳифасига',
    fCreated: 'Бошланди',
    fFinished: 'Тугади',

    stSuccess: 'Муваффақиятли',
    stFailed: 'Хатолик',
    stTimeout: 'Вақт тугади',
    stProcessing: 'Ишланмоқда',
    stInterrupted: 'Узилди',

    errNoFile: 'Аввал файлни танланг.',
    errExt: 'Бу файл тури қўллаб‑қувватланмайди. DOCX, PDF, PNG, JPG ёки JPEG ишлатинг.',
    errSize: 'Файл 25 МБ дан катта.',
    errEmpty: 'Файл бўш.',
    errMismatch: 'Файл мазмуни кенгайтмасига мос эмас.',
    errTimeout: 'Ажратиш вақти тугади. Кичикроқ файл ёки камроқ саҳифа билан уриниб кўринг.',
    errFailed: 'Ажратиш амалга ошмади. Файл бузилган ёки ўқиб бўлмайди.',
    errNoTextServer: 'Ажратиш бу файлдан матн бермади.',
    errNetwork: 'Серверга уланиб бўлмади. Уланишни текширинг.',
    errServer: 'Сервер хатоси. Қайтадан уриниб кўринг.',

    langConfirmTitle: 'Тилни ўзгартириш',
    langConfirmMsg: (lang: string) => `Интерфейс тилини ${lang} тилига ўзгартирилсинми?`,
    confirm: 'Ҳа, ўзгартириш',
    cancel: 'Бекор қилиш',
    sessionExpired: 'Сессия муддати тугади. Илтимос, қайта киринг.',

    officialDesc: 'OCR — Марказий банк ҳужжатларидан матн ажратиш хизмати',
    aboutCbu: 'МБ Ҳақида',
    executiveB: 'Бошқарув кенгаши',
    legislation: 'Қонунчилик',
    publications: 'Публикациялар',
    dataStats: 'Маълумотлар & Статистика',
    services: 'Хизматлар',
    exchangeR: 'Валюта курслари',
    policyR: 'Асосий ставка',
    paymentS: 'Тўлов тизимлари',
    licensing: 'Лицензиялаш',
    pressCenter: 'Ахборот хизмати',
    contact: 'Боғланиш',
    addressS: 'Ислом Каримов Кўчаси, 6',
    copyright: '© 2026 Ўзбекистон Республикаси Марказий Банки. Барча ҳуқуқлар ҳимояланган.',
    privacyPolicy: 'Махфийлик сиёсати',
    termsOfUse: 'Фойдаланиш шартлари',
  },

  uz_l: {
    bankName: "O'zbekiston Respublikasi Markaziy Banki",
    deptSubtitle: 'Optik belgilarni aniqlash xizmati',
    appName: 'OCR',
    navUpload: 'Matn ajratish',
    navMyUploads: 'Mening ajratmalarim',
    navInternalAll: 'Barcha ichki ishlar',
    navExternalAll: 'Tashqi API ishlari',
    navOcrStatus: 'Dvigatellar holati',
    usersBtn: 'Foydalanuvchilar',
    sessionsBtn: 'Sessiyalar',
    actionsBtn: 'Harakatlar',
    administration: 'Administratsiya',
    signOut: 'Chiqish',

    pageTitle: 'Hujjatdan matn ajratish',
    pageDesc: "Word fayllari va matn qatlami bor PDF'lar Docling orqali. Skanerlar, suratlar va faqat rasmli PDF'lar PaddleOCR orqali.",

    dropTitle: 'Faylni bu yerga tashlang yoki tanlang',
    dropHint: 'DOCX, PDF, PNG, JPG yoki JPEG — 25 MB gacha',
    chooseFile: 'Fayl tanlash',
    removeFile: 'Olib tashlash',
    extract: 'Matn ajratish',
    extracting: 'Ajratilmoqda',
    extractingHint: 'Katta skanerlar koʻproq vaqt oladi — taxminan sahifasiga 30 soniya',
    newFile: 'Yana ajratish',

    resultTitle: 'Ajratilgan matn',
    resultCached: 'Avval ishlangan — saqlangan natija koʻrsatilmoqda',
    copyText: 'Matnni nusxalash',
    copied: 'Matn nusxalandi.',
    downloadText: '.txt yuklash',
    noText: 'Bu fayl uchun matn olinmadi.',

    fFilename: 'Tizimdagi nomi',
    fExtension: 'Kengaytma',
    fMime: 'Kontent turi',
    fSize: 'Fayl hajmi',
    fPages: 'Sahifalar',
    fLanguage: 'Aniqlangan til',
    fStatus: 'Holat',
    fChars: 'Belgilar',
    fDuration: 'Davomiyligi',
    fPerPage: 'Sahifasiga',
    fCreated: 'Boshlandi',
    fFinished: 'Tugadi',

    stSuccess: 'Muvaffaqiyatli',
    stFailed: 'Xatolik',
    stTimeout: 'Vaqt tugadi',
    stProcessing: 'Ishlanmoqda',
    stInterrupted: 'Uzildi',

    errNoFile: 'Avval faylni tanlang.',
    errExt: 'Bu fayl turi qoʻllab-quvvatlanmaydi. DOCX, PDF, PNG, JPG yoki JPEG ishlating.',
    errSize: 'Fayl 25 MB dan katta.',
    errEmpty: 'Fayl boʻsh.',
    errMismatch: 'Fayl mazmuni kengaytmasiga mos emas.',
    errTimeout: 'Ajratish vaqti tugadi. Kichikroq fayl yoki kamroq sahifa bilan urinib koʻring.',
    errFailed: 'Ajratish amalga oshmadi. Fayl buzilgan yoki oʻqib boʻlmaydi.',
    errNoTextServer: 'Ajratish bu fayldan matn bermadi.',
    errNetwork: 'Serverga ulanib boʻlmadi. Ulanishni tekshiring.',
    errServer: 'Server xatosi. Qaytadan urinib koʻring.',

    langConfirmTitle: "Tilni o'zgartirish",
    langConfirmMsg: (lang: string) => `Interfeys tilini ${lang} tiliga o'zgartirilsinmi?`,
    confirm: "Ha, o'zgartirish",
    cancel: 'Bekor qilish',
    sessionExpired: 'Sessiya muddati tugadi. Iltimos, qayta kiring.',

    officialDesc: 'OCR — Markaziy bank hujjatlaridan matn ajratish xizmati',
    aboutCbu: 'MBU Haqida',
    executiveB: 'Boshqaruv kengashi',
    legislation: 'Qonunchilik',
    publications: 'Publikatsiyalar',
    dataStats: "Ma'lumotlar & Statistika",
    services: 'Xizmatlar',
    exchangeR: 'Valyuta kurslari',
    policyR: 'Asosiy stavka',
    paymentS: "To'lov tizimlari",
    licensing: 'Litsenziyalash',
    pressCenter: 'Axborot xizmati',
    contact: "Bog'lanish",
    addressS: "Islom Karimov Ko'chasi, 6",
    copyright: "© 2026 O'zbekiston Respublikasi Markaziy Banki. Barcha huquqlar himoyalangan.",
    privacyPolicy: 'Maxfiylik siyosati',
    termsOfUse: 'Foydalanish shartlari',
  },
};

type LangKey = keyof typeof TRANSLATIONS;
const LANG_LABELS: Record<LangKey, string> = { en: 'EN', ru: 'RU', uz_c: 'УЗ', uz_l: "O'Z" };
const LANG_NAMES:  Record<LangKey, string> = { en: 'English', ru: 'Русский', uz_c: 'Ўзбекча', uz_l: "O'zbekcha" };

interface User {
  user_id: string; username: string; first_name: string; last_name: string;
  department: string; language: string; is_active: boolean; is_admin: boolean;
}

interface OcrResult {
  filename: string;
  file_extension: string;
  mime_type: string;
  file_size: number;
  page_count: number;
  language: string | null;
  status: string;
  extracted_text: string | null;
  extracted_text_length: number;
  created_at: string;
  duration: number | string;
  finished_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatBytes = (bytes: number): string => {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatDuration = (raw: number | string | null): string => {
  const s = Number(raw);
  if (!isFinite(s)) return '—';
  if (s < 60) return `${s.toFixed(2)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${(s - m * 60).toFixed(1)}s`;
};

const formatDateTime = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const formatNumber = (n: number): string =>
  String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const extIcon = (ext: string): string => {
  const e = (ext || '').toLowerCase();
  if (e === '.docx') return 'description';
  if (e === '.pdf') return 'picture_as_pdf';
  return 'image';
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const currentPath = '/';

  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<LangKey>('en');
  const [pendingLang, setPendingLang] = useState<LangKey | null>(null);
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [cached, setCached] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  /* ── Fonts + responsive ── */
  useEffect(() => {
    [
      'https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    ].forEach((href) => {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const l = document.createElement('link');
        l.href = href;
        l.rel = 'stylesheet';
        document.head.appendChild(l);
      }
    });
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ── Close menus on outside click ── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── Bootstrap the user (this endpoint returns the user record too) ── */
  useEffect(() => {
    let mounted = true;

    if (sessionStorage.getItem('session_expired')) {
      sessionStorage.removeItem('session_expired');
      setToast({ text: TRANSLATIONS.en.sessionExpired, type: 'info' });
      setTimeout(() => setToast(null), 5000);
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/get_user_internal_ocr_data`, {
          headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        });
        if (res.status === 401 || res.status === 403) { killSession(); return; }
        if (!res.ok || !mounted) return;
        const data = await res.json();
        if (!data.user) return;
        setUser(data.user);
        const mapped = (['en', 'ru', 'uz_c', 'uz_l'] as LangKey[]).find((k) => k === data.user.language);
        if (mapped) setLang(mapped);
      } catch {
        if (localStorage.getItem('session_id')) {
          localStorage.removeItem('session_id');
          window.location.replace('/login');
        }
      }
    })();

    return () => { mounted = false; };
  }, []);

  /* ── Keep the session warm; bounce out the moment it dies ── */
  useEffect(() => {
    if (!user) return;
    let active = true;
    const interval = setInterval(async () => {
      if (!active) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/get_user_internal_ocr_data`, {
          headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
        });
        if (res.status === 401 || res.status === 403) killSession();
      } catch {}
    }, 60_000);
    return () => { active = false; clearInterval(interval); };
  }, [user]);

  /* ── Elapsed counter while extracting ── */
  useEffect(() => {
    if (!uploading) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [uploading]);

  const showToast = (text: string, type: 'success' | 'error' | 'info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4500);
  };

  const applyLanguageChange = useCallback(async (newLang: LangKey) => {
    setPendingLang(null);
    try {
      const res = await apiFetch(`/api/update_language?language=${newLang}`, { method: 'PUT' });
      if (!res || !res.ok) return;
      const data = await res.json();
      setLang(newLang);
      setUser(data.user);
    } catch {}
  }, []);

  /* ── File selection + validation (mirrors the backend checks) ── */
  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
    const dot = f.name.lastIndexOf('.');
    const ext = dot >= 0 ? f.name.slice(dot).toLowerCase() : '';

    if (!ALLOWED_EXT.includes(ext)) { showToast(t.errExt, 'error'); return; }
    if (f.size === 0) { showToast(t.errEmpty, 'error'); return; }
    if (f.size > MAX_FILE_SIZE) { showToast(t.errSize, 'error'); return; }

    setFile(f);
    setResult(null);
    setCached(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (uploading) return;
    acceptFile(e.dataTransfer.files?.[0]);
  };

  const clearFile = () => {
    setFile(null);
    setResult(null);
    setCached(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /* ── Upload ── */
  const handleExtract = async () => {
    if (!file) { showToast(t.errNoFile, 'error'); return; }

    setUploading(true);
    setResult(null);
    setCached(false);

    const startedAt = Date.now();

    try {
      const form = new FormData();
      form.append('input_file', file);

      // No Content-Type header here — the browser sets the multipart boundary.
      const res = await fetch(`${API_BASE_URL}/api/internal/ocr_files/`, {
        method: 'POST',
        headers: { Authorization: authHeader() },
        body: form,
      });

      if (res.status === 401 || res.status === 403) { killSession(); return; }

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = String(payload.detail ?? '').toLowerCase();
        let msg = t.errServer;
        if (res.status === 413 || detail.includes('exceeds')) msg = t.errSize;
        else if (detail.includes('does not match')) msg = t.errMismatch;
        else if (detail.includes('unsupported')) msg = t.errExt;
        else if (detail.includes('empty')) msg = t.errEmpty;
        else if (res.status === 504 || detail.includes('timed out')) msg = t.errTimeout;
        else if (detail.includes('no text')) msg = t.errNoTextServer;
        else if (res.status === 500) msg = t.errFailed;
        showToast(msg, 'error');
        return;
      }

      const data: OcrResult = payload.data;
      setResult(data);

      // A cache hit returns a record created long before this request.
      const created = new Date(data.created_at).getTime();
      setCached(isFinite(created) && startedAt - created > 60_000);
    } catch (err) {
      console.error('OCR upload error:', err);
      showToast(t.errNetwork, 'error');
    } finally {
      setUploading(false);
    }
  };

  const copyText = async () => {
    if (!result?.extracted_text) return;
    try {
      await navigator.clipboard.writeText(result.extracted_text);
      showToast(t.copied, 'success');
    } catch {}
  };

  const downloadText = () => {
    if (!result?.extracted_text) return;
    const blob = new Blob([result.extracted_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.filename || 'extracted'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getInitials = (u: User | null) => {
    if (!u) return '?';
    return ((u.first_name?.[0] ?? '') + (u.last_name?.[0] ?? '')).toUpperCase() || u.username?.[0]?.toUpperCase() || '?';
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case 'success':     return { label: t.stSuccess,     color: '#166534', bg: '#dcfce7', border: '#86efac', icon: 'check_circle' };
      case 'failed':      return { label: t.stFailed,      color: '#991b1b', bg: '#fee2e2', border: '#fca5a5', icon: 'error' };
      case 'timeout':     return { label: t.stTimeout,     color: '#9a3412', bg: '#ffedd5', border: '#fdba74', icon: 'schedule' };
      case 'interrupted': return { label: t.stInterrupted, color: '#854d0e', bg: '#fef3c7', border: '#fcd34d', icon: 'warning' };
      default:            return { label: t.stProcessing,  color: '#1e40af', bg: '#dbeafe', border: '#93c5fd', icon: 'autorenew' };
    }
  };

  // ── Nav group (same interaction as the GoldBase header) ──
  const NavGroup = ({ group }: { group: typeof NAV_GROUPS[number] }) => {
    const isActive = currentPath === group.mainPath || currentPath === group.uploadsPath;
    const isOpen = openGroup === group.key;
    return (
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={(e) => {
            if (openGroup === group.key) { setOpenGroup(null); return; }
            const r = e.currentTarget.getBoundingClientRect();
            setMenuPos({ left: r.left, top: r.bottom + 8 });
            setOpenGroup(group.key);
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
            background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
            border: isActive ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
            borderBottom: isActive ? `2px solid ${GOLD}` : '2px solid transparent',
            borderRadius: '8px', color: isActive ? 'white' : 'rgba(255,255,255,0.65)',
            fontSize: '14px', fontWeight: isActive ? 600 : 400,
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', outline: 'none',
          }}
          onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'white'; } }}
          onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; } }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{group.icon}</span>
          {!isMobile && (t[group.mainLabelKey] as string)}
          <span className="material-symbols-outlined" style={{ fontSize: '14px', opacity: 0.75, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>expand_more</span>
        </button>
        {isOpen && menuPos && (
          <div style={{
            position: 'fixed', top: menuPos.top, left: menuPos.left,
            background: 'white', borderRadius: '12px', minWidth: '230px',
            boxShadow: '0 16px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
            border: '1px solid #e2e8f0', zIndex: 300, animation: 'dropIn 0.15s ease',
          }}>
            {[
              { path: group.mainPath,    label: t[group.mainLabelKey] as string,    icon: group.icon,        color: '#0a3b5c', bg: '#eef2f7' },
              { path: group.uploadsPath, label: t[group.uploadsLabelKey] as string, icon: group.uploadsIcon, color: '#b85e00', bg: '#fef3c7' },
            ].map((item) => {
              const itemActive = currentPath === item.path;
              return (
                <button key={item.path} onClick={() => { navigate(item.path); setOpenGroup(null); }}
                  style={{ width: '100%', background: itemActive ? item.bg : 'none', border: 'none', textAlign: 'left', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937', fontSize: '13px', fontWeight: itemActive ? 600 : 500, transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = item.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = itemActive ? item.bg : 'none'; }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '17px', color: item.color }}>{item.icon}</span>
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const st = result ? statusStyle(result.status) : null;
  const perPage = result && result.page_count > 0 ? Number(result.duration) / result.page_count : null;
  const charsPerPage = result && result.page_count > 0 ? Math.round((result.extracted_text_length ?? 0) / result.page_count) : null;

  return (
    <div style={{ minHeight: '100vh', width: '100%', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5', fontFamily: '"Inter","Segoe UI",system-ui,-apple-system,sans-serif' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 2000,
          background: toast.type === 'success' ? '#065f46' : toast.type === 'error' ? '#991b1b' : '#1e40af',
          color: 'white', padding: '13px 18px', borderRadius: '12px',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)', fontSize: '14px', fontWeight: 500,
          animation: 'slideIn 0.3s ease', maxWidth: '400px',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '19px', flexShrink: 0 }}>
            {toast.type === 'success' ? 'check_circle' : toast.type === 'info' ? 'info' : 'error'}
          </span>
          {toast.text}
        </div>
      )}

      {/* Language modal */}
      {pendingLang && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,30,46,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }}
          onClick={() => setPendingLang(null)}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px 28px', maxWidth: '380px', width: '90%', boxShadow: '0 32px 64px rgba(0,0,0,0.25)', animation: 'modalIn 0.2s ease' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '56px', height: '56px', background: '#e8f0fe', borderRadius: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#0a3b5c' }}>language</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0a3b5c' }}>{t.langConfirmTitle}</h3>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>
                {t.langConfirmMsg(LANG_NAMES[pendingLang])}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setPendingLang(null)}
                style={{ flex: 1, padding: '11px', background: '#f1f5f9', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#64748b', cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#f1f5f9')}
              >{t.cancel}</button>
              <button onClick={() => applyLanguageChange(pendingLang)}
                style={{ flex: 1, padding: '11px', background: 'linear-gradient(135deg,#0a3b5c,#1a5080)', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer', boxShadow: '0 4px 12px rgba(10,59,92,0.3)' }}
              >{t.confirm}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ HEADER ══════════════════════ */}
      <header style={{ width: '100%', background: 'linear-gradient(135deg,#0a3b5c 0%,#1a4b70 100%)', boxShadow: '0 4px 20px rgba(0,40,70,0.18)', borderBottom: `3px solid ${GOLD}`, boxSizing: 'border-box', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: isMobile ? '0 12px' : '0 20px', height: '60px', minWidth: 0 }}>
          <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, cursor: 'pointer' }}>
            <div style={{ width: '44px', height: '44px', background: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '4px', flexShrink: 0 }}>
              <img src={CbuLogo} alt="CBU Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            {!isMobile && (
              <div style={{ lineHeight: 1.4 }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>{t.bankName}</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>{t.deptSubtitle}</div>
              </div>
            )}
            {isMobile && <span style={{ fontSize: '17px', fontWeight: 700, color: '#f5d068' }}>{t.appName}</span>}
          </div>

          {!isMobile && <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />}

          <div ref={navRef} style={{ padding: '0 8px', overflowX: 'auto' }}>
            <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '40px', minWidth: 'max-content', flexWrap: 'nowrap' }}>
              {NAV_GROUPS.map((g) => <NavGroup key={g.key} group={g} />)}
            </nav>
          </div>

          <div style={{ flex: 1, minWidth: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
              {(Object.entries(LANG_LABELS) as [LangKey, string][]).map(([key, label]) => (
                <button key={key} onClick={() => key !== lang && setPendingLang(key)} style={{
                  background: lang === key ? GOLD : 'transparent',
                  color: lang === key ? '#0a2a40' : 'rgba(255,255,255,0.75)',
                  border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600,
                  cursor: lang === key ? 'default' : 'pointer', transition: 'all 0.18s', minWidth: '26px',
                }}
                  onMouseEnter={(e) => { if (lang !== key) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                  onMouseLeave={(e) => { if (lang !== key) e.currentTarget.style.background = 'transparent'; }}
                >{label}</button>
              ))}
            </div>

            <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setDropdownOpen((o) => !o)} style={{
                background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(233,183,65,0.5)',
                borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: '16px', fontWeight: 700, transition: 'all 0.2s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.background = 'rgba(233,183,65,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(233,183,65,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              >{getInitials(user)}</button>

              {dropdownOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, background: 'white', borderRadius: '16px', minWidth: '270px', boxShadow: '0 20px 40px rgba(0,0,0,0.18)', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 200, animation: 'dropIn 0.18s ease' }}>
                  <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg,#f8fafc,#eef2f7)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'linear-gradient(135deg,#0a3b5c,#1a5080)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '17px', fontWeight: 700, flexShrink: 0, border: `2px solid ${GOLD}` }}>
                        {getInitials(user)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#0a3b5c', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user ? `${user.first_name} ${user.last_name}` : '—'}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '12px', marginTop: '1px' }}>@{user?.username ?? '—'}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '5px', padding: '2px 8px', background: 'rgba(233,183,65,0.12)', border: '1px solid rgba(233,183,65,0.3)', borderRadius: '20px', fontSize: '11px', color: '#0a3b5c', fontWeight: 600 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>domain</span>
                          {user?.department ?? '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {user?.is_admin && (
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ padding: '4px 8px', marginBottom: '2px', fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{t.administration}</div>
                      {ADMIN_LINKS.map(({ icon, labelKey, route, color, bg }) => (
                        <button key={route} onClick={() => { navigate(route); setDropdownOpen(false); }}
                          style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937', fontSize: '13px', fontWeight: 500, transition: 'all 0.15s', marginBottom: '1px' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = bg; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: '18px', color }}>{icon}</span>
                          <span style={{ flex: 1 }}>{t[labelKey] as string}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#cbd5e1' }}>chevron_right</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ padding: '8px 10px' }}>
                    <button onClick={() => doLogout()}
                      style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626', fontSize: '13px', fontWeight: 500, transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                      {t.signOut}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════ MAIN ══════════════════════ */}
      <main style={{ flex: 1, padding: isMobile ? '20px 14px' : '32px 28px', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

          {/* Page intro */}
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 700, color: '#0a3b5c', margin: '0 0 6px' }}>{t.pageTitle}</h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0, lineHeight: 1.6, maxWidth: '150ch', textAlign: 'center' }}>{t.pageDesc}</p>
          </div>

          {/* ── Drop zone ── */}
          <div style={{ background: 'white', borderRadius: '18px', padding: isMobile ? '18px' : '24px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
            <div
              onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
              style={{
                border: `2px dashed ${dragging ? GOLD : file ? '#bfdbfe' : '#d9dee3'}`,
                background: dragging ? '#fffbeb' : file ? '#f8fbff' : '#fafbfc',
                borderRadius: '14px',
                padding: isMobile ? '26px 16px' : '38px 24px',
                textAlign: 'center',
                cursor: uploading ? 'default' : 'pointer',
                transition: 'all 0.18s',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ATTR}
                style={{ display: 'none' }}
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />

              {!file ? (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '46px', color: '#94a3b8' }}>upload_file</span>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: '#0a3b5c', marginTop: '10px' }}>{t.dropTitle}</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>{t.dropHint}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '16px', padding: '9px 18px', background: '#0a3b5c', color: 'white', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>folder_open</span>
                    {t.chooseFile}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#eef2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '26px', color: '#0a3b5c' }}>
                      {extIcon(file.name.slice(file.name.lastIndexOf('.')))}
                    </span>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#0a3b5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{formatBytes(file.size)}</div>
                  </div>
                  {!uploading && (
                    <button
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px', color: '#6b7280', cursor: 'pointer', flexShrink: 0 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                      {t.removeFile}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '14px', marginTop: '18px', flexWrap: 'wrap' }}>
              {uploading && (
                <div style={{ flex: 1, minWidth: '220px', fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '17px', color: GOLD, animation: 'spin 1.4s linear infinite' }}>autorenew</span>
                  <span>{t.extractingHint} — {elapsed}s</span>
                </div>
              )}
              <button
                onClick={handleExtract}
                disabled={!file || uploading}
                style={{
                  padding: '12px 30px', fontSize: '15px', fontWeight: 600,
                  background: file && !uploading ? `linear-gradient(135deg,${GOLD} 0%,#d4a017 100%)` : '#e0e0e0',
                  color: file && !uploading ? '#0a3b5c' : '#999',
                  border: 'none', borderRadius: '12px',
                  cursor: !file || uploading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '9px',
                  boxShadow: file && !uploading ? '0 4px 16px rgba(233,183,65,0.45)' : 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { if (file && !uploading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(233,183,65,0.5)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = file && !uploading ? '0 4px 16px rgba(233,183,65,0.45)' : 'none'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '20px', animation: uploading ? 'spin 1.4s linear infinite' : 'none' }}>
                  {uploading ? 'autorenew' : 'document_scanner'}
                </span>
                {uploading ? t.extracting : t.extract}
              </button>
            </div>
          </div>

          {/* ── Result ── */}
          {result && st && (
            <div style={{ background: 'white', borderRadius: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: '20px' }}>

              {/* Status strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 22px', background: st.bg, borderBottom: `1px solid ${st.border}`, flexWrap: 'wrap' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: st.color }}>{st.icon}</span>
                <div style={{ fontSize: '15px', fontWeight: 700, color: st.color }}>{st.label}</div>
                {cached && (
                  <div style={{ fontSize: '12.5px', color: '#854d0e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '20px', padding: '3px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>cached</span>
                    {t.resultCached}
                  </div>
                )}
                <div style={{ flex: 1 }} />
                <button
                  onClick={clearFile}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 15px', background: 'white', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: '#0a3b5c', cursor: 'pointer' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                  {t.newFile}
                </button>
              </div>

              {/* Field grid — every value the API returns */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
                borderBottom: '1px solid #f0f0f0',
              }}>
                {[
                  { label: t.fStatus,    value: st.label,                                              icon: 'flag' },
                  { label: t.fPages,     value: String(result.page_count ?? '—'),                      icon: 'description' },
                  { label: t.fLanguage,  value: result.language ? result.language.toUpperCase() : '—', icon: 'translate' },
                  { label: t.fChars,     value: formatNumber(result.extracted_text_length),            icon: 'text_fields' },
                  { label: t.fDuration,  value: formatDuration(result.duration),                       icon: 'timer' },
                  { label: t.fPerPage,   value: perPage != null ? `${perPage.toFixed(2)}s · ${formatNumber(charsPerPage ?? 0)} ch` : '—', icon: 'speed' },
                  { label: t.fSize,      value: formatBytes(result.file_size),                         icon: 'hard_drive' },
                  { label: t.fExtension, value: (result.file_extension || '—').toUpperCase(),          icon: extIcon(result.file_extension) },
                  { label: t.fMime,      value: result.mime_type || '—',                               icon: 'code' },
                  { label: t.fFilename,  value: result.filename || '—',                                icon: 'badge' },
                  { label: t.fCreated,   value: formatDateTime(result.created_at),                     icon: 'play_circle' },
                  { label: t.fFinished,  value: formatDateTime(result.finished_at),                    icon: 'check_circle' },
                ].map((f, i) => (
                  <div key={f.label} style={{
                    padding: '14px 18px',
                    borderRight: '1px solid #f0f0f0',
                    borderTop: i >= (isMobile ? 2 : 4) ? '1px solid #f0f0f0' : 'none',
                    minWidth: 0,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#94a3b8', fontWeight: 500, marginBottom: '5px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{f.icon}</span>
                      {f.label}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0a3b5c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.value}>
                      {f.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Extracted text */}
              <div style={{ padding: isMobile ? '16px' : '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#0a3b5c' }}>{t.resultTitle}</div>
                  <div style={{ flex: 1 }} />
                  <button onClick={copyText} disabled={!result.extracted_text}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px', fontWeight: 500, color: result.extracted_text ? '#0a3b5c' : '#cbd5e1', cursor: result.extracted_text ? 'pointer' : 'not-allowed' }}
                    onMouseEnter={(e) => { if (result.extracted_text) e.currentTarget.style.background = '#f9fafb'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                    {t.copyText}
                  </button>
                  <button onClick={downloadText} disabled={!result.extracted_text}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: result.extracted_text ? '#0a3b5c' : '#e5e7eb', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: result.extracted_text ? 'white' : '#9ca3af', cursor: result.extracted_text ? 'pointer' : 'not-allowed' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
                    {t.downloadText}
                  </button>
                </div>

                {result.extracted_text ? (
                  <pre style={{
                    margin: 0,
                    padding: '18px',
                    maxHeight: '460px',
                    overflow: 'auto',
                    textAlign: 'left',
                    background: '#fafbfc',
                    border: '1px solid #eceff2',
                    borderRadius: '12px',
                    fontSize: '13.5px',
                    lineHeight: 1.7,
                    color: '#1f2937',
                    fontFamily: '"SF Mono","Fira Mono",Consolas,monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}>
                    {result.extracted_text}
                  </pre>
                ) : (
                  <div style={{ padding: '28px', textAlign: 'center', background: '#fafbfc', border: '1px solid #eceff2', borderRadius: '12px', color: '#94a3b8', fontSize: '14px' }}>
                    {t.noText}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ══════════════════════ FOOTER ══════════════════════ */}
      <footer style={{ width: '100%', background: '#0a2a40', borderTop: `3px solid ${GOLD}`, boxSizing: 'border-box', marginTop: '24px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '48px 36px 32px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '350px 1fr 1fr 1fr', gap: '44px', alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <img src={CbuLogo} alt="CBU" style={{ width: '44px', height: '44px', objectFit: 'contain', background: 'white', borderRadius: '8px', padding: '4px', flexShrink: 0 }} />
              <div>
                <div style={{ color: '#f5d068', fontWeight: 700, fontSize: '20px', lineHeight: 1 }}>OCR</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginTop: '3px', letterSpacing: '1px' }}>CBU Platform</div>
              </div>
            </div>
            <p style={{ fontSize: '15px', lineHeight: 1.75, color: '#6b8499', marginBottom: '20px' }}>{t.officialDesc}</p>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {[
                { src: facebook,  alt: 'Facebook',  href: 'https://www.facebook.com/centralbankuzbekistan/', width: '34px', height: '34px' },
                { src: telegram,  alt: 'Telegram',  href: 'https://t.me/centralbankuzbekistan',              width: '38px', height: '38px' },
                { src: linkedin,  alt: 'LinkedIn',  href: 'https://www.linkedin.com/company/centralbankuzbekistan/', width: '40px', height: '40px' },
                { src: twitter,   alt: 'Twitter',   href: 'https://x.com/cbuzbekistan',                      width: '44px', height: '44px' },
                { src: instagram, alt: 'Instagram', href: 'https://www.instagram.com/centralbankuzbekistan', width: '30px', height: '30px' },
                { src: youtube,   alt: 'YouTube',   href: 'https://www.youtube.com/centralbankofuzbekistan', width: '32px', height: '32px' },
              ].map((s) => (
                <a key={s.alt} href={s.href} target="_blank" rel="noopener noreferrer"
                  style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.07)', transition: 'background 0.2s, transform 0.15s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                >
                  <img src={s.src} alt={s.alt} style={{ width: s.width, height: s.height, objectFit: 'contain' }} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <div style={{ color: 'white', fontSize: '16px', fontWeight: 700, marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{t.aboutCbu}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                { label: t.aboutCbu,     href: 'https://cbu.uz/en/about/',                   icon: 'info' },
                { label: t.executiveB,   href: 'https://cbu.uz/en/about/management/',        icon: 'groups' },
                { label: t.legislation,  href: 'https://cbu.uz/en/documents/',               icon: 'gavel' },
                { label: t.publications, href: 'https://cbu.uz/en/statistics/publications/', icon: 'description' },
                { label: t.dataStats,    href: 'https://cbu.uz/en/statistics/',              icon: 'bar_chart' },
              ].map((item) => (
                <li key={item.href} style={{ marginBottom: '11px' }}>
                  <a href={item.href} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '15px', color: '#8097a8', textDecoration: 'none' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#8097a8'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{item.icon}</span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div style={{ color: 'white', fontSize: '15px', fontWeight: 700, marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{t.services}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                { label: t.exchangeR,   href: 'https://cbu.uz/en/arkhiv-kursov-valyut/',             icon: 'currency_exchange' },
                { label: t.policyR,     href: 'https://cbu.uz/en/monetary-policy/refinancing-rate/', icon: 'percent' },
                { label: t.paymentS,    href: 'https://cbu.uz/en/payment-systems/',                  icon: 'payments' },
                { label: t.licensing,   href: 'https://cbu.uz/en/credit-organizations/licensing/',   icon: 'verified' },
                { label: t.pressCenter, href: 'https://cbu.uz/en/press_center/',                     icon: 'newspaper' },
              ].map((item) => (
                <li key={item.href} style={{ marginBottom: '11px' }}>
                  <a href={item.href} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '15px', color: '#8097a8', textDecoration: 'none' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#8097a8'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{item.icon}</span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div style={{ color: 'white', fontSize: '16px', fontWeight: 700, marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{t.contact}</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                { label: '+998 71 212-62-05', href: 'tel:+998712126205',                         icon: 'call' },
                { label: '+998 71 200-00-44', href: 'tel:+998712000044',                         icon: 'call' },
                { label: 'info@cbu.uz',       href: 'mailto:info@cbu.uz',                        icon: 'mail' },
                { label: t.addressS,          href: 'https://maps.app.goo.gl/4qDXnjgQoTwfWCg28', icon: 'location_on' },
              ].map((item) => (
                <li key={item.label} style={{ marginBottom: '11px' }}>
                  <a href={item.href}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '15px', color: '#8097a8', textDecoration: 'none' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#8097a8'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>{item.icon}</span>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 36px' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', color: '#4a5c6a', flexWrap: 'wrap', gap: '8px' }}>
            <span>{t.copyright}</span>
            <div style={{ display: 'flex', gap: '20px' }}>
              {[
                { label: t.privacyPolicy, href: 'https://cbu.uz/en/mobile-privacy/' },
                { label: t.termsOfUse,    href: 'https://cbu.uz/en/services/request-information/' },
              ].map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                  style={{ color: '#4a5c6a', textDecoration: 'none' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#4a5c6a'; }}
                >{l.label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        html,body { width:100%; overflow-x:hidden; }
        body { font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif; }
        #root { width:100%; }
        .material-symbols-outlined { font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24; }
        @keyframes spin    { from{transform:rotate(0deg);}  to{transform:rotate(360deg);} }
        @keyframes slideIn { from{opacity:0;transform:translateX(20px);} to{opacity:1;transform:translateX(0);} }
        @keyframes dropIn  { from{opacity:0;transform:translateY(-8px) scale(0.97);} to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes modalIn { from{opacity:0;transform:scale(0.93);} to{opacity:1;transform:scale(1);} }
        nav::-webkit-scrollbar { height:0; }
        pre::-webkit-scrollbar { width:10px; height:10px; }
        pre::-webkit-scrollbar-thumb { background:#d7dde3; border-radius:6px; }
        pre::-webkit-scrollbar-track { background:transparent; }
      `}</style>
    </div>
  );
};

export default HomePage;