import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
const CELL_BORDER = '#cfd8e1';

const C_BLUE   = '#1d4ed8';
const C_CYAN   = '#0e7490';
const C_INDIGO = '#4338ca';
const C_GREEN  = '#15803d';
const C_RED    = '#b91c1c';
const C_ORANGE = '#c2410c';
const C_AMBER  = '#a16207';
const C_TEAL   = '#0f766e';
const C_DBLUE  = '#123c73';
const C_PADDLE = '#c2410c';
const C_DOCLING = '#0f766e';

const NAV_ITEMS = [
  { path: '/',                   labelKey: 'navUpload'      as const, icon: 'document_scanner' },
  { path: '/my_uploads',         labelKey: 'navFileUploads' as const, icon: 'folder_open' },
  { path: '/my_uploads_stats',   labelKey: 'navStats'       as const, icon: 'query_stats' },
] as const;

const ADMIN_LINKS = [
  { icon: 'inbox',          labelKey: 'navInternalAll' as const, route: '/internal_uploads',  color: '#0d9488', bg: '#f0fdfa' },
  { icon: 'api',            labelKey: 'navExternalAll' as const, route: '/external_requests', color: '#0369a1', bg: '#f0f9ff' },
  { icon: 'monitor_heart',  labelKey: 'navOcrStatus'   as const, route: '/ocr_status',        color: '#c2410c', bg: '#fff7ed' },
  { icon: 'group',          labelKey: 'usersBtn'       as const, route: '/users_data',        color: '#3b82f6', bg: '#eff6ff' },
  { icon: 'manage_history', labelKey: 'sessionsBtn'    as const, route: '/user_sessions',     color: '#8b5cf6', bg: '#f5f3ff' },
  { icon: 'timeline',       labelKey: 'actionsBtn'     as const, route: '/user_actions',      color: '#f59e0b', bg: '#fffbeb' },
] as const;

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
    navUpload: 'Text Extraction', navFileUploads: 'File Uploads', navStats: 'Statistics',
    navInternalAll: 'All Internal Jobs', navExternalAll: 'External API Jobs', navOcrStatus: 'Engine Status',
    usersBtn: 'Users', sessionsBtn: 'Sessions', actionsBtn: 'Actions',
    administration: 'Administration', signOut: 'Sign Out',

    pageTitle: 'My OCR Statistics',
    pageDesc: 'Every figure below reflects the current filter selection.',
    refresh: 'Refresh',

    period: 'PERIOD', engine: 'ENGINE', fileType: 'FILE TYPE',
    language: 'LANGUAGE', status: 'STATUS', dateRange: 'DATE RANGE',
    from: 'From', to: 'To', reset: 'Reset', all: 'All',
    p24h: '24 hours', p7d: '7 days', p30d: '30 days', p90d: '90 days', pAll: 'All time', pCustom: 'Custom',

    kTotal: 'Total requests', kSuccess: 'Success rate', kPages: 'Pages processed',
    kChars: 'Characters', kMedian: 'Median duration',
    kVsPrev: (s: string) => `${s} vs previous`,
    kNotSuccess: (n: string) => `${n} not successful`,
    kPerRequest: (s: string) => `${s} per request`,
    kPerPage: (s: string) => `${s} per page`,
    kP95: (s: string) => `p95 ${s}`,

    cRequests: 'Requests over time', cRequestsSub: 'How much you use the service',
    cStatus: 'Status distribution', cStatusSub: 'Health of your jobs',
    cPages: 'Pages processed over time', cPagesSub: 'Real workload, not request count',
    cChars: 'Characters extracted over time', cCharsSub: 'What the OCR actually produced',
    cEngine: 'PaddleOCR vs Docling', cEngineSub: 'Share of your workload',
    cTypeEngine: 'File type by engine', cTypeEngineSub: 'Which engine handles which format',
    cLanguage: 'Language distribution', cLanguageSub: 'Detected on the extracted text',
    cPdf: 'PDF extraction mode', cPdfSub: 'Text layer versus true OCR',
    cDuration: 'Processing time distribution', cDurationSub: 'Exposes the slow tail an average hides',
    cScatter: 'Duration against page count', cScatterSub: 'Does time scale normally with size?',
    cProblems: 'Needs attention', cProblemsSub: 'Failed, timed out or interrupted',

    mReq: 'Req', mPages: 'Pages', mChars: 'Chars',
    embeddedText: 'Embedded text', requiredOcr: 'Required OCR', textLayer: 'text layer',
    avgSuffix: 'average',

    stSuccess: 'Success', stFailed: 'Failed', stTimeout: 'Timed out',
    stProcessing: 'Processing', stInterrupted: 'Interrupted',
    lUzL: 'Uzbek Latin', lUzC: 'Uzbek Cyrillic', lRu: 'Russian', lEn: 'English', lUnknown: 'Unknown',

    pages: 'pages', seconds: 'seconds',
    noData: 'No data for this selection',
    allClear: 'Nothing needs attention',
    loading: 'Loading your statistics…',
    failedLoad: 'Could not load your statistics.',

    langConfirmTitle: 'Change Language',
    langConfirmMsg: (l: string) => `Switch the interface language to ${l}?`,
    confirm: 'Yes, change', cancel: 'Cancel',
    sessionExpired: 'Session expired. Please log in again.',

    officialDesc: 'OCR — Internal Platform of the Central Bank of Uzbekistan for Extracting Text from Internal Documents',
    aboutCbu: 'About CBU', executiveB: 'The Executive Board', legislation: 'Legislation',
    publications: 'Publications', dataStats: 'Data & Stats', services: 'Services',
    exchangeR: 'Exchange Rates', policyR: 'Policy Rate', paymentS: 'Payment Systems',
    licensing: 'Licensing', pressCenter: 'Press Centre', contact: 'Contact',
    addressS: 'Islam Karimov St. 6',
    copyright: '© 2026 Central Bank of the Republic of Uzbekistan. All rights reserved.',
    privacyPolicy: 'Privacy Policy', termsOfUse: 'Terms of Use',
  },

  ru: {
    bankName: 'Центральный Банк Республики Узбекистан',
    deptSubtitle: 'Платформа распознавания и извлечения текста',
    appName: 'OCR',
    navUpload: 'Извлечение текста', navFileUploads: 'Загрузки файлов', navStats: 'Статистика',
    navInternalAll: 'Все внутренние задания', navExternalAll: 'Задания внешнего API', navOcrStatus: 'Состояние движков',
    usersBtn: 'Пользователи', sessionsBtn: 'Сессии', actionsBtn: 'Действия',
    administration: 'Администрирование', signOut: 'Выйти',

    pageTitle: 'Моя статистика OCR',
    pageDesc: 'Все показатели ниже отражают текущий выбор фильтров.',
    refresh: 'Обновить',

    period: 'ПЕРИОД', engine: 'ДВИЖОК', fileType: 'ТИП ФАЙЛА',
    language: 'ЯЗЫК', status: 'СТАТУС', dateRange: 'ДИАПАЗОН ДАТ',
    from: 'С', to: 'По', reset: 'Сброс', all: 'Все',
    p24h: '24 часа', p7d: '7 дней', p30d: '30 дней', p90d: '90 дней', pAll: 'Всё время', pCustom: 'Свой',

    kTotal: 'Всего запросов', kSuccess: 'Доля успешных', kPages: 'Обработано страниц',
    kChars: 'Символов', kMedian: 'Медианное время',
    kVsPrev: (s: string) => `${s} к предыдущему`,
    kNotSuccess: (n: string) => `${n} неуспешных`,
    kPerRequest: (s: string) => `${s} на запрос`,
    kPerPage: (s: string) => `${s} на страницу`,
    kP95: (s: string) => `p95 ${s}`,

    cRequests: 'Запросы во времени', cRequestsSub: 'Как часто вы пользуетесь сервисом',
    cStatus: 'Распределение статусов', cStatusSub: 'Состояние ваших заданий',
    cPages: 'Страницы во времени', cPagesSub: 'Реальная нагрузка, а не число запросов',
    cChars: 'Символы во времени', cCharsSub: 'Что фактически дал OCR',
    cEngine: 'PaddleOCR и Docling', cEngineSub: 'Доля вашей нагрузки',
    cTypeEngine: 'Тип файла по движку', cTypeEngineSub: 'Какой движок обрабатывает какой формат',
    cLanguage: 'Распределение языков', cLanguageSub: 'Определено по извлечённому тексту',
    cPdf: 'Режим извлечения PDF', cPdfSub: 'Текстовый слой против настоящего OCR',
    cDuration: 'Распределение времени', cDurationSub: 'Показывает медленный хвост',
    cScatter: 'Время и число страниц', cScatterSub: 'Растёт ли время вместе с размером?',
    cProblems: 'Требуют внимания', cProblemsSub: 'Ошибки, тайм-ауты и прерывания',

    mReq: 'Запр.', mPages: 'Стр.', mChars: 'Симв.',
    embeddedText: 'Текстовый слой', requiredOcr: 'Потребовался OCR', textLayer: 'текстовый слой',
    avgSuffix: 'в среднем',

    stSuccess: 'Успешно', stFailed: 'Ошибка', stTimeout: 'Тайм-аут',
    stProcessing: 'Обработка', stInterrupted: 'Прервано',
    lUzL: 'Узбекский (лат.)', lUzC: 'Узбекский (кир.)', lRu: 'Русский', lEn: 'Английский', lUnknown: 'Неизвестно',

    pages: 'страниц', seconds: 'секунды',
    noData: 'Нет данных для этого выбора',
    allClear: 'Ничего не требует внимания',
    loading: 'Загрузка статистики…',
    failedLoad: 'Не удалось загрузить статистику.',

    langConfirmTitle: 'Изменить язык',
    langConfirmMsg: (l: string) => `Сменить язык интерфейса на ${l}?`,
    confirm: 'Да, изменить', cancel: 'Отмена',
    sessionExpired: 'Сессия истекла. Пожалуйста, войдите снова.',

    officialDesc: 'OCR — Внутренняя платформа Центрального банка Узбекистана для извлечения текста из внутренних документов',
    aboutCbu: 'О ЦБУ', executiveB: 'Правление', legislation: 'Законодательство',
    publications: 'Публикации', dataStats: 'Данные и статистика', services: 'Услуги',
    exchangeR: 'Курсы валют', policyR: 'Ключевая ставка', paymentS: 'Платёжные системы',
    licensing: 'Лицензирование', pressCenter: 'Пресс-центр', contact: 'Контакты',
    addressS: 'Улица Ислама Каримова, 6',
    copyright: '© 2026 Центральный Банк Республики Узбекистан. Все права защищены.',
    privacyPolicy: 'Политика конфиденциальности', termsOfUse: 'Условия использования',
  },

  uz_c: {
    bankName: 'Ўзбекистон Республикаси Марказий Банки',
    deptSubtitle: 'Оптик матнни аниқлаш ва экстракция платформаси',
    appName: 'OCR',
    navUpload: 'Матнни ажратиб олиш', navFileUploads: 'Файл юкламалари', navStats: 'Статистика',
    navInternalAll: 'Барча ички ишлар', navExternalAll: 'Ташқи API ишлари', navOcrStatus: 'Двигателлар ҳолати',
    usersBtn: 'Фойдаланувчилар', sessionsBtn: 'Сессиялар', actionsBtn: 'Ҳаракатлар',
    administration: 'Администрация', signOut: 'Чиқиш',

    pageTitle: 'Менинг OCR статистикам',
    pageDesc: 'Қуйидаги барча кўрсаткичлар жорий фильтрларга мос келади.',
    refresh: 'Янгилаш',

    period: 'ДАВР', engine: 'ДВИГАТЕЛЬ', fileType: 'ФАЙЛ ТУРИ',
    language: 'ТИЛ', status: 'ҲОЛАТ', dateRange: 'САНА ОРАЛИҒИ',
    from: 'Дан', to: 'Гача', reset: 'Тозалаш', all: 'Барчаси',
    p24h: '24 соат', p7d: '7 кун', p30d: '30 кун', p90d: '90 кун', pAll: 'Барча вақт', pCustom: 'Танлаш',

    kTotal: 'Жами сўровлар', kSuccess: 'Муваффақият улуши', kPages: 'Ишланган саҳифалар',
    kChars: 'Белгилар', kMedian: 'Медиан вақт',
    kVsPrev: (s: string) => `олдингига нисбатан ${s}`,
    kNotSuccess: (n: string) => `${n} муваффақиятсиз`,
    kPerRequest: (s: string) => `сўровига ${s}`,
    kPerPage: (s: string) => `саҳифасига ${s}`,
    kP95: (s: string) => `p95 ${s}`,

    cRequests: 'Вақт бўйича сўровлар', cRequestsSub: 'Хизматдан қанчалик фойдаланасиз',
    cStatus: 'Ҳолатлар тақсимоти', cStatusSub: 'Ишларингиз ҳолати',
    cPages: 'Вақт бўйича саҳифалар', cPagesSub: 'Ҳақиқий юклама, сўров сони эмас',
    cChars: 'Вақт бўйича белгилар', cCharsSub: 'OCR ҳақиқатда нима берди',
    cEngine: 'PaddleOCR ва Docling', cEngineSub: 'Юкламангиз улуши',
    cTypeEngine: 'Двигатель бўйича файл тури', cTypeEngineSub: 'Қайси двигатель қайси форматни ишлайди',
    cLanguage: 'Тиллар тақсимоти', cLanguageSub: 'Ажратилган матн бўйича аниқланган',
    cPdf: 'PDF ажратиш усули', cPdfSub: 'Матн қатлами ёки ҳақиқий OCR',
    cDuration: 'Ишлаш вақти тақсимоти', cDurationSub: 'Секин ишларни кўрсатади',
    cScatter: 'Вақт ва саҳифалар сони', cScatterSub: 'Вақт ҳажм билан ортадими?',
    cProblems: 'Эътибор талаб қилади', cProblemsSub: 'Хатолик, вақт тугаши ва узилишлар',

    mReq: 'Сўров', mPages: 'Саҳифа', mChars: 'Белги',
    embeddedText: 'Матн қатлами', requiredOcr: 'OCR керак бўлди', textLayer: 'матн қатлами',
    avgSuffix: 'ўртача',

    stSuccess: 'Муваффақиятли', stFailed: 'Хатолик', stTimeout: 'Вақт тугади',
    stProcessing: 'Ишланмоқда', stInterrupted: 'Узилди',
    lUzL: 'Ўзбек (лотин)', lUzC: 'Ўзбек (кирил)', lRu: 'Русча', lEn: 'Инглизча', lUnknown: 'Номаълум',

    pages: 'саҳифа', seconds: 'сония',
    noData: 'Ушбу танлов учун маълумот йўқ',
    allClear: 'Эътибор талаб қиладиган нарса йўқ',
    loading: 'Статистика юкланмоқда…',
    failedLoad: 'Статистикани юклаб бўлмади.',

    langConfirmTitle: 'Тилни ўзгартириш',
    langConfirmMsg: (l: string) => `Интерфейс тилини ${l} тилига ўзгартирилсинми?`,
    confirm: 'Ҳа, ўзгартириш', cancel: 'Бекор қилиш',
    sessionExpired: 'Сессия муддати тугади. Илтимос, қайта киринг.',

    officialDesc: 'OCR — Ўзбекистон Марказий банкининг ички ҳужжатлардан матн ажратиб олиш платформаси',
    aboutCbu: 'МБ Ҳақида', executiveB: 'Бошқарув кенгаши', legislation: 'Қонунчилик',
    publications: 'Публикациялар', dataStats: 'Маълумотлар ва статистика', services: 'Хизматлар',
    exchangeR: 'Валюта курслари', policyR: 'Асосий ставка', paymentS: 'Тўлов тизимлари',
    licensing: 'Лицензиялаш', pressCenter: 'Ахборот хизмати', contact: 'Боғланиш',
    addressS: 'Ислом Каримов Кўчаси, 6',
    copyright: '© 2026 Ўзбекистон Республикаси Марказий Банки. Барча ҳуқуқлар ҳимояланган.',
    privacyPolicy: 'Махфийлик сиёсати', termsOfUse: 'Фойдаланиш шартлари',
  },

  uz_l: {
    bankName: "O'zbekiston Respublikasi Markaziy Banki",
    deptSubtitle: 'Optik matnni aniqlash va ekstraksiya platformasi',
    appName: 'OCR',
    navUpload: 'Matnni ajratib olish', navFileUploads: 'Fayl yuklamalari', navStats: 'Statistika',
    navInternalAll: 'Barcha ichki ishlar', navExternalAll: 'Tashqi API ishlari', navOcrStatus: 'Dvigatellar holati',
    usersBtn: 'Foydalanuvchilar', sessionsBtn: 'Sessiyalar', actionsBtn: 'Harakatlar',
    administration: 'Administratsiya', signOut: 'Chiqish',

    pageTitle: 'Mening OCR statistikam',
    pageDesc: 'Quyidagi barcha koʻrsatkichlar joriy filtrlarga mos keladi.',
    refresh: 'Yangilash',

    period: 'DAVR', engine: 'DVIGATEL', fileType: 'FAYL TURI',
    language: 'TIL', status: 'HOLAT', dateRange: 'SANA ORALIGʻI',
    from: 'Dan', to: 'Gacha', reset: 'Tozalash', all: 'Barchasi',
    p24h: '24 soat', p7d: '7 kun', p30d: '30 kun', p90d: '90 kun', pAll: 'Barcha vaqt', pCustom: 'Tanlash',

    kTotal: 'Jami soʻrovlar', kSuccess: 'Muvaffaqiyat ulushi', kPages: 'Ishlangan sahifalar',
    kChars: 'Belgilar', kMedian: 'Median vaqt',
    kVsPrev: (s: string) => `oldingiga nisbatan ${s}`,
    kNotSuccess: (n: string) => `${n} muvaffaqiyatsiz`,
    kPerRequest: (s: string) => `soʻroviga ${s}`,
    kPerPage: (s: string) => `sahifasiga ${s}`,
    kP95: (s: string) => `p95 ${s}`,

    cRequests: 'Vaqt boʻyicha soʻrovlar', cRequestsSub: 'Xizmatdan qanchalik foydalanasiz',
    cStatus: 'Holatlar taqsimoti', cStatusSub: 'Ishlaringiz holati',
    cPages: 'Vaqt boʻyicha sahifalar', cPagesSub: 'Haqiqiy yuklama, soʻrov soni emas',
    cChars: 'Vaqt boʻyicha belgilar', cCharsSub: 'OCR haqiqatda nima berdi',
    cEngine: 'PaddleOCR va Docling', cEngineSub: 'Yuklamangiz ulushi',
    cTypeEngine: 'Dvigatel boʻyicha fayl turi', cTypeEngineSub: 'Qaysi dvigatel qaysi formatni ishlaydi',
    cLanguage: 'Tillar taqsimoti', cLanguageSub: 'Ajratilgan matn boʻyicha aniqlangan',
    cPdf: 'PDF ajratish usuli', cPdfSub: 'Matn qatlami yoki haqiqiy OCR',
    cDuration: 'Ishlash vaqti taqsimoti', cDurationSub: 'Sekin ishlarni koʻrsatadi',
    cScatter: 'Vaqt va sahifalar soni', cScatterSub: 'Vaqt hajm bilan ortadimi?',
    cProblems: 'Eʼtibor talab qiladi', cProblemsSub: 'Xatolik, vaqt tugashi va uzilishlar',

    mReq: 'Soʻrov', mPages: 'Sahifa', mChars: 'Belgi',
    embeddedText: 'Matn qatlami', requiredOcr: 'OCR kerak boʻldi', textLayer: 'matn qatlami',
    avgSuffix: 'oʻrtacha',

    stSuccess: 'Muvaffaqiyatli', stFailed: 'Xatolik', stTimeout: 'Vaqt tugadi',
    stProcessing: 'Ishlanmoqda', stInterrupted: 'Uzildi',
    lUzL: 'Oʻzbek (lotin)', lUzC: 'Oʻzbek (kirill)', lRu: 'Ruscha', lEn: 'Inglizcha', lUnknown: 'Nomaʼlum',

    pages: 'sahifa', seconds: 'soniya',
    noData: 'Ushbu tanlov uchun maʼlumot yoʻq',
    allClear: 'Eʼtibor talab qiladigan narsa yoʻq',
    loading: 'Statistika yuklanmoqda…',
    failedLoad: 'Statistikani yuklab boʻlmadi.',

    langConfirmTitle: "Tilni o'zgartirish",
    langConfirmMsg: (l: string) => `Interfeys tilini ${l} tiliga o'zgartirilsinmi?`,
    confirm: "Ha, o'zgartirish", cancel: 'Bekor qilish',
    sessionExpired: 'Sessiya muddati tugadi. Iltimos, qayta kiring.',

    officialDesc: 'OCR — Oʻzbekiston Markaziy bankining ichki hujjatlardan matn ajratib olish platformasi',
    aboutCbu: 'MBU Haqida', executiveB: 'Boshqaruv kengashi', legislation: 'Qonunchilik',
    publications: 'Publikatsiyalar', dataStats: 'Maʼlumotlar va statistika', services: 'Xizmatlar',
    exchangeR: 'Valyuta kurslari', policyR: 'Asosiy stavka', paymentS: "To'lov tizimlari",
    licensing: 'Litsenziyalash', pressCenter: 'Axborot xizmati', contact: "Bog'lanish",
    addressS: "Islom Karimov Ko'chasi, 6",
    copyright: "© 2026 O'zbekiston Respublikasi Markaziy Banki. Barcha huquqlar himoyalangan.",
    privacyPolicy: 'Maxfiylik siyosati', termsOfUse: 'Foydalanish shartlari',
  },
};

