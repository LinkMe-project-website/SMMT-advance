const DB_NAME = "smm_hub_db";
const DB_VERSION = 3;

const VIEWS = ["dashboard", "organize", "notes", "docs", "calendar", "posts", "pillars", "ideas", "assets", "clients", "payroll", "tools", "tutorial", "backup", "about"];
const PREMIUM_VIEWS = ["calendar", "clients", "payroll"];

// Phase 4 (layout redesign): views consolidated under the "More" bottom-nav tab.
// These no longer have their own bottomNav button; they're reached via the
// (superseded by NAV_GROUPS / #contentSegNav / #teamSegNav below, v14)
const MORE_VIEWS = ["organize", "notes", "docs", "assets", "clients", "payroll", "tools", "tutorial", "backup", "about"];

// v14 IA redesign: bottom nav collapsed to 4 tabs (Home / Calendar / Content /
// Team). Views that used to live directly on the bottom nav or in the old
// single "More" catch-all are now grouped under one of two segmented
// sub-navs (#contentSegNav, #teamSegNav) depending on which group they
// belong to. Views NOT listed in any group (tutorial/backup/about) are
// reached only through the Profile menu (see openProfileMenu()).
const NAV_GROUPS = {
  content: ["posts", "ideas", "organize", "pillars", "notes", "docs", "assets", "tools"],
  team: ["clients", "payroll"]
};

// Human-readable titles shown in the dynamic top bar (back-arrow + title)
// whenever the current view isn't the Home dashboard.
const VIEW_TITLES = {
  dashboard: "Home",
  calendar: "Calendar",
  posts: "Library",
  ideas: "Ideas",
  organize: "Organize",
  pillars: "Content Pillars",
  notes: "Notes",
  docs: "Docs",
  assets: "Assets",
  tools: "Tools",
  clients: "Team / Clients",
  payroll: "Payroll",
  tutorial: "Tutorial",
  backup: "Backup",
  about: "About VA Yarn!"
};

// TEMP (per user decision): VIP-gated views (Calendar, Clients, Payroll) are
// opened up for everyone while the Phase 4 layout settles. VIP gating logic
// below is left intact on purpose -- flip this back to false to re-enable
// paywall gating once the VIP/membership redesign happens at the end.
const VIP_GATE_DISABLED = true;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TRIAL_DAYS = 7;
const APP_SHORT_NAME = "SMMT";
const APP_FULL_NAME = "SOCIAL MEDIA MANAGER TOOLS";

const PREFS_KEY = "smm_hub_prefs_v1";
const ABOUT_KEY = "smm_hub_about_v1";
const DNA_KEY = "smm_hub_dna_v1";
const ONBOARDING_KEY = "smm_hub_onboarding_done_v1";

// Roles as they actually exist in Supabase RLS today (client_members.role +
// the implicit owner). Kept as one source of truth so the onboarding funnel,
// the Team/New Client role picker, and any future help text all agree.
const ROLE_INFO = [
  {
    key: "Owner",
    title: "Owner",
    desc: "Ikaw na gumawa ng client record. Buong access — pwedeng mag-edit, mag-delete, at mag-invite ng members. Ito ang default role mo sa sarili mong mga client."
  },
  {
    key: "Manager",
    title: "Manager",
    desc: "Full access sa client-linked content (tasks, docs, posts, ideas, pillars, assets). Pwede ring mag-invite ng bagong client member. Delete access din."
  },
  {
    key: "Editor",
    title: "Editor",
    desc: "Pwedeng mag-add at mag-edit ng content (tasks, docs, posts, ideas) para sa client na ito. Hindi pwedeng mag-delete o mag-invite ng bagong member."
  },
  {
    key: "Observer",
    title: "Observer",
    desc: "View-only. Makikita ang shared content ng client pero hindi pwedeng mag-edit, mag-delete, o mag-invite."
  }
];

const VIP_PRICES = {
  monthly: 3,
  yearly: 27,
  lifetime: 70
};

const PAYMENT_DETAILS = {
  gcashName: "PALITAN_MO_NAME_MO",
  gcashNumber: "09XXXXXXXXX",
  mayaName: "PALITAN_MO_NAME_MO",
  mayaNumber: "09XXXXXXXXX",
  paypalLink: "https://paypal.me/PALITAN_MO"
};

const DEFAULT_PREFS = {
  theme: "dark",
  appLanguage: "auto",
  contentLanguage: "English"
};

const DEFAULT_ABOUT = {
  appName: APP_SHORT_NAME,
  supportEmail: "",
  supportPhone: "",
  facebook: "",
  instagram: "",
  tiktok: "",
  whatsapp: "",
  note: "Premium social media workspace for planning, editing, AI assistance, and client collaboration."
};

const DEFAULT_DNA = {
  brandName: "",
  audience: "",
  mission: "",
  tone: "",
  contentStyle: "",
  goals: "",
  constraints: "",
  offers: "",
  ctaStyle: "",
  preferredLanguage: ""
};

const AI_FUNCTION_NAME = "groq-ai";

const UI_TEXT = {
  auto: {
    btnQuickAdd: "Add",
    btnSearch: "Search",
    btnBackup: "Backup",
    navHome: "Home",
    navCalendar: "Calendar",
    navPosts: "Library",
    navIdeas: "Ideas",
    navAssets: "Assets",
    navClients: "Team",
    navAbout: "More"
  },
  taglish: {
    btnQuickAdd: "Add",
    btnSearch: "Search",
    btnBackup: "Backup",
    navHome: "Home",
    navCalendar: "Calendar",
    navPosts: "Library",
    navIdeas: "Ideas",
    navAssets: "Assets",
    navClients: "Team",
    navAbout: "More"
  },
  english: {
    btnQuickAdd: "Add",
    btnSearch: "Search",
    btnBackup: "Backup",
    navHome: "Home",
    navCalendar: "Calendar",
    navPosts: "Library",
    navIdeas: "Ideas",
    navAssets: "Assets",
    navClients: "Team",
    navAbout: "More"
  },
  filipino: {
    btnQuickAdd: "Dagdag",
    btnSearch: "Hanap",
    btnBackup: "Backup",
    navHome: "Home",
    navCalendar: "Kalendaryo",
    navPosts: "Library",
    navIdeas: "Ideas",
    navAssets: "Assets",
    navClients: "Team",
    navAbout: "More"
  },
  spanish: {
    btnQuickAdd: "Agregar",
    btnSearch: "Buscar",
    btnBackup: "Respaldo",
    navHome: "Inicio",
    navCalendar: "Calendario",
    navPosts: "Biblioteca",
    navIdeas: "Ideas",
    navAssets: "Archivos",
    navClients: "Equipo",
    navAbout: "Más"
  },
  portuguese: {
    btnQuickAdd: "Adicionar",
    btnSearch: "Buscar",
    btnBackup: "Backup",
    navHome: "Início",
    navCalendar: "Calendário",
    navPosts: "Biblioteca",
    navIdeas: "Ideias",
    navAssets: "Arquivos",
    navClients: "Equipe",
    navAbout: "Mais"
  },
  french: {
    btnQuickAdd: "Ajouter",
    btnSearch: "Recherche",
    btnBackup: "Sauvegarde",
    navHome: "Accueil",
    navCalendar: "Calendrier",
    navPosts: "Bibliothèque",
    navIdeas: "Idées",
    navAssets: "Fichiers",
    navClients: "Équipe",
    navAbout: "Plus"
  },
  german: {
    btnQuickAdd: "Neu",
    btnSearch: "Suche",
    btnBackup: "Backup",
    navHome: "Start",
    navCalendar: "Kalender",
    navPosts: "Bibliothek",
    navIdeas: "Ideen",
    navAssets: "Dateien",
    navClients: "Team",
    navAbout: "Mehr"
  },
  arabic: {
    btnQuickAdd: "إضافة",
    btnSearch: "بحث",
    btnBackup: "نسخة",
    navHome: "الرئيسية",
    navCalendar: "التقويم",
    navPosts: "المكتبة",
    navIdeas: "أفكار",
    navAssets: "ملفات",
    navClients: "الفريق",
    navAbout: "المزيد"
  },
  hindi: {
    btnQuickAdd: "जोड़ें",
    btnSearch: "खोज",
    btnBackup: "बैकअप",
    navHome: "होम",
    navCalendar: "कैलेंडर",
    navPosts: "लाइब्रेरी",
    navIdeas: "आइडिया",
    navAssets: "एसेट्स",
    navClients: "टीम",
    navAbout: "और"
  },
  indonesian: {
    btnQuickAdd: "Tambah",
    btnSearch: "Cari",
    btnBackup: "Backup",
    navHome: "Beranda",
    navCalendar: "Kalender",
    navPosts: "Library",
    navIdeas: "Ide",
    navAssets: "Aset",
    navClients: "Tim",
    navAbout: "Lainnya"
  },
  thai: {
    btnQuickAdd: "เพิ่ม",
    btnSearch: "ค้นหา",
    btnBackup: "สำรอง",
    navHome: "หน้าแรก",
    navCalendar: "ปฏิทิน",
    navPosts: "คลัง",
    navIdeas: "ไอเดีย",
    navAssets: "ไฟล์",
    navClients: "ทีม",
    navAbout: "เพิ่มเติม"
  },
  vietnamese: {
    btnQuickAdd: "Thêm",
    btnSearch: "Tìm",
    btnBackup: "Sao lưu",
    navHome: "Trang chủ",
    navCalendar: "Lịch",
    navPosts: "Thư viện",
    navIdeas: "Ý tưởng",
    navAssets: "Tệp",
    navClients: "Nhóm",
    navAbout: "Thêm"
  },
  japanese: {
    btnQuickAdd: "追加",
    btnSearch: "検索",
    btnBackup: "バックアップ",
    navHome: "ホーム",
    navCalendar: "カレンダー",
    navPosts: "ライブラリ",
    navIdeas: "アイデア",
    navAssets: "素材",
    navClients: "チーム",
    navAbout: "その他"
  },
  korean: {
    btnQuickAdd: "추가",
    btnSearch: "검색",
    btnBackup: "백업",
    navHome: "홈",
    navCalendar: "캘린더",
    navPosts: "라이브러리",
    navIdeas: "아이디어",
    navAssets: "에셋",
    navClients: "팀",
    navAbout: "더보기"
  },
  chinese: {
    btnQuickAdd: "添加",
    btnSearch: "搜索",
    btnBackup: "备份",
    navHome: "首页",
    navCalendar: "日历",
    navPosts: "内容库",
    navIdeas: "灵感",
    navAssets: "素材",
    navClients: "团队",
    navAbout: "更多"
  }
};

function $(sel, root) {
  return (root || document).querySelector(sel);
}

function $$(sel, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
}

function getEl(id) {
  return document.getElementById(id);
}

function getVal(id, fallback) {
  const node = getEl(id);
  if (!node) return typeof fallback === "undefined" ? "" : fallback;
  return typeof node.value === "undefined" ? (typeof fallback === "undefined" ? "" : fallback) : node.value;
}

function bind(id, eventName, handler) {
  const node = getEl(id);
  if (node) node.addEventListener(eventName, handler);
}

const state = {
  db: null,
  view: "dashboard",
  calendarCursor: new Date(),
  modalLocked: false,
  cache: {
    pillars: [],
    posts: [],
    ideas: [],
    assets: [],
    postAssets: [],
    clients: [],
    tasks: [],
    docs: [],
    payrollRuns: []
  },
  access: {
    checked: false,
    allowed: false,
    reason: "auth_required",
    profile: null,
    user: null
  }
};

function cloneJSON(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function uid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function clampText(s, max) {
  const limit = typeof max === "number" ? max : 90;
  const t = (s || "").trim();
  if (t.length <= limit) return t;
  return t.slice(0, limit - 1) + "...";
}

function peso(v) {
  return "$" + Number(v).toLocaleString("en-US");
}

function resolveAppLanguageKey() {
  const prefs = getPrefs();
  const selected = prefs.appLanguage || "auto";
  if (selected !== "auto") return UI_TEXT[selected] ? selected : "english";

  const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]).map(function (x) {
    return String(x || "").toLowerCase();
  });
  const map = [
    ["fil", "filipino"],
    ["tl", "taglish"],
    ["es", "spanish"],
    ["pt", "portuguese"],
    ["fr", "french"],
    ["de", "german"],
    ["ar", "arabic"],
    ["hi", "hindi"],
    ["id", "indonesian"],
    ["th", "thai"],
    ["vi", "vietnamese"],
    ["ja", "japanese"],
    ["ko", "korean"],
    ["zh", "chinese"]
  ];

  for (let i = 0; i < langs.length; i++) {
    for (let j = 0; j < map.length; j++) {
      if (langs[i].indexOf(map[j][0]) === 0) return map[j][1];
    }
  }
  return "english";
}

function setText(id, text) {
  const node = getEl(id);
  if (node) node.textContent = text;
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return cloneJSON(fallback);
    return Object.assign(cloneJSON(fallback), JSON.parse(raw));
  } catch (e) {
    return cloneJSON(fallback);
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getPrefs() {
  return loadJSON(PREFS_KEY, DEFAULT_PREFS);
}

function savePrefs(v) {
  saveJSON(PREFS_KEY, v);
}

function getAboutProfile() {
  return loadJSON(ABOUT_KEY, DEFAULT_ABOUT);
}

function saveAboutProfile(v) {
  saveJSON(ABOUT_KEY, v);
}

function getCreatorDNA() {
  return loadJSON(DNA_KEY, DEFAULT_DNA);
}

function saveCreatorDNA(v) {
  saveJSON(DNA_KEY, v);
}

function applyTheme() {
  const prefs = getPrefs();
  let theme = prefs.theme || "dark";
  if (theme === "system" && window.matchMedia) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    theme = prefersDark ? "dark" : "light";
  }
  document.documentElement.setAttribute("data-theme", theme);
}

function applyAppLanguage() {
  const dict = UI_TEXT[resolveAppLanguageKey()] || UI_TEXT.english;

  setText("labelBtnQuickAdd", dict.btnQuickAdd);
  setText("labelBtnSearch", dict.btnSearch);
  setText("labelBtnBackup", dict.btnBackup);
  setText("navLblHome", dict.navHome);
  setText("navLblOrganize", dict.navOrganize || "Organize");
  setText("navLblNotes", dict.navNotes || "Notes");
  setText("navLblDocs", dict.navDocs || "Docs");
  setText("navLblCalendar", dict.navCalendar);
  setText("navLblPosts", dict.navPosts);
  setText("navLblIdeas", dict.navIdeas);
  setText("navLblAssets", dict.navAssets);
  setText("navLblClients", dict.navClients);
  setText("navLblPayroll", dict.navPayroll || "Payroll");
  setText("navLblTools", dict.navTools || "Tools");
  setText("navLblTutorial", dict.navTutorial || "Tutorial");
  setText("navLblAbout", dict.navAbout);
  setText("navLblSettings", dict.navSettings || dict.navAbout || "Settings");
}

function updateBrandHeader() {
  const about = getAboutProfile();
  setText("brandTitleText", about.appName || APP_SHORT_NAME);
  setText("brandSubText", APP_FULL_NAME + " • Premium workspace");
}

function toast(msg) {
  const el = getEl("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(function () {
    el.classList.add("hidden");
  }, 1800);
}

async function getCurrentUser() {
  if (typeof supabaseClient === "undefined") return null;
  const result = await supabaseClient.auth.getUser();
  if (!result || result.error) return null;
  return result.data ? result.data.user || null : null;
}

async function signUp(email, password) {
  if (typeof supabaseClient === "undefined") {
    alert("Supabase client not found.");
    return null;
  }
  const result = await supabaseClient.auth.signUp({ email: email, password: password });
  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return result.data;
}

async function signIn(email, password) {
  if (typeof supabaseClient === "undefined") {
    alert("Supabase client not found.");
    return null;
  }
  const result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return result.data;
}

async function signOutUser() {
  if (typeof supabaseClient === "undefined") return;
  await supabaseClient.auth.signOut();
  toast("Logged out");
}

function trialDaysLeft(profile) {
  if (!profile || !profile.trial_ends_at) return 0;
  const diff = new Date(profile.trial_ends_at).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function isVipActive(profile) {
  if (!profile) return false;
  const status = String(profile.vip_status || "").toLowerCase();
  const activeStatus = status === "active" || status === "approved" || status === "vip";
  if (!activeStatus) return false;
  if (!profile.vip_until) return true;
  return new Date(profile.vip_until).getTime() >= Date.now();
}

function isTrialActive(profile) {
  if (!profile || !profile.trial_ends_at) return false;
  return new Date(profile.trial_ends_at).getTime() >= Date.now();
}

function hasVipFeatureAccess() {
  if (VIP_GATE_DISABLED) return true;
  return !!(state.access.profile && isVipActive(state.access.profile));
}

function getPremiumFeatureLabel(feature) {
  if (feature === "calendar") return "Calendar";
  if (feature === "clients") return "Clients & Team";
  if (feature === "ai") return "AI Assistant";
  return "VIP tools";
}

function getMembershipSummaryText() {
  const profile = state.access.profile;
  if (state.access.reason === "auth_required") return "Mag-login muna para ma-save ang account dashboard at membership mo.";
  if (profile && hasVipFeatureAccess()) {
    const plan = profile.plan || "vip";
    if (!profile.vip_until) return "VIP active: " + plan + " plan. Unlocked ang AI Assistant, Calendar, at Clients & Team.";
    return "VIP active: " + plan + ". Valid until " + new Date(profile.vip_until).toLocaleString() + ".";
  }
  if (profile && profile.payment_status === "pending") {
    return "May naka-pending kang VIP checkout. Kung hindi pa natapos ang bayad, i-tap ulit ang Upgrade para bumalik sa PayMongo.";
  }
  if (profile && isTrialActive(profile)) {
    return "Core workspace active. Premium tools stay locked until VIP is active. Trial note: " + trialDaysLeft(profile) + " day(s) left.";
  }
  return "Free account lang ito ngayon. Locked ang AI Assistant, Calendar, at Clients & Team until VIP is active.";
}

function renderAccountButton() {
  const node = getEl("labelBtnAccount");
  const btn = getEl("btnAccount");
  if (!node) return;

  if (state.access.reason === "auth_required") {
    node.textContent = "Login / Sign Up";
    if (btn) {
      btn.classList.remove("btnGhost");
      btn.classList.add("btnPrimary");
    }
    return;
  }

  if (btn) {
    btn.classList.remove("btnPrimary");
    btn.classList.add("btnGhost");
  }

  if (state.access.profile && hasVipFeatureAccess()) {
    node.textContent = String(state.access.profile.plan || "VIP").toUpperCase();
    return;
  }

  if (state.access.profile && state.access.profile.payment_status === "pending") {
    node.textContent = "MEMBER";
    return;
  }

  node.textContent = "Upgrade";
}

async function getOrCreateProfile(user) {
  if (typeof supabaseClient === "undefined") return null;

  const selectResult = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectResult.error) {
    alert(selectResult.error.message);
    return null;
  }

  if (selectResult.data) return selectResult.data;

  const now = new Date();
  const end = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const insertResult = await supabaseClient
    .from("profiles")
    .insert([{
      id: user.id,
      email: user.email || "",
      full_name: user.user_metadata && user.user_metadata.full_name ? user.user_metadata.full_name : "",
      role: "user",
      plan: "free",
      vip_status: "inactive",
      vip_until: null,
      trial_ends_at: end.toISOString(),
      payment_status: "none",
      payment_reference: "",
      updated_at: now.toISOString()
    }])
    .select()
    .single();

  if (insertResult.error) {
    alert(insertResult.error.message);
    return null;
  }

  return insertResult.data;
}

async function syncAccessState() {
  const user = await getCurrentUser();

  if (!user) {
    state.access = {
      checked: true,
      allowed: false,
      reason: "auth_required",
      profile: null,
      user: null
    };
    renderAccountButton();
    return;
  }

  const profile = await getOrCreateProfile(user);

  state.access = {
    checked: true,
    allowed: true,
    reason: "active",
    profile: profile,
    user: user
  };

  renderAccountButton();
}

async function submitManualVipRequest() {
  if (typeof supabaseClient === "undefined") {
    alert("Supabase client not found.");
    return;
  }

  const user = state.access.user || await getCurrentUser();
  if (!user) {
    alert("Please log in first before saving a VIP plan.");
    return;
  }

  const plan = getVal("vipPlan", "monthly");

  const result = await supabaseClient.functions.invoke("paymongo_create_checkout", {
    body: {
      plan: plan,
      success_url: window.location.origin + window.location.pathname + "?vip=success",
      cancel_url: window.location.origin + window.location.pathname + "?vip=cancel"
    }
  });

  if (result.error) {
    alert("Hindi na-process ang checkout: " + result.error.message);
    return;
  }

  const checkoutUrl = result.data && result.data.checkout_url;
  if (!checkoutUrl) {
    alert("Walang na-generate na checkout link. Subukan ulit.");
    return;
  }

  window.location.href = checkoutUrl;
}

function showTrialReminderOnce() {
  const profile = state.access.profile;
  if (!profile || isVipActive(profile) || !isTrialActive(profile)) return;

  const left = trialDaysLeft(profile);
  if (left > 3) return;

  const key = "smm_trial_notice_" + fmtDate(new Date());
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, "1");

  if (left === 1) toast("Last day of your free trial.");
  else toast(left + " days left in your free trial.");
}

function updateTopbarChrome(view) {
  const brand = getEl("brandBlock");
  const titleBlock = getEl("pageTitleBlock");
  const backBtn = getEl("btnBack");
  const titleText = getEl("pageTitleText");
  const isHome = view === "dashboard";
  if (brand) brand.classList.toggle("hidden", !isHome);
  if (titleBlock) titleBlock.classList.toggle("hidden", isHome);
  if (backBtn) backBtn.classList.toggle("hidden", isHome);
  if (titleText) titleText.textContent = VIEW_TITLES[view] || "";
}

function setView(view) {
  if (VIEWS.indexOf(view) === -1) view = "dashboard";
  if (PREMIUM_VIEWS.indexOf(view) !== -1 && guardPremiumAccess(view)) return;
  state.view = view;

  $$(".view").forEach(function (v) { v.classList.add("hidden"); });
  const target = document.querySelector('[data-view="' + view + '"]');
  if (target) target.classList.remove("hidden");

  $$(".navItem").forEach(function (b) { b.classList.remove("active"); });
  const navBtn = document.querySelector('.navItem[data-nav="' + view + '"]');
  let activeGroup = null;
  Object.keys(NAV_GROUPS).forEach(function (g) {
    if (NAV_GROUPS[g].indexOf(view) !== -1) activeGroup = g;
  });
  if (activeGroup) {
    const groupBtn = document.querySelector('.navItem[data-group="' + activeGroup + '"]');
    if (groupBtn) groupBtn.classList.add("active");
  } else if (navBtn) {
    navBtn.classList.add("active");
  }

  ["content", "team"].forEach(function (g) {
    const segNav = getEl(g + "SegNav");
    if (!segNav) return;
    if (activeGroup === g) {
      segNav.classList.remove("hidden");
      $$(".segBtn", segNav).forEach(function (b) { b.classList.toggle("active", b.dataset.seg === view); });
    } else {
      segNav.classList.add("hidden");
    }
  });

  updateTopbarChrome(view);


  if (view === "dashboard") renderDashboard();
  if (view === "organize") renderOrganize();
  if (view === "notes") renderNotesBoard();
  if (view === "docs") renderDocsBoard();
  if (view === "calendar") renderCalendar();
  if (view === "posts") renderPosts();
  if (view === "pillars") renderPillars();
  if (view === "ideas") renderIdeas();
  if (view === "assets") renderAssets();
  if (view === "clients") renderClients();
  if (view === "payroll") renderPayrollTab();
  if (view === "tools") renderTools();
  if (view === "tutorial") renderTutorial();
  if (view === "backup") renderBackup();
  if (view === "about") renderAbout();
}

function openModal(title, bodyEl, opts) {
  const options = opts || {};
  setText("modalTitle", title);
  const body = getEl("modalBody");
  if (body) {
    body.innerHTML = "";
    body.appendChild(bodyEl);
  }
  state.modalLocked = !!options.locked;
  const root = getEl("modalRoot");
  if (root) {
    root.classList.remove("hidden");
    root.setAttribute("aria-hidden", "false");
  }
  const closeBtn = getEl("modalClose");
  if (closeBtn) closeBtn.classList.toggle("hidden", !!options.locked);
}

function closeModal(force) {
  const reallyForce = !!force;
  if (state.modalLocked && !reallyForce) return;
  if (typeof closeJitsiCall === "function") closeJitsiCall();
  const active = document.activeElement;
  if (active && typeof active.blur === "function") active.blur();
  state.modalLocked = false;
  const root = getEl("modalRoot");
  const body = getEl("modalBody");
  const closeBtn = getEl("modalClose");
  if (root) {
    root.classList.add("hidden");
    root.setAttribute("aria-hidden", "true");
  }
  if (body) body.innerHTML = "";
  if (closeBtn) closeBtn.classList.remove("hidden");
}

