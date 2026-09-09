import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CbuLogo   from '../..//assets/CBU_Logo.png';
import facebook  from '../../assets/facebook.png';
import telegram  from '../../assets/telegram.png';
import linkedin  from '../../assets/linkedin.png';
import twitter   from '../../assets/twitter.png';
import instagram from '../../assets/instagram.png';
import youtube   from '../../assets/youtube.png';

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

// ─────────────────────────────────────────────────────────────────────────────
// Navigation — identical to the extraction page so the two feel like one app
// ─────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { path: '/',           labelKey: 'navUpload'      as const, icon: 'document_scanner' },
  { path: '/my_uploads', labelKey: 'navFileUploads' as const, icon: 'query_stats' },
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

const LANGUAGE_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  uz_l:    { color: '#3574D3', bg: '#E8F0FE', label: "O'zbek" },
  uz_c:    { color: '#3574D3', bg: '#E8F0FE', label: 'Ўзбек' },
  ru:      { color: '#3574D3', bg: '#E8F0FE', label: 'Русский' },
  en:      { color: '#3574D3', bg: '#E8F0FE', label: 'English' },
  unknown: { color: '#64748B', bg: '#EEF1F5', label: '—' },
};

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

    pageTitle: 'File Uploads',
    pageDesc: 'Every document you have sent through the OCR service.',
    refresh: 'Refresh',
    newUpload: 'New extraction',

    statTotal: 'Total uploads',
    statSuccess: 'Successful',
    statProblems: 'Need attention',
    statChars: 'Characters extracted',

    colNum: '#',
    colJob: 'JOB ID',
    colFile: 'FILE',
    colStatus: 'STATUS',
    colPages: 'PAGES',
    colChars: 'CHARACTERS',
    colLang: 'LANGUAGE',
    colDuration: 'DURATION',
    colCreated: 'STARTED',
    colFinished: 'FINISHED',
    colActions: 'ACTIONS',

    searchJob: 'Search by job ID…',
    allTypes: 'All file types',
    allStatuses: 'All statuses',
    allLanguages: 'All languages',
    clearFilters: 'Clear filters',
    activeFilters: 'Active filters:',
    fType: 'Type', fStatus: 'Status', fLang: 'Language', fDate: 'Date', fJob: 'Job ID',
    results: (n: number) => `${n} result${n !== 1 ? 's' : ''}`,

    loading: 'Loading your uploads…',
    failedLoad: 'Could not load your uploads.',
    noData: 'No uploads yet',
    noDataFiltered: 'Nothing matches these filters',
    noDataHint: 'Extract text from a document and it will appear here.',

    view: 'View text',
    deleteBtn: 'Delete',
    viewTitle: 'Extracted text',
    close: 'Close',
    copyText: 'Copy text',
    copied: 'Text copied.',
    downloadText: 'Download .txt',
    noText: 'This job produced no text.',

    deleteTitle: 'Delete this record',
    deleteConfirm: 'The stored text and metadata for this job will be removed.',
    deleteWarning: 'This cannot be undone.',
    cancel: 'Cancel',
    deleting: 'Deleting…',
    deletedSuccess: 'Record deleted.',
    deleteFailed: 'Could not delete the record.',

    showing: (a: number, b: number, n: number) => `Showing ${a}–${b} of ${n}`,
    previous: 'Previous',
    next: 'Next',

    stSuccess: 'Success', stFailed: 'Failed', stTimeout: 'Timed out',
    stProcessing: 'Processing', stInterrupted: 'Interrupted',

    langConfirmTitle: 'Change Language',
    langConfirmMsg: (l: string) => `Switch the interface language to ${l}?`,
    confirm: 'Yes, change',
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

    pageTitle: 'Загрузки файлов',
    pageDesc: 'Все документы, отправленные вами в сервис OCR.',
    refresh: 'Обновить',
    newUpload: 'Новое извлечение',

    statTotal: 'Всего загрузок',
    statSuccess: 'Успешно',
    statProblems: 'Требуют внимания',
    statChars: 'Извлечено символов',

    colNum: '#',
    colJob: 'ID ЗАДАНИЯ',
    colFile: 'ФАЙЛ',
    colStatus: 'СТАТУС',
    colPages: 'СТРАНИЦ',
    colChars: 'СИМВОЛОВ',
    colLang: 'ЯЗЫК',
    colDuration: 'ДЛИТЕЛЬНОСТЬ',
    colCreated: 'НАЧАТО',
    colFinished: 'ЗАВЕРШЕНО',
    colActions: 'ДЕЙСТВИЯ',

    searchJob: 'Поиск по ID задания…',
    allTypes: 'Все типы файлов',
    allStatuses: 'Все статусы',
    allLanguages: 'Все языки',
    clearFilters: 'Очистить фильтры',
    activeFilters: 'Активные фильтры:',
    fType: 'Тип', fStatus: 'Статус', fLang: 'Язык', fDate: 'Дата', fJob: 'ID задания',
    results: (n: number) => `${n} ${n === 1 ? 'результат' : n < 5 ? 'результата' : 'результатов'}`,

    loading: 'Загрузка ваших файлов…',
    failedLoad: 'Не удалось загрузить данные.',
    noData: 'Загрузок пока нет',
    noDataFiltered: 'Ничего не найдено по этим фильтрам',
    noDataHint: 'Извлеките текст из документа, и он появится здесь.',

    view: 'Показать текст',
    deleteBtn: 'Удалить',
    viewTitle: 'Извлечённый текст',
    close: 'Закрыть',
    copyText: 'Копировать текст',
    copied: 'Текст скопирован.',
    downloadText: 'Скачать .txt',
    noText: 'Это задание не дало текста.',

    deleteTitle: 'Удалить запись',
    deleteConfirm: 'Сохранённый текст и метаданные этого задания будут удалены.',
    deleteWarning: 'Это действие нельзя отменить.',
    cancel: 'Отмена',
    deleting: 'Удаление…',
    deletedSuccess: 'Запись удалена.',
    deleteFailed: 'Не удалось удалить запись.',

    showing: (a: number, b: number, n: number) => `Показано ${a}–${b} из ${n}`,
    previous: 'Назад',
    next: 'Вперёд',

    stSuccess: 'Успешно', stFailed: 'Ошибка', stTimeout: 'Тайм-аут',
    stProcessing: 'Обработка', stInterrupted: 'Прервано',

    langConfirmTitle: 'Изменить язык',
    langConfirmMsg: (l: string) => `Сменить язык интерфейса на ${l}?`,
    confirm: 'Да, изменить',
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

    pageTitle: 'Файл юкламалари',
    pageDesc: 'Сиз OCR хизматига юборган барча ҳужжатлар.',
    refresh: 'Янгилаш',
    newUpload: 'Янги ажратиш',

    statTotal: 'Жами юкламалар',
    statSuccess: 'Муваффақиятли',
    statProblems: 'Эътибор талаб қилади',
    statChars: 'Ажратилган белгилар',

    colNum: '#',
    colJob: 'ВАЗИФА ИД',
    colFile: 'ФАЙЛ',
    colStatus: 'ҲОЛАТ',
    colPages: 'САҲИФАЛАР',
    colChars: 'БЕЛГИЛАР',
    colLang: 'ТИЛ',
    colDuration: 'ДАВОМИЙЛИГИ',
    colCreated: 'БОШЛАНДИ',
    colFinished: 'ТУГАДИ',
    colActions: 'АМАЛЛАР',

    searchJob: 'Вазифа ИД бўйича қидириш…',
    allTypes: 'Барча файл турлари',
    allStatuses: 'Барча ҳолатлар',
    allLanguages: 'Барча тиллар',
    clearFilters: 'Фильтрларни тозалаш',
    activeFilters: 'Фаол фильтрлар:',
    fType: 'Тури', fStatus: 'Ҳолат', fLang: 'Тил', fDate: 'Сана', fJob: 'Вазифа ИД',
    results: (n: number) => `${n} та натижа`,

    loading: 'Юкламаларингиз юкланмоқда…',
    failedLoad: 'Маълумотларни юклаб бўлмади.',
    noData: 'Ҳозircha юкламалар йўқ',
    noDataFiltered: 'Ушбу фильтрлар бўйича ҳеч нарса топилмади',
    noDataHint: 'Ҳужжатдан матн ажратинг ва у шу ерда пайдо бўлади.',

    view: 'Матнни кўриш',
    deleteBtn: 'Ўчириш',
    viewTitle: 'Ажратилган матн',
    close: 'Ёпиш',
    copyText: 'Матнни нусхалаш',
    copied: 'Матн нусхаланди.',
    downloadText: '.txt юклаш',
    noText: 'Бу вазифа матн бермади.',

    deleteTitle: 'Ёзувни ўчириш',
    deleteConfirm: 'Ушбу вазифанинг сақланган матни ва маълумотлари ўчирилади.',
    deleteWarning: 'Бу амални қайтариб бўлмайди.',
    cancel: 'Бекор қилиш',
    deleting: 'Ўчирилмоқда…',
    deletedSuccess: 'Ёзув ўчирилди.',
    deleteFailed: 'Ёзувни ўчириб бўлмади.',

    showing: (a: number, b: number, n: number) => `${n} тадан ${a}–${b} кўрсатилмоқда`,
    previous: 'Олдинги',
    next: 'Кейинги',

    stSuccess: 'Муваффақиятли', stFailed: 'Хатолик', stTimeout: 'Вақт тугади',
    stProcessing: 'Ишланмоқда', stInterrupted: 'Узилди',

    langConfirmTitle: 'Тилни ўзгартириш',
    langConfirmMsg: (l: string) => `Интерфейс тилини ${l} тилига ўзгартирилсинми?`,
    confirm: 'Ҳа, ўзгартириш',
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

    pageTitle: 'Fayl yuklamalari',
    pageDesc: 'Siz OCR xizmatiga yuborgan barcha hujjatlar.',
    refresh: 'Yangilash',
    newUpload: 'Yangi ajratish',

    statTotal: 'Jami yuklamalar',
    statSuccess: 'Muvaffaqiyatli',
    statProblems: 'Eʼtibor talab qiladi',
    statChars: 'Ajratilgan belgilar',

    colNum: '#',
    colJob: 'VAZIFA ID',
    colFile: 'FAYL',
    colStatus: 'HOLAT',
    colPages: 'SAHIFALAR',
    colChars: 'BELGILAR',
    colLang: 'TIL',
    colDuration: 'DAVOMIYLIGI',
    colCreated: 'BOSHLANDI',
    colFinished: 'TUGADI',
    colActions: 'AMALLAR',

    searchJob: 'Vazifa ID boʻyicha qidirish…',
    allTypes: 'Barcha fayl turlari',
    allStatuses: 'Barcha holatlar',
    allLanguages: 'Barcha tillar',
    clearFilters: 'Filtrlarni tozalash',
    activeFilters: 'Faol filtrlar:',
    fType: 'Turi', fStatus: 'Holat', fLang: 'Til', fDate: 'Sana', fJob: 'Vazifa ID',
    results: (n: number) => `${n} ta natija`,

    loading: 'Yuklamalaringiz yuklanmoqda…',
    failedLoad: 'Maʼlumotlarni yuklab boʻlmadi.',
    noData: 'Hozircha yuklamalar yoʻq',
    noDataFiltered: 'Ushbu filtrlar boʻyicha hech narsa topilmadi',
    noDataHint: 'Hujjatdan matn ajrating va u shu yerda paydo boʻladi.',

    view: 'Matnni koʻrish',
    deleteBtn: 'Oʻchirish',
    viewTitle: 'Ajratilgan matn',
    close: 'Yopish',
    copyText: 'Matnni nusxalash',
    copied: 'Matn nusxalandi.',
    downloadText: '.txt yuklash',
    noText: 'Bu vazifa matn bermadi.',

    deleteTitle: 'Yozuvni oʻchirish',
    deleteConfirm: 'Ushbu vazifaning saqlangan matni va maʼlumotlari oʻchiriladi.',
    deleteWarning: 'Bu amalni qaytarib boʻlmaydi.',
    cancel: 'Bekor qilish',
    deleting: 'Oʻchirilmoqda…',
    deletedSuccess: 'Yozuv oʻchirildi.',
    deleteFailed: 'Yozuvni oʻchirib boʻlmadi.',

    showing: (a: number, b: number, n: number) => `${n} tadan ${a}–${b} koʻrsatilmoqda`,
    previous: 'Oldingi',
    next: 'Keyingi',

    stSuccess: 'Muvaffaqiyatli', stFailed: 'Xatolik', stTimeout: 'Vaqt tugadi',
    stProcessing: 'Ishlanmoqda', stInterrupted: 'Uzildi',

    langConfirmTitle: "Tilni o'zgartirish",
    langConfirmMsg: (l: string) => `Interfeys tilini ${l} tiliga o'zgartirilsinmi?`,
    confirm: "Ha, o'zgartirish",
    sessionExpired: 'Sessiya muddati tugadi. Iltimos, qayta kiring.',

    officialDesc: 'OCR — Oʻzbekiston Markaziy bankining ichki hujjatlardan matn ajratib olish platformasi',
    aboutCbu: 'MBU Haqida', executiveB: 'Boshqaruv kengashi', legislation: 'Qonunchilik',
    publications: 'Publikatsiyalar', dataStats: "Maʼlumotlar va statistika", services: 'Xizmatlar',
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