type LangKey = keyof typeof TRANSLATIONS;
const LANG_LABELS: Record<LangKey, string> = { en: 'EN', ru: 'RU', uz_c: 'УЗ', uz_l: "O'Z" };
const LANG_NAMES:  Record<LangKey, string> = { en: 'English', ru: 'Русский', uz_c: 'Ўзбекча', uz_l: "O'zbekcha" };

interface User {
  user_id: string; username: string; first_name: string; last_name: string;
  department: string; language: string; is_active: boolean; is_admin: boolean;
}

interface Job {
  unique_job_id: string;
  filename: string;
  file_extension: string;
  file_size: number;
  page_count: number | null;
  language: string | null;
  method: string | null;
  status: string;
  extracted_text_length: number;
  created_at: string;
  duration: number | string | null;
  finished_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────
const num = (n: number) => String(Math.round(n ?? 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const compact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
};

const secs = (s: number | null) => (s == null ? '—' : s < 60 ? `${s.toFixed(2)} s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`);

const dmy = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Statistics helpers — the maths the backend is no longer doing
// ─────────────────────────────────────────────────────────────────────────────

/** Median of an unsorted list. Returns null on empty input. */
const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * p95 alongside the median. One 90-second scan drags an average upward and
 * hides that most jobs finish quickly; the pair shows the typical case and
 * the tail.
 */
const percentile = (xs: number[], p: number): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(Math.floor(s.length * p), s.length - 1)];
};