function enforceAccessUI() {
  renderAccountButton();

  if (state.access.reason === "auth_required") {
    openAuthModal({ force: true });
    return;
  }

  if (state.modalLocked) closeModal(true);
  showTrialReminderOnce();
}

function guardPremiumAccess(feature) {
  if (state.access.reason === "auth_required") {
    openAuthModal({ force: false });
    return true;
  }
  if (VIP_GATE_DISABLED) return false;
  if (!hasVipFeatureAccess()) {
    openPaywallModal({ force: false, feature: feature });
    return true;
  }
  return false;
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  const at = attrs || {};
  const ch = children || [];

  Object.keys(at).forEach(function (k) {
    const v = at[k];
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.indexOf("on") === 0 && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });

  ch.forEach(function (c) {
    if (c === null || typeof c === "undefined") return;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  });

  return node;
}

function dbTx(storeNames, mode) {
  return state.db.transaction(storeNames, mode || "readonly");
}

function localdbGetAll(storeName) {
  return new Promise(function (resolve, reject) {
    const tx = dbTx([storeName], "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = function () { resolve(req.result || []); };
    req.onerror = function () { reject(req.error); };
  });
}

function localdbPut(storeName, obj) {
  return new Promise(function (resolve, reject) {
    const tx = dbTx([storeName], "readwrite");
    const req = tx.objectStore(storeName).put(obj);
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

function localdbDelete(storeName, key) {
  return new Promise(function (resolve, reject) {
    const tx = dbTx([storeName], "readwrite");
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = function () { resolve(true); };
    req.onerror = function () { reject(req.error); };
  });
}

function localdbClear(storeName) {
  return new Promise(function (resolve, reject) {
    const tx = dbTx([storeName], "readwrite");
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = function () { resolve(true); };
    req.onerror = function () { reject(req.error); };
  });
}

async function supabaseGetClients() {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return [];

  const clientResult = await supabaseClient
    .from("clients")
    .select("*")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (clientResult.error) {
    alert(clientResult.error.message);
    return [];
  }

  const clients = clientResult.data || [];
  if (!clients.length) return [];

  const clientIds = clients.map(function (c) { return c.id; });

  const memberResult = await supabaseClient
    .from("client_members")
    .select("*")
    .in("client_id", clientIds);

  if (memberResult.error) {
    alert(memberResult.error.message);
    return [];
  }

  const members = memberResult.data || [];

  return clients.map(function (c) {
    return {
      id: c.id,
      name: c.name || "",
      niche: c.niche || "",
      goals: c.goals || "",
      notes: c.notes || "",
      rateType: c.rate_type || "hourly",
      rateAmount: typeof c.rate_amount === "number" ? c.rate_amount : Number(c.rate_amount || 0),
      currency: c.currency || "PHP",
      payrollEnabled: c.payroll_enabled !== false,
      createdAt: c.created_at ? new Date(c.created_at).getTime() : Date.now(),
      updatedAt: c.updated_at ? new Date(c.updated_at).getTime() : Date.now(),
      members: members.filter(function (m) { return m.client_id === c.id; }).map(function (m) {
        return {
          id: m.id,
          email: m.email || "",
          role: m.role || "Observer",
          createdAt: m.created_at ? new Date(m.created_at).getTime() : Date.now()
        };
      })
    };
  });
}

async function supabaseSaveClient(obj) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbPut("clients", obj);

  const payload = {
    id: obj.id || undefined,
    owner_id: user.id,
    name: obj.name || "",
    niche: obj.niche || "",
    goals: obj.goals || "",
    notes: obj.notes || "",
    rate_type: obj.rateType === "fixed" ? "fixed" : "hourly",
    rate_amount: Number(obj.rateAmount || 0),
    currency: (obj.currency || "PHP").trim() || "PHP",
    payroll_enabled: obj.payrollEnabled !== false,
    updated_at: new Date().toISOString()
  };

  const saveResult = await supabaseClient.from("clients").upsert([payload]).select();
  if (saveResult.error) {
    alert(saveResult.error.message);
    return null;
  }

  const savedClient = saveResult.data && saveResult.data[0];
  if (!savedClient) return null;

  const clientId = savedClient.id;

  const deleteMembersResult = await supabaseClient
    .from("client_members")
    .delete()
    .eq("client_id", clientId);

  if (deleteMembersResult.error) {
    alert(deleteMembersResult.error.message);
    return null;
  }

  const members = Array.isArray(obj.members) ? obj.members : [];
  if (members.length) {
    const seenEmails = {};
    const rows = [];
    members.forEach(function (m) {
      const email = (m.email || "").trim().toLowerCase();
      if (!email) return;
      if (seenEmails[email]) return; // skip duplicates within the same save
      seenEmails[email] = true;
      rows.push({
        client_id: clientId,
        email: email,
        role: m.role || "Observer"
      });
    });

    if (rows.length) {
      const insertMembersResult = await supabaseClient.from("client_members").insert(rows);
      if (insertMembersResult.error) {
        alert(insertMembersResult.error.message);
        return null;
      }
    }
  }

  return savedClient;
}

async function supabaseDeleteClient(clientId) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbDelete("clients", clientId);

  const result = await supabaseClient
    .from("clients")
    .delete()
    .eq("id", clientId)
    .eq("owner_id", user.id);

  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return true;
}

// ---- Phase 5: Tasks / Docs / Posts / Ideas / Pillars / Assets — Supabase-synced, client-shareable ----

async function supabaseGetTasks() {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return [];
  const result = await supabaseClient
    .from("tasks")
    .select("*")
    .order("updated_at", { ascending: false });
  if (result.error) { alert(result.error.message); return []; }
  return (result.data || []).map(function (t) {
    return {
      id: t.id,
      title: t.title || "",
      category: t.category || "General",
      status: t.status || "todo",
      dueDate: t.due_date || "",
      notes: t.notes || "",
      clientId: t.client_id || "",
      createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
      updatedAt: t.updated_at ? new Date(t.updated_at).getTime() : Date.now()
    };
  });
}

async function supabaseSaveTask(obj) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbPut("tasks", obj);
  const payload = {
    id: obj.id || undefined,
    owner_id: user.id,
    created_by: user.id,
    client_id: obj.clientId || null,
    title: obj.title || "",
    category: obj.category || "General",
    status: obj.status || "todo",
    due_date: obj.dueDate || null,
    notes: obj.notes || "",
    updated_at: new Date().toISOString()
  };
  const result = await supabaseClient.from("tasks").upsert([payload]).select();
  if (result.error) { alert(result.error.message); return null; }
  return result.data && result.data[0];
}

async function supabaseDeleteTask(taskId) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbDelete("tasks", taskId);
  const result = await supabaseClient.from("tasks").delete().eq("id", taskId);
  if (result.error) { alert(result.error.message); return null; }
  return true;
}

async function supabaseGetDocs() {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return [];
  const result = await supabaseClient
    .from("docs")
    .select("*")
    .order("updated_at", { ascending: false });
  if (result.error) { alert(result.error.message); return []; }
  return (result.data || []).map(function (d) {
    return {
      id: d.id,
      title: d.title || "",
      type: d.doc_type || "other",
      client: d.client_label || "",
      clientId: d.client_id || "",
      content: d.content || "",
      createdAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
      updatedAt: d.updated_at ? new Date(d.updated_at).getTime() : Date.now()
    };
  });
}

async function supabaseSaveDoc(obj) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbPut("docs", obj);
  const payload = {
    id: obj.id || undefined,
    owner_id: user.id,
    created_by: user.id,
    client_id: obj.clientId || null,
    title: obj.title || "",
    doc_type: obj.type || "other",
    client_label: obj.client || "",
    content: obj.content || "",
    updated_at: new Date().toISOString()
  };
  const result = await supabaseClient.from("docs").upsert([payload]).select();
  if (result.error) { alert(result.error.message); return null; }
  return result.data && result.data[0];
}

async function supabaseDeleteDoc(docId) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbDelete("docs", docId);
  const result = await supabaseClient.from("docs").delete().eq("id", docId);
  if (result.error) { alert(result.error.message); return null; }
  return true;
}

async function supabaseGetPillars() {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return [];
  const result = await supabaseClient
    .from("content_pillars")
    .select("*")
    .order("updated_at", { ascending: false });
  if (result.error) { alert(result.error.message); return []; }
  return (result.data || []).map(function (p) {
    return {
      id: p.id,
      name: p.name || "",
      description: p.description || "",
      clientId: p.client_id || "",
      createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
      updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : Date.now()
    };
  });
}

async function supabaseSavePillar(obj) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbPut("pillars", obj);
  const payload = {
    id: obj.id || undefined,
    owner_id: user.id,
    created_by: user.id,
    client_id: obj.clientId || null,
    name: obj.name || "",
    description: obj.description || "",
    updated_at: new Date().toISOString()
  };
  const result = await supabaseClient.from("content_pillars").upsert([payload]).select();
  if (result.error) { alert(result.error.message); return null; }
  return result.data && result.data[0];
}

async function supabaseDeletePillar(pillarId) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbDelete("pillars", pillarId);
  const result = await supabaseClient.from("content_pillars").delete().eq("id", pillarId);
  if (result.error) { alert(result.error.message); return null; }
  return true;
}

async function supabaseGetPosts() {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return [];
  const result = await supabaseClient
    .from("posts")
    .select("*")
    .order("scheduled_date", { ascending: true });
  if (result.error) { alert(result.error.message); return []; }
  return (result.data || []).map(function (p) {
    return {
      id: p.id,
      title: p.title || "",
      caption: p.caption || "",
      hashtags: p.hashtags || "",
      notes: p.notes || "",
      platform: p.platform || "Other",
      status: p.status || "Draft",
      pillarId: p.pillar_id || "",
      clientId: p.client_id || "",
      scheduledDate: p.scheduled_date || "",
      createdAt: p.created_at ? new Date(p.created_at).getTime() : Date.now(),
      updatedAt: p.updated_at ? new Date(p.updated_at).getTime() : Date.now()
    };
  });
}

async function supabaseSavePost(obj) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbPut("posts", obj);
  const payload = {
    id: obj.id || undefined,
    owner_id: user.id,
    created_by: user.id,
    client_id: obj.clientId || null,
    pillar_id: obj.pillarId || null,
    title: obj.title || "",
    caption: obj.caption || "",
    hashtags: obj.hashtags || "",
    notes: obj.notes || "",
    platform: obj.platform || "Other",
    status: obj.status || "Draft",
    scheduled_date: obj.scheduledDate || null,
    updated_at: new Date().toISOString()
  };
  const result = await supabaseClient.from("posts").upsert([payload]).select();
  if (result.error) { alert(result.error.message); return null; }
  return result.data && result.data[0];
}

async function supabaseDeletePost(postId) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbDelete("posts", postId);
  const result = await supabaseClient.from("posts").delete().eq("id", postId);
  if (result.error) { alert(result.error.message); return null; }
  return true;
}

async function supabaseGetIdeas() {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return [];
  const result = await supabaseClient
    .from("ideas")
    .select("*")
    .order("updated_at", { ascending: false });
  if (result.error) { alert(result.error.message); return []; }
  return (result.data || []).map(function (i) {
    return {
      id: i.id,
      title: i.title || "",
      notes: i.notes || "",
      status: i.status || "Idea",
      clientId: i.client_id || "",
      createdAt: i.created_at ? new Date(i.created_at).getTime() : Date.now(),
      updatedAt: i.updated_at ? new Date(i.updated_at).getTime() : Date.now()
    };
  });
}

async function supabaseSaveIdea(obj) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbPut("ideas", obj);
  const payload = {
    id: obj.id || undefined,
    owner_id: user.id,
    created_by: user.id,
    client_id: obj.clientId || null,
    title: obj.title || "",
    notes: obj.notes || "",
    status: obj.status || "Idea",
    updated_at: new Date().toISOString()
  };
  const result = await supabaseClient.from("ideas").upsert([payload]).select();
  if (result.error) { alert(result.error.message); return null; }
  return result.data && result.data[0];
}

async function supabaseDeleteIdea(ideaId) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbDelete("ideas", ideaId);
  const result = await supabaseClient.from("ideas").delete().eq("id", ideaId);
  if (result.error) { alert(result.error.message); return null; }
  return true;
}

async function supabaseGetAssets() {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return [];
  const result = await supabaseClient
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });
  if (result.error) { alert(result.error.message); return []; }
  return (result.data || []).map(function (a) {
    return {
      id: a.id,
      name: a.name || "",
      bucket: a.bucket || "assets",
      objectPath: a.object_path || "",
      mimeType: a.mime_type || "",
      sizeBytes: a.size_bytes || 0,
      clientId: a.client_id || "",
      createdAt: a.created_at ? new Date(a.created_at).getTime() : Date.now()
    };
  });
}

async function supabaseSaveAsset(obj) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbPut("assets", obj);
  const payload = {
    id: obj.id || undefined,
    owner_id: user.id,
    created_by: user.id,
    client_id: obj.clientId || null,
    name: obj.name || "",
    bucket: obj.bucket || "assets",
    object_path: obj.objectPath || "",
    mime_type: obj.mimeType || "",
    size_bytes: obj.sizeBytes || 0
  };
  const result = await supabaseClient.from("assets").upsert([payload]).select();
  if (result.error) { alert(result.error.message); return null; }
  return result.data && result.data[0];
}

async function supabaseDeleteAsset(assetId) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbDelete("assets", assetId);
  const existing = state.cache.assets.find(function (a) { return a.id === assetId; });
  const result = await supabaseClient.from("assets").delete().eq("id", assetId);
  if (result.error) { alert(result.error.message); return null; }
  if (existing && existing.objectPath && existing.bucket !== "external") {
    await supabaseClient.storage.from(existing.bucket || "assets").remove([existing.objectPath]);
  }
  return true;
}

// ---- Phase 6: Tool Directory (tool_modules / user_tool_preferences) ----

async function supabaseGetToolModules() {
  if (typeof supabaseClient === "undefined") return [];
  const result = await supabaseClient
    .from("tool_modules")
    .select("*")
    .order("category", { ascending: true });
  if (result.error) { console.error(result.error.message); return []; }
  return (result.data || []).map(function (t) {
    return { id: t.id, key: t.key, label: t.label, category: t.category || "general", isEnabled: t.is_enabled !== false };
  });
}

async function supabaseGetToolPreferences() {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return [];
  const result = await supabaseClient
    .from("user_tool_preferences")
    .select("*")
    .eq("user_id", user.id);
  if (result.error) { console.error(result.error.message); return []; }
  return (result.data || []).map(function (p) { return p.tool_key; });
}

async function supabaseSetToolPinned(toolKey, pinned) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") { alert("Mag-login muna para mag-pin ng tools."); return null; }
  if (pinned) {
    const result = await supabaseClient.from("user_tool_preferences").upsert([{
      user_id: user.id, tool_key: toolKey, pinned: true
    }], { onConflict: "user_id,tool_key" }).select();
    if (result.error) { alert(result.error.message); return null; }
    return result.data && result.data[0];
  }
  const result = await supabaseClient.from("user_tool_preferences").delete().eq("user_id", user.id).eq("tool_key", toolKey);
  if (result.error) { alert(result.error.message); return null; }
  return true;
}

// ---- Phase 7: Grammar & Writing tool (LanguageTool free public API, no key) ----
// Uses https://api.languagetool.org/v2/check directly from the frontend.
// Free tier has no auth/key, ~20 req/min, 20,000 chars/req rate limit — enough for this app.
// No Supabase Edge Function needed here since there is no secret to protect.

async function checkGrammarText(text, lang) {
  const clean = (text || "").trim();
  if (!clean) return { matches: [] };
  try {
    const params = new URLSearchParams();
    params.set("text", clean);
    params.set("language", lang || "en-US");
    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    if (!res.ok) throw new Error("LanguageTool request failed (" + res.status + ")");
    const data = await res.json();
    return data && data.matches ? data : { matches: [] };
  } catch (err) {
    console.error("Grammar check error:", err);
    toast("Grammar check failed. Check your internet connection and try again.");
    return { matches: [] };
  }
}

// Wires a "Check Grammar" button + results panel to a given textarea.
function wireGrammarCheck(buttonId, textareaId, panelId) {
  const btn = getEl(buttonId);
  const panel = getEl(panelId);
  if (!btn || !panel) return;

  let lastCheckedText = null;

  bind(buttonId, "click", async function () {
    const ta = getEl(textareaId);
    if (!ta) return;
    const text = ta.value || "";
    if (!text.trim()) { toast("Walang laman ang teksto na chi-check."); return; }

    const originalLabel = btn.textContent;
    btn.textContent = "Checking...";
    btn.disabled = true;

    const data = await checkGrammarText(text, "en-US");
    lastCheckedText = text;

    btn.textContent = originalLabel;
    btn.disabled = false;

    renderGrammarResults(panel, data.matches || [], textareaId, lastCheckedText);
  });
}

function renderGrammarResults(panel, matches, textareaId, checkedText) {
  panel.innerHTML = "";

  if (!matches || !matches.length) {
    panel.appendChild(el("div", { class: "notice" }, [
      el("div", { class: "muted", text: "Walang nakitang isyu. Mukhang okay na ang grammar." })
    ]));
    return;
  }

  panel.appendChild(el("div", { class: "muted", text: matches.length + " posibleng isyu ang nahanap:" }));

  matches.forEach(function (m) {
    const suggestion = m.replacements && m.replacements.length ? m.replacements[0].value : null;
    const contextText = m.context && m.context.text ? m.context.text : "";

    const row = el("div", { class: "item" }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: m.shortMessage || m.message || "Grammar issue" }),
        el("div", { class: "muted", text: contextText })
      ])
    ]);

    const actions = el("div", { class: "itemActions" }, []);
    if (suggestion) {
      actions.appendChild(el("button", { class: "iconBtn", type: "button", text: "Use: " + suggestion, onclick: function () {
        const ta = getEl(textareaId);
        if (!ta) return;
        if (ta.value !== checkedText) {
          toast("Nagbago na ang text — i-check ulit bago mag-apply.");
          return;
        }
        const offset = m.offset;
        const length = m.length;
        const before = ta.value.slice(0, offset);
        const after = ta.value.slice(offset + length);
        ta.value = before + suggestion + after;
        checkedText = ta.value;
        row.remove();
      } }));
    }
    row.appendChild(actions);
    panel.appendChild(row);
  });
}

// ---- Phase 8: Stock Photos (Pexels, via Supabase Edge Function "pexels-search") ----
// The Pexels API key is stored ONLY as a Supabase Edge Function secret (PEXELS_API_KEY).
// The frontend never talks to Pexels directly — it calls our own Edge Function, which is
// only reachable by a logged-in user (verify_jwt is on for this function).

async function supabaseSearchStockPhotos(query, page) {
  if (typeof supabaseClient === "undefined") return { photos: [], error: "Mag-login muna para gamitin ang Stock Photos." };
  const result = await supabaseClient.functions.invoke("pexels-search", {
    body: { query: query, perPage: 12, page: page || 1 }
  });
  if (result.error) {
    console.error(result.error);
    return { photos: [], error: "Hindi na-search: " + result.error.message };
  }
  return result.data || { photos: [] };
}

function openStockPhotoSearch(postId) {
  const wrap = el("div", {}, []);
  wrap.appendChild(el("div", { class: "notice" }, [
    el("div", { class: "itemTitle", text: "Search Stock Photos" }),
    el("div", { class: "muted", text: "Powered by Pexels. Tap a photo to save it to your Asset Library" + (postId ? " and attach it to this post." : ".") })
  ]));

  const searchRow = el("div", { class: "actionsRow" }, [
    el("input", { class: "input", id: "stockPhotoQuery", placeholder: "Example: coffee shop, fitness, real estate..." }),
    el("button", { class: "btn btnPrimary", type: "button", id: "stockPhotoSearchBtn", text: "Search" })
  ]);
  wrap.appendChild(searchRow);

  const resultsGrid = el("div", { class: "assetGrid", id: "stockPhotoResults" }, []);
  wrap.appendChild(resultsGrid);

  openModal("Stock Photos", wrap);

  async function runSearch() {
    const q = (getVal("stockPhotoQuery", "") || "").trim();
    if (!q) { toast("Maglagay muna ng search keyword."); return; }

    const btn = getEl("stockPhotoSearchBtn");
    const originalLabel = btn ? btn.textContent : "Search";
    if (btn) { btn.textContent = "Searching..."; btn.disabled = true; }

    const data = await supabaseSearchStockPhotos(q, 1);

    if (btn) { btn.textContent = originalLabel; btn.disabled = false; }

    resultsGrid.innerHTML = "";
    if (data.error) {
      resultsGrid.appendChild(buildEmptyState("Hindi ma-search", data.error));
      return;
    }
    if (!data.photos || !data.photos.length) {
      resultsGrid.appendChild(buildEmptyState("Walang nakita", "Subukan ang ibang keyword."));
      return;
    }

    data.photos.forEach(function (p) {
      const img = el("img", { class: "assetThumb", src: p.thumb || p.small || "" });
      const card = el("button", { class: "assetCard", type: "button" }, [
        img,
        el("div", { class: "assetCap", text: "Photo by " + (p.photographer || "Pexels") })
      ]);
      card.addEventListener("click", async function () {
        card.disabled = true;
        const now = Date.now();
        const assetId = uid();
        await dbPut("assets", {
          id: assetId,
          name: "Stock: " + (p.alt || p.photographer || "photo"),
          bucket: "external",
          objectPath: p.large || p.original || p.small,
          mimeType: "image/jpeg",
          sizeBytes: 0,
          clientId: "",
          createdAt: now
        });
        await afterDataChange();

        if (postId) {
          await dbPut("postAssets", { id: uid(), postId: postId, assetId: assetId, createdAt: now });
          await afterDataChange();
          renderAttachedAssets(postId);
        }

        closeModal(true);
        toast("Naidagdag sa Asset Library" + (postId ? " at na-attach sa post" : ""));
      });
      resultsGrid.appendChild(card);
    });
  }

  bind("stockPhotoSearchBtn", "click", runSearch);
  setTimeout(function () {
    const input = getEl("stockPhotoQuery");
    if (input) input.addEventListener("keydown", function (e) { if (e.key === "Enter") runSearch(); });
  }, 0);
}

// ---- Phase 9: Email Marketing (Resend, via Supabase Edge Function "send-email") ----
// The Resend API key is stored ONLY as a Supabase Edge Function secret (RESEND_API_KEY).
// The frontend never talks to Resend directly — it calls our own Edge Function, which is
// only reachable by a logged-in user (verify_jwt is on for this function).
// Default "from" address uses Resend's built-in onboarding@resend.dev sender until a
// custom domain is verified on the Resend dashboard.

async function supabaseSendEmail(to, subject, html) {
  if (typeof supabaseClient === "undefined") return { ok: false, error: "Mag-login muna para makapag-email." };
  const result = await supabaseClient.functions.invoke("send-email", {
    body: { to: to, subject: subject, html: html }
  });
  if (result.error) {
    console.error(result.error);
    return { ok: false, error: "Hindi napadala: " + result.error.message };
  }
  return result.data || { ok: true };
}

function openSendEmailModal(toEmail, clientName) {
  const wrap = el("div", { class: "formGrid" }, []);

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "To" }),
    el("input", { class: "input", id: "emailTo", value: toEmail || "", placeholder: "client@example.com" })
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Subject" }),
    el("input", { class: "input", id: "emailSubject", value: clientName ? ("Update for " + clientName) : "", placeholder: "Weekly update" })
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Message" }),
    el("textarea", { class: "textarea", id: "emailBody", placeholder: "Write your message here..." }, [""])
  ]));

  wrap.appendChild(el("div", { class: "actionsRow" }, [
    el("button", { class: "btn btnGhost", type: "button", text: "Close", onclick: function () { closeModal(true); } }),
    el("button", { class: "btn btnPrimary", type: "button", id: "sendEmailBtn", text: "Send" })
  ]));

  openModal("Send Email", wrap);

  bind("sendEmailBtn", "click", async function () {
    const to = (getVal("emailTo", "") || "").trim();
    const subject = (getVal("emailSubject", "") || "").trim();
    const bodyText = getVal("emailBody", "") || "";

    if (!to || !subject || !bodyText.trim()) {
      toast("Kailangan ng To, Subject, at Message.");
      return;
    }

    const btn = getEl("sendEmailBtn");
    const originalLabel = btn ? btn.textContent : "Send";
    if (btn) { btn.textContent = "Sending..."; btn.disabled = true; }

    const html = "<div style=\"font-family:sans-serif;white-space:pre-wrap\">" +
      bodyText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") +
      "</div>";
    const result = await supabaseSendEmail(to, subject, html);

    if (btn) { btn.textContent = originalLabel; btn.disabled = false; }

    if (!result.ok) {
      toast(result.error || "Hindi napadala ang email.");
      return;
    }
    closeModal(true);
    toast("Naipadala ang email!");
  });
}