interface OcrJob {
  unique_job_id: string;
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
  duration: number | string | null;
  finished_at: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────────────────────
const formatBytes = (b: number): string => {
  if (b === null || b === undefined) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
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
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const formatNumber = (n: number): string =>
  String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const compact = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

const ITEMS_PER_PAGE = 15;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
const MyUploadsPage: React.FC = () => {
  const navigate = useNavigate();
  const currentPath = '/my_uploads';

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<OcrJob[]>([]);
  const [lang, setLang] = useState<LangKey>('en');
  const [pendingLang, setPendingLang] = useState<LangKey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [searchJob, setSearchJob] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [langFilter, setLangFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [viewJob, setViewJob] = useState<OcrJob | null>(null);
  const [deleteJob, setDeleteJob] = useState<OcrJob | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3800);
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
    const onResize = () => setIsMobile(window.innerWidth <= 768);
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

  /* ── Fetch ── */
  const fetchData = useCallback(async () => {
    try {
      const res = await apiFetch('/api/get_all_user_internal_ocr_data');
      if (!res || !res.ok) throw new Error(`HTTP ${res?.status}`);
      const payload = await res.json();

      if (payload.user) {
        setUser(payload.user);
        const mapped = (['en', 'ru', 'uz_c', 'uz_l'] as LangKey[]).find((k) => k === payload.user.language);
        if (mapped) setLang(mapped);
      }
      // The endpoint returns Status 'Failed' with an empty Data set when the
      // user has no jobs yet — that is an empty list, not an error.
      setJobs(Array.isArray(payload.Data) ? payload.Data : []);
      setError(null);
    } catch (err) {
      console.error('Failed to load uploads:', err);
      setError('load');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Refresh while anything is still processing ── */
  useEffect(() => {
    if (!jobs.some((j) => j.status === 'processing')) return;
    const id = setInterval(fetchData, 4000);
    return () => clearInterval(id);
  }, [jobs, fetchData]);

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

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    let f = [...jobs];
    if (searchJob.trim()) {
      const q = searchJob.trim().toLowerCase();
      f = f.filter((j) => j.unique_job_id?.toLowerCase().includes(q) || j.filename?.toLowerCase().includes(q));
    }
    if (typeFilter !== 'all')   f = f.filter((j) => (j.file_extension || '').toLowerCase() === typeFilter);
    if (statusFilter !== 'all') f = f.filter((j) => j.status === statusFilter);
    if (langFilter !== 'all')   f = f.filter((j) => (j.language ?? 'unknown') === langFilter);
    if (dateFilter)             f = f.filter((j) => (j.created_at ?? '').substring(0, 10) === dateFilter);
    return f.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [jobs, searchJob, typeFilter, statusFilter, langFilter, dateFilter]);

  const stats = useMemo(() => ({
    total: jobs.length,
    success: jobs.filter((j) => j.status === 'success').length,
    problems: jobs.filter((j) => ['failed', 'timeout', 'interrupted'].includes(j.status)).length,
    chars: jobs.reduce((s, j) => s + (j.extracted_text_length ?? 0), 0),
  }), [jobs]);

  const hasFilters = Boolean(searchJob || dateFilter) || typeFilter !== 'all' || statusFilter !== 'all' || langFilter !== 'all';
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filtered, currentPage]
  );

  useEffect(() => { setCurrentPage(1); }, [searchJob, typeFilter, statusFilter, langFilter, dateFilter]);

  const clearFilters = () => {
    setSearchJob(''); setTypeFilter('all'); setStatusFilter('all'); setLangFilter('all'); setDateFilter('');
  };

  const statusStyle = (status: string) => {
    switch (status) {
      case 'success':     return { label: t.stSuccess,     color: '#15803d', bg: '#e7f8ec', border: '#8fdca6', icon: 'check_circle', spin: false };
      case 'failed':      return { label: t.stFailed,      color: '#b91c1c', bg: '#fdeaea', border: '#f3a9a9', icon: 'error',        spin: false };
      case 'timeout':     return { label: t.stTimeout,     color: '#c2410c', bg: '#fdeee4', border: '#f5bf94', icon: 'schedule',     spin: false };
      case 'interrupted': return { label: t.stInterrupted, color: '#a16207', bg: '#fdf5da', border: '#ecd07a', icon: 'warning',      spin: false };
      default:            return { label: t.stProcessing,  color: '#1d4ed8', bg: '#e8eefe', border: '#a8c0fb', icon: 'sync',         spin: true  };
    }
  };

  const getInitials = (u: User | null) => {
    if (!u) return '?';
    return ((u.first_name?.[0] ?? '') + (u.last_name?.[0] ?? '')).toUpperCase() || u.username?.[0]?.toUpperCase() || '?';
  };

  /* ── Delete ── */
  const confirmDelete = async () => {
    if (!deleteJob) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch('/api/delete_internal_ocr_data', {
        method: 'DELETE',
        body: JSON.stringify({ unique_job_id: deleteJob.unique_job_id }),
      });
      if (!res || !res.ok) throw new Error();
      setDeleteJob(null);
      await fetchData();
      showToast(t.deletedSuccess, 'success');
    } catch {
      showToast(t.deleteFailed, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyText = async (text: string | null) => {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); showToast(t.copied, 'success'); } catch {}
  };

  const downloadText = (job: OcrJob) => {
    if (!job.extracted_text) return;
    const blob = new Blob([job.extracted_text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${job.filename || job.unique_job_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px 12px 44px', fontSize: '14px',
    background: '#f8fafc', color: '#0f172a', border: `1px solid ${CELL_BORDER}`,
    borderRadius: '10px', outline: 'none', cursor: 'pointer',
    appearance: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  const th: React.CSSProperties = {
    padding: '16px 14px', textAlign: 'left', fontWeight: 700, color: NAVY,
    fontSize: '12px', letterSpacing: '0.4px', whiteSpace: 'nowrap',
    borderBottom: `2px solid ${NAVY}`, background: '#f6f8fa',
  };

  const td: React.CSSProperties = { padding: '14px', fontSize: '13px', color: '#25313d', whiteSpace: 'nowrap' };

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
          <span className="material-symbols-outlined" style={{ fontSize: '19px' }}>
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
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#64748b', lineHeight: 1.5 }}>{t.langConfirmMsg(LANG_NAMES[pendingLang])}</p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setPendingLang(null)} style={{ flex: 1, padding: '11px', background: '#f1f5f9', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}>{t.cancel}</button>
              <button onClick={() => applyLanguageChange(pendingLang)} style={{ flex: 1, padding: '11px', background: `linear-gradient(135deg,${NAVY},#1a5080)`, border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>{t.confirm}</button>
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

            <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button onClick={() => setDropdownOpen((o) => !o)} style={{
                background: 'rgba(255,255,255,0.1)', border: '2px solid rgba(233,183,65,0.5)',
                borderRadius: '50%', width: '42px', height: '42px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: 'white', fontSize: '16px', fontWeight: 700, fontFamily: 'inherit',
              }}>{getInitials(user)}</button>

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
                          style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#1f2937', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', marginBottom: '1px' }}
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
                      style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', padding: '9px 10px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: '#dc2626', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit' }}
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

      {/* ── Hero bar ── */}
      <div style={{ background: 'linear-gradient(135deg,#f1f5f9 0%,#e4eaf1 100%)', padding: isMobile ? '16px 20px' : '20px 32px', borderBottom: '1px solid #dde3e9' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? '12px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: NAVY }}>query_stats</span>
            <div>
              <h3 style={{ margin: 0, fontSize: isMobile ? '17px' : '19px', fontWeight: 700, color: NAVY }}>{t.pageTitle}</h3>
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#4a5c6a' }}>{t.pageDesc}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={fetchData} style={{ padding: '10px 20px', background: 'white', border: `1px solid ${NAVY}`, borderRadius: '10px', color: NAVY, fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'inherit' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>refresh</span>
              {t.refresh}
            </button>
            <button onClick={() => navigate('/')} style={{ padding: '10px 20px', background: NAVY, border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'inherit' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>document_scanner</span>
              {t.newUpload}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════ MAIN ══════════════════════ */}
      <main style={{ flex: 1, padding: isMobile ? '22px 14px' : '30px 32px' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: '18px', marginBottom: '24px' }}>
            {[
              { label: t.statTotal,    value: formatNumber(stats.total),    color: NAVY,      bg: '#e9eef3', icon: 'inbox' },
              { label: t.statSuccess,  value: formatNumber(stats.success),  color: '#15803d', bg: '#e7f8ec', icon: 'check_circle' },
              { label: t.statProblems, value: formatNumber(stats.problems), color: stats.problems ? '#b91c1c' : '#8695a4', bg: stats.problems ? '#fdeaea' : '#eef1f5', icon: 'report' },
              { label: t.statChars,    value: compact(stats.chars),         color: '#3D7A52', bg: '#e8f4ec', icon: 'notes' },
            ].map((s) => (
              <div key={s.label} style={{ background: 'white', padding: '20px', borderRadius: '16px', border: `1px solid ${CELL_BORDER}`, boxShadow: '0 2px 12px rgba(10,40,70,0.05)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '52px', height: '52px', background: s.bg, borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '26px', color: s.color }}>{s.icon}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: '#6b7784', marginBottom: '3px' }}>{s.label}</div>
                  <div style={{ fontSize: '28px', fontWeight: 700, color: s.color, letterSpacing: '-0.5px' }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ background: 'white', padding: isMobile ? '18px' : '22px', borderRadius: '16px', marginBottom: '22px', border: `1px solid ${CELL_BORDER}`, boxShadow: '0 2px 12px rgba(10,40,70,0.05)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1.2fr 1.2fr 1.2fr 1fr', gap: '12px' }}>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '20px' }}>search</span>
                <input type="text" value={searchJob} onChange={(e) => setSearchJob(e.target.value)} placeholder={t.searchJob}
                  style={{ ...selectStyle, cursor: 'text', fontFamily: 'monospace' }} />
              </div>

              {/* File type */}
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '20px', zIndex: 1 }}>draft</span>
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={selectStyle}>
                  <option value="all">{t.allTypes}</option>
                  <option value=".pdf">PDF</option>
                  <option value=".docx">DOCX</option>
                  <option value=".jpg">JPG</option>
                  <option value=".jpeg">JPEG</option>
                  <option value=".png">PNG</option>
                </select>
              </div>

              {/* Status */}
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '20px', zIndex: 1 }}>tune</span>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
                  <option value="all">{t.allStatuses}</option>
                  <option value="success">{t.stSuccess}</option>
                  <option value="failed">{t.stFailed}</option>
                  <option value="timeout">{t.stTimeout}</option>
                  <option value="interrupted">{t.stInterrupted}</option>
                  <option value="processing">{t.stProcessing}</option>
                </select>
              </div>

              {/* Language */}
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '20px', zIndex: 1 }}>translate</span>
                <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)} style={selectStyle}>
                  <option value="all">{t.allLanguages}</option>
                  <option value="uz_l">O'zbek (Lotin)</option>
                  <option value="uz_c">Ўзбек (Кирил)</option>
                  <option value="ru">Русский</option>
                  <option value="en">English</option>
                  <option value="unknown">—</option>
                </select>
              </div>

              {/* Date */}
              <div style={{ position: 'relative' }}>
                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '19px', zIndex: 1, pointerEvents: 'none' }}>calendar_today</span>
                <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} style={{ ...selectStyle, colorScheme: 'light' }} />
              </div>
            </div>

            {hasFilters && (
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '12px 16px', background: '#f4f7fa', borderRadius: '10px', fontSize: '13px', color: '#6b7784' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '17px', color: NAVY }}>filter_alt</span>
                {t.activeFilters}
                {searchJob && <span style={{ background: 'white', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${CELL_BORDER}` }}>{t.fJob}: <strong>{searchJob}</strong></span>}
                {typeFilter !== 'all' && <span style={{ background: 'white', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${CELL_BORDER}` }}>{t.fType}: <strong>{typeFilter.replace('.', '').toUpperCase()}</strong></span>}
                {statusFilter !== 'all' && <span style={{ background: 'white', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${CELL_BORDER}` }}>{t.fStatus}: <strong>{statusStyle(statusFilter).label}</strong></span>}
                {langFilter !== 'all' && <span style={{ background: 'white', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${CELL_BORDER}` }}>{t.fLang}: <strong>{LANGUAGE_STYLE[langFilter]?.label ?? langFilter}</strong></span>}
                {dateFilter && <span style={{ background: 'white', padding: '4px 10px', borderRadius: '6px', border: `1px solid ${CELL_BORDER}` }}>{t.fDate}: <strong>{dateFilter}</strong></span>}
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <strong style={{ color: NAVY }}>{t.results(filtered.length)}</strong>
                  <button onClick={clearFilters} style={{ padding: '7px 14px', background: 'white', border: '1.5px solid #f3a9a9', borderRadius: '9px', color: '#b91c1c', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
                    {t.clearFilters}
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Table */}
          <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${CELL_BORDER}`, boxShadow: '0 2px 12px rgba(10,40,70,0.05)', overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: '80px', textAlign: 'center', color: '#6b7784' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '46px', display: 'block', marginBottom: '16px', color: NAVY, animation: 'spin 1.6s linear infinite' }}>progress_activity</span>
                {t.loading}
              </div>
            ) : error ? (
              <div style={{ padding: '80px', textAlign: 'center', color: '#b91c1c' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '46px', display: 'block', marginBottom: '16px' }}>error</span>
                {t.failedLoad}
              </div>
            ) : paginated.length === 0 ? (
              <div style={{ padding: '80px 24px', textAlign: 'center', color: '#6b7784' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '54px', display: 'block', marginBottom: '16px', color: '#a9b6c2' }}>inbox</span>
                <div style={{ fontSize: '16px', fontWeight: 600, color: NAVY, marginBottom: '8px' }}>{hasFilters ? t.noDataFiltered : t.noData}</div>
                <div style={{ fontSize: '14px', marginBottom: '18px' }}>{hasFilters ? '' : t.noDataHint}</div>
                {hasFilters
                  ? <button onClick={clearFilters} style={{ padding: '10px 22px', background: '#f1f5f9', border: `1px solid ${CELL_BORDER}`, borderRadius: '9px', color: '#475569', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>{t.clearFilters}</button>
                  : <button onClick={() => navigate('/')} style={{ padding: '10px 22px', background: NAVY, border: 'none', borderRadius: '9px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 600, fontFamily: 'inherit' }}>{t.newUpload}</button>}
              </div>
            ) : (
              <>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1280px' }}>
                    <thead>
                      <tr>
                        {[t.colNum, t.colJob, t.colFile, t.colStatus, t.colPages, t.colChars, t.colLang, t.colDuration, t.colCreated, t.colFinished, t.colActions].map((h, i) => (
                          <th key={h} style={{ ...th, textAlign: i === 10 ? 'center' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((job, index) => {
                        const n = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                        const s = statusStyle(job.status);
                        const f = formatStyle(job.file_extension);
                        const l = LANGUAGE_STYLE[job.language ?? 'unknown'] ?? LANGUAGE_STYLE.unknown;
                        return (
                          <tr key={job.unique_job_id}
                            style={{ borderBottom: '1px solid #eef2f6', background: index % 2 === 0 ? 'white' : '#fafbfc' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#f2f8fd'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = index % 2 === 0 ? 'white' : '#fafbfc'; }}
                          >
                            <td style={{ ...td, color: '#94a3b8', fontWeight: 500 }}>{n}</td>

                            <td style={{ ...td, fontFamily: 'monospace', fontSize: '12.5px' }} title={job.unique_job_id}>
                              {job.unique_job_id?.slice(0, 12)}…
                            </td>

                            <td style={td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                                <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: f.bg, border: `1px solid ${f.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '17px', color: f.color }}>{f.icon}</span>
                                </span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, color: f.color, fontSize: '12px' }}>{(job.file_extension || '').replace('.', '').toUpperCase()}</div>
                                  <div style={{ fontSize: '11.5px', color: '#8695a4' }}>{formatBytes(job.file_size)}</div>
                                </div>
                              </div>
                            </td>