type Bucket = 'hour' | 'day' | 'week' | 'month';

/** Granularity follows the span: a day as one dot is useless, two years of daily points unreadable. */
const pickBucket = (from: Date, to: Date): Bucket => {
  const days = (to.getTime() - from.getTime()) / 86_400_000;
  if (days <= 2) return 'hour';
  if (days <= 92) return 'day';
  if (days <= 400) return 'week';
  return 'month';
};

const truncate = (d: Date, b: Bucket): Date => {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  if (b === 'hour') return x;
  x.setHours(0);
  if (b === 'day') return x;
  if (b === 'week') { x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
  x.setDate(1);
  return x;
};

const stepBucket = (d: Date, b: Bucket): Date => {
  const x = new Date(d);
  if (b === 'hour') x.setHours(x.getHours() + 1);
  else if (b === 'day') x.setDate(x.getDate() + 1);
  else if (b === 'week') x.setDate(x.getDate() + 7);
  else x.setMonth(x.getMonth() + 1);
  return x;
};

const shortLabel = (d: Date, b: Bucket, locale: string) => {
  if (b === 'hour') return `${String(d.getHours()).padStart(2, '0')}:00`;
  if (b === 'month') return d.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
};

// ─────────────────────────────────────────────────────────────────────────────
// Chart primitives — inline SVG, no charting library
// ─────────────────────────────────────────────────────────────────────────────

const AreaLine: React.FC<{ values: number[]; labels: string[]; color: string }> =
({ values, labels, color }) => {
  const W = 520, H = 210, PAD_L = 8, PAD_R = 8, PAD_T = 12, PAD_B = 26;
  const max = Math.max(1, ...values);
  const n = values.length;
  const x = (i: number) => PAD_L + (n === 1 ? (W - PAD_L - PAD_R) / 2 : ((W - PAD_L - PAD_R) * i) / (n - 1));
  const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / max);

  const line = values.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${H - PAD_B} L ${x(0).toFixed(1)} ${H - PAD_B} Z`;

  const ticks = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i && v >= 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 1, 2, 3].map((g) => (
        <line key={g} x1={PAD_L} x2={W - PAD_R}
          y1={PAD_T + ((H - PAD_T - PAD_B) * g) / 3} y2={PAD_T + ((H - PAD_T - PAD_B) * g) / 3}
          stroke="#eef2f6" strokeWidth="1" />
      ))}
      <path d={area} fill={color} opacity="0.10" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {n > 0 && <circle cx={x(n - 1)} cy={y(values[n - 1])} r="4.5" fill={color} />}
      <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke={CELL_BORDER} strokeWidth="1" />
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={H - 8} fontSize="11" fill="#93a1b0"
          textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{labels[i]}</text>
      ))}
    </svg>
  );
};

const HBars: React.FC<{ rows: { label: string; value: number; color: string; display?: string }[] }> =
({ rows }) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '112px', fontSize: '13px', color: '#25313d', flexShrink: 0 }}>{r.label}</div>
          <div style={{ flex: 1, height: '16px', background: '#f1f4f8', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(r.value ? 2 : 0, (r.value / max) * 100)}%`, height: '100%', background: r.color, borderRadius: '8px', transition: 'width 0.25s' }} />
          </div>
          <div style={{ width: '68px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: r.color, flexShrink: 0 }}>
            {r.display ?? num(r.value)}
          </div>
        </div>
      ))}
    </div>
  );
};