async function supabaseGetRoomsForClient(clientId) {
  if (typeof supabaseClient === "undefined" || !clientId) return [];
  const result = await supabaseClient
    .from("rooms")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (result.error) {
    alert(result.error.message);
    return [];
  }
  return result.data || [];
}

async function supabaseCreateRoom(clientId, title) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return null;

  const result = await supabaseClient
    .from("rooms")
    .insert([{ client_id: clientId, title: (title || "Video Room").trim(), created_by: user.id, kind: "client" }])
    .select();

  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return result.data && result.data[0];
}

async function supabaseRegenerateRoomCode(roomId) {
  if (typeof supabaseClient === "undefined") return null;
  const result = await supabaseClient.rpc("generate_room_invite_code", { room_id_input: roomId });
  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return result.data;
}

async function supabaseJoinRoomWithCode(code) {
  if (typeof supabaseClient === "undefined") return null;
  const result = await supabaseClient.rpc("join_room_with_code", { code_input: (code || "").trim().toUpperCase() });
  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return result.data;
}

async function supabaseGetRoomById(roomId) {
  if (typeof supabaseClient === "undefined" || !roomId) return null;
  const result = await supabaseClient.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return result.data;
}

async function supabaseGetActiveCall(roomId) {
  if (typeof supabaseClient === "undefined" || !roomId) return null;
  const result = await supabaseClient
    .from("calls")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return result.data;
}

async function supabaseStartCall(roomId) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return null;

  const result = await supabaseClient
    .from("calls")
    .insert([{ room_id: roomId, call_type: "video", started_by: user.id, status: "active" }])
    .select();

  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return result.data && result.data[0];
}

async function supabaseJoinCall(callId) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return null;

  const result = await supabaseClient
    .from("call_participants")
    .insert([{ call_id: callId, user_id: user.id }])
    .select();

  if (result.error) {
    // Hindi fatal — puwedeng na-re-join lang (hal. after reconnect); ituloy pa rin ang call UI.
    console.warn("joinCall:", result.error.message);
    return null;
  }
  return result.data && result.data[0];
}

async function supabaseLeaveCall(callId) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return;

  await supabaseClient
    .from("call_participants")
    .update({ left_at: new Date().toISOString() })
    .eq("call_id", callId)
    .eq("user_id", user.id)
    .is("left_at", null);
}

async function supabaseEndCall(callId) {
  if (typeof supabaseClient === "undefined" || !callId) return;
  await supabaseClient
    .from("calls")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", callId);
}

// ---- Phase 3: Payroll / Google Sheets export ----

async function supabaseGetTimeEntries(clientId) {
  if (typeof supabaseClient === "undefined" || !clientId) return [];
  const result = await supabaseClient
    .from("time_entries")
    .select("*")
    .eq("client_id", clientId)
    .order("work_date", { ascending: false });

  if (result.error) {
    alert(result.error.message);
    return [];
  }
  return result.data || [];
}

async function supabaseAddTimeEntry(clientId, workDate, hours, notes) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return null;

  const result = await supabaseClient
    .from("time_entries")
    .insert([{
      client_id: clientId,
      user_id: user.id,
      work_date: workDate || fmtDate(new Date()),
      hours: Number(hours || 0),
      notes: notes || ""
    }])
    .select();

  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return result.data && result.data[0];
}

async function supabaseDeleteTimeEntry(entryId) {
  if (typeof supabaseClient === "undefined" || !entryId) return null;
  const result = await supabaseClient.from("time_entries").delete().eq("id", entryId);
  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return true;
}

async function supabaseGetPayrollRuns() {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return [];

  const result = await supabaseClient
    .from("payroll_runs")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (result.error) {
    alert(result.error.message);
    return [];
  }
  return result.data || [];
}

async function supabaseCreatePayrollRun(title, periodStart, periodEnd) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return null;

  const result = await supabaseClient
    .from("payroll_runs")
    .insert([{
      owner_id: user.id,
      title: (title || "").trim() || "Untitled payroll run",
      period_start: periodStart,
      period_end: periodEnd,
      status: "draft"
    }])
    .select();

  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return result.data && result.data[0];
}

async function supabaseComputePayrollRun(runId) {
  if (typeof supabaseClient === "undefined" || !runId) return false;
  const result = await supabaseClient.rpc("compute_payroll_run", { run_id_input: runId });
  if (result.error) {
    alert(result.error.message);
    return false;
  }
  return true;
}

async function supabaseGetPayrollRunItems(runId) {
  if (typeof supabaseClient === "undefined" || !runId) return [];
  const result = await supabaseClient
    .from("payroll_run_items")
    .select("*, clients(name)")
    .eq("payroll_run_id", runId)
    .order("computed_amount", { ascending: false });

  if (result.error) {
    alert(result.error.message);
    return [];
  }
  return result.data || [];
}

async function supabaseUpdatePayrollRunStatus(runId, status) {
  if (typeof supabaseClient === "undefined" || !runId) return null;
  const payload = { status: status };
  if (status === "finalized") payload.finalized_at = new Date().toISOString();

  const result = await supabaseClient.from("payroll_runs").update(payload).eq("id", runId).select();
  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return result.data && result.data[0];
}

async function supabaseDeletePayrollRun(runId) {
  if (typeof supabaseClient === "undefined" || !runId) return null;
  const result = await supabaseClient.from("payroll_runs").delete().eq("id", runId);
  if (result.error) {
    alert(result.error.message);
    return null;
  }
  return true;
}

async function supabaseClearClients() {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return localdbClear("clients");

  const result = await supabaseClient
    .from("clients")
    .delete()
    .eq("owner_id", user.id);

  if (result.error) {
    alert(result.error.message);
    return null;
  }

  return true;
}

const SUPABASE_SYNCED_STORES = {
  tasks: { get: supabaseGetTasks, save: supabaseSaveTask, del: supabaseDeleteTask },
  docs: { get: supabaseGetDocs, save: supabaseSaveDoc, del: supabaseDeleteDoc },
  posts: { get: supabaseGetPosts, save: supabaseSavePost, del: supabaseDeletePost },
  ideas: { get: supabaseGetIdeas, save: supabaseSaveIdea, del: supabaseDeleteIdea },
  pillars: { get: supabaseGetPillars, save: supabaseSavePillar, del: supabaseDeletePillar },
  assets: { get: supabaseGetAssets, save: supabaseSaveAsset, del: supabaseDeleteAsset }
};

async function dbGetAll(storeName) {
  if (storeName === "clients") {
    const user = await getCurrentUser();
    if (user) return supabaseGetClients();
  }
  if (SUPABASE_SYNCED_STORES[storeName]) {
    const user = await getCurrentUser();
    if (user) return SUPABASE_SYNCED_STORES[storeName].get();
  }
  return localdbGetAll(storeName);
}

async function dbPut(storeName, obj) {
  if (storeName === "clients") {
    const user = await getCurrentUser();
    if (user) return supabaseSaveClient(obj);
  }
  if (SUPABASE_SYNCED_STORES[storeName]) {
    const user = await getCurrentUser();
    if (user) return SUPABASE_SYNCED_STORES[storeName].save(obj);
  }
  return localdbPut(storeName, obj);
}

async function dbDelete(storeName, key) {
  if (storeName === "clients") {
    const user = await getCurrentUser();
    if (user) return supabaseDeleteClient(key);
  }
  if (SUPABASE_SYNCED_STORES[storeName]) {
    const user = await getCurrentUser();
    if (user) return SUPABASE_SYNCED_STORES[storeName].del(key);
  }
  return localdbDelete(storeName, key);
}

async function dbClear(storeName) {
  if (storeName === "clients") {
    const user = await getCurrentUser();
    if (user) return supabaseClearClients();
  }
  return localdbClear(storeName);
}

function openDB() {
  return new Promise(function (resolve, reject) {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = function () {
      const db = req.result;

      if (!db.objectStoreNames.contains("pillars")) db.createObjectStore("pillars", { keyPath: "id" });
      if (!db.objectStoreNames.contains("ideas")) db.createObjectStore("ideas", { keyPath: "id" });
      if (!db.objectStoreNames.contains("assets")) db.createObjectStore("assets", { keyPath: "id" });
      if (!db.objectStoreNames.contains("clients")) db.createObjectStore("clients", { keyPath: "id" });
      if (!db.objectStoreNames.contains("tasks")) db.createObjectStore("tasks", { keyPath: "id" });
      if (!db.objectStoreNames.contains("docs")) db.createObjectStore("docs", { keyPath: "id" });

      if (!db.objectStoreNames.contains("posts")) {
        const s = db.createObjectStore("posts", { keyPath: "id" });
        s.createIndex("scheduledDate", "scheduledDate", { unique: false });
        s.createIndex("status", "status", { unique: false });
        s.createIndex("pillarId", "pillarId", { unique: false });
      }

      if (!db.objectStoreNames.contains("postAssets")) {
        const ps = db.createObjectStore("postAssets", { keyPath: "id" });
        ps.createIndex("postId", "postId", { unique: false });
        ps.createIndex("assetId", "assetId", { unique: false });
      }
    };

    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

async function refreshCache() {
  const result = await Promise.all([
    dbGetAll("pillars"),
    dbGetAll("posts"),
    dbGetAll("ideas"),
    dbGetAll("assets"),
    dbGetAll("postAssets"),
    dbGetAll("clients"),
    dbGetAll("tasks"),
    dbGetAll("docs"),
    supabaseGetToolModules(),
    supabaseGetToolPreferences()
  ]);

  const pillars = result[0];
  const posts = result[1];
  const ideas = result[2];
  const assets = result[3];
  const postAssets = result[4];
  const clients = result[5];
  const tasks = result[6];
  const docs = result[7];
  const toolModules = result[8];
  const pinnedToolKeys = result[9];

  pillars.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  posts.sort(function (a, b) {
    const da = a.scheduledDate || "9999-99-99";
    const db = b.scheduledDate || "9999-99-99";
    if (da !== db) return da.localeCompare(db);
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
  ideas.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  assets.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  postAssets.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  clients.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  tasks.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
  docs.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

  state.cache = {
    pillars: pillars,
    posts: posts,
    ideas: ideas,
    assets: assets,
    postAssets: postAssets,
    clients: clients,
    tasks: tasks,
    docs: docs,
    toolModules: toolModules,
    pinnedToolKeys: pinnedToolKeys
  };
}

function getPillarById(id) {
  return state.cache.pillars.find(function (p) { return p.id === id; }) || null;
}

function getAssetsByPostId(postId) {
  const rel = state.cache.postAssets.filter(function (x) { return x.postId === postId; });
  const ids = new Set(rel.map(function (r) { return r.assetId; }));
  return state.cache.assets.filter(function (a) { return ids.has(a.id); });
}

function statusColor(status) {
  if (status === "Draft") return "cyan";
  if (status === "Ready") return "green";
  if (status === "Posted") return "gray";
  if (status === "Archived") return "gray";
  if (status === "Idea") return "pink";
  return "gray";
}

function markColorFromStatus(status) {
  const s = statusColor(status);
  if (s === "green") return "mark";
  if (s === "cyan") return "mark cyan";
  if (s === "pink") return "mark pink";
  return "mark gray";
}

function loadNotes() {
  const value = localStorage.getItem("smm_quick_notes") || "";
  const notes = getEl("quickNotes");
  const pad = getEl("notesPad");
  if (notes) notes.value = value;
  if (pad) pad.value = value;
}

function saveNotes() {
  const value = state.view === "notes" ? getVal("notesPad", "") : getVal("quickNotes", "");
  localStorage.setItem("smm_quick_notes", value);
  const notes = getEl("quickNotes");
  const pad = getEl("notesPad");
  if (notes) notes.value = value;
  if (pad) pad.value = value;
  toast("Saved");
}

function buildEmptyState(title, sub) {
  return el("div", { class: "notice" }, [
    el("div", { class: "itemTitle", text: title }),
    el("div", { class: "muted", text: sub })
  ]);
}

function taskStatusLabel(status) {
  if (status === "doing") return "Doing";
  if (status === "done") return "Done";
  return "To Do";
}

function taskStatusColor(status) {
  if (status === "doing") return "rgba(95,231,255,.9)";
  if (status === "done") return "rgba(99,255,152,.9)";
  return "rgba(255,187,95,.9)";
}

function renderOrganize() {
  const homes = getEl("organizeHomes");
  const summary = getEl("organizeSummary");
  const actions = getEl("organizeActionList");
  if (!homes || !summary || !actions) return;

  const taskTodo = state.cache.tasks.filter(function (t) { return (t.status || "todo") !== "done"; });
  const docsCount = state.cache.docs.length;
  const postsCount = state.cache.posts.length;
  const clientsCount = state.cache.clients.length;

  homes.innerHTML = "";
  [
    {
      title: "Content home",
      text: "Manage posts, content pillars, ideas, and your publishing flow in one clean place.",
      stats: [postsCount + " posts", state.cache.ideas.length + " ideas"],
      action: function () { setView("posts"); }
    },
    {
      title: "Client home",
      text: "Keep every client, niche, notes, and collaboration space organized as your SMM workload grows.",
      stats: [clientsCount + " clients", hasVipFeatureAccess() ? "VIP ready" : "VIP lock"],
      action: function () { setView("clients"); }
    },
    {
      title: "Notes + tasks home",
      text: "Write daily notes, store follow-ups, and track your my-task list for content and client delivery.",
      stats: [taskTodo.length + " active tasks", "1 shared note pad"],
      action: function () { setView("notes"); }
    },
    {
      title: "Knowledge home",
      text: "Save beginner SOPs, briefs, reports, scripts, and editable docs so your work becomes repeatable.",
      stats: [docsCount + " docs", "Beginner friendly"],
      action: function () { setView("docs"); }
    }
  ].forEach(function (home) {
    const card = el("article", { class: "featureCard" }, [
      el("div", { class: "featureTitle", text: home.title }),
      el("div", { class: "featureText", text: home.text }),
      el("div", { class: "homeStat" }, home.stats.map(function (x) { return el("span", { class: "pillSoft", text: x }); })),
      el("button", { class: "btn btnSoft", type: "button", text: "Open", onclick: home.action })
    ]);
    homes.appendChild(card);
  });

  summary.innerHTML = "";
  [
    ["Posts", postsCount],
    ["Ideas", state.cache.ideas.length],
    ["Tasks", state.cache.tasks.length],
    ["Docs", docsCount],
    ["Clients", clientsCount],
    ["Assets", state.cache.assets.length]
  ].forEach(function (item) {
    summary.appendChild(el("div", { class: "summaryMetric" }, [
      el("div", { class: "summaryMetricNum", text: String(item[1]) }),
      el("div", { class: "summaryMetricLbl", text: item[0] })
    ]));
  });

  actions.innerHTML = "";
  if (!taskTodo.length) {
    actions.appendChild(buildEmptyState("You're clear for now", "Add a task for content planning, client work, revisions, reporting, or admin follow-up."));
  } else {
    taskTodo
      .slice()
      .sort(function (a, b) { return (a.updatedAt || 0) - (b.updatedAt || 0); })
      .slice(0, 6)
      .forEach(function (task) {
        actions.appendChild(el("div", { class: "item" }, [
          el("div", { class: "itemMain" }, [
            el("div", { class: "itemTitle", text: task.title || "(Untitled task)" }),
            el("div", { class: "itemMeta" }, [
              el("span", { class: "badge", text: taskStatusLabel(task.status) }),
              el("span", { class: "badge", text: task.category || "General" }),
              el("span", { class: "badge", text: task.dueDate || "No due date" })
            ]),
            el("div", { class: "muted", text: clampText(task.notes || "", 120) || "No notes" })
          ]),
          el("div", { class: "itemActions" }, [
            el("button", { class: "iconBtn", type: "button", text: "Open", onclick: function () { setView("notes"); openTaskEditor(task.id); } })
          ])
        ]));
      });
  }
}

function taskRow(task) {
  const check = el("input", { class: "taskCheck", type: "checkbox" });
  check.checked = (task.status || "todo") === "done";
  check.addEventListener("change", async function () {
    await dbPut("tasks", Object.assign({}, task, {
      status: check.checked ? "done" : "todo",
      updatedAt: Date.now()
    }));
    await afterDataChange();
    toast(check.checked ? "Task done" : "Task reopened");
  });

  const dot = el("span", { class: "badgeDot" });
  dot.style.background = taskStatusColor(task.status);

  return el("div", { class: "item" }, [
    el("div", { class: "taskRow" }, [
      check,
      el("div", { class: "taskBody" }, [
        el("div", { class: "itemTitle", text: task.title || "(Untitled task)" }),
        el("div", { class: "itemMeta" }, [
          el("span", { class: "badge" }, [dot, el("span", { text: taskStatusLabel(task.status) })]),
          el("span", { class: "badge", text: task.category || "General" }),
          el("span", { class: "badge", text: task.dueDate || "No due date" })
        ]),
        el("div", { class: "muted", text: clampText(task.notes || "", 140) || "No notes" })
      ])
    ]),
    el("div", { class: "itemActions" }, [
      el("button", { class: "iconBtn", type: "button", text: "Edit", onclick: function () { openTaskEditor(task.id); } }),
      el("button", { class: "iconBtn", type: "button", text: "Del", onclick: async function () {
        if (!confirm("Delete task?")) return;
        await dbDelete("tasks", task.id);
        await afterDataChange();
        toast("Deleted");
      } })
    ])
  ]);
}

function renderNotesBoard() {
  loadNotes();
  const list = getEl("tasksList");
  if (!list) return;
  list.innerHTML = "";

  const q = (getVal("taskSearch", "") || "").trim().toLowerCase();
  const status = getVal("taskStatusFilter", "");
  const tasks = state.cache.tasks
    .filter(function (task) {
      const text = ((task.title || "") + " " + (task.notes || "") + " " + (task.category || "")).toLowerCase();
      const okQ = q ? text.indexOf(q) !== -1 : true;
      const okStatus = status ? (task.status || "todo") === status : true;
      return okQ && okStatus;
    })
    .slice()
    .sort(function (a, b) {
      const order = { todo: 0, doing: 1, done: 2 };
      const ao = order[a.status || "todo"];
      const bo = order[b.status || "todo"];
      if (ao !== bo) return ao - bo;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });

  if (!tasks.length) {
    list.appendChild(buildEmptyState("No tasks yet", "Create your first SMM task like caption draft, client follow-up, approval check, posting time, or report update."));
    return;
  }

  tasks.forEach(function (task) {
    list.appendChild(taskRow(task));
  });
}

function openTaskEditor(taskId, preset) {
  const existing = taskId ? (state.cache.tasks.find(function (t) { return t.id === taskId; }) || null) : null;
  const initial = Object.assign({
    title: "",
    category: "Content",
    status: "todo",
    dueDate: "",
    notes: "",
    clientId: ""
  }, existing || {}, preset || {});

  const wrap = el("div", { class: "formGrid" }, []);
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Task title" }),
    el("input", { class: "input", id: "fTaskTitle", value: initial.title || "", placeholder: "Example: Draft 7 captions for Client A" })
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Share with client (optional)" }),
    el("select", { class: "select", id: "fTaskClientId" }, [
      el("option", { value: "", text: "-- Personal (not shared) --" })
    ].concat((state.cache.clients || []).map(function (c) {
      return el("option", { value: c.id, text: c.name || "(Unnamed client)" });
    })))
  ]));
  wrap.appendChild(el("div", { class: "formRow2" }, [
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Category" }),
      el("input", { class: "input", id: "fTaskCategory", value: initial.category || "", placeholder: "Content / Client / Admin / Learning" })
    ]),
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Status" }),
      el("select", { class: "select", id: "fTaskStatus" }, [
        el("option", { value: "todo", text: "To Do" }),
        el("option", { value: "doing", text: "Doing" }),
        el("option", { value: "done", text: "Done" })
      ])
    ])
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Due date" }),
    el("input", { class: "input", id: "fTaskDueDate", type: "date", value: initial.dueDate || "" })
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Notes" }),
    el("textarea", { class: "textarea", id: "fTaskNotes", placeholder: "What exactly needs to be done?" }, [initial.notes || ""])
  ]));

  const actions = el("div", { class: "actionsRow" }, [
    el("button", { class: "btn btnGhost", type: "button", text: "Close", onclick: function () { closeModal(true); } }),
    el("button", { class: "btn btnPrimary", type: "button", text: existing ? "Save Task" : "Create Task", onclick: async function () {
      const now = Date.now();
      await dbPut("tasks", {
        id: existing ? existing.id : uid(),
        title: (getVal("fTaskTitle", "") || "").trim(),
        category: (getVal("fTaskCategory", "") || "").trim() || "General",
        status: getVal("fTaskStatus", "todo"),
        dueDate: getVal("fTaskDueDate", ""),
        notes: getVal("fTaskNotes", ""),
        clientId: getVal("fTaskClientId", ""),
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now
      });
      closeModal(true);
      await afterDataChange();
      toast(existing ? "Task saved" : "Task created");
    } })
  ]);
  wrap.appendChild(actions);

  setTimeout(function () {
    const statusNode = getEl("fTaskStatus");
    if (statusNode) statusNode.value = initial.status || "todo";
    const clientNode = getEl("fTaskClientId");
    if (clientNode) clientNode.value = initial.clientId || "";
  }, 0);

  openModal(existing ? "Edit Task" : "New Task", wrap);
}

function renderDocsBoard() {
  const list = getEl("docsList");
  if (!list) return;
  list.innerHTML = "";

  const q = (getVal("docSearch", "") || "").trim().toLowerCase();
  const type = getVal("docTypeFilter", "");
  const docs = state.cache.docs.filter(function (doc) {
    const hay = ((doc.title || "") + " " + (doc.content || "") + " " + (doc.client || "")).toLowerCase();
    const okQ = q ? hay.indexOf(q) !== -1 : true;
    const okType = type ? (doc.type || "other") === type : true;
    return okQ && okType;
  }).slice().sort(function (a, b) {
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  if (!docs.length) {
    list.appendChild(buildEmptyState("No docs yet", "Create editable docs for scripts, SOPs, client briefs, monthly plans, and reports."));
    return;
  }

  docs.forEach(function (doc) {
    list.appendChild(el("div", { class: "item" }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: doc.title || "(Untitled doc)" }),
        el("div", { class: "itemMeta" }, [
          el("span", { class: "badge", text: (doc.type || "other").toUpperCase() }),
          el("span", { class: "badge", text: doc.client || "General" }),
          el("span", { class: "badge", text: "Updated: " + new Date(doc.updatedAt || doc.createdAt || Date.now()).toLocaleString() })
        ]),
        el("div", { class: "docPreview", text: clampText(doc.content || "", 220) || "No content yet" })
      ]),
      el("div", { class: "itemActions" }, [
        el("button", { class: "iconBtn", type: "button", text: "Edit", onclick: function () { openDocEditor(doc.id); } }),
        el("button", { class: "iconBtn", type: "button", text: "Del", onclick: async function () {
          if (!confirm("Delete doc?")) return;
          await dbDelete("docs", doc.id);
          await afterDataChange();
          toast("Deleted");
        } })
      ])
    ]));
  });
}

function openDocEditor(docId, preset) {
  const existing = docId ? (state.cache.docs.find(function (d) { return d.id === docId; }) || null) : null;
  const initial = Object.assign({
    title: "",
    type: "brief",
    client: "",
    content: ""
  }, existing || {}, preset || {});

  const wrap = el("div", { class: "formGrid" }, []);
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Doc title" }),
    el("input", { class: "input", id: "fDocTitle", value: initial.title || "", placeholder: "Example: Client A monthly content brief" })
  ]));
  wrap.appendChild(el("div", { class: "formRow2" }, [
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Type" }),
      el("select", { class: "select", id: "fDocType" }, [
        el("option", { value: "brief", text: "Brief" }),
        el("option", { value: "caption", text: "Caption" }),
        el("option", { value: "plan", text: "Plan" }),
        el("option", { value: "sop", text: "SOP" }),
        el("option", { value: "report", text: "Report" }),
        el("option", { value: "other", text: "Other" })
      ])
    ]),
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Client / label" }),
      el("input", { class: "input", id: "fDocClient", value: initial.client || "", placeholder: "Example: Client A / Internal / Training" })
    ])
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Share with client (optional)" }),
    el("select", { class: "select", id: "fDocClientId" }, [
      el("option", { value: "", text: "-- Personal (not shared) --" })
    ].concat((state.cache.clients || []).map(function (c) {
      return el("option", { value: c.id, text: c.name || "(Unnamed client)" });
    })))
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Editable content" }),
    el("textarea", { class: "textarea", id: "fDocContent", placeholder: "Write your caption draft, SOP, report, or plan here..." }, [initial.content || ""])
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock", id: "fDocGrammarPanel" }, []));
  wrap.appendChild(el("div", { class: "actionsRow" }, [
    el("button", { class: "btn btnGhost", type: "button", text: "Close", onclick: function () { closeModal(true); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "Starter", onclick: function () {
      const starter = [
        "Goal:",
        "Audience:",
        "Deliverables:",
        "Posting schedule:",
        "CTA:",
        "Notes:"
      ].join("\n");
      const node = getEl("fDocContent");
      if (node && !node.value.trim()) node.value = starter;
    } }),
    el("button", { class: "btn btnSoft", type: "button", id: "fDocGrammarBtn", text: "Check Grammar" }),
    el("button", { class: "btn btnPrimary", type: "button", text: existing ? "Save Doc" : "Create Doc", onclick: async function () {
      const now = Date.now();
      await dbPut("docs", {
        id: existing ? existing.id : uid(),
        title: (getVal("fDocTitle", "") || "").trim(),
        type: getVal("fDocType", "brief"),
        client: (getVal("fDocClient", "") || "").trim(),
        clientId: getVal("fDocClientId", ""),
        content: getVal("fDocContent", ""),
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now
      });
      closeModal(true);
      await afterDataChange();
      toast(existing ? "Doc saved" : "Doc created");
    } })
  ]));

  setTimeout(function () {
    const typeNode = getEl("fDocType");
    if (typeNode) typeNode.value = initial.type || "brief";
    const clientIdNode = getEl("fDocClientId");
    if (clientIdNode) clientIdNode.value = initial.clientId || "";
    wireGrammarCheck("fDocGrammarBtn", "fDocContent", "fDocGrammarPanel");
  }, 0);

  openModal(existing ? "Edit Doc" : "New Doc", wrap);
}