                            <td style={td}>
                              <span style={{ padding: '5px 12px', borderRadius: '30px', fontSize: '12px', fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '15px', animation: s.spin ? 'spin 1.6s linear infinite' : 'none' }}>{s.icon}</span>
                                {s.label}
                              </span>
                            </td>

                            <td style={{ ...td, color: job.page_count == null ? '#a9b6c2' : '#0e7490', fontWeight: 600 }}>
                              {job.page_count ?? '—'}
                            </td>

                            <td style={{ ...td, fontWeight: 600, color: '#3D7A52' }}>{formatNumber(job.extracted_text_length)}</td>

                            <td style={td}>
                              <span style={{ padding: '4px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, background: l.bg, color: l.color }}>{l.label}</span>
                            </td>

                            <td style={{ ...td, fontWeight: 600 }}>{formatDuration(job.duration)}</td>
                            <td style={{ ...td, color: '#5b6775', fontSize: '12.5px' }}>{formatDateTime(job.created_at)}</td>
                            <td style={{ ...td, color: '#5b6775', fontSize: '12.5px' }}>{formatDateTime(job.finished_at)}</td>

                            <td style={{ ...td, textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button onClick={() => setViewJob(job)} disabled={!job.extracted_text}
                                  style={{ padding: '7px 13px', fontSize: '12.5px', fontWeight: 600, background: job.extracted_text ? '#eef4fa' : '#f1f4f7', color: job.extracted_text ? NAVY : '#b6c0ca', border: `1px solid ${CELL_BORDER}`, borderRadius: '8px', cursor: job.extracted_text ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit' }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>visibility</span>
                                  {t.view}
                                </button>
                                <button onClick={() => setDeleteJob(job)}
                                  style={{ padding: '7px 13px', fontSize: '12.5px', fontWeight: 600, background: 'white', color: '#b91c1c', border: '1.5px solid #f3a9a9', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fdeaea'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}>
                                  <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>delete</span>
                                  {t.deleteBtn}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filtered.length > ITEMS_PER_PAGE && (
                  <div style={{ padding: '20px 24px', borderTop: `1px solid ${CELL_BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexWrap: 'wrap', gap: '14px' }}>
                    <div style={{ fontSize: '13.5px', color: '#6b7784' }}>
                      {t.showing((currentPage - 1) * ITEMS_PER_PAGE + 1, Math.min(currentPage * ITEMS_PER_PAGE, filtered.length), filtered.length)}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={() => setCurrentPage((p) => p - 1)} disabled={currentPage === 1}
                        style={{ padding: '9px 16px', fontSize: '13.5px', fontWeight: 600, background: currentPage === 1 ? '#f1f4f7' : 'white', color: currentPage === 1 ? '#b6c0ca' : NAVY, border: `1px solid ${CELL_BORDER}`, borderRadius: '8px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>chevron_left</span>
                        {t.previous}
                      </button>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                          const show = p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2);
                          const dots = p === currentPage - 3 || p === currentPage + 3;
                          if (show) return (
                            <button key={p} onClick={() => setCurrentPage(p)}
                              style={{ minWidth: '36px', height: '36px', fontSize: '13.5px', fontWeight: 600, background: currentPage === p ? NAVY : 'white', color: currentPage === p ? 'white' : '#25313d', border: `1px solid ${currentPage === p ? NAVY : CELL_BORDER}`, borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>{p}</button>
                          );
                          if (dots) return <span key={`d${p}`} style={{ width: '30px', textAlign: 'center', color: '#8695a4' }}>…</span>;
                          return null;
                        })}
                      </div>
                      <button onClick={() => setCurrentPage((p) => p + 1)} disabled={currentPage === totalPages}
                        style={{ padding: '9px 16px', fontSize: '13.5px', fontWeight: 600, background: currentPage === totalPages ? '#f1f4f7' : 'white', color: currentPage === totalPages ? '#b6c0ca' : NAVY, border: `1px solid ${CELL_BORDER}`, borderRadius: '8px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit' }}>
                        {t.next}
                        <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* ── View text modal ── */}
      {viewJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,30,46,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          onClick={() => setViewJob(null)}>
          <div style={{ background: 'white', borderRadius: '18px', width: '900px', maxWidth: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 64px rgba(0,0,0,0.3)', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '18px 22px', borderBottom: `1px solid ${CELL_BORDER}`, flexWrap: 'wrap' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '21px', color: NAVY }}>article</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: 700, color: NAVY }}>{t.viewTitle}</div>
                <div style={{ fontSize: '12.5px', color: '#8695a4', fontFamily: 'monospace' }}>{viewJob.unique_job_id}</div>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={() => copyText(viewJob.extracted_text)}
                style={{ padding: '8px 14px', background: 'white', border: `1px solid ${CELL_BORDER}`, borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: NAVY, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>content_copy</span>
                {t.copyText}
              </button>
              <button onClick={() => downloadText(viewJob)}
                style={{ padding: '8px 14px', background: NAVY, border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 600, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>download</span>
                {t.downloadText}
              </button>
              <button onClick={() => setViewJob(null)}
                style={{ width: '38px', height: '38px', background: '#f1f5f9', border: 'none', borderRadius: '9px', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
            </div>

            <div style={{ padding: '20px 22px', overflow: 'auto' }}>
              {viewJob.extracted_text ? (
                <pre style={{ margin: 0, padding: '18px', textAlign: 'left', background: '#fcfdfe', border: `2px solid ${CELL_BORDER}`, borderLeft: `4px solid ${NAVY}`, borderRadius: '10px', fontSize: '13.5px', lineHeight: 1.75, color: '#16212c', fontFamily: '"SF Mono","Fira Mono",Consolas,monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {viewJob.extracted_text}
                </pre>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#8695a4', border: `2px dashed ${CELL_BORDER}`, borderRadius: '10px' }}>{t.noText}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete modal ── */}
      {deleteJob && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,30,46,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}
          onClick={() => !isDeleting && setDeleteJob(null)}>
          <div style={{ background: 'white', borderRadius: '18px', padding: '28px', width: '520px', maxWidth: '100%', boxShadow: '0 32px 64px rgba(0,0,0,0.3)' }}
            onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '18px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '26px', color: '#b91c1c' }}>warning</span>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: NAVY }}>{t.deleteTitle}</h2>
            </div>

            <div style={{ padding: '18px', background: '#fdeaea', border: '1px solid #f3a9a9', borderRadius: '12px', marginBottom: '22px' }}>
              <div style={{ fontSize: '14px', color: '#25313d', marginBottom: '12px' }}>{t.deleteConfirm}</div>
              <div style={{ fontSize: '13px', color: '#5b6775', lineHeight: 1.9 }}>
                <div>{t.colJob}: <strong style={{ fontFamily: 'monospace', color: '#b91c1c' }}>{deleteJob.unique_job_id}</strong></div>
                <div>{t.colStatus}: <strong>{statusStyle(deleteJob.status).label}</strong></div>
                <div>{t.colCreated}: <strong>{formatDateTime(deleteJob.created_at)}</strong></div>
                <div>{t.colChars}: <strong>{formatNumber(deleteJob.extracted_text_length)}</strong></div>
              </div>
              <div style={{ marginTop: '12px', fontSize: '12.5px', fontWeight: 600, color: '#b91c1c' }}>{t.deleteWarning}</div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteJob(null)} disabled={isDeleting}
                style={{ padding: '11px 22px', fontSize: '14px', fontWeight: 600, background: '#f1f5f9', color: '#475569', border: `1px solid ${CELL_BORDER}`, borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit' }}>
                {t.cancel}
              </button>
              <button onClick={confirmDelete} disabled={isDeleting}
                style={{ padding: '11px 22px', fontSize: '14px', fontWeight: 600, background: isDeleting ? '#c9a3a3' : '#b91c1c', color: 'white', border: 'none', borderRadius: '10px', cursor: isDeleting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '17px', animation: isDeleting ? 'spin 1.4s linear infinite' : 'none' }}>{isDeleting ? 'progress_activity' : 'delete'}</span>
                {isDeleting ? t.deleting : t.deleteBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ FOOTER ══════════════════════ */}
      <footer style={{ width: '100%', background: '#0a2a40', borderTop: `3px solid ${GOLD}`, boxSizing: 'border-box', marginTop: '24px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '48px 36px 32px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '350px 1fr 1fr 1fr', gap: '44px', alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <img src={CbuLogo} alt="CBU" style={{ width: '44px', height: '44px', objectFit: 'contain', background: 'white', borderRadius: '8px', padding: '4px', flexShrink: 0 }} />
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
                  style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.07)', transition: 'background 0.2s, transform 0.15s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.18)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                >
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
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '15px', color: '#8097a8', textDecoration: 'none' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#8097a8'; }}>
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
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#8097a8'; }}>
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
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#8097a8'; }}>
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
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#4a5c6a'; }}>{l.label}</a>
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
        input:focus, select:focus { border-color:${NAVY} !important; box-shadow:0 0 0 3px rgba(10,59,92,0.10); }
        button:focus-visible { outline:2px solid ${GOLD}; outline-offset:2px; }
      `}</style>
    </div>
  );
};

export default MyUploadsPage;