const Pie: React.FC<{ slices: { value: number; color: string }[] }> = ({ slices }) => {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 78, C = 90;
  if (!total) return <svg viewBox="0 0 180 180" style={{ width: '180px' }}><circle cx={C} cy={C} r={R} fill="#eef2f6" /></svg>;

  let start = -Math.PI / 2;
  return (
    <svg viewBox="0 0 180 180" style={{ width: '180px', height: 'auto' }}>
      {slices.map((s, i) => {
        const frac = s.value / total;
        const end = start + frac * Math.PI * 2;
        const large = frac > 0.5 ? 1 : 0;
        const x1 = C + R * Math.cos(start), y1 = C + R * Math.sin(start);
        const x2 = C + R * Math.cos(end),   y2 = C + R * Math.sin(end);
        const mid = (start + end) / 2;
        const path = frac >= 0.999
          ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z`
          : `M ${C} ${C} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
        const el = (
          <g key={i}>
            <path d={path} fill={s.color} stroke="#fff" strokeWidth="2.5" />
            {frac > 0.06 && (
              <text x={C + R * 0.62 * Math.cos(mid)} y={C + R * 0.62 * Math.sin(mid) + 6}
                fontSize="17" fontWeight="700" fill="#fff" textAnchor="middle">
                {Math.round(frac * 100)}%
              </text>
            )}
          </g>
        );
        start = end;
        return el;
      })}
    </svg>
  );
};

const Donut: React.FC<{ fraction: number; color: string; caption: string }> = ({ fraction, color, caption }) => {
  const R = 62, C = 78, circ = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 156 156" style={{ width: '156px', height: 'auto' }}>
      <circle cx={C} cy={C} r={R} fill="none" stroke="#eef2f6" strokeWidth="16" />
      <circle cx={C} cy={C} r={R} fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
        strokeDasharray={`${(circ * fraction).toFixed(1)} ${circ.toFixed(1)}`}
        transform={`rotate(-90 ${C} ${C})`} />
      <text x={C} y={C + 2} fontSize="27" fontWeight="700" fill={color} textAnchor="middle">
        {Math.round(fraction * 100)}%
      </text>
      <text x={C} y={C + 22} fontSize="11" fill="#93a1b0" textAnchor="middle">{caption}</text>
    </svg>
  );
};

const StackedBars: React.FC<{ groups: { label: string; parts: { value: number; color: string }[] }[] }> =
({ groups }) => {
  const W = 520, H = 210, PAD_B = 28, PAD_T = 10;
  const max = Math.max(1, ...groups.map((g) => g.parts.reduce((s, p) => s + p.value, 0)));
  const slot = W / Math.max(1, groups.length);
  const bw = Math.min(64, slot * 0.5);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {groups.map((g, i) => {
        const cx = slot * (i + 0.5);
        let acc = 0;
        return (
          <g key={g.label}>
            {g.parts.map((p, j) => {
              const h = ((H - PAD_T - PAD_B) * p.value) / max;
              const yTop = H - PAD_B - acc - h;
              acc += h;
              return h > 0 ? <rect key={j} x={cx - bw / 2} y={yTop} width={bw} height={h} fill={p.color} rx="4" /> : null;
            })}
            <text x={cx} y={H - 9} fontSize="11.5" fill="#6b7784" textAnchor="middle">{g.label}</text>
          </g>
        );
      })}
      <line x1="0" x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke={CELL_BORDER} strokeWidth="1" />
    </svg>
  );
};

const Scatter: React.FC<{ points: { x: number; y: number; color: string }[]; xLabel: string; yLabel: string }> =
({ points, xLabel, yLabel }) => {
  const W = 520, H = 230, PAD_L = 34, PAD_R = 10, PAD_T = 12, PAD_B = 32;
  const maxX = Math.max(1, ...points.map((p) => p.x));
  const maxY = Math.max(1, ...points.map((p) => p.y));
  const px = (x: number) => PAD_L + ((W - PAD_L - PAD_R) * x) / maxX;
  const py = (y: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - y / maxY);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[0, 1, 2, 3].map((g) => (
        <line key={g} x1={PAD_L} x2={W - PAD_R}
          y1={PAD_T + ((H - PAD_T - PAD_B) * g) / 3} y2={PAD_T + ((H - PAD_T - PAD_B) * g) / 3}
          stroke="#eef2f6" strokeWidth="1" />
      ))}
      {points.map((p, i) => (
        <circle key={i} cx={px(p.x)} cy={py(p.y)} r="4" fill={p.color} opacity="0.62" />
      ))}
      <line x1={PAD_L} x2={W - PAD_R} y1={H - PAD_B} y2={H - PAD_B} stroke={CELL_BORDER} strokeWidth="1" />
      <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={H - PAD_B} stroke={CELL_BORDER} strokeWidth="1" />
      <text x={(W + PAD_L) / 2} y={H - 8} fontSize="11" fill="#93a1b0" textAnchor="middle">{xLabel}</text>
      <text x={12} y={(H - PAD_B + PAD_T) / 2} fontSize="11" fill="#93a1b0" textAnchor="middle"
        transform={`rotate(-90 12 ${(H - PAD_B + PAD_T) / 2})`}>{yLabel}</text>
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Card shell
// ─────────────────────────────────────────────────────────────────────────────
const Card: React.FC<{ title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }> =
({ title, subtitle, right, children }) => (
  <div style={{ background: 'white', border: `1px solid ${CELL_BORDER}`, borderRadius: '16px', padding: '20px 22px', boxShadow: '0 2px 12px rgba(10,40,70,0.05)', display: 'flex', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '15.5px', fontWeight: 700, color: NAVY }}>{title}</div>
        {subtitle && <div style={{ fontSize: '12.5px', color: '#93a1b0', marginTop: '3px' }}>{subtitle}</div>}
      </div>
      <div style={{ flex: 1 }} />
      {right}
    </div>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>{children}</div>
  </div>
);

const Legend: React.FC<{ items: { label: string; color: string }[] }> = ({ items }) => (
  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
    {items.map((i) => (
      <span key={i.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7784' }}>
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: i.color }} />
        {i.label}
      </span>
    ))}
  </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ padding: '46px 10px', textAlign: 'center', color: '#a9b6c2', fontSize: '13.5px' }}>{text}</div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