function renderTutorial() {
  const steps = getEl("tutorialSteps");
  const checklist = getEl("tutorialChecklist");
  if (!steps || !checklist) return;

  steps.innerHTML = "";
  checklist.innerHTML = "";

  [
    ["Step 1", "Know your client", "Collect niche, offers, audience, brand tone, and goals before creating content."],
    ["Step 2", "Plan your content", "Use posts, ideas, pillars, and calendar so you always know what to publish next."],
    ["Step 3", "Track your work", "Write notes, create tasks, and save docs for briefs, captions, reports, and revisions."],
    ["Step 4", "Deliver like a pro", "Keep client notes, approvals, uploads, and future collaboration spaces organized."],
    ["Step 5", "Grow your system", "Turn repeat work into SOPs and reusable templates inside your docs tab."]
  ].forEach(function (item) {
    steps.appendChild(el("article", { class: "infoCard" }, [
      el("div", { class: "infoTitle", text: item[0] + " • " + item[1] }),
      el("p", { class: "infoText", text: item[2] })
    ]));
  });

  [
    "Create your first client profile",
    "Add 3 content pillars",
    "Save 5 content ideas",
    "Draft 1 caption doc",
    "Set 3 tasks for this week",
    "Write your daily SMM notes"
  ].forEach(function (item, idx) {
    checklist.appendChild(el("div", { class: "item" }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: item }),
        el("div", { class: "muted", text: idx < 2 ? "Best first step for beginners." : "Recommended for building an all-in-one SMM workflow." })
      ]),
      el("div", { class: "itemActions" }, [
        el("button", { class: "iconBtn", type: "button", text: "Do it", onclick: function () {
          if (idx === 0) return setView("clients");
          if (idx === 1) return openPillarEditor(null);
          if (idx === 2) return openIdeaEditor(null);
          if (idx === 3) return openDocEditor(null, { type: "caption", title: "First caption draft" });
          if (idx === 4) return openTaskEditor(null, { title: "My first SMM weekly task", category: "Learning" });
          setView("notes");
        } })
      ])
    ]));
  });
}

function pillText(p) {
  return p ? p.name : "No Pillar";
}

function platformNorm(v) {
  const t = (v || "").trim();
  return t || "Other";
}

function ensureDefaultPillarsIfEmpty() {
  if (state.cache.pillars.length) return Promise.resolve(true);
  const now = Date.now();
  const defaults = [
    { name: "Educational", color: "#63ff98" },
    { name: "Promotional", color: "#5fe7ff" },
    { name: "Engagement", color: "#ff3b6a" },
    { name: "Behind-the-scenes", color: "#ffffff" }
  ].map(function (x) {
    return {
      id: uid(),
      name: x.name,
      color: x.color,
      notes: "",
      createdAt: now,
      updatedAt: now
    };
  });

  return Promise.all(defaults.map(function (p) { return dbPut("pillars", p); }));
}

function renderDashboard() {
  const today = fmtDate(new Date());
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = fmtDate(weekEnd);
  const profile = state.access.profile || null;

  const posts = state.cache.posts.filter(function (p) {
    return (p.status || "") !== "Archived";
  });

  const todayCount = posts.filter(function (p) { return p.scheduledDate === today; }).length;
  const weekCount = posts.filter(function (p) {
    return p.scheduledDate && p.scheduledDate >= today && p.scheduledDate <= weekEndStr;
  }).length;

  setText("mToday", String(todayCount));
  setText("mWeek", String(weekCount));

  const dashChips = getEl("dashChips");
  if (!dashChips) return;
  dashChips.innerHTML = "";

  if (state.access.user) {
    dashChips.appendChild(el("div", { class: "chip" }, [
      el("span", { class: "chipDot" }),
      el("span", { text: "Account:" }),
      el("strong", { text: clampText(state.access.user.email || "user", 24) })
    ]));
  }

  dashChips.appendChild(el("div", { class: "chip" }, [
    el("span", { class: "chipDot" }),
    el("span", { text: "Membership:" }),
    el("strong", { text: hasVipFeatureAccess() ? String((profile && profile.plan) || "VIP").toUpperCase() : "FREE" })
  ]));

  const statusCounts = { Idea: 0, Draft: 0, Ready: 0, Posted: 0, Archived: 0 };
  state.cache.posts.forEach(function (p) {
    const s = p.status || "Draft";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  ["Idea", "Draft", "Ready", "Posted", "Archived"].forEach(function (s) {
    const dot = el("span", { class: "chipDot" });
    if (s === "Draft") dot.style.background = "rgba(95,231,255,.9)";
    if (s === "Ready") dot.style.background = "rgba(99,255,152,.9)";
    if (s === "Posted") dot.style.background = "rgba(255,255,255,.35)";
    if (s === "Archived") dot.style.background = "rgba(255,255,255,.22)";
    if (s === "Idea") dot.style.background = "rgba(255,59,106,.8)";

    dashChips.appendChild(el("div", { class: "chip" }, [
      dot,
      el("span", { text: s + ":" }),
      el("strong", { text: String(statusCounts[s] || 0) })
    ]));
  });

  const upcoming = posts.filter(function (p) { return p.scheduledDate && p.scheduledDate >= today; }).slice(0, 10);
  const list = getEl("upcomingList");
  if (!list) return;
  list.innerHTML = "";

  if (!upcoming.length) {
    list.appendChild(buildEmptyState("No upcoming posts", "Create a post and set a date in the calendar."));
    return;
  }

  upcoming.forEach(function (p) {
    const pillar = getPillarById(p.pillarId);
    const badgeDot = el("span", { class: "badgeDot" });
    badgeDot.style.background = pillar ? pillar.color : "rgba(255,255,255,.20)";

    const meta = el("div", { class: "itemMeta" }, [
      el("span", { class: "badge" }, [badgeDot, el("span", { text: pillText(pillar) })]),
      el("span", { class: "badge", text: platformNorm(p.platform) }),
      el("span", { class: "badge", text: p.status || "Draft" }),
      el("span", { class: "badge", text: p.scheduledDate || "No date" })
    ]);

    list.appendChild(el("div", { class: "item" }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: p.title || "(Untitled post)" }),
        meta
      ]),
      el("div", { class: "itemActions" }, [
        el("button", { class: "iconBtn", type: "button", text: "Edit", onclick: function () { openPostEditor(p.id); } })
      ])
    ]));
  });
}

function renderCalendar() {
  const cursor = state.calendarCursor;
  const mStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  setText("calSub", cursor.toLocaleString(undefined, { month: "long", year: "numeric" }));

  const weekdayRow = getEl("weekdayRow");
  const grid = getEl("calendarGrid");
  if (!weekdayRow || !grid) return;

  if (!hasVipFeatureAccess()) {
    weekdayRow.innerHTML = "";
    grid.innerHTML = "";
    grid.appendChild(buildEmptyState("VIP lock", "Calendar is part of the VIP membership. Upgrade to unlock scheduling view."));
    return;
  }

  weekdayRow.innerHTML = "";
  WEEKDAYS.forEach(function (w) { weekdayRow.appendChild(el("div", { class: "weekday", text: w })); });

  grid.innerHTML = "";

  const startDay = mStart.getDay();
  const totalDays = mEnd.getDate();
  const prevMonthEnd = new Date(mStart.getFullYear(), mStart.getMonth(), 0);
  const prevDays = prevMonthEnd.getDate();

  const cells = [];
  let i;
  for (i = 0; i < startDay; i++) {
    const dayNum = prevDays - (startDay - 1 - i);
    const d = new Date(mStart.getFullYear(), mStart.getMonth() - 1, dayNum);
    cells.push({ date: fmtDate(d), num: dayNum, dim: true });
  }
  for (i = 1; i <= totalDays; i++) {
    const d2 = new Date(mStart.getFullYear(), mStart.getMonth(), i);
    cells.push({ date: fmtDate(d2), num: i, dim: false });
  }
  const remaining = 42 - cells.length;
  for (i = 1; i <= remaining; i++) {
    const d3 = new Date(mStart.getFullYear(), mStart.getMonth() + 1, i);
    cells.push({ date: fmtDate(d3), num: i, dim: true });
  }

  const todayStr = fmtDate(new Date());
  const postsByDate = {};
  state.cache.posts.forEach(function (p) {
    if (!p.scheduledDate) return;
    if (!postsByDate[p.scheduledDate]) postsByDate[p.scheduledDate] = [];
    postsByDate[p.scheduledDate].push(p);
  });

  cells.forEach(function (c) {
    const posts = (postsByDate[c.date] || []).filter(function (p) { return (p.status || "") !== "Archived"; });
    posts.sort(function (a, b) { return (a.status || "").localeCompare(b.status || ""); });

    const marks = el("div", { class: "dayMarks" }, []);
    posts.slice(0, 6).forEach(function (p) {
      marks.appendChild(el("span", { class: markColorFromStatus(p.status || "Draft") }));
    });

    const numEl = el("div", { class: "dayNum" + (c.dim ? " dim" : ""), text: String(c.num) });
    const cell = el("button", { class: "dayCell", type: "button" }, [numEl, marks]);
    if (c.date === todayStr) cell.classList.add("dayToday");
    cell.addEventListener("click", function () { openDaySheet(c.date); });
    grid.appendChild(cell);
  });
}

function openDaySheet(dateStr) {
  const posts = state.cache.posts
    .filter(function (p) { return p.scheduledDate === dateStr && (p.status || "") !== "Archived"; })
    .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });

  const wrap = el("div", {}, []);
  wrap.appendChild(el("div", { class: "notice" }, [
    el("div", { class: "itemTitle", text: dateStr }),
    el("div", { class: "muted", text: "Posts scheduled sa araw na ito" })
  ]));

  wrap.appendChild(el("div", { class: "actionsRow" }, [
    el("button", { class: "btn btnSoft", type: "button", text: "Add Post", onclick: function () {
      closeModal(true);
      openPostEditor(null, { scheduledDate: dateStr });
    } })
  ]));

  const list = el("div", { class: "list" }, []);
  if (!posts.length) list.appendChild(buildEmptyState("No posts yet", "Tap Add Post to create scheduled content."));
  else posts.forEach(function (p) { list.appendChild(postRow(p)); });

  wrap.appendChild(el("div", { class: "divider" }));
  wrap.appendChild(list);
  openModal("Day View", wrap);
}

function postRow(p, opts) {
  const options = opts || {};
  const pillar = getPillarById(p.pillarId);
  const badgeDot = el("span", { class: "badgeDot" });
  badgeDot.style.background = pillar ? pillar.color : "rgba(255,255,255,.22)";

  const metaParts = [
    el("span", { class: "badge" }, [badgeDot, el("span", { text: pillText(pillar) })]),
    el("span", { class: "badge", text: platformNorm(p.platform) }),
    el("span", { class: "badge", text: p.status || "Draft" })
  ];
  if (p.scheduledDate) metaParts.push(el("span", { class: "badge", text: p.scheduledDate }));

  return el("div", { class: "item" }, [
    el("div", { class: "itemMain" }, [
      el("div", { class: "itemTitle", text: p.title || "(Untitled post)" }),
      el("div", { class: "itemMeta" }, metaParts)
    ]),
    el("div", { class: "itemActions" }, [
      el("button", { class: "iconBtn", type: "button", text: "Edit", onclick: function () { openPostEditor(p.id); } }),
      el("button", { class: "iconBtn", type: "button", text: "Del", onclick: async function () {
        if (!confirm("Delete post?")) return;
        await deletePost(p.id);
        await afterDataChange();
        toast("Deleted");
        if (options.onDeleted) options.onDeleted();
      } })
    ])
  ]);
}

function renderPosts() {
  const q = (getVal("postSearch", "") || "").trim().toLowerCase();
  const st = getVal("postStatus", "");
  const pf = getVal("postPlatform", "");
  const list = getEl("postsList");
  if (!list) return;
  list.innerHTML = "";

  const items = state.cache.posts.filter(function (p) {
    const okStatus = st ? (p.status || "") === st : true;
    const okPlat = pf ? platformNorm(p.platform) === pf : true;
    const text = ((p.title || "") + " " + (p.caption || "") + " " + (p.hashtags || "")).toLowerCase();
    const okQ = q ? text.indexOf(q) !== -1 : true;
    return okStatus && okPlat && okQ;
  });

  if (!items.length) {
    list.appendChild(buildEmptyState("No matching posts", "Try different filters or create a new post."));
    return;
  }

  items.slice().reverse().forEach(function (p) { list.appendChild(postRow(p)); });
}

function renderPillars() {
  const list = getEl("pillarsList");
  if (!list) return;
  list.innerHTML = "";

  if (!state.cache.pillars.length) {
    list.appendChild(buildEmptyState("No pillars yet", "Create pillars to keep your content organized."));
    return;
  }

  state.cache.pillars.forEach(function (p) {
    const dot = el("span", { class: "badgeDot" });
    dot.style.background = p.color || "rgba(255,255,255,.20)";

    list.appendChild(el("div", { class: "item" }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: p.name || "(Untitled pillar)" }),
        el("div", { class: "itemMeta" }, [
          el("span", { class: "badge" }, [dot, el("span", { text: p.color || "No color" })]),
          el("span", { class: "badge", text: clampText(p.notes || "", 50) || "No notes" })
        ])
      ]),
      el("div", { class: "itemActions" }, [
        el("button", { class: "iconBtn", type: "button", text: "Edit", onclick: function () { openPillarEditor(p.id); } }),
        el("button", { class: "iconBtn", type: "button", text: "Del", onclick: async function () {
          const used = state.cache.posts.some(function (x) { return x.pillarId === p.id; });
          if (used) return alert("May posts pang gumagamit ng pillar na ito. Palitan muna pillar ng posts bago i-delete.");
          if (!confirm("Delete pillar?")) return;
          await dbDelete("pillars", p.id);
          await afterDataChange();
          toast("Deleted");
        } })
      ])
    ]));
  });
}

function extractTags(tagStr) {
  return (tagStr || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean).map(function (x) {
    return x.toLowerCase();
  });
}

function renderIdeas() {
  const q = (getVal("ideaSearch", "") || "").trim().toLowerCase();
  const tag = getVal("ideaTagFilter", "");
  const list = getEl("ideasList");
  if (!list) return;
  list.innerHTML = "";

  const ideas = state.cache.ideas.filter(function (i) {
    const okQ = q ? (((i.title || "") + " " + (i.notes || "") + " " + (i.tags || "")).toLowerCase().indexOf(q) !== -1) : true;
    const tags = extractTags(i.tags);
    const okTag = tag ? tags.indexOf(tag) !== -1 : true;
    return okQ && okTag;
  });

  if (!ideas.length) {
    list.appendChild(buildEmptyState("No ideas yet", "Tap New Idea to save your first idea."));
    return;
  }

  ideas.forEach(function (i) {
    const tags = extractTags(i.tags);
    list.appendChild(el("div", { class: "item" }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: i.title || "(Untitled idea)" }),
        el("div", { class: "itemMeta" }, [
          el("span", { class: "badge", text: tags.length ? tags.slice(0, 3).join(", ") : "No tags" }),
          el("span", { class: "badge", text: "Updated: " + new Date(i.updatedAt || i.createdAt || Date.now()).toLocaleString() })
        ]),
        el("div", { class: "muted", text: clampText(i.notes || "", 140) })
      ]),
      el("div", { class: "itemActions" }, [
        el("button", { class: "iconBtn", type: "button", text: "To Post", onclick: function () {
          closeModal(true);
          openPostEditor(null, { title: i.title || "", caption: i.notes || "", status: "Idea" });
        } }),
        el("button", { class: "iconBtn", type: "button", text: "Edit", onclick: function () { openIdeaEditor(i.id); } }),
        el("button", { class: "iconBtn", type: "button", text: "Del", onclick: async function () {
          if (!confirm("Delete idea?")) return;
          await dbDelete("ideas", i.id);
          await afterDataChange();
          toast("Deleted");
        } })
      ])
    ]));
  });

  refreshIdeaTagFilter();
}

function refreshIdeaTagFilter() {
  const sel = getEl("ideaTagFilter");
  if (!sel) return;
  const current = sel.value || "";
  const tags = new Set();
  state.cache.ideas.forEach(function (i) {
    extractTags(i.tags).forEach(function (t) { tags.add(t); });
  });
  const sorted = Array.from(tags).sort(function (a, b) { return a.localeCompare(b); });
  sel.innerHTML = "";
  sel.appendChild(el("option", { value: "", text: "All Tags" }));
  sorted.forEach(function (t) { sel.appendChild(el("option", { value: t, text: t })); });
  sel.value = sorted.indexOf(current) !== -1 ? current : "";
}

function blobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    const r = new FileReader();
    r.onload = function () { resolve(r.result); };
    r.onerror = function () { reject(r.error); };
    r.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(",");
  const meta = parts[0];
  const data = parts[1];
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || "application/octet-stream";
  const bin = atob(data);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function renderAssets() {
  const grid = getEl("assetGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!state.cache.assets.length) {
    grid.appendChild(buildEmptyState("No assets yet", "Tap Upload to add images."));
    return;
  }

  state.cache.assets.forEach(function (a) {
    const img = el("img", { class: "assetThumb" });
    getAssetImageUrl(a).then(function (url) { if (url) img.src = url; });

    const sizeBytes = a.sizeBytes || a.size || 0;
    const displayName = a.name || a.filename || "image";
    const clientBadge = a.clientId ? (function () {
      const c = state.cache.clients.find(function (x) { return x.id === a.clientId; });
      return c ? c.name : "Shared";
    })() : "";

    const card = el("button", { class: "assetCard", type: "button" }, [
      img,
      el("div", { class: "assetPill", text: Math.max(1, Math.round(sizeBytes / 1024)) + " KB" }),
      el("div", { class: "assetCap", text: clampText(displayName, 36) })
    ].concat(clientBadge ? [el("div", { class: "assetPill", style: "left:auto;right:6px", text: clientBadge })] : []));
    card.addEventListener("click", function () { openAssetPreview(a.id); });
    grid.appendChild(card);
  });
}

function openAssetPreview(assetId) {
  const a = state.cache.assets.find(function (x) { return x.id === assetId; });
  if (!a) return;

  const sizeBytes = a.sizeBytes || a.size || 0;
  const displayName = a.name || a.filename || "image";

  const wrap = el("div", {}, []);
  const img = el("img", {
    style: "width:100%;border-radius:18px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.18)"
  });
  getAssetImageUrl(a).then(function (url) { if (url) img.src = url; });

  wrap.appendChild(img);
  wrap.appendChild(el("div", { class: "notice" }, [
    el("div", { class: "itemTitle", text: displayName }),
    el("div", { class: "muted", text: (a.mimeType || "") + " • " + Math.max(1, Math.round(sizeBytes / 1024)) + " KB" })
  ]));

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Share with client (optional)" }),
    el("select", { class: "select", id: "fAssetClientId" }, [
      el("option", { value: "", text: "-- Personal (not shared) --" })
    ].concat((state.cache.clients || []).map(function (c) {
      return el("option", { value: c.id, text: c.name || "(Unnamed client)" });
    })))
  ]));

  wrap.appendChild(el("div", { class: "actionsRow" }, [
    el("button", { class: "btn btnDanger", type: "button", text: "Delete Asset", onclick: async function () {
      const used = state.cache.postAssets.some(function (x) { return x.assetId === a.id; });
      if (used && !confirm("May posts na naka-attach sa asset na ito. Delete pa rin?")) return;
      if (!confirm("Delete asset?")) return;
      await dbDelete("assets", a.id);
      const rels = state.cache.postAssets.filter(function (x) { return x.assetId === a.id; });
      for (let i = 0; i < rels.length; i++) await dbDelete("postAssets", rels[i].id);
      await afterDataChange();
      closeModal(true);
      toast("Deleted");
    } }),
    el("button", { class: "btn btnPrimary", type: "button", text: "Save", onclick: async function () {
      const updated = Object.assign({}, a, { clientId: getVal("fAssetClientId", "") });
      await dbPut("assets", updated);
      await afterDataChange();
      closeModal(true);
      toast("Saved");
    } })
  ]));

  openModal("Asset Preview", wrap);

  setTimeout(function () {
    const node = getEl("fAssetClientId");
    if (node) node.value = a.clientId || "";
  }, 0);
}

function renderTools() {
  const list = getEl("toolsList");
  if (!list) return;
  list.innerHTML = "";

  const modules = state.cache.toolModules || [];
  if (!modules.length) {
    list.appendChild(buildEmptyState("No tools listed yet", "Tool directory is empty or not yet synced."));
    return;
  }

  const catLabels = {
    work: "Admin & Productivity",
    content: "Content & Media",
    marketing: "Marketing & Communication",
    storage: "Security & Sharing",
    collaboration: "Collaboration & Community",
    general: "Other Tools"
  };

  const pinned = new Set(state.cache.pinnedToolKeys || []);
  const byCategory = {};
  modules.forEach(function (m) {
    const cat = m.category || "general";
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(m);
  });

  Object.keys(byCategory).sort(function (a, b) {
    return (catLabels[a] || a).localeCompare(catLabels[b] || b);
  }).forEach(function (cat) {
    list.appendChild(el("div", { class: "sectionLabel", text: catLabels[cat] || cat }));
    const grid = el("div", { class: "featureGrid" }, []);
    byCategory[cat].sort(function (a, b) { return (a.label || "").localeCompare(b.label || ""); }).forEach(function (m) {
      const isPinned = pinned.has(m.key);
      const card = el("div", { class: "item" }, [
        el("div", { class: "itemMain" }, [
          el("div", { class: "itemTitle", text: m.label }),
          el("div", { class: "itemMeta" }, [
            el("span", { class: "badge", text: m.isEnabled ? "Available" : "Coming soon" })
          ])
        ]),
        el("div", { class: "itemActions" }, [
          el("button", { class: "iconBtn", type: "button", text: isPinned ? "★ Pinned" : "☆ Pin", onclick: async function () {
            await supabaseSetToolPinned(m.key, !isPinned);
            await afterDataChange();
            renderTools();
            toast(isPinned ? "Unpinned" : "Pinned");
          } })
        ])
      ]);
      grid.appendChild(card);
    });
    list.appendChild(grid);
  });
}

function renderBackup() {
  setText("backupStatus", "Tip: mag-export ka kahit once a week. Kapag maraming assets/images, mas lalaki ang file.");
}

function renderAbout() {
  const about = getAboutProfile();
  const dna = getCreatorDNA();
  const prefs = getPrefs();

  function mapValue(id, value) {
    const node = getEl(id);
    if (node) node.value = value || "";
  }

  mapValue("aboutAppName", about.appName);
  mapValue("aboutSupportEmail", about.supportEmail);
  mapValue("aboutSupportPhone", about.supportPhone);
  mapValue("aboutFacebook", about.facebook);
  mapValue("aboutInstagram", about.instagram);
  mapValue("aboutTiktok", about.tiktok);
  mapValue("aboutWhatsapp", about.whatsapp);
  mapValue("aboutNote", about.note);

  mapValue("dnaBrandName", dna.brandName);
  mapValue("dnaAudience", dna.audience);
  mapValue("dnaMission", dna.mission);
  mapValue("dnaTone", dna.tone);
  mapValue("dnaContentStyle", dna.contentStyle);
  mapValue("dnaGoals", dna.goals);
  mapValue("dnaConstraints", dna.constraints);
  mapValue("dnaOffers", dna.offers);
  mapValue("dnaCtaStyle", dna.ctaStyle);
  mapValue("dnaPreferredLanguage", dna.preferredLanguage);

  mapValue("prefTheme", prefs.theme);
  mapValue("prefAppLanguage", prefs.appLanguage);
  mapValue("prefContentLanguage", prefs.contentLanguage);

  const membershipBox = getEl("aboutMembershipStatus");
  if (membershipBox) {
    membershipBox.innerHTML = "";
    membershipBox.appendChild(el("div", { class: "itemTitle", text: "VIP Membership" }));
    membershipBox.appendChild(el("div", { class: "muted", text: getMembershipSummaryText() }));
    membershipBox.appendChild(el("div", { class: "muted", text: "Monthly " + peso(VIP_PRICES.monthly) + " • Yearly " + peso(VIP_PRICES.yearly) + " • Lifetime " + peso(VIP_PRICES.lifetime) }));
    membershipBox.appendChild(el("div", { class: "muted", text: "VIP unlocks AI Assistant, Calendar, at Clients & Team. Bayad via PayMongo (GCash, card, Maya, GrabPay)." }));
  }

  updateBrandHeader();
}

