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
const NAVY = '#0a3b5c';

// Visible grid lines — grey enough to read as structure, not decoration.
const CELL_BORDER = '#cfd8e1';

// ─────────────────────────────────────────────────────────────────────────────
// Navigation — flat buttons in the header, no dropdown
// ─────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { path: '/',            labelKey: 'navUpload'      as const, icon: 'document_scanner' },
  { path: '/my_uploads',  labelKey: 'navFileUploads' as const, icon: 'query_stats' },
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
const ACCEPT_ATTR = '.docx,.pdf,.png,.jpeg,.jpg';
const MAX_FILE_SIZE = 25 * 1024 * 1024;

// Brand-ish colours per format, so the file type is recognisable at a glance:
// Word blue, Acrobat red, a distinct violet for raster images.
const FORMAT_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
  '.docx': { color: '#2b579a', bg: '#e8effa', icon: 'description' },
  '.pdf':  { color: '#c0362c', bg: '#fdeceb', icon: 'picture_as_pdf' },
  '.png':  { color: '#7c3aed', bg: '#f3edff', icon: 'image' },
  '.jpg':  { color: '#7c3aed', bg: '#f3edff', icon: 'image' },
  '.jpeg': { color: '#7c3aed', bg: '#f3edff', icon: 'image' },
};

const formatStyle = (ext: string) =>
  FORMAT_STYLE[(ext || '').toLowerCase()] ?? { color: '#475569', bg: '#eef1f5', icon: 'draft' };