const MyStatsPage: React.FC = () => {
  const navigate = useNavigate();
  const currentPath = '/my_stats';

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth <= 1200);
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [lang, setLang] = useState<LangKey>('en');
  const [pendingLang, setPendingLang] = useState<LangKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const locale = lang === 'ru' ? 'ru-RU' : lang.startsWith('uz') ? 'ru-RU' : 'en-GB';

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* ── Filters ── */
  const [period, setPeriod] = useState<'24h' | '7d' | '30d' | '90d' | 'all' | 'custom'>('30d');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [fMethod, setFMethod] = useState('all');
  const [fType, setFType] = useState('all');
  const [fLang, setFLang] = useState('all');
  const [fStatus, setFStatus] = useState('all');
  const [engineMetric, setEngineMetric] = useState<'requests' | 'pages' | 'characters'>('requests');

  /* Period pills and the custom range are mutually exclusive: picking a pill
     clears the dates, and typing a date switches the period to custom. */
  const choosePeriod = (p: typeof period) => {
    setPeriod(p);
    if (p !== 'custom') { setDateFrom(''); setDateTo(''); }
  };
  const chooseDate = (which: 'from' | 'to', value: string) => {
    if (which === 'from') setDateFrom(value); else setDateTo(value);
    setPeriod('custom');
  };

  const resetFilters = () => {
    setPeriod('30d'); setDateFrom(''); setDateTo('');
    setFMethod('all'); setFType('all'); setFLang('all'); setFStatus('all');
  };

  /* ── Fonts + responsive ── */
  useEffect(() => {
    [
      'https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    ].forEach((href) => {
      if (!document.querySelector(`link[href="${href}"]`)) {
        const l = document.createElement('link');
        l.href = href; l.rel = 'stylesheet';
        document.head.appendChild(l);
      }
    });
    const onResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setIsNarrow(window.innerWidth <= 1200);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* ── One fetch, then everything happens in the browser ── */
  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/get_ocr_internal_user_stats');
      if (!res || !res.ok) throw new Error();
      const payload = await res.json();
      if (payload.user) {
        setUser(payload.user);
        const mapped = (['en', 'ru', 'uz_c', 'uz_l'] as LangKey[]).find((k) => k === payload.user.language);
        if (mapped) setLang(mapped);
      }
      // Status 'Failed' with empty Data just means no jobs yet.
      setJobs(Array.isArray(payload.Data) ? payload.Data : []);
      setError(false);
    } catch (e) {
      console.error('Failed to load stats:', e);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  // ── The window the period selection describes ───────────────────────────
  const [from, to] = useMemo<[Date, Date]>(() => {
    const now = new Date();
    if (period === 'custom') {
      const f = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(0);
      const tt = dateTo ? new Date(`${dateTo}T23:59:59`) : now;
      return [f, tt];
    }
    if (period === 'all') {
      const earliest = jobs.length
        ? new Date(Math.min(...jobs.map((j) => new Date(j.created_at).getTime())))
        : now;
      return [earliest, now];
    }
    const hours = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30, '90d': 24 * 90 }[period];
    return [new Date(now.getTime() - hours * 3_600_000), now];
  }, [period, dateFrom, dateTo, jobs]);

  // ── Filtering ────────────────────────────────────────────────────────────
  const rows = useMemo(() => jobs.filter((j) => {
    const at = new Date(j.created_at).getTime();
    if (at < from.getTime() || at > to.getTime()) return false;
    if (fMethod !== 'all' && j.method !== fMethod) return false;
    if (fType !== 'all' && (j.file_extension || '').toLowerCase() !== fType) return false;
    if (fLang !== 'all' && (j.language ?? 'unknown') !== fLang) return false;
    if (fStatus !== 'all' && j.status !== fStatus) return false;
    return true;
  }), [jobs, from, to, fMethod, fType, fLang, fStatus]);

  // Same length of time immediately before, for the trend figure.
  const previousCount = useMemo(() => {
    const span = to.getTime() - from.getTime();
    const pStart = from.getTime() - span;
    return jobs.filter((j) => {
      const at = new Date(j.created_at).getTime();
      if (at < pStart || at >= from.getTime()) return false;
      if (fMethod !== 'all' && j.method !== fMethod) return false;
      if (fType !== 'all' && (j.file_extension || '').toLowerCase() !== fType) return false;
      if (fLang !== 'all' && (j.language ?? 'unknown') !== fLang) return false;
      if (fStatus !== 'all' && j.status !== fStatus) return false;
      return true;
    }).length;
  }, [jobs, from, to, fMethod, fType, fLang, fStatus]);

  // ── Every figure, computed in one pass ───────────────────────────────────
  const stats = useMemo(() => {
    let successful = 0, pages = 0, chars = 0;
    const durations: number[] = [];
    const statusCount: Record<string, number> = {};
    const langCount: Record<string, number> = {};
    const typeMethod: Record<string, Record<string, number>> = {};
    const methodAgg: Record<string, { requests: number; pages: number; characters: number; durations: number[]; ok: number }> = {};
    const durBuckets: Record<string, number> = { '<1s': 0, '1-5s': 0, '5-10s': 0, '10-30s': 0, '30-60s': 0, '>60s': 0 };
    let pdfEmbedded = 0, pdfOcr = 0;
    const scatter: { x: number; y: number; color: string }[] = [];
    const problems: Job[] = [];

    for (const j of rows) {
      const dur = j.duration == null ? null : Number(j.duration);
      const p = j.page_count;                       // null for DOCX — no pages exist
      const c = j.extracted_text_length ?? 0;
      const ext = (j.file_extension || '').toLowerCase();

      statusCount[j.status] = (statusCount[j.status] ?? 0) + 1;
      if (j.status === 'success') successful++;
      if (p) pages += p;
      chars += c;
      if (dur != null && isFinite(dur)) durations.push(dur);

      const lg = j.language ?? 'unknown';
      langCount[lg] = (langCount[lg] ?? 0) + 1;

      // Jobs written before the method column existed cannot honestly be
      // attributed to either engine, so they sit out of the engine charts.
      if (j.method) {
        const m = methodAgg[j.method] ?? (methodAgg[j.method] = { requests: 0, pages: 0, characters: 0, durations: [], ok: 0 });
        m.requests++; m.pages += p ?? 0; m.characters += c;
        if (j.status === 'success') m.ok++;
        if (dur != null && isFinite(dur)) m.durations.push(dur);

        const group = ext === '.jpg' || ext === '.jpeg' ? 'JPEG' : ext.replace('.', '').toUpperCase();
        typeMethod[group] = typeMethod[group] ?? {};
        typeMethod[group][j.method] = (typeMethod[group][j.method] ?? 0) + 1;

        // docling on a PDF means pdf_is_selectable() said yes; paddle means no.
        if (ext === '.pdf') {
          if (j.method === 'docling') pdfEmbedded++;
          else if (j.method === 'paddle') pdfOcr++;
        }
      }

      if (dur != null && isFinite(dur)) {
        const b = dur < 1 ? '<1s' : dur < 5 ? '1-5s' : dur < 10 ? '5-10s' : dur < 30 ? '10-30s' : dur < 60 ? '30-60s' : '>60s';
        durBuckets[b]++;
      }

      if (j.status === 'success' && p && dur != null && isFinite(dur)) {
        scatter.push({ x: p, y: dur, color: j.method === 'docling' ? C_DOCLING : C_PADDLE });
      }

      if (['failed', 'timeout', 'interrupted'].includes(j.status)) problems.push(j);
    }

    // Timeline — gaps filled with zeros so the line does not jump across days
    const bucket = pickBucket(from, to);
    const series = new Map<number, { requests: number; pages: number; characters: number }>();
    let cursor = truncate(from, bucket);
    const last = truncate(to, bucket);
    let guard = 0;
    while (cursor <= last && guard++ < 400) {
      series.set(cursor.getTime(), { requests: 0, pages: 0, characters: 0 });
      cursor = stepBucket(cursor, bucket);
    }
    for (const j of rows) {
      const k = truncate(new Date(j.created_at), bucket).getTime();
      const slot = series.get(k);
      if (slot) {
        slot.requests++;
        slot.pages += j.page_count ?? 0;
        slot.characters += j.extracted_text_length ?? 0;
      }
    }
    const timeline = [...series.entries()].sort((a, b) => a[0] - b[0]);

    return {
      total: rows.length,
      successful,
      pages,
      chars,
      medianDuration: median(durations),
      p95: percentile(durations, 0.95),
      statusCount,
      langCount,
      typeMethod,
      methodAgg,
      durBuckets,
      pdfEmbedded,
      pdfOcr,
      scatter: scatter.length > 2000
        ? scatter.filter(() => Math.random() < 2000 / scatter.length)
        : scatter,
      problems: problems
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8),
      timelineLabels: timeline.map(([ms]) => shortLabel(new Date(ms), bucket, locale)),
      timelineRequests: timeline.map(([, v]) => v.requests),
      timelinePages: timeline.map(([, v]) => v.pages),
      timelineChars: timeline.map(([, v]) => v.characters),
    };
  }, [rows, from, to, locale]);

  const successRate = stats.total ? stats.successful / stats.total : null;
  const trend = previousCount ? ((stats.total - previousCount) / previousCount) * 100 : null;

  const statusMeta: Record<string, { label: string; color: string }> = {
    success:     { label: t.stSuccess,     color: C_GREEN },
    failed:      { label: t.stFailed,      color: C_RED },
    timeout:     { label: t.stTimeout,     color: C_ORANGE },
    interrupted: { label: t.stInterrupted, color: C_AMBER },
    processing:  { label: t.stProcessing,  color: C_BLUE },
  };
  const langMeta: Record<string, string> = {
    uz_l: t.lUzL, uz_c: t.lUzC, ru: t.lRu, en: t.lEn, unknown: t.lUnknown,
  };

  const getInitials = (u: User | null) => {
    if (!u) return '?';
    return ((u.first_name?.[0] ?? '') + (u.last_name?.[0] ?? '')).toUpperCase() || u.username?.[0]?.toUpperCase() || '?';
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: '13.5px', fontFamily: 'inherit',
    color: '#25313d', background: '#f9fbfc', border: `1px solid ${CELL_BORDER}`,
    borderRadius: '9px', outline: 'none', cursor: 'pointer', appearance: 'none', boxSizing: 'border-box',
  };
  const fieldLabel: React.CSSProperties = {
    fontSize: '10.5px', fontWeight: 700, color: '#93a1b0', letterSpacing: '0.5px', marginBottom: '7px', display: 'block',
  };

  const gridCols = isMobile ? '1fr' : isNarrow ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)';

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#f0f2f5', fontFamily: '"Inter","Segoe UI",system-ui,-apple-system,sans-serif', textAlign: 'left' }}>

      {/* Language modal */}
      {pendingLang && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,30,46,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, backdropFilter: 'blur(4px)' }}
          onClick={() => setPendingLang(null)}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '32px 28px', maxWidth: '380px', width: '90%', boxShadow: '0 32px 64px rgba(0,0,0,0.25)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ width: '56px', height: '56px', background: '#e8f0fe', borderRadius: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: NAVY }}>language</span>
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: NAVY }}>{t.langConfirmTitle}</h3>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b' }}>{t.langConfirmMsg(LANG_NAMES[pendingLang])}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setPendingLang(null)} style={{ flex: 1, padding: '11px', background: '#f1f5f9', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>{t.cancel}</button>
              <button onClick={() => applyLanguageChange(pendingLang)} style={{ flex: 1, padding: '11px', background: `linear-gradient(135deg,${NAVY},#1a5080)`, border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>{t.confirm}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ HEADER ══════════════ */}
      <header style={{ width: '100%', background: `linear-gradient(135deg,${NAVY} 0%,#1a4b70 100%)`, boxShadow: '0 4px 20px rgba(0,40,70,0.18)', borderBottom: `3px solid ${GOLD}`, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: isMobile ? '0 12px' : '0 20px', height: '60px', minWidth: 0 }}>
          <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, cursor: 'pointer' }}>
            <div style={{ width: '44px', height: '44px', background: 'white', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', padding: '4px' }}>
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

          {!isMobile && <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.15)' }} />}

          <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, overflowX: 'auto' }}>
            {NAV_ITEMS.map((item) => {
              const active = currentPath === item.path;
              return (
                <button key={item.path} onClick={() => navigate(item.path)} title={t[item.labelKey] as string}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: isMobile ? '7px 10px' : '7px 14px',
                    background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                    border: active ? '1px solid rgba(255,255,255,0.35)' : '1px solid transparent',
                    borderBottom: active ? `2px solid ${GOLD}` : '2px solid transparent',
                    borderRadius: '8px', color: active ? 'white' : 'rgba(255,255,255,0.68)',
                    fontFamily: 'inherit', fontSize: '14px', fontWeight: active ? 600 : 400,
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>{item.icon}</span>
                  {!isMobile && (t[item.labelKey] as string)}
                </button>
              );
            })}
          </nav>

          <div style={{ flex: 1, minWidth: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(255,255,255,0.12)' }}>
              {(Object.entries(LANG_LABELS) as [LangKey, string][]).map(([key, label]) => (
                <button key={key} onClick={() => key !== lang && setPendingLang(key)} style={{
                  background: lang === key ? GOLD : 'transparent',
                  color: lang === key ? '#0a2a40' : 'rgba(255,255,255,0.75)',
                  border: 'none', borderRadius: '6px', padding: '4px 8px', fontSize: '11px', fontWeight: 600,
                  fontFamily: 'inherit', cursor: lang === key ? 'default' : 'pointer', minWidth: '26px',
                }}>{label}</button>
              ))}
            </div>

            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button onClick={() => setDropdownOpen((o) => !o)} style={{
                background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(233,183,65,0.5)',
                borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: '16px', fontWeight: 700, fontFamily: 'inherit',
              }}>{getInitials(user)}</button>

              {dropdownOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, background: 'white', borderRadius: '16px', minWidth: '270px', boxShadow: '0 20px 40px rgba(0,0,0,0.18)', overflow: 'hidden', border: '1px solid #e2e8f0', zIndex: 200 }}>
                  <div style={{ padding: '18px 20px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(135deg,#f8fafc,#eef2f7)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: `linear-gradient(135deg,${NAVY},#1a5080)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '17px', fontWeight: 700, border: `2px solid ${GOLD}` }}>
                        {getInitials(user)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: NAVY, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user ? `${user.first_name} ${user.last_name}` : '—'}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '12px' }}>@{user?.username ?? '—'}</div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '5px', padding: '2px 8px', background: 'rgba(233,183,65,0.12)', border: '1px solid rgba(233,183,65,0.3)', borderRadius: '20px', fontSize: '11px', color: NAVY, fontWeight: 600 }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>domain</span>
                          {user?.department ?? '—'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {user?.is_admin && (
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{t.administration}</div>
                      {ADMIN_LINKS.map(({ icon, labelKey, route, color, bg }) => (
                        <button key={route} onClick={() => { navigate(route); setDropdownOpen(false); }}
                          style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = bg; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '18px', color }}>{icon}</span>
                          <span style={{ flex: 1 }}>{t[labelKey] as string}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#cbd5e1' }}>chevron_right</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div style={{ padding: '8px 10px' }}>
                    <button onClick={() => doLogout()}
                      style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
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

      {/* ══════════════ MAIN ══════════════ */}
      <main style={{ flex: 1, padding: isMobile ? '20px 14px' : '28px 32px' }}>
        <div style={{ maxWidth: '1700px', margin: '0 auto' }}>

          {/* Title */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: isMobile ? '21px' : '26px', fontWeight: 700, color: NAVY, letterSpacing: '-0.4px' }}>{t.pageTitle}</h1>
              <p style={{ margin: '5px 0 0', fontSize: '13.5px', color: '#6b7784' }}>{t.pageDesc}</p>
            </div>
            <div style={{ flex: 1 }} />
            <button onClick={fetchData} style={{ padding: '10px 18px', background: 'white', border: `1px solid ${CELL_BORDER}`, borderRadius: '10px', color: NAVY, fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'inherit' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
              {t.refresh}
            </button>
          </div>

          {/* ── Filters ── */}
          <div style={{ background: 'white', border: `1px solid ${CELL_BORDER}`, borderRadius: '16px', padding: isMobile ? '18px' : '20px 22px', marginBottom: '20px', boxShadow: '0 2px 12px rgba(10,40,70,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isNarrow ? '1fr 1fr' : 'auto 1fr', gap: '18px', alignItems: 'start' }}>

              {/* Period pills */}
              <div>
                <span style={fieldLabel}>{t.period}</span>
                <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                  {([['24h', t.p24h], ['7d', t.p7d], ['30d', t.p30d], ['90d', t.p90d], ['all', t.pAll]] as const).map(([key, label]) => {
                    const on = period === key;
                    return (
                      <button key={key} onClick={() => choosePeriod(key as typeof period)}
                        style={{
                          padding: '9px 15px', borderRadius: '9px', fontSize: '13.5px',
                          fontWeight: on ? 600 : 400, fontFamily: 'inherit',
                          background: on ? NAVY : '#f4f7fa',
                          color: on ? 'white' : '#6b7784',
                          border: on ? 'none' : `1px solid ${CELL_BORDER}`,
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>{label}</button>
                    );
                  })}
                </div>
              </div>

              {/* Dropdowns + custom range */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <div>
                  <span style={fieldLabel}>{t.engine}</span>
                  <select value={fMethod} onChange={(e) => setFMethod(e.target.value)} style={selectStyle}>
                    <option value="all">{t.all}</option>
                    <option value="paddle">PaddleOCR</option>
                    <option value="docling">Docling</option>
                  </select>
                </div>
                <div>
                  <span style={fieldLabel}>{t.fileType}</span>
                  <select value={fType} onChange={(e) => setFType(e.target.value)} style={selectStyle}>
                    <option value="all">{t.all}</option>
                    <option value=".pdf">PDF</option>
                    <option value=".docx">DOCX</option>
                    <option value=".jpg">JPG</option>
                    <option value=".jpeg">JPEG</option>
                    <option value=".png">PNG</option>
                  </select>
                </div>
                <div>
                  <span style={fieldLabel}>{t.language}</span>
                  <select value={fLang} onChange={(e) => setFLang(e.target.value)} style={selectStyle}>
                    <option value="all">{t.all}</option>
                    <option value="uz_l">{t.lUzL}</option>
                    <option value="uz_c">{t.lUzC}</option>
                    <option value="ru">{t.lRu}</option>
                    <option value="en">{t.lEn}</option>
                    <option value="unknown">{t.lUnknown}</option>
                  </select>
                </div>
                <div>
                  <span style={fieldLabel}>{t.status}</span>
                  <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={selectStyle}>
                    <option value="all">{t.all}</option>
                    <option value="success">{t.stSuccess}</option>
                    <option value="failed">{t.stFailed}</option>
                    <option value="timeout">{t.stTimeout}</option>
                    <option value="interrupted">{t.stInterrupted}</option>
                    <option value="processing">{t.stProcessing}</option>
                  </select>
                </div>
                <div>
                  <span style={fieldLabel}>{t.from}</span>
                  <input type="date" value={dateFrom} onChange={(e) => chooseDate('from', e.target.value)}
                    style={{ ...selectStyle, colorScheme: 'light', opacity: period === 'custom' ? 1 : 0.6 }} />
                </div>
                <div>
                  <span style={fieldLabel}>{t.to}</span>
                  <input type="date" value={dateTo} onChange={(e) => chooseDate('to', e.target.value)}
                    style={{ ...selectStyle, colorScheme: 'light', opacity: period === 'custom' ? 1 : 0.6 }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={resetFilters}
                    style={{ width: '100%', padding: '10px 14px', background: '#fdeaea', border: '1px solid #f3a9a9', borderRadius: '9px', color: C_RED, fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t.reset}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div style={{ background: 'white', border: `1px solid ${CELL_BORDER}`, borderRadius: '16px', padding: '90px', textAlign: 'center', color: '#6b7784' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '46px', display: 'block', marginBottom: '16px', color: NAVY, animation: 'spin 1.6s linear infinite' }}>progress_activity</span>
              {t.loading}
            </div>
          ) : error ? (
            <div style={{ background: 'white', border: `1px solid ${CELL_BORDER}`, borderRadius: '16px', padding: '90px', textAlign: 'center', color: C_RED }}>
              <span className="material-symbols-outlined" style={{ fontSize: '46px', display: 'block', marginBottom: '16px' }}>error</span>
              {t.failedLoad}
            </div>
          ) : (
            <>
              {/* ── KPI cards ── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : isNarrow ? 'repeat(3,1fr)' : 'repeat(5,1fr)', gap: '16px', marginBottom: '20px' }}>
                {[
                  {
                    label: t.kTotal, value: num(stats.total), color: NAVY,
                    sub: trend == null ? '—' : t.kVsPrev(`${trend >= 0 ? '+' : ''}${trend.toFixed(1)}%`),
                    subColor: trend == null ? '#93a1b0' : trend >= 0 ? C_GREEN : C_RED,
                  },
                  {
                    label: t.kSuccess, value: successRate == null ? '—' : `${(successRate * 100).toFixed(1)}%`,
                    color: successRate != null && successRate >= 0.95 ? C_GREEN : C_ORANGE,
                    sub: t.kNotSuccess(num(stats.total - stats.successful)), subColor: '#93a1b0',
                  },
                  {
                    label: t.kPages, value: num(stats.pages), color: C_CYAN,
                    sub: stats.total ? t.kPerRequest((stats.pages / stats.total).toFixed(1)) : '—', subColor: '#93a1b0',
                  },
                  {
                    label: t.kChars, value: compact(stats.chars), color: C_INDIGO,
                    sub: stats.pages ? t.kPerPage(num(stats.chars / stats.pages)) : '—', subColor: '#93a1b0',
                  },
                  {
                    label: t.kMedian, value: stats.medianDuration == null ? '—' : secs(stats.medianDuration), color: C_AMBER,
                    sub: stats.p95 == null ? '—' : t.kP95(secs(stats.p95)), subColor: '#93a1b0',
                  },
                ].map((k) => (
                  <div key={k.label} style={{ background: 'white', border: `1px solid ${CELL_BORDER}`, borderLeft: `4px solid ${k.color}`, borderRadius: '14px', padding: '18px 20px', boxShadow: '0 2px 12px rgba(10,40,70,0.05)' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#6b7784', marginBottom: '9px' }}>{k.label}</div>
                    <div style={{ fontSize: '29px', fontWeight: 700, color: k.color, letterSpacing: '-0.8px', lineHeight: 1 }}>{k.value}</div>
                    <div style={{ fontSize: '11.5px', color: k.subColor, marginTop: '8px' }}>{k.sub}</div>
                  </div>
                ))}
              </div>

              {/* ── Charts: rows of three ── */}
              <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '20px', marginBottom: '20px' }}>

                <Card title={t.cRequests} subtitle={t.cRequestsSub}>
                  {stats.total ? <AreaLine values={stats.timelineRequests} labels={stats.timelineLabels} color={C_BLUE} /> : <Empty text={t.noData} />}
                </Card>

                <Card title={t.cStatus} subtitle={t.cStatusSub}>
                  {stats.total ? (
                    <HBars rows={Object.keys(statusMeta)
                      .filter((s) => stats.statusCount[s])
                      .map((s) => ({
                        label: statusMeta[s].label,
                        value: stats.statusCount[s],
                        color: statusMeta[s].color,
                        display: `${((stats.statusCount[s] / stats.total) * 100).toFixed(1)}%`,
                      }))} />
                  ) : <Empty text={t.noData} />}
                </Card>

                <Card title={t.cPages} subtitle={t.cPagesSub}>
                  {stats.pages ? <AreaLine values={stats.timelinePages} labels={stats.timelineLabels} color={C_CYAN} /> : <Empty text={t.noData} />}
                </Card>

                <Card title={t.cChars} subtitle={t.cCharsSub}>
                  {stats.chars ? <AreaLine values={stats.timelineChars} labels={stats.timelineLabels} color={C_INDIGO} /> : <Empty text={t.noData} />}
                </Card>

                <Card
                  title={t.cEngine} subtitle={t.cEngineSub}
                  right={
                    <div style={{ display: 'flex', background: '#f4f7fa', border: `1px solid ${CELL_BORDER}`, borderRadius: '8px', padding: '3px' }}>
                      {([['requests', t.mReq], ['pages', t.mPages], ['characters', t.mChars]] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setEngineMetric(k)}
                          style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            background: engineMetric === k ? NAVY : 'transparent', color: engineMetric === k ? 'white' : '#6b7784' }}>{l}</button>
                      ))}
                    </div>
                  }
                >
                  {Object.keys(stats.methodAgg).length ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <Pie slices={[
                        { value: stats.methodAgg.paddle?.[engineMetric] ?? 0, color: C_PADDLE },
                        { value: stats.methodAgg.docling?.[engineMetric] ?? 0, color: C_DOCLING },
                      ]} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '170px' }}>
                        {([['paddle', 'PaddleOCR', C_PADDLE], ['docling', 'Docling', C_DOCLING]] as const).map(([key, label, color]) => {
                          const m = stats.methodAgg[key];
                          const avg = m && m.durations.length ? m.durations.reduce((a, b) => a + b, 0) / m.durations.length : null;
                          return (
                            <div key={key} style={{ background: '#f9fbfc', border: `1px solid ${CELL_BORDER}`, borderLeft: `4px solid ${color}`, borderRadius: '10px', padding: '11px 14px' }}>
                              <div style={{ fontSize: '12px', color: '#6b7784', fontWeight: 600 }}>{label}</div>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '9px', marginTop: '3px' }}>
                                <span style={{ fontSize: '18px', fontWeight: 700, color }}>{num(m?.[engineMetric] ?? 0)}</span>
                                {avg != null && <span style={{ fontSize: '11.5px', color: '#93a1b0' }}>{secs(avg)} {t.avgSuffix}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : <Empty text={t.noData} />}
                </Card>

                <Card title={t.cTypeEngine} subtitle={t.cTypeEngineSub}
                  right={<Legend items={[{ label: 'PaddleOCR', color: C_PADDLE }, { label: 'Docling', color: C_DOCLING }]} />}>
                  {Object.keys(stats.typeMethod).length ? (
                    <StackedBars groups={Object.entries(stats.typeMethod).map(([label, m]) => ({
                      label,
                      parts: [
                        { value: m.paddle ?? 0, color: C_PADDLE },
                        { value: m.docling ?? 0, color: C_DOCLING },
                      ],
                    }))} />
                  ) : <Empty text={t.noData} />}
                </Card>

                <Card title={t.cLanguage} subtitle={t.cLanguageSub}>
                  {stats.total ? (
                    <HBars rows={['uz_l', 'uz_c', 'ru', 'en', 'unknown']
                      .filter((l) => stats.langCount[l])
                      .map((l) => ({
                        label: langMeta[l],
                        value: stats.langCount[l],
                        color: l === 'unknown' ? '#93a1b0' : C_DBLUE,
                      }))} />
                  ) : <Empty text={t.noData} />}
                </Card>

                <Card title={t.cPdf} subtitle={t.cPdfSub}>
                  {stats.pdfEmbedded + stats.pdfOcr ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <Donut fraction={stats.pdfEmbedded / (stats.pdfEmbedded + stats.pdfOcr)} color={C_TEAL} caption={t.textLayer} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '160px' }}>
                        {[
                          { label: t.embeddedText, value: stats.pdfEmbedded, color: C_TEAL },
                          { label: t.requiredOcr,  value: stats.pdfOcr,      color: C_PADDLE },
                        ].map((r) => (
                          <div key={r.label} style={{ background: '#f9fbfc', border: `1px solid ${CELL_BORDER}`, borderLeft: `4px solid ${r.color}`, borderRadius: '10px', padding: '11px 14px' }}>
                            <div style={{ fontSize: '12px', color: '#6b7784', fontWeight: 600 }}>{r.label}</div>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: r.color, marginTop: '2px' }}>{num(r.value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : <Empty text={t.noData} />}
                </Card>

                <Card title={t.cDuration} subtitle={t.cDurationSub}>
                  {Object.values(stats.durBuckets).some(Boolean) ? (
                    <HBars rows={(['<1s', '1-5s', '5-10s', '10-30s', '30-60s', '>60s'] as const).map((b, i) => ({
                      label: b,
                      value: stats.durBuckets[b],
                      color: i < 2 ? C_GREEN : i < 4 ? C_AMBER : C_RED,
                    }))} />
                  ) : <Empty text={t.noData} />}
                </Card>
              </div>

              {/* ── Wide row: scatter + problems ── */}
              <div style={{ display: 'grid', gridTemplateColumns: isNarrow ? '1fr' : '1fr 1fr', gap: '20px' }}>
                <Card title={t.cScatter} subtitle={t.cScatterSub}
                  right={<Legend items={[{ label: 'PaddleOCR', color: C_PADDLE }, { label: 'Docling', color: C_DOCLING }]} />}>
                  {stats.scatter.length ? <Scatter points={stats.scatter} xLabel={t.pages} yLabel={t.seconds} /> : <Empty text={t.noData} />}
                </Card>

                <Card title={t.cProblems} subtitle={t.cProblemsSub}>
                  {stats.problems.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                      {stats.problems.map((p) => {
                        const f = formatStyle(p.file_extension);
                        const s = statusMeta[p.status] ?? { label: p.status, color: '#6b7784' };
                        return (
                          <div key={p.unique_job_id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', background: '#f9fbfc', border: `1px solid ${CELL_BORDER}`, borderRadius: '10px' }}>
                            <span style={{ padding: '3px 9px', borderRadius: '6px', border: `1.4px solid ${f.color}`, color: f.color, fontSize: '10.5px', fontWeight: 700, flexShrink: 0 }}>
                              {(p.file_extension || '').replace('.', '').toUpperCase()}
                            </span>
                            <span title={p.filename} style={{ fontSize: '13px', color: '#25313d', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                              {p.filename}
                            </span>
                            <span style={{ fontSize: '12px', color: '#93a1b0', flexShrink: 0 }}>
                              {p.page_count == null ? '—' : `${p.page_count} ${t.pages}`}
                            </span>
                            <span style={{ fontSize: '11.5px', color: '#93a1b0', flexShrink: 0 }}>{dmy(p.created_at)}</span>
                            <span style={{ padding: '4px 11px', borderRadius: '20px', border: `1.4px solid ${s.color}`, color: s.color, fontSize: '11.5px', fontWeight: 700, flexShrink: 0 }}>
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '46px 10px', textAlign: 'center', color: C_GREEN }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '38px', display: 'block', marginBottom: '10px' }}>check_circle</span>
                      <span style={{ fontSize: '13.5px' }}>{t.allClear}</span>
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}
        </div>
      </main>

      {/* ══════════════ FOOTER ══════════════ */}
      <footer style={{ width: '100%', background: '#0a2a40', borderTop: `3px solid ${GOLD}`, marginTop: '24px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '48px 36px 32px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '350px 1fr 1fr 1fr', gap: '44px', alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <img src={CbuLogo} alt="CBU" style={{ width: '44px', height: '44px', objectFit: 'contain', background: 'white', borderRadius: '8px', padding: '4px' }} />
              <div style={{ color: '#f5d068', fontWeight: 700, fontSize: '18px', lineHeight: 1 }}>{t.appName}</div>
            </div>
            <p style={{ fontSize: '15px', lineHeight: 1.75, color: '#6b8499', marginBottom: '20px' }}>{t.officialDesc}</p>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {[
                { src: facebook,  alt: 'Facebook',  href: 'https://www.facebook.com/centralbankuzbekistan/', w: '34px' },
                { src: telegram,  alt: 'Telegram',  href: 'https://t.me/centralbankuzbekistan',              w: '38px' },
                { src: linkedin,  alt: 'LinkedIn',  href: 'https://www.linkedin.com/company/centralbankuzbekistan/', w: '44px' },
                { src: twitter,   alt: 'Twitter',   href: 'https://x.com/cbuzbekistan',                      w: '46px' },
                { src: instagram, alt: 'Instagram', href: 'https://www.instagram.com/centralbankuzbekistan', w: '32px' },
                { src: youtube,   alt: 'YouTube',   href: 'https://www.youtube.com/centralbankofuzbekistan', w: '35px' },
              ].map((s) => (
                <a key={s.alt} href={s.href} target="_blank" rel="noopener noreferrer"
                  style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.07)' }}>
                  <img src={s.src} alt={s.alt} style={{ width: s.w, height: s.w, objectFit: 'contain' }} />
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
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '15px', color: '#8097a8', textDecoration: 'none' }}>
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
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '15px', color: '#8097a8', textDecoration: 'none' }}>
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
                  <a href={item.href} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '15px', color: '#8097a8', textDecoration: 'none' }}>
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
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" style={{ color: '#4a5c6a', textDecoration: 'none' }}>{l.label}</a>
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
        @keyframes spin { from{transform:rotate(0deg);} to{transform:rotate(360deg);} }
        nav::-webkit-scrollbar { height:0; }
        input:focus, select:focus { border-color:${NAVY} !important; box-shadow:0 0 0 3px rgba(10,59,92,0.10); }
        button:focus-visible { outline:2px solid ${GOLD}; outline-offset:2px; }
      `}</style>
    </div>
  );
};

export default MyStatsPage;