async function exportBackup() {
  setText("backupStatus", "Exporting...");

  const payload = {
    meta: {
      app: getAboutProfile().appName || APP_SHORT_NAME,
      version: 3,
      exportedAt: Date.now(),
      prefs: getPrefs(),
      about: getAboutProfile(),
      dna: getCreatorDNA(),
      quickNotes: localStorage.getItem("smm_quick_notes") || ""
    },
    pillars: state.cache.pillars,
    posts: state.cache.posts,
    ideas: state.cache.ideas,
    clients: state.cache.clients,
    tasks: state.cache.tasks,
    docs: state.cache.docs,
    postAssets: state.cache.postAssets,
    assets: []
  };

  for (let i = 0; i < state.cache.assets.length; i++) {
    const a = state.cache.assets[i];
    const dataUrl = await blobToDataUrl(a.data);
    payload.assets.push({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt,
      dataUrl: dataUrl
    });
  }

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const aTag = document.createElement("a");
  aTag.href = url;
  aTag.download = "smm_hub_backup_" + fmtDate(new Date()) + ".json";
  document.body.appendChild(aTag);
  aTag.click();
  aTag.remove();
  URL.revokeObjectURL(url);

  setText("backupStatus", "Export done. Check downloads.");
  toast("Exported");
}

async function importBackup(file) {
  setText("backupStatus", "Importing...");
  const text = await file.text();
  const data = JSON.parse(text);

  if (!confirm("Import will overwrite your current data. Proceed?")) {
    setText("backupStatus", "Cancelled.");
    return;
  }

  await wipeAllData(false);

  if (data.meta && data.meta.prefs) savePrefs(Object.assign(cloneJSON(DEFAULT_PREFS), data.meta.prefs));
  if (data.meta && data.meta.about) saveAboutProfile(Object.assign(cloneJSON(DEFAULT_ABOUT), data.meta.about));
  if (data.meta && data.meta.dna) saveCreatorDNA(Object.assign(cloneJSON(DEFAULT_DNA), data.meta.dna));
  if (data.meta && typeof data.meta.quickNotes === "string") localStorage.setItem("smm_quick_notes", data.meta.quickNotes);

  applyTheme();
  applyAppLanguage();
  updateBrandHeader();
  loadNotes();

  const now = Date.now();
  const pillars = (data.pillars || []).map(function (p) {
    return {
      id: p.id || uid(),
      name: p.name || "",
      color: p.color || "#63ff98",
      notes: p.notes || "",
      createdAt: p.createdAt || now,
      updatedAt: p.updatedAt || now
    };
  });
  const posts = (data.posts || []).map(function (p) {
    return {
      id: p.id || uid(),
      title: p.title || "",
      platform: p.platform || "Other",
      status: p.status || "Draft",
      pillarId: p.pillarId || "",
      caption: p.caption || "",
      hashtags: p.hashtags || "",
      scheduledDate: p.scheduledDate || "",
      createdAt: p.createdAt || now,
      updatedAt: p.updatedAt || now
    };
  });
  const ideas = (data.ideas || []).map(function (i) {
    return {
      id: i.id || uid(),
      title: i.title || "",
      notes: i.notes || "",
      tags: i.tags || "",
      createdAt: i.createdAt || now,
      updatedAt: i.updatedAt || now
    };
  });
  const clients = (data.clients || []).map(function (c) {
    return {
      id: c.id || uid(),
      name: c.name || "",
      niche: c.niche || "",
      goals: c.goals || "",
      notes: c.notes || "",
      members: Array.isArray(c.members) ? c.members : [],
      createdAt: c.createdAt || now,
      updatedAt: c.updatedAt || now
    };
  });
  const assets = (data.assets || []).map(function (a) {
    return {
      id: a.id || uid(),
      filename: a.filename || "image",
      mimeType: a.mimeType || "image/*",
      size: a.size || 0,
      createdAt: a.createdAt || now,
      data: a.dataUrl ? dataUrlToBlob(a.dataUrl) : new Blob([], { type: a.mimeType || "application/octet-stream" })
    };
  });
  const postAssets = (data.postAssets || []).map(function (x) {
    return {
      id: x.id || uid(),
      postId: x.postId || "",
      assetId: x.assetId || "",
      createdAt: x.createdAt || now
    };
  });
  const tasks = (data.tasks || []).map(function (t) {
    return {
      id: t.id || uid(),
      title: t.title || "",
      category: t.category || "General",
      status: t.status || "todo",
      dueDate: t.dueDate || "",
      notes: t.notes || "",
      createdAt: t.createdAt || now,
      updatedAt: t.updatedAt || now
    };
  });
  const docs = (data.docs || []).map(function (d) {
    return {
      id: d.id || uid(),
      title: d.title || "",
      type: d.type || "other",
      client: d.client || "",
      content: d.content || "",
      createdAt: d.createdAt || now,
      updatedAt: d.updatedAt || now
    };
  });

  for (let i = 0; i < pillars.length; i++) await dbPut("pillars", pillars[i]);
  for (let i = 0; i < posts.length; i++) await dbPut("posts", posts[i]);
  for (let i = 0; i < ideas.length; i++) await dbPut("ideas", ideas[i]);
  for (let i = 0; i < clients.length; i++) await dbPut("clients", clients[i]);
  for (let i = 0; i < assets.length; i++) await dbPut("assets", assets[i]);
  for (let i = 0; i < postAssets.length; i++) await dbPut("postAssets", postAssets[i]);
  for (let i = 0; i < tasks.length; i++) await dbPut("tasks", tasks[i]);
  for (let i = 0; i < docs.length; i++) await dbPut("docs", docs[i]);

  await afterDataChange();
  renderAbout();
  setText("backupStatus", "Import done.");
  toast("Imported");
}

async function wipeAllData(withConfirm) {
  const ask = typeof withConfirm === "undefined" ? true : withConfirm;
  if (ask && !confirm("Wipe ALL data? This cannot be undone.")) return;

  await Promise.all([
    dbClear("pillars"),
    dbClear("posts"),
    dbClear("ideas"),
    dbClear("assets"),
    dbClear("postAssets"),
    dbClear("clients"),
    dbClear("tasks"),
    dbClear("docs")
  ]);
  localStorage.removeItem("smm_quick_notes");
  loadNotes();

  await afterDataChange();
  setText("backupStatus", "All data wiped.");
  toast("Wiped");
}

async function deletePost(postId) {
  await dbDelete("posts", postId);
  const rels = state.cache.postAssets.filter(function (x) { return x.postId === postId; });
  for (let i = 0; i < rels.length; i++) await dbDelete("postAssets", rels[i].id);
}

function buildPostEditorForm(initial) {
  const pillars = state.cache.pillars;
  const title = el("div", { class: "formGrid" }, []);

  title.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Title / Topic" }),
    el("input", { class: "input", id: "fPostTitle", value: initial.title || "", placeholder: "Example: 5 SMM tips for beginners" })
  ]));

  title.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Share with client (optional)" }),
    el("select", { class: "select", id: "fPostClientId" }, [
      el("option", { value: "", text: "-- Personal (not shared) --" })
    ].concat((state.cache.clients || []).map(function (c) {
      return el("option", { value: c.id, text: c.name || "(Unnamed client)" });
    })))
  ]));

  title.appendChild(el("div", { class: "formRow2" }, [
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Platform" }),
      (function () {
        const s = el("select", { class: "select", id: "fPostPlatform" }, []);
        ["Facebook", "Instagram", "TikTok", "Pinterest", "YouTube", "Threads", "Other"].forEach(function (x) {
          s.appendChild(el("option", { value: x, text: x }));
        });
        s.value = platformNorm(initial.platform || "Other");
        return s;
      })()
    ]),
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Status" }),
      (function () {
        const s = el("select", { class: "select", id: "fPostStatus" }, []);
        ["Idea", "Draft", "Ready", "Posted", "Archived"].forEach(function (x) {
          s.appendChild(el("option", { value: x, text: x }));
        });
        s.value = initial.status || "Draft";
        return s;
      })()
    ])
  ]));

  title.appendChild(el("div", { class: "formRow2" }, [
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Scheduled Date" }),
      el("input", { class: "input", id: "fPostDate", type: "date", value: initial.scheduledDate || "" })
    ]),
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Pillar" }),
      (function () {
        const s = el("select", { class: "select", id: "fPostPillar" }, []);
        s.appendChild(el("option", { value: "", text: "No Pillar" }));
        pillars.forEach(function (p) { s.appendChild(el("option", { value: p.id, text: p.name })); });
        s.value = initial.pillarId || "";
        return s;
      })()
    ])
  ]));

  title.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Caption" }),
    el("textarea", { class: "textarea", id: "fPostCaption", placeholder: "Write caption here..." }, [initial.caption || ""]),
    el("div", { class: "actionsRow" }, [
      el("button", { class: "btn btnSoft", type: "button", id: "fPostGrammarBtn", text: "Check Grammar" })
    ]),
    el("div", { class: "fieldBlock", id: "fPostGrammarPanel" }, [])
  ]));

  title.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Hashtags" }),
    el("textarea", { class: "textarea", id: "fPostHashtags", placeholder: "#hashtag1 #hashtag2 ..." }, [initial.hashtags || ""])
  ]));

  title.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Attached Assets" }),
    el("div", { class: "attachRow", id: "fPostAttachRow" }, [])
  ]));

  title.appendChild(el("div", { class: "actionsRow" }, [
    el("label", { class: "btn btnSoft fileBtn" }, [
      document.createTextNode("Upload Image"),
      el("input", { id: "fPostUpload", type: "file", accept: "image/*" })
    ]),
    el("button", { class: "btn btnGhost", type: "button", id: "fPostPickAsset", text: "Pick from Library" }),
    el("button", { class: "btn btnGhost", type: "button", id: "fPostStockPhotos", text: "Stock Photos" })
  ]));

  return title;
}

function renderAttachedAssets(postId) {
  const row = getEl("fPostAttachRow");
  if (!row) return;
  row.innerHTML = "";

  if (!postId) {
    row.appendChild(el("div", { class: "muted", text: "Save muna ng post para ma-attach ang assets." }));
    return;
  }

  const assets = getAssetsByPostId(postId);
  if (!assets.length) {
    row.appendChild(el("div", { class: "muted", text: "No assets attached." }));
    return;
  }

  assets.forEach(function (a) {
    const mini = el("div", { class: "attachMini" }, []);
    const img = el("img", {});
    getAssetImageUrl(a).then(function (url) { if (url) img.src = url; });
    const x = el("button", { class: "attachX", type: "button", text: "x", onclick: async function () {
      const rel = state.cache.postAssets.find(function (r) { return r.postId === postId && r.assetId === a.id; });
      if (rel) await dbDelete("postAssets", rel.id);
      await afterDataChange();
      renderAttachedAssets(postId);
      toast("Detached");
    } });
    mini.appendChild(img);
    mini.appendChild(x);
    row.appendChild(mini);
  });
}

function openAssetPicker(postId) {
  const wrap = el("div", {}, []);
  const list = el("div", { class: "assetGrid" }, []);

  if (!state.cache.assets.length) {
    list.appendChild(buildEmptyState("No assets found", "Upload an image in Asset Library or from the post editor first."));
  } else {
    state.cache.assets.forEach(function (a) {
      const img = el("img", { class: "assetThumb" });
      getAssetImageUrl(a).then(function (url) { if (url) img.src = url; });

      const card = el("button", { class: "assetCard", type: "button" }, [
        img,
        el("div", { class: "assetCap", text: clampText(a.name || a.filename || "image", 32) })
      ]);

      card.addEventListener("click", async function () {
        const exists = state.cache.postAssets.some(function (x) { return x.postId === postId && x.assetId === a.id; });
        if (exists) return toast("Already attached");
        await dbPut("postAssets", { id: uid(), postId: postId, assetId: a.id, createdAt: Date.now() });
        await afterDataChange();
        closeModal(true);
        toast("Attached");
      });

      list.appendChild(card);
    });
  }

  wrap.appendChild(el("div", { class: "notice" }, [
    el("div", { class: "itemTitle", text: "Pick Asset" }),
    el("div", { class: "muted", text: "Tap an image to attach it to the post" })
  ]));
  wrap.appendChild(list);
  openModal("Asset Picker", wrap);
}

async function supabaseUploadAssetFile(file, assetId) {
  const user = await getCurrentUser();
  if (!user || typeof supabaseClient === "undefined") return null;
  const safeName = (file.name || "image").replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = user.id + "/" + assetId + "-" + safeName;
  const result = await supabaseClient.storage.from("assets").upload(path, file, {
    contentType: file.type || "image/*",
    upsert: true
  });
  if (result.error) { alert(result.error.message); return null; }
  return path;
}

async function getAssetImageUrl(asset) {
  if (asset.bucket === "external" && asset.objectPath) return asset.objectPath;
  if (asset.objectPath && typeof supabaseClient !== "undefined") {
    const result = await supabaseClient.storage.from(asset.bucket || "assets").createSignedUrl(asset.objectPath, 3600);
    if (result.error) { console.error(result.error.message); return ""; }
    return result.data && result.data.signedUrl ? result.data.signedUrl : "";
  }
  if (asset.data) return URL.createObjectURL(asset.data);
  return "";
}

async function handleUploadFiles(files, clientId) {
  const now = Date.now();
  const arr = Array.prototype.slice.call(files || []);
  const user = await getCurrentUser();
  const useCloud = !!(user && typeof supabaseClient !== "undefined");

  for (let i = 0; i < arr.length; i++) {
    const f = arr[i];
    if (!f.type || f.type.indexOf("image/") !== 0) continue;
    const assetId = uid();

    if (useCloud) {
      const path = await supabaseUploadAssetFile(f, assetId);
      if (!path) continue;
      await dbPut("assets", {
        id: assetId,
        name: f.name || "image",
        bucket: "assets",
        objectPath: path,
        mimeType: f.type || "image/*",
        sizeBytes: f.size || 0,
        clientId: clientId || "",
        createdAt: now
      });
    } else {
      await dbPut("assets", {
        id: assetId,
        name: f.name || "image",
        filename: f.name || "image",
        mimeType: f.type || "image/*",
        sizeBytes: f.size || 0,
        size: f.size || 0,
        clientId: clientId || "",
        createdAt: now,
        data: f
      });
    }
  }
  await afterDataChange();
  toast("Uploaded");
}

async function openPostEditor(postId, preset) {
  let initial = {
    id: "",
    title: "",
    clientId: "",
    platform: "Other",
    status: "Draft",
    pillarId: "",
    caption: "",
    hashtags: "",
    scheduledDate: ""
  };

  if (postId) {
    const found = state.cache.posts.find(function (p) { return p.id === postId; });
    if (found) initial = Object.assign(initial, found);
  }
  if (preset) initial = Object.assign(initial, preset);

  const form = buildPostEditorForm(initial);
  const actions = el("div", { class: "actionsRow" }, []);
  const saveBtn = el("button", { class: "btn btnPrimary", type: "button", text: postId ? "Save" : "Create" });
  const delBtn = el("button", { class: "btn btnDanger", type: "button", text: "Delete" });
  if (!postId) delBtn.disabled = true;

  saveBtn.addEventListener("click", async function () {
    const now = Date.now();
    const obj = {
      id: postId || uid(),
      title: (getVal("fPostTitle", "") || "").trim(),
      clientId: getVal("fPostClientId", ""),
      platform: platformNorm(getVal("fPostPlatform", "Other")),
      status: getVal("fPostStatus", "Draft"),
      pillarId: getVal("fPostPillar", ""),
      caption: getVal("fPostCaption", ""),
      hashtags: getVal("fPostHashtags", ""),
      scheduledDate: getVal("fPostDate", ""),
      createdAt: postId ? (initial.createdAt || now) : now,
      updatedAt: now
    };

    await dbPut("posts", obj);
    await afterDataChange();

    if (!postId) {
      postId = obj.id;
      delBtn.disabled = false;
    }

    renderAttachedAssets(postId);
    toast("Saved");
    if (state.view === "calendar") renderCalendar();
    if (state.view === "posts") renderPosts();
    if (state.view === "dashboard") renderDashboard();
  });

  delBtn.addEventListener("click", async function () {
    if (!postId || !confirm("Delete post?")) return;
    await deletePost(postId);
    await afterDataChange();
    closeModal(true);
    toast("Deleted");
  });

  actions.appendChild(delBtn);
  actions.appendChild(el("button", { class: "btn btnSoft", type: "button", text: "Close", onclick: function () { closeModal(true); } }));
  actions.appendChild(saveBtn);
  form.appendChild(actions);
  openModal(postId ? "Edit Post" : "New Post", form);

  setTimeout(function () {
    renderAttachedAssets(postId);
    wireGrammarCheck("fPostGrammarBtn", "fPostCaption", "fPostGrammarPanel");

    const clientNode = getEl("fPostClientId");
    if (clientNode) clientNode.value = initial.clientId || "";

    const upload = getEl("fPostUpload");
    if (upload) {
      upload.addEventListener("change", async function (e) {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        if (!postId) {
          alert("Save the post first before attaching an asset.");
          upload.value = "";
          return;
        }
        await handleUploadFiles([f]);
        const newest = state.cache.assets[0];
        if (newest) await dbPut("postAssets", { id: uid(), postId: postId, assetId: newest.id, createdAt: Date.now() });
        await afterDataChange();
        renderAttachedAssets(postId);
        upload.value = "";
        toast("Attached");
      });
    }

    const pickBtn = getEl("fPostPickAsset");
    if (pickBtn) {
      pickBtn.addEventListener("click", function () {
        if (!postId) return alert("Save the post first before attaching an asset.");
        openAssetPicker(postId);
      });
    }

    const stockBtn = getEl("fPostStockPhotos");
    if (stockBtn) {
      stockBtn.addEventListener("click", function () {
        if (!postId) return alert("Save the post first before attaching an asset.");
        openStockPhotoSearch(postId);
      });
    }
  }, 0);
}

function buildPillarEditorForm(initial) {
  const wrap = el("div", { class: "formGrid" }, []);
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Pillar Name" }),
    el("input", { class: "input", id: "fPillarName", value: initial.name || "", placeholder: "Example: Educational" })
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Share with client (optional)" }),
    el("select", { class: "select", id: "fPillarClientId" }, [
      el("option", { value: "", text: "-- Personal (not shared) --" })
    ].concat((state.cache.clients || []).map(function (c) {
      return el("option", { value: c.id, text: c.name || "(Unnamed client)" });
    })))
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Color" }),
    el("input", { class: "input", id: "fPillarColor", type: "color", value: initial.color || "#63ff98", style: "padding:0 10px" })
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Notes" }),
    el("textarea", { class: "textarea", id: "fPillarNotes", placeholder: "Rules, tone, do/don't..." }, [initial.notes || ""])
  ]));
  return wrap;
}

async function openPillarEditor(pillarId) {
  let initial = { id: "", name: "", color: "#63ff98", notes: "", clientId: "" };
  if (pillarId) {
    const found = state.cache.pillars.find(function (p) { return p.id === pillarId; });
    if (found) initial = Object.assign(initial, found);
  }

  const form = buildPillarEditorForm(initial);
  const actions = el("div", { class: "actionsRow" }, []);
  const saveBtn = el("button", { class: "btn btnPrimary", type: "button", text: pillarId ? "Save" : "Create" });
  const delBtn = el("button", { class: "btn btnDanger", type: "button", text: "Delete" });
  if (!pillarId) delBtn.disabled = true;

  saveBtn.addEventListener("click", async function () {
    const now = Date.now();
    const obj = {
      id: pillarId || uid(),
      name: (getVal("fPillarName", "") || "").trim(),
      clientId: getVal("fPillarClientId", ""),
      color: getVal("fPillarColor", "#63ff98"),
      notes: getVal("fPillarNotes", ""),
      createdAt: pillarId ? (initial.createdAt || now) : now,
      updatedAt: now
    };
    await dbPut("pillars", obj);
    await afterDataChange();
    toast("Saved");
    closeModal(true);
  });

  delBtn.addEventListener("click", async function () {
    const used = state.cache.posts.some(function (x) { return x.pillarId === pillarId; });
    if (used) return alert("May posts pang gumagamit ng pillar na ito. Palitan muna pillar ng posts bago i-delete.");
    if (!confirm("Delete pillar?")) return;
    await dbDelete("pillars", pillarId);
    await afterDataChange();
    toast("Deleted");
    closeModal(true);
  });

  actions.appendChild(delBtn);
  actions.appendChild(el("button", { class: "btn btnSoft", type: "button", text: "Close", onclick: function () { closeModal(true); } }));
  actions.appendChild(saveBtn);
  form.appendChild(actions);
  openModal(pillarId ? "Edit Pillar" : "New Pillar", form);

  setTimeout(function () {
    const node = getEl("fPillarClientId");
    if (node) node.value = initial.clientId || "";
  }, 0);
}

function buildIdeaEditorForm(initial) {
  const wrap = el("div", { class: "formGrid" }, []);
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Idea Title" }),
    el("input", { class: "input", id: "fIdeaTitle", value: initial.title || "", placeholder: "Example: Reel hook idea..." })
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Share with client (optional)" }),
    el("select", { class: "select", id: "fIdeaClientId" }, [
      el("option", { value: "", text: "-- Personal (not shared) --" })
    ].concat((state.cache.clients || []).map(function (c) {
      return el("option", { value: c.id, text: c.name || "(Unnamed client)" });
    })))
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Notes" }),
    el("textarea", { class: "textarea", id: "fIdeaNotes", placeholder: "Details ng idea..." }, [initial.notes || ""])
  ]));
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Tags (comma separated)" }),
    el("input", { class: "input", id: "fIdeaTags", value: initial.tags || "", placeholder: "smm, reels, clientA" })
  ]));
  return wrap;
}

async function openIdeaEditor(ideaId) {
  let initial = { id: "", title: "", notes: "", tags: "", clientId: "" };
  if (ideaId) {
    const found = state.cache.ideas.find(function (i) { return i.id === ideaId; });
    if (found) initial = Object.assign(initial, found);
  }

  const form = buildIdeaEditorForm(initial);
  const actions = el("div", { class: "actionsRow" }, []);
  const saveBtn = el("button", { class: "btn btnPrimary", type: "button", text: ideaId ? "Save" : "Create" });
  const delBtn = el("button", { class: "btn btnDanger", type: "button", text: "Delete" });
  const toPostBtn = el("button", { class: "btn btnSoft", type: "button", text: "Convert to Post" });
  if (!ideaId) delBtn.disabled = true;

  saveBtn.addEventListener("click", async function () {
    const now = Date.now();
    const obj = {
      id: ideaId || uid(),
      title: (getVal("fIdeaTitle", "") || "").trim(),
      clientId: getVal("fIdeaClientId", ""),
      notes: getVal("fIdeaNotes", ""),
      tags: getVal("fIdeaTags", ""),
      createdAt: ideaId ? (initial.createdAt || now) : now,
      updatedAt: now
    };
    await dbPut("ideas", obj);
    await afterDataChange();
    toast("Saved");
    closeModal(true);
  });

  delBtn.addEventListener("click", async function () {
    if (!confirm("Delete idea?")) return;
    await dbDelete("ideas", ideaId);
    await afterDataChange();
    toast("Deleted");
    closeModal(true);
  });

  toPostBtn.addEventListener("click", function () {
    const t = (getVal("fIdeaTitle", "") || "").trim();
    const n = getVal("fIdeaNotes", "");
    closeModal(true);
    openPostEditor(null, { title: t, caption: n, status: "Idea" });
  });

  actions.appendChild(delBtn);
  actions.appendChild(el("button", { class: "btn btnGhost", type: "button", text: "Close", onclick: function () { closeModal(true); } }));
  actions.appendChild(toPostBtn);
  actions.appendChild(saveBtn);
  form.appendChild(actions);
  openModal(ideaId ? "Edit Idea" : "New Idea", form);

  setTimeout(function () {
    const node = getEl("fIdeaClientId");
    if (node) node.value = initial.clientId || "";
  }, 0);
}