// ─────────────────────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  en: {
    bankName: 'Central Bank of Uzbekistan',
    deptSubtitle: 'Optical Character Recognition & Extraction Platform',
    appName: 'OCR',
    navUpload: 'Text Extraction',
    navFileUploads: 'File Uploads',
    navInternalAll: 'All Internal Jobs',
    navExternalAll: 'External API Jobs',
    navOcrStatus: 'Engine Status',
    usersBtn: 'Users',
    sessionsBtn: 'Sessions',
    actionsBtn: 'Actions',
    administration: 'Administration',
    signOut: 'Sign Out',

    pageTitle: 'Extract text from a document',
    pageDesc: "Extract text accurately from Word documents, PDFs, scanned documents, photographs, and other image-based files, enabling seamless access to and processing of document content.",

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
    fExtension: 'File type',
    fMime: 'Content type',
    fSize: 'File size',
    fPages: 'Pages',
    fLanguage: 'Detected language',
    fStatus: 'Status',
    fChars: 'Number of Characters',
    fDuration: 'Duration',
    fPerPage: 'Per page',
    fCreated: 'Started at',
    fFinished: 'Finished at',

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

    officialDesc: 'OCR — Internal Platform of the Central Bank of Uzbekistan for Extracting Text from Internal Documents',
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

    // en
    fDetails: 'Technical details',
    fAcross: (n: number) => `across ${n} ${n === 1 ? 'page' : 'pages'}`,
    fPerPageSub: (s: string) => `${s} per page`,
  },

  ru: {
    bankName: 'Центральный Банк Республики Узбекистан',
    deptSubtitle: 'Платформа распознавания & извлечения текста',
    appName: 'OCR',
    navUpload: 'Извлечение текста',
    navFileUploads: 'Загрузки файлов',
    navInternalAll: 'Все внутренние задания',
    navExternalAll: 'Задания внешнего API',
    navOcrStatus: 'Состояние движков',
    usersBtn: 'Пользователи',
    sessionsBtn: 'Сессии',
    actionsBtn: 'Действия',
    administration: 'Администрирование',
    signOut: 'Выйти',

    pageTitle: 'Извлечение текста из документа',
    pageDesc: 'Точное извлечение текста из документов Word, PDF-файлов, отсканированных документов, фотографий и других файлов, содержащих изображения, для удобного доступа к содержимому и его дальнейшей обработки.',

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
    fExtension: 'Тип файла',
    fMime: 'Тип содержимого',
    fSize: 'Размер файла',
    fPages: 'Страниц',
    fLanguage: 'Определённый язык',
    fStatus: 'Статус',
    fChars: 'Количество символов',
    fDuration: 'Длительность',
    fPerPage: 'На страницу',
    fCreated: 'Начато в',
    fFinished: 'Завершено в',

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

    officialDesc: 'OCR — Внутренняя платформа Центрального банка Узбекистана для извлечения текста из внутренних документов',
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

    // ru
    fDetails: 'Технические детали',
    fAcross: (n: number) => `на ${n} стр.`,
    fPerPageSub: (s: string) => `${s} на страницу`,
  },

  uz_c: {
    bankName: 'Ўзбекистон Республикаси Марказий Банки',
    deptSubtitle: 'Оптик матнни аниқлаш & маълумотларни экстракция қилиш платформаси',
    appName: 'OCR',
    navUpload: 'Матнни ажратиб олиш',
    navFileUploads: 'Файл юкламалари',
    navInternalAll: 'Барча ички ишлар',
    navExternalAll: 'Ташқи API ишлари',
    navOcrStatus: 'Двигателлар ҳолати',
    usersBtn: 'Фойдаланувчилар',
    sessionsBtn: 'Сессиялар',
    actionsBtn: 'Ҳаракатлар',
    administration: 'Администрация',
    signOut: 'Чиқиш',

    pageTitle: 'Ҳужжатдан матн ажратиш',
    pageDesc: 'Word ҳужжатлари, PDF-файллар, сканерланган ҳужжатлар, фотосуратлар ва бошқа тасвирга асосланган файллардан матнни аниқ ажратиб олиш ҳамда ҳужжат мазмунидан қулай фойдаланиш ва уни қайта ишлаш имконини беради.',

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
    fExtension: 'Файл тури',
    fMime: 'Контент тури',
    fSize: 'Файл ҳажми',
    fPages: 'Саҳифалар',
    fLanguage: 'Аниқланган тил',
    fStatus: 'Ҳолат',
    fChars: 'Матн белгилар сони',
    fDuration: 'Давомийлиги',
    fPerPage: 'Саҳифасига',
    fCreated: 'Бошланган вақт',
    fFinished: 'Тугаган вақт',

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

    officialDesc: 'OCR — Ўзбекистон Марказий банкининг ички ҳужжатлардан матн ажратиб олиш',
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

    // uz_c
    fDetails: 'Техник тафсилотлар',
    fAcross: (n: number) => `${n} саҳифада`,
    fPerPageSub: (s: string) => `саҳифасига ${s}`,
  },

  uz_l: {
    bankName: "O'zbekiston Respublikasi Markaziy Banki",
    deptSubtitle: 'Optik matnni aniqlash va ma’lumotlarni ekstraksiya qilish platformasi',
    appName: 'OCR',
    navUpload: 'Matnni ajratib olish',
    navFileUploads: 'Fayl yuklamalari',
    navInternalAll: 'Barcha ichki ishlar',
    navExternalAll: 'Tashqi API ishlari',
    navOcrStatus: 'Dvigatellar holati',
    usersBtn: 'Foydalanuvchilar',
    sessionsBtn: 'Sessiyalar',
    actionsBtn: 'Harakatlar',
    administration: 'Administratsiya',
    signOut: 'Chiqish',

    pageTitle: 'Hujjatdan matn ajratish',
    pageDesc: "Word hujjatlari, PDF-fayllar, skanerlangan hujjatlar, fotosuratlar va boshqa tasvirga asoslangan fayllardan matnni aniq ajratib olish hamda hujjat mazmunidan qulay foydalanish va uni qayta ishlash imkonini beradi.",

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
    fExtension: 'Fayl turi',
    fMime: 'Kontent turi',
    fSize: 'Fayl hajmi',
    fPages: 'Sahifalar',
    fLanguage: 'Aniqlangan til',
    fStatus: 'Holat',
    fChars: 'Matn belgilar soni',
    fDuration: 'Davomiyligi',
    fPerPage: 'Sahifasiga',
    fCreated: 'Boshlangan vaqt',
    fFinished: 'Tugagan vaqt',

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

    officialDesc: 'OCR — O‘zbekiston Markaziy bankining ichki hujjatlardan matn ajratib olish platformasi',
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

    // uz_l
    fDetails: 'Texnik tafsilotlar',
    fAcross: (n: number) => `${n} sahifada`,
    fPerPageSub: (s: string) => `sahifasiga ${s}`,
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
  page_count: number | null;
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

// The full DOCX MIME string is 70+ characters and tells the reader nothing.
const shortMime = (mime: string, ext: string): string => {
  if ((ext || '').toLowerCase() === '.docx') return 'application/vnd.openxmlformats';
  return mime || '—';
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
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}          ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

const formatNumber = (n: number): string =>
  String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// Colour the duration by how long it took: fast is green, slow is amber.
// The threshold is per page where pages are known, flat otherwise.
const durationStyle = (seconds: number, pages: number | null) => {
  const perPage = pages && pages > 0 ? seconds / pages : seconds;

  if (perPage < 1)
    return { color: '#16A34A', bg: '#16A34A' }; // Fast — green

  if (perPage < 5)
    return { color: '#C47A2C', bg: '#FDF0DE' }; // Medium — orange

  return { color: '#B94A3A', bg: '#F9E7E3' }; // Slow — red
};

const LANGUAGE_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  uz_l:    { color: '#3574D3', bg: '#E8F0FE', label: "O'zbek tili" },
  uz_c:    { color: '#3574D3', bg: '#E8F0FE', label: 'Ўзбек (Кирил)' },
  ru:      { color: '#3574D3', bg: '#E8F0FE', label: 'Русский' },
  en:      { color: '#3574D3', bg: '#E8F0FE', label: 'English' },
  unknown: { color: '#64748B', bg: '#EEF1F5', label: '—' },
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
  const [showDetails, setShowDetails] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  /* ── Close the avatar menu on outside click ── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
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
        const res = await fetch(`${API_BASE_URL}/api/get_single_user_internal_ocr_data`, {
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
        const res = await fetch(`${API_BASE_URL}/api/get_single_user_internal_ocr_data`, {
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
      case 'success':     return { label: t.stSuccess,     color: '#15803d', bg: '#e7f8ec', border: '#8fdca6', icon: 'check_circle' };
      case 'failed':      return { label: t.stFailed,      color: '#b91c1c', bg: '#fdeaea', border: '#f3a9a9', icon: 'error' };
      case 'timeout':     return { label: t.stTimeout,     color: '#c2410c', bg: '#fdeee4', border: '#f5bf94', icon: 'schedule' };
      case 'interrupted': return { label: t.stInterrupted, color: '#a16207', bg: '#fdf5da', border: '#ecd07a', icon: 'warning' };
      default:            return { label: t.stProcessing,  color: '#1d4ed8', bg: '#e8eefe', border: '#a8c0fb', icon: 'autorenew' };
    }
  };

  const st = result ? statusStyle(result.status) : null;
  const pages = result?.page_count ?? null;
  const perPage = result && pages && pages > 0 ? Number(result.duration) / pages : null;
  const charsPerPage = result && pages && pages > 0 ? Math.round((result.extracted_text_length ?? 0) / pages) : null;

  const fmt = result ? formatStyle(result.file_extension) : null;
  const durStyle = result ? durationStyle(Number(result.duration), pages) : null;
  const langStyle = result
    ? LANGUAGE_STYLE[result.language ?? 'unknown'] ?? { color: '#334155', bg: '#eef1f5', label: (result.language ?? '—').toUpperCase() }
    : null;

  /* ── Result cells: label, value, icon, and the colour the value carries ── */
  type Cell = { label: string; value: string; icon: string; color: string; bg: string };

  const cells: Cell[] = result && st && fmt && durStyle && langStyle ? [
    { label: t.fStatus,    value: st.label,                                         icon: st.icon,     color: st.color,   bg: st.bg },
    { label: t.fExtension, value: (result.file_extension || '—').replace('.', '').toUpperCase(),
                                                                                    icon: fmt.icon,    color: fmt.color,  bg: fmt.bg },
    { label: t.fLanguage,  value: langStyle.label,                                  icon: 'translate', color: langStyle.color, bg: langStyle.bg },
    { label: t.fDuration,  value: formatDuration(result.duration),                  icon: 'timer',     color: durStyle.color,  bg: durStyle.bg },

    ...(pages != null ? [
      { label: t.fPages,   value: String(pages),                                    icon: 'layers',    color: '#0e7490', bg: '#e4f5f9' },
    ] : []),
    { label: t.fChars,     value: formatNumber(result.extracted_text_length),       icon: 'text_fields', color: '#0f766e', bg: '#e6f7f5' },
    ...(perPage != null ? [
      { label: t.fPerPage, value: `${perPage.toFixed(2)}s · ${formatNumber(charsPerPage ?? 0)} ch`,
                                                                                    icon: 'speed',     color: '#a21caf', bg: '#fbeafb' },
    ] : []),
    { label: t.fSize,      value: formatBytes(result.file_size),                    icon: 'hard_drive', color: '#475569', bg: '#eef1f5' },

    { label: t.fMime,      value: result.mime_type || '—',                          icon: 'code',      color: '#1d4ed8', bg: '#e8eefe' },
    { label: t.fCreated,   value: formatDateTime(result.created_at),                icon: 'play_circle', color: '#475569', bg: '#eef1f5' },
    { label: t.fFinished,  value: formatDateTime(result.finished_at),               icon: 'check_circle', color: '#15803d', bg: '#e7f8ec' },
    { label: t.fFilename,  value: result.filename || '—',                           icon: 'badge',     color: '#475569', bg: '#eef1f5' },
  ] : [];

  const columns = isMobile ? 2 : 4;

  return (
    <div style={{ minHeight: '100vh', width: '100%', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5', fontFamily: '"Inter","Segoe UI",system-ui,-apple-system,sans-serif', textAlign: 'left' }}>

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
                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: NAVY }}>language</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: NAVY }}>{t.langConfirmTitle}</h3>
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
                style={{ flex: 1, padding: '11px', background: `linear-gradient(135deg,${NAVY},#1a5080)`, border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer', boxShadow: '0 4px 12px rgba(10,59,92,0.3)' }}
              >{t.confirm}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ HEADER ══════════════════════ */}
      <header style={{ width: '100%', background: `linear-gradient(135deg,${NAVY} 0%,#1a4b70 100%)`, boxShadow: '0 4px 20px rgba(0,40,70,0.18)', borderBottom: `3px solid ${GOLD}`, boxSizing: 'border-box', position: 'sticky', top: 0, zIndex: 100 }}>
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

          {/* Flat nav — one button per page, no dropdown */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflowX: 'auto' }}>
            {NAV_ITEMS.map((item) => {
              const active = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  title={t[item.labelKey] as string}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: isMobile ? '7px 10px' : '7px 14px',
                    background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                    border: active ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
                    borderBottom: active ? `2px solid ${GOLD}` : '2px solid transparent',
                    borderRadius: '8px',
                    color: active ? 'white' : 'rgba(255,255,255,0.68)',
                    fontFamily: 'inherit', fontSize: '14px', fontWeight: active ? 600 : 400,
                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'white'; } }}
                  onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.68)'; } }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>{item.icon}</span>
                  {!isMobile && (t[item.labelKey] as string)}
                </button>
              );
            })}
          </nav>

          <div style={{ flex: 1, minWidth: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
              {(Object.entries(LANG_LABELS) as [LangKey, string][]).map(([key, label]) => (
                <button key={key} onClick={() => key !== lang && setPendingLang(key)} style={{
                  background: lang === key ? GOLD : 'transparent',
                  color: lang === key ? '#0a2a40' : 'rgba(255,255,255,0.75)',
                  border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600,
                  fontFamily: 'inherit',
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
                justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: '16px', fontWeight: 700,
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.background = 'rgba(233,183,65,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(233,183,65,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              >{getInitials(user)}</button>

              {dropdownOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, background: 'white', borderRadius: '16px', minWidth: '270px', boxShadow: '0 20px 40px rgba(0,0,0,0.18)', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 200, animation: 'dropIn 0.18s ease' }}>
                  <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg,#f8fafc,#eef2f7)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: `linear-gradient(135deg,${NAVY},#1a5080)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '17px', fontWeight: 700, flexShrink: 0, border: `2px solid ${GOLD}` }}>
                        {getInitials(user)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: NAVY, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user ? `${user.first_name} ${user.last_name}` : '—'}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '12px', marginTop: '1px' }}>@{user?.username ?? '—'}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '5px', padding: '2px 8px', background: 'rgba(233,183,65,0.12)', border: '1px solid rgba(233,183,65,0.3)', borderRadius: '20px', fontSize: '11px', color: NAVY, fontWeight: 600 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>domain</span>
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
                          style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', transition: 'all 0.15s', marginBottom: '1px' }}
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
                      style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', transition: 'background 0.15s' }}
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
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <h1 style={{ fontSize: isMobile ? '20px' : '25px', fontWeight: 700, color: NAVY, margin: '0 0 8px', letterSpacing: '-0.3px' }}>{t.pageTitle}</h1>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0 auto', lineHeight: 1.6, maxWidth: '84ch' }}>{t.pageDesc}</p>
          </div>

          {/* ── Drop zone ── */}
          <div style={{ background: 'white', borderRadius: '18px', padding: isMobile ? '18px' : '24px', border: `1px solid ${CELL_BORDER}`, boxShadow: '0 2px 12px rgba(10,40,70,0.06)', marginBottom: '20px' }}>
            <div
              onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => { if (!uploading) fileInputRef.current?.click(); }}
              style={{
                border: `2px dashed ${dragging ? GOLD : file ? '#8fb6d6' : '#bcc7d2'}`,
                background: dragging ? '#fffbeb' : file ? '#f4f9ff' : '#fafbfc',
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
                  <span className="material-symbols-outlined" style={{ fontSize: '46px', color: '#8fa3b6' }}>upload_file</span>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: NAVY, marginTop: '10px' }}>{t.dropTitle}</div>
                  <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>{t.dropHint}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '16px', padding: '9px 18px', background: NAVY, color: 'white', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>folder_open</span>
                    {t.chooseFile}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {(() => {
                    const s = formatStyle(file.name.slice(file.name.lastIndexOf('.')));
                    return (
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: s.bg, border: `1px solid ${s.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '26px', color: s.color }}>{s.icon}</span>
                      </div>
                    );
                  })()}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: NAVY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>{formatBytes(file.size)}</div>
                  </div>
                  {!uploading && (
                    <button
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '7px',
                        padding: '9px 16px',
                        background: 'white',
                        border: '1.5px solid #f3a9a9',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#b91c1c',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        flexShrink: 0,
                        transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fdeaea'; e.currentTarget.style.borderColor = '#b91c1c'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#f3a9a9'; }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>close</span>
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
                  padding: '12px 30px', fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
                  background: file && !uploading ? `linear-gradient(135deg,${GOLD} 0%,#d4a017 100%)` : '#e0e4e8',
                  color: file && !uploading ? NAVY : '#98a2ad',
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
            <div style={{ background: 'white', borderRadius: '18px', border: `1px solid ${CELL_BORDER}`, boxShadow: '0 2px 12px rgba(10,40,70,0.06)', overflow: 'hidden', marginBottom: '20px' }}>

              {/* ── File identity ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: isMobile ? '18px' : '20px 24px', borderBottom: `1px solid ${CELL_BORDER}`, flexWrap: 'wrap' }}>
                  <div style={{ width: '58px', height: '58px', borderRadius: '14px', background: fmt.bg, border: `1.5px solid ${fmt.color}33`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '24px', color: fmt.color, lineHeight: 1 }}>{fmt.icon}</span>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: fmt.color, letterSpacing: '0.6px', marginTop: '3px' }}>
                      {(result.file_extension || '').replace('.', '').toUpperCase()}
                    </span>
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div title={result.filename} style={{ fontSize: '17px', fontWeight: 700, color: NAVY, letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {result.filename || '—'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, flexWrap: 'wrap' }}>
                    {cached && (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#a16207', background: '#fdf5da', border: '1px solid #ecd07a', borderRadius: '20px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>cached</span>
                        {t.resultCached}
                      </span>
                    )}
                    <span style={{ fontSize: '13.5px', fontWeight: 700, color: st.color, background: st.bg, border: `1.5px solid ${st.border}`, borderRadius: '20px', padding: '7px 15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>{st.icon}</span>
                      {st.label}
                    </span>
                    <button onClick={clearFile}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 15px', background: 'white', border: `1px solid ${CELL_BORDER}`, borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: NAVY, fontFamily: 'inherit', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f6f8fa'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>add</span>
                      {t.newFile}
                    </button>
                  </div>
                </div>

                {/* ── The three numbers worth reading ── */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', background: CELL_BORDER, gap: '1px', borderBottom: `1px solid ${CELL_BORDER}` }}>
                  {[
                    {
                      label: t.fChars,
                      icon: 'notes',
                      color: '#3D7A52',
                      value: formatNumber(result.extracted_text_length),
                    },
                    {
                      label: t.fDuration,
                      icon: 'timer',
                      color: durStyle.color,
                      value: formatDuration(result.duration),
                    },
                    {
                      label: t.fLanguage,
                      icon: 'translate',
                      color: langStyle.color,
                      value: langStyle.label,
                    },
                  ].map((m) => (
                    <div key={m.label} style={{ background: 'white', padding: isMobile ? '16px 18px' : '20px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '14px', fontWeight: 600, color: '#7d8896', marginBottom: '10px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '18px', color: m.color }}>{m.icon}</span>
                        {m.label}
                      </div>
                      <div style={{ fontSize: m.value.length > 12 ? '20px' : '24px', fontWeight: 700, color: m.color, letterSpacing: '-0.6px', lineHeight: 1.05, wordBreak: 'break-word' }}>
                        {m.value}
                      </div>
                      {m.sub && <div style={{ fontSize: '12.5px', color: '#8895a3', marginTop: '6px' }}>{m.sub}</div>}
                    </div>
                  ))}
                </div>

                {/* ── Technical details, out of the way until wanted ── */}
                <div style={{ padding: isMobile ? '0 16px' : '0 24px', borderBottom: `1px solid ${CELL_BORDER}` }}>
                  <button onClick={() => setShowDetails((s) => !s)}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '13px 0', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600, color: '#5b6775', cursor: 'pointer' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '19px', transform: showDetails ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}>expand_more</span>
                    {t.fDetails}
                  </button>

                  {showDetails && (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: '0 140px',
                        paddingBottom: '16px',
                        background: isMobile
                          ? undefined
                          : 'linear-gradient(to right, transparent calc(50% - 0.5px), #e2e6eb calc(50% - 0.5px), #e2e6eb calc(50% + 0.5px), transparent calc(50% + 0.5px))',
                      }}
                    >{[
                        ...(pages != null ? [{ label: t.fPages, value: String(pages), icon: 'layers', color: '#0e7490' }] : []),
                        { label: t.fSize,      value: formatBytes(result.file_size),                        icon: 'hard_drive',  color: '#475569' },
                        { label: t.fExtension, value: (result.file_extension || '—').replace('.', '').toUpperCase(), icon: fmt.icon, color: fmt.color },
                        { label: t.fMime,      value: shortMime(result.mime_type, result.file_extension),   icon: 'code',        color: '#1d4ed8' },
                        { label: t.fCreated,   value: formatDateTime(result.created_at),                    icon: 'play_circle', color: '#0b6b3a' },
                        { label: t.fFinished,  value: formatDateTime(result.finished_at),                   icon: 'flag_circle', color: '#0b6b3a' },
                      ].map((r) => (
                        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid #eef2f6' }}>
                          <span style={{ width: '32px', height: '32px', borderRadius: '9px', background: `${r.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: r.color }}>{r.icon}</span>
                          </span>
                          <span style={{ fontSize: '14px', color: '#6b7784', flexShrink: 0 }}>{r.label}</span>
                          <span style={{ flex: 1 }} />
                          <span title={r.value} style={{ fontSize: '14px', fontWeight: 600, color: '#25313d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.value}</span>
                        </div>
                      ))}
                    </div>)}
                </div>

              {/* Extracted text */}
              <div style={{ padding: isMobile ? '16px' : '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '19px', color: NAVY }}>article</span>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: NAVY }}>{t.resultTitle}</div>
                  <div style={{ flex: 1 }} />
                  <button onClick={copyText} disabled={!result.extracted_text}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'white', border: `1px solid ${CELL_BORDER}`, borderRadius: '9px', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', color: result.extracted_text ? NAVY : '#b6c0ca', cursor: result.extracted_text ? 'pointer' : 'not-allowed' }}
                    onMouseEnter={(e) => { if (result.extracted_text) e.currentTarget.style.background = '#f6f8fa'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                    {t.copyText}
                  </button>
                  <button onClick={downloadText} disabled={!result.extracted_text}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: result.extracted_text ? NAVY : '#e0e4e8', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', color: result.extracted_text ? 'white' : '#98a2ad', cursor: result.extracted_text ? 'pointer' : 'not-allowed' }}
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
                    background: '#fcfdfe',
                    border: `2px solid ${CELL_BORDER}`,
                    borderLeft: `4px solid ${NAVY}`,
                    borderRadius: '10px',
                    fontSize: '13.5px',
                    lineHeight: 1.75,
                    color: '#16212c',
                    fontFamily: '"SF Mono","Fira Mono",Consolas,monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: 'inset 0 2px 6px rgba(10,40,70,0.05)',
                  }}>
                    {result.extracted_text}
                  </pre>
                ) : (
                  <div style={{ padding: '28px', textAlign: 'center', background: '#fcfdfe', border: `2px dashed ${CELL_BORDER}`, borderRadius: '10px', color: '#8695a4', fontSize: '14px' }}>
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
                <div style={{ color: '#f5d068', fontWeight: 700, fontSize: '18px', lineHeight: 1 }}>{t.appName}</div>
              </div>
            </div>
            <p style={{ fontSize: '15px', lineHeight: 1.75, color: '#6b8499', marginBottom: '20px' }}>{t.officialDesc}</p>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {[
                { src: facebook,  alt: 'Facebook',  href: 'https://www.facebook.com/centralbankuzbekistan/', width: '34px', height: '34px' },
                { src: telegram,  alt: 'Telegram',  href: 'https://t.me/centralbankuzbekistan',              width: '38px', height: '38px' },
                { src: linkedin,  alt: 'LinkedIn',  href: 'https://www.linkedin.com/company/centralbankuzbekistan/', width: '44px', height: '44px' },
                { src: twitter,   alt: 'Twitter',   href: 'https://x.com/cbuzbekistan',                      width: '46px', height: '46px' },
                { src: instagram, alt: 'Instagram', href: 'https://www.instagram.com/centralbankuzbekistan', width: '32px', height: '32px' },
                { src: youtube,   alt: 'YouTube',   href: 'https://www.youtube.com/centralbankofuzbekistan', width: '35px', height: '35px' },
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
        pre::-webkit-scrollbar-thumb { background:#b9c4d0; border-radius:6px; }
        pre::-webkit-scrollbar-track { background:transparent; }
        button:focus-visible { outline:2px solid ${GOLD}; outline-offset:2px; }
      `}</style>
    </div>
  );
};

export default HomePage;