function renderClients() {
  const list = getEl("clientsList");
  if (!list) return;
  list.innerHTML = "";

  if (!hasVipFeatureAccess()) {
    list.appendChild(buildEmptyState("VIP lock", "Clients & Team is part of the VIP membership. Upgrade to unlock collaboration tools."));
    return;
  }

  if (!state.cache.clients.length) {
    list.appendChild(buildEmptyState("No clients yet", "Tap New Client to create a workspace."));
    return;
  }

  state.cache.clients.forEach(function (c) {
    const members = (c.members || []).length;
    list.appendChild(el("div", { class: "item" }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: c.name || "(Untitled client)" }),
        el("div", { class: "itemMeta" }, [
          el("span", { class: "badge", text: c.niche ? clampText(c.niche, 24) : "No niche" }),
          el("span", { class: "badge", text: members + " member(s)" }),
          el("span", { class: "badge", text: c.payrollEnabled === false ? "Payroll: Off" : "Payroll: On" })
        ]),
        el("div", { class: "muted", text: clampText(c.notes || "", 120) })
      ]),
      el("div", { class: "itemActions" }, [
        el("button", { class: "iconBtn", type: "button", text: "Open", onclick: function () { openClientEditor(c.id); } }),
        el("button", { class: "iconBtn", type: "button", text: "Del", onclick: async function () {
          if (!confirm("Delete client?")) return;
          await dbDelete("clients", c.id);
          await afterDataChange();
          toast("Deleted");
        } })
      ])
    ]));
  });
}

function buildClientEditorForm(initial) {
  const wrap = el("div", { class: "formGrid" }, []);

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Client Name" }),
    el("input", { class: "input", id: "fClientName", value: initial.name || "", placeholder: "Example: Client A" })
  ]));

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Niche / Industry" }),
    el("input", { class: "input", id: "fClientNiche", value: initial.niche || "", placeholder: "Example: Beauty, Food, Real Estate" })
  ]));

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Goals" }),
    el("textarea", { class: "textarea", id: "fClientGoals", placeholder: "Example: Increase inquiries, grow followers..." }, [initial.goals || ""])
  ]));

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Notes" }),
    el("textarea", { class: "textarea", id: "fClientNotes", placeholder: "Brand voice, offers, do/don't..." }, [initial.notes || ""])
  ]));

  const membersBox = el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Team / Participants" }),
    el("div", { class: "list", id: "fClientMembersList" }, [])
  ]);

  const inviteBox = el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Invite a participant (offline tracker)" }),
    el("input", { class: "input", id: "fMemberEmail", placeholder: "Member email (for reference)" }),
    el("div", { class: "roleGrid" }, [
      el("button", { class: "roleCard", type: "button", id: "roleObserver" }, [
        el("div", { class: "roleTitle", text: "Observer" }),
        el("div", { class: "roleDesc", text: "Read-only. For clients na gusto lang tumingin." })
      ]),
      el("button", { class: "roleCard", type: "button", id: "roleEditor" }, [
        el("div", { class: "roleTitle", text: "Editor" }),
        el("div", { class: "roleDesc", text: "Can edit drafts/content (future sync)." })
      ]),
      el("button", { class: "roleCard", type: "button", id: "roleManager" }, [
        el("div", { class: "roleTitle", text: "Manager" }),
        el("div", { class: "roleDesc", text: "Full access (future). For admin/owner." })
      ])
    ]),
    el("div", { class: "smallRow" }, [
      el("div", { class: "muted", id: "pickedRole", text: "Picked role: Observer" }),
      el("button", { class: "btn btnSoft", type: "button", id: "addMemberBtn", text: "Add Member" })
    ])
  ]);

  const roomsBox = el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Video Rooms" }),
    el("div", { class: "list", id: "fClientRoomsList" }, []),
    el("div", { class: "smallRow" }, [
      el("input", { class: "input", id: "fNewRoomTitle", placeholder: "Room name (example: Weekly Check-in)" }),
      el("button", { class: "btn btnSoft", type: "button", id: "createRoomBtn", text: "New Room" })
    ])
  ]);

  const payrollToggle = el("input", { type: "checkbox", id: "fClientPayrollEnabled" }, []);
  payrollToggle.checked = initial.payrollEnabled !== false;

  const payrollToggleRow = el("label", { class: "smallRow", style: "cursor:pointer;" }, [
    payrollToggle,
    el("span", { text: "Enable Payroll para sa client na ito" })
  ]);

  const rateSelect = el("select", { class: "select", id: "fClientRateType" }, [
    el("option", { value: "hourly", text: "Hourly rate" }),
    el("option", { value: "fixed", text: "Fixed rate (per payroll period)" })
  ]);
  rateSelect.value = initial.rateType === "fixed" ? "fixed" : "hourly";

  const payrollBox = el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Payroll" }),
    payrollToggleRow,
    el("div", { class: "hint", text: "Kung OFF, hindi isasama ang client na ito sa anumang payroll run, kahit may naka-set na rate. Optional lang ito — depende sa client kung paano sila magbabayad." }),
    el("div", { class: "smallRow", id: "payrollRateFields" }, [
      rateSelect,
      el("input", { class: "input", id: "fClientRateAmount", type: "number", step: "0.01", min: "0", value: String(initial.rateAmount || 0), placeholder: "Rate amount" }),
      el("input", { class: "input", id: "fClientCurrency", value: initial.currency || "PHP", placeholder: "Currency (e.g. PHP)" })
    ]),
    el("div", { class: "hint", text: "Hourly: kada oras na naka-log sa Time Entries sa ibaba. Fixed: buong halagang ito bawat payroll run, kahit walang na-log na oras." })
  ]);

  const timeEntriesBox = el("div", { class: "fieldBlock", id: "payrollTimeEntriesBox" }, [
    el("div", { class: "label", text: "Time Entries (para sa hourly clients)" }),
    el("div", { class: "list", id: "fClientTimeEntriesList" }, []),
    el("div", { class: "smallRow" }, [
      el("input", { class: "input", id: "fNewEntryDate", type: "date", value: fmtDate(new Date()) }),
      el("input", { class: "input", id: "fNewEntryHours", type: "number", step: "0.25", min: "0", placeholder: "Hours" }),
      el("input", { class: "input", id: "fNewEntryNotes", placeholder: "Notes (optional)" }),
      el("button", { class: "btn btnSoft", type: "button", id: "addTimeEntryBtn", text: "Log Hours" })
    ])
  ]);

  wrap.appendChild(el("div", { class: "divider" }));
  wrap.appendChild(membersBox);
  wrap.appendChild(inviteBox);
  wrap.appendChild(el("div", { class: "divider" }));
  wrap.appendChild(roomsBox);
  wrap.appendChild(el("div", { class: "divider" }));
  wrap.appendChild(payrollBox);
  wrap.appendChild(timeEntriesBox);
  return wrap;
}

function renderClientMembers(client) {
  const list = getEl("fClientMembersList");
  if (!list) return;
  list.innerHTML = "";

  const members = client.members || [];
  if (!members.length) {
    list.appendChild(buildEmptyState("No participants yet", "Mag-add ng email + role."));
    return;
  }

  members.forEach(function (m) {
    list.appendChild(el("div", { class: "item" }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: m.email || "(no email)" }),
        el("div", { class: "itemMeta" }, [
          el("span", { class: "badge", text: m.role || "Observer" })
        ])
      ]),
      el("div", { class: "itemActions" }, [
        el("button", { class: "iconBtn", type: "button", text: "Email", onclick: function () {
          openSendEmailModal(m.email, client.name || "");
        } }),
        el("button", { class: "iconBtn", type: "button", text: "Del", onclick: async function () {
          if (!confirm("Remove member?")) return;
          client.members = (client.members || []).filter(function (x) { return x.id !== m.id; });
          client.updatedAt = Date.now();
          await dbPut("clients", client);
          await afterDataChange();
          renderClientMembers(client);
          toast("Removed");
        } })
      ])
    ]));
  });
}

async function renderClientRooms(clientId) {
  const list = getEl("fClientRoomsList");
  if (!list) return;
  list.innerHTML = "";

  if (!clientId) {
    list.appendChild(buildEmptyState("Save the client first", "I-save muna ang client bago gumawa ng video room."));
    return;
  }

  list.appendChild(buildEmptyState("Loading...", ""));
  const rooms = await supabaseGetRoomsForClient(clientId);
  list.innerHTML = "";

  if (!rooms.length) {
    list.appendChild(buildEmptyState("No rooms yet", "Tap New Room to create one."));
    return;
  }

  rooms.forEach(function (r) {
    list.appendChild(el("div", { class: "item" }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: r.title || "Untitled room" }),
        el("div", { class: "itemMeta" }, [
          el("span", { class: "roomCodeBadge", text: r.invite_code || "------" })
        ])
      ]),
      el("div", { class: "itemActions" }, [
        el("button", { class: "iconBtn", type: "button", text: "Copy Code", onclick: function () {
          if (navigator.clipboard && r.invite_code) {
            navigator.clipboard.writeText(r.invite_code);
            toast("Code copied");
          } else {
            alert("Invite code: " + (r.invite_code || ""));
          }
        } }),
        el("button", { class: "iconBtn", type: "button", text: "New Code", onclick: async function () {
          if (!confirm("Generate a new code? Old code will stop working.")) return;
          const newCode = await supabaseRegenerateRoomCode(r.id);
          if (newCode) {
            r.invite_code = newCode;
            renderClientRooms(clientId);
            toast("New code generated");
          }
        } }),
        el("button", { class: "btn btnSoft", type: "button", text: "Start Call", onclick: function () {
          startOrJoinCall(r);
        } })
      ])
    ]));
  });
}

async function renderClientTimeEntries(clientId) {
  const list = getEl("fClientTimeEntriesList");
  if (!list) return;
  list.innerHTML = "";

  if (!clientId) {
    list.appendChild(buildEmptyState("Save the client first", "I-save muna ang client bago mag-log ng oras."));
    return;
  }

  list.appendChild(buildEmptyState("Loading...", ""));
  const entries = await supabaseGetTimeEntries(clientId);
  list.innerHTML = "";

  if (!entries.length) {
    list.appendChild(buildEmptyState("No time entries yet", "Gamitin ang Log Hours para magsimula."));
    return;
  }

  entries.forEach(function (e) {
    list.appendChild(el("div", { class: "item" }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: e.work_date + " — " + Number(e.hours).toFixed(2) + " hrs" }),
        el("div", { class: "muted", text: e.notes || "" })
      ]),
      el("div", { class: "itemActions" }, [
        el("button", { class: "iconBtn", type: "button", text: "Del", onclick: async function () {
          if (!confirm("Delete this time entry?")) return;
          await supabaseDeleteTimeEntry(e.id);
          renderClientTimeEntries(clientId);
          toast("Deleted");
        } })
      ])
    ]));
  });
}

let jitsiApiInstance = null;

function closeJitsiCall() {
  if (jitsiApiInstance) {
    try { jitsiApiInstance.dispose(); } catch (e) { /* noop */ }
    jitsiApiInstance = null;
  }
}

function openCallModal(room, call) {
  const wrap = el("div", { class: "callWrap" }, [
    el("div", { class: "muted", text: "Room: " + (room.title || "Untitled room") }),
    el("div", { class: "jitsiContainer", id: "jitsiContainer" }, [])
  ]);

  const actions = el("div", { class: "actionsRow" }, []);
  const leaveBtn = el("button", { class: "btn btnDanger", type: "button", text: "Leave Call" });
  leaveBtn.addEventListener("click", async function () {
    await supabaseLeaveCall(call.id);
    closeJitsiCall();
    closeModal(true);
    toast("Left the call");
  });
  actions.appendChild(leaveBtn);
  wrap.appendChild(actions);

  openModal("Video Call", wrap, { locked: true });

  setTimeout(function () {
    if (typeof JitsiMeetExternalAPI === "undefined") {
      toast("Jitsi failed to load. Check your internet connection.");
      return;
    }
    const roomName = "smmtva-" + String(room.id).replace(/-/g, "");
    jitsiApiInstance = new JitsiMeetExternalAPI("meet.jit.si", {
      roomName: roomName,
      parentNode: getEl("jitsiContainer"),
      width: "100%",
      height: 420,
      configOverwrite: { prejoinPageEnabled: false },
      interfaceConfigOverwrite: {}
    });
    jitsiApiInstance.addEventListener("videoConferenceLeft", async function () {
      await supabaseLeaveCall(call.id);
      closeJitsiCall();
      closeModal(true);
    });
  }, 0);
}

async function startOrJoinCall(room) {
  if (!room || !room.id) return;
  let call = await supabaseGetActiveCall(room.id);
  if (!call) {
    call = await supabaseStartCall(room.id);
  }
  if (!call) return;
  await supabaseJoinCall(call.id);
  openCallModal(room, call);
}

async function openJoinRoomModal() {
  if (guardPremiumAccess("clients")) return;

  const wrap = el("div", { class: "formGrid" }, [
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Invite Code" }),
      el("input", { class: "input", id: "joinRoomCode", placeholder: "Example: A1B2C3D4" })
    ])
  ]);

  const actions = el("div", { class: "actionsRow" }, []);
  const joinBtn = el("button", { class: "btn btnPrimary", type: "button", text: "Join" });
  joinBtn.addEventListener("click", async function () {
    const code = (getVal("joinRoomCode", "") || "").trim();
    if (!code) return alert("Enter an invite code first.");

    const roomId = await supabaseJoinRoomWithCode(code);
    if (!roomId) return;

    const room = await supabaseGetRoomById(roomId);
    if (!room) return;

    closeModal(true);
    toast("Joined room");
    startOrJoinCall(room);
  });
  actions.appendChild(el("button", { class: "btn btnSoft", type: "button", text: "Cancel", onclick: function () { closeModal(true); } }));
  actions.appendChild(joinBtn);
  wrap.appendChild(actions);

  openModal("Join Video Room", wrap);
}

async function openClientEditor(clientId) {
  if (guardPremiumAccess("clients")) return;
  let initial = { id: "", name: "", niche: "", goals: "", notes: "", members: [] };
  if (clientId) {
    const found = state.cache.clients.find(function (c) { return c.id === clientId; });
    if (found) initial = cloneJSON(found);
  }

  const form = buildClientEditorForm(initial);
  let selectedRole = "Observer";

  function pickedRole() {
    setText("pickedRole", "Picked role: " + selectedRole);
  }

  function highlight() {
    ["roleObserver", "roleEditor", "roleManager"].forEach(function (id) {
      const btn = getEl(id);
      if (btn) btn.style.borderColor = "rgba(255,255,255,.10)";
    });
    const map = { Observer: "roleObserver", Editor: "roleEditor", Manager: "roleManager" };
    const active = getEl(map[selectedRole]);
    if (active) active.style.borderColor = "rgba(99,255,152,.45)";
  }

  function setRole(r) {
    selectedRole = r;
    pickedRole();
    highlight();
  }

  openModal(clientId ? "Client Workspace" : "New Client", form);

  function syncPayrollToggleUI() {
    const enabled = getEl("fClientPayrollEnabled") ? getEl("fClientPayrollEnabled").checked : true;
    const rateFields = getEl("payrollRateFields");
    const entriesBox = getEl("payrollTimeEntriesBox");
    if (rateFields) rateFields.style.opacity = enabled ? "1" : "0.4";
    if (rateFields) $$("input,select", rateFields).forEach(function (n) { n.disabled = !enabled; });
    if (entriesBox) entriesBox.style.display = enabled ? "" : "none";
  }

  setTimeout(function () {
    renderClientMembers(initial);
    setRole("Observer");
    bind("roleObserver", "click", function () { setRole("Observer"); });
    bind("roleEditor", "click", function () { setRole("Editor"); });
    bind("roleManager", "click", function () { setRole("Manager"); });
    bind("fClientPayrollEnabled", "change", syncPayrollToggleUI);
    syncPayrollToggleUI();
    bind("addMemberBtn", "click", async function () {
      const email = (getVal("fMemberEmail", "") || "").trim();
      if (!email) return alert("Enter an email first.");

      initial.members = initial.members || [];
      initial.members.push({ id: uid(), email: email, role: selectedRole });
      initial.updatedAt = Date.now();

      await dbPut("clients", {
        id: initial.id || uid(),
        name: (getVal("fClientName", "") || "").trim(),
        niche: (getVal("fClientNiche", "") || "").trim(),
        goals: getVal("fClientGoals", ""),
        notes: getVal("fClientNotes", ""),
        members: initial.members,
        createdAt: initial.createdAt || Date.now(),
        updatedAt: Date.now()
      });

      await afterDataChange();
      const node = getEl("fMemberEmail");
      if (node) node.value = "";
      renderClientMembers(initial);
      toast("Member added");
    });

    renderClientRooms(clientId);
    bind("createRoomBtn", "click", async function () {
      if (!clientId) return alert("Save the client first before creating a video room.");
      const title = (getVal("fNewRoomTitle", "") || "").trim();
      const room = await supabaseCreateRoom(clientId, title);
      if (!room) return;
      const node = getEl("fNewRoomTitle");
      if (node) node.value = "";
      renderClientRooms(clientId);
      toast("Room created");
    });

    renderClientTimeEntries(clientId);
    bind("addTimeEntryBtn", "click", async function () {
      if (!clientId) return alert("Save the client first before logging hours.");
      const workDate = getVal("fNewEntryDate", fmtDate(new Date()));
      const hours = Number(getVal("fNewEntryHours", "0"));
      if (!hours || hours <= 0) return alert("Enter hours greater than 0.");
      const notes = getVal("fNewEntryNotes", "");
      const entry = await supabaseAddTimeEntry(clientId, workDate, hours, notes);
      if (!entry) return;
      const hoursNode = getEl("fNewEntryHours");
      const notesNode = getEl("fNewEntryNotes");
      if (hoursNode) hoursNode.value = "";
      if (notesNode) notesNode.value = "";
      renderClientTimeEntries(clientId);
      toast("Hours logged");
    });
  }, 0);

  const actions = el("div", { class: "actionsRow" }, []);
  const saveBtn = el("button", { class: "btn btnPrimary", type: "button", text: clientId ? "Save" : "Create" });
  const delBtn = el("button", { class: "btn btnDanger", type: "button", text: "Delete" });
  if (!clientId) delBtn.disabled = true;

  saveBtn.addEventListener("click", async function () {
    const now = Date.now();
    const obj = {
      id: clientId || initial.id || uid(),
      name: (getVal("fClientName", "") || "").trim(),
      niche: (getVal("fClientNiche", "") || "").trim(),
      goals: getVal("fClientGoals", ""),
      notes: getVal("fClientNotes", ""),
      rateType: getVal("fClientRateType", "hourly"),
      rateAmount: Number(getVal("fClientRateAmount", "0")),
      currency: (getVal("fClientCurrency", "PHP") || "PHP").trim(),
      payrollEnabled: getEl("fClientPayrollEnabled") ? getEl("fClientPayrollEnabled").checked : true,
      members: initial.members || [],
      createdAt: clientId ? (initial.createdAt || now) : now,
      updatedAt: now
    };
    await dbPut("clients", obj);
    await afterDataChange();
    toast("Saved");
    closeModal(true);
  });

  delBtn.addEventListener("click", async function () {
    if (!confirm("Delete client?")) return;
    await dbDelete("clients", clientId);
    await afterDataChange();
    toast("Deleted");
    closeModal(true);
  });

  actions.appendChild(delBtn);
  actions.appendChild(el("button", { class: "btn btnSoft", type: "button", text: "Close", onclick: function () { closeModal(true); } }));
  actions.appendChild(saveBtn);
  form.appendChild(actions);
}

// ---- Phase 3: Payroll tab UI ----

function fmtMoney(amount, currency) {
  const num = Number(amount || 0);
  return (currency || "PHP") + " " + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function renderPayrollTab() {
  const list = getEl("payrollRunsList");
  if (!list) return;
  list.innerHTML = "";

  if (!hasVipFeatureAccess()) {
    list.appendChild(buildEmptyState("VIP lock", "Payroll is part of the VIP membership. Upgrade to unlock."));
    return;
  }

  list.appendChild(buildEmptyState("Loading...", ""));
  const runs = await supabaseGetPayrollRuns();
  state.cache.payrollRuns = runs;
  list.innerHTML = "";

  if (!runs.length) {
    list.appendChild(buildEmptyState("No payroll runs yet", "Tap New Payroll Run to compute your first one."));
    return;
  }

  runs.forEach(function (r) {
    list.appendChild(el("div", { class: "item" }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: r.title || "Untitled run" }),
        el("div", { class: "itemMeta" }, [
          el("span", { class: "badge", text: r.period_start + " to " + r.period_end }),
          el("span", { class: "badge", text: r.status === "finalized" ? "Finalized" : "Draft" })
        ])
      ]),
      el("div", { class: "itemActions" }, [
        el("button", { class: "btn btnSoft", type: "button", text: "Open", onclick: function () { openPayrollRunDetail(r); } }),
        el("button", { class: "iconBtn", type: "button", text: "Del", onclick: async function () {
          if (!confirm("Delete this payroll run?")) return;
          await supabaseDeletePayrollRun(r.id);
          renderPayrollTab();
          toast("Deleted");
        } })
      ])
    ]));
  });
}

function openPayrollRunEditor() {
  if (guardPremiumAccess("payroll")) return;

  const today = fmtDate(new Date());
  const wrap = el("div", { class: "formGrid" }, [
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Run Title" }),
      el("input", { class: "input", id: "fPayrollTitle", placeholder: "Example: July 1-15 Payroll" })
    ]),
    el("div", { class: "smallRow" }, [
      el("div", { class: "fieldBlock" }, [
        el("div", { class: "label", text: "Period Start" }),
        el("input", { class: "input", id: "fPayrollStart", type: "date", value: today })
      ]),
      el("div", { class: "fieldBlock" }, [
        el("div", { class: "label", text: "Period End" }),
        el("input", { class: "input", id: "fPayrollEnd", type: "date", value: today })
      ])
    ]),
    el("div", { class: "hint", text: "Kukunin nito ang lahat ng clients mo: para sa hourly clients, isusuma ang na-log na oras sa loob ng date range x rate; para sa fixed clients, direktang gagamitin ang fixed rate." })
  ]);

  const actions = el("div", { class: "actionsRow" }, []);
  const createBtn = el("button", { class: "btn btnPrimary", type: "button", text: "Create & Compute" });
  createBtn.addEventListener("click", async function () {
    const title = (getVal("fPayrollTitle", "") || "").trim();
    const start = getVal("fPayrollStart", today);
    const end = getVal("fPayrollEnd", today);
    if (!start || !end || start > end) return alert("Check the date range — start must not be after end.");

    const run = await supabaseCreatePayrollRun(title, start, end);
    if (!run) return;

    const ok = await supabaseComputePayrollRun(run.id);
    if (!ok) return;

    closeModal(true);
    toast("Payroll run computed");
    renderPayrollTab();
    openPayrollRunDetail(run);
  });

  actions.appendChild(el("button", { class: "btn btnSoft", type: "button", text: "Cancel", onclick: function () { closeModal(true); } }));
  actions.appendChild(createBtn);
  wrap.appendChild(actions);

  openModal("New Payroll Run", wrap);
}

function csvEscape(value) {
  const s = String(value === null || typeof value === "undefined" ? "" : value);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function exportPayrollRunCSV(run, items) {
  const header = ["Client", "Rate Type", "Rate", "Currency", "Hours", "Amount"];
  const rows = items.map(function (it) {
    return [
      (it.clients && it.clients.name) || "(unknown client)",
      it.rate_type,
      it.rate_amount,
      it.currency,
      it.rate_type === "hourly" ? it.hours : "",
      it.computed_amount
    ];
  });
  const total = items.reduce(function (sum, it) { return sum + Number(it.computed_amount || 0); }, 0);
  rows.push(["", "", "", "", "TOTAL", total]);

  const csv = [header].concat(rows).map(function (r) {
    return r.map(csvEscape).join(",");
  }).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "payroll_" + (run.title || "run").replace(/[^a-z0-9]+/gi, "_") + "_" + run.period_start + "_to_" + run.period_end + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("CSV downloaded — buksan sa Google Sheets: File > Import > Upload");
}

async function openPayrollRunDetail(run) {
  const wrap = el("div", { class: "formGrid" }, [
    el("div", { class: "muted", text: (run.period_start || "") + " to " + (run.period_end || "") + " • " + (run.status === "finalized" ? "Finalized" : "Draft") }),
    el("div", { class: "list", id: "payrollItemsList" }, []),
    el("div", { class: "itemTitle", id: "payrollRunTotal", text: "" })
  ]);

  const actions = el("div", { class: "actionsRow" }, []);
  const recomputeBtn = el("button", { class: "btn btnSoft", type: "button", text: "Recompute" });
  const exportBtn = el("button", { class: "btn btnSoft", type: "button", text: "Export CSV" });
  const finalizeBtn = el("button", { class: "btn btnPrimary", type: "button", text: run.status === "finalized" ? "Finalized" : "Finalize" });
  if (run.status === "finalized") finalizeBtn.disabled = true;
  const deleteBtn = el("button", { class: "btn btnDanger", type: "button", text: "Delete Run" });

  let currentItems = [];

  async function loadItems() {
    const list = getEl("payrollItemsList");
    if (!list) return;
    list.innerHTML = "";
    list.appendChild(buildEmptyState("Loading...", ""));
    const items = await supabaseGetPayrollRunItems(run.id);
    currentItems = items;
    list.innerHTML = "";

    if (!items.length) {
      list.appendChild(buildEmptyState("No line items", "Walang clients na may naka-set na rate, o wala pang na-log na oras."));
      setText("payrollRunTotal", "");
      return;
    }

    items.forEach(function (it) {
      const clientName = (it.clients && it.clients.name) || "(unknown client)";
      const detail = it.rate_type === "hourly"
        ? Number(it.hours || 0).toFixed(2) + " hrs × " + fmtMoney(it.rate_amount, it.currency)
        : "Fixed rate";
      list.appendChild(el("div", { class: "item" }, [
        el("div", { class: "itemMain" }, [
          el("div", { class: "itemTitle", text: clientName }),
          el("div", { class: "itemMeta" }, [
            el("span", { class: "badge", text: it.rate_type }),
            el("span", { class: "muted", text: detail })
          ])
        ]),
        el("div", { class: "itemActions" }, [
          el("div", { class: "itemTitle", text: fmtMoney(it.computed_amount, it.currency) })
        ])
      ]));
    });

    const total = items.reduce(function (sum, it) { return sum + Number(it.computed_amount || 0); }, 0);
    const currency = (items[0] && items[0].currency) || "PHP";
    setText("payrollRunTotal", "Total: " + fmtMoney(total, currency));
  }

  recomputeBtn.addEventListener("click", async function () {
    if (run.status === "finalized") return alert("Finalized na ang run na ito — hindi na puwedeng i-recompute.");
    const ok = await supabaseComputePayrollRun(run.id);
    if (!ok) return;
    await loadItems();
    toast("Recomputed");
  });

  exportBtn.addEventListener("click", function () {
    if (!currentItems.length) return alert("Wala pang laman ang run na ito.");
    exportPayrollRunCSV(run, currentItems);
  });

  finalizeBtn.addEventListener("click", async function () {
    if (!confirm("Finalize this payroll run? Hindi na ito puwedeng i-recompute pagkatapos.")) return;
    const updated = await supabaseUpdatePayrollRunStatus(run.id, "finalized");
    if (!updated) return;
    run.status = "finalized";
    finalizeBtn.disabled = true;
    finalizeBtn.textContent = "Finalized";
    renderPayrollTab();
    toast("Finalized");
  });

  deleteBtn.addEventListener("click", async function () {
    if (!confirm("Delete this payroll run permanently?")) return;
    await supabaseDeletePayrollRun(run.id);
    closeModal(true);
    renderPayrollTab();
    toast("Deleted");
  });

  actions.appendChild(deleteBtn);
  actions.appendChild(recomputeBtn);
  actions.appendChild(exportBtn);
  actions.appendChild(finalizeBtn);
  wrap.appendChild(actions);

  openModal(run.title || "Payroll Run", wrap);
  loadItems();
}

function buildBrandContext() {
  const about = getAboutProfile();
  const dna = getCreatorDNA();
  const prefs = getPrefs();
  const outputLanguage = (dna.preferredLanguage || prefs.contentLanguage || "English").trim();

  const lines = [
    "App/Brand: " + (about.appName || APP_SHORT_NAME),
    "Output language: " + outputLanguage,
    dna.brandName ? "Brand name: " + dna.brandName : null,
    dna.audience ? "Target audience: " + dna.audience : null,
    dna.mission ? "Mission: " + dna.mission : null,
    dna.tone ? "Tone of voice: " + dna.tone : null,
    dna.contentStyle ? "Content style: " + dna.contentStyle : null,
    dna.goals ? "Goals: " + dna.goals : null,
    dna.constraints ? "Constraints: " + dna.constraints : null,
    dna.offers ? "Offers/services: " + dna.offers : null,
    dna.ctaStyle ? "CTA style: " + dna.ctaStyle : null
  ].filter(Boolean);

  return {
    lines: lines,
    outputLanguage: outputLanguage
  };
}

function firstMeaningfulLine(text) {
  const lines = (text || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
  return lines[0] || "";
}

function formatAiError(err) {
  try {
    if (!err) return "Unknown error";
    let msg = err && err.message ? String(err.message) : String(err);

    const ctx = (err && err.context) ? err.context : null;
    if (ctx && typeof ctx === "object") {
      const status = ctx.status || ctx.statusCode;
      if (status) msg += " (status " + status + ")";

      const body = typeof ctx.body === "undefined" ? null : ctx.body;
      if (body) {
        const bodyText = typeof body === "string" ? body : JSON.stringify(body);
        if (bodyText) msg += " • " + clampText(bodyText, 220);
      }
    }

    return msg;
  } catch (e) {
    return err && err.message ? String(err.message) : "Unknown error";
  }
}

async function invokeAiGenerate(prompt, meta) {
  if (typeof supabaseClient === "undefined" || !supabaseClient.functions || !supabaseClient.functions.invoke) {
    throw new Error("Supabase Edge Functions not available.");
  }

  const result = await supabaseClient.functions.invoke(AI_FUNCTION_NAME, {
    body: {
      prompt: prompt,
      meta: meta || {}
    }
  });

  if (result.error) throw result.error;

  const data = result.data || {};
  if (data.error) throw new Error(data.error);

  return {
    text: data.text || "",
    model: data.model || ""
  };
}

function openAiAssistant() {
  if (guardPremiumAccess("ai")) return;
  const wrap = el("div", { class: "formGrid" }, []);
  const prefs = getPrefs();
  const dna = getCreatorDNA();
  const brandCtx = buildBrandContext();

  const postSel = el("select", { class: "select", id: "aiPostSel" }, []);
  postSel.appendChild(el("option", { value: "", text: "No Post Selected" }));
  state.cache.posts.slice().reverse().slice(0, 120).forEach(function (p) {
    postSel.appendChild(el("option", { value: p.id, text: clampText(p.title || "(Untitled post)", 44) }));
  });

  const aiPlatformSel = el("select", { class: "select", id: "aiPlatformSel" }, []);
  ["Facebook", "Instagram", "TikTok", "Pinterest", "YouTube", "Threads", "Other"].forEach(function (x) {
    aiPlatformSel.appendChild(el("option", { value: x, text: x }));
  });

  const searchIntentBox = el("input", {
    class: "input",
    id: "aiSearchIntent",
    placeholder: "User search intent or keyword, for example: affordable SMM tips"
  });
  const promptBox = el("textarea", { class: "textarea", id: "aiPrompt", placeholder: "Write your own prompt or use the one-tap search templates below..." }, []);
  const respBox = el("textarea", { class: "textarea", id: "aiResp", placeholder: "Generated output will appear here..." }, []);
  const aiStatus = el("div", { class: "notice", id: "aiStatusBox" }, [
    el("div", { class: "itemTitle", text: "Prompt Status" }),
    el("div", { class: "muted", id: "aiStatusText", text: "Ready." })
  ]);

  searchIntentBox.value = localStorage.getItem("ai_last_intent") || "";
  promptBox.value = localStorage.getItem("ai_last_prompt") || "";
  respBox.value = localStorage.getItem("ai_last_resp") || "";

  function buildPrompt(type) {
    const postSelNode = getEl("aiPostSel");
    const platformSelNode = getEl("aiPlatformSel");
    const intentNode = getEl("aiSearchIntent");
    const postId = postSelNode ? postSelNode.value : "";
    const platform = platformSelNode ? platformSelNode.value : "Other";
    const searchIntent = intentNode ? (intentNode.value || "").trim() : "";
    const p = state.cache.posts.find(function (x) { return x.id === postId; }) || null;

    const base = [
      "You are a writing assistant for a social media workspace.",
      "Write naturally and clearly, like a practical human content writer.",
      "Do not sound obviously AI-generated.",
      "Language: " + (brandCtx.outputLanguage || prefs.contentLanguage || "English") + ".",
      "Brand voice: clean, confident, helpful, and modern.",
      ""
    ];

    const brandSection = brandCtx.lines.length ? ["Brand Context:"].concat(brandCtx.lines).concat([""]) : ["Brand Context: none", ""];
    const searchSection = [
      "Search Context:",
      "Primary user search intent: " + (searchIntent || "none provided"),
      ""
    ];
    const postSection = p ? [
      "Post Context:",
      "Title: " + (p.title || ""),
      "Platform: " + (p.platform || platform),
      "Status: " + (p.status || ""),
      "Scheduled Date: " + (p.scheduledDate || ""),
      "Caption Draft: " + (p.caption || ""),
      "Hashtags Draft: " + (p.hashtags || ""),
      ""
    ] : [
      "Post Context:",
      "Platform: " + platform,
      ""
    ];

    if (type === "title") {
      return base.concat(brandSection, searchSection, postSection, [
        "Task:",
        "Generate 15 strong post titles based on the user search intent.",
        "Keep them natural, relevant, and easy to publish.",
        "Return titles only as a numbered list."
      ]).join("\n");
    }

    if (type === "caption") {
      return base.concat(brandSection, searchSection, postSection, [
        "Task:",
        "Create 3 caption options based on the user search intent.",
        "- Option 1: short and direct",
        "- Option 2: educational and useful",
        "- Option 3: conversion-focused with CTA",
        "Keep the writing platform-appropriate and non-cringe.",
        "Return captions only."
      ]).join("\n");
    }

    if (type === "hashtags") {
      return base.concat(brandSection, searchSection, postSection, [
        "Task:",
        "Create 3 hashtag sets based on the user search intent.",
        "- Set A: broad + niche mix",
        "- Set B: targeted discovery",
        "- Set C: local intent + engagement",
        "Each set should have 10-15 hashtags.",
        "Return hashtags only."
      ]).join("\n");
    }

    if (type === "faq") {
      return base.concat(brandSection, searchSection, postSection, [
        "Task:",
        "Generate 12 real-world questions users may search or ask before buying.",
        "Return short FAQ questions only as a numbered list."
      ]).join("\n");
    }

    if (type === "hooks") {
      return base.concat(brandSection, searchSection, postSection, [
        "Task:",
        "Create 12 hook lines for search-led content.",
        "Make them attention-grabbing, simple, and non-cringe.",
        "Return hooks only as a numbered list."
      ]).join("\n");
    }

    if (type === "cta") {
      return base.concat(brandSection, searchSection, postSection, [
        "Task:",
        "Create 12 call-to-action lines.",
        "Mix soft CTA, direct CTA, and inquiry CTA.",
        "Return CTA lines only."
      ]).join("\n");
    }

    if (type === "ideas") {
      return base.concat(brandSection, searchSection, postSection, [
        "Task:",
        "Generate 24 content ideas based on what users are searching for.",
        "Mix educational, engagement, promotional, and behind-the-scenes content.",
        "Return as numbered list with short topic titles."
      ]).join("\n");
    }

    if (type === "rewrite") {
      return base.concat(brandSection, searchSection, postSection, [
        "Task:",
        "Rewrite this for " + platform + ".",
        "Make it optimized for that platform's style and audience behavior.",
        "Return only the rewritten version."
      ]).join("\n");
    }

    return base.concat(brandSection, searchSection, postSection, [
      "Task:",
      "Create a 4-week content plan.",
      "- weekly theme",
      "- 5 post ideas per week",
      "- content angle based on search intent",
      "- goal per post",
      "Return as a week-by-week plan."
    ]).join("\n");
  }

  function setPrompt(type) {
    const p = buildPrompt(type);
    localStorage.setItem("ai_last_intent", getVal("aiSearchIntent", ""));
    getEl("aiPrompt").value = p;
    localStorage.setItem("ai_last_prompt", p);
    toast("Prompt ready");
  }

  function setAiStatus(message) {
    setText("aiStatusText", message);
  }

  function saveResp() {
    localStorage.setItem("ai_last_resp", getVal("aiResp", ""));
    toast("Saved");
  }

  async function generateNow(taskType) {
    const prompt = (getVal("aiPrompt", "") || "").trim();
    const postId = getVal("aiPostSel", "");
    const platform = getVal("aiPlatformSel", "Other");
    const searchIntent = (getVal("aiSearchIntent", "") || "").trim();
    const p = state.cache.posts.find(function (x) { return x.id === postId; }) || null;

    if (!prompt) {
      alert("Create a prompt first or use the one-tap search templates.");
      return;
    }

    const btns = $$(".aiRunBtn", wrap);
    btns.forEach(function (b) { b.disabled = true; });
    setAiStatus("Generating...");

    try {
      const result = await invokeAiGenerate(prompt, {
        taskType: taskType || "custom",
        platform: platform,
        searchIntent: searchIntent,
        postId: postId || "",
        postTitle: p ? (p.title || "") : "",
        appName: getAboutProfile().appName || APP_SHORT_NAME,
        preferredLanguage: brandCtx.outputLanguage || prefs.contentLanguage || "English"
      });

      const text = (result.text || "").trim();
      getEl("aiResp").value = text;
      localStorage.setItem("ai_last_intent", searchIntent);
      localStorage.setItem("ai_last_prompt", prompt);
      localStorage.setItem("ai_last_resp", text);
      setAiStatus("Done" + (result.model ? " using " + result.model : "") + ".");
      toast("Generated");
    } catch (err) {
      const msg = formatAiError(err);
      setAiStatus("Failed: " + msg);
      alert("Generation failed: " + msg);
    } finally {
      btns.forEach(function (b) { b.disabled = false; });
    }
  }

  async function applyToPost(target) {
    const postId = getVal("aiPostSel", "");
    if (!postId) return alert("Select a post first.");
    const p = state.cache.posts.find(function (x) { return x.id === postId; });
    if (!p) return;
    const text = (getVal("aiResp", "") || "").trim();
    if (!text) return alert("Generate or paste output first.");

    const updated = Object.assign({}, p, { updatedAt: Date.now() });
    if (target === "title") updated.title = firstMeaningfulLine(text);
    if (target === "caption") updated.caption = text;
    if (target === "hashtags") updated.hashtags = text;

    await dbPut("posts", updated);
    await afterDataChange();
    toast("Applied");
  }

  wrap.appendChild(el("div", { class: "notice" }, [
    el("div", { class: "itemTitle", text: "AI Assistant" }),
    el("div", { class: "muted", text: "VIP tool ito para sa prompt shortcuts, content generation, at faster editing ng posts mo." })
  ]));

  if (dna.brandName || dna.mission || dna.tone || dna.contentStyle) {
    wrap.appendChild(el("div", { class: "notice" }, [
      el("div", { class: "itemTitle", text: "Using Brand Setup" }),
      el("div", { class: "muted", text: clampText(brandCtx.lines.join(" • "), 260) })
    ]));
  }

  wrap.appendChild(el("div", { class: "formRow2" }, [
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Use a Post (optional)" }),
      postSel
    ]),
    el("div", { class: "fieldBlock" }, [
      el("div", { class: "label", text: "Target Platform" }),
      aiPlatformSel
    ])
  ]));

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "User Search Intent" }),
    searchIntentBox
  ]));

  wrap.appendChild(el("div", { class: "actionsRow" }, [
    el("button", { class: "btn btnSoft", type: "button", text: "Search Titles", onclick: function () { setPrompt("title"); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "Search Caption", onclick: function () { setPrompt("caption"); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "SEO Hashtags", onclick: function () { setPrompt("hashtags"); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "User FAQs", onclick: function () { setPrompt("faq"); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "Ideas", onclick: function () { setPrompt("ideas"); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "Hooks", onclick: function () { setPrompt("hooks"); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "CTA", onclick: function () { setPrompt("cta"); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "Rewrite", onclick: function () { setPrompt("rewrite"); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "Plan", onclick: function () { setPrompt("plan"); } })
  ]));

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Prompt" }),
    promptBox
  ]));

  wrap.appendChild(el("div", { class: "actionsRow" }, [
    el("button", { class: "btn btnPrimary aiRunBtn", type: "button", text: "Generate Now", onclick: function () { generateNow("custom"); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "Clear Prompt", onclick: function () {
      getEl("aiSearchIntent").value = "";
      getEl("aiPrompt").value = "";
      localStorage.removeItem("ai_last_intent");
      localStorage.removeItem("ai_last_prompt");
      setAiStatus("Prompt cleared.");
    } })
  ]));

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Output" }),
    respBox
  ]));

  wrap.appendChild(aiStatus);

  wrap.appendChild(el("div", { class: "actionsRow" }, [
    el("button", { class: "btn btnSoft", type: "button", text: "Save Response", onclick: saveResp }),
    el("button", { class: "btn btnSoft", type: "button", text: "Copy Output", onclick: async function () {
      const text = getVal("aiResp", "");
      try {
        await navigator.clipboard.writeText(text);
        toast("Copied");
      } catch (e) {
        toast("Copy manually");
      }
    } }),
    el("button", { class: "btn btnSoft", type: "button", text: "Apply Title", onclick: function () { applyToPost("title"); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "Apply Caption", onclick: function () { applyToPost("caption"); } }),
    el("button", { class: "btn btnSoft", type: "button", text: "Apply Hashtags", onclick: function () { applyToPost("hashtags"); } })
  ]));

  openModal("AI Assistant", wrap);
}

function paymentInfoText(method) {
  if (method === "gcash") return "GCash: " + PAYMENT_DETAILS.gcashName + " - " + PAYMENT_DETAILS.gcashNumber;
  if (method === "maya") return "Maya: " + PAYMENT_DETAILS.mayaName + " - " + PAYMENT_DETAILS.mayaNumber;
  return "PayPal: " + PAYMENT_DETAILS.paypalLink;
}

function openPaywallModal(opts) {
  const options = opts || {};
  const force = !!options.force;
  const feature = options.feature || "";
  const profile = state.access.profile || {};
  const trialEndText = profile.trial_ends_at ? new Date(profile.trial_ends_at).toLocaleString() : "N/A";
  const pendingText = profile.payment_status === "pending" ? "May naka-save ka nang VIP membership request sa account na ito. Puwede mo pa ring i-update sa ibaba." : "";

  const wrap = el("div", { class: "formGrid" }, []);
  const planSel = el("select", { class: "select", id: "vipPlan" }, []);
  planSel.appendChild(el("option", { value: "monthly", text: "Monthly - " + peso(VIP_PRICES.monthly) }));
  planSel.appendChild(el("option", { value: "yearly", text: "Yearly - " + peso(VIP_PRICES.yearly) }));
  planSel.appendChild(el("option", { value: "lifetime", text: "Lifetime - " + peso(VIP_PRICES.lifetime) }));
  if (profile.plan && VIP_PRICES[profile.plan]) planSel.value = profile.plan;
  planSel.style.display = "none";

  const methodSel = el("input", { id: "vipMethod", type: "hidden", value: "beta_plan" });

  function planCardValue(label, price, sub, value) {
    const card = el("button", { class: "planCard", type: "button" }, [
      el("div", { class: "itemTitle", text: label }),
      el("div", { class: "planPrice", text: price }),
      el("div", { class: "muted", text: sub })
    ]);
    card.addEventListener("click", function () {
      planSel.value = value;
      $$(".planCard", wrap).forEach(function (node) { node.classList.remove("active"); });
      card.classList.add("active");
    });
    if (planSel.value === value) card.classList.add("active");
    return card;
  }

  wrap.appendChild(el("div", { class: "notice" }, [
    el("div", { class: "itemTitle", text: feature ? ("Unlock " + getPremiumFeatureLabel(feature)) : "VIP Membership" }),
    el("div", { class: "muted", text: "Kapag walang VIP, naka-lock ang AI Assistant, Calendar, at Clients & Team." }),
    el("div", { class: "muted", text: "Trial note: " + trialEndText }),
    el("div", { class: "muted", text: "Monthly " + peso(VIP_PRICES.monthly) + " • Yearly " + peso(VIP_PRICES.yearly) + " • Lifetime " + peso(VIP_PRICES.lifetime) }),
    pendingText ? el("div", { class: "muted", text: pendingText }) : null
  ]));

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Choose Plan" }),
    el("div", { class: "planGrid" }, [
      planCardValue("VIP Monthly", peso(VIP_PRICES.monthly), "Unlock premium tools for monthly membership access.", "monthly"),
      planCardValue("VIP Yearly", peso(VIP_PRICES.yearly), "Best value for long-term active members.", "yearly"),
      planCardValue("VIP Lifetime", peso(VIP_PRICES.lifetime), "One-time upgrade for permanent premium access.", "lifetime")
    ]),
    planSel,
    methodSel
  ]));

  wrap.appendChild(el("div", { class: "notice" }, [
    el("div", { class: "itemTitle", text: "Membership benefits" }),
    el("div", { class: "muted", text: "Unlocked: AI Assistant, Calendar scheduling, Clients & Team collaboration, and future premium communication tools." }),
    el("div", { class: "muted", text: "Piliin ang plan mo, tapos babayaran mo via PayMongo (GCash, card, Maya, GrabPay)." })
  ]));

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Internal note" }),
    el("input", { class: "input", id: "vipRef", placeholder: "Optional note for this membership" })
  ]));

  wrap.appendChild(el("div", { class: "actionsRow" }, [
    el("button", { class: "btn btnDanger", type: "button", text: "Logout", onclick: async function () {
      await signOutUser();
      await syncAccessState();
      await afterDataChange();
      closeModal(true);
      enforceAccessUI();
    } }),
    el("button", { class: "btn btnPrimary", type: "button", text: "Pay with PayMongo", onclick: submitManualVipRequest })
  ]));

  openModal("Membership Upgrade", wrap, { locked: force });
}

function getOnboardingDone() {
  try { return localStorage.getItem(ONBOARDING_KEY) === "1"; } catch (err) { return true; }
}

function setOnboardingDone() {
  try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch (err) { /* ignore */ }
}

// ---------------------------------------------------------------------
// ONBOARDING FUNNEL: Splash -> Logo/Brand -> Tutorial -> Roles -> Language -> Landing
// A single step-based wizard reusing the existing modal system. Runs once
// automatically on first visit (see boot()), and can always be replayed via
// the hamburger menu ("Paano Gamitin / How it works").
// ---------------------------------------------------------------------
function openOnboardingFunnel(opts) {
  const options = opts || {};
  const steps = ["splash", "audience", "tutorial", "roles", "language", "landing"];
  let stepIndex = 0;

  function renderStep() {
    const key = steps[stepIndex];
    const wrap = el("div", { class: "formGrid" }, []);
    const progress = el("div", { class: "muted", text: "Step " + (stepIndex + 1) + " of " + steps.length });
    wrap.appendChild(progress);

    if (key === "splash") {
      wrap.appendChild(el("div", { class: "notice" }, [
        el("div", { class: "brandMark", style: "width:56px;height:56px;margin:0 auto 10px" }),
        el("div", { class: "itemTitle", text: APP_SHORT_NAME, style: "text-align:center;font-size:20px" }),
        el("div", { class: "muted", text: APP_FULL_NAME, style: "text-align:center" }),
        el("p", { class: "infoText", text: "Ang lahat-lahat na workspace para sa mga Virtual Assistant at Social Media Manager — clients, content, payroll, at collaboration, iisang app lang." })
      ]));
    } else if (key === "audience") {
      const prefs = getPrefs();
      wrap.appendChild(el("div", { class: "itemTitle", text: "Ikaw ba ay Member (VA/Team) o Client?" }));
      wrap.appendChild(el("p", { class: "infoText", text: "Ito ay para lang ma-adjust ang tour — pareho pa ring ligtas at magkasingganda ang app para sa dalawa." }));
      const choiceRow = el("div", { class: "audienceChoiceRow" }, []);
      const makeChoice = function (key2, title, desc) {
        const card = el("button", { class: "audienceCard" + (prefs.onboardingAudience === key2 ? " active" : ""), type: "button" }, [
          el("div", { class: "itemTitle", text: title }),
          el("div", { class: "muted", text: desc })
        ]);
        card.addEventListener("click", function () {
          const p = getPrefs();
          p.onboardingAudience = key2;
          savePrefs(p);
          stepIndex += 1;
          renderStep();
        });
        return card;
      };
      choiceRow.appendChild(makeChoice("member", "Ako ay Member / VA", "Nagtatrabaho ako bilang Virtual Assistant o Social Media Manager gamit ang app na ito."));
      choiceRow.appendChild(makeChoice("client", "Ako ay Client", "Business owner o client ako na nakikipag-collaborate sa isang VA/team."));
      wrap.appendChild(choiceRow);
    } else if (key === "tutorial") {
      wrap.appendChild(el("div", { class: "itemTitle", text: "Paano gamitin (5 hakbang)" }));
      [
        ["1", "Know your client", "Collect niche, offers, audience, brand tone, at goals bago gumawa ng content."],
        ["2", "Plan your content", "Gamitin ang posts, ideas, pillars, at calendar para malaman kung ano ang isusunod."],
        ["3", "Track your work", "Sumulat ng notes, gumawa ng tasks, at i-save ang docs para sa briefs/captions/reports."],
        ["4", "Deliver like a pro", "Panatilihing organisado ang client notes, approvals, at uploads."],
        ["5", "Grow your system", "Gawing SOP/reusable templates ang paulit-ulit na gawain sa Docs tab."]
      ].forEach(function (item) {
        wrap.appendChild(el("div", { class: "infoCard" }, [
          el("div", { class: "infoTitle", text: "Step " + item[0] + " • " + item[1] }),
          el("p", { class: "infoText", text: item[2] })
        ]));
      });
    } else if (key === "roles") {
      wrap.appendChild(el("div", { class: "itemTitle", text: "Mga Roles sa Client Workspace" }));
      wrap.appendChild(el("p", { class: "infoText", text: "Kapag nag-invite ka ng member sa isang client, ito ang apat na antas ng access (base sa aktwal na setup ng Supabase):" }));
      ROLE_INFO.forEach(function (r) {
        wrap.appendChild(el("div", { class: "roleCard" }, [
          el("div", { class: "roleTitle", text: r.title }),
          el("div", { class: "roleDesc", text: r.desc })
        ]));
      });
    } else if (key === "language") {
      wrap.appendChild(el("div", { class: "itemTitle", text: "Piliin ang Wika / Choose Language" }));
      const prefs = getPrefs();
      const current = prefs.appLanguage || "auto";
      const langOptions = [
        ["auto", "Auto-detect"],
        ["english", "English"],
        ["filipino", "Filipino"],
        ["taglish", "Taglish"],
        ["spanish", "Español"],
        ["portuguese", "Português"]
      ];
      const select = el("select", { class: "select", id: "onboardingLangSelect" },
        langOptions.map(function (opt) {
          return el("option", { value: opt[0], text: opt[1] }, []);
        })
      );
      select.value = current;
      wrap.appendChild(el("div", { class: "fieldBlock" }, [select]));
    } else if (key === "landing") {
      wrap.appendChild(el("div", { class: "notice" }, [
        el("div", { class: "itemTitle", text: "Handa ka na! Mag-login o mag-sign up" }),
        el("div", { class: "muted", text: "Isang beses lang ito — mananatili kang naka-login sa device na ito hanggang mag-logout ka. Buksan ulit ang tour na ito anumang oras sa hamburger menu (☰)." })
      ]));

      wrap.appendChild(el("div", { class: "fieldBlock" }, [
        el("div", { class: "label", text: "Email" }),
        el("input", { class: "input", id: "onboardingAuthEmail", type: "email", placeholder: "you@email.com" })
      ]));

      wrap.appendChild(el("div", { class: "fieldBlock" }, [
        el("div", { class: "label", text: "Password" }),
        el("input", { class: "input", id: "onboardingAuthPass", type: "password", placeholder: "password" })
      ]));

      wrap.appendChild(el("div", { class: "actionsRow" }, [
        el("button", { class: "btn btnSoft", type: "button", text: "Sign up", onclick: async function () {
          const email = (getVal("onboardingAuthEmail", "") || "").trim();
          const pass = getVal("onboardingAuthPass", "");
          if (!email || !pass) return alert("Enter both email and password first.");
          const r = await signUp(email, pass);
          if (r) toast("Signup complete. Check email if confirmation is enabled.");
        } }),
        el("button", { class: "btn btnPrimary", type: "button", text: "Login", onclick: async function () {
          const email = (getVal("onboardingAuthEmail", "") || "").trim();
          const pass = getVal("onboardingAuthPass", "");
          if (!email || !pass) return alert("Enter both email and password first.");
          const r = await signIn(email, pass);
          if (!r) return;
          await syncAccessState();
          await afterDataChange();
          setOnboardingDone();
          closeModal(true);
          renderAccountButton();
          toast("Logged in");
        } })
      ]));

      wrap.appendChild(el("div", { class: "actionsRow" }, [
        el("button", { class: "btn btnGhost", type: "button", text: "Skip for now", onclick: function () {
          setOnboardingDone();
          closeModal(true);
          enforceAccessUI();
        } })
      ]));
    }

    const actions = el("div", { class: "actionsRow" }, []);
    if (stepIndex > 0) {
      actions.appendChild(el("button", { class: "btn btnGhost", type: "button", text: "Back", onclick: function () {
        stepIndex -= 1;
        renderStep();
      } }));
    }
    if (stepIndex < steps.length - 1) {
      actions.appendChild(el("button", { class: "btn btnPrimary", type: "button", text: "Next", onclick: function () {
        if (steps[stepIndex] === "language") {
          const sel = getEl("onboardingLangSelect");
          if (sel) {
            const prefs = getPrefs();
            prefs.appLanguage = sel.value;
            savePrefs(prefs);
            applyAppLanguage();
          }
        }
        stepIndex += 1;
        renderStep();
      } }));
    }
    wrap.appendChild(actions);

    openModal("Welcome to " + APP_SHORT_NAME, wrap, { locked: !!options.force });
  }

  renderStep();
}

// ---------------------------------------------------------------------
// HAMBURGER MENU: single consolidated entry point to every destination in
// the app (replaces having to hunt across the top bar + segmented "More"
// nav). Opens as a modal list; tapping an item navigates and closes it.
// ---------------------------------------------------------------------
function openProfileMenu() {
  const wrap = el("div", { class: "formGrid" }, []);
  const prefs = getPrefs();
  const audience = prefs.onboardingAudience === "client" ? "client" : "member";
  const loggedIn = !!(state.access && state.access.user) && state.access.reason !== "auth_required";

  if (!loggedIn) {
    wrap.appendChild(el("div", { class: "notice" }, [
      el("div", { class: "itemTitle", text: "Hindi ka pa naka-login" }),
      el("div", { class: "muted", text: "Mag-login o mag-sign up para ma-save ang iyong workspace at makuha ang lahat ng features." })
    ]));
    wrap.appendChild(el("div", { class: "actionsRow" }, [
      el("button", { class: "btn btnPrimary", type: "button", text: "Login / Sign up", onclick: function () {
        closeModal(true);
        openAuthModal({ force: false });
      } })
    ]));
  } else {
    const planLabel = (state.access.profile && hasVipFeatureAccess()) ? String(state.access.profile.plan || "VIP").toUpperCase() : "FREE";
    wrap.appendChild(el("div", { class: "notice" }, [
      el("div", { class: "itemTitle", text: (state.access.user && state.access.user.email) || "Account" }),
      el("div", { class: "muted", text: planLabel + " • " + (audience === "client" ? "Client" : "Member / VA") })
    ]));
  }

  const menuList = el("div", { class: "list" }, []);
  function menuBtn(label, fn) {
    return el("button", { class: "item", type: "button", style: "width:100%;text-align:left;cursor:pointer", onclick: fn }, [
      el("div", { class: "itemMain" }, [ el("div", { class: "itemTitle", text: label }) ])
    ]);
  }

  menuList.appendChild(menuBtn("Brand Setup / About VA Yarn!", function () { closeModal(true); setView("about"); }));
  menuList.appendChild(menuBtn("Tools Directory", function () { closeModal(true); setView("tools"); }));
  menuList.appendChild(menuBtn(audience === "client" ? "My VA Team" : "My Payroll", function () {
    closeModal(true);
    setView(audience === "client" ? "clients" : "payroll");
  }));
  menuList.appendChild(menuBtn("Tutorial (ulitin ang tour)", function () {
    closeModal(true);
    openOnboardingFunnel({ force: false });
  }));
  menuList.appendChild(menuBtn("Backup / Export", function () { closeModal(true); setView("backup"); }));
  wrap.appendChild(menuList);

  if (loggedIn) {
    wrap.appendChild(el("div", { class: "actionsRow" }, [
      el("button", { class: "btn btnGhost", type: "button", text: "Logout", onclick: async function () {
        await signOutUser();
        closeModal(true);
        await syncAccessState();
        renderAccountButton();
        toast("Na-logout ka na");
      } })
    ]));
  }

  openModal("Profile", wrap, { locked: false });
}


function openAuthModal(opts) {
  const options = opts || {};
  const force = !!options.force;
  const wrap = el("div", { class: "formGrid" }, []);

  if (state.access.user) {
    wrap.appendChild(el("div", { class: "notice" }, [
      el("div", { class: "itemTitle", text: "Session active" }),
      el("div", { class: "muted", text: "You are already signed in on this device." }),
      el("div", { class: "muted", text: state.access.user.email || "Logged in user" }),
      el("div", { class: "muted", text: "This is a one-time login flow. You stay signed in until you log out." })
    ]));

    wrap.appendChild(el("div", { class: "actionsRow" }, [
      el("button", { class: "btn btnSoft", type: "button", text: "Continue", onclick: function () { closeModal(true); } }),
      el("button", { class: "btn btnDanger", type: "button", text: "Logout", onclick: async function () {
        await signOutUser();
        await syncAccessState();
        await afterDataChange();
        closeModal(true);
        enforceAccessUI();
      } })
    ]));

    openModal("Account", wrap, { locked: force });
    return;
  }

  wrap.appendChild(el("div", { class: "notice" }, [
    el("div", { class: "itemTitle", text: "Login required" }),
    el("div", { class: "muted", text: "Sign in once when the website or app opens, then stay logged in on this device." }),
    el("div", { class: "muted", text: "Core workspace stays available after login. VIP unlocks AI Assistant, Calendar, at Clients & Team." })
  ]));

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Email" }),
    el("input", { class: "input", id: "authEmail", type: "email", placeholder: "you@email.com" })
  ]));

  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Password" }),
    el("input", { class: "input", id: "authPass", type: "password", placeholder: "password" })
  ]));

  wrap.appendChild(el("div", { class: "actionsRow" }, [
    el("button", { class: "btn btnSoft", type: "button", text: "Sign up", onclick: async function () {
      const email = (getVal("authEmail", "") || "").trim();
      const pass = getVal("authPass", "");
      if (!email || !pass) return alert("Enter both email and password first.");
      const r = await signUp(email, pass);
      if (r) toast("Signup complete. Check email if confirmation is enabled.");
    } }),
    el("button", { class: "btn btnPrimary", type: "button", text: "Login", onclick: async function () {
      const email = (getVal("authEmail", "") || "").trim();
      const pass = getVal("authPass", "");
      if (!email || !pass) return alert("Enter both email and password first.");
      const r = await signIn(email, pass);
      if (!r) return;
      await syncAccessState();
      await afterDataChange();
      closeModal(true);
      toast("Logged in");
    } })
  ]));

  openModal("Login", wrap, { locked: force });
}

function saveAboutSection() {
  const data = {
    appName: ((getVal("aboutAppName", "") || "").trim() || APP_SHORT_NAME),
    supportEmail: (getVal("aboutSupportEmail", "") || "").trim(),
    supportPhone: (getVal("aboutSupportPhone", "") || "").trim(),
    facebook: (getVal("aboutFacebook", "") || "").trim(),
    instagram: (getVal("aboutInstagram", "") || "").trim(),
    tiktok: (getVal("aboutTiktok", "") || "").trim(),
    whatsapp: (getVal("aboutWhatsapp", "") || "").trim(),
    note: getVal("aboutNote", "")
  };
  saveAboutProfile(data);
  updateBrandHeader();
  renderAbout();
  toast("Contact saved");
}

function saveCreatorDNASection() {
  const data = {
    brandName: (getVal("dnaBrandName", "") || "").trim(),
    audience: (getVal("dnaAudience", "") || "").trim(),
    mission: getVal("dnaMission", ""),
    tone: (getVal("dnaTone", "") || "").trim(),
    contentStyle: (getVal("dnaContentStyle", "") || "").trim(),
    goals: getVal("dnaGoals", ""),
    constraints: getVal("dnaConstraints", ""),
    offers: (getVal("dnaOffers", "") || "").trim(),
    ctaStyle: (getVal("dnaCtaStyle", "") || "").trim(),
    preferredLanguage: (getVal("dnaPreferredLanguage", "") || "").trim()
  };
  saveCreatorDNA(data);
  renderAbout();
  toast("Brand setup saved");
}

function savePreferencesSection() {
  const data = {
    theme: getVal("prefTheme", "dark"),
    appLanguage: getVal("prefAppLanguage", "auto"),
    contentLanguage: ((getVal("prefContentLanguage", "") || "").trim() || "English")
  };
  savePrefs(data);
  applyTheme();
  applyAppLanguage();
  renderAbout();
  toast("Preferences saved");
}

function openQuickAdd() {
  const wrap = el("div", {}, []);
  const box = el("div", { class: "list" }, [
    el("button", { class: "item", type: "button", onclick: function () { closeModal(true); openPostEditor(null); } }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: "New Post" }),
        el("div", { class: "muted", text: "Create + schedule + attach images" })
      ])
    ]),
    el("button", { class: "item", type: "button", onclick: function () { closeModal(true); openIdeaEditor(null); } }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: "New Idea" }),
        el("div", { class: "muted", text: "Quick capture + tags" })
      ])
    ]),
    el("button", { class: "item", type: "button", onclick: function () { closeModal(true); openPillarEditor(null); } }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: "New Pillar" }),
        el("div", { class: "muted", text: "Add category for your content" })
      ])
    ]),
    el("button", { class: "item", type: "button", onclick: function () { closeModal(true); openClientEditor(null); } }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: "New Client" }),
        el("div", { class: "muted", text: "Workspace + participants" })
      ])
    ]),
    el("button", { class: "item", type: "button", onclick: function () { closeModal(true); openTaskEditor(null); } }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: "New Task" }),
        el("div", { class: "muted", text: "Track your SMM to-do work" })
      ])
    ]),
    el("button", { class: "item", type: "button", onclick: function () { closeModal(true); openDocEditor(null); } }, [
      el("div", { class: "itemMain" }, [
        el("div", { class: "itemTitle", text: "New Doc" }),
        el("div", { class: "muted", text: "Create an editable brief, SOP, or caption draft" })
      ])
    ])
  ]);

  wrap.appendChild(el("div", { class: "notice" }, [
    el("div", { class: "itemTitle", text: "Quick Add" }),
    el("div", { class: "muted", text: "Pili ka ng gagawin" })
  ]));
  wrap.appendChild(box);
  openModal("Add", wrap);
}

function openSearch() {
  const wrap = el("div", { class: "formGrid" }, []);
  wrap.appendChild(el("div", { class: "fieldBlock" }, [
    el("div", { class: "label", text: "Search app content" }),
    el("input", { class: "input", id: "searchQ", placeholder: "Type keywords..." })
  ]));

  const results = el("div", { class: "list", id: "searchResults" }, []);
  wrap.appendChild(results);

  function run() {
    const q = (getVal("searchQ", "") || "").trim().toLowerCase();
    results.innerHTML = "";
    if (!q) {
      results.appendChild(buildEmptyState("Type to search", "Search posts, ideas, notes, docs, assets, and clients."));
      return;
    }

    const posts = state.cache.posts
      .filter(function (p) {
        return (((p.title || "") + " " + (p.caption || "") + " " + (p.hashtags || "")).toLowerCase().indexOf(q) !== -1);
      })
      .slice().reverse().slice(0, 12);

    const tasks = state.cache.tasks.filter(function (t) {
      return (((t.title || "") + " " + (t.notes || "") + " " + (t.category || "")).toLowerCase().indexOf(q) !== -1);
    }).slice(0, 6);

    const docs = state.cache.docs.filter(function (d) {
      return (((d.title || "") + " " + (d.content || "") + " " + (d.client || "")).toLowerCase().indexOf(q) !== -1);
    }).slice(0, 6);

    const ideas = state.cache.ideas.filter(function (i) {
      return (((i.title || "") + " " + (i.notes || "") + " " + (i.tags || "")).toLowerCase().indexOf(q) !== -1);
    }).slice(0, 6);

    const assets = state.cache.assets.filter(function (a) {
      return (((a.name || "") + " " + (a.filename || "")).toLowerCase().indexOf(q) !== -1);
    }).slice(0, 6);

    const clientsMatch = state.cache.clients.filter(function (c) {
      return ((c.name || "").toLowerCase().indexOf(q) !== -1);
    }).slice(0, 6);

    if (!posts.length && !tasks.length && !docs.length && !ideas.length && !assets.length && !clientsMatch.length) {
      results.appendChild(buildEmptyState("No results", "Try ibang keyword."));
      return;
    }

    posts.forEach(function (p) { results.appendChild(postRow(p, { onDeleted: run })); });
    tasks.forEach(function (t) {
      results.appendChild(el("div", { class: "item" }, [
        el("div", { class: "itemMain" }, [
          el("div", { class: "itemTitle", text: t.title || "(Untitled task)" }),
          el("div", { class: "muted", text: clampText(t.notes || "", 120) || "Task match" })
        ]),
        el("div", { class: "itemActions" }, [
          el("button", { class: "iconBtn", type: "button", text: "Open", onclick: function () { closeModal(true); setView("notes"); openTaskEditor(t.id); } })
        ])
      ]));
    });
    docs.forEach(function (d) {
      results.appendChild(el("div", { class: "item" }, [
        el("div", { class: "itemMain" }, [
          el("div", { class: "itemTitle", text: d.title || "(Untitled doc)" }),
          el("div", { class: "muted", text: clampText(d.content || "", 120) || "Doc match" })
        ]),
        el("div", { class: "itemActions" }, [
          el("button", { class: "iconBtn", type: "button", text: "Open", onclick: function () { closeModal(true); setView("docs"); openDocEditor(d.id); } })
        ])
      ]));
    });
    ideas.forEach(function (i) {
      results.appendChild(el("div", { class: "item" }, [
        el("div", { class: "itemMain" }, [
          el("div", { class: "itemTitle", text: i.title || "(Untitled idea)" }),
          el("div", { class: "muted", text: clampText(i.notes || "", 120) || "Idea match" })
        ]),
        el("div", { class: "itemActions" }, [
          el("button", { class: "iconBtn", type: "button", text: "Open", onclick: function () { closeModal(true); setView("ideas"); openIdeaEditor(i.id); } })
        ])
      ]));
    });
    assets.forEach(function (a) {
      results.appendChild(el("div", { class: "item" }, [
        el("div", { class: "itemMain" }, [
          el("div", { class: "itemTitle", text: a.name || a.filename || "(Untitled asset)" }),
          el("div", { class: "muted", text: "Asset match" })
        ]),
        el("div", { class: "itemActions" }, [
          el("button", { class: "iconBtn", type: "button", text: "Open", onclick: function () { closeModal(true); setView("assets"); } })
        ])
      ]));
    });
    clientsMatch.forEach(function (c) {
      results.appendChild(el("div", { class: "item" }, [
        el("div", { class: "itemMain" }, [
          el("div", { class: "itemTitle", text: c.name || "(Untitled client)" }),
          el("div", { class: "muted", text: "Client match" })
        ]),
        el("div", { class: "itemActions" }, [
          el("button", { class: "iconBtn", type: "button", text: "Open", onclick: function () { closeModal(true); setView("clients"); } })
        ])
      ]));
    });
  }

  setTimeout(function () {
    bind("searchQ", "input", run);
    run();
  }, 0);

  openModal("Search", wrap);
}

async function afterDataChange() {
  await refreshCache();
  await ensureDefaultPillarsIfEmpty();
  await refreshCache();

  if (state.view === "dashboard") renderDashboard();
  if (state.view === "organize") renderOrganize();
  if (state.view === "notes") renderNotesBoard();
  if (state.view === "docs") renderDocsBoard();
  if (state.view === "calendar") renderCalendar();
  if (state.view === "posts") renderPosts();
  if (state.view === "pillars") renderPillars();
  if (state.view === "ideas") renderIdeas();
  if (state.view === "assets") renderAssets();
  if (state.view === "clients") renderClients();
  if (state.view === "payroll") renderPayrollTab();
  if (state.view === "tutorial") renderTutorial();
  if (state.view === "about") renderAbout();

  renderAccountButton();
}

function wireUI() {
  bind("btnBack", "click", function () { setView("dashboard"); });

  $$(".navItem").forEach(function (b) {
    b.addEventListener("click", function () { setView(b.dataset.nav); });
  });

  $$(".segBtn").forEach(function (b) {
    b.addEventListener("click", function () { setView(b.dataset.seg); });
  });

  bind("modalOverlay", "click", function () { closeModal(); });
  bind("modalClose", "click", function () { closeModal(); });
  bind("btnQuickAdd", "click", openQuickAdd);
  bind("btnSearch", "click", openSearch);
  bind("dashSearchInline", "click", openSearch);
  bind("btnAccount", "click", async function () {
    await syncAccessState();
    openProfileMenu();
  });

  bind("dashAddPost", "click", function () { openPostEditor(null); });
  bind("dashAddIdea", "click", function () { openIdeaEditor(null); });
  bind("dashOpenOrganize", "click", function () { setView("organize"); });
  bind("dashOpenTutorial", "click", function () { setView("tutorial"); });
  bind("saveNotes", "click", saveNotes);
  bind("saveNotesPad", "click", saveNotes);
  bind("goCalendar", "click", function () { setView("calendar"); });
  bind("organizeOpenTask", "click", function () { openTaskEditor(null); });

  bind("calPrev", "click", function () {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() - 1, 1);
    renderCalendar();
  });
  bind("calNext", "click", function () {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + 1, 1);
    renderCalendar();
  });
  bind("calToday", "click", function () {
    state.calendarCursor = new Date();
    renderCalendar();
  });

  bind("newPost", "click", function () { openPostEditor(null); });
  bind("newPillar", "click", function () { openPillarEditor(null); });
  bind("newIdea", "click", function () { openIdeaEditor(null); });
  bind("newClient", "click", function () { openClientEditor(null); });
  bind("joinRoomBtn", "click", function () { openJoinRoomModal(); });
  bind("newPayrollRunBtn", "click", function () { openPayrollRunEditor(); });
  bind("newTaskBtn", "click", function () { openTaskEditor(null); });
  bind("newDocBtn", "click", function () { openDocEditor(null); });
  bind("tutorialCreateTask", "click", function () { openTaskEditor(null, { title: "My beginner SMM setup", category: "Learning" }); });

  bind("postSearch", "input", renderPosts);
  bind("postStatus", "change", renderPosts);
  bind("postPlatform", "change", renderPosts);
  bind("ideaSearch", "input", renderIdeas);
  bind("ideaTagFilter", "change", renderIdeas);
  bind("taskSearch", "input", renderNotesBoard);
  bind("taskStatusFilter", "change", renderNotesBoard);
  bind("docSearch", "input", renderDocsBoard);
  bind("docTypeFilter", "change", renderDocsBoard);

  const assetUpload = getEl("assetUpload");
  if (assetUpload) {
    assetUpload.addEventListener("change", async function (e) {
      const files = e.target.files;
      if (files && files.length) await handleUploadFiles(files);
      e.target.value = "";
    });
  }

  bind("assetStockPhotosBtn", "click", function () { openStockPhotoSearch(null); });

  bind("exportBtn", "click", exportBackup);
  const importFile = getEl("importFile");
  if (importFile) {
    importFile.addEventListener("change", async function (e) {
      const f = e.target.files && e.target.files[0];
      if (f) await importBackup(f);
      e.target.value = "";
    });
  }

  bind("wipeBtn", "click", function () { wipeAllData(true); });
  bind("aiFab", "click", openAiAssistant);
  bind("saveAboutBtn", "click", saveAboutSection);
  bind("saveDnaBtn", "click", saveCreatorDNASection);
  bind("savePrefsBtn", "click", savePreferencesSection);
  bind("aboutUpgradeBtn", "click", function () { openPaywallModal({ force: false }); });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeModal();
  });

  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = function () {
      const prefs = getPrefs();
      if (prefs.theme === "system") applyTheme();
    };
    if (media.addEventListener) media.addEventListener("change", handler);
    else if (media.addListener) media.addListener(handler);
  }
}

async function boot() {
  applyTheme();
  applyAppLanguage();
  updateBrandHeader();

  wireUI();
  loadNotes();

  try {
    state.db = await openDB();
  } catch (err) {
    console.error("openDB failed:", err);
  }

  if (typeof supabaseClient !== "undefined" && supabaseClient.auth && supabaseClient.auth.onAuthStateChange) {
    supabaseClient.auth.onAuthStateChange(async function () {
      await syncAccessState();
      try { await afterDataChange(); } catch (err) { console.error("afterDataChange failed:", err); }
      enforceAccessUI();
    });
  }

  // Resolve login/session status FIRST and show the login prompt immediately —
  // this must not be blocked by (or lost to) any failure further down.
  try {
    await syncAccessState();
  } catch (err) {
    console.error("syncAccessState failed:", err);
  }

  setView("dashboard");
  renderAccountButton();

  if (!getOnboardingDone()) {
    openOnboardingFunnel({ force: true });
  } else {
    enforceAccessUI();
  }

  // Everything below is best-effort: if any of it throws, the login modal
  // above has already been shown, so the user is never left stranded on a
  // silent dashboard with no visible way to sign in.
  try {
    await refreshCache();
    await ensureDefaultPillarsIfEmpty();
    await refreshCache();
  } catch (err) {
    console.error("Data warm-up failed:", err);
  }

  try {
    renderAbout();
  } catch (err) {
    console.error("renderAbout failed:", err);
  }

  enforceAccessUI();

  if (state.access.reason === "active") toast("Ready");
}

boot();
