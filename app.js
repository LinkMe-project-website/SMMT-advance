// VORTEXIA — app.js
// Auth (email+password only), dashboard, meetings, chat, whiteboard, profile.

// ---------------------------------------------------------------------------
// Phase 9 — Dark mode: apply saved preference immediately (before any other
// script runs) so there's no flash of the wrong theme on load.
// ---------------------------------------------------------------------------
(function initTheme() {
  const saved = localStorage.getItem("vortexia-theme"); // "dark" | "light" | null (=follow system)
  if (saved === "dark" || saved === "light") {
    document.documentElement.setAttribute("data-theme", saved);
  }
})();
function applyTheme(mode) {
  // mode: "dark" | "light" | "system"
  if (mode === "system") {
    document.documentElement.removeAttribute("data-theme");
    localStorage.removeItem("vortexia-theme");
  } else {
    document.documentElement.setAttribute("data-theme", mode);
    localStorage.setItem("vortexia-theme", mode);
  }
}
function currentEffectiveThemeIsDark() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// ---------------------------------------------------------------------------
// Phase 9 — lightweight client-side throttle for spam-prone actions
// (creating meetings, posts, listings). This is a UX safety net, not real
// security — a determined client can bypass it by calling the API directly.
// True enforcement needs a server-side check (see phase_9_migration.sql for
// an optional Postgres trigger version of this for meetings).
// ---------------------------------------------------------------------------
const _throttleLastRun = {};
function throttleAction(key, minIntervalMs = 3000) {
  const now = Date.now();
  const last = _throttleLastRun[key] || 0;
  if (now - last < minIntervalMs) {
    showToast("You're doing that a bit fast — give it a second.");
    return false;
  }
  _throttleLastRun[key] = now;
  return true;
}

let currentUser = null;
let currentProfile = null;
let meetingsCache = [];
let plansCache = [];
let activeChatId = null;
let chatThreadParticipantCounts = {};
let activeChatOtherUserId = null;
let chatChannel = null;
let reactionsChannel = null;
let jitsiApi = null;          // active JitsiMeetExternalAPI instance, if a call/meeting is open
let activeCallId = null;      // calls.id of the current voice call, if any (null = video meeting or nothing)
let activeCallRoomId = null;  // meetings.id the current voice call belongs to
let pendingIncomingCall = null; // the calls row shown in the incoming-call banner, if any
let pendingHandoffCall = null;  // the calls row shown in the cross-device handoff banner, if any
let dismissedHandoffCallIds = new Set();
let firedReminders = new Set();

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function showToast(msg, ms = 3200) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => t.classList.add("hidden"), ms);
}

// Pending #14 — Form validation: highlight the actual offending field(s) red,
// not just a toast. markFieldErrors(["mtgTitle"]) highlights + auto-clears on input/focus.
function markFieldErrors(ids) {
  (ids || []).forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.classList.add("fieldError");
    const clear = () => { el.classList.remove("fieldError"); el.removeEventListener("input", clear); el.removeEventListener("focus", clear); };
    el.addEventListener("input", clear, { once: true });
    el.addEventListener("focus", clear, { once: true });
  });
  const first = ids && ids.find((id) => $(id));
  if (first) $(first).scrollIntoView({ behavior: "smooth", block: "center" });
}
function clearFieldErrors(ids) {
  (ids || []).forEach((id) => { const el = $(id); if (el) el.classList.remove("fieldError"); });
}

function authMsg(text, kind) {
  const el = $("authMsg");
  if (!text) { el.innerHTML = ""; return; }
  el.innerHTML = `<div class="authMsg ${kind}">${text}</div>`;
}

function populateTimezones(selectEl) {
  let zones = [];
  try { zones = Intl.supportedValuesOf("timeZone"); } catch (e) {
    zones = ["UTC","Asia/Manila","Asia/Tokyo","Asia/Singapore","Asia/Hong_Kong","Europe/London","Europe/Berlin","America/New_York","America/Los_Angeles","America/Chicago","Australia/Sydney"];
  }
  const guess = Intl.DateTimeFormat().resolvedOptions().timeZone;
  selectEl.innerHTML = zones.map(z => `<option value="${z}" ${z===guess?"selected":""}>${z}</option>`).join("");
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// ---------------------------------------------------------------------------
// First-run flow: Splash -> Onboarding -> Gender select -> Auth
// ---------------------------------------------------------------------------
const LS_ONBOARDED = "mg_onboarded";
const LS_GENDER_DONE = "mg_gender_done";
const LS_GENDER_VALUE = "mg_gender";

function hideAllFirstRunScreens() {
  $("splashWrap").classList.add("hidden");
  $("onboardWrap").classList.add("hidden");
  $("genderWrap").classList.add("hidden");
}

function showAuthScreen() {
  hideAllFirstRunScreens();
  $("authWrap").classList.remove("hidden");
}

function showGenderSelectScreen() {
  hideAllFirstRunScreens();
  $("genderWrap").classList.remove("hidden");
}

function showOnboardingScreen() {
  hideAllFirstRunScreens();
  $("onboardWrap").classList.remove("hidden");
  obIndex = 0;
  updateOnboardUI();
}

function afterOnboardingOrGenderDone() {
  if (!localStorage.getItem(LS_GENDER_DONE)) showGenderSelectScreen();
  else showAuthScreen();
}

// --- Onboarding slide logic ---
let obIndex = 0;
const OB_TOTAL = 3;

function updateOnboardUI() {
  document.querySelectorAll("#onboardDots .onboardDot").forEach((d, i) => d.classList.toggle("active", i === obIndex));
  $("btnOnboardNext").textContent = obIndex === OB_TOTAL - 1 ? "Get Started" : "Next";
}

function scrollToObSlide(i) {
  const track = $("onboardTrack");
  track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" });
  obIndex = i;
  updateOnboardUI();
}

function completeOnboarding() {
  localStorage.setItem(LS_ONBOARDED, "1");
  afterOnboardingOrGenderDone();
}

$("btnOnboardNext").addEventListener("click", () => {
  if (obIndex < OB_TOTAL - 1) scrollToObSlide(obIndex + 1);
  else completeOnboarding();
});
$("btnOnboardSkip").addEventListener("click", completeOnboarding);

let obScrollTimer = null;
$("onboardTrack").addEventListener("scroll", () => {
  clearTimeout(obScrollTimer);
  obScrollTimer = setTimeout(() => {
    const track = $("onboardTrack");
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== obIndex) { obIndex = i; updateOnboardUI(); }
  }, 80);
});

// --- Gender select logic ---
let selectedGender = null;
function selectGenderCard(which) {
  selectedGender = which;
  $("genderCardMale").classList.toggle("selected", which === "male");
  $("genderCardFemale").classList.toggle("selected", which === "female");
}
$("genderCardMale").addEventListener("click", () => selectGenderCard("male"));
$("genderCardFemale").addEventListener("click", () => selectGenderCard("female"));

function finishGenderSelect(skip) {
  if (!skip && selectedGender) localStorage.setItem(LS_GENDER_VALUE, selectedGender);
  localStorage.setItem(LS_GENDER_DONE, "1");
  showAuthScreen();
}
$("btnGenderContinue").addEventListener("click", () => finishGenderSelect(false));
$("btnGenderSkip").addEventListener("click", () => finishGenderSelect(true));

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
$("tabLogin").addEventListener("click", () => switchAuthTab("login"));
$("tabSignup").addEventListener("click", () => switchAuthTab("signup"));

function switchAuthTab(which) {
  authMsg("");
  $("tabLogin").classList.toggle("active", which === "login");
  $("tabSignup").classList.toggle("active", which === "signup");
  $("formLogin").classList.toggle("hidden", which !== "login");
  $("formSignup").classList.toggle("hidden", which !== "signup");
}

$("formLogin").addEventListener("submit", async (e) => {
  e.preventDefault();
  authMsg("");
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  $("btnDoLogin").disabled = true;
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  $("btnDoLogin").disabled = false;
  if (error) { authMsg(error.message, "err"); return; }
  await requireMfaIfNeeded(data.user);
});

$("formSignup").addEventListener("submit", async (e) => {
  e.preventDefault();
  authMsg("");
  const full_name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  $("btnDoSignup").disabled = true;
  const { data, error } = await supabaseClient.auth.signUp({
    email, password,
    options: { data: { full_name } },
  });
  $("btnDoSignup").disabled = false;
  if (error) { authMsg(error.message, "err"); return; }

  if (data.user && !data.session) {
    authMsg("Account created! Please check your email to confirm, then log in.", "ok");
    switchAuthTab("login");
    return;
  }
  if (data.user) {
    // Make sure profile has the chosen full name (trigger creates the row with email only)
    await supabaseClient.from("profiles").update({ full_name }).eq("id", data.user.id);
    await onLoggedIn(data.user);
    notifyAdminsOfNewMember(full_name);
  }
});

$("btnLogout").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  currentUser = null; currentProfile = null;
  $("app").classList.add("hidden");
  $("authWrap").classList.remove("hidden");
});

/* ---------- 2FA login gate: prompt for TOTP code if account requires it ---------- */
async function requireMfaIfNeeded(user) {
  const { data: aal, error: aalErr } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalErr) { console.error("MFA check failed:", aalErr); await onLoggedIn(user); return; }

  if (aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    const { data: factorsData } = await supabaseClient.auth.mfa.listFactors();
    const factor = (factorsData?.totp || []).find(f => f.status === "verified");
    if (!factor) { await onLoggedIn(user); return; }

    openModal(`
      <div class="modalTitle">Enter your 2FA code</div>
      <div class="itemMeta" style="margin-bottom:14px">Open your authenticator app and enter the 6-digit code to finish signing in.</div>
      <div class="field"><input type="text" id="loginTwofaCode" maxlength="6" placeholder="123456" /></div>
      <div id="loginTwofaErr" class="itemMeta" style="color:var(--danger);min-height:16px;margin-top:6px"></div>
      <div style="display:flex;justify-content:flex-end;margin-top:14px">
        <button class="btn btnPrimary" id="loginTwofaSubmit">Verify</button>
      </div>
    `);
    return new Promise((resolve) => {
      $("loginTwofaSubmit").addEventListener("click", async () => {
        const code = $("loginTwofaCode").value.trim();
        if (!/^\d{6}$/.test(code)) { $("loginTwofaErr").textContent = "Enter the 6-digit code."; return; }
        const { data: challengeData, error: challengeErr } = await supabaseClient.auth.mfa.challenge({ factorId: factor.id });
        if (challengeErr) { $("loginTwofaErr").textContent = challengeErr.message; return; }
        const { error: verifyErr } = await supabaseClient.auth.mfa.verify({ factorId: factor.id, challengeId: challengeData.id, code });
        if (verifyErr) { $("loginTwofaErr").textContent = "Incorrect code, try again."; return; }
        closeModal();
        await onLoggedIn(user);
        resolve();
      });
    });
  }

  await onLoggedIn(user);
}

async function onLoggedIn(user) {
  currentUser = user;
  $("authWrap").classList.add("hidden");
  $("app").classList.remove("hidden");
  populateTimezones($("pTimezone"));
  startPresenceHeartbeat();
  await loadPlans();
  await loadCommunityRoles();
  await loadProfile();
  checkVipExpiryWarning();
  await loadMeetings();
  await loadDashboardFeed();
  await loadChatThreads();
  renderActiveStatusBar();
  await loadCallHistory();
  await loadMutedChats(); // Phase 3: load muted chats
  refreshNotifBadge();
  startGlobalCallListener();
  startHandoffCheckLoop();
  startReminderLoop();
  handleVipRedirectParam();
  trackDailyActiveUser();
  loadCommunitySettings();
  maybeShowOnboarding();
}

// ---------------------------------------------------------------------------
// Phase 11 — Purpose Selection ("What brings you to VORTEXIA?")
// Runs before the 3-step tour, once, right after first login/signup.
// Personalizes the dashboard (see renderPurposeRecommendation()).
// ---------------------------------------------------------------------------
const PURPOSE_OPTIONS = [
  { id: "social", emoji: "🌍", label: "Social" },
  { id: "job_seeker", emoji: "💼", label: "Looking for a Job" },
  { id: "hiring", emoji: "🧑‍💼", label: "Hiring" },
  { id: "freelancer", emoji: "🛠️", label: "Freelancer" },
  { id: "business_owner", emoji: "🏢", label: "Business Owner" },
  { id: "creator", emoji: "🎥", label: "Creator" },
  { id: "marketplace", emoji: "🛒", label: "Marketplace" },
  { id: "student", emoji: "🎓", label: "Student" },
];
let selectedPurposes = [];

function maybeShowPurposeSelection() {
  if (!currentProfile) return false;
  if (currentProfile.purposes && currentProfile.purposes.length) return false;
  selectedPurposes = [];
  renderPurposeSelectionStep();
  return true;
}

function renderPurposeSelectionStep() {
  openModal(`
    <div style="text-align:center;padding:10px 4px">
      <div style="font-size:44px;margin-bottom:8px">✨</div>
      <div class="modalTitle" style="margin-bottom:4px">What brings you to VORTEXIA?</div>
      <div class="itemMeta" style="font-size:13px;margin-bottom:16px">Pick as many as apply — this personalizes your Home tab.</div>
      <div id="purposeGrid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px">
        ${PURPOSE_OPTIONS.map(p => `
          <button type="button" class="purposeChip" data-purpose="${p.id}" style="display:flex;align-items:center;gap:8px;padding:12px;border:1px solid var(--border);border-radius:10px;background:transparent;cursor:pointer;text-align:left">
            <span style="font-size:20px">${p.emoji}</span>
            <span style="font-size:13px;font-weight:600">${p.label}</span>
          </button>`).join("")}
      </div>
      <div style="display:flex;justify-content:space-between;gap:10px">
        <button class="btn btnGhost" id="purposeSkip">Skip for now</button>
        <button class="btn btnPrimary" id="purposeContinue">Continue</button>
      </div>
    </div>
  `);

  $("purposeGrid").querySelectorAll(".purposeChip").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.purpose;
      const idx = selectedPurposes.indexOf(id);
      if (idx >= 0) { selectedPurposes.splice(idx, 1); btn.style.borderColor = "var(--border)"; btn.style.background = "transparent"; }
      else { selectedPurposes.push(id); btn.style.borderColor = "var(--blue)"; btn.style.background = "rgba(59,130,246,0.08)"; }
    });
  });

  $("purposeSkip").addEventListener("click", () => finishPurposeSelection([]));
  $("purposeContinue").addEventListener("click", () => finishPurposeSelection(selectedPurposes));
}

async function finishPurposeSelection(purposes) {
  if (currentProfile) currentProfile.purposes = purposes;
  try {
    await supabaseClient.from("profiles").update({ purposes }).eq("id", currentUser.id);
  } catch (e) { /* non-critical */ }
  renderPurposeRecommendation();
  renderOnboardingStep(0); // continue into the existing 3-step tour
}

// Lightweight, visible personalization: a "Recommended for you" strip on the
// dashboard, driven by what the person picked. Safe no-op if the container
// isn't on screen yet (dashboard renders it again on next loadDashboardFeed).
function renderPurposeRecommendation() {
  const el = $("purposeRecommendation");
  if (!el || !currentProfile) return;
  const purposes = currentProfile.purposes || [];
  if (!purposes.length) { el.style.display = "none"; el.innerHTML = ""; return; }

  const recs = [];
  if (purposes.includes("job_seeker")) recs.push({ icon: "📄", text: "Build your resume", action: async () => { await openProfileView(currentUser.id); loadProfileViewTab(currentUser.id, "resume"); } });
  if (purposes.includes("hiring")) recs.push({ icon: "🧑‍💼", text: "Post a job (coming soon)", action: null });
  if (purposes.includes("freelancer") || purposes.includes("business_owner")) recs.push({ icon: "🛒", text: "Browse the Marketplace", action: () => setActiveView("more") });
  if (purposes.includes("creator")) recs.push({ icon: "🎥", text: "Upload a video", action: () => setActiveView("workspace") });
  if (purposes.includes("social") || purposes.includes("student")) recs.push({ icon: "🤝", text: "Explore Communities", action: () => setActiveView("more") });

  if (!recs.length) { el.style.display = "none"; el.innerHTML = ""; return; }
  el.style.display = "";
  el.innerHTML = `
    <div class="itemMeta" style="font-size:11px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Recommended for you</div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">
      ${recs.map((r, i) => `<button type="button" class="btn btnGhost btnSm" data-rec-idx="${i}" style="flex-shrink:0;white-space:nowrap">${r.icon} ${r.text}</button>`).join("")}
    </div>`;
  el.querySelectorAll("[data-rec-idx]").forEach(btn => {
    btn.addEventListener("click", () => { const fn = recs[+btn.dataset.recIdx].action; if (fn) fn(); });
  });
}

// ---------------------------------------------------------------------------
// Phase 9 — first-login onboarding walkthrough (3-step overlay)
// ---------------------------------------------------------------------------
const ONBOARDING_STEPS = [
  { emoji: "👋", title: "Welcome to VORTEXIA", body: "Your all-in-one space for community, meetings, and marketplace — let's take a quick 30-second look around." },
  { emoji: "🤝", title: "Meet your community", body: "Head to the Community tab for Announcements, the Marketplace, Rumble discussions, and Groups you can join or create." },
  { emoji: "🎥", title: "Start your first meeting", body: "Tap the Meetings tab, then + New Meeting to start a 1-on-1, small group, or large room call — right from your browser." },
];
function maybeShowOnboarding() {
  if (!currentProfile || currentProfile.onboarded_at) return;
  if (maybeShowPurposeSelection()) return; // purpose step runs first, then chains into the tour
  renderOnboardingStep(0);
}
function renderOnboardingStep(i) {
  const step = ONBOARDING_STEPS[i];
  const isLast = i === ONBOARDING_STEPS.length - 1;
  openModal(`
    <div style="text-align:center;padding:10px 4px">
      <div style="font-size:52px;margin-bottom:12px">${step.emoji}</div>
      <div class="modalTitle" style="margin-bottom:8px">${escapeHtml(step.title)}</div>
      <div class="itemMeta" style="font-size:14px;line-height:1.5;margin-bottom:20px">${escapeHtml(step.body)}</div>
      <div style="display:flex;justify-content:center;gap:6px;margin-bottom:18px">
        ${ONBOARDING_STEPS.map((_, idx) => `<span style="width:${idx === i ? "18px" : "6px"};height:6px;border-radius:4px;background:${idx === i ? "var(--blue)" : "var(--border)"};transition:.2s"></span>`).join("")}
      </div>
      <div style="display:flex;justify-content:space-between;gap:10px">
        <button class="btn btnGhost" id="obSkip">Skip</button>
        <button class="btn btnPrimary" id="obNext">${isLast ? "Get started" : "Next →"}</button>
      </div>
    </div>
  `);
  $("obSkip").addEventListener("click", finishOnboarding);
  $("obNext").addEventListener("click", () => {
    if (isLast) finishOnboarding();
    else renderOnboardingStep(i + 1);
  });
}
async function finishOnboarding() {
  closeModal();
  if (currentProfile) currentProfile.onboarded_at = new Date().toISOString();
  try {
    await supabaseClient.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", currentUser.id);
  } catch (e) { /* non-critical */ }
}

// ---------------------------------------------------------------------------
// Phase 8A — DAU tracking (feeds the Analytics "Daily Active Users" chart)
// ---------------------------------------------------------------------------
async function trackDailyActiveUser() {
  if (!currentUser) return;
  try {
    await supabaseClient.from("user_sessions")
      .upsert({ user_id: currentUser.id, session_date: new Date().toISOString().slice(0, 10) }, { onConflict: "user_id,session_date" });
  } catch (e) { /* best-effort, never blocks login */ }
}

// ---------------------------------------------------------------------------
// Phase 8A — content approval toggle: cached community-wide setting
// ---------------------------------------------------------------------------
let communitySettingsCache = { require_approval: false };
async function loadCommunitySettings() {
  const { data } = await supabaseClient.from("community_settings").select("require_approval").eq("id", true).single();
  if (data) communitySettingsCache = data;
}
// Layers the admin's "require approval" toggle on top of normal moderation —
// reuses the existing flagged/flag_reason soft-hide pattern so no new UI plumbing is needed.
function applyApprovalGate(mod) {
  if (mod.flagged) return mod; // already flagged by moderation, keep that reason
  if (communitySettingsCache.require_approval) return { flagged: true, reason: "Pending admin approval" };
  return mod;
}

async function loadPlans() {
  const { data, error } = await supabaseClient.from("plans").select("*").order("sort_order", { ascending: true });
  if (error) { console.error(error); return; }
  plansCache = data || [];
}

function handleVipRedirectParam() {
  const params = new URLSearchParams(location.search);
  const vip = params.get("vip");
  if (vip === "success") {
    showToast("Payment received! Your membership will activate shortly.");
    // Pending #13: the PayMongo webhook usually lands a few seconds after this redirect —
    // poll a couple of times so the VIP badge/cache updates without needing a fresh login.
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      await loadProfile();
      await loadCommunityRoles();
      if (attempts >= 5) clearInterval(poll);
    }, 3000);
  } else if (vip === "cancelled") {
    showToast("Checkout cancelled — no charge was made.");
  }
  if (vip) {
    params.delete("vip");
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : ""));
  }
}

async function bootstrapSession() {
  const minSplashDelay = new Promise((res) => setTimeout(res, 2000));
  const { data } = await supabaseClient.auth.getSession();
  await minSplashDelay;
  hideAllFirstRunScreens();

  if (data.session && data.session.user) {
    await requireMfaIfNeeded(data.session.user);
    return;
  }

  if (!localStorage.getItem(LS_ONBOARDED)) showOnboardingScreen();
  else afterOnboardingOrGenderDone();
}
bootstrapSession();

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const VIEW_TITLES = { dashboard: "Home", meetings: "Meetings", chat: "Chats", recordings: "Recordings", notifications: "Notifications", whiteboard: "Whiteboard", profile: "Profile", more: "Community", vip: "VIP Membership", workspace: "Workspace" };

// Per-tab topbar title gradient / accent
const VIEW_TITLE_ACCENTS = {
  dashboard:     { grad: "linear-gradient(90deg,#0A2463,#2563eb)", fill: "transparent", clip: "text" },
  more:          { grad: "linear-gradient(90deg,#0A2463,#0ea5e9)", fill: "transparent", clip: "text" },
  workspace:     { grad: "linear-gradient(90deg,#7c2d12,#ea580c)", fill: "transparent", clip: "text" },
  chat:          { grad: "linear-gradient(90deg,#15803d,#22c55e)", fill: "transparent", clip: "text" },
  notifications: { grad: "linear-gradient(90deg,#a855f7,#ec4899)", fill: "transparent", clip: "text" },
  profile:       { grad: "linear-gradient(90deg,#0A2463,#2563eb)", fill: "transparent", clip: "text" },
};

function setActiveView(view) {
  // Same reasoning as openProfileView: the reels feed is a fixed overlay that
  // doesn't get cleaned up just because a .view section becomes inactive
  // underneath it (position:fixed elements don't care about ancestor scroll
  // context the way people assume — better to be explicit). Close it on every
  // navigation away from Workspace, not just our own close button.
  if (view !== "workspace") closeReelsFeed();
  if (view !== "chat") exitMobileChatView();
  document.querySelectorAll(".navTab").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  $("view" + view.charAt(0).toUpperCase() + view.slice(1)).classList.add("active");
  $("pageTitle").textContent = VIEW_TITLES[view] || view;

  // Apply per-tab title accent
  const titleEl = $("pageTitle");
  const accent = VIEW_TITLE_ACCENTS[view];
  if (accent) {
    titleEl.style.setProperty("--titleGrad", accent.grad);
    titleEl.style.setProperty("--titleClip", accent.clip);
    titleEl.style.setProperty("--titleFill", accent.fill);
  } else {
    titleEl.style.removeProperty("--titleGrad");
    titleEl.style.removeProperty("--titleClip");
    titleEl.style.removeProperty("--titleFill");
  }

  if (view === "profile") { $("pageSubtitle").textContent = "Account & settings"; loadMyPosts(); loadTimeline(); }
  else if (view === "vip") $("pageSubtitle").textContent = "Plans, benefits & payment";
  else if (view === "workspace") { $("pageSubtitle").textContent = "Your videos & creative feed"; loadWorkspace(); }
  else if (view === "notifications") { $("pageSubtitle").textContent = ""; loadNotifications(); }
  else if (view === "recordings") { $("pageSubtitle").textContent = ""; renderRecordingsList(); }
  else if (view === "dashboard") { $("pageSubtitle").textContent = ""; loadDashboardFeed(); loadCommunityRecommendations(); }
  else if (view === "more") { $("pageSubtitle").textContent = "Marketplace, forum & announcements"; loadFeed(); loadMarketplaceUI(); loadForum(); loadCommunityStats(); }
  else if (view === "chat") {
    // [BUG FIX — July 18] loadChatThreads() used to only ever run once, at
    // login (onLoggedIn). Opening the Chats tab afterwards just re-showed
    // whatever was cached from that single load — new chats/messages that
    // arrived since then (or a slow/failed initial load) left the tab stuck
    // showing "No conversations yet" even when real rooms existed in the
    // DB. Fix: refresh every time the tab is opened, like every other tab.
    $("pageSubtitle").textContent = "";
    loadChatThreads();
  }
  else $("pageSubtitle").textContent = "";
  if (view === "whiteboard" && !wbRoomId) renderWhiteboardPicker();
}

document.getElementById("navTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".navTab");
  if (!btn) return;
  closeTopMenu();
  setActiveView(btn.dataset.view);
});

$("btnProfileTop").addEventListener("click", () => { setActiveView("profile"); closeTopMenu(); });
$("btnVipTop").addEventListener("click", () => { setActiveView("vip"); closeTopMenu(); });
$("planBadge").addEventListener("click", () => { setActiveView("vip"); closeTopMenu(); });

function closeTopMenu() {
  $("topMenuOverlay").classList.add("hidden");
  $("btnMenuTop").setAttribute("aria-expanded", "false");
}
$("btnMenuTop").addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = !$("topMenuOverlay").classList.contains("hidden");
  $("topMenuOverlay").classList.toggle("hidden");
  $("btnMenuTop").setAttribute("aria-expanded", isOpen ? "false" : "true");
});
$("topMenuOverlay").addEventListener("click", (e) => {
  if (e.target.id === "topMenuOverlay") closeTopMenu();
});

$("btnSettingsTop").addEventListener("click", () => {
  setActiveView("profile");
  closeTopMenu();
  setTimeout(() => $("settingsCard")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
});

function updateDashboardSubtitle() {
  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  $("pageSubtitle").textContent = `${greeting} • ${today}`;
}

$("qaSchedule").addEventListener("click", () => setActiveView("meetings"));
$("qaRecordings").addEventListener("click", () => setActiveView("recordings"));
$("qaInstant").addEventListener("click", startInstantMeeting);
$("backFromMeetings").addEventListener("click", () => setActiveView("dashboard"));
$("backFromRecordings").addEventListener("click", () => setActiveView("dashboard"));
$("backFromVip").addEventListener("click", () => setActiveView("profile"));

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
async function loadProfile() {
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", currentUser.id).single();
  if (error) { console.error(error); return; }
  currentProfile = data;
  recoLoaded = false; // reset so recommendations refresh with new profile data
  renderProfile();
  renderPurposeRecommendation();
}

function renderProfile() {
  const p = currentProfile;
  const membership = computeMembershipStatus(p);
  const isVip = membership.state === "trialing" || membership.state === "active";
  // Enforce theme gating here too: if VIP lapsed since the theme was picked, fall back to default.
  applyAccentTheme(isVip ? (p.accent_theme || "default") : "default");
  $("dashName").textContent = p.full_name || "Welcome";
  $("dashEmail").textContent = p.email || "";
  const initials = (p.full_name || "").trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  $("dashAvatarInitial").textContent = initials || "🙂";
  // Topbar hamburger-menu profile avatar chip: show photo if available, else initials
  const topBtn = $("topProfileAvatar");
  if (p.avatar_url) {
    topBtn.innerHTML = `<img loading="lazy" src="${escapeHtml(p.avatar_url)}" alt="${escapeHtml(initials)}" />`;
  } else {
    topBtn.innerHTML = `<span id="topAvatarInitial">${escapeHtml(initials || "👤")}</span>`;
  }
  $("pName").value = p.full_name || "";
  $("pBio").value = p.bio || "";
  $("pEmail").value = p.email || "";
  $("pContact").value = p.contact_info || "";
  $("pTimezone").value = p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  $("pLanguage").value = p.language || "en";
  editingSkills = [...(p.skills || [])];
  renderSkillsEditor();
  // Profile flair: VIP-only — show field if VIP, populate if value exists
  const flairWrap = $("flairFieldWrap");
  if (flairWrap) {
    flairWrap.style.display = isVip ? "" : "none";
    if ($("pFlair")) $("pFlair").value = p.profile_flair || "";
  }

  [ "planBadge", "dashPlanBadge", "profilePlanBadge" ].forEach(id => {
    const el = $(id);
    el.textContent = isVip ? "👑 VIP Verified" : "Free";
    el.className = "badge " + (isVip ? "badgeVip" : "badgeFree");
  });
  $("profilePlanBadge").classList.remove("hidden");

  // Profile header: name, bio, avatar, cover, role badge
  $("profileHeaderName").innerHTML = renderVipName(p.full_name, p);
  $("profileHeaderBio").textContent = p.bio || "";
  const repBadgeEl = $("profileRepBadge");
  if (repBadgeEl) { repBadgeEl.innerHTML = renderReputationBadge(p.reputation_tier); repBadgeEl.classList.remove("hidden"); }
  const skillsRowEl = $("profileSkillsRow");
  if (skillsRowEl) skillsRowEl.innerHTML = renderSkillChips(p.skills, false);
  updateProfileCompleteness(p);
  if (p.avatar_url) {
    $("profileAvatarImg").src = p.avatar_url;
    $("profileAvatarImg").classList.remove("hidden");
    $("profileAvatarBig").classList.add("hidden");
    $("profileAvatarImg").style.cursor = "pointer";
    $("profileAvatarImg").onclick = () => openPhotoLightbox(p.avatar_url);
  } else {
    $("profileAvatarImg").classList.add("hidden");
    $("profileAvatarBig").classList.remove("hidden");
    $("profileAvatarBig").textContent = initials || "🙂";
  }
  if (p.cover_photo_url) {
    $("profileCoverImg").src = p.cover_photo_url;
    $("profileCoverImg").classList.remove("hidden");
    $("profileCoverPlaceholder").classList.add("hidden");
    $("profileCoverImg").style.cursor = "pointer";
    $("profileCoverImg").onclick = () => openPhotoLightbox(p.cover_photo_url);
  } else {
    $("profileCoverImg").classList.add("hidden");
    $("profileCoverPlaceholder").classList.remove("hidden");
  }
  const myRole = (p.role === "founder") ? "founder" : getUserRoleLabel(p.id);
  const roleBadgeHtml = getRoleBadgeHtml(myRole);
  $("profileRoleBadge").innerHTML = roleBadgeHtml;
  $("profileRoleBadge").classList.toggle("hidden", !roleBadgeHtml);

  loadFollowStats();

  renderAiCompanion(isVip);
  const mDurationEl = $("mDuration"), mDurationHintEl = $("mDurationHint");
  if (mDurationEl && mDurationHintEl) {
    mDurationEl.max = isVip ? 600 : 40;
    mDurationHintEl.textContent = isVip
      ? "👑 VIP: no meeting length limit."
      : "Free plan: capped at 40 minutes. Upgrade to VIP for unlimited meetings.";
  }
  renderMembershipSection(membership);

  const quotaBytes = isVip ? null : 1024 * 1024 * 1024; // 1GB free tier
  const used = p.storage_used_bytes || 0;
  const usedMb = (used / (1024*1024)).toFixed(1);
  if (quotaBytes) {
    const pct = Math.min(100, (used / quotaBytes) * 100);
    $("storageBar").style.width = pct + "%";
    $("storageLabel").textContent = `${usedMb} MB of 1 GB used`;
  } else {
    $("storageBar").style.width = "8%";
    $("storageLabel").textContent = `${usedMb} MB used • Unlimited (VIP)`;
  }
}

function updateProfileCompleteness(p) {
  const bar = $("profileCompletenessBar"), label = $("profileCompletenessLabel");
  if (!bar || !label) return;
  const checks = [p.full_name, p.bio, p.avatar_url, p.cover_photo_url, p.contact_info, (p.skills && p.skills.length)];
  const filled = checks.filter(Boolean).length;
  const pct = Math.round((filled / checks.length) * 100);
  bar.style.width = pct + "%";
  label.textContent = pct >= 100 ? "Profile 100% complete 🎉" : `Profile ${pct}% complete — add ${!p.skills?.length ? "skills" : !p.contact_info ? "contact info" : "more details"} to reach ${Math.min(100, pct + 20)}%`;
}

let editingSkills = [];
function renderSkillsEditor() {
  const el = $("pSkillsChips");
  if (!el) return;
  el.innerHTML = renderSkillChips(editingSkills, true) || `<span class="itemMeta">No skills added yet.</span>`;
  el.querySelectorAll("[data-remove-skill]").forEach(btn => {
    btn.addEventListener("click", () => {
      editingSkills = editingSkills.filter(s => s !== btn.dataset.removeSkill);
      renderSkillsEditor();
    });
  });
}
if ($("btnAddSkill")) {
  $("btnAddSkill").addEventListener("click", () => {
    const input = $("pSkillInput");
    const val = input.value.trim();
    if (!val) return;
    if (editingSkills.length >= 10) { showToast("Max 10 skills — remove one first."); return; }
    if (editingSkills.some(s => s.toLowerCase() === val.toLowerCase())) { showToast("Already added."); input.value = ""; return; }
    editingSkills.push(val);
    input.value = "";
    renderSkillsEditor();
  });
  $("pSkillInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); $("btnAddSkill").click(); }
  });
}

$("btnSaveProfile").addEventListener("click", async () => {
  const membership = computeMembershipStatus(currentProfile || {});
  const isVip = membership.state === "trialing" || membership.state === "active";
  const updates = {
    full_name: $("pName").value.trim(),
    bio: $("pBio").value.trim(),
    contact_info: $("pContact").value.trim(),
    timezone: $("pTimezone").value,
    language: $("pLanguage").value,
    skills: editingSkills,
    updated_at: new Date().toISOString(),
  };
  // Profile flair: only save if VIP (field is hidden for free users, but guard server-side too)
  if (isVip && $("pFlair")) {
    updates.profile_flair = $("pFlair").value.trim().slice(0, 60) || null;
  }
  const { error } = await supabaseClient.from("profiles").update(updates).eq("id", currentUser.id);
  if (error) { showToast("Could not save profile: " + error.message); return; }
  await supabaseClient.rpc("recalc_reputation", { p_user_id: currentUser.id });
  showToast("Profile saved.");
  await loadProfile();
  await loadCommunityRoles(); // Pending #13: keep the shared VIP/role cache in sync, not just on login
});

// ---------------------------------------------------------------------------
// Profile: cover photo & avatar upload (Supabase Storage 'assets' bucket)
// ---------------------------------------------------------------------------
// Full-screen photo viewer — tap any avatar/cover photo to see it full-size,
// instead of only ever seeing it cropped into a small circle/banner.
function openPhotoLightbox(url) {
  if (!url) return;
  const overlay = document.createElement("div");
  overlay.className = "photoLightboxOverlay";
  overlay.innerHTML = `
    <button class="photoLightboxClose" aria-label="Close">✕</button>
    <img src="${escapeHtml(url)}" alt="" class="photoLightboxImg" />
  `;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector(".photoLightboxClose").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
}

async function uploadProfileImage(file, kind) {
  if (!file) return null;
  // Some Android gallery/camera apps (and HEIC files in particular) hand us
  // a File with an EMPTY file.type — "".startsWith("image/") is always
  // false, so this used to reject the file and return BEFORE the upload
  // request ever reached Storage. That silent early-exit matches exactly
  // what was seen in FE-4 (no new storage.objects rows at all). Fix: if
  // file.type is blank, fall back to checking the file extension instead
  // of assuming it isn't an image.
  const looksLikeImageExt = /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(file.name || "");
  if (file.type && !file.type.startsWith("image/") && !looksLikeImageExt) {
    showToast("Please choose an image file.");
    return null;
  }
  if (!file.type && !looksLikeImageExt) {
    showToast("Please choose an image file.");
    return null;
  }
  if (file.size > 25 * 1024 * 1024) { showToast("Image is too large (max 25MB)."); return null; }

  // [BUG FIX — July 18, part 2] Confirmed live: "Upload failed: new row
  // violates row-level security policy" on avatar/cover upload. Checked the
  // actual RLS policy + bucket config in the DB — both are correct (the
  // storage path userId/kind/filename matches the policy's expected
  // auth.uid() folder check exactly). That means the policy isn't really
  // the problem — a stale/expired session at the moment of upload makes
  // auth.uid() resolve to NULL inside the RLS check, which LOOKS identical
  // to a permissions error but is really a client-side auth-timing issue.
  // Fix: force a fresh session read right before the upload, so a genuinely
  // expired session fails with a clear, actionable message instead of a
  // confusing "row-level security" error.
  const { data: sessionData, error: sessionErr } = await supabaseClient.auth.getSession();
  if (sessionErr || !sessionData?.session) {
    showToast("Your session expired — please log out and back in, then try again.");
    return null;
  }

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${currentUser.id}/${kind}/${Date.now()}.${ext}`;
  const { error } = await supabaseClient.storage.from("assets").upload(path, file, { upsert: true });
  if (error) {
    // [FE-4] Log to browser console so may-ari can see exact Supabase error in DevTools/phone browser
    console.error("[FE-4 uploadProfileImage] Supabase Storage error:", error);
    if (/row-level security/i.test(error.message || "")) {
      showToast("Upload blocked by a security check — try logging out and back in. If it keeps happening, send this to the developer (see console log).");
    } else {
      showToast("Upload failed: " + error.message);
    }
    return null;
  }
  const { data } = supabaseClient.storage.from("assets").getPublicUrl(path);
  return data.publicUrl;
}

$("btnEditAvatar").addEventListener("click", () => $("avatarFileInput").click());
$("btnEditCover").addEventListener("click", () => $("coverFileInput").click());

$("avatarFileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  showToast("Uploading avatar…");
  const url = await uploadProfileImage(file, "avatar");
  if (!url) return;
  const { error } = await supabaseClient.from("profiles").update({ avatar_url: url }).eq("id", currentUser.id);
  if (error) { showToast("Could not save avatar: " + error.message); return; }
  showToast("Avatar updated!");
  await loadProfile();
});

$("coverFileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  showToast("Uploading cover photo…");
  const url = await uploadProfileImage(file, "cover");
  if (!url) return;
  const { error } = await supabaseClient.from("profiles").update({ cover_photo_url: url }).eq("id", currentUser.id);
  if (error) { showToast("Could not save cover photo: " + error.message); return; }
  showToast("Cover photo updated!");
  await loadProfile();
});

// ---------------------------------------------------------------------------
// Profile: followers / following stats + lists
// ---------------------------------------------------------------------------
async function loadFollowStats() {
  if (!currentUser) return;
  // [BUG FIX — July 18] This used to read from a legacy "followers" table
  // (following_id/follower_id) that nothing else in the app writes to
  // anymore — every follow/unfollow action writes to "follows"
  // (follower_id/followee_id) instead, so "followers" silently drifted out
  // of sync with reality (confirmed live in DB: both tables had different,
  // stale row sets). Fix: read from "follows" everywhere, matching every
  // other follow-related query in this file.
  const [{ count: followersCount }, { count: followingCount }] = await Promise.all([
    supabaseClient.from("follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", currentUser.id),
    supabaseClient.from("follows").select("follower_id", { count: "exact", head: true }).eq("follower_id", currentUser.id),
  ]);
  $("statFollowers").textContent = followersCount || 0;
  $("statFollowing").textContent = followingCount || 0;
}

async function openFollowListModal(type) {
  // type: 'followers' | 'following'
  // [BUG FIX — July 18] Same root cause as loadFollowStats above — this
  // used to query the orphaned "followers" table (following_id/follower_id)
  // instead of "follows" (follower_id/followee_id), which every actual
  // follow/unfollow action in the app writes to. That mismatch is why the
  // modal could spin on "Loading…"/show empty even when real follow data
  // existed. Fix: use "follows" + its real columns.
  const filterCol = type === "followers" ? "followee_id" : "follower_id";
  const selectCol = type === "followers" ? "follower_id" : "followee_id";
  const title = type === "followers" ? "Followers" : "Following";

  openModal(`<div class="modalTitle">${title}</div><div class="list" id="followListModalBody"><div class="emptyState">Loading…</div></div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>`);
  $("modalCancel").addEventListener("click", closeModal);

  let links, error;
  try {
    ({ data: links, error } = await withTimeout(
      supabaseClient.from("follows").select(selectCol).eq(filterCol, currentUser.id),
      8000, `Your ${title.toLowerCase()} list`
    ));
  } catch (timeoutErr) {
    $("followListModalBody").innerHTML = `<div class="emptyState">${escapeHtml(timeoutErr.message)}</div>`;
    return;
  }
  const body = $("followListModalBody");
  if (error || !links || !links.length) {
    body.innerHTML = `<div class="emptyState">No ${title.toLowerCase()} yet.</div>`;
    return;
  }
  const ids = links.map(l => l[selectCol]);
  const { data: profilesData } = await supabaseClient.from("profiles").select("id, full_name, avatar_url, role, is_online, plan, vip_status, vip_until, trial_ends_at").in("id", ids);
  if (!profilesData || !profilesData.length) {
    body.innerHTML = `<div class="emptyState">No ${title.toLowerCase()} yet.</div>`;
    return;
  }
  body.innerHTML = profilesData.map(u => {
    const initials = (u.full_name || "").trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase() || "🙂";
    const avatarHtml = u.avatar_url
      ? `<img loading="lazy" src="${escapeHtml(u.avatar_url)}" style="width:38px;height:38px;border-radius:50%;object-fit:cover" />`
      : `<div class="listAvatar">${initials}</div>`;
    const roleLabel = u.role === "founder" ? "founder" : getUserRoleLabel(u.id);
    return `<div class="listItem followListRow" data-user-id="${u.id}">
      <div style="position:relative;flex-shrink:0">
        ${avatarHtml}
        <span class="onlineDot ${u.is_online ? "" : "hidden"}"></span>
      </div>
      <div style="flex:1;min-width:0">
        <div class="itemTitle">${renderVipName(u.full_name, u)}</div>
        <div class="itemMeta">${u.is_online ? "🟢 Online" : "Offline"}</div>
        ${roleLabel ? getRoleBadgeHtml(roleLabel) : ""}
      </div>
      <button class="btn btnGhost btnSm followRowMsgBtn" data-msg-user="${u.id}" title="Message">💬</button>
    </div>`;
  }).join("");
  body.querySelectorAll(".followListRow").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".followRowMsgBtn")) return;
      closeModal();
      openProfileView(row.dataset.userId);
    });
  });
  body.querySelectorAll(".followRowMsgBtn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      closeModal();
      setActiveView("chat");
      await createOrStartChat(btn.dataset.msgUser);
    });
  });
}

$("btnEditProfileToggle").addEventListener("click", () => {
  const card = $("personalDetailsCard");
  const opening = card.classList.contains("hidden");
  card.classList.toggle("hidden");
  if (opening) card.scrollIntoView({ behavior: "smooth", block: "start" });
});
$("btnEditProfilePencil").addEventListener("click", () => $("btnEditProfileToggle").click());

// Settings overlay (opened via the ☰ hamburger on the cover photo)
$("btnOpenSettings").addEventListener("click", () => $("settingsOverlay").classList.remove("hidden"));
$("btnCloseSettings").addEventListener("click", () => $("settingsOverlay").classList.add("hidden"));

// Cover photo quick action row: Messages / Dashboard / Friends
$("btnProfileQuickMessage").addEventListener("click", () => setActiveView("chat"));
$("btnProfileQuickDashboard").addEventListener("click", () => setActiveView("dashboard"));
$("btnProfileQuickFriends").addEventListener("click", () => openFollowListModal("following"));

$("btnShowFollowers").addEventListener("click", () => openFollowListModal("followers"));
$("btnShowFollowing").addEventListener("click", () => openFollowListModal("following"));
$("btnShowMyPosts").addEventListener("click", () => $("myPostsList")?.scrollIntoView({ behavior: "smooth", block: "start" }));

// ---------------------------------------------------------------------------
// Profile: share / copy link
// ---------------------------------------------------------------------------
function getProfileShareUrl() {
  const id = currentProfile?.mg_id || currentUser?.id || "";
  return `${location.origin}${location.pathname}?profile=${encodeURIComponent(id)}`;
}

$("btnShareProfile").addEventListener("click", async () => {
  const url = getProfileShareUrl();
  if (navigator.share) {
    try { await navigator.share({ title: "My VORTEXIA profile", url }); } catch (e) { /* user cancelled */ }
  } else {
    try { await navigator.clipboard.writeText(url); showToast("Profile link copied!"); }
    catch (e) { showToast(url); }
  }
});

$("btnCopyProfileLink").addEventListener("click", async () => {
  const url = getProfileShareUrl();
  try { await navigator.clipboard.writeText(url); showToast("Profile link copied!"); }
  catch (e) { showToast(url); }
});

// ---------------------------------------------------------------------------
// Profile: manage posts (marketplace + rumble)
// ---------------------------------------------------------------------------
let managePostsActiveTab = "marketplace";

async function loadMyPosts(tab) {
  if (tab) managePostsActiveTab = tab;
  const list = $("myPostsList");
  if (!list || !currentUser) return;
  list.innerHTML = `<div class="emptyState">Loading…</div>`;

  if (managePostsActiveTab === "marketplace") {
    const { data, error } = await supabaseClient.from("marketplace_listings")
      .select("*").eq("posted_by", currentUser.id).order("created_at", { ascending: false });
    const total = (data || []).length;
    $("statMyPosts").textContent = total + (await countMyRumblePosts());
    if (error || !data || !data.length) { list.innerHTML = `<div class="emptyState">No marketplace listings yet.</div>`; return; }
    list.innerHTML = data.map(l => `
      <div class="listItem">
        <div style="flex:1;min-width:0">
          <div class="itemTitle">${escapeHtml(l.title)}</div>
          <div class="itemMeta">${l.price != null ? "₱" + Number(l.price).toLocaleString() : ""} • ${escapeHtml(l.status || "open")} • ${fmtDate(l.created_at)}</div>
        </div>
        <button class="btn btnGhost btnSm btnDanger" data-del-mk="${l.id}">Delete</button>
      </div>`).join("");
    list.querySelectorAll("[data-del-mk]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this listing?")) return;
        await supabaseClient.from("marketplace_listings").delete().eq("id", btn.dataset.delMk);
        showToast("Listing deleted.");
        loadMyPosts();
      });
    });
  } else {
    const { data, error } = await supabaseClient.from("forum_posts")
      .select("*").eq("author_id", currentUser.id).order("created_at", { ascending: false });
    const total = (data || []).length;
    $("statMyPosts").textContent = (await countMyMarketplacePosts()) + total;
    if (error || !data || !data.length) { list.innerHTML = `<div class="emptyState">No Rumble threads yet.</div>`; return; }
    list.innerHTML = data.map(t => `
      <div class="listItem">
        <div style="flex:1;min-width:0">
          <div class="itemTitle">${escapeHtml(t.title)}</div>
          <div class="itemMeta">❤️ ${t.likes_count || 0} • 💬 ${t.reply_count || 0} • ${fmtDate(t.created_at)}</div>
        </div>
        <button class="btn btnGhost btnSm btnDanger" data-del-rb="${t.id}">Delete</button>
      </div>`).join("");
    list.querySelectorAll("[data-del-rb]").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this thread?")) return;
        await supabaseClient.from("forum_posts").delete().eq("id", btn.dataset.delRb);
        showToast("Thread deleted.");
        loadMyPosts();
      });
    });
  }
}

async function countMyMarketplacePosts() {
  const { count } = await supabaseClient.from("marketplace_listings").select("id", { count: "exact", head: true }).eq("posted_by", currentUser.id);
  return count || 0;
}
async function countMyRumblePosts() {
  const { count } = await supabaseClient.from("forum_posts").select("id", { count: "exact", head: true }).eq("author_id", currentUser.id);
  return count || 0;
}

// ---------------------------------------------------------------------------
// Profile: Timeline (Posts / Photos / Videos / Memories) — Facebook-style
// ---------------------------------------------------------------------------
let timelineActiveTab = "posts";
let timelineMkCache = [];

async function loadTimeline(tab) {
  if (tab) timelineActiveTab = tab;
  const body = $("timelineBody");
  if (!body || !currentUser) return;
  body.innerHTML = `<div class="emptyState">Loading…</div>`;

  if (timelineActiveTab === "posts") {
    const [{ data: mkData }, { data: rbData }] = await Promise.all([
      supabaseClient.from("marketplace_listings").select("*").eq("posted_by", currentUser.id).order("created_at", { ascending: false }),
      supabaseClient.from("forum_posts").select("*").eq("author_id", currentUser.id).order("created_at", { ascending: false }),
    ]);
    timelineMkCache = mkData || [];
    const combined = [
      ...(mkData || []).map(l => ({ ...l, _type: "marketplace" })),
      ...(rbData || []).map(t => ({ ...t, _type: "rumble" })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!combined.length) { body.innerHTML = `<div class="emptyState">No posts yet. Share something in Marketplace or Rumble!</div>`; return; }

    body.innerHTML = combined.map(post => {
      if (post._type === "rumble") {
        return `
          <div class="timelineCard">
            <div class="timelineCardHead">🔥 Rumble • ${fmtDate(post.created_at)}</div>
            <div class="itemTitle">${escapeHtml(post.title)}</div>
            <div class="itemMeta" style="margin:4px 0 10px">${escapeHtml((post.body || "").slice(0, 160))}</div>
            <div class="timelineActions">
              <button class="timelineActionBtn" data-tl-like="${post.id}">👍 Like (${post.likes_count || 0})</button>
              <button class="timelineActionBtn" data-tl-comment="${post.id}">💬 Comment (${post.reply_count || 0})</button>
              <button class="timelineActionBtn" data-tl-share="1">↗️ Share</button>
            </div>
          </div>`;
      }
      return `
        <div class="timelineCard">
          <div class="timelineCardHead">🛍️ Marketplace • ${fmtDate(post.created_at)}</div>
          <div class="itemTitle">${escapeHtml(post.title)}</div>
          <div class="itemMeta" style="margin:4px 0 10px">${post.price != null ? "₱" + Number(post.price).toLocaleString() : ""} • ${escapeHtml(post.status || "open")}</div>
          <div class="timelineActions">
            <button class="timelineActionBtn" data-tl-view-mk="${post.id}">👁️ View</button>
            <button class="timelineActionBtn" data-tl-share="1">↗️ Share</button>
          </div>
        </div>`;
    }).join("");

    body.querySelectorAll("[data-tl-like]").forEach(btn => btn.addEventListener("click", async () => { await likeThread(btn.dataset.tlLike); loadTimeline(); }));
    body.querySelectorAll("[data-tl-comment]").forEach(btn => {
      const post = (rbData || []).find(p => p.id === btn.dataset.tlComment);
      if (post) btn.addEventListener("click", () => openThreadReplies(post.id, post));
    });
    body.querySelectorAll("[data-tl-view-mk]").forEach(btn => {
      const listing = timelineMkCache.find(l => l.id === btn.dataset.tlViewMk);
      if (listing) btn.addEventListener("click", () => openMarketplaceDetail(listing));
    });
    body.querySelectorAll("[data-tl-share]").forEach(btn => btn.addEventListener("click", async () => {
      const url = getProfileShareUrl();
      try { await navigator.clipboard.writeText(url); showToast("Link copied!"); }
      catch (e) { showToast(url); }
    }));

  } else if (timelineActiveTab === "photos") {
    const { data: mkData } = await supabaseClient.from("marketplace_listings").select("photos").eq("posted_by", currentUser.id);
    const photos = [];
    if (currentProfile?.cover_photo_url) photos.push(currentProfile.cover_photo_url);
    if (currentProfile?.avatar_url) photos.push(currentProfile.avatar_url);
    (mkData || []).forEach(l => (l.photos || []).forEach(p => { if (p) photos.push(p); }));
    if (!photos.length) { body.innerHTML = `<div class="emptyState">No photos yet.</div>`; return; }
    body.innerHTML = `<div class="timelinePhotoGrid">${photos.map(p => `<img loading="lazy" src="${escapeHtml(p)}" class="timelinePhotoThumb" />`).join("")}</div>`;

  } else if (timelineActiveTab === "videos") {
    body.innerHTML = `<div class="emptyState">No videos yet — video posts are coming soon.</div>`;

  } else {
    body.innerHTML = `<div class="emptyState">Memories will appear here as your account grows — coming soon.</div>`;
  }
}

$("timelineTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".subTabBtn");
  if (!btn) return;
  $("timelineTabs").querySelectorAll(".subTabBtn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  loadTimeline(btn.dataset.tltab);
});

$("managePostsTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".subTabBtn");
  if (!btn) return;
  $("managePostsTabs").querySelectorAll(".subTabBtn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  loadMyPosts(btn.dataset.mptab);
});

// Phase 9 — Dark mode toggle
const darkModeToggle = $("toggleDarkMode");
if (darkModeToggle) {
  darkModeToggle.checked = currentEffectiveThemeIsDark();
  darkModeToggle.addEventListener("change", () => {
    applyTheme(darkModeToggle.checked ? "dark" : "light");
  });
}

$("btnAccount").addEventListener("click", () => {
  const p = currentProfile || {};
  const membership = computeMembershipStatus(p);
  const isVip = membership.state === "trialing" || membership.state === "active";
  openModal(`
    <div class="modalTitle">Account</div>
    <div class="listItem"><div class="itemTitle" style="font-size:13px">MG ID</div><span class="badge">${escapeHtml(p.mg_id || "—")}</span></div>
    ${isVip ? `
    <div class="field" style="margin-top:8px">
      <label>Custom MG ID <span class="badge badgeVip" style="font-size:10px">VIP</span></label>
      <div style="display:flex;gap:8px">
        <input type="text" id="vanityMgIdInput" value="${escapeHtml(p.mg_id || "")}" placeholder="e.g. johncreates" maxlength="24" style="flex:1" />
        <button class="btn btnGhost btnSm" id="btnSaveVanityMgId">Save</button>
      </div>
      <div class="itemMeta" style="margin-top:4px">Letters, numbers, and underscores only. Must be unique.</div>
    </div>` : ""}
    <div class="listItem" style="margin-top:${isVip ? "0" : "8px"}"><div class="itemTitle" style="font-size:13px">Email</div><span class="itemMeta">${escapeHtml(p.email || currentUser?.email || "")}</span></div>
    <div class="field" style="margin-top:14px"><label>New password</label><input type="password" id="pNewPassword" placeholder="At least 6 characters" /></div>
    <button class="btn btnGhost btnBlock" id="btnChangePassword">Change Password</button>
    <div class="cardTitle" style="margin-top:20px;font-size:13px">Danger zone</div>
    <button class="btn btnDanger btnBlock" id="btnDeleteAccount">Delete my account</button>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  $("btnChangePassword").addEventListener("click", async () => {
    const pw = $("pNewPassword").value;
    if (!pw || pw.length < 6) { showToast("Password must be at least 6 characters."); return; }
    const { error } = await supabaseClient.auth.updateUser({ password: pw });
    if (error) { showToast("Could not update password: " + error.message); return; }
    $("pNewPassword").value = "";
    showToast("Password updated.");
  });
  $("btnDeleteAccount").addEventListener("click", doDeleteAccount);
  // Vanity MG ID save (VIP only)
  $("btnSaveVanityMgId")?.addEventListener("click", async () => {
    const raw = $("vanityMgIdInput").value.trim();
    if (!raw) { showToast("MG ID cannot be empty."); return; }
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(raw)) { showToast("MG ID: 3–24 characters, letters/numbers/underscores only."); return; }
    // Check uniqueness
    const { data: existing } = await supabaseClient.from("profiles").select("id").eq("mg_id", raw).neq("id", currentUser.id).maybeSingle();
    if (existing) { showToast("That MG ID is already taken — try another."); return; }
    const { error } = await supabaseClient.from("profiles").update({ mg_id: raw, updated_at: new Date().toISOString() }).eq("id", currentUser.id);
    if (error) { showToast("Could not update MG ID: " + error.message); return; }
    showToast("MG ID updated to @" + raw + "!");
    await loadProfile();
    closeModal();
  });
});

async function doDeleteAccount() {
  if (!confirm("This will permanently delete your VORTEXIA account, including your profile, meetings, chats, and messages. This cannot be undone. Continue?")) return;
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) { showToast("Your session expired — please log in again."); return; }
  const { error } = await supabaseClient.functions.invoke("delete-account", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) { showToast("Could not delete account: " + error.message); return; }
  await supabaseClient.auth.signOut();
  showToast("Your account has been deleted.");
  location.reload();
}

// ---------------------------------------------------------------------------
// Settings & Support (Profile tab)
// ---------------------------------------------------------------------------
const APP_VERSION = "1.3.1";
const APP_BUILD_DATE = "2026-07-18";
const SUPPORT_EMAIL = "terrencemontemayor2@gmail.com";

$("appVersionText").textContent = `v${APP_VERSION} • ${APP_BUILD_DATE}`;

// --- Privacy control (activity status, room status, DM permission) ---
$("btnPrivacyControl").addEventListener("click", () => {
  const p = currentProfile || {};
  const isVip = computeMembershipStatus(p).state === "trialing" || computeMembershipStatus(p).state === "active";
  openModal(`
    <div class="modalTitle">Privacy control</div>
    <div class="switchRow">
      <span>Show when you're active<br><span class="itemMeta">Let others see when you were last active or are currently active. Turn this off and you also won't see others' status.</span></span>
      <label class="switch"><input type="checkbox" id="toggleActivity" ${p.show_activity_status !== false ? "checked" : ""}><span class="slider"></span></label>
    </div>
    <div class="switchRow">
      <span>Show room status on avatar<br><span class="itemMeta">Let others see when you're in a room and join through your name. Turn this off and you also won't see others' room status.</span></span>
      <label class="switch"><input type="checkbox" id="toggleRoomStatus" ${p.show_room_status !== false ? "checked" : ""}><span class="slider"></span></label>
    </div>
    <div class="switchRow">
      <span>Allow DMs from everyone <span class="badge badgeVip" style="font-size:10px">VIP</span><br><span class="itemMeta">Let users you don't follow message or call you directly. VIP Verified feature.</span></span>
      <label class="switch"><input type="checkbox" id="toggleDmEveryone" ${!isVip ? "disabled" : ""} ${p.allow_dm_from_everyone !== false ? "checked" : ""}><span class="slider"></span></label>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  ["toggleActivity", "toggleRoomStatus", "toggleDmEveryone"].forEach(id => {
    $(id).addEventListener("change", async (e) => {
      const field = { toggleActivity: "show_activity_status", toggleRoomStatus: "show_room_status", toggleDmEveryone: "allow_dm_from_everyone" }[id];
      const { error } = await supabaseClient.from("profiles").update({ [field]: e.target.checked }).eq("id", currentUser.id);
      if (error) { showToast(error.message); e.target.checked = !e.target.checked; return; }
      currentProfile[field] = e.target.checked;
    });
  });
});

// --- Notifications ---
$("btnNotifSettings").addEventListener("click", () => {
  const p = currentProfile || {};
  openModal(`
    <div class="modalTitle">Notifications</div>
    <div class="switchRow"><span>Show notifications</span><label class="switch"><input type="checkbox" id="toggleNotifShow" ${p.notif_in_app !== false ? "checked" : ""}><span class="slider"></span></label></div>
    <div class="switchRow"><span>Sound</span><label class="switch"><input type="checkbox" id="toggleNotifSound" ${p.notif_sound !== false ? "checked" : ""}><span class="slider"></span></label></div>
    <div class="switchRow"><span>Vibration</span><label class="switch"><input type="checkbox" id="toggleNotifVibrate" ${p.notif_vibration !== false ? "checked" : ""}><span class="slider"></span></label></div>
    <div class="switchRow"><span>Received room invitation</span><label class="switch"><input type="checkbox" id="toggleNotifInvite" ${p.notif_room_invite !== false ? "checked" : ""}><span class="slider"></span></label></div>
    <div class="switchRow"><span>Email reminders (15 min / 5 min / start)</span><label class="switch"><input type="checkbox" id="toggleNotifEmail" ${p.notif_email !== false ? "checked" : ""}><span class="slider"></span></label></div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  const map = { toggleNotifShow: "notif_in_app", toggleNotifSound: "notif_sound", toggleNotifVibrate: "notif_vibration", toggleNotifInvite: "notif_room_invite", toggleNotifEmail: "notif_email" };
  Object.keys(map).forEach(id => {
    $(id).addEventListener("change", async (e) => {
      const field = map[id];
      const { error } = await supabaseClient.from("profiles").update({ [field]: e.target.checked }).eq("id", currentUser.id);
      if (error) { showToast(error.message); e.target.checked = !e.target.checked; return; }
      currentProfile[field] = e.target.checked;
    });
  });
});

// --- Static info pages (Terms of use, FAQ, Community guidelines, Safety advice) ---
function openTextModal(title, html) {
  openModal(`
    <div class="modalTitle">${escapeHtml(title)}</div>
    <div class="itemMeta" style="max-height:55vh;overflow-y:auto;line-height:1.55;text-align:left">${html}</div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
}

$("btnTermsOfUse").addEventListener("click", () => openTextModal("Terms of use", `
  <p><strong>Last updated:</strong> ${APP_BUILD_DATE}</p>
  <p>By using VORTEXIA you agree to use it lawfully, treat other users respectfully, and not use it to harass, spam, or share content that violates our Community Guidelines.</p>
  <p>You're responsible for what you post/say in meetings, chats, and calls. We may suspend or remove accounts that violate these terms or the law.</p>
  <p>The Free plan and paid plans (Essential/Growth/Business) are described in Profile → Membership; prices and features may change with notice.</p>
  <p>VORTEXIA is provided "as is" during active development — features may change or be temporarily unavailable while we improve the app.</p>
  <p>Contact: ${SUPPORT_EMAIL}</p>
`));

$("btnFaq").addEventListener("click", () => openTextModal("FAQ", `
  <p><strong>How do I find someone?</strong> Use their MG ID or name in Chat → Search, or share your own MG ID (Settings → Account) so others can find you.</p>
  <p><strong>What's an MG ID?</strong> A unique 7-digit ID every account gets automatically — a stable way to find/add someone even if their name changes.</p>
  <p><strong>Can people message me if I don't follow them?</strong> Only if you allow it in Settings → Privacy control (VIP feature).</p>
  <p><strong>How do voice calls work?</strong> App-to-app only for now (WebRTC) — start one from the 📞 button in any chat.</p>
  <p><strong>How do I delete my account?</strong> Settings → Account → Delete my account. This is permanent.</p>
  <p>More questions? Settings → Send feedback.</p>
`));

$("btnCommunityGuidelines").addEventListener("click", () => openTextModal("Community guidelines", `
  <p>Be respectful — no harassment, hate speech, or threats toward other users.</p>
  <p>No spam, scams, or impersonation.</p>
  <p>No sharing of illegal content, or content that endangers minors.</p>
  <p>Respect people's privacy — don't record or share meetings/calls without consent.</p>
  <p>Violations may lead to blocking by other users, content removal, or account suspension.</p>
  <p>Report concerns via Settings → Send feedback.</p>
`));

$("btnSafetyAdvice").addEventListener("click", () => openTextModal("Safety advice", `
  <p><strong>Platform rule violations:</strong> block the user (Settings → Blocklist) and report it to us via Send feedback.</p>
  <p><strong>About your information:</strong> only people you're meeting/chatting with can see relevant data; see Settings → Privacy policy for details.</p>
  <p><strong>Staying safe on VORTEXIA:</strong> don't share passwords or one-time codes with anyone, verify who you're talking to before sharing sensitive info, and use Privacy control to limit who can reach you.</p>
  <p><strong>About VIP:</strong> VIP Verified is a paid membership tier, not an identity verification of the other person — stay cautious regardless of badges.</p>
  <p><strong>Legal &amp; safety:</strong> for urgent safety concerns involving illegal activity, contact local authorities directly in addition to reporting to us.</p>
`));

// --- Sign out (also available from the topbar) ---
$("btnSignOutSettings").addEventListener("click", () => $("btnLogout").click());

// --- Profile view (click a name/avatar to see bio + follow) ---
$("btnProfileViewBack").addEventListener("click", () => $("profileViewOverlay").classList.add("hidden"));

async function openProfileView(userId) {
  // The reels feed is a fixed, high-z-index overlay that stays mounted as long
  // as Workspace > Feed is active. Opening this separate profile overlay never
  // touched that state before, so the reel's floating buttons/video kept
  // rendering on top of (or behind, depending on stacking) whatever opened
  // next. Force it closed here so profile view is always clean.
  closeReelsFeed();
  $("profileViewBody").innerHTML = `<div class="emptyState">Loading…</div>`;
  $("profileViewOverlay").classList.remove("hidden");
  // Silently log this profile view for VIP "who viewed you" feature
  // Fire-and-forget: don't await, don't block the UI, don't show errors to viewer
  if (currentUser && userId !== currentUser.id) {
    supabaseClient.rpc("log_profile_view", { p_subject_id: userId, p_viewer_id: currentUser.id }).catch(() => {});
  }

  let data, error, ratingData, reviewsData, followRow, myReview, badgeRow;
  try {
    ([{ data, error }, { data: ratingData }, { data: reviewsData }, { data: followRow }, { data: myReview }, { data: badgeRow }] = await withTimeout(Promise.all([
      supabaseClient.rpc("get_public_profile", { p_id: userId }),
      supabaseClient.rpc("get_profile_rating", { p_id: userId }),
      supabaseClient.from("profile_reviews").select("*").eq("subject_id", userId).order("created_at", { ascending: false }).limit(20),
      supabaseClient.from("follows").select("id").eq("follower_id", currentUser.id).eq("followee_id", userId).maybeSingle(),
      supabaseClient.from("profile_reviews").select("rating,body").eq("reviewer_id", currentUser.id).eq("subject_id", userId).maybeSingle(),
      supabaseClient.from("user_badges").select("id").eq("user_id", userId).eq("badge_type", "weekly_highlight")
        .eq("week_of", new Date(Date.now() - (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1) * 86400000).toISOString().slice(0, 10)).maybeSingle(),
    ]), 8000, "This profile"));
  } catch (timeoutErr) {
    $("profileViewBody").innerHTML = `<div class="emptyState">${escapeHtml(timeoutErr.message)}<br><button class="btn btnGhost btnSm" id="btnRetryProfileLoad" style="margin-top:10px">Retry</button></div>`;
    $("btnRetryProfileLoad")?.addEventListener("click", () => openProfileView(userId));
    return;
  }
  const p = Array.isArray(data) ? data[0] : data;
  if (error || !p) { $("profileViewBody").innerHTML = `<div class="emptyState">Couldn't load this profile.</div>`; return; }

  const isFollowing = !!followRow;
  const initial = (p.full_name || "?").trim().charAt(0).toUpperCase();
  const rating = Array.isArray(ratingData) ? ratingData[0] : ratingData;
  const avgRating = rating ? Number(rating.avg_rating) : 0;
  const reviewCount = rating ? rating.review_count : 0;
  const starsStr = "★".repeat(Math.round(avgRating)) + "☆".repeat(5 - Math.round(avgRating));

  // Fetch reviewer names for the review list in one batch
  const reviewerIds = [...new Set((reviewsData || []).map(r => r.reviewer_id))];
  let reviewerNames = {};
  if (reviewerIds.length) {
    const { data: reviewers } = await supabaseClient.from("profiles").select("id, full_name").in("id", reviewerIds);
    (reviewers || []).forEach(r => { reviewerNames[r.id] = r.full_name; });
  }

  $("profileViewBody").innerHTML = `
    <div class="pvCover">
      ${p.cover_photo_url ? `<img loading="lazy" class="pvCoverImg" src="${escapeHtml(p.cover_photo_url)}" alt="" style="cursor:pointer" data-lightbox="${escapeHtml(p.cover_photo_url)}"/>` : ""}
    </div>
    <div class="pvHeaderWrap">
      <div class="pvNameRow">
        ${renderVipAvatarFrame(p.avatar_url
          ? `<div class="profileViewAvatar"><img loading="lazy" src="${escapeHtml(p.avatar_url)}" alt="" style="cursor:pointer" data-lightbox="${escapeHtml(p.avatar_url)}"/></div>`
          : `<div class="profileViewAvatar">${initial}</div>`,
          p, true)}
        <div class="pvNameCol">
          <div class="profileViewName">${renderVipName(p.full_name || "VORTEXIA user", p)}${badgeRow ? ` <span class="badge badgeVipNavy" style="font-size:10px;vertical-align:middle" title="Top contributor this week">🏆 Weekly Highlight</span>` : ""}</div>
          ${p.profile_flair && getVipTier(p) ? `<div class="profileViewFlair">${escapeHtml(p.profile_flair)}</div>` : ""}
          <div class="profileViewMeta">MG ID ${escapeHtml(p.mg_id || "—")}${getVipTier(p) ? " • VIP Verified" : ""}</div>
        </div>
      </div>
      <div class="profileViewMeta" style="margin-top:8px">
        ${p.is_active === null ? "" : `<span class="profileViewStatusDot ${p.is_active ? "isActive" : ""}"></span>${p.is_active ? "Active now" : "Offline"}`}
        ${p.current_room_id ? " • In a room" : ""}
        &nbsp;•&nbsp;${renderReputationBadge(p.reputation_tier)} <span class="itemMeta">${p.reputation_score || 0} pts</span>
      </div>

      <div class="pvActionRow">
        <button class="btn pvMessageBtn" id="btnMessageUser">💬 Message</button>
      </div>
      <div class="pvSecondaryActionRow">
        <button class="btn btnGhost" id="btnToggleFollow">${isFollowing ? "Following ✓" : "+ Follow"}</button>
        <button class="btn btnGhost pvMoreBtn" id="btnPvMore" title="More options">⋯</button>
      </div>

      <div class="pvCard">
        <div class="pvCardTitle">About</div>
        <div class="profileViewBio">${escapeHtml(p.bio || "No bio yet.")}</div>
        ${p.skills && p.skills.length ? `<div class="skillChipsRow" style="margin-top:10px">${renderSkillChips(p.skills, false)}</div>` : ""}
      </div>

      <div class="pvCard">
        <div class="pvCardTitle">⭐ Ratings &amp; reviews</div>
        <div class="itemMeta" style="margin-bottom:10px">${starsStr} ${avgRating.toFixed(1)} (${reviewCount} review${reviewCount === 1 ? "" : "s"})</div>

        <div id="reviewFormWrap">
          <div class="starRow" id="myStarPicker">${[1,2,3,4,5].map(n => `<span class="starPick${myReview && n <= myReview.rating ? " active" : ""}" data-star="${n}">★</span>`).join("")}</div>
          <textarea id="myReviewBody" rows="2" placeholder="Leave a review (optional)…" style="margin-top:6px">${escapeHtml(myReview?.body || "")}</textarea>
          <button class="btn btnPrimary btnSm" id="btnSubmitReview" style="margin-top:6px">${myReview ? "Update review" : "Submit review"}</button>
        </div>

        <div id="reviewsList" style="margin-top:12px">
          ${(reviewsData || []).length ? reviewsData.map(r => `
            <div class="reviewItem">
              <div class="itemTitle" style="font-size:13px">${escapeHtml(reviewerNames[r.reviewer_id] || "VORTEXIA user")} <span style="color:#f59e0b">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span></div>
              ${r.body ? `<div class="itemMeta">${escapeHtml(r.body)}</div>` : ""}
            </div>`).join("") : `<div class="emptyState">No reviews yet — be the first!</div>`}
        </div>
      </div>

      <div class="pvTabsRow" id="pvTabsRow">
        <button class="subTabBtn active" data-pvtab="posts">📝 Posts</button>
        <button class="subTabBtn" data-pvtab="photos">🖼️ Photos</button>
        <button class="subTabBtn" data-pvtab="videos">🎥 Videos</button>
        <button class="subTabBtn" data-pvtab="resume">📄 Resume</button>
        <button class="subTabBtn" data-pvtab="portfolio">🎨 Portfolio</button>
      </div>
      <div id="pvTabBody" style="margin-top:14px;min-height:80px"></div>
    </div>
  `;

  $("profileViewBody").querySelectorAll("[data-lightbox]").forEach(img => {
    img.addEventListener("click", () => openPhotoLightbox(img.dataset.lightbox));
  });
  $("btnToggleFollow").addEventListener("click", async () => {
    if (isFollowing) {
      await supabaseClient.from("follows").delete().eq("follower_id", currentUser.id).eq("followee_id", userId);
    } else {
      await supabaseClient.from("follows").insert({ follower_id: currentUser.id, followee_id: userId });
      createNotification({ user_id: userId, type: "follow", title: `${currentProfile?.full_name || "Someone"} started following you`, body: null });
    }
    openProfileView(userId);
  });

  $("btnMessageUser").addEventListener("click", async () => {
    $("profileViewOverlay").classList.add("hidden");
    setActiveView("chat");
    await createOrStartChat(userId);
  });

  $("btnPvMore").addEventListener("click", () => openProfileMoreMenu(userId, p.full_name));

  $("pvTabsRow").addEventListener("click", (e) => {
    const btn = e.target.closest(".subTabBtn");
    if (!btn) return;
    $("pvTabsRow").querySelectorAll(".subTabBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    loadProfileViewTab(userId, btn.dataset.pvtab);
  });
  loadProfileViewTab(userId, "posts");

  let myStars = myReview?.rating || 0;
  const starEls = $("myStarPicker").querySelectorAll(".starPick");
  starEls.forEach(el => {
    el.addEventListener("click", () => {
      myStars = parseInt(el.dataset.star, 10);
      starEls.forEach(s => s.classList.toggle("active", parseInt(s.dataset.star, 10) <= myStars));
    });
  });
  $("btnSubmitReview").addEventListener("click", async () => {
    if (!myStars) { showToast("Please pick a star rating first."); return; }
    const body = $("myReviewBody").value.trim();
    const { error } = await supabaseClient.from("profile_reviews")
      .upsert({ reviewer_id: currentUser.id, subject_id: userId, rating: myStars, body: body || null }, { onConflict: "reviewer_id,subject_id" });
    if (error) { showToast("Could not save review: " + error.message); return; }
    await supabaseClient.rpc("recalc_reputation", { p_user_id: userId });
    showToast("Review saved!");
    openProfileView(userId);
  });
}

// --- Profile View: "⋯" more menu (Report / Block) ---
function openProfileMoreMenu(userId, userName) {
  openModal(`
    <div class="modalTitle">More options</div>
    <button class="btn btnGhost btnBlock" id="pvBtnReport" style="color:var(--danger);text-align:left">🚩 Report ${escapeHtml(userName || "user")}</button>
    <button class="btn btnGhost btnBlock" id="pvBtnBlock" style="color:var(--danger);text-align:left;margin-top:8px">⛔ Block ${escapeHtml(userName || "user")}</button>
    <div style="display:flex;justify-content:flex-end;margin-top:14px">
      <button class="btn btnGhost" id="modalCancel">Cancel</button>
    </div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  $("pvBtnReport").addEventListener("click", () => openReportUserModal(userId, userName));
  $("pvBtnBlock").addEventListener("click", () => confirmBlockUser(userId, userName));
}

function openReportUserModal(userId, userName) {
  openModal(`
    <div class="modalTitle">🚩 Report ${escapeHtml(userName || "user")}</div>
    <div class="field"><label>Reason</label>
      <select id="pvReportReason">
        <option value="harassment">Harassment or bullying</option>
        <option value="scam">Scam / Fraud</option>
        <option value="inappropriate">Inappropriate content</option>
        <option value="fake_account">Fake account / Impersonation</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div class="field"><label>Details (optional)</label><textarea id="pvReportDetails" rows="3" placeholder="Add any extra context…"></textarea></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
      <button class="btn btnGhost" id="modalCancel">Cancel</button>
      <button class="btn btnDanger" id="pvReportSubmit">Submit report</button>
    </div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  $("pvReportSubmit").addEventListener("click", async () => {
    const reason = $("pvReportReason").value;
    const details = $("pvReportDetails").value.trim();
    const { error } = await supabaseClient.from("user_reports").insert({
      reporter_id: currentUser.id, reported_user_id: userId, reason, details: details || null,
    });
    if (error) { showToast("Could not submit report: " + error.message); return; }
    closeModal();
    showToast("Report submitted. Thank you for helping keep VORTEXIA safe.");
  });
}

function confirmBlockUser(userId, userName) {
  openModal(`
    <div class="modalTitle">⛔ Block ${escapeHtml(userName || "user")}?</div>
    <div class="itemMeta">They won't be able to message you, and you'll stop following each other. You can unblock anytime from Settings → Privacy → Blocked users.</div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btnGhost" id="modalCancel">Cancel</button>
      <button class="btn btnDanger" id="pvBlockConfirm">Block</button>
    </div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  $("pvBlockConfirm").addEventListener("click", async () => {
    const { error } = await supabaseClient.from("blocked_users").insert({ blocker_id: currentUser.id, blocked_id: userId });
    if (error && error.code !== "23505") { showToast("Could not block: " + error.message); return; }
    await supabaseClient.from("follows").delete().eq("follower_id", currentUser.id).eq("followee_id", userId);
    await supabaseClient.from("follows").delete().eq("follower_id", userId).eq("followee_id", currentUser.id);
    closeModal();
    $("profileViewOverlay").classList.add("hidden");
    showToast("Blocked.");
  });
}

// --- Profile View: Posts / Photos / Videos tabs (works for ANY user, not just yourself) ---
async function loadProfileViewTab(userId, tab) {
  const body = $("pvTabBody");
  body.innerHTML = `<div class="emptyState">Loading…</div>`;

  if (tab === "posts") {
    const [{ data: mkData }, { data: rbData }] = await Promise.all([
      supabaseClient.from("marketplace_listings").select("*").eq("posted_by", userId).order("created_at", { ascending: false }),
      supabaseClient.from("forum_posts").select("*").eq("author_id", userId).order("created_at", { ascending: false }),
    ]);
    const rbIds = (rbData || []).map(t => t.id);
    let myLikedSet = new Set();
    if (rbIds.length) {
      const { data: likeRows } = await supabaseClient.from("forum_likes").select("post_id").eq("user_id", currentUser.id).in("post_id", rbIds);
      myLikedSet = new Set((likeRows || []).map(r => r.post_id));
    }
    const combined = [
      ...(mkData || []).map(l => ({ ...l, _type: "marketplace" })),
      ...(rbData || []).map(t => ({ ...t, _type: "rumble" })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!combined.length) { body.innerHTML = `<div class="emptyState">No posts yet.</div>`; return; }

    body.innerHTML = combined.map(post => {
      if (post._type === "rumble") {
        const liked = myLikedSet.has(post.id);
        return `
          <div class="timelineCard">
            <div class="timelineCardHead">🔥 Rumble • ${fmtDate(post.created_at)}</div>
            <div class="itemTitle">${escapeHtml(post.title)}</div>
            <div class="itemMeta" style="margin:4px 0 10px">${escapeHtml((post.body || "").slice(0, 160))}</div>
            <div class="timelineActions">
              <button class="timelineActionBtn ${liked ? "isActive" : ""}" data-pv-like="${post.id}">👍 ${liked ? "Liked" : "Like"} (${post.likes_count || 0})</button>
              <button class="timelineActionBtn" data-pv-comment="${post.id}">💬 Comment (${post.reply_count || 0})</button>
              <button class="timelineActionBtn" data-pv-share="1">↗️ Share</button>
            </div>
          </div>`;
      }
      return `
        <div class="timelineCard">
          <div class="timelineCardHead">🛍️ Marketplace • ${fmtDate(post.created_at)}</div>
          <div class="itemTitle">${escapeHtml(post.title)}</div>
          <div class="itemMeta" style="margin:4px 0 10px">${post.price != null ? "₱" + Number(post.price).toLocaleString() : ""} • ${escapeHtml(post.status || "open")}</div>
          <div class="timelineActions">
            <button class="timelineActionBtn" data-pv-view-mk="${post.id}">👁️ View</button>
            <button class="timelineActionBtn" data-pv-share="1">↗️ Share</button>
          </div>
        </div>`;
    }).join("");

    body.querySelectorAll("[data-pv-like]").forEach(btn => btn.addEventListener("click", async () => {
      const postId = btn.dataset.pvLike;
      const { data: cur } = await supabaseClient.from("forum_posts").select("likes_count, author_id, title").eq("id", postId).single();
      const curCount = cur ? (cur.likes_count || 0) : 0;
      if (myLikedSet.has(postId)) {
        await supabaseClient.from("forum_likes").delete().eq("post_id", postId).eq("user_id", currentUser.id);
        await supabaseClient.from("forum_posts").update({ likes_count: Math.max(curCount - 1, 0) }).eq("id", postId);
      } else {
        const { error } = await supabaseClient.from("forum_likes").insert({ post_id: postId, user_id: currentUser.id });
        if (!error) {
          await supabaseClient.from("forum_posts").update({ likes_count: curCount + 1 }).eq("id", postId);
          if (cur?.author_id) {
            createNotification({ user_id: cur.author_id, type: "post_liked", title: `${currentProfile?.full_name || "Someone"} liked your post`, body: cur.title || null });
          }
        }
      }
      loadProfileViewTab(userId, "posts");
    }));
    body.querySelectorAll("[data-pv-comment]").forEach(btn => {
      const post = (rbData || []).find(p => p.id === btn.dataset.pvComment);
      if (post) btn.addEventListener("click", () => openThreadReplies(post.id, post));
    });
    body.querySelectorAll("[data-pv-view-mk]").forEach(btn => {
      const listing = (mkData || []).find(l => l.id === btn.dataset.pvViewMk);
      if (listing) btn.addEventListener("click", () => openMarketplaceDetail(listing));
    });
    body.querySelectorAll("[data-pv-share]").forEach(btn => btn.addEventListener("click", async () => {
      const url = `${location.origin}${location.pathname}?profile=${encodeURIComponent(userId)}`;
      try { await navigator.clipboard.writeText(url); showToast("Link copied!"); }
      catch (e) { showToast(url); }
    }));

  } else if (tab === "photos") {
    const [{ data: mkData }, { data: rbData }, { data: vidDataRaw }] = await Promise.all([
      supabaseClient.from("marketplace_listings").select("photos").eq("posted_by", userId),
      supabaseClient.from("forum_posts").select("post_image_url").eq("author_id", userId),
      supabaseClient.from("videos").select("thumbnail_url, flagged").eq("uploaded_by", userId),
    ]);
    // Pending-review videos only show their thumbnail to the uploader themselves.
    const vidData = (vidDataRaw || []).filter(v => !v.flagged || userId === currentUser.id);
    const photos = [];
    (mkData || []).forEach(l => (l.photos || []).forEach(p => { if (p) photos.push(p); }));
    (rbData || []).forEach(t => { if (t.post_image_url) photos.push(t.post_image_url); });
    (vidData || []).forEach(v => { if (v.thumbnail_url) photos.push(v.thumbnail_url); });
    if (!photos.length) { body.innerHTML = `<div class="emptyState">No photos yet.</div>`; return; }
    body.innerHTML = `<div class="timelinePhotoGrid">${photos.map(p => `<img loading="lazy" src="${escapeHtml(p)}" class="timelinePhotoThumb" />`).join("")}</div>`;

  } else if (tab === "videos") {
    const { data: vidsRaw } = await supabaseClient.from("videos").select("*").eq("uploaded_by", userId).order("created_at", { ascending: false });
    // Pending-review videos only show up on the uploader's own profile view.
    const vids = (vidsRaw || []).filter(v => !v.flagged || userId === currentUser.id);
    if (!vids || !vids.length) { body.innerHTML = `<div class="emptyState">No videos yet.</div>`; return; }
    const vidIds = vids.map(v => v.id);
    const { data: likeRows } = await supabaseClient.from("video_likes").select("video_id").eq("user_id", currentUser.id).in("video_id", vidIds);
    const myVidLikes = new Set((likeRows || []).map(r => r.video_id));

    body.innerHTML = vids.map(v => `
      <div class="timelineCard">
        <div class="timelineCardHead">🎥 ${fmtDate(v.created_at)}</div>
        <div class="itemTitle">${escapeHtml(v.title)}${v.flagged ? ` <span class="badge" style="color:var(--danger);font-size:10px">Under review</span>` : ""}</div>
        ${v.description ? `<div class="itemMeta" style="margin:4px 0 10px">${escapeHtml(v.description.slice(0, 160))}</div>` : ""}
        <div class="timelineActions">
          <button class="timelineActionBtn" data-pv-vid-play="${v.id}">▶️ Play</button>
          <button class="timelineActionBtn ${myVidLikes.has(v.id) ? "isActive" : ""}" data-pv-vid-like="${v.id}">👍 ${myVidLikes.has(v.id) ? "Liked" : "Like"} (${v.likes_count || 0})</button>
          <button class="timelineActionBtn" data-pv-vid-comment="${v.id}">💬 Comment</button>
          <button class="timelineActionBtn" data-pv-share="1">↗️ Share</button>
        </div>
      </div>`).join("");

    body.querySelectorAll("[data-pv-vid-play]").forEach(btn => {
      const v = vids.find(x => x.id === btn.dataset.pvVidPlay);
      if (v) btn.addEventListener("click", () => openVideoPlayer(v));
    });
    body.querySelectorAll("[data-pv-vid-like]").forEach(btn => btn.addEventListener("click", async () => {
      const videoId = btn.dataset.pvVidLike;
      if (myVidLikes.has(videoId)) {
        await supabaseClient.from("video_likes").delete().eq("video_id", videoId).eq("user_id", currentUser.id);
      } else {
        const { error } = await supabaseClient.from("video_likes").insert({ video_id: videoId, user_id: currentUser.id });
        if (!error) {
          const v = vids.find(x => x.id === videoId);
          if (v?.uploaded_by) createNotification({ user_id: v.uploaded_by, type: "post_liked", title: `${currentProfile?.full_name || "Someone"} liked your video`, body: v.title || null });
        }
      }
      loadProfileViewTab(userId, "videos");
    }));
    body.querySelectorAll("[data-pv-vid-comment]").forEach(btn => {
      const v = vids.find(x => x.id === btn.dataset.pvVidComment);
      if (v) btn.addEventListener("click", () => openVideoCommentsModal(v));
    });
    body.querySelectorAll("[data-pv-share]").forEach(btn => btn.addEventListener("click", async () => {
      const url = `${location.origin}${location.pathname}?profile=${encodeURIComponent(userId)}`;
      try { await navigator.clipboard.writeText(url); showToast("Link copied!"); }
      catch (e) { showToast(url); }
    }));

  } else if (tab === "resume") {
    await loadResumeTab(userId, body);
  } else if (tab === "portfolio") {
    await loadPortfolioTab(userId, body);
  }
}

/* ============================================================
   PHASE 2 — JOBS MODULE: RESUME (Week 1 MVP)
   ============================================================ */
async function loadResumeTab(userId, body) {
  const isOwn = userId === currentUser.id;
  const { data: resume } = await supabaseClient.from("resumes").select("*").eq("user_id", userId)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();

  if (!resume) {
    body.innerHTML = `
      <div class="emptyState">
        ${isOwn ? "You haven't built a resume yet." : "No public resume yet."}
        ${isOwn ? `<div style="margin-top:10px"><button class="btn btnPrimary btnSm" id="btnCreateResume">📄 Build my resume</button></div>` : ""}
      </div>`;
    if (isOwn) $("btnCreateResume")?.addEventListener("click", () => openResumeEditor(userId));
    return;
  }

  if (!resume.is_public && !isOwn) {
    body.innerHTML = `<div class="emptyState">This resume is private.</div>`;
    return;
  }

  const [{ data: edu }, { data: exp }, { data: skills }] = await Promise.all([
    supabaseClient.from("resume_education").select("*").eq("resume_id", resume.id).order("order_index", { ascending: true }),
    supabaseClient.from("resume_experience").select("*").eq("resume_id", resume.id).order("order_index", { ascending: true }),
    supabaseClient.from("resume_skills").select("*").eq("resume_id", resume.id),
  ]);

  const fmtRange = (s, e) => `${s ? new Date(s).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "?"} – ${e ? new Date(e).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "Present"}`;

  body.innerHTML = `
    <div class="pvCard">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div>
          <div class="itemTitle" style="font-size:16px">${escapeHtml(resume.title || "My Resume")}</div>
          ${resume.headline ? `<div class="itemMeta" style="margin-top:2px">${escapeHtml(resume.headline)}</div>` : ""}
        </div>
        ${isOwn ? `<button class="btn btnGhost btnSm" id="btnEditResume">✏️ Edit</button>` : ""}
      </div>
      ${resume.summary ? `<div class="itemMeta" style="margin-top:10px;white-space:pre-wrap">${escapeHtml(resume.summary)}</div>` : ""}
      ${isOwn && !resume.is_public ? `<div class="itemMeta" style="margin-top:8px;color:var(--danger)">🔒 Private — only you can see this</div>` : ""}
    </div>

    ${(exp || []).length ? `
      <div class="pvCard" style="margin-top:10px">
        <div class="pvCardTitle">💼 Experience</div>
        ${exp.map(x => `
          <div style="margin-bottom:12px">
            <div class="itemTitle" style="font-size:13px">${escapeHtml(x.title)} · ${escapeHtml(x.company)}</div>
            <div class="itemMeta">${x.location ? escapeHtml(x.location) + " • " : ""}${fmtRange(x.start_date, x.end_date)}</div>
            ${x.description ? `<div class="itemMeta" style="margin-top:4px;white-space:pre-wrap">${escapeHtml(x.description)}</div>` : ""}
            ${(x.skills || []).length ? `<div style="margin-top:6px">${x.skills.map(s => `<span class="badge" style="margin-right:4px">${escapeHtml(s)}</span>`).join("")}</div>` : ""}
          </div>`).join("")}
      </div>` : ""}

    ${(edu || []).length ? `
      <div class="pvCard" style="margin-top:10px">
        <div class="pvCardTitle">🎓 Education</div>
        ${edu.map(x => `
          <div style="margin-bottom:12px">
            <div class="itemTitle" style="font-size:13px">${escapeHtml(x.degree)}, ${escapeHtml(x.field)}</div>
            <div class="itemMeta">${escapeHtml(x.school)} • ${fmtRange(x.start_date, x.end_date)}</div>
            ${x.description ? `<div class="itemMeta" style="margin-top:4px">${escapeHtml(x.description)}</div>` : ""}
          </div>`).join("")}
      </div>` : ""}

    ${(skills || []).length ? `
      <div class="pvCard" style="margin-top:10px">
        <div class="pvCardTitle">🛠️ Skills</div>
        <div>${skills.map(s => `<span class="badge" style="margin:0 4px 6px 0;display:inline-block">${escapeHtml(s.skill_name)}${s.proficiency ? ` · ${escapeHtml(s.proficiency)}` : ""}</span>`).join("")}</div>
      </div>` : ""}
  `;

  if (isOwn) $("btnEditResume")?.addEventListener("click", () => openResumeEditor(userId, resume, edu || [], exp || [], skills || []));
}

async function openResumeEditor(userId, resume = null, edu = [], exp = [], skills = []) {
  resume = resume || { title: "My Resume", headline: "", summary: "", is_public: true };
  openModal(`
    <div class="modalTitle">📄 Edit Resume</div>
    <div class="field"><label>Title</label><input id="rsTitle" value="${escapeHtml(resume.title || "")}" placeholder="e.g. Senior Product Manager" /></div>
    <div class="field"><label>Headline</label><input id="rsHeadline" value="${escapeHtml(resume.headline || "")}" placeholder="One-liner about you" /></div>
    <div class="field"><label>Summary</label><textarea id="rsSummary" rows="3" placeholder="Short bio (~200 words)">${escapeHtml(resume.summary || "")}</textarea></div>
    <div class="field" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="rsPublic" ${resume.is_public ? "checked" : ""} style="width:auto" />
      <label style="margin:0">Public — visible to employers on my profile</label>
    </div>

    <div class="pvCardTitle" style="margin-top:14px">💼 Experience</div>
    <div id="rsExpList">${exp.map(x => resumeExpRowHtml(x)).join("")}</div>
    <button class="btn btnGhost btnSm" id="btnAddExp" type="button" style="margin-top:6px">+ Add experience</button>

    <div class="pvCardTitle" style="margin-top:14px">🎓 Education</div>
    <div id="rsEduList">${edu.map(x => resumeEduRowHtml(x)).join("")}</div>
    <button class="btn btnGhost btnSm" id="btnAddEdu" type="button" style="margin-top:6px">+ Add education</button>

    <div class="pvCardTitle" style="margin-top:14px">🛠️ Skills</div>
    <div id="rsSkillsList">${skills.map(x => resumeSkillRowHtml(x)).join("")}</div>
    <button class="btn btnGhost btnSm" id="btnAddSkill" type="button" style="margin-top:6px">+ Add skill</button>

    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
      <button class="btn btnGhost" id="modalCancel">Cancel</button>
      <button class="btn btnPrimary" id="btnSaveResume">Save Resume</button>
    </div>
  `);

  $("modalCancel").addEventListener("click", closeModal);

  $("btnAddExp").addEventListener("click", () => {
    $("rsExpList").insertAdjacentHTML("beforeend", resumeExpRowHtml());
    wireResumeRowRemovers();
  });
  $("btnAddEdu").addEventListener("click", () => {
    $("rsEduList").insertAdjacentHTML("beforeend", resumeEduRowHtml());
    wireResumeRowRemovers();
  });
  $("btnAddSkill").addEventListener("click", () => {
    $("rsSkillsList").insertAdjacentHTML("beforeend", resumeSkillRowHtml());
    wireResumeRowRemovers();
  });
  wireResumeRowRemovers();

  $("btnSaveResume").addEventListener("click", async () => {
    const title = $("rsTitle").value.trim() || "My Resume";
    const headline = $("rsHeadline").value.trim();
    const summary = $("rsSummary").value.trim();
    const is_public = $("rsPublic").checked;

    let resumeId = resume.id;
    if (resumeId) {
      const { error } = await supabaseClient.from("resumes").update({ title, headline, summary, is_public, updated_at: new Date().toISOString() }).eq("id", resumeId);
      if (error) { showToast("Could not save resume: " + error.message); return; }
    } else {
      const { data, error } = await supabaseClient.from("resumes").insert({ user_id: userId, title, headline, summary, is_public }).select().single();
      if (error) { showToast("Could not create resume: " + error.message); return; }
      resumeId = data.id;
    }

    // Simplest-correct sync: wipe & re-insert child rows from the form state.
    // Fine for MVP scale (a handful of rows per resume); revisit if resumes grow large.
    await Promise.all([
      supabaseClient.from("resume_experience").delete().eq("resume_id", resumeId),
      supabaseClient.from("resume_education").delete().eq("resume_id", resumeId),
      supabaseClient.from("resume_skills").delete().eq("resume_id", resumeId),
    ]);

    const expRows = [...$("rsExpList").querySelectorAll(".rsRow")].map((row, i) => ({
      resume_id: resumeId,
      title: row.querySelector("[data-f=title]").value.trim(),
      company: row.querySelector("[data-f=company]").value.trim(),
      location: row.querySelector("[data-f=location]").value.trim(),
      start_date: row.querySelector("[data-f=start]").value || null,
      end_date: row.querySelector("[data-f=end]").value || null,
      description: row.querySelector("[data-f=desc]").value.trim(),
      skills: row.querySelector("[data-f=skills]").value.split(",").map(s => s.trim()).filter(Boolean),
      order_index: i,
    })).filter(r => r.title && r.company);

    const eduRows = [...$("rsEduList").querySelectorAll(".rsRow")].map((row, i) => ({
      resume_id: resumeId,
      school: row.querySelector("[data-f=school]").value.trim(),
      degree: row.querySelector("[data-f=degree]").value.trim(),
      field: row.querySelector("[data-f=field]").value.trim(),
      start_date: row.querySelector("[data-f=start]").value || null,
      end_date: row.querySelector("[data-f=end]").value || null,
      description: row.querySelector("[data-f=desc]").value.trim(),
      order_index: i,
    })).filter(r => r.school && r.degree && r.field);

    const skillRows = [...$("rsSkillsList").querySelectorAll(".rsRow")].map(row => ({
      resume_id: resumeId,
      skill_name: row.querySelector("[data-f=name]").value.trim(),
      proficiency: row.querySelector("[data-f=level]").value || null,
    })).filter(r => r.skill_name);

    const inserts = [];
    if (expRows.length) inserts.push(supabaseClient.from("resume_experience").insert(expRows));
    if (eduRows.length) inserts.push(supabaseClient.from("resume_education").insert(eduRows));
    if (skillRows.length) inserts.push(supabaseClient.from("resume_skills").insert(skillRows));
    await Promise.all(inserts);

    showToast("💾 Resume saved!");
    closeModal();
    loadProfileViewTab(userId, "resume");
  });
}

function resumeExpRowHtml(x = {}) {
  return `
    <div class="rsRow" style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px">
      <div class="field"><input data-f="title" placeholder="Job title" value="${escapeHtml(x.title || "")}" /></div>
      <div class="field"><input data-f="company" placeholder="Company" value="${escapeHtml(x.company || "")}" /></div>
      <div class="field"><input data-f="location" placeholder="Location (e.g. Manila, PH / Remote)" value="${escapeHtml(x.location || "")}" /></div>
      <div style="display:flex;gap:8px">
        <div class="field" style="flex:1"><label>Start</label><input data-f="start" type="date" value="${x.start_date ? x.start_date.slice(0,10) : ""}" /></div>
        <div class="field" style="flex:1"><label>End (blank = current)</label><input data-f="end" type="date" value="${x.end_date ? x.end_date.slice(0,10) : ""}" /></div>
      </div>
      <div class="field"><textarea data-f="desc" rows="2" placeholder="What did you do?">${escapeHtml(x.description || "")}</textarea></div>
      <div class="field"><input data-f="skills" placeholder="Skills, comma separated" value="${escapeHtml((x.skills || []).join(", "))}" /></div>
      <button class="btn btnGhost btnSm rsRemoveRow" type="button">🗑️ Remove</button>
    </div>`;
}
function resumeEduRowHtml(x = {}) {
  return `
    <div class="rsRow" style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px">
      <div class="field"><input data-f="school" placeholder="School" value="${escapeHtml(x.school || "")}" /></div>
      <div class="field"><input data-f="degree" placeholder="Degree (e.g. Bachelor of Science)" value="${escapeHtml(x.degree || "")}" /></div>
      <div class="field"><input data-f="field" placeholder="Field of study" value="${escapeHtml(x.field || "")}" /></div>
      <div style="display:flex;gap:8px">
        <div class="field" style="flex:1"><label>Start</label><input data-f="start" type="date" value="${x.start_date ? x.start_date.slice(0,10) : ""}" /></div>
        <div class="field" style="flex:1"><label>End</label><input data-f="end" type="date" value="${x.end_date ? x.end_date.slice(0,10) : ""}" /></div>
      </div>
      <div class="field"><textarea data-f="desc" rows="2" placeholder="Achievements, honors (optional)">${escapeHtml(x.description || "")}</textarea></div>
      <button class="btn btnGhost btnSm rsRemoveRow" type="button">🗑️ Remove</button>
    </div>`;
}
function resumeSkillRowHtml(x = {}) {
  return `
    <div class="rsRow" style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <input data-f="name" placeholder="Skill (e.g. React)" value="${escapeHtml(x.skill_name || "")}" style="flex:2" />
      <select data-f="level" style="flex:1">
        <option value="" ${!x.proficiency ? "selected" : ""}>—</option>
        <option value="Beginner" ${x.proficiency === "Beginner" ? "selected" : ""}>Beginner</option>
        <option value="Intermediate" ${x.proficiency === "Intermediate" ? "selected" : ""}>Intermediate</option>
        <option value="Expert" ${x.proficiency === "Expert" ? "selected" : ""}>Expert</option>
      </select>
      <button class="btn btnGhost btnSm rsRemoveRow" type="button">🗑️</button>
    </div>`;
}
function wireResumeRowRemovers() {
  $("modalCard").querySelectorAll(".rsRemoveRow").forEach(btn => {
    btn.onclick = () => btn.closest(".rsRow").remove();
  });
}

/* ============================================================
   PROFILE — PORTFOLIO (Phase 12, per master plan Profile Philosophy)
   ============================================================ */
async function loadPortfolioTab(userId, body) {
  const isOwn = userId === currentUser.id;
  const { data: projects } = await supabaseClient.from("portfolio_projects").select("*").eq("user_id", userId).order("order_index", { ascending: true });

  body.innerHTML = `
    ${isOwn ? `<button class="btn btnPrimary btnSm" id="btnAddPortfolioProject" style="margin-bottom:12px">+ Add project</button>` : ""}
    <div id="portfolioGrid" class="wsTileGrid"></div>
  `;

  const grid = $("portfolioGrid");
  if (!projects || !projects.length) {
    grid.innerHTML = `<div class="emptyState">${isOwn ? "Showcase your work — add your first project." : "No portfolio projects yet."}</div>`;
  } else {
    grid.innerHTML = projects.map(pr => `
      <div class="pvCard" data-portfolio-id="${pr.id}" style="padding:0;overflow:hidden">
        ${pr.image_url ? `<img loading="lazy" src="${escapeHtml(pr.image_url)}" style="width:100%;height:140px;object-fit:cover" />` : `<div style="width:100%;height:140px;background:var(--panel2);display:flex;align-items:center;justify-content:center;font-size:32px">🎨</div>`}
        <div style="padding:12px">
          <div class="itemTitle" style="font-size:13px">${escapeHtml(pr.title)}</div>
          ${pr.description ? `<div class="itemMeta" style="margin-top:4px">${escapeHtml(pr.description.slice(0, 120))}${pr.description.length > 120 ? "…" : ""}</div>` : ""}
          ${(pr.skills_used || []).length ? `<div style="margin-top:8px">${pr.skills_used.map(s => `<span class="badge" style="margin:0 4px 4px 0">${escapeHtml(s)}</span>`).join("")}</div>` : ""}
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            ${pr.link_url ? `<a href="${escapeHtml(pr.link_url)}" target="_blank" rel="noopener" class="btn btnGhost btnSm">${escapeHtml(pr.link_label || "View")} ↗</a>` : ""}
            ${isOwn ? `<button class="btn btnGhost btnSm" data-edit-portfolio="${pr.id}">✏️ Edit</button><button class="btn btnGhost btnSm" data-delete-portfolio="${pr.id}">🗑️</button>` : ""}
          </div>
        </div>
      </div>`).join("");
  }

  $("btnAddPortfolioProject")?.addEventListener("click", () => openPortfolioEditor(userId));
  grid.querySelectorAll("[data-edit-portfolio]").forEach(btn => {
    btn.addEventListener("click", () => {
      const pr = projects.find(p => p.id === btn.dataset.editPortfolio);
      if (pr) openPortfolioEditor(userId, pr);
    });
  });
  grid.querySelectorAll("[data-delete-portfolio]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this project from your portfolio?")) return;
      await supabaseClient.from("portfolio_projects").delete().eq("id", btn.dataset.deletePortfolio);
      loadPortfolioTab(userId, body);
    });
  });
}

function openPortfolioEditor(userId, project = null) {
  project = project || { title: "", description: "", image_url: "", link_url: "", link_label: "", skills_used: [] };
  openModal(`
    <div class="modalTitle">${project.id ? "Edit" : "Add"} Portfolio Project</div>
    <div class="field"><label>Title</label><input id="ppTitle" value="${escapeHtml(project.title || "")}" placeholder="e.g. Brand redesign for Acme Co." /></div>
    <div class="field"><label>Description</label><textarea id="ppDesc" rows="3" placeholder="What did you build, and what was your role?">${escapeHtml(project.description || "")}</textarea></div>
    <div class="field">
      <label>Cover image (optional)</label>
      <div class="photoPickerWrap">
        <input type="file" id="ppImageFile" accept="image/*" class="hidden" />
        <button type="button" class="btn btnGhost btnSm" id="btnPickPortfolioImage">📷 Choose image</button>
        <span id="ppImageName" style="font-size:12px;color:var(--muted);margin-left:8px">${project.image_url ? "Current image set" : ""}</span>
        <img loading="lazy" id="ppImagePreview" class="${project.image_url ? "" : "hidden"}" src="${escapeHtml(project.image_url || "")}" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px;margin-top:8px" />
      </div>
    </div>
    <div class="field"><label>Link (optional)</label><input id="ppLinkUrl" value="${escapeHtml(project.link_url || "")}" placeholder="https://..." /></div>
    <div class="field"><label>Link label</label><input id="ppLinkLabel" value="${escapeHtml(project.link_label || "")}" placeholder="e.g. View live site, View case study" /></div>
    <div class="field"><label>Skills used</label><input id="ppSkills" value="${escapeHtml((project.skills_used || []).join(", "))}" placeholder="Figma, React, Copywriting" /></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btnGhost" id="modalCancel">Cancel</button>
      <button class="btn btnPrimary" id="btnSavePortfolio">Save</button>
    </div>
  `);
  $("modalCancel").addEventListener("click", closeModal);

  let pendingImageFile = null;
  $("btnPickPortfolioImage").addEventListener("click", () => $("ppImageFile").click());
  $("ppImageFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingImageFile = file;
    $("ppImageName").textContent = file.name;
    const reader = new FileReader();
    reader.onload = ev => { $("ppImagePreview").src = ev.target.result; $("ppImagePreview").classList.remove("hidden"); };
    reader.readAsDataURL(file);
  });

  $("btnSavePortfolio").addEventListener("click", async () => {
    const title = $("ppTitle").value.trim();
    if (!title) { showToast("Please add a title."); markFieldErrors(["ppTitle"]); return; }

    const btn = $("btnSavePortfolio");
    btn.disabled = true; btn.textContent = "Saving…";

    let imageUrl = project.image_url || null;
    if (pendingImageFile) {
      const uploaded = await uploadProfileImage(pendingImageFile, "portfolio");
      if (uploaded) imageUrl = uploaded;
    }

    const payload = {
      title,
      description: $("ppDesc").value.trim(),
      image_url: imageUrl,
      link_url: $("ppLinkUrl").value.trim() || null,
      link_label: $("ppLinkLabel").value.trim() || null,
      skills_used: $("ppSkills").value.split(",").map(s => s.trim()).filter(Boolean),
    };

    let error;
    if (project.id) {
      ({ error } = await supabaseClient.from("portfolio_projects").update(payload).eq("id", project.id));
    } else {
      ({ error } = await supabaseClient.from("portfolio_projects").insert({ ...payload, user_id: userId }));
    }
    btn.disabled = false; btn.textContent = "Save";
    if (error) { showToast("Could not save project: " + error.message); return; }
    showToast("🎨 Portfolio updated!");
    closeModal();
    loadProfileViewTab(userId, "portfolio");
  });
}

// --- Video comments modal (reused by profile view Videos tab) ---
async function openVideoCommentsModal(v) {
  openModal(`
    <div class="modalTitle">💬 Comments</div>
    <div id="vidCommentsList" class="list" style="margin-bottom:12px"><div class="emptyState">Loading…</div></div>
    <div class="field"><textarea id="vidCommentInput" rows="2" placeholder="Write a comment…"></textarea></div>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button class="btn btnGhost" id="modalCancel">Close</button>
      <button class="btn btnPrimary" id="vidCommentSubmit">Post</button>
    </div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  async function refreshComments() {
    const { data } = await supabaseClient.from("video_comments").select("*").eq("video_id", v.id).order("created_at", { ascending: false });
    const list = $("vidCommentsList");
    if (!list) return;
    if (!data || !data.length) { list.innerHTML = `<div class="emptyState">No comments yet — be the first!</div>`; return; }
    list.innerHTML = data.map(c => `
      <div class="listItem" style="flex-direction:column;align-items:flex-start">
        <div class="itemTitle" style="font-size:13px">${escapeHtml(c.author_name || "VORTEXIA user")}</div>
        <div class="itemMeta">${escapeHtml(c.body)}</div>
      </div>`).join("");
  }
  await refreshComments();
  $("vidCommentSubmit").addEventListener("click", async () => {
    const body = $("vidCommentInput").value.trim();
    if (!body) return;
    const { error } = await supabaseClient.from("video_comments").insert({
      video_id: v.id, author_id: currentUser.id, author_name: currentProfile?.full_name || "VORTEXIA user", body,
    });
    if (error) { showToast("Could not post comment: " + error.message); return; }
    if (v.uploaded_by) {
      createNotification({ user_id: v.uploaded_by, type: "post_commented", title: `${currentProfile?.full_name || "Someone"} commented on your video`, body: body.slice(0, 120) });
    }
    $("vidCommentInput").value = "";
    await refreshComments();
  });
}

// --- Marketplace comments modal (pending #12, mirrors openVideoCommentsModal) ---
async function openMarketplaceCommentsModal(l) {
  openModal(`
    <div class="modalTitle">💬 Comments</div>
    <div id="mkCommentsList" class="list" style="margin-bottom:12px"><div class="emptyState">Loading…</div></div>
    <div class="field"><textarea id="mkCommentInput" rows="2" placeholder="Write a comment…"></textarea></div>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button class="btn btnGhost" id="modalCancel">Close</button>
      <button class="btn btnPrimary" id="mkCommentSubmit">Post</button>
    </div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  async function refreshComments() {
    const { data } = await supabaseClient.from("marketplace_comments").select("*").eq("listing_id", l.id).order("created_at", { ascending: false });
    const list = $("mkCommentsList");
    if (!list) return;
    if (!data || !data.length) { list.innerHTML = `<div class="emptyState">No comments yet — be the first!</div>`; return; }
    list.innerHTML = data.map(c => `
      <div class="listItem" style="flex-direction:column;align-items:flex-start">
        <div class="itemTitle" style="font-size:13px">${escapeHtml(c.author_name || "VORTEXIA user")}</div>
        <div class="itemMeta">${escapeHtml(c.body)}</div>
      </div>`).join("");
  }
  await refreshComments();
  $("mkCommentSubmit").addEventListener("click", async () => {
    const body = $("mkCommentInput").value.trim();
    if (!body) return;
    const { error } = await supabaseClient.from("marketplace_comments").insert({
      listing_id: l.id, author_id: currentUser.id, author_name: currentProfile?.full_name || "VORTEXIA user", body,
    });
    if (error) { showToast("Could not post comment: " + error.message); return; }
    if (l.posted_by) {
      createNotification({ user_id: l.posted_by, type: "post_commented", title: `${currentProfile?.full_name || "Someone"} commented on your listing`, body: body.slice(0, 120) });
    }
    $("mkCommentInput").value = "";
    await refreshComments();
  });
}

// --- Privacy settings: Blocked users ---
$("btnPrivacyBlocks").addEventListener("click", openBlockedUsersModal);

async function openBlockedUsersModal() {
  openModal(`
    <div class="modalTitle">Privacy — Blocked users</div>
    <div class="itemMeta" style="margin-bottom:12px">Blocked people can no longer message or call you. Type their VORTEXIA email to block someone.</div>
    <div class="field"><label>Email to block</label><input type="email" id="blockEmailInput" placeholder="someone@example.com" /></div>
    <button class="btn btnDanger btnBlock" id="btnBlockSubmit" style="margin-bottom:16px">Block this person</button>
    <div class="cardTitle" style="font-size:13px;margin-bottom:6px">Currently blocked</div>
    <div id="blockList" class="list"><div class="emptyState">Loading…</div></div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px">
      <button class="btn btnGhost" id="modalCancel">Close</button>
    </div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  $("btnBlockSubmit").addEventListener("click", blockUserByEmail);
  await renderBlockList();
}

async function blockUserByEmail() {
  const email = $("blockEmailInput").value.trim();
  if (!email) return;
  const { data: found } = await supabaseClient.rpc("lookup_profile_by_email", { p_email: email });
  const match = Array.isArray(found) ? found[0] : found;
  if (!match || !match.id) { showToast("No VORTEXIA account found with that email."); return; }
  if (match.id === currentUser.id) { showToast("You can't block yourself."); return; }
  const { error } = await supabaseClient.from("blocked_users").insert({ blocker_id: currentUser.id, blocked_id: match.id });
  if (error) { showToast(error.code === "23505" ? "Already blocked." : error.message); return; }
  $("blockEmailInput").value = "";
  showToast("Blocked.");
  renderBlockList();
}

async function renderBlockList() {
  const el = $("blockList");
  const { data, error } = await supabaseClient
    .from("blocked_users")
    .select("id, profiles:blocked_id(full_name)")
    .order("created_at", { ascending: false });
  if (error) { el.innerHTML = `<div class="emptyState">${escapeHtml(error.message)}</div>`; return; }
  if (!data.length) { el.innerHTML = `<div class="emptyState">No one blocked yet.</div>`; return; }
  el.innerHTML = data.map(b => `
    <div class="listItem">
      <div class="itemTitle" style="font-size:13px">${escapeHtml(b.profiles?.full_name || "Unknown user")}</div>
      <button class="btn btnGhost btnSm" data-unblock="${b.id}">Unblock</button>
    </div>`).join("");
  el.querySelectorAll("[data-unblock]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await supabaseClient.from("blocked_users").delete().eq("id", btn.dataset.unblock);
      renderBlockList();
    });
  });
}

// --- Send feedback ---
$("btnFeedback").addEventListener("click", () => {
  const subject = encodeURIComponent("VORTEXIA Feedback");
  const body = encodeURIComponent(`Hi VORTEXIA team,\n\n(Write your feedback here)\n\n—\nApp version: ${APP_VERSION}\nAccount: ${currentProfile?.full_name || ""}`);
  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
});

// --- Clear cache ---
$("btnClearCache").addEventListener("click", () => {
  if (!confirm("This clears locally cached app data on this device and reloads VORTEXIA. Your account and data on the server are not affected. Continue?")) return;
  try {
    const keepSupabaseAuth = Object.keys(localStorage).filter(k => k.startsWith("sb-"));
    const keep = {};
    keepSupabaseAuth.forEach(k => keep[k] = localStorage.getItem(k));
    localStorage.clear();
    Object.entries(keep).forEach(([k, v]) => localStorage.setItem(k, v));
    sessionStorage.clear();
    if (window.caches) caches.keys().then(names => names.forEach(n => caches.delete(n)));
  } catch (e) { console.error(e); }
  showToast("Cache cleared.");
  setTimeout(() => location.reload(), 600);
});

// --- App support ---
$("btnAppSupport").addEventListener("click", () => {
  openModal(`
    <div class="modalTitle">App support</div>
    <div class="itemMeta" style="margin-bottom:10px">Need help with VORTEXIA? Reach us here:</div>
    <div class="listItem"><div class="itemTitle" style="font-size:13px">Email</div><a class="btn btnGhost btnSm" href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></div>
    <div class="listItem"><div class="itemTitle" style="font-size:13px">Website</div><span class="itemMeta">Coming soon — a support page will be linked here once our own domain is live.</span></div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
});

// --- Privacy policy ---
$("btnPrivacyPolicy").addEventListener("click", () => {
  openModal(`
    <div class="modalTitle">Privacy policy</div>
    <div class="itemMeta" style="max-height:50vh;overflow-y:auto;line-height:1.5;text-align:left">
      <p><strong>Last updated:</strong> ${APP_BUILD_DATE}</p>
      <p><strong>What we collect:</strong> your name, email, and any bio/avatar you add to your profile; meetings and chat messages you create or take part in; whiteboard content you draw; basic call metadata (who, when, how long) for calls you make in the app.</p>
      <p><strong>How it's used:</strong> solely to run VORTEXIA's features for you — scheduling meetings, chat, voice calls, and optional email reminders. We don't sell your data or show ads.</p>
      <p><strong>Where it's stored:</strong> Supabase (a hosted Postgres database), with access rules that only let you and people you're meeting/chatting with see the relevant data.</p>
      <p><strong>Third parties:</strong> Jitsi Meet provides the underlying video/voice connection for calls; Resend delivers email reminders. Neither is given more than what's needed to provide those features.</p>
      <p><strong>Your controls:</strong> you can edit or delete your profile, block other users from contacting you, and permanently delete your account (Profile → Danger zone) at any time.</p>
      <p><strong>Contact:</strong> ${SUPPORT_EMAIL}</p>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
});

// --- About the developer ---
$("btnAboutDeveloper").addEventListener("click", () => {
  openModal(`
    <div class="modalTitle">About the developer</div>
    <div class="itemMeta" style="line-height:1.6">
      <p><strong>John Lloyd Salazar Biendima</strong></p>
      <p>Science City of Muñoz, 3119<br/>Nueva Ecija, Philippines</p>
      <p style="margin-top:10px">Founder &amp; developer of VORTEXIA.</p>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
});
// Membership / VIP plans
// ---------------------------------------------------------------------------
function computeMembershipStatus(p) {
  const now = Date.now();

  if (p.vip_status === "trialing" && p.trial_ends_at && new Date(p.trial_ends_at).getTime() > now) {
    return {
      state: "trialing",
      badgeText: "Free Trial",
      detail: `On the ${planName(p.plan)} trial — ends ${fmtDate(p.trial_ends_at)}.`,
    };
  }

  if (p.vip_status === "active" && (!p.vip_until || new Date(p.vip_until).getTime() > now)) {
    return {
      state: "active",
      badgeText: "VIP Verified",
      detail: p.vip_until
        ? `${planName(p.plan)} plan — active until ${fmtDate(p.vip_until)}.`
        : `${planName(p.plan)} plan — active.`,
    };
  }

  if (p.vip_status === "expired" || (p.vip_status === "trialing" && p.trial_ends_at && new Date(p.trial_ends_at).getTime() <= now)) {
    return {
      state: "expired",
      badgeText: "Expired",
      detail: `Your ${planName(p.plan)} membership has ended. Renew below to get VIP features back.`,
    };
  }

  return {
    state: "free",
    badgeText: "Free",
    detail: "Upgrade to unlock the AI Companion and more.",
  };
}

function planName(planId) {
  const plan = plansCache.find(pl => pl.id === planId);
  return plan ? plan.name : "Free";
}

// ---------------------------------------------------------------------------
// Phase 11 — Premium Themes (VIP perk)
// ---------------------------------------------------------------------------
const ACCENT_THEMES = [
  { id: "default", label: "VORTEXIA Navy", swatch: "linear-gradient(90deg,#0A2463,#2F8FE0)" },
  { id: "sunset", label: "Sunset", swatch: "linear-gradient(90deg,#7C2D12,#F97316)" },
  { id: "forest", label: "Forest", swatch: "linear-gradient(90deg,#14532D,#22C55E)" },
  { id: "royal", label: "Royal", swatch: "linear-gradient(90deg,#4C1D95,#8B5CF6)" },
];

function applyAccentTheme(themeId) {
  document.documentElement.setAttribute("data-theme", themeId === "default" ? "" : themeId);
}

function openThemePicker() {
  const membership = computeMembershipStatus(currentProfile || {});
  const isVip = membership.state === "trialing" || membership.state === "active";
  const current = (currentProfile && currentProfile.accent_theme) || "default";

  openModal(`
    <div class="modalTitle">🎨 Premium Theme</div>
    ${!isVip ? `<div class="itemMeta" style="margin-bottom:10px">Free plan uses the default theme. Upgrade to VIP to unlock the rest.</div>` : ""}
    <div class="themeSwatchGrid">
      ${ACCENT_THEMES.map(t => `
        <button type="button" class="themeSwatch ${current === t.id ? "active" : ""}" data-theme-id="${t.id}" ${(!isVip && t.id !== "default") ? "disabled style='opacity:.5;cursor:not-allowed'" : ""}>
          <div class="themeSwatchDot" style="background:${t.swatch}"></div>
          <div class="themeSwatchLabel">${t.label}${(!isVip && t.id !== "default") ? " 🔒" : ""}</div>
        </button>`).join("")}
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button class="btn btnGhost" id="modalCancel">Close</button>
    </div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  $("modalCard").querySelectorAll(".themeSwatch:not([disabled])").forEach(btn => {
    btn.addEventListener("click", async () => {
      const themeId = btn.dataset.themeId;
      applyAccentTheme(themeId);
      if (currentProfile) currentProfile.accent_theme = themeId;
      try { await supabaseClient.from("profiles").update({ accent_theme: themeId }).eq("id", currentUser.id); } catch (e) { /* non-critical */ }
      showToast("🎨 Theme updated!");
      closeModal();
    });
  });
}
$("btnPremiumTheme")?.addEventListener("click", openThemePicker);

// Who Viewed My Profile — VIP-only feature
$("btnWhoViewedMe")?.addEventListener("click", async () => {
  const p = currentProfile || {};
  const membership = computeMembershipStatus(p);
  const isVip = membership.state === "trialing" || membership.state === "active";
  if (!isVip) {
    openModal(`
      <div class="modalTitle">👁️ Who viewed my profile</div>
      <div class="itemMeta" style="margin:12px 0 16px">This is a VIP feature. Upgrade to VIP to see who's been checking out your profile in the last 30 days.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btnGhost" id="modalCancel">Close</button>
        <button class="btn btnPrimary" id="btnUpgradeFromViewers">👑 Upgrade to VIP</button>
      </div>
    `);
    $("modalCancel").addEventListener("click", closeModal);
    $("btnUpgradeFromViewers")?.addEventListener("click", () => { closeModal(); setActiveView("profile"); });
    return;
  }
  openModal(`<div class="modalTitle">👁️ Who viewed my profile</div><div class="emptyState" style="padding:24px 0">Loading…</div>`);
  const { data, error } = await supabaseClient
    .from("profile_view_log")
    .select("viewer_id, viewed_at")
    .eq("subject_id", currentUser.id)
    .order("viewed_at", { ascending: false })
    .limit(50);
  if (error || !data || !data.length) {
    openModal(`
      <div class="modalTitle">👁️ Who viewed my profile</div>
      <div class="emptyState" style="padding:24px 0">No profile views in the last 30 days yet — share your profile link to get noticed!</div>
      <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>
    `);
    $("modalCancel").addEventListener("click", closeModal);
    return;
  }
  // Batch-fetch viewer names
  const viewerIds = [...new Set(data.map(r => r.viewer_id))];
  const { data: viewers } = await supabaseClient.from("profiles").select("id, full_name, avatar_url, mg_id").in("id", viewerIds);
  const viewerMap = {};
  (viewers || []).forEach(v => { viewerMap[v.id] = v; });
  // Deduplicate: show only the most recent view per viewer
  const seen = new Set();
  const deduped = data.filter(r => { if (seen.has(r.viewer_id)) return false; seen.add(r.viewer_id); return true; });
  openModal(`
    <div class="modalTitle">👁️ Who viewed my profile</div>
    <div class="itemMeta" style="margin-bottom:12px">${deduped.length} unique viewer${deduped.length === 1 ? "" : "s"} in the last 30 days</div>
    <div class="list">${deduped.map(r => {
      const v = viewerMap[r.viewer_id];
      if (!v) return "";
      const initial = (v.full_name || "?").trim().charAt(0).toUpperCase();
      return `<div class="listItem" style="cursor:pointer" data-viewer-id="${v.id}">
        <div style="width:38px;height:38px;border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--blue);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700">
          ${v.avatar_url ? `<img src="${escapeHtml(v.avatar_url)}" style="width:100%;height:100%;object-fit:cover" />` : escapeHtml(initial)}
        </div>
        <div style="flex:1;min-width:0">
          <div class="itemTitle">${escapeHtml(v.full_name || "VORTEXIA user")}</div>
          <div class="itemMeta">@${escapeHtml(v.mg_id || "")} · ${fmtDate(r.viewed_at)}</div>
        </div>
      </div>`;
    }).join("")}</div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  $("modalCard").querySelectorAll("[data-viewer-id]").forEach(row => {
    row.addEventListener("click", () => { closeModal(); openProfileView(row.dataset.viewerId); });
  });
});

function renderMembershipSection(membership) {
  $("membershipStatusBadge").textContent = membership.badgeText;
  $("membershipStatusBadge").className = "badge " + (membership.state === "free" ? "badgeFree" : "badgeVip");
  $("membershipStatusDetail").textContent = membership.detail;

  const grid = $("planGrid");
  if (!plansCache.length) { grid.innerHTML = `<div class="emptyState">Plans are unavailable right now.</div>`; return; }

  const p = currentProfile;
  const isCurrentlyEntitled = membership.state === "trialing" || membership.state === "active";

  grid.innerHTML = plansCache.map(plan => {
    const isCurrentPlan = isCurrentlyEntitled && p.plan === plan.id;
    const priceLabel = `₱${Number(plan.price_php).toLocaleString()}<span> / ${plan.billing_interval === "year" ? "year" : "month"}</span>`;

    let actionsHtml;
    if (isCurrentPlan) {
      actionsHtml = `<div class="planCurrentTag">✓ Your current plan</div>`;
    } else {
      const trialBtn = !p.has_used_trial
        ? `<button class="btn btnGhost" data-trial="${plan.id}">Start Free Trial</button>`
        : "";
      actionsHtml = `
        <div class="planActions">
          ${trialBtn}
          <button class="btn btnPrimary" data-pay="${plan.id}">Pay ₱${Number(plan.price_php).toLocaleString()}</button>
        </div>`;
    }

    return `
      <div class="planCard ${plan.is_popular ? "popular" : ""} ${isCurrentPlan ? "current" : ""}">
        ${plan.is_popular ? `<div class="planPopularTag">Most Popular</div>` : ""}
        <div class="planName">${escapeHtml(plan.name)}</div>
        <div class="planPrice">${priceLabel}</div>
        <div class="planTagline">${escapeHtml(plan.tagline || "")}</div>
        ${actionsHtml}
      </div>`;
  }).join("");

  grid.querySelectorAll("[data-trial]").forEach(btn => {
    btn.addEventListener("click", () => startFreeTrial(btn.dataset.trial));
  });
  grid.querySelectorAll("[data-pay]").forEach(btn => {
    btn.addEventListener("click", () => startCheckout(btn.dataset.pay));
  });
}

$("btnRedeemCode").addEventListener("click", async () => {
  const code = $("redeemCodeInput").value.trim();
  if (!code) { showToast("Enter a code first."); return; }
  const btn = $("btnRedeemCode");
  btn.disabled = true;
  try {
    const { data, error } = await supabaseClient.rpc("redeem_vip_code", { p_code: code });
    if (error) throw error;
    showToast("Code redeemed! +7 days added to your membership.");
    $("redeemCodeInput").value = "";
    await loadProfile();
  } catch (err) {
    showToast((err && err.message) ? err.message : "That code isn't valid or has already been used.");
  } finally {
    btn.disabled = false;
  }
});

async function startFreeTrial(planId) {
  const { error } = await supabaseClient.rpc("start_free_trial", { p_plan_id: planId });
  if (error) { showToast(error.message || "Could not start your free trial."); return; }
  showToast("Free trial started! Enjoy your VIP features.");
  await loadProfile();
  await loadCommunityRoles(); // Pending #13
}

async function startCheckout(planId) {
  showToast("Opening secure checkout…");
  try {
    const { data, error } = await supabaseClient.functions.invoke("paymongo_create_checkout", {
      body: {
        plan_id: planId,
        success_url: location.origin + location.pathname + "?vip=success",
        cancel_url: location.origin + location.pathname + "?vip=cancelled",
      },
    });
    if (error) throw error;
    if (data && data.checkout_url) {
      location.href = data.checkout_url;
    } else {
      showToast((data && data.error) ? JSON.stringify(data.error) : "Could not start checkout.");
    }
  } catch (err) {
    showToast("Could not start checkout: " + (err && err.message ? err.message : "Unknown error"));
  }
}

// ---------------------------------------------------------------------------
// AI Companion (VIP) — meeting notes / chat recaps via the groq-ai Edge Function
// ---------------------------------------------------------------------------
function renderAiCompanion(isVip) {
  $("aiCompanionLocked").classList.toggle("hidden", isVip);
  $("aiCompanionUnlocked").classList.toggle("hidden", !isVip);
  if (!isVip) return;

  const select = $("aiRoomSelect");
  const prevValue = select.value;
  const rooms = meetingsCache.concat(chatThreadsCache).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!rooms.length) {
    select.innerHTML = `<option value="">No meetings or chats yet</option>`;
    return;
  }

  select.innerHTML = rooms.map(m => {
    const label = m.status === "chat"
      ? `Chat — ${m.title}`
      : `Meeting — ${m.title}${m.scheduled_at ? " (" + fmtDate(m.scheduled_at) + ")" : ""}`;
    return `<option value="${m.id}">${escapeHtml(label)}</option>`;
  }).join("");

  if (prevValue && rooms.some(r => r.id === prevValue)) select.value = prevValue;
}

$("btnAiGenerate").addEventListener("click", generateAiSummary);

async function generateAiSummary() {
  const roomId = $("aiRoomSelect").value;
  const box = $("aiOutputBox");
  if (!roomId) { showToast("Pumili muna ng meeting o chat."); return; }

  const room = findAnyRoomCached(roomId);
  box.classList.remove("hidden");
  box.classList.add("aiLoading");
  box.textContent = "Generating summary…";

  const { data: msgs, error: msgError } = await supabaseClient
    .from("meeting_messages")
    .select("sender_id, body, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (msgError) {
    box.classList.remove("aiLoading");
    box.textContent = "Could not load messages: " + msgError.message;
    return;
  }

  if (!msgs || !msgs.length) {
    box.classList.remove("aiLoading");
    box.textContent = "No messages yet in this meeting/chat to summarize.";
    return;
  }

  const senderIds = [...new Set(msgs.map(m => m.sender_id))];
  const { data: profs } = await supabaseClient.from("profiles").select("id, full_name, email").in("id", senderIds);
  const nameMap = {};
  (profs || []).forEach(p => { nameMap[p.id] = p.full_name || p.email || "Participant"; });

  const transcript = msgs
    .map(m => `${m.sender_id === currentUser.id ? "You" : (nameMap[m.sender_id] || "Participant")}: ${m.body}`)
    .join("\n");

  const prompt = `Summarize the following conversation from "${room ? room.title : "this conversation"}". ` +
    `Respond with three short sections: 1) Overview, 2) Key points, 3) Action items (write "None" if there aren't any). ` +
    `Keep it concise and use plain text with simple headings, no markdown symbols.\n\nConversation:\n${transcript}`;

  try {
    const { data, error: fnError } = await supabaseClient.functions.invoke("groq-ai", {
      body: {
        prompt,
        meta: {
          appName: "VORTEXIA",
          platform: "web",
          preferredLanguage: currentProfile.language || "en",
        },
      },
    });
    if (fnError) throw fnError;
    box.classList.remove("aiLoading");
    box.textContent = (data && data.text) ? data.text : "No summary was returned.";
  } catch (err) {
    box.classList.remove("aiLoading");
    box.textContent = "Could not generate summary: " + (err && err.message ? err.message : "Unknown error");
  }
}

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Meeting Wizard (3 steps: Title/Date -> Duration/Passcode/Guests -> Confirm+Share)
// ---------------------------------------------------------------------------
let wizState = {};

$("btnOpenScheduleWizard").addEventListener("click", () => {
  const membership = computeMembershipStatus(currentProfile || {});
  const isVip = membership.state === "trialing" || membership.state === "active";
  wizState = { title: "", date: "", time: "", duration: 40, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, passcode: "", invites: "", waitingRoom: true, isVip };
  renderWizardStep(1);
});

function renderWizardStep(step) {
  wizState.step = step;
  let body = "";
  if (step === 1) {
    body = `
      <div class="modalTitle">Step 1 of 3 — Title &amp; Time</div>
      <div class="field"><label>Title</label><input type="text" id="wizTitle" required placeholder="Weekly team sync" value="${escapeHtml(wizState.title)}" /></div>
      <div class="fieldRow">
        <div class="field"><label>Date</label><input type="date" id="wizDate" required value="${wizState.date}" /></div>
        <div class="field"><label>Time</label><input type="time" id="wizTime" required value="${wizState.time}" /></div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button class="btn btnGhost" id="modalCancel">Cancel</button>
        <button class="btn btnPrimary" id="wizNext">Next</button>
      </div>`;
    openModal(body);
    $("modalCancel").addEventListener("click", closeModal);
    $("wizNext").addEventListener("click", () => {
      const title = $("wizTitle").value.trim();
      const date = $("wizDate").value;
      const time = $("wizTime").value;
      clearFieldErrors(["wizTitle", "wizDate", "wizTime"]);
      if (!title) { showToast("Please enter a title."); markFieldErrors(["wizTitle"]); return; }
      if (!date || !time) { showToast("Please pick a date and time."); markFieldErrors([!date ? "wizDate" : "wizTime", !time ? "wizTime" : null].filter(Boolean)); return; }
      wizState.title = title; wizState.date = date; wizState.time = time;
      renderWizardStep(2);
    });
  } else if (step === 2) {
    body = `
      <div class="modalTitle">Step 2 of 3 — Settings</div>
      <div class="fieldRow">
        <div class="field"><label>Duration (minutes)</label><input type="number" id="wizDuration" value="${wizState.duration}" min="5" max="${wizState.isVip ? 600 : 40}" required /><div class="itemMeta" style="margin-top:4px">${wizState.isVip ? "👑 VIP: no meeting length limit." : "Free plan: capped at 40 minutes. Upgrade to VIP for unlimited meetings."}</div></div>
        <div class="field"><label>Time zone</label><select id="wizTimezone"></select></div>
      </div>
      <div class="field"><label>Invite participants (emails, comma separated)</label><input type="text" id="wizInvites" placeholder="ana@company.com, ben@company.com" value="${escapeHtml(wizState.invites)}" /></div>
      <div class="field"><label>Passcode (optional)</label><input type="text" id="wizPasscode" placeholder="Leave blank for none" value="${escapeHtml(wizState.passcode)}" /></div>
      <div class="field" style="display:flex;align-items:center;gap:10px">
        <input type="checkbox" id="wizWaitingRoom" ${wizState.waitingRoom ? "checked" : ""} style="width:auto" />
        <label style="margin:0" for="wizWaitingRoom">Enable waiting room (you approve each guest before they join)</label>
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:14px">
        <button class="btn btnGhost" id="wizBack">Back</button>
        <button class="btn btnPrimary" id="wizNext">Next</button>
      </div>`;
    openModal(body);
    populateTimezones($("wizTimezone"));
    $("wizTimezone").value = wizState.timezone;
    $("wizBack").addEventListener("click", () => {
      wizState.duration = parseInt($("wizDuration").value, 10) || wizState.duration;
      wizState.invites = $("wizInvites").value;
      wizState.passcode = $("wizPasscode").value;
      renderWizardStep(1);
    });
    $("wizNext").addEventListener("click", () => {
      let duration = parseInt($("wizDuration").value, 10) || 40;
      if (!wizState.isVip && duration > 40) { duration = 40; showToast("Free plan is capped at 40 minutes — upgrade to VIP for unlimited length."); }
      wizState.duration = duration;
      wizState.timezone = $("wizTimezone").value;
      wizState.invites = $("wizInvites").value.trim();
      wizState.passcode = $("wizPasscode").value.trim();
      wizState.waitingRoom = $("wizWaitingRoom").checked;
      renderWizardStep(3);
    });
  } else if (step === 3) {
    const invitedList = wizState.invites ? wizState.invites.split(",").map(s => s.trim()).filter(Boolean) : [];
    body = `
      <div class="modalTitle">Step 3 of 3 — Confirm</div>
      <div class="itemMeta" style="margin-bottom:6px"><strong>${escapeHtml(wizState.title)}</strong></div>
      <div class="itemMeta">${fmtDate(new Date(`${wizState.date}T${wizState.time}:00`).toISOString())} • ${wizState.duration} min • ${escapeHtml(wizState.timezone)}</div>
      <div class="itemMeta">${wizState.passcode ? "Passcode set" : "No passcode"} • Waiting room ${wizState.waitingRoom ? "on" : "off"}</div>
      <div class="itemMeta">${invitedList.length ? `Inviting: ${invitedList.map(escapeHtml).join(", ")}` : "No invited emails"}</div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:14px">
        <button class="btn btnGhost" id="wizBack">Back</button>
        <button class="btn btnPrimary" id="wizConfirm">Schedule Meeting</button>
      </div>`;
    openModal(body);
    $("wizBack").addEventListener("click", () => renderWizardStep(2));
    $("wizConfirm").addEventListener("click", async () => {
      $("wizConfirm").disabled = true; $("wizConfirm").textContent = "Scheduling…";
      const scheduled_at = new Date(`${wizState.date}T${wizState.time}:00`).toISOString();
      const { data, error } = await supabaseClient.rpc("create_meeting", {
        p_title: wizState.title,
        p_scheduled_at: scheduled_at,
        p_duration_minutes: wizState.duration,
        p_timezone: wizState.timezone,
        p_status: "scheduled",
        p_passcode: wizState.passcode || null,
        p_invited_emails: invitedList,
      });
      if (error) { showToast("Could not schedule meeting: " + error.message); $("wizConfirm").disabled = false; $("wizConfirm").textContent = "Schedule Meeting"; return; }
      await supabaseClient.from("meetings").update({ waiting_room_enabled: wizState.waitingRoom }).eq("id", data.id);
      await addParticipantsByEmail(data.id, invitedList);
      await loadMeetings();
      const link = `${location.origin}${location.pathname}#join=${data.meeting_code}`;
      openModal(`
        <div class="modalTitle">🎉 Meeting scheduled!</div>
        <div class="itemMeta" style="margin-bottom:10px">Share this link with your guests:</div>
        <div class="field"><input type="text" id="wizShareLink" readonly value="${link}" /></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
          <button class="btn btnPrimary" id="wizCopyLink">Copy link</button>
          <button class="btn btnGhost" id="modalCancel">Done</button>
        </div>`);
      $("modalCancel").addEventListener("click", closeModal);
      $("wizCopyLink").addEventListener("click", () => {
        navigator.clipboard?.writeText(link).then(() => showToast("Invite link copied."));
      });
    });
  }
}

async function addParticipantsByEmail(meetingId, emails) {
  for (const email of emails) {
    try {
      const { data: found } = await supabaseClient.rpc("lookup_profile_by_email", { p_email: email });
      const match = Array.isArray(found) ? found[0] : found;
      if (match && match.id) {
        await supabaseClient.from("meeting_participants").insert({ room_id: meetingId, user_id: match.id, role: "member" });
      }
    } catch (err) { console.warn("lookup failed for", email, err); }
  }
}

async function startInstantMeeting() {
  if (!throttleAction("startInstantMeeting", 4000)) return;
  const { data, error } = await supabaseClient.rpc("create_meeting", {
    p_title: "Instant Meeting",
    p_scheduled_at: new Date().toISOString(),
    p_duration_minutes: 40,
    p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    p_status: "live",
  });
  if (error) { showToast("Could not start meeting: " + error.message); return; }
  await loadMeetings();
  joinMeeting(data);
}

async function loadMeetings() {
  // Pending #10 resolved: chat threads now have their own paginated query
  // (loadChatThreads) so this only needs to cover real meetings/calls.
  const { data, error } = await supabaseClient.from("meetings").select("*").neq("status", "chat").order("scheduled_at", { ascending: true }).limit(300);
  if (error) { console.error(error); return; }
  meetingsCache = data || [];
  renderMeetings();
  renderDashboard();
  if (currentProfile) {
    const membership = computeMembershipStatus(currentProfile);
    renderAiCompanion(membership.state === "trialing" || membership.state === "active");
  }
}

// meetingsCache (real meetings only, since #10) and chatThreadsCache (paginated chat
// threads) are now separate queries -- this checks both caches for spots that used to
// assume one combined list (voice-call titles, notification-click navigation, etc).
// Only checks what's already loaded client-side; a chat outside the currently-loaded
// page just falls back gracefully (e.g. "Unknown" title) rather than erroring.
function findAnyRoomCached(id) {
  return meetingsCache.find(m => m.id === id) || (typeof chatThreadsCache !== "undefined" ? chatThreadsCache.find(m => m.id === id) : null);
}

function renderDashboard() {
  // Dynamic greeting based on time of day
  const hour = new Date().getHours();
  let greeting = "Good evening";
  if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";
  
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  $("dashGreeting").textContent = `${greeting} 👋 • ${today}`;
  
  const now = Date.now();
  const upcoming = meetingsCache.filter(m => m.status !== "chat" && m.status !== "ended" && (!m.scheduled_at || new Date(m.scheduled_at).getTime() >= now - 60*60*1000));
  const history = meetingsCache.filter(m => m.status === "ended");
  $("mUpcoming").textContent = upcoming.length;
  $("mHistory").textContent = history.length;

  if (history.length) {
    const lastMeeting = [...history].sort((a, b) => new Date(b.ended_at || b.scheduled_at) - new Date(a.ended_at || a.scheduled_at))[0];
    $("lastMeetingLabel").textContent = `Last meeting: ${fmtDate(lastMeeting.ended_at || lastMeeting.scheduled_at)} — "${lastMeeting.title || "Untitled meeting"}"`;
  } else {
    $("lastMeetingLabel").textContent = "No meetings yet.";
  }

  const list = $("dashUpcomingList");
  if (!upcoming.length) { list.innerHTML = `<div class="emptyState">No upcoming meetings yet.</div>`; return; }
  list.innerHTML = upcoming.slice(0, 5).map(m => meetingListItemHTML(m, false)).join("");
  bindMeetingListButtons(list);
}

function meetingListItemHTML(m, isPast) {
  const isHost = m.created_by === currentUser.id;
  const isLive = m.status === "started" || m.status === "live";
  let statusPill = "";
  if (isPast) statusPill = `<span class="meetStatusPill meetStatusPill--ended">⏹ Ended</span>`;
  else if (isLive) statusPill = `<span class="meetStatusPill meetStatusPill--live">🔴 Live</span>`;
  else statusPill = `<span class="meetStatusPill meetStatusPill--upcoming">📅 Upcoming</span>`;

  return `
    <div class="meetCard${isPast ? " meetCard--past" : ""}" data-id="${m.id}">
      <div class="meetCardTopRow">
        <div class="meetCardIcon">📹</div>
        <div class="meetCardInfo">
          <div class="meetCardTitle">${escapeHtml(m.title || "Untitled meeting")}</div>
          <div class="meetCardMeta">
            ${statusPill}
            <span>${fmtDate(m.scheduled_at)}</span>
            <span>• ${m.duration_minutes} min</span>
            ${isHost ? `<span>• <strong>You're hosting</strong></span>` : ""}
          </div>
        </div>
      </div>
      ${!isPast ? `
      <hr class="meetCardDivider">
      <div class="meetCardActions">
        <button class="btn btnGhost btnSm" data-board="${m.id}" title="Whiteboard">🖊️</button>
        <button class="btn btnGhost btnSm" data-copy="${m.id}">Copy link</button>
        <button class="btn btnPrimary btnSm" data-join="${m.id}">${isLive ? "Rejoin" : "Join"}</button>
      </div>` : ""}
    </div>`;
}

function renderMeetings() {
  const upcoming = meetingsCache.filter(m => m.status !== "chat" && m.status !== "ended");
  const history = meetingsCache.filter(m => m.status === "ended");
  const list = $("meetingsList");
  let html = "";
  if (upcoming.length) html += upcoming.map(m => meetingListItemHTML(m, false)).join("");
  if (history.length) {
    html += `<div class="itemMeta" style="margin:14px 0 8px">Past meetings</div>`;
    html += history.map(m => meetingListItemHTML(m, true)).join("");
  }
  list.innerHTML = html || `<div class="emptyState">No meetings yet — schedule one above or start an instant meeting from the Dashboard.</div>`;
  bindMeetingListButtons(list);
}

function bindMeetingListButtons(container) {
  container.querySelectorAll("[data-join]").forEach(b => b.addEventListener("click", () => {
    const m = meetingsCache.find(x => x.id === b.dataset.join);
    if (m) joinMeeting(m);
  }));
  container.querySelectorAll("[data-copy]").forEach(b => b.addEventListener("click", () => {
    const m = meetingsCache.find(x => x.id === b.dataset.copy);
    if (!m) return;
    const link = `${location.origin}${location.pathname}#join=${m.meeting_code}`;
    navigator.clipboard?.writeText(link).then(() => showToast("Invite link copied."));
  }));
  container.querySelectorAll("[data-board]").forEach(b => b.addEventListener("click", () => {
    setActiveView("whiteboard");
    openWhiteboard(b.dataset.board);
  }));
}

// ---------------------------------------------------------------------------
// Pre-meeting type selector
// ---------------------------------------------------------------------------
let pendingMeetingData = null;
let selectedMeetType = null;
let callTimerInterval = null;
let callStartTime = null;

// Phase 5C state
let activeMeetingRoomId = null;   // meetings.id of the real (non-voice-call) meeting in progress
let activeAttendanceId = null;    // meeting_attendance.id for the current user's session
let activeMeetingIsHost = false;  // whether the current user hosts the in-progress meeting (Phase 7E)
let participantsChannel = null;   // realtime channel for the participants sidebar (Phase 7E)
let hostWaitingChannel = null;    // realtime channel: host watches meeting_waiting_room inserts
let guestWaitingChannel = null;   // realtime channel: guest watches their own waiting-room row
let pollsChannel = null;          // realtime channel: polls + votes for the active room
let currentPollsCache = [];
let myPollVotes = {};             // poll_id -> option_index

function showPreMeetingSelector(meeting) {
  pendingMeetingData = meeting;
  selectedMeetType = null;
  $("preMeetingTitle").textContent = meeting.title || "Start a Meeting";
  document.querySelectorAll(".meetTypeBtn").forEach(b => b.classList.remove("selected"));
  $("btnPreMeetingGo").classList.add("hidden");
  $("preMeetingWrap").classList.remove("hidden");
}

document.querySelectorAll(".meetTypeBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".meetTypeBtn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedMeetType = btn.dataset.type;
    $("btnPreMeetingGo").classList.remove("hidden");
  });
});

$("btnPreMeetingGo").addEventListener("click", async () => {
  if (!selectedMeetType || !pendingMeetingData) return;
  $("preMeetingWrap").classList.add("hidden");
  const meeting = pendingMeetingData;
  const isHost = meeting.created_by === currentUser.id;
  const room = `meetandgreet-${meeting.meeting_code}`;

  if (meeting.waiting_room_enabled !== false && !isHost) {
    showWaitingScreen(meeting);
    try {
      const { data: waitRow, error } = await supabaseClient.rpc("request_join_meeting", {
        p_room_id: meeting.id,
        p_user_name: currentProfile?.full_name || "Guest",
      });
      if (error) throw error;
      subscribeGuestWaitingRoom(waitRow.id, meeting, room);
    } catch (err) {
      hideWaitingScreen();
      showToast("Could not request to join: " + err.message);
    }
    return;
  }

  await proceedToJoinMeeting(meeting, room);
});

$("btnPreMeetingCancel").addEventListener("click", () => {
  $("preMeetingWrap").classList.add("hidden");
  pendingMeetingData = null;
  selectedMeetType = null;
});

function joinMeeting(meeting) {
  showPreMeetingSelector(meeting);
}

// ---------------------------------------------------------------------------
// Waiting room (guest side)
// ---------------------------------------------------------------------------
function showWaitingScreen(meeting) {
  $("waitingScreenTitle").textContent = `"${meeting.title || "Meeting"}" — the host will let you in shortly.`;
  $("waitingScreenWrap").classList.remove("hidden");
}
function hideWaitingScreen() {
  $("waitingScreenWrap").classList.add("hidden");
}

function subscribeGuestWaitingRoom(waitingId, meeting, room) {
  if (guestWaitingChannel) { supabaseClient.removeChannel(guestWaitingChannel); guestWaitingChannel = null; }
  guestWaitingChannel = supabaseClient
    .channel(`waiting-guest-${waitingId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "meeting_waiting_room", filter: `id=eq.${waitingId}` }, async (payload) => {
      const status = payload.new.status;
      if (status === "admitted") {
        hideWaitingScreen();
        supabaseClient.removeChannel(guestWaitingChannel); guestWaitingChannel = null;
        await proceedToJoinMeeting(meeting, room);
      } else if (status === "denied") {
        hideWaitingScreen();
        supabaseClient.removeChannel(guestWaitingChannel); guestWaitingChannel = null;
        showToast("The host didn't admit you into this meeting.");
        pendingMeetingData = null; selectedMeetType = null;
      }
    })
    .subscribe();
}

$("btnCancelWaiting").addEventListener("click", () => {
  hideWaitingScreen();
  if (guestWaitingChannel) { supabaseClient.removeChannel(guestWaitingChannel); guestWaitingChannel = null; }
  pendingMeetingData = null; selectedMeetType = null;
});

// ---------------------------------------------------------------------------
// Waiting room (host side) — banner with Admit/Deny
// ---------------------------------------------------------------------------
function subscribeHostWaitingRoom(roomId) {
  if (hostWaitingChannel) { supabaseClient.removeChannel(hostWaitingChannel); hostWaitingChannel = null; }
  hostWaitingChannel = supabaseClient
    .channel(`waiting-host-${roomId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "meeting_waiting_room", filter: `room_id=eq.${roomId}` }, (payload) => {
      showWaitingRoomBanner(payload.new);
    })
    .subscribe();
}
function unsubscribeHostWaitingRoom() {
  if (hostWaitingChannel) { supabaseClient.removeChannel(hostWaitingChannel); hostWaitingChannel = null; }
  $("waitingRoomBanner").classList.add("hidden");
}

function showWaitingRoomBanner(row) {
  $("wrbName").textContent = row.user_name || "Someone";
  $("waitingRoomBanner").classList.remove("hidden");
  $("waitingRoomBanner").dataset.waitingId = row.id;
}

$("wrbAdmit").addEventListener("click", async () => {
  const id = $("waitingRoomBanner").dataset.waitingId;
  if (!id) return;
  await supabaseClient.rpc("respond_waiting_room", { p_waiting_id: id, p_approve: true });
  $("waitingRoomBanner").classList.add("hidden");
});
$("wrbDeny").addEventListener("click", async () => {
  const id = $("waitingRoomBanner").dataset.waitingId;
  if (!id) return;
  await supabaseClient.rpc("respond_waiting_room", { p_waiting_id: id, p_approve: false });
  $("waitingRoomBanner").classList.add("hidden");
});

// ---------------------------------------------------------------------------
// Call timer
// ---------------------------------------------------------------------------
function startCallTimer() {
  callStartTime = Date.now();
  clearInterval(callTimerInterval);
  callTimerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    $("callTimer").textContent = `${m}:${s}`;
  }, 1000);
}

function stopCallTimer() {
  clearInterval(callTimerInterval);
  callTimerInterval = null;
  $("callTimer").textContent = "00:00";
}

// ---------------------------------------------------------------------------
// Joining a real (video) meeting — attendance tracking + host waiting-room
// listener + polls, then opens Jitsi.
// ---------------------------------------------------------------------------
async function proceedToJoinMeeting(meeting, room) {
  activeMeetingRoomId = meeting.id;
  const isHost = meeting.created_by === currentUser.id;
  activeMeetingIsHost = isHost;

  const { data: att } = await supabaseClient.from("meeting_attendance").insert({ room_id: meeting.id, user_id: currentUser.id }).select().single();
  activeAttendanceId = att?.id || null;

  if (meeting.status === "scheduled") {
    await supabaseClient.from("meetings").update({ status: "live" }).eq("id", meeting.id);
  }
  if (isHost) subscribeHostWaitingRoom(meeting.id);

  $("btnNewPoll").classList.toggle("hidden", !isHost);
  subscribePolls(meeting.id);
  loadPolls(meeting.id);
  subscribeCallParticipants(meeting.id);

  openJitsiCall({ room, title: meeting.title || "Meeting", audioOnly: false, showCamBtn: true });
}

// ---------------------------------------------------------------------------
// Opens a call using Jitsi Meet External API — Jitsi UI fully hidden,
// we render our own green control bar.
// ---------------------------------------------------------------------------
const JAAS_APP_ID = "vpaas-magic-cookie-1e254220db684bd282fcdad0095a4fee";

async function openJitsiCall({ room, title, audioOnly, showCamBtn }) {
  $("callTitleText").textContent = title || "Call";
  $("jitsiContainer").innerHTML = "";
  $("btnToggleCam").classList.toggle("hidden", !showCamBtn);
  $("btnToggleShare").classList.toggle("hidden", !showCamBtn);
  $("btnTogglePolls").classList.toggle("hidden", !!audioOnly);
  $("btnToggleParticipants").classList.toggle("hidden", !!audioOnly);
  $("participantsPanel").classList.add("hidden");
  $("btnToggleMic").classList.remove("isOff");
  $("micLabel").textContent = "Mute";
  $("btnToggleCam").classList.remove("isOff");
  $("camLabel").textContent = "Video";
  $("callParticipantCount").textContent = "👤 1";
  $("callShareIndicator").classList.add("hidden");
  $("callFrameWrap").classList.remove("hidden");
  startCallTimer();

  // Get a signed JaaS JWT from our Edge Function so we don't need Jitsi login.
  let jwtToken = null;
  try {
    const { data, error } = await supabaseClient.functions.invoke("generate-jaas-jwt", {
      body: {
        roomName: room,
        userName: currentProfile?.full_name || "Guest",
        userEmail: currentUser?.email || "",
        userId: currentUser?.id || "",
      },
    });
    if (error) throw error;
    jwtToken = data?.token || null;
  } catch (err) {
    console.error("generate-jaas-jwt failed:", err);
    showToast("Hindi ma-start ang call (JWT error). Subukan ulit.");
    $("callFrameWrap").classList.add("hidden");
    stopCallTimer();
    return;
  }

  // Camera/mic permission pre-check — done BEFORE Jitsi loads so we can show a
  // clear, specific reason if the camera "won't open" instead of a silent
  // black tile. We immediately release the probe stream so Jitsi's own
  // getUserMedia call (inside its iframe) still gets the device.
  if (!audioOnly) {
    try {
      const probeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      probeStream.getTracks().forEach(t => t.stop());
    } catch (permErr) {
      console.warn("Camera/mic permission probe failed:", permErr);
      if (permErr.name === "NotAllowedError" || permErr.name === "PermissionDeniedError") {
        showToast("🚫 Naka-block ang camera/mic access. I-allow sa browser settings (tap sa lock icon sa address bar), tapos subukan ulit.");
      } else if (permErr.name === "NotFoundError" || permErr.name === "DevicesNotFoundError") {
        showToast("Walang nakitang camera/mic sa device na ito. Papasok ka na lang audio-only kung available.");
      } else if (permErr.name === "NotReadableError" || permErr.name === "TrackStartError") {
        showToast("May ibang app na gumagamit ng camera/mic mo ngayon. Isara muna 'yon, tapos subukan ulit.");
      } else {
        showToast("Hindi ma-access ang camera/mic (" + (permErr.name || "unknown error") + "). Magpapatuloy pa rin — pwede mo pang i-retry sa loob ng call.");
      }
      // Don't block the call — Jitsi's own prejoin screen will let them retry.
    }
  }

  jitsiApi = new JitsiMeetExternalAPI("8x8.vc", {
    roomName: JAAS_APP_ID + "/" + room,
    jwt: jwtToken,
    parentNode: $("jitsiContainer"),
    userInfo: { displayName: currentProfile?.full_name || "Guest" },
    configOverwrite: {
      startAudioOnly: !!audioOnly,
      startWithVideoMuted: !!audioOnly,
      // Prejoin gives an explicit camera-preview screen + permission prompt
      // before actually joining — much more reliable than silently
      // auto-joining, which is what was causing "camera won't open" with no
      // explanation. Skipped for audio-only calls (no camera needed there).
      prejoinPageEnabled: !audioOnly,
      disableInviteFunctions: true,
      disableDeepLinking: true,
      requireDisplayName: false,
      toolbarButtons: [],
      subject: title || "Meeting",
    },
    interfaceConfigOverwrite: {
      TOOLBAR_BUTTONS: [],
      SHOW_JITSI_WATERMARK: false,
      SHOW_WATERMARK_FOR_GUESTS: false,
      DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
      MOBILE_APP_PROMO: false,
    },
  });

  jitsiApi.addEventListener("audioMuteStatusChanged", (e) => {
    $("btnToggleMic").classList.toggle("isOff", e.muted);
    $("micLabel").textContent = e.muted ? "Unmute" : "Mute";
  });
  jitsiApi.addEventListener("videoMuteStatusChanged", (e) => {
    $("btnToggleCam").classList.toggle("isOff", e.muted);
    $("camLabel").textContent = e.muted ? "Start" : "Stop";
  });
  jitsiApi.addEventListener("screenSharingStatusChanged", (e) => {
    $("btnToggleShare").classList.toggle("isOn", e.on);
    $("callShareIndicator").classList.toggle("hidden", !e.on);
  });
  jitsiApi.addEventListener("participantJoined", () => {
    const count = (jitsiApi.getNumberOfParticipants?.() || 1);
    $("callParticipantCount").textContent = `👤 ${count}`;
  });
  jitsiApi.addEventListener("participantLeft", () => {
    const count = (jitsiApi.getNumberOfParticipants?.() || 1);
    $("callParticipantCount").textContent = `👤 ${count}`;
  });
  // Jitsi's own signal for camera-level failures (permission revoked mid-call,
  // device unplugged, etc) — surface it instead of leaving a silent black tile.
  jitsiApi.addEventListener("cameraError", (e) => {
    console.error("Jitsi cameraError:", e);
    showToast("⚠️ Camera error: " + (e?.type || "hindi ma-start ang camera") + ". I-check ang permissions o kung may ibang app na gumagamit ng camera.");
  });
  jitsiApi.addEventListener("micError", (e) => {
    console.error("Jitsi micError:", e);
    showToast("⚠️ Microphone error — i-check ang permissions.");
  });
  // If user closes Jitsi from inside, sync our UI
  jitsiApi.addEventListener("readyToClose", () => $("btnLeaveCall").click());
}

function closeCallUI() {
  if (jitsiApi) { jitsiApi.dispose(); jitsiApi = null; }
  $("jitsiContainer").innerHTML = "";
  $("callFrameWrap").classList.add("hidden");
  $("pollPanel").classList.add("hidden");
  $("participantsPanel").classList.add("hidden");
  unsubscribeCallParticipants();
  activeMeetingIsHost = false;
  stopCallTimer();
}

$("btnToggleMic").addEventListener("click", () => jitsiApi?.executeCommand("toggleAudio"));
$("btnToggleCam").addEventListener("click", () => jitsiApi?.executeCommand("toggleVideo"));
$("btnToggleChatCall").addEventListener("click", () => jitsiApi?.executeCommand("toggleChat"));
$("btnToggleShare").addEventListener("click", () => jitsiApi?.executeCommand("toggleShareScreen"));

$("btnLeaveCall").addEventListener("click", async () => {
  closeCallUI();

  if (activeCallId) {
    // Voice call (1-on-1 or group audio call via the "calls" table)
    const endedCallId = activeCallId;
    activeCallId = null;
    activeCallRoomId = null;
    await supabaseClient.from("call_participants").update({ left_at: new Date().toISOString() }).eq("call_id", endedCallId).eq("user_id", currentUser.id);
    await supabaseClient.from("calls").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", endedCallId);
    loadCallHistory();
  }

  if (activeMeetingRoomId) {
    // Real scheduled/instant meeting
    const roomId = activeMeetingRoomId;
    const wasHost = pendingMeetingData?.id === roomId ? (pendingMeetingData.created_by === currentUser.id) : (meetingsCache.find(m => m.id === roomId)?.created_by === currentUser.id);
    activeMeetingRoomId = null;

    if (activeAttendanceId) {
      await supabaseClient.from("meeting_attendance").update({ left_at: new Date().toISOString() }).eq("id", activeAttendanceId);
      activeAttendanceId = null;
    }
    unsubscribePolls();

    if (wasHost) {
      unsubscribeHostWaitingRoom();
      await supabaseClient.from("meetings").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", roomId);
      await loadMeetings();
      await showAttendanceReport(roomId);
      autoGenerateMeetingSummary(roomId); // fire-and-forget, VIP-only inside
    }
    pendingMeetingData = null;
    selectedMeetType = null;
  }
});

// ---------------------------------------------------------------------------
// Attendance report (shown to host right after ending a meeting)
// ---------------------------------------------------------------------------
async function showAttendanceReport(roomId) {
  const { data, error } = await supabaseClient.rpc("get_meeting_attendance", { p_room_id: roomId });
  if (error) { console.error(error); return; }
  const rows = data || [];
  const fmtDur = (secs) => {
    secs = Math.round(secs || 0);
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${m}m ${s}s`;
  };
  const html = rows.length
    ? rows.map(r => `
      <div class="listItem">
        <div>
          <div class="itemTitle">${escapeHtml(r.full_name || "Participant")}</div>
          <div class="itemMeta">Joined ${fmtDate(r.joined_at)} • ${r.left_at ? "left " + fmtDate(r.left_at) : "still in call"} • ${fmtDur(r.duration_seconds)}</div>
        </div>
      </div>`).join("")
    : `<div class="emptyState">No attendance recorded.</div>`;
  openModal(`
    <div class="modalTitle">📋 Attendance report</div>
    <div class="list" style="max-height:50vh;overflow-y:auto">${html}</div>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
}

// ---------------------------------------------------------------------------
// AI meeting summary — auto-generated for VIP hosts right after a meeting ends
// ---------------------------------------------------------------------------
async function autoGenerateMeetingSummary(roomId) {
  try {
    const membership = computeMembershipStatus(currentProfile || {});
    const isVip = membership.state === "trialing" || membership.state === "active";
    if (!isVip) return;

    const { data: msgs } = await supabaseClient
      .from("meeting_messages")
      .select("sender_id, body, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });
    if (!msgs || !msgs.length) return;

    const senderIds = [...new Set(msgs.map(m => m.sender_id))];
    const { data: profs } = await supabaseClient.from("profiles").select("id, full_name, email").in("id", senderIds);
    const nameMap = {};
    (profs || []).forEach(p => { nameMap[p.id] = p.full_name || p.email || "Participant"; });
    const transcript = msgs.map(m => `${nameMap[m.sender_id] || "Participant"}: ${m.body}`).join("\n");

    const prompt = `Summarize this meeting's in-call chat. Respond with three short sections: 1) Overview, 2) Key points, 3) Action items (write "None" if there aren't any). Keep it concise, plain text, no markdown symbols.\n\nChat:\n${transcript}`;
    const { data, error } = await supabaseClient.functions.invoke("groq-ai", {
      body: { prompt, meta: { appName: "VORTEXIA", platform: "web", preferredLanguage: currentProfile.language || "en" } },
    });
    if (error) throw error;
    const summary = data?.text || null;
    if (summary) {
      await supabaseClient.from("meetings").update({ ai_summary: summary, ai_summary_generated_at: new Date().toISOString() }).eq("id", roomId);
      showToast("AI meeting summary is ready — check the AI Companion on Home.");
    }
  } catch (err) {
    console.warn("autoGenerateMeetingSummary failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Polls (host creates, everyone votes, results update live)
// ---------------------------------------------------------------------------
$("btnToggleParticipants").addEventListener("click", () => {
  const panel = $("participantsPanel");
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden") && activeMeetingRoomId) loadCallParticipants(activeMeetingRoomId);
});
$("btnCloseParticipantsPanel").addEventListener("click", () => $("participantsPanel").classList.add("hidden"));

// ---------------------------------------------------------------------------
// Phase 7E — in-meeting participant sidebar
// ---------------------------------------------------------------------------
async function loadCallParticipants(roomId) {
  const body = $("participantsPanelBody");
  if (!body) return;
  const { data, error } = await supabaseClient
    .from("meeting_attendance")
    .select("id, user_id, profiles:user_id(full_name, avatar_url)")
    .eq("room_id", roomId)
    .is("left_at", null)
    .order("joined_at", { ascending: true });
  if (error) { body.innerHTML = `<div class="emptyState">Could not load participants.</div>`; return; }

  const meeting = meetingsCache.find(m => m.id === roomId);
  const hostId = meeting?.created_by;
  const rows = data || [];
  $("participantsPanelCount").textContent = rows.length;
  $("callParticipantCount").textContent = `👤 ${rows.length}`;

  if (!rows.length) { body.innerHTML = `<div class="emptyState">No one else here yet.</div>`; return; }

  body.innerHTML = rows.map(r => {
    const p = r.profiles || {};
    const isHostRow = r.user_id === hostId;
    const isMe = r.user_id === currentUser.id;
    const initial = escapeHtml((p.full_name || "?").charAt(0).toUpperCase());
    const avatar = p.avatar_url
      ? `<img loading="lazy" src="${escapeHtml(p.avatar_url)}" alt="">`
      : initial;
    return `
      <div class="partRow" data-attendance-id="${r.id}" data-user-id="${r.user_id}">
        <div class="partAvatar">${avatar}</div>
        <div class="partInfo">
          <div class="partName">${escapeHtml(p.full_name || "Guest")}${isMe ? " (You)" : ""}</div>
          ${isHostRow ? "" : `<div class="partTag">Participant</div>`}
        </div>
        ${isHostRow ? `<span class="partHostBadge">👑 Host</span>` : ""}
        ${(activeMeetingIsHost && !isHostRow && !isMe) ? `<button class="partRemoveBtn" data-remove-participant="${r.user_id}" data-attendance-id="${r.id}">Remove</button>` : ""}
      </div>`;
  }).join("");

  body.querySelectorAll("[data-remove-participant]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this participant from the meeting?")) return;
      const attendanceId = btn.dataset.attendanceId;
      await supabaseClient.from("meeting_attendance").update({ left_at: new Date().toISOString() }).eq("id", attendanceId);
      // Best-effort: also kick them out of the live Jitsi call if we can match them by name.
      try {
        const row = btn.closest(".partRow");
        const name = row?.querySelector(".partName")?.textContent?.replace(" (You)", "");
        const info = jitsiApi?.getParticipantsInfo?.() || [];
        const match = info.find(pInfo => pInfo.formattedDisplayName === name || pInfo.displayName === name);
        if (match) jitsiApi.executeCommand("kickParticipant", match.participantId);
      } catch (e) { /* best-effort only */ }
      showToast("Participant removed.");
      loadCallParticipants(roomId);
    });
  });
}

function subscribeCallParticipants(roomId) {
  unsubscribeCallParticipants();
  loadCallParticipants(roomId);
  participantsChannel = supabaseClient
    .channel(`participants:${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "meeting_attendance", filter: `room_id=eq.${roomId}` },
      () => loadCallParticipants(roomId))
    .subscribe();
}

function unsubscribeCallParticipants() {
  if (participantsChannel) { supabaseClient.removeChannel(participantsChannel); participantsChannel = null; }
}

$("btnTogglePolls").addEventListener("click", () => {
  $("pollPanel").classList.toggle("hidden");
});
$("btnClosePollPanel").addEventListener("click", () => $("pollPanel").classList.add("hidden"));

function subscribePolls(roomId) {
  unsubscribePolls();
  pollsChannel = supabaseClient
    .channel(`polls-${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "meeting_polls", filter: `room_id=eq.${roomId}` }, () => loadPolls(roomId))
    .on("postgres_changes", { event: "*", schema: "public", table: "meeting_poll_votes" }, () => loadPolls(roomId))
    .subscribe();
}
function unsubscribePolls() {
  if (pollsChannel) { supabaseClient.removeChannel(pollsChannel); pollsChannel = null; }
  currentPollsCache = [];
  myPollVotes = {};
}

async function loadPolls(roomId) {
  const { data: polls } = await supabaseClient.from("meeting_polls").select("*").eq("room_id", roomId).order("created_at", { ascending: false });
  currentPollsCache = polls || [];
  const { data: myVotes } = await supabaseClient.from("meeting_poll_votes").select("poll_id, option_index").eq("user_id", currentUser.id);
  myPollVotes = {};
  (myVotes || []).forEach(v => { myPollVotes[v.poll_id] = v.option_index; });
  await renderPolls();
}

async function renderPolls() {
  if (!currentPollsCache.length) {
    $("pollPanelBody").innerHTML = `<div class="emptyState">No polls yet.</div>`;
    return;
  }
  const parts = [];
  for (const poll of currentPollsCache) {
    const { data: results } = await supabaseClient.rpc("get_meeting_poll_results", { p_poll_id: poll.id });
    const counts = poll.options.map((_, i) => (results || []).find(r => r.option_index === i)?.votes || 0);
    const total = counts.reduce((a, b) => a + Number(b), 0) || 1;
    const myVote = myPollVotes[poll.id];
    parts.push(`
      <div class="pollCard" data-poll="${poll.id}">
        <div class="pollQuestion">${escapeHtml(poll.question)}</div>
        ${poll.options.map((opt, i) => {
          const pct = Math.round((Number(counts[i]) / total) * 100);
          return `
          <div class="pollOption ${myVote === i ? "voted" : ""}" data-vote="${poll.id}:${i}">
            <div class="pollOptionBar" style="width:${pct}%"></div>
            <span class="pollOptionLabel">${escapeHtml(opt)}</span>
            <span class="pollOptionPct">${pct}% (${counts[i]})</span>
          </div>`;
        }).join("")}
      </div>`);
  }
  $("pollPanelBody").innerHTML = parts.join("");
  $("pollPanelBody").querySelectorAll("[data-vote]").forEach(el => {
    el.addEventListener("click", async () => {
      const [pollId, idx] = el.dataset.vote.split(":");
      await supabaseClient.rpc("vote_meeting_poll", { p_poll_id: pollId, p_option_index: parseInt(idx, 10) });
    });
  });
}

$("btnNewPoll").addEventListener("click", () => {
  openModal(`
    <div class="modalTitle">📊 New poll</div>
    <div class="field"><label>Question</label><input type="text" id="pollQuestion" placeholder="What should we do next?" /></div>
    <div class="field"><label>Options (one per line, 2-6)</label><textarea id="pollOptions" rows="4" placeholder="Option A\nOption B"></textarea></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btnGhost" id="modalCancel">Cancel</button>
      <button class="btn btnPrimary" id="btnCreatePoll">Push poll</button>
    </div>`);
  $("modalCancel").addEventListener("click", closeModal);
  $("btnCreatePoll").addEventListener("click", async () => {
    const question = $("pollQuestion").value.trim();
    const options = $("pollOptions").value.split("\n").map(s => s.trim()).filter(Boolean);
    if (!question) { showToast("Please enter a question."); return; }
    if (options.length < 2 || options.length > 6) { showToast("Please provide 2 to 6 options."); return; }
    const { error } = await supabaseClient.rpc("create_meeting_poll", { p_room_id: activeMeetingRoomId, p_question: question, p_options: options });
    if (error) { showToast("Could not create poll: " + error.message); return; }
    closeModal();
    $("pollPanel").classList.remove("hidden");
  });
});

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
}

// [BUG FIX — July 18] Several overlays/modals showed a bare "Loading…"
// state while awaiting Promise.all([...]) with no timeout — if any single
// query in the batch stalled (slow network, a dropped connection, etc.) the
// whole screen was stuck on "Loading…" forever with no way out but to force-
// close the app. Wrap slow data-loading calls in this so users always see
// either the real content or a clear error within a bounded time.
function withTimeout(promise, ms = 8000, label = "This") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} took too long to load. Please check your connection and try again.`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ---------------------------------------------------------------------------
// Reminders (in-app; email reminders require a scheduled backend job — see README)
// ---------------------------------------------------------------------------
function startReminderLoop() {
  checkReminders();
  setInterval(checkReminders, 30 * 1000);
}
function checkReminders() {
  if (!currentProfile || currentProfile.notif_in_app === false) return;
  const now = Date.now();
  for (const m of meetingsCache) {
    if (!m.scheduled_at || m.status === "chat" || m.status === "ended") continue;
    const start = new Date(m.scheduled_at).getTime();
    const diffMin = (start - now) / 60000;
    [[15, "15 minutes"], [5, "5 minutes"], [0, "now"]].forEach(([mark, label]) => {
      const key = m.id + ":" + mark;
      if (!firedReminders.has(key) && diffMin <= mark && diffMin > mark - 0.5) {
        firedReminders.add(key);
        showToast(`Reminder: "${m.title}" starts ${label === "now" ? "now" : "in " + label}.`, 5000);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Chat — redesigned with search, contacts, group chats, add friends
// ---------------------------------------------------------------------------
let chatThreadsCache = [];
let allProfilesCache = new Map(); // MG ID / name cache for quick lookup

// Pending #10 — Chats "Load more": previously chat threads were sliced out of the
// same 300-row-capped `meetingsCache` used by the Meetings tab/dashboard, so there was
// no real way to page past 300 total (meetings + chats combined). This now queries
// chat-status rows directly with its own page/cursor, independent of loadMeetings().
const CHAT_THREADS_PAGE_SIZE = 50;
let chatThreadsPage = 0;
let chatThreadsHasMore = true;
async function loadChatThreads(loadMore = false) {
  if (!loadMore) { chatThreadsPage = 0; chatThreadsCache = []; }
  const from = chatThreadsPage * CHAT_THREADS_PAGE_SIZE;
  const to = from + CHAT_THREADS_PAGE_SIZE - 1;
  const { data, error } = await supabaseClient.from("meetings").select("*")
    .eq("status", "chat")
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) { console.error(error); return; }
  chatThreadsHasMore = (data || []).length === CHAT_THREADS_PAGE_SIZE;
  chatThreadsCache = loadMore ? chatThreadsCache.concat(data || []) : (data || []);
  chatThreadsPage++;

  const threads = chatThreadsCache;

  if (threads.length) {
    const { data: parts } = await supabaseClient
      .from("meeting_participants")
      .select("room_id")
      .in("room_id", threads.map(t => t.id));
    const counts = {};
    (parts || []).forEach(p => { counts[p.room_id] = (counts[p.room_id] || 0) + 1; });
    chatThreadParticipantCounts = counts;
  } else {
    chatThreadParticipantCounts = {};
  }

  renderChatThreads(threads);
  renderGroupThreads(threads.filter(t => (chatThreadParticipantCounts[t.id] || 0) > 2));
  renderContactsList();

  const chatsListEl = $("chatThreads");
  if (chatsListEl) renderLoadMoreButton(chatsListEl, chatThreadsHasMore, () => loadChatThreads(true));
}

function renderGroupThreads(groupThreads) {
  const el = $("groupThreads");
  if (!groupThreads.length) { el.innerHTML = `<div class="emptyState">No group chats yet. Use "+ Group chat" to start one.</div>`; return; }
  el.innerHTML = groupThreads.map(t => `
    <div class="chatThread" data-thread="${t.id}">
      <div class="chatThreadAvatar" style="background:linear-gradient(135deg,#7c3aed,#a855f7)">
        👥
        <div class="chatThreadUnread hidden" id="threadUnread-g-${t.id}"></div>
      </div>
      <div class="chatThreadBody">
        <div class="chatThreadRow1">
          <div class="chatThreadName">${escapeHtml(t.title)}</div>
          <div class="chatThreadTime" id="threadTime-g-${t.id}"></div>
        </div>
        <div class="chatThreadPreview" id="preview-${t.id}">${(chatThreadParticipantCounts[t.id] || 0)} members</div>
      </div>
    </div>`).join("");
  el.querySelectorAll(".chatThread").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".chatThread").forEach(b => b.classList.remove("active"));
      item.classList.add("active");
      selectThread(item.dataset.thread, groupThreads.find(t => t.id === item.dataset.thread));
    });
  });
  // load last message previews for groups too
  groupThreads.forEach(t => loadThreadPreview(t.id));
}

// ---------------- Notifications ----------------
let notifCache = [];
let notifTab = "unread";

async function createNotification({ user_id, type, title, body, related_room_id }) {
  if (!user_id || user_id === currentUser.id) return; // don't notify yourself
  await supabaseClient.from("notifications").insert({
    user_id, actor_id: currentUser.id, type, title, body: body || null, related_room_id: related_room_id || null,
  });
}

async function loadNotifications() {
  const { data, error } = await supabaseClient
    .from("notifications")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) { console.error(error); return; }
  notifCache = data || [];
  renderNotifications();
  refreshNotifBadge();
}

async function refreshNotifBadge() {
  const { count } = await supabaseClient
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", currentUser.id)
    .eq("is_read", false);
  const badge = $("notifBadge");
  if (count && count > 0) {
    badge.textContent = count > 99 ? "99+" : String(count);
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function notifIcon(type) {
  return {
    message: "💬", room_invite: "📅", follow: "➕", meeting_reminder: "⏰",
    meeting_starting: "📹", recording_ready: "🎬", group_added: "👥",
    post_liked: "❤️", post_commented: "💬", marketplace_inquiry: "🛍️",
    new_community_member: "🎉", vip_expiry_warning: "⚠️",
  }[type] || "🔔";
}

function timeAgo(iso) {
  if (!iso) return "";
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderNotifications() {
  const list = notifTab === "unread" ? notifCache.filter(n => !n.is_read) : notifCache;
  const el = $("notificationsList");
  if (!list.length) {
    el.innerHTML = `<div class="emptyState">${notifTab === "unread" ? "You're all caught up!" : "No notifications yet."}</div>`;
    return;
  }

  // Group by Today / Yesterday / This week / Older
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday); startOfWeek.setDate(startOfWeek.getDate() - 7);
  const groups = { "Today": [], "Yesterday": [], "This week": [], "Older": [] };
  list.forEach(n => {
    const d = new Date(n.created_at);
    if (d >= startOfToday) groups["Today"].push(n);
    else if (d >= startOfYesterday) groups["Yesterday"].push(n);
    else if (d >= startOfWeek) groups["This week"].push(n);
    else groups["Older"].push(n);
  });

  el.innerHTML = Object.entries(groups).filter(([, items]) => items.length).map(([label, items]) => `
    <div class="notifGroupLabel">${label}</div>
    ${items.map(n => `
      <div class="notifSwipeWrap" data-notif-wrap="${n.id}">
        <div class="notifSwipeDismissBg">🗑️ Dismiss</div>
        <div class="listItem notifItem ${n.is_read ? "" : "notifUnread"}" data-notif="${n.id}">
          <div style="display:flex;gap:12px;align-items:flex-start">
            <span class="notifAvatar">${notifIcon(n.type)}</span>
            <div style="min-width:0">
              <div class="itemTitle">${escapeHtml(n.title)}</div>
              ${n.body ? `<div class="itemMeta">${escapeHtml(n.body)}</div>` : ""}
              <div class="itemMeta" style="color:var(--faint)">${timeAgo(n.created_at)}</div>
            </div>
          </div>
          ${!n.is_read ? `<span class="notifDot"></span>` : ""}
        </div>
      </div>`).join("")}
  `).join("");

  el.querySelectorAll("[data-notif]").forEach(item => {
    item.addEventListener("click", async () => {
      const n = notifCache.find(x => x.id === item.dataset.notif);
      if (!n) return;
      if (!n.is_read) {
        await supabaseClient.from("notifications").update({ is_read: true }).eq("id", n.id);
        n.is_read = true;
        renderNotifications();
        refreshNotifBadge();
      }
      if (n.related_room_id) {
        setActiveView("chat");
        const room = findAnyRoomCached(n.related_room_id);
        selectThread(n.related_room_id, room);
      }
    });
  });

  // Swipe-to-dismiss (touch + mouse drag) — one shared window listener set, not re-added per render
  el.querySelectorAll("[data-notif-wrap]").forEach(wrap => {
    const card = wrap.querySelector(".notifItem");
    const notifId = wrap.dataset.notifWrap;
    wrap.addEventListener("touchstart", (e) => { notifSwipeState = { wrap, card, notifId, startX: e.touches[0].clientX, currentX: 0 }; card.style.transition = "none"; }, { passive: true });
    wrap.addEventListener("touchmove", (e) => { if (notifSwipeState?.wrap === wrap) doNotifSwipeMove(e.touches[0].clientX); }, { passive: true });
    wrap.addEventListener("touchend", () => { if (notifSwipeState?.wrap === wrap) doNotifSwipeEnd(); });
    wrap.addEventListener("mousedown", (e) => { notifSwipeState = { wrap, card, notifId, startX: e.clientX, currentX: 0 }; card.style.transition = "none"; });
  });
}

let notifSwipeState = null;
function doNotifSwipeMove(x) {
  if (!notifSwipeState) return;
  notifSwipeState.currentX = Math.min(0, x - notifSwipeState.startX);
  notifSwipeState.card.style.transform = `translateX(${notifSwipeState.currentX}px)`;
}
async function doNotifSwipeEnd() {
  const st = notifSwipeState;
  if (!st) return;
  notifSwipeState = null;
  st.card.style.transition = "transform .2s ease";
  if (st.currentX < -90) {
    st.wrap.style.transition = "max-height .2s ease, opacity .2s ease";
    st.wrap.style.maxHeight = st.wrap.offsetHeight + "px";
    requestAnimationFrame(() => { st.wrap.style.maxHeight = "0px"; st.wrap.style.opacity = "0"; });
    await supabaseClient.from("notifications").delete().eq("id", st.notifId);
    notifCache = notifCache.filter(n => n.id !== st.notifId);
    setTimeout(() => { st.wrap.remove(); refreshNotifBadge(); }, 210);
  } else {
    st.card.style.transform = "translateX(0)";
  }
}
window.addEventListener("mousemove", (e) => { if (notifSwipeState) doNotifSwipeMove(e.clientX); });
window.addEventListener("mouseup", () => { if (notifSwipeState) doNotifSwipeEnd(); });

document.querySelectorAll("[data-notifTab]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-notifTab]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    notifTab = btn.dataset.notiftab;
    renderNotifications();
  });
});

$("btnMarkAllRead").addEventListener("click", async () => {
  await supabaseClient.from("notifications").update({ is_read: true }).eq("user_id", currentUser.id).eq("is_read", false);
  notifCache.forEach(n => n.is_read = true);
  renderNotifications();
  refreshNotifBadge();
  showToast("All notifications marked as read.");
});


function renderChatThreads(threads) {
  const el = $("chatThreads");
  if (!threads.length) { el.innerHTML = `<div class="emptyState">No conversations yet. Add friends or start a group chat to begin.</div>`; return; }
  el.innerHTML = threads.map(t => {
    const initial = (t.title || "?").trim().charAt(0).toUpperCase();
    const isGroup = (chatThreadParticipantCounts[t.id] || 0) > 2;
    const avatarIcon = isGroup ? "👥" : escapeHtml(initial);
    const avatarStyle = isGroup ? 'background:linear-gradient(135deg,#7c3aed,#a855f7)' : '';
    return `
    <div class="chatThread" data-thread="${t.id}">
      <div class="chatThreadAvatar" style="${avatarStyle}">
        ${avatarIcon}
        <div class="chatThreadUnread hidden" id="threadUnread-${t.id}"></div>
      </div>
      <div class="chatThreadBody">
        <div class="chatThreadRow1">
          <div class="chatThreadName">${escapeHtml(t.title)}</div>
          <div class="chatThreadTime" id="threadTime-${t.id}"></div>
        </div>
        <div class="chatThreadPreview" id="preview-${t.id}">Loading…</div>
      </div>
    </div>`;
  }).join("");
  el.querySelectorAll(".chatThread").forEach(item => {
    item.addEventListener("click", () => {
      document.querySelectorAll(".chatThread").forEach(b => b.classList.remove("active"));
      item.classList.add("active");
      // clear unread badge on open
      const badge = $(`threadUnread-${item.dataset.thread}`);
      if (badge) badge.classList.add("hidden");
      selectThread(item.dataset.thread, threads.find(t => t.id === item.dataset.thread));
    });
  });
  // Load last message previews + timestamps
  threads.forEach(t => loadThreadPreview(t.id));
}

// Load last message preview + timestamp for a single thread
async function loadThreadPreview(threadId) {
  const previewEl = $(`preview-${threadId}`);
  const timeEl = $(`threadTime-${threadId}`);
  if (!previewEl) return;
  const { data } = await supabaseClient
    .from("meeting_messages")
    .select("body, file_name, file_type, sender_id, created_at")
    .eq("room_id", threadId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (!data || !data.length) {
    previewEl.textContent = "No messages yet";
    return;
  }
  const msg = data[0];
  const isOwn = msg.sender_id === currentUser?.id;
  let preview = "";
  if (msg.file_type?.startsWith("image/")) preview = "📷 Photo";
  else if (msg.file_type?.startsWith("audio/")) preview = "🎤 Voice note";
  else if (msg.file_name) preview = `📎 ${msg.file_name}`;
  else preview = msg.body || "";
  previewEl.textContent = (isOwn ? "You: " : "") + preview.slice(0, 50);
  if (timeEl && msg.created_at) timeEl.textContent = timeAgo(msg.created_at);
}

async function renderContactsList() {
  const { data: follows } = await supabaseClient.from("follows").select("followee_id").eq("follower_id", currentUser.id);
  const followingIds = (follows || []).map(f => f.followee_id);
  
  if (!followingIds.length) {
    $("contactsList").innerHTML = `<div class="emptyState">You haven't followed anyone yet. Use Add friends to start.</div>`;
    return;
  }

  const { data: contacts } = await supabaseClient.from("profiles").select("id,full_name,mg_id,vip_status,vip_until,trial_ends_at,plan").in("id", followingIds);
  if (!contacts || !contacts.length) {
    $("contactsList").innerHTML = `<div class="emptyState">No contacts found.</div>`;
    return;
  }

  $("contactsList").innerHTML = contacts.map(c => {
    const cInitial = (c.full_name || "?").trim().charAt(0).toUpperCase();
    const avatarHtml = `<div class="contactAvatar">${cInitial}</div>`;
    return `
    <div class="contactItem" data-contact-id="${c.id}">
      ${renderVipAvatarFrame(avatarHtml, c, false)}
      <div style="flex:1;min-width:0">
        <div class="contactName">${renderVipName(c.full_name || "—", c)}</div>
        <div class="contactMeta">MG ID ${escapeHtml(c.mg_id || "—")}${getVipTier(c) ? " • VIP Verified" : ""}</div>
      </div>
      <div class="contactActions">
        <button class="btn btnPrimary btnSm" data-action="message">💬</button>
        <button class="btn btnGhost btnSm" data-action="profile">👤</button>
      </div>
    </div>`;
  }).join("");

  $("contactsList").querySelectorAll(".contactItem").forEach(item => {
    item.querySelector('[data-action="message"]').addEventListener("click", async () => {
      const userId = item.dataset.contactId;
      await createOrStartChat(userId);
    });
    item.querySelector('[data-action="profile"]').addEventListener("click", () => {
      openProfileView(item.dataset.contactId);
    });
  });
}

async function createOrStartChat(userId) {
  // Check if a 1:1 chat already exists between currentUser and userId.
  // [BUG FIX — July 18] This used to filter chatThreadsCache first — but that
  // cache is only populated once the Chats tab itself has loaded, so calling
  // this from a profile's "Message" button (the normal path) usually saw an
  // EMPTY cache and skipped the dedup check entirely. Confirmed live in the
  // DB: 6+ duplicate "Chat with X" rooms had piled up for the same two users
  // across several days. Fix: ask the database directly for rooms I'm
  // already in, every time, instead of trusting client-side cache state.
  const { data: myRooms } = await supabaseClient
    .from("meeting_participants")
    .select("room_id, meetings!inner(status)")
    .eq("user_id", currentUser.id)
    .eq("meetings.status", "chat");
  const myRoomIds = (myRooms || []).map(r => r.room_id);

  if (myRoomIds.length) {
    const { data: parts } = await supabaseClient
      .from("meeting_participants")
      .select("room_id, user_id")
      .in("room_id", myRoomIds);
    const membersByRoom = {};
    (parts || []).forEach(p => {
      (membersByRoom[p.room_id] ||= new Set()).add(p.user_id);
    });
    const existingRoomId = myRoomIds.find(id => {
      const members = membersByRoom[id] || new Set();
      return members.size === 2 && members.has(userId) && members.has(currentUser.id);
    });
    if (existingRoomId) {
      const { data: room } = await supabaseClient.from("meetings").select("*").eq("id", existingRoomId).single();
      await loadChatThreads();
      selectThread(existingRoomId, room);
      return;
    }
  }

  const { data: profile, error: profileErr } = await supabaseClient.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  if (profileErr) console.error("createOrStartChat: couldn't load profile for title", profileErr);
  const { data: room, error } = await supabaseClient.rpc("create_meeting", {
    p_title: `Chat with ${profile?.full_name || "User"}`,
    p_scheduled_at: new Date().toISOString(),
    p_status: "chat",
  });
  
  if (error) { showToast(error.message); return; }
  
  await supabaseClient.from("meeting_participants").insert([
    { room_id: room.id, user_id: userId, role: "member" },
  ]);

  await loadMeetings();
  await loadChatThreads();
  selectThread(room.id, room);
}

// Chat tabs: Chats vs Contacts
document.querySelectorAll(".chatTab").forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll(".chatTab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".chatThreadsContainer").forEach(c => c.classList.remove("active"));
    $(tab + "Container").classList.add("active");
  });
});

// Search chats & contacts
// [BUG FIX — July 18] This box's placeholder says "Search chats, contacts, or
// messages…" but it only ever filtered chatThreadsCache (existing threads) by
// title. Searching a real person's name who you haven't messaged yet (e.g. a
// newly-viewed profile) silently showed nothing, which read as "this user
// doesn't exist" even though they do. Now it also offers a direct
// people-search fallback via the same RPC "Add friends" uses.
let searchTimeout;
$("chatSearch").addEventListener("input", (e) => {
  clearTimeout(searchTimeout);
  const rawQuery = e.target.value.trim();
  const query = rawQuery.toLowerCase();
  
  searchTimeout = setTimeout(() => {
    if (!query) {
      renderChatThreads(chatThreadsCache);
      return;
    }
    const filtered = chatThreadsCache.filter(t => t.title.toLowerCase().includes(query));
    renderChatThreads(filtered);
    if (!filtered.length) {
      const el = $("chatThreads");
      if (el) {
        el.innerHTML = `<div class="emptyState">No conversations match "${escapeHtml(rawQuery)}".<br/><button class="btn btnPrimary btnSm" id="btnSearchAllUsers" style="margin-top:10px">🔎 Search all users instead</button></div>`;
        $("btnSearchAllUsers")?.addEventListener("click", () => openAddFriendsModal(rawQuery));
      }
    }
  }, 200);
});

// Add friends modal
function openAddFriendsModal(prefillQuery) {
  openModal(`
    <div class="modalTitle">Add friends</div>
    <div class="field">
      <label>Search by name or MG ID</label>
      <input type="text" id="searchAddFriendsInput" placeholder="John Doe or 1234567" autocomplete="off" value="${prefillQuery ? escapeHtml(prefillQuery) : ""}" />
    </div>
    <div class="list" id="addFriendsResults"><div class="emptyState">Start typing to search…</div></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn btnGhost" id="modalCancel">Close</button>
    </div>
  `);
  
  const searchInput = $("searchAddFriendsInput");
  const resultsEl = $("addFriendsResults");
  
  let searchTimer;
  const runFriendSearch = async (query) => {
    if (query.length < 2) {
      resultsEl.innerHTML = `<div class="emptyState">Start typing to search…</div>`;
      return;
    }
    
    resultsEl.innerHTML = `<div class="emptyState">Searching…</div>`;
    try {
      const { data, error } = await supabaseClient.rpc("search_profiles", { p_query: query });
      if (error) { console.error(error); resultsEl.innerHTML = `<div class="emptyState">Search error.</div>`; return; }
      
      const results = (data || []).filter(p => p.id !== currentUser.id);
      if (!results.length) { resultsEl.innerHTML = `<div class="emptyState">No users found.</div>`; return; }
      
      resultsEl.innerHTML = results.map(p => `
        <div class="contactItem">
          <div>
            <div class="contactName">${nameLink(p.full_name || "—", p, p.id)}</div>
            <div class="contactMeta">MG ID ${escapeHtml(p.mg_id || "—")}${getVipTier(p) ? " • VIP" : ""} ${renderReputationBadge(p.reputation_tier)}</div>
            ${p.skills && p.skills.length ? `<div class="skillChipsRow" style="margin-top:4px">${renderSkillChips(p.skills.slice(0, 4), false)}</div>` : ""}
          </div>
          <button class="btn btnPrimary btnSm" data-user-id="${p.id}" data-action="add-friend">Follow</button>
        </div>`).join("");
      
      resultsEl.querySelectorAll('[data-action="add-friend"]').forEach(btn => {
        btn.addEventListener("click", async () => {
          const userId = btn.dataset.userId;
          const { error } = await supabaseClient.from("follows").insert({ follower_id: currentUser.id, followee_id: userId });
          if (error) { showToast("Already following or error"); return; }
          btn.disabled = true;
          btn.textContent = "Following ✓";
          createNotification({ user_id: userId, type: "follow", title: `${currentProfile?.full_name || "Someone"} started following you`, body: null });
          await renderContactsList();
          showToast("Friend added!");
        });
      });
    } catch (err) {
      console.error(err);
      resultsEl.innerHTML = `<div class="emptyState">Search error.</div>`;
    }
  };

  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const query = e.target.value.trim();
    searchTimer = setTimeout(() => runFriendSearch(query), 300);
  });
  
  searchInput.focus();
  $("modalCancel").addEventListener("click", closeModal);

  if (prefillQuery && prefillQuery.trim().length >= 2) runFriendSearch(prefillQuery.trim());
}
$("btnAddFriends").addEventListener("click", () => openAddFriendsModal());

// Group chat modal
$("btnNewGroupChat").addEventListener("click", () => {
  openModal(`
    <div class="modalTitle">Start group chat</div>
    <div class="field">
      <label>Group name</label>
      <input type="text" id="groupChatName" placeholder="Project Team" />
    </div>
    <div class="field">
      <label>Add participants (select from your contacts)</label>
      <div class="list" id="groupParticipantsList"></div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btnGhost" id="modalCancel">Cancel</button>
      <button class="btn btnPrimary" id="createGroupBtn">Create</button>
    </div>
  `);
  
  // Load contacts for selection
  (async () => {
    const { data: follows } = await supabaseClient.from("follows").select("followee_id").eq("follower_id", currentUser.id);
    const followingIds = (follows || []).map(f => f.followee_id);
    
    if (!followingIds.length) {
      $("groupParticipantsList").innerHTML = `<div class="emptyState">Add friends first to create a group chat.</div>`;
      $("createGroupBtn").disabled = true;
      return;
    }

    const { data: contacts } = await supabaseClient.from("profiles").select("id,full_name,mg_id").in("id", followingIds);
    $("groupParticipantsList").innerHTML = (contacts || []).map(c => `
      <label style="display:flex;align-items:center;padding:8px;gap:10px;cursor:pointer">
        <input type="checkbox" value="${c.id}" class="groupMemberCheck" />
        <span>${escapeHtml(c.full_name || "—")} (${escapeHtml(c.mg_id || "—")})</span>
      </label>`).join("");
  })();
  
  $("modalCancel").addEventListener("click", closeModal);
  $("createGroupBtn").addEventListener("click", async () => {
    const name = $("groupChatName").value.trim();
    const selected = Array.from($("groupParticipantsList").querySelectorAll(".groupMemberCheck:checked")).map(c => c.value);
    
    if (!name) { showToast("Please enter a group name"); markFieldErrors(["groupChatName"]); return; }
    clearFieldErrors(["groupChatName"]);
    if (!selected.length) { showToast("Please select at least one participant"); return; }
    
    const { data: room, error } = await supabaseClient.rpc("create_meeting", {
      p_title: name,
      p_scheduled_at: new Date().toISOString(),
      p_status: "chat",
    });
    
    if (error) { showToast(error.message); return; }
    
    const participants = [...selected.map(uid => ({ room_id: room.id, user_id: uid, role: "member" }))];
    await supabaseClient.from("meeting_participants").insert(participants);

    await Promise.all(selected.map(uid => createNotification({
      user_id: uid, type: "group_added", title: `${currentProfile?.full_name || "Someone"} added you to "${name}"`,
      body: "Tap to open the group chat.", related_room_id: room.id,
    })));

    closeModal();
    await loadMeetings();
    await loadChatThreads();
    selectThread(room.id, room);
  });
});

function enterMobileChatView() {
  if (window.innerWidth <= 720) document.body.classList.add("chatConvoOpen");
}
function exitMobileChatView() {
  document.body.classList.remove("chatConvoOpen");
}

async function selectThread(id, meta) {
  enterMobileChatView();
  activeChatId = id;
  activeChatOtherUserId = null;
  chatPage = 0;
  allMsgsLoaded = false;
  pinnedMessages = [];
  searchQuery = "";
  msgSearchVisible = false;

  // Clean up old channels
  if (chatChannel) { supabaseClient.removeChannel(chatChannel); chatChannel = null; }
  if (typingChannel) { supabaseClient.removeChannel(typingChannel); typingChannel = null; }
  if (reactionsChannel) { supabaseClient.removeChannel(reactionsChannel); reactionsChannel = null; }
  cancelVoiceRecording();

  // Enable UI
  $("chatInput").disabled = false;
  $("chatSend").disabled = false;
  $("btnEmojiPicker").disabled = false;
  $("btnMsgSearch").disabled = false;
  $("btnAttach").disabled = false;
  $("btnVoiceNote").disabled = false;
  $("btnAiImprove").disabled = false;
  $("chatHeaderBar").classList.remove("hidden");
  $("pinnedPanel").classList.add("hidden");

  // Apply mute state
  updateMuteButton(id);

  // Load participants
  const { data: parts } = await supabaseClient.from("meeting_participants").select("user_id").eq("room_id", id);
  const allParticipants = (parts || []).map(p => p.user_id);
  const others = allParticipants.filter(uid => uid !== currentUser.id);
  if (others.length > 0) {
    // [BUG FIX — July 18] `allProfilesCache` (used everywhere in
    // buildMessageElement to resolve a sender's name/avatar) was declared
    // once at the top of the file but NEVER populated anywhere — every
    // lookup silently missed and fell back to "Unknown"/"User"/"Someone".
    // Fix: fetch avatar_url too, and actually store each profile in the
    // cache here (and below) as soon as we know who's in this room.
    const { data: profiles } = await supabaseClient.from("profiles").select("id,full_name,avatar_url").in("id", others);
    (profiles || []).forEach(p => allProfilesCache.set(p.id, p));
    const names = (profiles || []).map(p => p.full_name).join(", ");
    $("chatHeaderParticipants").textContent = others.length > 1 ? `with ${names}` : "";
    activeChatOtherUserId = others[0] || null;
  }
  // Make sure our own profile is resolvable too (for reply-quotes of our own messages, etc.)
  if (currentUser && !allProfilesCache.has(currentUser.id)) {
    const { data: mine } = await supabaseClient.from("profiles").select("id,full_name,avatar_url").eq("id", currentUser.id).maybeSingle();
    if (mine) allProfilesCache.set(mine.id, mine);
  }
  $("chatHeaderTitle").textContent = meta?.title || "Chat";
  $("chatHeaderTitle").classList.add("chatHeaderTitle--clickable");

  // Load pinned messages from DB
  await loadPinnedMessages(id);

  // Load first page of messages (newest 50)
  await loadChatPage(id, true);

  // Add scroll-to-bottom button
  addScrollToBottomBtn();

  // Subscribe to new messages (realtime INSERT/UPDATE/DELETE)
  chatChannel = supabaseClient.channel("chat:" + id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "meeting_messages", filter: `room_id=eq.${id}` }, (payload) => {
      if (payload.new.sender_id !== currentUser.id) {
        appendChatMessage(payload.new);
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "meeting_messages", filter: `room_id=eq.${id}` }, (payload) => {
      handleMessageUpdate(payload.new);
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "meeting_messages", filter: `room_id=eq.${id}` }, (payload) => {
      handleMessageDelete(payload.old?.id);
    })
    .subscribe();

  // Subscribe to reaction changes (add/remove) so reactions appear live for everyone in this chat
  reactionsChannel = supabaseClient.channel("reactions:" + id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions" }, (payload) => {
      if (payload.new.user_id === currentUser.id) return; // already applied optimistically on our end
      if (messageCache.has(payload.new.message_id)) {
        applyRemoteReaction(payload.new.message_id, payload.new.emoji, payload.new.user_id, true);
      }
    })
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, (payload) => {
      if (payload.old.user_id === currentUser.id) return;
      if (messageCache.has(payload.old.message_id)) {
        applyRemoteReaction(payload.old.message_id, payload.old.emoji, payload.old.user_id, false);
      }
    })
    .subscribe();

  // Subscribe to typing broadcasts
  typingChannel = supabaseClient.channel("typing:" + id)
    .on("broadcast", { event: "typing" }, (payload) => {
      if (payload.payload.userId !== currentUser.id) {
        showTypingIndicator(payload.payload.userId, payload.payload.userName);
      }
    })
    .on("broadcast", { event: "stop_typing" }, (payload) => {
      if (payload.payload.userId !== currentUser.id) {
        hideTypingIndicator(payload.payload.userId);
      }
    })
    .subscribe();
}

async function loadChatPage(roomId, firstLoad = false) {
  const from = chatPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, error } = await supabaseClient
    .from("meeting_messages").select("*").eq("room_id", roomId)
    .order("created_at", { ascending: false }).range(from, to);
  if (error) { console.error(error); return; }
  const msgs = (data || []).reverse();
  await attachReactionsToMessages(msgs);
  if (msgs.length < PAGE_SIZE) allMsgsLoaded = true;
  chatPage++;
  if (firstLoad) {
    renderChatMessages(msgs);
  } else {
    prependChatMessages(msgs);
  }
}

// Pull persisted reactions (message_reactions table) for a batch of messages and attach as m.reactions = {emoji: [user_ids]}
async function attachReactionsToMessages(msgs) {
  if (!msgs.length) return;
  try {
    const { data, error } = await supabaseClient
      .from("message_reactions")
      .select("message_id,user_id,emoji")
      .in("message_id", msgs.map(m => m.id));
    if (error) throw error; // table may not exist in some environments — fail quietly
    const byMessage = {};
    (data || []).forEach(r => {
      if (!byMessage[r.message_id]) byMessage[r.message_id] = {};
      if (!byMessage[r.message_id][r.emoji]) byMessage[r.message_id][r.emoji] = [];
      byMessage[r.message_id][r.emoji].push(r.user_id);
    });
    msgs.forEach(m => { if (byMessage[m.id]) m.reactions = byMessage[m.id]; });
  } catch (err) {
    console.error("Error loading reactions:", err);
  }
}

function prependChatMessages(msgs) {
  const el = $("chatMessages");
  const scrollBottom = el.scrollHeight - el.scrollTop;
  msgs.forEach(m => {
    messageCache.set(m.id, m);
    const group = buildMessageElement(m);
    if (el.firstChild) el.insertBefore(group, el.firstChild);
    else el.appendChild(group);
  });
  el.scrollTop = el.scrollHeight - scrollBottom;
  addLoadMoreBtn();
}

function addLoadMoreBtn() {
  const el = $("chatMessages");
  const existing = el.querySelector(".loadMoreBtn");
  if (existing) existing.remove();
  if (allMsgsLoaded) return;
  const btn = document.createElement("button");
  btn.className = "loadMoreBtn";
  btn.textContent = "Load older messages";
  btn.addEventListener("click", async () => {
    btn.textContent = "Loading…";
    btn.disabled = true;
    await loadChatPage(activeChatId, false);
  });
  el.insertBefore(btn, el.firstChild);
}

function addScrollToBottomBtn() {
  const wrap = $("chatMessages").parentElement;
  const existing = wrap.querySelector(".scrollToBottomBtn");
  if (existing) existing.remove();
  const btn = document.createElement("button");
  btn.className = "scrollToBottomBtn";
  btn.title = "Scroll to bottom";
  btn.innerHTML = "↓";
  btn.style.cssText = "position:absolute;bottom:72px;right:14px;z-index:50;opacity:0;pointer-events:none;";
  wrap.style.position = "relative";
  wrap.appendChild(btn);
  btn.addEventListener("click", () => {
    $("chatMessages").scrollTop = $("chatMessages").scrollHeight;
  });
  $("chatMessages").addEventListener("scroll", () => {
    const el = $("chatMessages");
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    btn.style.opacity = atBottom ? "0" : "1";
    btn.style.pointerEvents = atBottom ? "none" : "auto";
  });
}

$("chatHeaderTitle").addEventListener("click", () => {
  if (activeChatOtherUserId) openProfileView(activeChatOtherUserId);
});

// ========== PHASE 2: ENHANCED MESSAGE RENDERING WITH AVATARS, REACTIONS, READ RECEIPTS, TYPING INDICATORS ==========

const messageCache = new Map();
const typingUsers = new Set();
let lastMessageDate = null;
let searchQuery = "";
let filteredMessages = [];

// ========== PHASE 3 STATE ==========
let typingChannel = null;          // Supabase broadcast channel for typing
let typingTimeout = null;          // Debounce timer for sending typing events
let pendingFile = null;            // File selected for upload { file, name, size, type }
// ========== PHASE 5B STATE — voice notes ==========
let voiceRecorder = null;          // MediaRecorder instance
let voiceRecStream = null;         // MediaStream (mic) to stop tracks on cleanup
let voiceRecChunks = [];
let voiceRecTimerInterval = null;
let voiceRecSeconds = 0;
let pinnedMessages = [];           // Pinned messages for current chat (from DB)
let chatPage = 0;                  // Pagination page (50 msgs each)
const PAGE_SIZE = 50;
let allMsgsLoaded = false;         // True when no more old messages to load
let searchResultIdx = 0;           // Current highlighted search result index
let searchMatches = [];            // DOM elements matching search
let msgSearchVisible = false;      // Is search bar visible
let mutedChats = new Set();        // Set of muted chat IDs (loaded from DB on login)

function renderChatMessages(msgs) {
  const el = $("chatMessages");
  el.innerHTML = "";
  lastMessageDate = null;
  messageCache.clear();
  if (msgs.length === 0) {
    el.innerHTML = '<div class="emptyState">No messages yet. Say hello! 👋</div>';
    addLoadMoreBtn();
    return;
  }
  msgs.forEach(m => {
    messageCache.set(m.id, m);
    el.appendChild(buildMessageElement(m));
  });
  addLoadMoreBtn();
  el.scrollTop = el.scrollHeight;
}

function appendChatMessage(m, isNew = true) {
  const el = $("chatMessages");
  const emptyState = el.querySelector(".emptyState");
  if (emptyState) emptyState.remove();
  messageCache.set(m.id, m);
  el.appendChild(buildMessageElement(m));
  if (isNew) {
    setTimeout(() => { el.scrollTop = el.scrollHeight; }, 50);
  }
}

function showTypingIndicator(userId, userName) {
  if (typingUsers.has(userId)) return;
  typingUsers.add(userId);
  
  const el = $("chatMessages");
  const typing = document.createElement("div");
  typing.className = "messageBubbleGroup received";
  typing.dataset.typingUserId = userId;
  typing.innerHTML = `
    <div class="messageBubbleAvatar">${(userName || "?").charAt(0).toUpperCase()}</div>
    <div class="bubbleContainer">
      <div class="messageBubbleHeader">
        <span class="messageBubbleName">${escapeHtml(userName || "User")} is typing...</span>
      </div>
      <div class="typingBubble">
        <div class="typingDot"></div>
        <div class="typingDot"></div>
        <div class="typingDot"></div>
      </div>
    </div>
  `;
  el.appendChild(typing);
  el.scrollTop = el.scrollHeight;
  
  // Remove after 3 seconds if no new typing indicator
  setTimeout(() => {
    if (typingUsers.has(userId)) {
      const el = $("chatMessages");
      const existing = el.querySelector(`[data-typing-user-id="${userId}"]`);
      if (existing) existing.remove();
      typingUsers.delete(userId);
    }
  }, 3000);
}

function hideTypingIndicator(userId) {
  typingUsers.delete(userId);
  const el = $("chatMessages");
  const existing = el.querySelector(`[data-typing-user-id="${userId}"]`);
  if (existing) existing.remove();
}

// Message search
function searchMessages(query) {
  searchQuery = query;
  const el = $("chatMessages");
  const msgs = Array.from(messageCache.values());
  
  if (!query) {
    renderChatMessages(msgs);
    return;
  }
  
  const results = msgs.filter(m => m.body.toLowerCase().includes(query.toLowerCase()));
  el.innerHTML = "";
  lastMessageDate = null;
  
  if (results.length === 0) {
    el.innerHTML = '<div class="emptyState">No messages match your search.</div>';
    return;
  }
  
  results.forEach(m => appendChatMessage(m, false));
}

// Emoji reactions — one shared code path for local (optimistic) and remote (realtime) updates
function applyRemoteReaction(messageId, emoji, userId, added) {
  const msg = messageCache.get(messageId);
  if (!msg) return;
  if (!msg.reactions) msg.reactions = {};
  if (added) {
    if (!msg.reactions[emoji]) msg.reactions[emoji] = [];
    if (!msg.reactions[emoji].includes(userId)) msg.reactions[emoji].push(userId);
  } else if (msg.reactions[emoji]) {
    msg.reactions[emoji] = msg.reactions[emoji].filter(u => u !== userId);
    if (msg.reactions[emoji].length === 0) delete msg.reactions[emoji];
  }
  renderReactionPills(messageId);
}

function renderReactionPills(messageId) {
  const msg = messageCache.get(messageId);
  const reactionDiv = document.querySelector(`.messageReactions[data-message-id="${messageId}"]`);
  if (!reactionDiv) return;
  reactionDiv.innerHTML = "";
  if (msg?.reactions) {
    Object.entries(msg.reactions).forEach(([em, users]) => {
      const pill = document.createElement("button");
      pill.className = "reactionPill" + (users.includes(currentUser.id) ? " youReacted" : "");
      pill.innerHTML = `${em} <span class="reactionCount">${users.length}</span>`;
      pill.addEventListener("click", () => users.includes(currentUser.id) ? removeReactionDB(messageId, em) : addReactionDB(messageId, em));
      reactionDiv.appendChild(pill);
    });
  }
}

// Kept for backwards compatibility with any older call sites — both now delegate to the shared path
function addReaction(messageId, emoji) { applyRemoteReaction(messageId, emoji, currentUser.id, true); }
function removeReaction(messageId, emoji) { applyRemoteReaction(messageId, emoji, currentUser.id, false); }

// Pin messages
function pinMessage(messageId) {
  const msg = messageCache.get(messageId);
  if (!msg) return;
  msg.isPinned = !msg.isPinned;
  // Visual feedback
  const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (msgEl) {
    msgEl.style.borderLeft = msg.isPinned ? "4px solid var(--green)" : "none";
    msgEl.style.paddingLeft = msg.isPinned ? "12px" : "0";
  }
}

// =====================================================
// PHASE 3 — CHAT FEATURES
// =====================================================

// ---- Mute (stored in profiles.muted_chats jsonb) ----
function isMuted(chatId) { return mutedChats.has(chatId); }

async function loadMutedChats() {
  const { data } = await supabaseClient.from("profiles").select("muted_chats").eq("id", currentUser.id).single();
  mutedChats = new Set(data?.muted_chats || []);
}

async function toggleMuteChat(chatId) {
  if (mutedChats.has(chatId)) {
    mutedChats.delete(chatId);
    showToast("Chat unmuted.");
  } else {
    mutedChats.add(chatId);
    showToast("Chat muted. You won't get notifications for new messages.");
  }
  await supabaseClient.from("profiles").update({ muted_chats: Array.from(mutedChats) }).eq("id", currentUser.id);
  updateMuteButton(chatId);
}

function updateMuteButton(chatId) {
  const btn = $("btnMuteChat");
  if (!btn) return;
  const muted = mutedChats.has(chatId);
  btn.textContent = muted ? "🔔" : "🔕";
  btn.title = muted ? "Unmute notifications" : "Mute notifications";
  btn.classList.toggle("active", muted);
}

$("btnMuteChat").addEventListener("click", () => {
  if (activeChatId) toggleMuteChat(activeChatId);
});

$("btnChatBack").addEventListener("click", () => {
  exitMobileChatView();
});

// ---- Pinned Messages (stored in meeting_messages.is_pinned) ----
async function loadPinnedMessages(roomId) {
  const { data } = await supabaseClient.from("meeting_messages")
    .select("*").eq("room_id", roomId).eq("is_pinned", true).order("created_at", { ascending: false });
  pinnedMessages = data || [];
  renderPinnedPanel();
}

function renderPinnedPanel() {
  const list = $("pinnedList");
  if (!list) return;
  if (pinnedMessages.length === 0) {
    list.innerHTML = '<div style="padding:10px 14px;font-size:13px;color:var(--muted)">No pinned messages.</div>';
    return;
  }
  list.innerHTML = "";
  pinnedMessages.forEach(m => {
    const item = document.createElement("div");
    item.className = "pinnedItem";
    const senderProfile = allProfilesCache.get(m.sender_id) || { full_name: "User" };
    item.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="pinnedItemMeta">${escapeHtml(senderProfile.full_name)}</div>
        <div class="pinnedItemText">${m.is_deleted ? "<em>Message deleted</em>" : escapeHtml(m.body || "")}</div>
      </div>
      <button class="unpinBtn" data-id="${m.id}" title="Unpin">✕</button>
    `;
    item.querySelector(".unpinBtn").addEventListener("click", (e) => {
      e.stopPropagation();
      unpinMessage(m.id);
    });
    item.addEventListener("click", () => scrollToMessage(m.id));
    list.appendChild(item);
  });
}

async function togglePinMessage(messageId) {
  const msg = messageCache.get(messageId);
  if (!msg) return;
  const newPinned = !msg.is_pinned;
  const { error } = await supabaseClient.from("meeting_messages").update({ is_pinned: newPinned }).eq("id", messageId);
  if (error) { showToast("Could not update pin: " + error.message); return; }
  msg.is_pinned = newPinned;
  // Update pinned list
  if (newPinned) {
    pinnedMessages.unshift(msg);
    showToast("Message pinned.");
  } else {
    pinnedMessages = pinnedMessages.filter(p => p.id !== messageId);
    showToast("Message unpinned.");
  }
  renderPinnedPanel();
  // Update visual on bubble
  const group = document.querySelector(`.messageBubbleGroup[data-message-id="${messageId}"]`);
  if (group) group.classList.toggle("isPinned", newPinned);
  // Update pin tag in bubble
  const container = group?.querySelector(".bubbleContainer");
  let tag = container?.querySelector(".pinnedTag");
  if (newPinned && container && !tag) {
    tag = document.createElement("span");
    tag.className = "pinnedTag";
    tag.textContent = "📌 Pinned";
    container.insertBefore(tag, container.firstChild);
  } else if (!newPinned && tag) {
    tag.remove();
  }
}

async function unpinMessage(messageId) { await togglePinMessage(messageId); }

function scrollToMessage(messageId) {
  const el = document.querySelector(`.messageBubbleGroup[data-message-id="${messageId}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

$("btnPinList").addEventListener("click", () => {
  $("pinnedPanel").classList.toggle("hidden");
});
$("btnClosePinPanel").addEventListener("click", () => {
  $("pinnedPanel").classList.add("hidden");
});

// ---- Message Edit ----
async function editMessage(messageId) {
  const msg = messageCache.get(messageId);
  if (!msg || msg.sender_id !== currentUser.id || msg.is_deleted) return;

  const group = document.querySelector(`.messageBubbleGroup[data-message-id="${messageId}"]`);
  const textEl = group?.querySelector(".bubbleText");
  if (!textEl) return;

  const originalText = msg.body;
  textEl.classList.add("editingBubble");

  const textarea = document.createElement("textarea");
  textarea.className = "editInput";
  textarea.value = originalText;
  textarea.rows = 2;
  textEl.innerHTML = "";
  textEl.appendChild(textarea);

  const actions = document.createElement("div");
  actions.className = "editActions";
  actions.innerHTML = `
    <button class="btn btnPrimary btnSm" id="saveEditBtn">Save</button>
    <button class="btn btnGhost btnSm" id="cancelEditBtn">Cancel</button>
  `;
  textEl.appendChild(actions);
  textarea.focus();

  actions.querySelector("#saveEditBtn").addEventListener("click", async () => {
    const newBody = textarea.value.trim();
    if (!newBody || newBody === originalText) {
      cancelEdit(textEl, originalText);
      return;
    }
    const { error } = await supabaseClient.from("meeting_messages")
      .update({ body: newBody, edited_at: new Date().toISOString() }).eq("id", messageId);
    if (error) { showToast("Could not edit: " + error.message); return; }
    msg.body = newBody;
    msg.edited_at = new Date().toISOString();
    textEl.classList.remove("editingBubble");
    textEl.textContent = newBody;
    const editedLabel = document.createElement("span");
    editedLabel.style.cssText = "font-size:10px;color:var(--muted);margin-left:4px;";
    editedLabel.textContent = "(edited)";
    textEl.appendChild(editedLabel);
    showToast("Message updated.");
  });

  actions.querySelector("#cancelEditBtn").addEventListener("click", () => {
    cancelEdit(textEl, originalText);
  });
}

function cancelEdit(textEl, originalText) {
  textEl.classList.remove("editingBubble");
  textEl.textContent = originalText;
}

// ---- Message Delete ----
async function deleteMessage(messageId) {
  if (!confirm("Delete this message? This cannot be undone.")) return;
  const { error } = await supabaseClient.from("meeting_messages")
    .update({ is_deleted: true, body: null }).eq("id", messageId);
  if (error) { showToast("Could not delete: " + error.message); return; }
  const msg = messageCache.get(messageId);
  if (msg) { msg.is_deleted = true; msg.body = null; }
  handleMessageDelete_local(messageId);
  showToast("Message deleted.");
}

function handleMessageDelete_local(messageId) {
  const group = document.querySelector(`.messageBubbleGroup[data-message-id="${messageId}"]`);
  const textEl = group?.querySelector(".bubbleText");
  if (textEl) {
    textEl.innerHTML = '<span class="deletedMsg">This message was deleted.</span>';
  }
  // Remove from pinned if pinned
  if (pinnedMessages.find(p => p.id === messageId)) {
    pinnedMessages = pinnedMessages.filter(p => p.id !== messageId);
    renderPinnedPanel();
  }
}

function handleMessageUpdate(newMsg) {
  const msg = messageCache.get(newMsg.id);
  if (!msg) return;
  Object.assign(msg, newMsg);
  const group = document.querySelector(`.messageBubbleGroup[data-message-id="${newMsg.id}"]`);
  const textEl = group?.querySelector(".bubbleText");
  if (!textEl) return;
  if (newMsg.is_deleted) {
    textEl.innerHTML = '<span class="deletedMsg">This message was deleted.</span>';
  } else if (newMsg.body) {
    textEl.textContent = newMsg.body;
    if (newMsg.edited_at && !textEl.querySelector(".editedLabel")) {
      const label = document.createElement("span");
      label.className = "editedLabel";
      label.style.cssText = "font-size:10px;color:var(--muted);margin-left:4px;";
      label.textContent = "(edited)";
      textEl.appendChild(label);
    }
  }
}

function handleMessageDelete(id) { if (id) handleMessageDelete_local(id); }

// ---- Context Menu (right-click / long-press on message) ----
let activeContextMenu = null;

function showMessageContextMenu(e, messageId) {
  e.preventDefault();
  closeContextMenu();
  const msg = messageCache.get(messageId);
  if (!msg) return;
  const mine = msg.sender_id === currentUser.id;

  const menu = document.createElement("div");
  menu.className = "msgContextMenu";
  activeContextMenu = menu;

  // Quick emoji reactions
  const quickEmojis = ["❤️", "😂", "👍", "😮", "😢", "🙏"];
  const emojiRow = document.createElement("div");
  emojiRow.className = "emojiRow";
  quickEmojis.forEach(em => {
    const btn = document.createElement("button");
    btn.textContent = em;
    const alreadyReacted = msg.reactions && msg.reactions[em] && msg.reactions[em].includes(currentUser.id);
    if (alreadyReacted) btn.classList.add("youReacted");
    btn.addEventListener("click", () => {
      if (alreadyReacted) removeReactionDB(messageId, em); else addReactionDB(messageId, em);
      closeContextMenu();
    });
    emojiRow.appendChild(btn);
  });
  menu.appendChild(emojiRow);

  // Actions
  const actions = [
    { icon: "📌", label: msg.is_pinned ? "Unpin" : "Pin message", fn: () => togglePinMessage(messageId) },
    { icon: "💬", label: "Reply", fn: () => setReply(messageId) },
    { icon: "↪️", label: "Forward", fn: () => openForwardPicker(messageId) },
  ];
  if (mine && !msg.is_deleted) {
    actions.push({ icon: "✏️", label: "Edit", fn: () => editMessage(messageId) });
    actions.push({ icon: "🗑️", label: "Delete", fn: () => deleteMessage(messageId), danger: true });
  }
  actions.push({ icon: "📋", label: "Copy text", fn: () => { navigator.clipboard?.writeText(msg.body || ""); showToast("Copied!"); } });

  actions.forEach(({ icon, label, fn, danger }) => {
    const btn = document.createElement("button");
    btn.innerHTML = `<span>${icon}</span> ${label}`;
    if (danger) btn.classList.add("danger");
    btn.addEventListener("click", () => { fn(); closeContextMenu(); });
    menu.appendChild(btn);
  });

  // Position
  menu.style.position = "fixed";
  menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + "px";
  menu.style.top = Math.min(e.clientY, window.innerHeight - 200) + "px";
  document.body.appendChild(menu);

  setTimeout(() => document.addEventListener("click", closeContextMenu, { once: true }), 10);
}

function closeContextMenu() {
  if (activeContextMenu) { activeContextMenu.remove(); activeContextMenu = null; }
}

// ---- Reply to message ----
let replyToMsg = null;

function setReply(messageId) {
  const msg = messageCache.get(messageId);
  if (!msg) return;
  replyToMsg = msg;
  const senderProfile = allProfilesCache.get(msg.sender_id) || { full_name: "User" };
  let replyBar = $("replyBar");
  if (!replyBar) {
    replyBar = document.createElement("div");
    replyBar.id = "replyBar";
    replyBar.style.cssText = "display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--greenSoft);border-top:1px solid var(--border);font-size:12px;color:var(--text)";
    const composer = document.querySelector(".chatComposer");
    composer.parentElement.insertBefore(replyBar, composer);
  }
  replyBar.innerHTML = `
    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
      ↩️ Replying to <strong>${escapeHtml(senderProfile.full_name)}</strong>: ${escapeHtml((msg.body || "").slice(0, 60))}
    </span>
    <button onclick="clearReply()" style="background:none;border:none;cursor:pointer;font-size:16px">✕</button>
  `;
  $("chatInput").focus();
}

function clearReply() {
  replyToMsg = null;
  const bar = $("replyBar");
  if (bar) bar.remove();
}

// ---- Message Forwarding ----
function openForwardPicker(messageId) {
  const msg = messageCache.get(messageId);
  if (!msg) return;
  const threads = chatThreadsCache.filter(t => t.id !== activeChatId);
  if (!threads.length) {
    showToast("No other chats to forward to yet.");
    return;
  }
  openModal(`
    <div class="modalTitle">↪️ Forward message</div>
    <div class="list" id="forwardThreadList" style="max-height:320px;overflow-y:auto">
      ${threads.map(t => `
        <div class="listItem forwardThreadItem" data-forward-thread="${t.id}" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center">
          <span>${escapeHtml(t.title)}</span>
          <button class="btn btnPrimary btnSm" data-forward-thread-btn="${t.id}">Forward</button>
        </div>
      `).join("")}
    </div>
    <button class="btn btnGhost btnSm" id="forwardCancel" style="width:100%;margin-top:10px">Cancel</button>
  `);
  $("forwardCancel").addEventListener("click", closeModal);
  document.querySelectorAll("[data-forward-thread-btn]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const targetRoomId = btn.dataset.forwardThreadBtn;
      btn.disabled = true; btn.textContent = "Sending…";
      await forwardMessageToRoom(msg, targetRoomId);
      closeModal();
    });
  });
}

async function forwardMessageToRoom(msg, targetRoomId) {
  const originalSender = allProfilesCache.get(msg.sender_id) || { full_name: "Someone" };
  const fwdObj = {
    room_id: targetRoomId,
    sender_id: currentUser.id,
    body: msg.is_deleted ? "" : (msg.body || ""),
    file_url: msg.file_url || null,
    file_name: msg.file_name || null,
    file_size: msg.file_size || null,
    file_type: msg.file_type || null,
    is_forwarded: true,
    forwarded_from_name: originalSender.full_name || "Someone",
  };
  const { error } = await supabaseClient.from("meeting_messages").insert(fwdObj);
  if (error) { showToast("Could not forward: " + error.message); return; }
  const targetThread = chatThreadsCache.find(t => t.id === targetRoomId);
  notifyOtherParticipants(targetRoomId, "message", currentProfile?.full_name || "Someone", "Forwarded a message to you");
  showToast(`Forwarded to ${targetThread ? targetThread.title : "chat"}`);
}

// ---- File Attach ----
$("btnAttach").addEventListener("click", () => $("fileInput").click());
$("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { showToast("File too large (max 10 MB)"); return; }
  pendingFile = file;
  $("filePreviewName").textContent = `📎 ${file.name} (${formatFileSize(file.size)})`;
  $("filePreviewBar").classList.remove("hidden");
  $("fileInput").value = "";
});

$("btnCancelFile").addEventListener("click", () => {
  pendingFile = null;
  $("filePreviewBar").classList.add("hidden");
  $("filePreviewName").textContent = "";
});

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

async function uploadFileToSupabase(file) {
  const ext = file.name.split(".").pop();
  const path = `chat/${activeChatId}/${Date.now()}_${currentUser.id}.${ext}`;
  const { data, error } = await supabaseClient.storage.from("chat-files").upload(path, file);
  if (error) throw error;
  const { data: urlData } = supabaseClient.storage.from("chat-files").getPublicUrl(path);
  return { url: urlData.publicUrl, name: file.name, size: file.size, type: file.type };
}

// ---- Voice Notes (record in-browser via MediaRecorder, upload to chat-files, send as an audio bubble) ----
$("btnVoiceNote").addEventListener("click", startVoiceRecording);
$("btnCancelVoiceRec").addEventListener("click", cancelVoiceRecording);
$("btnStopVoiceRec").addEventListener("click", stopVoiceRecordingAndSend);

async function startVoiceRecording() {
  if (!activeChatId) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showToast("Voice notes aren't supported on this browser.");
    return;
  }
  try {
    voiceRecStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    showToast("Microphone access denied.");
    return;
  }
  voiceRecChunks = [];
  voiceRecorder = new MediaRecorder(voiceRecStream);
  voiceRecorder.ondataavailable = (e) => { if (e.data.size > 0) voiceRecChunks.push(e.data); };
  voiceRecorder.start();

  voiceRecSeconds = 0;
  $("voiceRecTimer").textContent = "0:00";
  $("voiceRecordBar").classList.remove("hidden");
  document.querySelector(".chatComposer").classList.add("hidden");
  voiceRecTimerInterval = setInterval(() => {
    voiceRecSeconds++;
    const mm = Math.floor(voiceRecSeconds / 60);
    const ss = String(voiceRecSeconds % 60).padStart(2, "0");
    $("voiceRecTimer").textContent = `${mm}:${ss}`;
  }, 1000);
}

function stopMediaRecorderTracks() {
  clearInterval(voiceRecTimerInterval);
  voiceRecTimerInterval = null;
  if (voiceRecStream) { voiceRecStream.getTracks().forEach(t => t.stop()); voiceRecStream = null; }
  $("voiceRecordBar").classList.add("hidden");
  document.querySelector(".chatComposer").classList.remove("hidden");
}

function cancelVoiceRecording() {
  if (voiceRecorder && voiceRecorder.state !== "inactive") {
    voiceRecorder.onstop = null;
    voiceRecorder.stop();
  }
  voiceRecorder = null;
  voiceRecChunks = [];
  stopMediaRecorderTracks();
}

async function stopVoiceRecordingAndSend() {
  if (!voiceRecorder || voiceRecorder.state === "inactive") return;
  const roomId = activeChatId;
  voiceRecorder.onstop = async () => {
    stopMediaRecorderTracks();
    const blob = new Blob(voiceRecChunks, { type: "audio/webm" });
    voiceRecChunks = [];
    if (blob.size < 500) { showToast("Recording too short."); return; } // avoid accidental empty sends
    const file = new File([blob], `voice_note_${Date.now()}.webm`, { type: "audio/webm" });
    try {
      const path = `chat/${roomId}/${Date.now()}_${currentUser.id}_voice.webm`;
      const { error } = await supabaseClient.storage.from("chat-files").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabaseClient.storage.from("chat-files").getPublicUrl(path);
      const msgObj = {
        room_id: roomId, sender_id: currentUser.id, body: "🎤 Voice note",
        file_url: urlData.publicUrl, file_name: file.name, file_size: file.size, file_type: "audio/webm",
      };
      const tempMsg = { ...msgObj, id: "temp_" + Date.now(), created_at: new Date().toISOString() };
      appendChatMessage(tempMsg);
      const { data: inserted, error: insertErr } = await supabaseClient.from("meeting_messages").insert(msgObj).select().single();
      if (insertErr) { showToast(insertErr.message); return; }
      const tempEl = document.querySelector(`[data-message-id="${tempMsg.id}"]`);
      if (tempEl) { tempEl.dataset.messageId = inserted.id; messageCache.delete(tempMsg.id); messageCache.set(inserted.id, inserted); }
      notifyOtherParticipants(roomId, "message", currentProfile?.full_name || "Someone", "Sent a voice note");
    } catch (err) {
      showToast("Voice note upload failed: " + (err.message || "Storage error"));
    }
  };
  voiceRecorder.stop();
}

// ---- Send Message (upgraded) ----
$("chatSend").addEventListener("click", sendChatMessage);
$("chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) sendChatMessage();
});

$("btnAiImprove").addEventListener("click", () => {
  openAiImproveModal($("chatInput").value, (text) => {
    $("chatInput").value = text;
    $("chatInput").focus();
  });
});

// Typing broadcast on input
$("chatInput").addEventListener("input", () => {
  if (!typingChannel || !activeChatId) return;
  typingChannel.send({ type: "broadcast", event: "typing", payload: { userId: currentUser.id, userName: currentProfile?.full_name || "User" } });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typingChannel?.send({ type: "broadcast", event: "stop_typing", payload: { userId: currentUser.id } });
  }, 2500);
});

async function sendChatMessage() {
  const body = $("chatInput").value.trim();
  if (!body && !pendingFile) return;
  if (!activeChatId) return;

  $("chatInput").value = "";
  // Stop typing indicator
  clearTimeout(typingTimeout);
  typingChannel?.send({ type: "broadcast", event: "stop_typing", payload: { userId: currentUser.id } });

  let fileData = null;

  // Handle file upload
  if (pendingFile) {
    const file = pendingFile;
    pendingFile = null;
    $("filePreviewBar").classList.add("hidden");
    try {
      fileData = await uploadFileToSupabase(file);
    } catch (err) {
      showToast("File upload failed: " + (err.message || "Storage bucket not set up yet"));
      // Fall through — send text only if there is some
      if (!body) return;
    }
  }

  // Build message object
  const msgObj = {
    room_id: activeChatId,
    sender_id: currentUser.id,
    body: body || (fileData ? fileData.name : ""),
    reply_to_id: replyToMsg?.id || null,
    file_url: fileData?.url || null,
    file_name: fileData?.name || null,
    file_size: fileData?.size || null,
    file_type: fileData?.type || null,
  };

  clearReply();

  // Optimistic append
  const tempMsg = { ...msgObj, id: "temp_" + Date.now(), created_at: new Date().toISOString() };
  appendChatMessage(tempMsg);

  const { data: inserted, error } = await supabaseClient.from("meeting_messages").insert(msgObj).select().single();
  if (error) {
    showToast(error.message);
    // Remove temp
    const tempEl = document.querySelector(`[data-message-id="${tempMsg.id}"]`);
    if (tempEl) tempEl.remove();
    return;
  }

  // Replace temp with real message
  const tempEl = document.querySelector(`[data-message-id="${tempMsg.id}"]`);
  if (tempEl) {
    tempEl.dataset.messageId = inserted.id;
    messageCache.delete(tempMsg.id);
    messageCache.set(inserted.id, inserted);
  }

  notifyOtherParticipants(activeChatId, "message", currentProfile?.full_name || "Someone", body || "Sent an attachment");
}

async function notifyOtherParticipants(roomId, type, title, body) {
  try {
    const { data: parts } = await supabaseClient.from("meeting_participants").select("user_id").eq("room_id", roomId);
    const others = (parts || []).map(p => p.user_id).filter(id => id !== currentUser.id);
    if (!others.length) return;
    await Promise.all(others.map(uid => createNotification({
      user_id: uid, type, title, body: body?.slice(0, 120), related_room_id: roomId,
    })));
  } catch (err) { console.error("notify error", err); }
}

// ---- Emoji Picker ----
const EMOJI_LIST = ["😀","😂","🥹","😍","🤔","😎","😭","🥺","😡","🤯","👍","👎","❤️","🔥","✨","🎉","💯","🙏","👋","💪","🤝","😊","🥰","😏","😜","🫡","🤣","😢","😤","🙄","💀","🫶","💔","💕","😆","😅","🤗","😴","🤮","🤑","🎊","🏆","🌟","💫","⚡","🎯","🚀","💡","🌈","🦋"];

function initEmojiPicker() {
  const grid = $("emojiGrid");
  if (!grid) return;
  grid.innerHTML = "";
  EMOJI_LIST.forEach(em => {
    const btn = document.createElement("button");
    btn.textContent = em;
    btn.addEventListener("click", () => {
      const input = $("chatInput");
      const pos = input.selectionStart;
      const val = input.value;
      input.value = val.slice(0, pos) + em + val.slice(pos);
      input.selectionStart = input.selectionEnd = pos + em.length;
      input.focus();
      $("emojiPickerPopover").classList.add("hidden");
    });
    grid.appendChild(btn);
  });
}

$("btnEmojiPicker").addEventListener("click", (e) => {
  e.stopPropagation();
  const pop = $("emojiPickerPopover");
  pop.classList.toggle("hidden");
  if (!pop.classList.contains("hidden")) initEmojiPicker();
});
document.addEventListener("click", () => $("emojiPickerPopover")?.classList.add("hidden"));
$("emojiPickerPopover")?.addEventListener("click", e => e.stopPropagation());

// ---- Message Search (in-chat) ----
let msgSearchBar = null;

$("btnMsgSearch").addEventListener("click", () => {
  toggleMsgSearch();
});

function toggleMsgSearch() {
  msgSearchVisible = !msgSearchVisible;
  if (msgSearchVisible) {
    showMsgSearchBar();
  } else {
    hideMsgSearchBar();
  }
}

function showMsgSearchBar() {
  if ($("msgSearchBar")) return;
  const bar = document.createElement("div");
  bar.id = "msgSearchBar";
  bar.className = "msgSearchBar";
  bar.innerHTML = `
    <input type="text" id="msgSearchInput" placeholder="Search messages…" autocomplete="off"/>
    <div class="searchNav">
      <span id="searchCount"></span>
      <button id="searchPrev" title="Previous">↑</button>
      <button id="searchNext" title="Next">↓</button>
      <button id="closeSearch" title="Close search">✕</button>
    </div>
  `;
  const composer = document.querySelector(".chatComposer");
  composer.parentElement.insertBefore(bar, composer);
  bar.querySelector("#msgSearchInput").addEventListener("input", (e) => {
    doMsgSearch(e.target.value.trim());
  });
  bar.querySelector("#searchPrev").addEventListener("click", () => navigateSearch(-1));
  bar.querySelector("#searchNext").addEventListener("click", () => navigateSearch(1));
  bar.querySelector("#closeSearch").addEventListener("click", hideMsgSearchBar);
  bar.querySelector("#msgSearchInput").focus();
}

function hideMsgSearchBar() {
  msgSearchVisible = false;
  const bar = $("msgSearchBar");
  if (bar) bar.remove();
  // Clear highlights
  document.querySelectorAll(".searchHighlight").forEach(el => {
    el.classList.remove("searchHighlight", "searchHighlightActive");
  });
  searchMatches = []; searchResultIdx = 0;
}

function doMsgSearch(query) {
  // Clear old highlights
  document.querySelectorAll(".searchHighlight").forEach(el => {
    el.classList.remove("searchHighlight", "searchHighlightActive");
  });
  searchMatches = []; searchResultIdx = 0;
  if (!query) { updateSearchCount(); return; }

  const q = query.toLowerCase();
  document.querySelectorAll(".bubbleText").forEach(el => {
    const text = el.textContent.toLowerCase();
    if (text.includes(q)) {
      el.classList.add("searchHighlight");
      searchMatches.push(el);
    }
  });
  updateSearchCount();
  if (searchMatches.length > 0) {
    searchResultIdx = 0;
    searchMatches[0].classList.add("searchHighlightActive");
    searchMatches[0].scrollIntoView({ behavior: "smooth", block: "center" });
    // Add highlight style inline if not in CSS
    searchMatches[0].style.outline = "2px solid var(--green)";
  }
}

function navigateSearch(dir) {
  if (searchMatches.length === 0) return;
  searchMatches[searchResultIdx].classList.remove("searchHighlightActive");
  searchMatches[searchResultIdx].style.outline = "";
  searchResultIdx = (searchResultIdx + dir + searchMatches.length) % searchMatches.length;
  searchMatches[searchResultIdx].classList.add("searchHighlightActive");
  searchMatches[searchResultIdx].style.outline = "2px solid var(--green)";
  searchMatches[searchResultIdx].scrollIntoView({ behavior: "smooth", block: "center" });
  updateSearchCount();
}

function updateSearchCount() {
  const el = $("searchCount");
  if (!el) return;
  el.textContent = searchMatches.length > 0 ? `${searchResultIdx + 1}/${searchMatches.length}` : "No results";
}

// ---- Persistent Emoji Reactions (via message_reactions table) ----
async function addReactionDB(messageId, emoji) {
  // First try DB; fallback to in-memory
  const { error } = await supabaseClient.from("message_reactions").upsert({
    message_id: messageId, user_id: currentUser.id, emoji,
  }, { onConflict: "message_id,user_id,emoji" });
  if (error) {
    // Table may not exist yet — fall back to in-memory
    addReaction(messageId, emoji);
    return;
  }
  addReaction(messageId, emoji); // update UI
}

async function removeReactionDB(messageId, emoji) {
  const { error } = await supabaseClient.from("message_reactions").delete()
    .eq("message_id", messageId).eq("user_id", currentUser.id).eq("emoji", emoji);
  if (error) removeReaction(messageId, emoji);
  removeReaction(messageId, emoji); // update UI
}

// ---- Build Message Element (extracted for reuse with context menu) ----
function buildMessageElement(m) {
  const mine = m.sender_id === currentUser.id;
  const senderProfile = allProfilesCache.get(m.sender_id) || { full_name: "Unknown", avatar_url: null };
  const initial = (senderProfile.full_name || "?").trim().charAt(0).toUpperCase();

  // Date divider
  const msgDate = new Date(m.created_at).toLocaleDateString();
  const frag = document.createDocumentFragment();
  if (msgDate !== lastMessageDate) {
    lastMessageDate = msgDate;
    const divider = document.createElement("div");
    divider.className = "messageTimestampDivider";
    divider.textContent = msgDate;
    frag.appendChild(divider);
  }

  const group = document.createElement("div");
  group.className = "messageBubbleGroup " + (mine ? "sent" : "received") + (m.is_pinned ? " isPinned" : "");
  group.dataset.messageId = m.id;

  // Context menu on right-click or long-press
  group.addEventListener("contextmenu", (e) => showMessageContextMenu(e, m.id));
  let pressTimer;
  group.addEventListener("touchstart", () => { pressTimer = setTimeout(() => showMessageContextMenu({ preventDefault(){}, clientX: 100, clientY: 200 }, m.id), 600); });
  group.addEventListener("touchend", () => clearTimeout(pressTimer));

  const avatar = document.createElement("div");
  avatar.className = "messageBubbleAvatar";
  avatar.title = senderProfile.full_name || "Unknown";
  avatar.style.cursor = "pointer";
  if (senderProfile.avatar_url) {
    const img = document.createElement("img");
    img.src = senderProfile.avatar_url;
    img.alt = senderProfile.full_name || "";
    avatar.appendChild(img);
  } else { avatar.textContent = initial; }
  if (!mine) avatar.addEventListener("click", () => openProfileView(m.sender_id));

  const container = document.createElement("div");
  container.className = "bubbleContainer";

  // Pin tag
  if (m.is_pinned) {
    const tag = document.createElement("span");
    tag.className = "pinnedTag";
    tag.textContent = "📌 Pinned";
    container.appendChild(tag);
  }

  // Forwarded tag
  if (m.is_forwarded) {
    const tag = document.createElement("div");
    tag.className = "forwardedTag";
    tag.textContent = `↪️ Forwarded${m.forwarded_from_name ? " from " + m.forwarded_from_name : ""}`;
    container.appendChild(tag);
  }

  // Reply quote
  if (m.reply_to_id) {
    const replyQuote = messageCache.get(m.reply_to_id);
    if (replyQuote) {
      const quoteSender = allProfilesCache.get(replyQuote.sender_id) || { full_name: "User" };
      const quote = document.createElement("div");
      quote.style.cssText = "border-left:3px solid var(--green);padding:4px 8px;margin-bottom:4px;font-size:11px;color:var(--muted);cursor:pointer;background:var(--greenSoft);border-radius:4px;";
      quote.innerHTML = `<strong>${escapeHtml(quoteSender.full_name)}</strong>: ${escapeHtml((replyQuote.body || "").slice(0, 80))}`;
      quote.addEventListener("click", () => scrollToMessage(m.reply_to_id));
      container.appendChild(quote);
    }
  }

  if (!mine) {
    const header = document.createElement("div");
    header.className = "messageBubbleHeader";
    const nameSpan = document.createElement("span");
    nameSpan.className = "messageBubbleName";
    nameSpan.textContent = senderProfile.full_name || "Unknown";
    nameSpan.style.cursor = "pointer";
    nameSpan.addEventListener("click", () => openProfileView(m.sender_id));
    const timeSpan = document.createElement("span");
    timeSpan.className = "messageBubbleTime";
    timeSpan.textContent = new Date(m.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    header.appendChild(nameSpan);
    header.appendChild(timeSpan);
    container.appendChild(header);
  }

  // Message content: file, image, or text
  if (m.file_url) {
    const isImage = m.file_type && m.file_type.startsWith("image/");
    const isAudio = m.file_type && m.file_type.startsWith("audio/");
    if (isImage) {
      const imgWrap = document.createElement("div");
      imgWrap.className = "imageBubble";
      const img = document.createElement("img");
      img.src = m.file_url;
      img.alt = m.file_name || "Image";
      img.loading = "lazy";
      img.addEventListener("click", () => openLightbox(m.file_url));
      imgWrap.appendChild(img);
      container.appendChild(imgWrap);
    } else if (isAudio) {
      const voiceWrap = document.createElement("div");
      voiceWrap.className = "voiceNoteBubble";
      voiceWrap.innerHTML = `
        <span class="voiceNoteIcon">🎤</span>
        <audio controls preload="none" src="${escapeHtml(m.file_url)}"></audio>
        ${m.file_size ? `<span class="voiceNoteSize">${formatFileSize(m.file_size)}</span>` : ""}
      `;
      container.appendChild(voiceWrap);
    } else {
      const fileBubble = document.createElement("div");
      fileBubble.className = "fileBubble";
      fileBubble.addEventListener("click", () => window.open(m.file_url, "_blank"));
      const icon = getFileIcon(m.file_name || "");
      fileBubble.innerHTML = `
        <span class="fileIcon">${icon}</span>
        <div class="fileInfo">
          <div class="fileName">${escapeHtml(m.file_name || "File")}</div>
          <div class="fileSize">${m.file_size ? formatFileSize(m.file_size) : ""}</div>
        </div>
      `;
      container.appendChild(fileBubble);
    }
    // Also show caption text if any (skip the default "🎤 Voice note" placeholder body)
    if (m.body && m.body !== m.file_name && !(isAudio && m.body === "🎤 Voice note")) {
      const cap = document.createElement("div");
      cap.className = "bubbleText";
      cap.dataset.messageId = m.id;
      cap.textContent = m.body;
      container.appendChild(cap);
    }
  } else {
    const text = document.createElement("div");
    text.className = "bubbleText";
    text.dataset.messageId = m.id;
    if (m.is_deleted) {
      text.innerHTML = '<span class="deletedMsg">This message was deleted.</span>';
    } else {
      text.textContent = m.body || "";
      if (m.edited_at) {
        const label = document.createElement("span");
        label.style.cssText = "font-size:10px;color:var(--muted);margin-left:4px;";
        label.textContent = "(edited)";
        text.appendChild(label);
      }
    }
    container.appendChild(text);
  }

  // Sent time + read receipt (only for sent messages)
  if (mine) {
    const timeDiv = document.createElement("div");
    timeDiv.className = "sentTime";
    timeDiv.innerHTML = `${new Date(m.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })} <span class="readReceipt" title="Delivered">✓✓</span>`;
    container.appendChild(timeDiv);
  }

  // Reactions div
  const reactionsDiv = document.createElement("div");
  reactionsDiv.className = "messageReactions";
  reactionsDiv.dataset.messageId = m.id;
  // Render existing reactions from cache
  if (m.reactions) {
    Object.entries(m.reactions).forEach(([em, users]) => {
      const pill = document.createElement("button");
      pill.className = "reactionPill" + (users.includes(currentUser.id) ? " youReacted" : "");
      pill.innerHTML = `${em} <span class="reactionCount">${users.length}</span>`;
      pill.addEventListener("click", () => users.includes(currentUser.id) ? removeReactionDB(m.id, em) : addReactionDB(m.id, em));
      reactionsDiv.appendChild(pill);
    });
  }
  container.appendChild(reactionsDiv);

  // Read receipt
  if (mine) {
    const status = document.createElement("div");
    status.className = "messageStatus seen";
    status.innerHTML = `<span>✓✓</span> Seen`;
    container.appendChild(status);
  }

  if (!mine) group.appendChild(avatar);
  group.appendChild(container);
  if (mine) group.appendChild(avatar);
  frag.appendChild(group);

  return frag;
}

function getFileIcon(name) {
  const ext = name.split(".").pop()?.toLowerCase();
  const map = { pdf: "📄", doc: "📝", docx: "📝", txt: "📃", xls: "📊", xlsx: "📊", zip: "🗜️", rar: "🗜️" };
  return map[ext] || "📎";
}

function openLightbox(url) {
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.innerHTML = `<button class="closeBtn">✕</button><img loading="lazy" src="${escapeHtml(url)}" />`;
  lb.querySelector(".closeBtn").addEventListener("click", () => lb.remove());
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.remove(); });
  document.body.appendChild(lb);
}

// ---- Mute notifications for a chat (legacy in-memory, kept for compatibility) ----
function muteChat(chatId) { mutedChats.add(chatId); showToast("Chat muted."); }
function unmuteChat(chatId) { mutedChats.delete(chatId); showToast("Chat unmuted."); }

// ---------------------------------------------------------------------------
// Voice calls (WebRTC, app-to-app only — via the same Jitsi infra as video
// meetings, but audio-only. No real phone numbers / voicemail: that would
// need a telephony provider like Twilio, see README.)
// ---------------------------------------------------------------------------
$("btnStartCall").addEventListener("click", () => {
  if (!activeChatId) return;
  startVoiceCall(activeChatId);
});

async function startVoiceCall(roomId) {
  const { data: call, error } = await supabaseClient.from("calls").insert({
    room_id: roomId, call_type: "voice", status: "active", started_by: currentUser.id,
  }).select().single();
  if (error) { showToast(error.message); return; }
  await supabaseClient.from("call_participants").insert({ call_id: call.id, user_id: currentUser.id });
  joinVoiceCall(call.id, roomId);
}

function joinVoiceCall(callId, roomId) {
  activeCallId = callId;
  activeCallRoomId = roomId;
  const room = findAnyRoomCached(roomId);
  const jitsiRoom = `meetandgreetvoice-${roomId}`;
  openJitsiCall({ room: jitsiRoom, title: "Voice call — " + (room?.title || ""), audioOnly: true, showCamBtn: false });
}

function startGlobalCallListener() {
  supabaseClient.channel("calls:incoming")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls" }, (payload) => {
      const call = payload.new;
      if (call.status !== "active") return;
      if (call.id === activeCallId) return;
      if (call.started_by === currentUser.id) {
        // Same account, different device started this call — offer to join it here.
        showHandoffBanner(call);
      } else {
        showIncomingCall(call);
      }
    })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "calls" }, (payload) => {
      // If the caller hangs up before we accept, clear the banner.
      if (pendingIncomingCall && payload.new.id === pendingIncomingCall.id && payload.new.status === "ended") {
        hideIncomingCall();
      }
      if (pendingHandoffCall && payload.new.id === pendingHandoffCall.id && payload.new.status === "ended") {
        hideHandoffBanner();
      }
      if (payload.new.id === activeCallId && payload.new.status === "ended") {
        loadCallHistory();
      }
    })
    .subscribe();
}

// Cross-device handoff: catches the case where a call was already active
// before this tab/device connected (e.g. app just opened), as a fallback to
// the realtime INSERT handler above. Real-time gives instant detection when
// this device is already open; this poll is the catch-up path.
function startHandoffCheckLoop() {
  checkForActiveCallHandoff();
  setInterval(checkForActiveCallHandoff, 20 * 1000);
}

async function checkForActiveCallHandoff() {
  if (activeCallId) { hideHandoffBanner(); return; } // already on the call, from this device
  const { data, error } = await supabaseClient
    .from("call_participants")
    .select("call_id, left_at, calls!inner(id, room_id, status)")
    .eq("user_id", currentUser.id)
    .is("left_at", null)
    .eq("calls.status", "active");
  if (error) { console.error(error); return; }
  const row = (data || []).find(r => r.calls && !dismissedHandoffCallIds.has(r.calls.id));
  if (row) showHandoffBanner(row.calls); else hideHandoffBanner();
}

function showHandoffBanner(call) {
  pendingHandoffCall = call;
  $("handoffCallBar").classList.remove("hidden");
}

function hideHandoffBanner() {
  pendingHandoffCall = null;
  $("handoffCallBar").classList.add("hidden");
}

$("btnRejoinCall").addEventListener("click", () => {
  if (!pendingHandoffCall) return;
  const call = pendingHandoffCall;
  hideHandoffBanner();
  joinVoiceCall(call.id, call.room_id);
});

$("btnDismissHandoff").addEventListener("click", () => {
  if (pendingHandoffCall) dismissedHandoffCallIds.add(pendingHandoffCall.id);
  hideHandoffBanner();
});

function showIncomingCall(call) {
  pendingIncomingCall = call;
  const room = findAnyRoomCached(call.room_id);
  $("incomingCallText").textContent = `Incoming voice call — ${room?.title || "Unknown"}`;
  $("incomingCallBar").classList.remove("hidden");
}

function hideIncomingCall() {
  pendingIncomingCall = null;
  $("incomingCallBar").classList.add("hidden");
}

$("btnAcceptCall").addEventListener("click", async () => {
  if (!pendingIncomingCall) return;
  const call = pendingIncomingCall;
  hideIncomingCall();
  await supabaseClient.from("call_participants").insert({ call_id: call.id, user_id: currentUser.id });
  joinVoiceCall(call.id, call.room_id);
});

$("btnDeclineCall").addEventListener("click", () => {
  hideIncomingCall();
});

async function loadCallHistory() {
  const { data, error } = await supabaseClient
    .from("calls")
    .select("*, meetings:room_id(title)")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) { console.error(error); return; }
  renderCallHistory(data || []);
}

function renderCallHistory(calls) {
  const el = $("callHistoryList");
  if (!el) return;
  if (!calls.length) { el.innerHTML = `<div class="emptyState">No calls yet.</div>`; return; }
  el.innerHTML = calls.map(c => {
    let durLabel;
    if (c.status === "ended" && c.ended_at) {
      const durSec = Math.max(0, Math.round((new Date(c.ended_at) - new Date(c.started_at)) / 1000));
      durLabel = `${Math.floor(durSec / 60)}m ${durSec % 60}s`;
    } else {
      durLabel = c.status === "active" ? "in progress" : "missed";
    }
    return `<div class="listItem">
      <div>
        <div class="itemTitle">${escapeHtml(c.meetings?.title || "Voice call")}</div>
        <div class="itemMeta">${fmtDate(c.started_at)} • ${durLabel}</div>
      </div>
    </div>`;
  }).join("");
}

// ---------------------------------------------------------------------------
// Recordings (manual upload — auto-recording isn't built in yet)
// ---------------------------------------------------------------------------
async function renderRecordingsList() {
  const list = $("recordingsList");
  if (!list) return;
  list.innerHTML = `<div class="emptyState">Loading recordings…</div>`;
  const { data, error } = await supabaseClient
    .from("recordings")
    .select("*, meetings(title)")
    .order("created_at", { ascending: false });
  if (error) { list.innerHTML = `<div class="emptyState">Could not load recordings: ${escapeHtml(error.message)}</div>`; return; }
  if (!data || !data.length) {
    list.innerHTML = `<div class="emptyState">No recordings yet. Upload a video file above after your meeting ends.</div>`;
    return;
  }
  const fmtDur = (secs) => {
    if (!secs) return "";
    const m = Math.floor(secs / 60), s = Math.round(secs % 60);
    return ` • ${m}:${String(s).padStart(2, "0")}`;
  };
  list.innerHTML = data.map(r => `
    <div class="listItem" data-recid="${r.id}">
      <div style="min-width:0">
        <div class="itemTitle">🎥 ${escapeHtml(r.label || r.meetings?.title || "Untitled meeting")}</div>
        <div class="itemMeta">${fmtDate(r.created_at)} • ${formatFileSize(r.file_size || 0)}${fmtDur(r.duration_seconds)}</div>
      </div>
      <div style="display:flex;gap:6px;flex:0 0 auto">
        <button class="btn btnGhost btnSm" data-play="${r.id}">▶ Play</button>
        <button class="btn btnGhost btnSm" data-share="${r.id}" title="Share link">🔗</button>
        ${r.uploader_id === currentUser.id ? `<button class="btn btnGhost btnSm" data-rename="${r.id}" title="Rename">✏️</button>` : ""}
        ${r.uploader_id === currentUser.id ? `<button class="btn btnDanger btnSm" data-delrec="${r.id}">🗑</button>` : ""}
      </div>
    </div>`).join("");
  list.querySelectorAll("[data-play]").forEach(b => b.addEventListener("click", () => playRecording(b.dataset.play, data)));
  list.querySelectorAll("[data-delrec]").forEach(b => b.addEventListener("click", () => deleteRecording(b.dataset.delrec, data)));
  list.querySelectorAll("[data-share]").forEach(b => b.addEventListener("click", () => shareRecording(b.dataset.share, data)));
  list.querySelectorAll("[data-rename]").forEach(b => b.addEventListener("click", () => renameRecording(b.dataset.rename, data)));
}

async function shareRecording(id, data) {
  const rec = data.find(r => r.id === id);
  if (!rec) return;
  const { data: signed, error } = await supabaseClient.storage.from("meeting-recordings").createSignedUrl(rec.file_path, 7 * 24 * 3600);
  if (error) { showToast("Could not create share link: " + error.message); return; }
  navigator.clipboard?.writeText(signed.signedUrl).then(() => showToast("Share link copied (valid for 7 days)."));
}

function renameRecording(id, data) {
  const rec = data.find(r => r.id === id);
  if (!rec) return;
  openModal(`
    <div class="modalTitle">Rename recording</div>
    <div class="field"><label>Name</label><input type="text" id="recRenameInput" value="${escapeHtml(rec.label || rec.meetings?.title || "")}" /></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btnGhost" id="modalCancel">Cancel</button>
      <button class="btn btnPrimary" id="btnDoRenameRec">Save</button>
    </div>`);
  $("modalCancel").addEventListener("click", closeModal);
  $("btnDoRenameRec").addEventListener("click", async () => {
    const label = $("recRenameInput").value.trim();
    if (!label) { showToast("Please enter a name."); return; }
    const { error } = await supabaseClient.from("recordings").update({ label }).eq("id", id);
    if (error) { showToast("Could not rename: " + error.message); return; }
    closeModal();
    showToast("Recording renamed.");
    renderRecordingsList();
  });
}

async function playRecording(id, data) {
  const rec = data.find(r => r.id === id);
  if (!rec) return;
  const { data: signed, error } = await supabaseClient.storage.from("meeting-recordings").createSignedUrl(rec.file_path, 3600);
  if (error) { showToast("Could not open recording: " + error.message); return; }
  openModal(`
    <div class="modalTitle">${escapeHtml(rec.meetings?.title || "Recording")}</div>
    <video src="${signed.signedUrl}" controls autoplay style="width:100%;border-radius:12px;background:#000;display:block"></video>
    <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn btnGhost" id="modalCancel">Close</button></div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
}

async function deleteRecording(id, data) {
  const rec = data.find(r => r.id === id);
  if (!rec) return;
  if (!confirm("Delete this recording? This cannot be undone.")) return;
  await supabaseClient.storage.from("meeting-recordings").remove([rec.file_path]);
  const { error } = await supabaseClient.from("recordings").delete().eq("id", id);
  if (error) { showToast("Could not delete: " + error.message); return; }
  showToast("Recording deleted.");
  renderRecordingsList();
}

$("btnUploadRecording")?.addEventListener("click", () => {
  const options = meetingsCache.map(m => `<option value="${m.id}">${escapeHtml(m.title || "Untitled meeting")} — ${fmtDate(m.scheduled_at)}</option>`).join("");
  openModal(`
    <div class="modalTitle">Upload a recording</div>
    <div class="itemMeta" style="margin-bottom:12px">Recorded the meeting yourself (screen recorder, OBS, phone)? Upload the video file here to save it for everyone in that meeting.</div>
    <div class="field"><label>Meeting</label><select id="recMeetingSelect">${options || "<option value=''>No meetings yet</option>"}</select></div>
    <div class="field"><label>Video file</label><input type="file" id="recFileInput" accept="video/*" /></div>
    <button class="btn btnPrimary btnBlock" id="btnDoUploadRecording">Upload</button>
    <div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="btn btnGhost" id="modalCancel">Cancel</button></div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  $("btnDoUploadRecording").addEventListener("click", async () => {
    const roomId = $("recMeetingSelect").value;
    const file = $("recFileInput").files[0];
    if (!roomId) { showToast("Pick a meeting first."); return; }
    if (!file) { showToast("Choose a video file first."); return; }
    if (file.size > 500 * 1024 * 1024) { showToast("File is too large (max 500MB)."); return; }
    const btn = $("btnDoUploadRecording");
    btn.disabled = true; btn.textContent = "Uploading…";
    try {
      const ext = file.name.split(".").pop();
      const path = `${roomId}/${Date.now()}_${currentUser.id}.${ext}`;
      const { error: upErr } = await supabaseClient.storage.from("meeting-recordings").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabaseClient.from("recordings").insert({
        room_id: roomId, uploader_id: currentUser.id, file_path: path,
        file_name: file.name, file_size: file.size, mime_type: file.type,
      });
      if (insErr) throw insErr;
      closeModal();
      showToast("Recording uploaded.");
      renderRecordingsList();
    } catch (err) {
      showToast("Upload failed: " + err.message);
      btn.disabled = false; btn.textContent = "Upload";
    }
  });
});

// ---------------------------------------------------------------------------
// Modal helper
// ---------------------------------------------------------------------------
function openModal(html) {
  $("modalCard").innerHTML = html;
  $("modalOverlay").classList.remove("hidden");
}
function closeModal() { $("modalOverlay").classList.add("hidden"); }
$("modalOverlay").addEventListener("click", (e) => { if (e.target.id === "modalOverlay") closeModal(); });

// Phase E accessibility: Escape key closes any open modal or overlay
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("modalOverlay").classList.contains("hidden")) { closeModal(); return; }
  if ($("profileViewOverlay") && !$("profileViewOverlay").classList.contains("hidden")) {
    $("profileViewOverlay").classList.add("hidden"); return;
  }
  if ($("settingsOverlay") && !$("settingsOverlay").classList.contains("hidden")) {
    $("settingsOverlay").classList.add("hidden"); return;
  }
  if (!$("topMenuOverlay").classList.contains("hidden")) { closeTopMenu(); return; }
});

// ---------------------------------------------------------------------------
// Whiteboard (per-meeting, real-time shared: freehand strokes + sticky notes)
// ---------------------------------------------------------------------------
let wbRoomId = null;
let wbChannel = null;
let wbElements = new Map(); // id -> element row
let wbColor = "#0f2419";
let wbDrawing = false;
let wbCurrentPoints = [];
let wbStickyDrag = null; // { id, offsetX, offsetY }
const wbCanvas = $("wbCanvas");
const wbCtx = wbCanvas.getContext("2d");
const wbWrap = $("wbCanvasWrap");

function renderWhiteboardPicker() {
  const boardable = meetingsCache.filter(m => m.status !== "chat");
  const list = $("wbMeetingPickerList");
  if (!boardable.length) {
    list.innerHTML = `<div class="emptyState">No meetings yet — schedule one first.</div>`;
    return;
  }
  list.innerHTML = boardable.map(m => `
    <div class="listItem" data-id="${m.id}">
      <div>
        <div class="itemTitle">${escapeHtml(m.title || "Untitled meeting")}</div>
        <div class="itemMeta">${fmtDate(m.scheduled_at)}</div>
      </div>
      <button class="btn btnPrimary btnSm" data-wbopen="${m.id}">Open board</button>
    </div>`).join("");
  list.querySelectorAll("[data-wbopen]").forEach(b => {
    b.addEventListener("click", () => openWhiteboard(b.dataset.wbopen));
  });
}

async function openWhiteboard(meetingId) {
  const meeting = meetingsCache.find(m => m.id === meetingId);
  wbRoomId = meetingId;
  $("wbMeetingLabel").textContent = "Whiteboard — " + (meeting ? meeting.title : "Meeting");
  $("wbPickerCard").classList.add("hidden");
  $("wbBoardCard").classList.remove("hidden");
  resizeWbCanvas();
  await loadWhiteboardElements();
  subscribeWhiteboard();
}

function backToWhiteboardPicker() {
  if (wbChannel) { supabaseClient.removeChannel(wbChannel); wbChannel = null; }
  wbRoomId = null;
  wbElements.clear();
  document.querySelectorAll(".stickyNote").forEach(n => n.remove());
  $("wbBoardCard").classList.add("hidden");
  $("wbPickerCard").classList.remove("hidden");
  renderWhiteboardPicker();
}
$("wbBack").addEventListener("click", backToWhiteboardPicker);

function resizeWbCanvas() {
  const rect = wbWrap.getBoundingClientRect();
  wbCanvas.width = rect.width * devicePixelRatio;
  wbCanvas.height = rect.height * devicePixelRatio;
  wbCtx.scale(devicePixelRatio, devicePixelRatio);
  wbCtx.lineCap = "round";
  wbCtx.lineJoin = "round";
  redrawWbCanvas();
}
window.addEventListener("resize", () => { if (wbRoomId) resizeWbCanvas(); });

async function loadWhiteboardElements() {
  const { data, error } = await supabaseClient.from("whiteboard_elements").select("*").eq("room_id", wbRoomId).order("created_at", { ascending: true });
  if (error) { showToast("Could not load whiteboard: " + error.message); return; }
  wbElements.clear();
  (data || []).forEach(el => wbElements.set(el.id, el));
  redrawWbCanvas();
  renderStickies();
}

function subscribeWhiteboard() {
  if (wbChannel) { supabaseClient.removeChannel(wbChannel); wbChannel = null; }
  wbChannel = supabaseClient
    .channel(`wb-${wbRoomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "whiteboard_elements", filter: `room_id=eq.${wbRoomId}` }, (payload) => {
      if (payload.eventType === "DELETE") {
        wbElements.delete(payload.old.id);
      } else {
        wbElements.set(payload.new.id, payload.new);
      }
      redrawWbCanvas();
      renderStickies();
    })
    .subscribe();
}

function redrawWbCanvas() {
  const w = wbWrap.clientWidth, h = wbWrap.clientHeight;
  wbCtx.clearRect(0, 0, wbCanvas.width, wbCanvas.height);
  for (const el of wbElements.values()) {
    if (el.type !== "stroke") continue;
    const pts = el.data.points || [];
    if (pts.length < 2) continue;
    wbCtx.strokeStyle = el.data.color || "#0f2419";
    wbCtx.lineWidth = el.data.width || 3;
    wbCtx.beginPath();
    wbCtx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) wbCtx.lineTo(pts[i].x * w, pts[i].y * h);
    wbCtx.stroke();
  }
}

function renderStickies() {
  const w = wbWrap.clientWidth, h = wbWrap.clientHeight;
  const seen = new Set();
  for (const el of wbElements.values()) {
    if (el.type !== "sticky") continue;
    seen.add(el.id);
    let node = wbWrap.querySelector(`.stickyNote[data-id="${el.id}"]`);
    if (!node) node = createStickyNode(el.id);
    if (wbStickyDrag && wbStickyDrag.id === el.id) continue; // don't fight the user's own live drag
    node.style.left = (el.data.x * w) + "px";
    node.style.top = (el.data.y * h) + "px";
    node.style.width = Math.max(120, el.data.w * w) + "px";
    node.style.height = Math.max(90, el.data.h * h) + "px";
    node.style.background = el.data.color || "#fff7cc";
    const ta = node.querySelector("textarea");
    if (document.activeElement !== ta) ta.value = el.data.text || "";
  }
  wbWrap.querySelectorAll(".stickyNote").forEach(node => {
    if (!seen.has(node.dataset.id)) node.remove();
  });
}

function createStickyNode(id) {
  const node = document.createElement("div");
  node.className = "stickyNote";
  node.dataset.id = id;
  node.innerHTML = `
    <div class="stickyHandle">
      <span>note</span>
      <span class="stickyDelete" title="Delete note">&times;</span>
    </div>
    <textarea placeholder="Type here…"></textarea>`;
  wbWrap.appendChild(node);

  const handle = node.querySelector(".stickyHandle");
  const ta = node.querySelector("textarea");
  const delBtn = node.querySelector(".stickyDelete");

  handle.addEventListener("pointerdown", (e) => {
    const rect = node.getBoundingClientRect();
    wbStickyDrag = { id, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    e.preventDefault();
  });
  window.addEventListener("pointermove", (e) => {
    if (!wbStickyDrag || wbStickyDrag.id !== id) return;
    const wrapRect = wbWrap.getBoundingClientRect();
    const x = e.clientX - wrapRect.left - wbStickyDrag.offsetX;
    const y = e.clientY - wrapRect.top - wbStickyDrag.offsetY;
    node.style.left = x + "px";
    node.style.top = y + "px";
  });
  window.addEventListener("pointerup", async () => {
    if (!wbStickyDrag || wbStickyDrag.id !== id) return;
    wbStickyDrag = null;
    const w = wbWrap.clientWidth, h = wbWrap.clientHeight;
    const el = wbElements.get(id);
    if (!el) return;
    const newData = { ...el.data, x: node.offsetLeft / w, y: node.offsetTop / h };
    el.data = newData;
    await supabaseClient.from("whiteboard_elements").update({ data: newData, updated_at: new Date().toISOString() }).eq("id", id);
  });

  let taTimer = null;
  ta.addEventListener("input", () => {
    clearTimeout(taTimer);
    taTimer = setTimeout(async () => {
      const el = wbElements.get(id);
      if (!el) return;
      const newData = { ...el.data, text: ta.value };
      el.data = newData;
      await supabaseClient.from("whiteboard_elements").update({ data: newData, updated_at: new Date().toISOString() }).eq("id", id);
    }, 500);
  });

  let resizeTimer = null;
  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(async () => {
      const w = wbWrap.clientWidth, h = wbWrap.clientHeight;
      const el = wbElements.get(id);
      if (!el) return;
      const newData = { ...el.data, w: node.clientWidth / w, h: node.clientHeight / h };
      el.data = newData;
      await supabaseClient.from("whiteboard_elements").update({ data: newData, updated_at: new Date().toISOString() }).eq("id", id);
    }, 500);
  }).observe(node);

  delBtn.addEventListener("click", async () => {
    node.remove();
    wbElements.delete(id);
    await supabaseClient.from("whiteboard_elements").delete().eq("id", id);
  });

  return node;
}

$("wbAddSticky").addEventListener("click", async () => {
  if (!wbRoomId) return;
  const data = { x: 0.35, y: 0.3, w: 0.18, h: 0.14, text: "", color: "#fff7cc" };
  const { data: inserted, error } = await supabaseClient.from("whiteboard_elements").insert({
    room_id: wbRoomId, type: "sticky", data, created_by: currentUser.id,
  }).select().single();
  if (error) { showToast("Could not add sticky note: " + error.message); return; }
  wbElements.set(inserted.id, inserted);
  renderStickies();
});

$("wbClear").addEventListener("click", async () => {
  if (!wbRoomId) return;
  if (!confirm("Clear the whole board for everyone in this meeting?")) return;
  const { error } = await supabaseClient.from("whiteboard_elements").delete().eq("room_id", wbRoomId);
  if (error) { showToast("Could not clear board: " + error.message); return; }
  wbElements.clear();
  document.querySelectorAll(".stickyNote").forEach(n => n.remove());
  redrawWbCanvas();
});

document.querySelectorAll(".wbColorBtn").forEach(btn => {
  btn.addEventListener("click", () => {
    wbColor = btn.dataset.color;
    document.querySelectorAll(".wbColorBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

function wbPos(e) {
  const rect = wbWrap.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return { x: (t.clientX - rect.left), y: (t.clientY - rect.top) };
}
function wbStart(e) {
  if (!wbRoomId || e.target !== wbCanvas) return;
  wbDrawing = true;
  const p = wbPos(e);
  wbCurrentPoints = [p];
  wbCtx.beginPath();
  wbCtx.strokeStyle = wbColor;
  wbCtx.lineWidth = 3;
  wbCtx.moveTo(p.x, p.y);
}
function wbMove(e) {
  if (!wbDrawing) return;
  const p = wbPos(e);
  wbCurrentPoints.push(p);
  wbCtx.lineTo(p.x, p.y);
  wbCtx.stroke();
  e.preventDefault();
}
async function wbEnd() {
  if (!wbDrawing) return;
  wbDrawing = false;
  if (wbCurrentPoints.length < 2) { wbCurrentPoints = []; return; }
  const w = wbWrap.clientWidth, h = wbWrap.clientHeight;
  const normPoints = wbCurrentPoints.map(p => ({ x: p.x / w, y: p.y / h }));
  wbCurrentPoints = [];
  const data = { points: normPoints, color: wbColor, width: 3 };
  const { data: inserted, error } = await supabaseClient.from("whiteboard_elements").insert({
    room_id: wbRoomId, type: "stroke", data, created_by: currentUser.id,
  }).select().single();
  if (error) { showToast("Could not save drawing: " + error.message); return; }
  wbElements.set(inserted.id, inserted);
}
wbCanvas.addEventListener("mousedown", wbStart);
window.addEventListener("mousemove", wbMove);
window.addEventListener("mouseup", wbEnd);
wbCanvas.addEventListener("touchstart", wbStart);
wbCanvas.addEventListener("touchmove", wbMove);
wbCanvas.addEventListener("touchend", wbEnd);


/* ============================================================
   MORE: Feed / Marketplace / Forum
   Requires 3 Supabase tables — see supabase_more_tables.sql
   ============================================================ */

document.getElementById("moreSubTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".subTabBtn");
  if (!btn) return;
  document.querySelectorAll("#moreSubTabs .subTabBtn").forEach(b => b.classList.toggle("active", b === btn));
  document.querySelectorAll("#viewMore .subView").forEach(v => v.classList.remove("active"));
  $("more" + btn.dataset.sub.charAt(0).toUpperCase() + btn.dataset.sub.slice(1)).classList.add("active");
  if (btn.dataset.sub === "feed") loadFeed();
  else if (btn.dataset.sub === "marketplace") loadMarketplace();
  else if (btn.dataset.sub === "forum") loadForum();
  else if (btn.dataset.sub === "communities") loadCommunities();
});

/* ============================================================
   PHASE 8B — Communities (create / join / manage)
   Requires: communities, community_members tables — see
   phase_7e_8a_8b_migration.sql
   ============================================================ */
let communitiesLoaded = false;
let myCommunityIds = new Set();

async function loadCommunities() {
  const myGrid = $("myCommGrid");
  const discoverGrid = $("discoverCommGrid");
  if (!myGrid || !discoverGrid) return;

  const [{ data: myMemberships }, { data: allCommunities, error }] = await Promise.all([
    supabaseClient.from("community_members").select("community_id, role").eq("user_id", currentUser.id),
    supabaseClient.from("communities").select("*").order("member_count", { ascending: false }).limit(60),
  ]);
  if (error) { discoverGrid.innerHTML = `<div class="emptyState">Could not load groups: ${escapeHtml(error.message)}</div>`; return; }

  const myRoleByCommunity = {};
  (myMemberships || []).forEach(m => { myRoleByCommunity[m.community_id] = m.role; });
  myCommunityIds = new Set(Object.keys(myRoleByCommunity));

  const all = allCommunities || [];
  const mine = all.filter(c => myCommunityIds.has(c.id));
  const discover = all.filter(c => !myCommunityIds.has(c.id));

  myGrid.innerHTML = mine.length ? mine.map(c => communityCardHtml(c, myRoleByCommunity[c.id])).join("")
    : `<div class="emptyState">You haven't joined any groups yet.</div>`;
  discoverGrid.innerHTML = discover.length ? discover.map(c => communityCardHtml(c, null)).join("")
    : `<div class="emptyState">No other groups yet — be the first to create one!</div>`;

  document.querySelectorAll("[data-comm-open]").forEach(el => {
    el.addEventListener("click", () => openCommunityDetail(el.dataset.commOpen));
  });
  document.querySelectorAll("[data-comm-join]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      btn.disabled = true; btn.textContent = "…";
      const { error } = await supabaseClient.from("community_members").insert({ community_id: btn.dataset.commJoin, user_id: currentUser.id, role: "member" });
      if (error) { showToast("Could not join: " + error.message); btn.disabled = false; btn.textContent = "+ Join"; return; }
      showToast("Joined!");
      communitiesLoaded = false;
      loadCommunities();
    });
  });
}

function communityCardHtml(c, myRole) {
  return `
    <div class="commCard" data-comm-open="${c.id}">
      <div class="commIcon">${escapeHtml(c.icon || "🏘️")}</div>
      <div class="commName">${escapeHtml(c.name)}</div>
      <div class="commMeta">${c.member_count || 0} member${c.member_count === 1 ? "" : "s"}${c.is_public ? "" : " • 🔒 Private"}</div>
      ${myRole
        ? `<div class="commMeta" style="margin-top:6px">${myRole === "owner" ? "👑 Owner" : myRole === "admin" ? "🛡️ Admin" : myRole === "moderator" ? "🔧 Moderator" : "✓ Member"}</div>`
        : `<button class="btn btnPrimary btnSm commJoinBtn" data-comm-join="${c.id}">+ Join</button>`}
    </div>`;
}

$("btnCreateCommunity").addEventListener("click", () => {
  // VIP-only group creation. This client-side check is just for a friendly
  // message — the real gate is the RLS insert policy in
  // phase_10_moderators_vip_gate_migration.sql, since a client check alone
  // can always be bypassed by calling the API directly.
  if (!getVipTier(currentProfile)) {
    openModal(`
      <div class="modalTitle">👑 VIP Membership Required</div>
      <div class="itemMeta" style="margin-bottom:14px">Creating a Group is a VIP feature — it keeps groups run by members who are invested in the community. Upgrade to VIP to create your own group, set it public or private, and manage moderators.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btnGhost" id="vipGateCancel">Not now</button>
        <button class="btn btnPrimary" id="vipGateUpgrade">👑 See VIP plans</button>
      </div>
    `);
    $("vipGateCancel").addEventListener("click", closeModal);
    $("vipGateUpgrade").addEventListener("click", () => { closeModal(); setActiveView("vip"); });
    return;
  }
  openModal(`
    <div class="modalTitle">🏘️ Create a Group</div>
    <div class="field"><label>Icon (emoji)</label><input type="text" id="commIconInput" maxlength="4" placeholder="🏘️" style="max-width:80px" /></div>
    <div class="field"><label>Name</label><input type="text" id="commNameInput" placeholder="e.g. Video Editors PH" /></div>
    <div class="field"><label>Description</label><textarea id="commDescInput" rows="3" placeholder="What's this group about?"></textarea></div>
    <div class="field" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="commPublicInput" checked style="width:20px;height:20px;accent-color:var(--navy)" />
      <label for="commPublicInput" style="margin:0;font-weight:600">Public (anyone can find and join)</label>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btnGhost" id="commCreateCancel">Cancel</button>
      <button class="btn btnPrimary" id="commCreateSubmit">Create</button>
    </div>
  `);
  $("commCreateCancel").addEventListener("click", closeModal);
  $("commCreateSubmit").addEventListener("click", async () => {
    if (!throttleAction("commCreateSubmit", 4000)) return;
    const name = $("commNameInput").value.trim();
    const description = $("commDescInput").value.trim();
    const icon = $("commIconInput").value.trim() || "🏘️";
    const isPublic = $("commPublicInput").checked;
    if (!name) { showToast("Please name your group."); markFieldErrors(["commNameInput"]); return; }
    clearFieldErrors(["commNameInput"]);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);
    const btn = $("commCreateSubmit");
    btn.disabled = true; btn.textContent = "Creating…";
    const { error } = await supabaseClient.from("communities").insert({
      name, description, icon, slug, is_public: isPublic, creator_id: currentUser.id,
    });
    if (error) { showToast("Could not create group: " + error.message); btn.disabled = false; btn.textContent = "Create"; return; }
    showToast("Group created! 🎉");
    closeModal();
    loadCommunities();
  });
});

// Pending #8 (MVP): shared "post to a group" picker used by listing/post/video
// creation modals. Returns <option> markup; caller wraps it in a <select>.
let myGroupsForPosting = null;
async function loadMyGroupsForPosting() {
  if (myGroupsForPosting) return myGroupsForPosting;
  const { data } = await supabaseClient.from("community_members")
    .select("community_id, communities:community_id(id, name, icon)")
    .eq("user_id", currentUser.id);
  myGroupsForPosting = (data || []).map(r => r.communities).filter(Boolean);
  return myGroupsForPosting;
}
function communityPickerFieldHtml(selectId) {
  return `<div class="field"><label>Post to a Group (optional)</label>
    <select id="${selectId}"><option value="">🌐 Site-wide (everyone)</option></select>
  </div>`;
}
async function fillCommunityPickerOptions(selectId) {
  const groups = await loadMyGroupsForPosting();
  const sel = $(selectId);
  if (!sel || !groups.length) return;
  sel.innerHTML += groups.map(g => `<option value="${g.id}">${escapeHtml(g.icon || "🏘️")} ${escapeHtml(g.name)}</option>`).join("");
}

async function openCommunityDetail(communityId) {
  openModal(`<div class="emptyState">Loading…</div>`);
  const [{ data: c, error }, { data: members }, { data: myRow }] = await Promise.all([
    supabaseClient.from("communities").select("*").eq("id", communityId).single(),
    supabaseClient.from("community_members").select("user_id, role, joined_at, profiles:user_id(full_name, avatar_url)").eq("community_id", communityId).order("joined_at", { ascending: true }),
    supabaseClient.from("community_members").select("role").eq("community_id", communityId).eq("user_id", currentUser.id).maybeSingle(),
  ]);
  if (error || !c) { $("modalCard").innerHTML = `<div class="emptyState">Could not load this group.</div>`; return; }

  const myRole = myRow?.role || null;
  // Moderators can moderate (remove regular members, moderate the group feed)
  // but cannot assign roles or delete the group — that stays owner/admin only.
  const isManager = myRole === "owner" || myRole === "admin" || myRole === "moderator";
  const canAssignRoles = myRole === "owner" || myRole === "admin";
  const memberRows = members || [];

  function roleBadgeHtml(role) {
    if (role === "owner") return `<span class="commRoleBadge commRoleBadge--owner">👑 Owner</span>`;
    if (role === "admin") return `<span class="commRoleBadge">🛡️ Admin</span>`;
    if (role === "moderator") return `<span class="commRoleBadge commRoleBadge--mod">🔧 Moderator</span>`;
    return `<span class="commRoleBadge">Member</span>`;
  }

  $("modalCard").innerHTML = `
    <div class="modalTitle">${escapeHtml(c.icon || "🏘️")} ${escapeHtml(c.name)}</div>
    <div class="itemMeta" style="margin-bottom:10px">${memberRows.length} member${memberRows.length === 1 ? "" : "s"}${c.is_public ? " • Public" : " • 🔒 Private"}</div>
    <div style="white-space:pre-wrap;font-size:13.5px;margin-bottom:14px">${escapeHtml(c.description || "No description yet.")}</div>
    <div style="display:flex;gap:8px;margin-bottom:14px" id="commActionRow">
      ${myRole
        ? (myRole === "owner"
            ? `<button class="btn btnDanger btnSm" id="commDeleteBtn">🗑 Delete group</button>`
            : `<button class="btn btnGhost btnSm" id="commLeaveBtn">Leave group</button>`)
        : `<button class="btn btnPrimary btnSm" id="commJoinDetailBtn">+ Join group</button>`}
    </div>
    <div class="cardTitle" style="font-size:13px;margin-bottom:6px">Members</div>
    <div id="commMembersList" style="max-height:280px;overflow-y:auto;margin-bottom:16px">
      ${memberRows.map(m => {
        const p = m.profiles || {};
        const initial = escapeHtml((p.full_name || "?").charAt(0).toUpperCase());
        const canRemove = isManager && m.user_id !== currentUser.id && m.role !== "owner" && (canAssignRoles || m.role === "member");
        const canPromote = canAssignRoles && m.user_id !== currentUser.id && m.role === "member";
        const canDemote = canAssignRoles && m.user_id !== currentUser.id && m.role === "moderator";
        return `
        <div class="commMemberRow">
          <div class="partAvatar" style="width:32px;height:32px;font-size:12px">${p.avatar_url ? `<img loading="lazy" src="${escapeHtml(p.avatar_url)}" alt="">` : initial}</div>
          <div style="flex:1;min-width:0;font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.full_name || "Member")}</div>
          ${roleBadgeHtml(m.role)}
          ${canPromote ? `<button class="partRemoveBtn" style="background:rgba(37,99,235,.1);color:#1e40af" data-comm-promote="${m.user_id}">+ Mod</button>` : ""}
          ${canDemote ? `<button class="partRemoveBtn" style="background:rgba(37,99,235,.1);color:#1e40af" data-comm-demote="${m.user_id}">− Mod</button>` : ""}
          ${canRemove ? `<button class="partRemoveBtn" style="background:rgba(239,68,68,.1);color:#b91c1c" data-comm-remove-member="${m.user_id}">Remove</button>` : ""}
        </div>`;
      }).join("")}
    </div>
    <div class="cardTitle" style="font-size:13px;margin-bottom:6px">🏘️ Group Feed <span class="itemMeta">(posts, listings &amp; videos posted to this group)</span></div>
    <div id="commFeedList" style="max-height:320px;overflow-y:auto"><div class="emptyState">Loading…</div></div>
  `;
  loadCommunityFeed(communityId);

  $("commJoinDetailBtn")?.addEventListener("click", async () => {
    const { error } = await supabaseClient.from("community_members").insert({ community_id: communityId, user_id: currentUser.id, role: "member" });
    if (error) { showToast("Could not join: " + error.message); return; }
    showToast("Joined!");
    closeModal();
    loadCommunities();
  });
  $("commLeaveBtn")?.addEventListener("click", async () => {
    if (!confirm("Leave this group?")) return;
    await supabaseClient.from("community_members").delete().eq("community_id", communityId).eq("user_id", currentUser.id);
    showToast("Left the group.");
    closeModal();
    loadCommunities();
  });
  $("commDeleteBtn")?.addEventListener("click", async () => {
    if (!confirm("Delete this group permanently? This can't be undone.")) return;
    await supabaseClient.from("communities").delete().eq("id", communityId);
    showToast("Group deleted.");
    closeModal();
    loadCommunities();
  });
  $("modalCard").querySelectorAll("[data-comm-remove-member]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Remove this member from the group?")) return;
      await supabaseClient.from("community_members").delete().eq("community_id", communityId).eq("user_id", btn.dataset.commRemoveMember);
      showToast("Member removed.");
      openCommunityDetail(communityId); // refresh
    });
  });
  $("modalCard").querySelectorAll("[data-comm-promote]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { error } = await supabaseClient.from("community_members").update({ role: "moderator" })
        .eq("community_id", communityId).eq("user_id", btn.dataset.commPromote);
      if (error) { showToast("Could not assign moderator: " + error.message); return; }
      showToast("🔧 Moderator assigned.");
      openCommunityDetail(communityId); // refresh
    });
  });
  $("modalCard").querySelectorAll("[data-comm-demote]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { error } = await supabaseClient.from("community_members").update({ role: "member" })
        .eq("community_id", communityId).eq("user_id", btn.dataset.commDemote);
      if (error) { showToast("Could not remove moderator role: " + error.message); return; }
      showToast("Moderator role removed.");
      openCommunityDetail(communityId); // refresh
    });
  });
}

// Pending #8 (MVP): pull this group's own posts/listings/videos, filtered by
// community_id. Site-wide content (community_id IS NULL) never shows here.
async function loadCommunityFeed(communityId) {
  const el = $("commFeedList");
  if (!el) return;
  const [{ data: posts }, { data: listings }, { data: vids }, { data: myMembership }] = await Promise.all([
    supabaseClient.from("forum_posts").select("id, title, author_name, author_id, created_at").eq("community_id", communityId).order("created_at", { ascending: false }).limit(20),
    supabaseClient.from("marketplace_listings").select("id, title, price, poster_name, posted_by, created_at").eq("community_id", communityId).order("created_at", { ascending: false }).limit(20),
    supabaseClient.from("videos").select("id, title, uploaded_by, created_at").eq("community_id", communityId).eq("flagged", false).order("created_at", { ascending: false }).limit(20),
    supabaseClient.from("community_members").select("role").eq("community_id", communityId).eq("user_id", currentUser.id).maybeSingle(),
  ]);
  const myRole = myMembership?.role || null;
  const canModerate = myRole === "owner" || myRole === "admin" || myRole === "moderator";

  const items = [
    ...(posts || []).map(p => ({ kind: "post", icon: "📝", label: p.title || "Untitled post", by: p.author_name, ownerId: p.author_id, id: p.id, created_at: p.created_at })),
    ...(listings || []).map(l => ({ kind: "listing", icon: "🛍️", label: l.title, by: l.poster_name, ownerId: l.posted_by, id: l.id, created_at: l.created_at, listing: l })),
    ...(vids || []).map(v => ({ kind: "video", icon: "🎥", label: v.title, by: null, ownerId: v.uploaded_by, id: v.id, created_at: v.created_at })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!items.length) { el.innerHTML = `<div class="emptyState">Nothing posted to this group yet. Use "Post to a Group" when creating a post, listing, or video.</div>`; return; }

  el.innerHTML = items.map(it => {
    const showModDelete = canModerate && it.ownerId && it.ownerId !== currentUser.id;
    return `
    <div class="listItem" data-feed-kind="${it.kind}" data-feed-id="${it.id}" style="cursor:pointer">
      <div style="flex:1;min-width:0">
        <div class="itemTitle" style="font-size:13px">${it.icon} ${escapeHtml(it.label || "")}</div>
        <div class="itemMeta">${it.by ? escapeHtml(it.by) + " • " : ""}${fmtDate(it.created_at)}</div>
      </div>
      ${showModDelete ? `<button class="iconBtn" data-mod-delete-kind="${it.kind}" data-mod-delete-id="${it.id}" title="Remove (moderator)" style="flex-shrink:0">🗑️</button>` : ""}
    </div>`;
  }).join("");

  el.querySelectorAll("[data-feed-kind]").forEach(row => {
    row.addEventListener("click", async (e) => {
      if (e.target.closest("[data-mod-delete-id]")) return; // handled separately
      const kind = row.dataset.feedKind, id = row.dataset.feedId;
      if (kind === "listing") {
        const { data: l } = await supabaseClient.from("marketplace_listings").select("*").eq("id", id).single();
        if (l) { closeModal(); openMarketplaceDetail(l); }
      } else if (kind === "video") {
        const { data: v } = await supabaseClient.from("videos").select("*").eq("id", id).single();
        if (v) { closeModal(); openVideoPlayer(v); }
      } else if (kind === "post") {
        const { data: p } = await supabaseClient.from("forum_posts").select("*").eq("id", id).single();
        if (p) { closeModal(); openThreadReplies(p.id, p); }
      }
    });
  });

  el.querySelectorAll("[data-mod-delete-id]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const kind = btn.dataset.modDeleteKind, id = btn.dataset.modDeleteId;
      const table = kind === "listing" ? "marketplace_listings" : kind === "video" ? "videos" : "forum_posts";
      if (!confirm("Alisin ang content na ito bilang moderator? Hindi na ito mababawi.")) return;
      const { error } = await supabaseClient.from(table).delete().eq("id", id);
      if (error) { showToast("Hindi na-remove: " + error.message); return; }
      showToast("Na-remove ng moderator. 🔧");
      loadCommunityFeed(communityId);
    });
  });
}


const MODERATION_BLOCKLIST = [
  "send money first", "gcash mo muna", "advance payment bago", "investment guaranteed",
  "double your money", "sigurado kikita", "click this link to claim", "claim your prize",
  "free load promo", "verify your account here", "bit.ly", "tinyurl.com",
  "add me sa telegram", "message me sa whatsapp", "text lang sa number",
];
function moderateText(text) {
  const lower = (text || "").toLowerCase();
  const hit = MODERATION_BLOCKLIST.find(k => lower.includes(k));
  return { flagged: !!hit, reason: hit || null };
}

/* ============================================================
   COMMUNITY ROLES
   ============================================================ */
const ADMIN_ROLES = ["founder", "co-founder", "head_admin", "admin"];
function isAdminUser() { return ADMIN_ROLES.includes(currentProfile?.role); }
function isFounderUser() { return currentProfile?.role === "founder"; }

// VIP expiry warning — checked client-side on each login (no cron/edge function
// available in this environment to run it server-side on a schedule; this is a
// reasonable approximation but won't fire if the user doesn't open the app in that window).
async function checkVipExpiryWarning() {
  try {
    if (!currentProfile?.vip_until) return;
    const untilDate = new Date(currentProfile.vip_until);
    const daysLeft = Math.ceil((untilDate.getTime() - Date.now()) / (24 * 3600 * 1000));
    if (daysLeft > 7 || daysLeft < 0) return;

    // Dedupe: only send once per expiry cycle (skip if we already warned since 8 days before expiry)
    const since = new Date(untilDate.getTime() - 8 * 24 * 3600 * 1000).toISOString();
    const { data: existing } = await supabaseClient
      .from("notifications").select("id").eq("user_id", currentUser.id).eq("type", "vip_expiry_warning")
      .gte("created_at", since).limit(1);
    if (existing && existing.length) return;

    await supabaseClient.from("notifications").insert({
      user_id: currentUser.id, actor_id: currentUser.id, type: "vip_expiry_warning",
      title: daysLeft === 0 ? "Your VIP expires today" : `Your VIP expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      body: "Renew to keep your VIP perks — AI Companion, priority support, and more.",
    });
    refreshNotifBadge();
  } catch (err) { console.error("checkVipExpiryWarning failed:", err); }
}

async function notifyAdminsOfNewMember(fullName) {
  try {
    const { data: admins } = await supabaseClient.from("profiles").select("id").in("role", ADMIN_ROLES);
    if (!admins || !admins.length) return;
    await Promise.all(admins.map(a => createNotification({
      user_id: a.id, type: "new_community_member",
      title: `${fullName || "A new member"} joined VORTEXIA`, body: "Tap to view their profile.",
    })));
  } catch (err) { console.error("notifyAdminsOfNewMember failed:", err); }
}

function getRoleBadgeHtml(role) {
  const map = {
    "founder":     `<span class="roleBadge roleBadge--founder">&#128081; Founder</span>`,
    "co-founder":  `<span class="roleBadge roleBadge--cofounder">&#129352; Co-Founder</span>`,
    "head_admin":  `<span class="roleBadge roleBadge--headAdmin">&#128737; Head Admin</span>`,
    "admin":       `<span class="roleBadge roleBadge--admin">&#9881; Admin</span>`,
  };
  return map[role] || "";
}

let communityRolesCache = {};
let communityVipCache = {};

async function loadCommunityRoles() {
  const { data } = await supabaseClient.from("community_roles").select("user_id, role");
  if (data) { data.forEach(r => { communityRolesCache[r.user_id] = r.role; }); }
  const { data: vipData } = await supabaseClient.from("profiles").select("id, plan, vip_status, vip_until, trial_ends_at");
  if (vipData) { vipData.forEach(r => { communityVipCache[r.id] = r; }); }
}

function getUserRoleLabel(userId) {
  return communityRolesCache[userId] || null;
}

// Returns the active plan id ("essential"/"growth"/"business") if the given profile-like
// row currently has VIP access (trialing or active & not expired), otherwise null.
function getVipTier(row) {
  if (!row) return null;
  const now = Date.now();
  const trialActive = row.vip_status === "trialing" && row.trial_ends_at && new Date(row.trial_ends_at).getTime() > now;
  const planActive = row.vip_status === "active" && (!row.vip_until || new Date(row.vip_until).getTime() > now);
  if (!trialActive && !planActive) return null;
  return row.plan || "growth";
}

function vipNameClass(tier) {
  if (tier === "business") return "vipNameBusiness";
  if (tier === "essential") return "vipNameEssential";
  if (tier) return "vipNameGrowth"; // growth or unknown VIP tier defaults to growth color
  return "";
}

// Renders a user's display name, colored by VIP tier if applicable. `row` should have
// vip_status/vip_until/trial_ends_at/plan — either the full profile row (self) or a
// cached lookup via getUserVipRow(userId) for other users.
// VIP avatar frame wrapper — wraps an avatar img or initial-letter span
// in the animated ring (profile card / topbar) or static ring (dense lists).
// Pass animated=true for the large solo avatar, animated=false for lists.
function renderVipAvatarFrame(innerHtml, row, animated = false) {
  if (!getVipTier(row)) return innerHtml;
  const variant = animated ? "vipAvatarFrame--animated" : "vipAvatarFrame--static";
  return `<div class="vipAvatarFrame ${variant}">${innerHtml}</div>`;
}

function renderVipName(name, row) {
  const safe = escapeHtml(name || "Unnamed");
  const cls = vipNameClass(getVipTier(row));
  return cls ? `<span class="${cls}">${safe}</span>` : safe;
}

// Phase 4B — reputation tier badge (🥉 Newcomer / 🥈 Regular / 🥇 Contributor / 💎 Legend)
const REP_TIER_META = {
  newcomer:    { emoji: "🥉", label: "Newcomer",    cls: "repBadge--newcomer" },
  regular:     { emoji: "🥈", label: "Regular",     cls: "repBadge--regular" },
  contributor: { emoji: "🥇", label: "Contributor", cls: "repBadge--contributor" },
  legend:      { emoji: "💎", label: "Legend",      cls: "repBadge--legend" },
};
function renderReputationBadge(tier) {
  const meta = REP_TIER_META[tier] || REP_TIER_META.newcomer;
  return `<span class="repBadge ${meta.cls}">${meta.emoji} ${meta.label}</span>`;
}
function renderSkillChips(skills, editable) {
  if (!skills || !skills.length) return editable ? "" : `<span class="itemMeta">No skills added yet.</span>`;
  return skills.map(s => `
    <span class="skillChip">${escapeHtml(s)}${editable ? `<button type="button" data-remove-skill="${escapeHtml(s)}">✕</button>` : ""}</span>
  `).join("");
}

// Wraps a rendered name so tapping it opens that user's public profile.
// Pass the userId whenever it's known; falls back to plain (non-clickable) name otherwise.
function nameLink(name, row, userId) {
  const inner = renderVipName(name, row);
  if (!userId) return inner;
  return `<span data-open-profile="${escapeHtml(userId)}" style="cursor:pointer">${inner}</span>`;
}
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-open-profile]");
  if (!el) return;
  const uid = el.dataset.openProfile;
  if (uid && currentUser && uid !== currentUser.id) openProfileView(uid);
});

function getUserVipRow(userId) {
  return communityVipCache[userId] || null;
}

async function loadAdminRoleList() {
  const list = $("adminRoleList");
  if (!list) return;
  const { data, error } = await supabaseClient.from("community_roles")
    .select("user_id, role, assigned_by, created_at, profiles:user_id(full_name, email)").order("created_at");
  if (error || !data || !data.length) { list.innerHTML = `<div class="emptyState">No admins assigned yet.</div>`; return; }
  list.innerHTML = data.map(r => `
    <div class="listItem" style="justify-content:space-between">
      <div>
        <div class="itemTitle">${escapeHtml(r.profiles && r.profiles.full_name ? r.profiles.full_name : "Unknown")}</div>
        <div class="itemMeta">${escapeHtml(r.profiles && r.profiles.email ? r.profiles.email : "")} ${getRoleBadgeHtml(r.role)}</div>
      </div>
      ${isFounderUser() ? `<button class="btn btnDanger btnSm" data-remove-role="${r.user_id}">Remove</button>` : ""}
    </div>
  `).join("");
  list.querySelectorAll("[data-remove-role]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const { error } = await supabaseClient.from("community_roles").delete().eq("user_id", btn.dataset.removeRole);
      if (error) { showToast("Error: " + error.message); return; }
      showToast("Role removed.");
      loadAdminRoleList();
      loadCommunityRoles(); // Pending #13: badges elsewhere in the app were stale until next login
    });
  });
}

let roleSearchTarget = null;
if ($("roleSearchInput")) {
  $("roleSearchInput").addEventListener("input", debounce(async (e) => {
    const q = e.target.value.trim();
    const results = $("roleSearchResults");
    if (!q) { results.innerHTML = ""; return; }
    const { data } = await supabaseClient.from("profiles").select("id, full_name, email, role")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).limit(5);
    if (!data || !data.length) { results.innerHTML = `<div class="emptyState" style="padding:8px">No users found.</div>`; return; }
    results.innerHTML = data.map(u => `
      <div class="roleSearchResult" data-uid="${u.id}" data-uname="${escapeHtml(u.full_name || u.email || u.id)}">
        <span>${escapeHtml(u.full_name || "?")} <span class="itemMeta">${escapeHtml(u.email || u.id)}</span></span>
        ${u.role === "founder" ? `<span class="roleBadge roleBadge--founder">&#128081; Founder</span>` : ""}
      </div>
    `).join("");
    results.querySelectorAll(".roleSearchResult").forEach(row => {
      row.addEventListener("click", () => {
        roleSearchTarget = { id: row.dataset.uid, name: row.dataset.uname };
        results.querySelectorAll(".roleSearchResult").forEach(r => r.classList.remove("selected"));
        row.classList.add("selected");
        $("roleSearchInput").value = row.dataset.uname;
      });
    });
  }, 400));
}

if ($("btnAssignRole")) {
  $("btnAssignRole").addEventListener("click", async () => {
    if (!isFounderUser()) { showToast("Only the Founder can assign roles."); return; }
    if (!roleSearchTarget) { showToast("Select a user first."); return; }
    const role = $("roleSelectDropdown").value;
    const { error } = await supabaseClient.from("community_roles").upsert({
      user_id: roleSearchTarget.id, role, assigned_by: currentUser.id,
    }, { onConflict: "user_id" });
    if (error) { showToast("Error: " + error.message); return; }
    showToast(roleSearchTarget.name + " assigned as " + role + "!");
    roleSearchTarget = null;
    $("roleSearchInput").value = "";
    $("roleSearchResults").innerHTML = "";
    loadAdminRoleList();
    loadCommunityRoles(); // Pending #13
  });
}

if ($("btnToggleAdminPanel")) {
  $("btnToggleAdminPanel").addEventListener("click", () => {
    const panel = $("communityAdminPanel");
    panel.classList.toggle("hidden");
    if (!panel.classList.contains("hidden")) {
      loadAdminRoleList();
      // wire up admin sub-tabs (Phase 8A) — safe to call multiple times
      initAdminSubTabs();
    }
  });
}

/* =========================================================
   PHASE 8A — ADMIN PANEL SUB-TABS
   ========================================================= */
let adminSubTabsInited = false;
function initAdminSubTabs() {
  if (adminSubTabsInited) return;
  adminSubTabsInited = true;
  const tabBar = $("adminSubTabs");
  if (!tabBar) return;
  tabBar.addEventListener("click", e => {
    const btn = e.target.closest("[data-admin]");
    if (!btn) return;
    const tab = btn.dataset.admin;
    tabBar.querySelectorAll(".subTabBtn").forEach(b => b.classList.toggle("active", b.dataset.admin === tab));
    document.querySelectorAll(".adminSubView").forEach(v => v.classList.remove("active"));
    $(`adminTab${tab.charAt(0).toUpperCase() + tab.slice(1)}`).classList.add("active");
    if (tab === "analytics") loadAdminAnalytics();
    if (tab === "reports") loadAdminReports();
    if (tab === "users") initAdminUserSearch();
    if (tab === "flagged") loadAdminFlagged();
    if (tab === "settings") loadAdminSettingsTab();
  });
  // Wire refresh button
  const refreshBtn = $("btnRefreshReports");
  if (refreshBtn) refreshBtn.addEventListener("click", loadAdminReports);
  const refreshFlaggedBtn = $("btnRefreshFlagged");
  if (refreshFlaggedBtn) refreshFlaggedBtn.addEventListener("click", loadAdminFlagged);
  const approvalToggle = $("toggleRequireApproval");
  if (approvalToggle) {
    approvalToggle.addEventListener("change", async () => {
      const val = approvalToggle.checked;
      const { error } = await supabaseClient.from("community_settings")
        .update({ require_approval: val, updated_at: new Date().toISOString(), updated_by: currentUser?.id })
        .eq("id", true);
      if (error) { showToast("Could not save: " + error.message); approvalToggle.checked = !val; return; }
      communitySettingsCache.require_approval = val;
      showToast(val ? "New posts/listings/videos now need approval." : "Approval requirement turned off.");
    });
  }
}

function loadAdminSettingsTab() {
  const toggle = $("toggleRequireApproval");
  if (toggle) toggle.checked = !!communitySettingsCache.require_approval;
}

/* ---- Flagged content queue tab (Phase 8A) ---- */
async function loadAdminFlagged() {
  const list = $("adminFlaggedList");
  if (!list) return;
  list.innerHTML = `<div class="emptyState">Loading…</div>`;

  const [{ data: posts }, { data: listings }, { data: videos }] = await Promise.all([
    supabaseClient.from("forum_posts").select("id, title, author_name, flag_reason, created_at").eq("flagged", true).order("created_at", { ascending: false }).limit(30),
    supabaseClient.from("marketplace_listings").select("id, title, poster_name, flag_reason, created_at").eq("flagged", true).order("created_at", { ascending: false }).limit(30),
    supabaseClient.from("videos").select("id, title, uploader_name, flag_reason, created_at").eq("flagged", true).order("created_at", { ascending: false }).limit(30),
  ]);

  const items = [
    ...(posts || []).map(p => ({ ...p, kind: "forum_post", table: "forum_posts", by: p.author_name })),
    ...(listings || []).map(l => ({ ...l, kind: "listing", table: "marketplace_listings", by: l.poster_name })),
    ...(videos || []).map(v => ({ ...v, kind: "video", table: "videos", by: v.uploader_name })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!items.length) { list.innerHTML = `<div class="emptyState">Nothing flagged right now. 🎉</div>`; return; }

  const kindLabel = { forum_post: "🔥 Forum post", listing: "🛍️ Listing", video: "🎬 Video" };
  list.innerHTML = items.map(it => `
    <div class="reportItem" data-flag-row>
      <div class="reportMeta">${fmtDate(it.created_at)} • ${kindLabel[it.kind]} • by ${escapeHtml(it.by || "?")}</div>
      <div class="reportBody"><strong>${escapeHtml(it.title || "(untitled)")}</strong><br>${escapeHtml(it.flag_reason || "Flagged for review")}</div>
      <div class="reportActions">
        <button class="btn btnPrimary btnSm" data-flag-approve="${it.id}" data-flag-table="${it.table}">✓ Approve</button>
        <button class="btn btnDanger btnSm" data-flag-delete="${it.id}" data-flag-table="${it.table}">🗑 Delete</button>
      </div>
    </div>`).join("");

  list.querySelectorAll("[data-flag-approve]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await supabaseClient.from(btn.dataset.flagTable).update({ flagged: false, flag_reason: null }).eq("id", btn.dataset.flagApprove);
      showToast("Approved — now visible to everyone.");
      btn.closest("[data-flag-row]").remove();
    });
  });
  list.querySelectorAll("[data-flag-delete]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this content permanently?")) return;
      await supabaseClient.from(btn.dataset.flagTable).delete().eq("id", btn.dataset.flagDelete);
      showToast("Deleted.");
      btn.closest("[data-flag-row]").remove();
    });
  });
}

/* ---- Analytics tab ---- */
let analyticsLoaded = false;
async function loadAdminAnalytics() {
  if (analyticsLoaded) return;
  analyticsLoaded = true;

  // Parallel stat queries
  const [
    { count: totalUsers },
    { count: vipCount },
    { count: meetingCount },
    { count: postCount },
    { count: listingCount },
    { count: videoCount }
  ] = await Promise.all([
    supabaseClient.from("profiles").select("*", { count: "exact", head: true }),
    supabaseClient.from("vip_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabaseClient.from("meetings").select("*", { count: "exact", head: true }),
    supabaseClient.from("forum_posts").select("*", { count: "exact", head: true }),
    supabaseClient.from("marketplace_listings").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabaseClient.from("videos").select("*", { count: "exact", head: true }),
  ]);

  // Set stat grid values
  function setStat(id, val) {
    const el = $(id);
    if (!el) return;
    const numEl = el.querySelector(".analyticsNum");
    if (numEl) numEl.textContent = val !== null ? Number(val).toLocaleString() : "–";
  }
  setStat("aStatUsers",    totalUsers);
  setStat("aStatVip",      vipCount);
  setStat("aStatMeetings", meetingCount);
  setStat("aStatPosts",    postCount);
  setStat("aStatListings", listingCount);
  setStat("aStatVideos",   videoCount);

  // Signup chart — last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: signups } = await supabaseClient.from("profiles")
    .select("created_at").gte("created_at", since).order("created_at");
  if (signups) drawSignupChart(signups);

  // DAU chart — last 30 days (Phase 8A)
  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: sessions } = await supabaseClient.from("user_sessions")
    .select("session_date").gte("session_date", sinceDate).order("session_date");
  if (sessions) drawDauChart(sessions);

  // Top forum posts
  const { data: topPosts } = await supabaseClient.from("forum_posts")
    .select("id, title, author_name, likes_count, view_count, created_at")
    .order("likes_count", { ascending: false }).limit(5);
  const adminTopPosts = $("adminTopPosts");
  if (adminTopPosts && topPosts?.length) {
    adminTopPosts.innerHTML = topPosts.map(p => `
      <div class="listItem">
        <div style="flex:1;min-width:0">
          <div class="itemTitle">${escapeHtml(p.title)}</div>
          <div class="itemMeta">by ${escapeHtml(p.author_name || "?")} • 👍 ${p.likes_count || 0} • 👁 ${p.view_count || 0}</div>
        </div>
      </div>`).join("");
  } else if (adminTopPosts) { adminTopPosts.innerHTML = `<div class="emptyState">No posts yet.</div>`; }

  // Top listings by views
  const { data: topListings } = await supabaseClient.from("marketplace_listings")
    .select("id, title, type, price, view_count")
    .order("view_count", { ascending: false }).limit(5);
  const adminTopListings = $("adminTopListings");
  if (adminTopListings && topListings?.length) {
    adminTopListings.innerHTML = topListings.map(l => `
      <div class="listItem">
        <div style="flex:1;min-width:0">
          <div class="itemTitle">${escapeHtml(l.title)}</div>
          <div class="itemMeta">${l.type || "listing"} • ${l.price ? `₱${Number(l.price).toLocaleString()}` : "—"} • 👁 ${l.view_count || 0} views</div>
        </div>
      </div>`).join("");
  } else if (adminTopListings) { adminTopListings.innerHTML = `<div class="emptyState">No listings yet.</div>`; }
}

function drawSignupChart(signups) {
  const canvas = $("signupChart");
  if (!canvas || !canvas.getContext) return;
  // Bucket by day
  const days = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days[d.toISOString().slice(0, 10)] = 0;
  }
  signups.forEach(s => {
    const day = s.created_at.slice(0, 10);
    if (day in days) days[day]++;
  });
  const labels = Object.keys(days);
  const vals = Object.values(days);
  const max = Math.max(...vals, 1);
  const W = canvas.parentElement.offsetWidth || 300;
  canvas.width = W;
  canvas.height = 90;
  const ctx = canvas.getContext("2d");
  const padL = 28, padR = 8, padT = 10, padB = 20;
  const cW = W - padL - padR;
  const cH = 90 - padT - padB;
  const barW = Math.max(2, (cW / labels.length) - 2);
  ctx.clearRect(0, 0, W, 90);
  // Grid lines
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  [0, 0.5, 1].forEach(t => {
    const y = padT + cH * (1 - t);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = "#9aa3b5"; ctx.font = "9px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(Math.round(max * t), padL - 3, y + 3);
  });
  // Bars
  labels.forEach((lbl, i) => {
    const x = padL + i * (cW / labels.length);
    const barH = (vals[i] / max) * cH;
    const y = padT + cH - barH;
    const grad = ctx.createLinearGradient(0, y, 0, padT + cH);
    grad.addColorStop(0, "#2563eb");
    grad.addColorStop(1, "#0A2463");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x + 1, y, barW, barH, [2, 2, 0, 0]) : ctx.rect(x + 1, y, barW, barH);
    ctx.fill();
  });
  // X-axis labels (every 7 days)
  ctx.fillStyle = "#9aa3b5"; ctx.font = "8px sans-serif"; ctx.textAlign = "center";
  [0, 7, 14, 21, 29].forEach(i => {
    if (i < labels.length) {
      const x = padL + i * (cW / labels.length) + barW / 2;
      const lbl = labels[i].slice(5); // MM-DD
      ctx.fillText(lbl, x, 90 - 4);
    }
  });
}

/* ---- DAU chart (Phase 8A) — counts rows per day from user_sessions ---- */
function drawDauChart(sessions) {
  const canvas = $("dauChart");
  if (!canvas || !canvas.getContext) return;
  const days = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days[d.toISOString().slice(0, 10)] = 0;
  }
  sessions.forEach(s => { if (s.session_date in days) days[s.session_date]++; });
  const labels = Object.keys(days);
  const vals = Object.values(days);
  const max = Math.max(...vals, 1);
  const W = canvas.parentElement.offsetWidth || 300;
  canvas.width = W;
  canvas.height = 90;
  const ctx = canvas.getContext("2d");
  const padL = 28, padR = 8, padT = 10, padB = 20;
  const cW = W - padL - padR;
  const cH = 90 - padT - padB;
  ctx.clearRect(0, 0, W, 90);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  [0, 0.5, 1].forEach(t => {
    const y = padT + cH * (1 - t);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = "#9aa3b5"; ctx.font = "9px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(Math.round(max * t), padL - 3, y + 3);
  });
  // Line chart (distinguishes it visually from the signup bar chart)
  ctx.beginPath();
  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = 2;
  labels.forEach((lbl, i) => {
    const x = padL + (i / (labels.length - 1)) * cW;
    const y = padT + cH - (vals[i] / max) * cH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  labels.forEach((lbl, i) => {
    const x = padL + (i / (labels.length - 1)) * cW;
    const y = padT + cH - (vals[i] / max) * cH;
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fillStyle = "#4ade80"; ctx.fill();
  });
  ctx.fillStyle = "#9aa3b5"; ctx.font = "8px sans-serif"; ctx.textAlign = "center";
  [0, 7, 14, 21, 29].forEach(i => {
    if (i < labels.length) {
      const x = padL + (i / (labels.length - 1)) * cW;
      ctx.fillText(labels[i].slice(5), x, 90 - 4);
    }
  });
}

/* ---- Reports tab ---- */
async function loadAdminReports() {
  const list = $("adminReportsList");
  if (!list) return;
  list.innerHTML = `<div class="emptyState">Loading…</div>`;
  const { data, error } = await supabaseClient.from("user_reports")
    .select("id, reason, details, status, target_type, target_id, created_at, reporter:reporter_id(full_name)")
    .order("created_at", { ascending: false }).limit(50);
  if (error) { list.innerHTML = `<div class="emptyState">Could not load reports: ${error.message}</div>`; return; }
  if (!data?.length) { list.innerHTML = `<div class="emptyState">No reports yet. 🎉</div>`; return; }
  list.innerHTML = data.map(r => {
    const actioned = r.status === "actioned" || r.status === "dismissed";
    return `
      <div class="reportItem${actioned ? " reportItem--actioned" : ""}" data-report-id="${r.id}">
        <div class="reportMeta">
          ${fmtDate(r.created_at)} • reported by ${escapeHtml(r.reporter?.full_name || "unknown")} •
          <strong>${escapeHtml(r.target_type || "content")}</strong> #${escapeHtml(r.target_id || "")}
          ${r.status ? `• <em>${escapeHtml(r.status)}</em>` : ""}
        </div>
        <div class="reportBody"><strong>Reason:</strong> ${escapeHtml(r.reason || "—")}<br>${escapeHtml(r.details || "")}</div>
        ${!actioned ? `
        <div class="reportActions">
          <button class="btn btnGhost btnSm" data-report-dismiss="${r.id}">✓ Dismiss</button>
          <button class="btn btnDanger btnSm" data-report-action="${r.id}" data-target-type="${escapeHtml(r.target_type||"")}" data-target-id="${escapeHtml(r.target_id||"")}">⚠️ Delete content</button>
        </div>` : ""}
      </div>`;
  }).join("");
  // Wire dismiss buttons
  list.querySelectorAll("[data-report-dismiss]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const reportId = btn.dataset.reportDismiss;
      await supabaseClient.from("user_reports").update({ status: "dismissed" }).eq("id", reportId);
      showToast("Report dismissed.");
      btn.closest(".reportItem").classList.add("reportItem--actioned");
      btn.closest(".reportActions").remove();
    });
  });
  // Wire delete+action buttons
  list.querySelectorAll("[data-report-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const reportId = btn.dataset.reportAction;
      const targetType = btn.dataset.targetType;
      const targetId = btn.dataset.targetId;
      if (!confirm(`Delete this ${targetType} and mark report as actioned?`)) return;
      // Delete the target content
      const tableMap = { forum_post: "forum_posts", listing: "marketplace_listings", video: "videos", announcement: "feed_posts" };
      const table = tableMap[targetType];
      if (table && targetId) await supabaseClient.from(table).delete().eq("id", targetId);
      await supabaseClient.from("user_reports").update({ status: "actioned" }).eq("id", reportId);
      showToast("Content deleted and report actioned.");
      btn.closest(".reportItem").classList.add("reportItem--actioned");
      btn.closest(".reportActions").remove();
    });
  });
}

/* ---- User management tab ---- */
let adminUserSearchInited = false;
function initAdminUserSearch() {
  if (adminUserSearchInited) return;
  adminUserSearchInited = true;
  const input = $("adminUserSearch");
  if (!input) return;
  input.addEventListener("input", debounce(async () => {
    const q = input.value.trim();
    const list = $("adminUserList");
    if (q.length < 2) { list.innerHTML = `<div class="emptyState">Type at least 2 characters.</div>`; return; }
    list.innerHTML = `<div class="emptyState">Searching…</div>`;
    const { data } = await supabaseClient.from("profiles")
      .select("id, full_name, email, mg_id, role, reputation_tier, created_at")
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,mg_id.ilike.%${q}%`)
      .limit(20);
    if (!data?.length) { list.innerHTML = `<div class="emptyState">No users found for "${escapeHtml(q)}".</div>`; return; }
    list.innerHTML = data.map(u => `
      <div class="listItem">
        <div style="flex:1;min-width:0">
          <div class="itemTitle">${escapeHtml(u.full_name || "—")} ${getRoleBadgeHtml(u.role || "")}</div>
          <div class="itemMeta">@${escapeHtml(u.mg_id || "")} • ${escapeHtml(u.email || "")} • ${escapeHtml(u.reputation_tier || "newcomer")} • joined ${fmtDate(u.created_at)}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btnGhost btnSm" onclick="openProfileView('${u.id}')">View</button>
          ${isFounderUser() ? `<button class="btn btnDanger btnSm" data-ban-user="${u.id}">Ban</button>` : ""}
        </div>
      </div>`).join("");
    list.querySelectorAll("[data-ban-user]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const uid = btn.dataset.banUser;
        if (!confirm("Ban this user? They will lose access.")) return;
        const { error } = await supabaseClient.from("profiles").update({ role: "banned" }).eq("id", uid);
        if (error) { showToast("Error: " + error.message); return; }
        showToast("User banned.");
        btn.closest(".listItem").querySelector(".itemTitle").style.opacity = ".4";
        btn.disabled = true;
      });
    });
  }, 380));
}

/* ============================================================
   FEED — Announcements (admin-only post)
   ============================================================ */
async function loadFeed() {
  const { data, error } = await supabaseClient.from("feed_posts").select("*")
    .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(30);
  const list = $("feedList");
  if (!list) return;
  if (error) { list.innerHTML = `<div class="emptyState">Could not load feed.</div>`; return; }

  const adminHead = $("adminAnnounceHead");
  if (adminHead) adminHead.classList.toggle("hidden", !isAdminUser());
  const adminToggle = $("btnToggleAdminPanel");
  if (adminToggle) adminToggle.classList.toggle("hidden", !isFounderUser());

  if (!data || !data.length) {
    list.innerHTML = `<div class="emptyState">No announcements yet — check back soon.</div>`;
    return;
  }
  list.innerHTML = data.map(p => `
    <div class="feedCard${p.pinned ? " feedCard--pinned" : ""}">
      ${p.pinned ? `<div class="feedPinLabel">&#128204; Pinned</div>` : ""}
      ${p.image_url ? `<img class="feedImage" src="${escapeHtml(p.image_url)}" alt="" loading="lazy" />` : ""}
      <div class="feedTitle">${escapeHtml(p.title || "")}</div>
      <div class="feedBody">${escapeHtml(p.body || "")}</div>
      <div class="feedMeta">${fmtDate(p.created_at)}${p.author_name ? " &bull; " + escapeHtml(p.author_name) : ""}${p.author_role ? " " + getRoleBadgeHtml(p.author_role) : ""}</div>
    </div>
  `).join("");
}

// ---------------------------------------------------------------------------
// Dashboard: combined feed (announcements + marketplace + jobs), newest first
// ---------------------------------------------------------------------------
async function loadDashboardFeed() {
  const list = $("dashFeedList");
  if (!list) return;
  list.innerHTML = `<div class="emptyState">Loading…</div>`;
  const tab = (typeof dashFeedActiveTab !== "undefined") ? dashFeedActiveTab : "foryou";

  let followIds = [];
  if (tab === "following") {
    const { data: follows } = await supabaseClient.from("follows").select("followee_id").eq("follower_id", currentUser?.id);
    followIds = (follows || []).map(f => f.followee_id);
    if (!followIds.length) {
      list.innerHTML = `<div class="emptyState">Follow people to see their posts here.</div>`;
      return;
    }
  }

  let mkQuery = supabaseClient.from("marketplace_listings").select("*").limit(tab === "popular" ? 20 : 15);
  if (tab === "popular") mkQuery = mkQuery.order("view_count", { ascending: false });
  else mkQuery = mkQuery.order("created_at", { ascending: false });
  if (tab === "following") mkQuery = mkQuery.in("posted_by", followIds);

  let feedQuery = supabaseClient.from("feed_posts").select("*").limit(10);
  if (tab !== "following") feedQuery = feedQuery.order("created_at", { ascending: false });

  const [{ data: feedData }, { data: mkData }] = await Promise.all([
    tab === "following" ? Promise.resolve({ data: [] }) : feedQuery,
    mkQuery,
  ]);

  const visibleMk = (mkData || []).filter(l => !l.flagged || l.posted_by === currentUser?.id);
  await loadSellerRatings(visibleMk.map(l => l.posted_by));
  let combined = [
    ...(feedData || []).map(p => ({ ...p, _kind: "announcement" })),
    ...visibleMk.map(l => ({ ...l, _kind: l.type === "job" ? "job" : "marketplace" })),
  ];

  if (tab === "popular") {
    combined = combined.sort((a, b) => ((b.view_count || 0) + (b.likes_count || 0)) - ((a.view_count || 0) + (a.likes_count || 0)));
  } else {
    combined = combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  combined = combined.slice(0, 20);

  if (!combined.length) { list.innerHTML = `<div class="emptyState">Nothing here yet — check back soon.</div>`; return; }

  const typeLabel = { announcement: "📢 Announcement", job: "💼 Job", marketplace: "🛍️ Marketplace" };

  list.innerHTML = combined.map(item => {
    if (item._kind === "announcement") {
      return `
        <div class="dashFeedCard${item.pinned ? " dashFeedCard--pinned" : ""}">
          <div class="dashFeedType">${typeLabel.announcement}</div>
          ${item.image_url ? `<img class="dashFeedImg" src="${escapeHtml(item.image_url)}" alt="" loading="lazy" />` : ""}
          <div class="dashFeedTitle">${escapeHtml(item.title || "")}</div>
          <div class="dashFeedBody">${escapeHtml((item.body || "").slice(0, 180))}${item.body?.length > 180 ? "…" : ""}</div>
          <div class="dashFeedMeta">${fmtDate(item.created_at)}${item.author_name ? " · " + escapeHtml(item.author_name) : ""}</div>
        </div>`;
    }
    // Job/marketplace items: same reusable card as the Marketplace tab itself
    // (see listingCardHtml, Phase C.5) instead of a second hand-maintained template.
    return listingCardHtml(item, { ownerView: false });
  }).join("");

  wireListingCardEvents(list, visibleMk);

  // Update tiles after feed data is loaded
  setTimeout(updateDashTiles, 100);
  updateLatestUpdatesTile();
}

if ($("btnPostAnnouncement")) {
  $("btnPostAnnouncement").addEventListener("click", () => {
    if (!isAdminUser()) { showToast("Only admins can post announcements."); return; }
    openModal(`
      <div class="modalTitle">&#128226; Post Announcement</div>
      <div class="field"><label>Title</label><input type="text" id="annTitleInput" placeholder="Announcement title" /></div>
      <div class="field"><label>Message</label><textarea id="annBodyInput" rows="4" placeholder="Write your announcement..."></textarea></div>
      <div class="field"><label>Image URL (optional)</label><input type="text" id="annImageInput" placeholder="https://..." /></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <input type="checkbox" id="annPinCheck" /> <label for="annPinCheck">&#128204; Pin this announcement</label>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
        <button class="btn btnGhost" id="annCancel">Cancel</button>
        <button class="btn btnPrimary" id="annSubmit">Post</button>
      </div>
    `);
    $("annCancel").addEventListener("click", closeModal);
    $("annSubmit").addEventListener("click", async () => {
      const title = $("annTitleInput").value.trim();
      const body = $("annBodyInput").value.trim();
      const image_url = $("annImageInput").value.trim() || null;
      const pinned = $("annPinCheck").checked;
      clearFieldErrors(["annTitleInput", "annBodyInput"]);
      if (!title || !body) {
        showToast("Please fill in title and message.");
        markFieldErrors([!title ? "annTitleInput" : null, !body ? "annBodyInput" : null].filter(Boolean));
        return;
      }
      const { error } = await supabaseClient.from("feed_posts").insert({
        title, body, image_url, pinned,
        author_name: currentProfile ? currentProfile.full_name : "Admin",
        author_id: currentUser ? currentUser.id : null,
        author_role: currentProfile ? currentProfile.role : null,
      });
      if (error) { showToast("Could not post: " + error.message); return; }
      closeModal();
      showToast("Announcement posted!");
      loadFeed();
      loadDashboardFeed();
      updateLatestUpdatesTile();
    });
  });
}

/* ============================================================
   MARKETPLACE — FB-style listings
   ============================================================ */
// ============================================================================
// 🛍️ PHASE 5A — BETTER MARKETPLACE STATE
// ============================================================================

let mkFilters = {
  search: "",
  type: "all",           // all, item, job, service
  priceMin: 0,
  priceMax: 999999,
  condition: "all",      // all, new, used, for_parts
  location: "",
  sortBy: "newest",      // newest, price_low, price_high, most_viewed
  datePosted: "any",     // any, today, week, month
};

let mkSavedListingIds = new Set();  // Cache of user's saved listing IDs
let mkCurrentTab = "all";            // all, saved, my_listings, analytics

// Old mkFilter (legacy) - kept for backwards compatibility if needed
let mkFilter = "all";

async function loadMarketplace() {
  // Proxy to new Phase 5A system
  await loadMarketplaceUI();
}

// ============================================================================
// MAIN MARKETPLACE UI LOADER
// ============================================================================
async function loadMarketplaceUI() {
  const container = $("moreMarketplace");
  if (!container) return;

  // Load user's saved listings (if authenticated)
  if (currentUser) {
    await loadUserSavedListingIds();
  }

  // Render filter panel + tabs
  renderMarketplaceFilters();

  // Load initial listings based on current tab
  if (mkCurrentTab === "all") {
    await applyMarketplaceFilters();
  } else if (mkCurrentTab === "saved") {
    await loadSavedListings();
  } else if (mkCurrentTab === "my_listings") {
    await loadMyMarketplaceListings();
  } else if (mkCurrentTab === "analytics") {
    await loadMyListingsAnalytics();
  }
}

// ============================================================================
// RENDER FILTER PANEL & TABS
// ============================================================================
function renderMarketplaceFilters() {
  const container = $("moreMarketplace");
  if (!container) return;

  let filterPanel = container.querySelector(".mkFilterPanel");
  if (!filterPanel) {
    filterPanel = document.createElement("div");
    filterPanel.className = "mkFilterPanel";
    container.insertBefore(filterPanel, container.firstChild);
  }

  filterPanel.innerHTML = `
    <div class="mkFilterContainer">
      <div class="mkFilterRow">
        <input
          type="text"
          id="mkSearchInput"
          class="mkSearchInput"
          placeholder="🔍 Search listings..."
          value="${escapeHtml(mkFilters.search)}"
        />
        <button class="btn btnGhost btnSm" id="mkClearFiltersBtn">Clear all</button>
      </div>

      <div class="mkFilterRow">
        <div class="mkFilterGroup">
          <label>Type</label>
          <select id="mkTypeFilter">
            <option value="all" ${mkFilters.type === "all" ? "selected" : ""}>All Types</option>
            <option value="item" ${mkFilters.type === "item" ? "selected" : ""}>For Sale</option>
            <option value="job" ${mkFilters.type === "job" ? "selected" : ""}>Jobs</option>
            <option value="service" ${mkFilters.type === "service" ? "selected" : ""}>Services</option>
          </select>
        </div>

        <div class="mkFilterGroup">
          <label>Price Range (PHP)</label>
          <div class="mkPriceRange">
            <input
              type="number"
              id="mkPriceMin"
              placeholder="Min"
              value="${mkFilters.priceMin || ""}"
              min="0"
            />
            <span>—</span>
            <input
              type="number"
              id="mkPriceMax"
              placeholder="Max"
              value="${mkFilters.priceMax === 999999 ? "" : mkFilters.priceMax}"
              min="0"
            />
          </div>
        </div>

        <div class="mkFilterGroup">
          <label>Sort By</label>
          <select id="mkSortBy">
            <option value="newest" ${mkFilters.sortBy === "newest" ? "selected" : ""}>Newest First</option>
            <option value="price_low" ${mkFilters.sortBy === "price_low" ? "selected" : ""}>Price: Low → High</option>
            <option value="price_high" ${mkFilters.sortBy === "price_high" ? "selected" : ""}>Price: High → Low</option>
            <option value="most_viewed" ${mkFilters.sortBy === "most_viewed" ? "selected" : ""}>Most Viewed</option>
          </select>
        </div>
      </div>

      <div class="mkFilterRow">
        <div class="mkFilterGroup">
          <label>Condition</label>
          <select id="mkConditionFilter">
            <option value="all" ${mkFilters.condition === "all" ? "selected" : ""}>All Conditions</option>
            <option value="new" ${mkFilters.condition === "new" ? "selected" : ""}>Brand New</option>
            <option value="used" ${mkFilters.condition === "used" ? "selected" : ""}>Used</option>
            <option value="for_parts" ${mkFilters.condition === "for_parts" ? "selected" : ""}>For Parts</option>
          </select>
        </div>

        <div class="mkFilterGroup">
          <label>Location</label>
          <input
            type="text"
            id="mkLocationFilter"
            placeholder="e.g., Manila"
            value="${escapeHtml(mkFilters.location)}"
          />
        </div>

        <div class="mkFilterGroup">
          <label>Date Posted</label>
          <select id="mkDatePostedFilter">
            <option value="any" ${mkFilters.datePosted === "any" ? "selected" : ""}>Any Time</option>
            <option value="today" ${mkFilters.datePosted === "today" ? "selected" : ""}>Today</option>
            <option value="week" ${mkFilters.datePosted === "week" ? "selected" : ""}>This Week</option>
            <option value="month" ${mkFilters.datePosted === "month" ? "selected" : ""}>This Month</option>
          </select>
        </div>
      </div>
    </div>

    <div class="mkTabNav">
      <button class="mkTabBtn ${mkCurrentTab === "all" ? "active" : ""}" data-mk-tab="all">
        🛍️ All Listings
      </button>
      <button class="mkTabBtn ${mkCurrentTab === "saved" ? "active" : ""}" data-mk-tab="saved">
        ❤️ Saved <span class="badge" id="mkSavedCount">${mkSavedListingIds.size}</span>
      </button>
      <button class="mkTabBtn ${mkCurrentTab === "my_listings" ? "active" : ""}" data-mk-tab="my_listings">
        📤 My Listings
      </button>
      <button class="mkTabBtn ${mkCurrentTab === "analytics" ? "active" : ""}" data-mk-tab="analytics">
        📊 Analytics
      </button>
    </div>
  `;

  attachMarketplaceFilterListeners();
}

// ============================================================================
// ATTACH FILTER EVENT LISTENERS
// ============================================================================
function attachMarketplaceFilterListeners() {
  const searchInput = $("mkSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => {
      mkFilters.search = searchInput.value;
      applyMarketplaceFilters();
    }, 300));
  }

  const typeFilter = $("mkTypeFilter");
  if (typeFilter) {
    typeFilter.addEventListener("change", () => {
      mkFilters.type = typeFilter.value;
      applyMarketplaceFilters();
    });
  }

  const priceMin = $("mkPriceMin");
  const priceMax = $("mkPriceMax");
  if (priceMin) {
    priceMin.addEventListener("input", debounce(() => {
      mkFilters.priceMin = priceMin.value ? parseInt(priceMin.value) : 0;
      applyMarketplaceFilters();
    }, 300));
  }
  if (priceMax) {
    priceMax.addEventListener("input", debounce(() => {
      mkFilters.priceMax = priceMax.value ? parseInt(priceMax.value) : 999999;
      applyMarketplaceFilters();
    }, 300));
  }

  const conditionFilter = $("mkConditionFilter");
  if (conditionFilter) {
    conditionFilter.addEventListener("change", () => {
      mkFilters.condition = conditionFilter.value;
      applyMarketplaceFilters();
    });
  }

  const locationFilter = $("mkLocationFilter");
  if (locationFilter) {
    locationFilter.addEventListener("input", debounce(() => {
      mkFilters.location = locationFilter.value;
      applyMarketplaceFilters();
    }, 300));
  }

  const sortBy = $("mkSortBy");
  if (sortBy) {
    sortBy.addEventListener("change", () => {
      mkFilters.sortBy = sortBy.value;
      applyMarketplaceFilters();
    });
  }

  const datePostedFilter = $("mkDatePostedFilter");
  if (datePostedFilter) {
    datePostedFilter.addEventListener("change", () => {
      mkFilters.datePosted = datePostedFilter.value;
      applyMarketplaceFilters();
    });
  }

  const clearBtn = $("mkClearFiltersBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      mkFilters = {
        search: "",
        type: "all",
        priceMin: 0,
        priceMax: 999999,
        condition: "all",
        location: "",
        sortBy: "newest",
        datePosted: "any",
      };
      renderMarketplaceFilters();
      applyMarketplaceFilters();
    });
  }

  document.querySelectorAll(".mkTabBtn").forEach(btn => {
    btn.addEventListener("click", () => {
      mkCurrentTab = btn.dataset.mkTab;
      document.querySelectorAll(".mkTabBtn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadMarketplaceUI();
    });
  });
}

// ============================================================================
// APPLY MARKETPLACE FILTERS & LOAD LISTINGS
// ============================================================================
// Phase 9 — pagination state for the Marketplace grid
const MK_PAGE_SIZE = 50;
let mkPage = 0;
let mkAccumulatedListings = [];

async function applyMarketplaceFilters(loadMore = false) {
  const grid = $("mkGrid");
  if (!grid) return;

  if (!loadMore) { mkPage = 0; mkAccumulatedListings = []; grid.innerHTML = '<div class="emptyState">Loading...</div>'; }

  try {
    let query = supabaseClient.from("marketplace_listings").select("*");

    if (mkFilters.type !== "all") {
      query = query.eq("type", mkFilters.type);
    }
    if (mkFilters.condition !== "all") {
      query = query.eq("condition", mkFilters.condition);
    }
    if (mkFilters.priceMin > 0) {
      query = query.gte("price", mkFilters.priceMin);
    }
    if (mkFilters.priceMax < 999999) {
      query = query.lte("price", mkFilters.priceMax);
    }

    // Featured listings (VIP perk) always sort first, then the user's chosen sort applies.
    query = query.order("is_featured", { ascending: false });

    if (mkFilters.sortBy === "newest") {
      query = query.order("created_at", { ascending: false });
    } else if (mkFilters.sortBy === "most_viewed") {
      query = query.order("view_count", { ascending: false });
    } else if (mkFilters.sortBy === "price_low") {
      query = query.order("price", { ascending: true });
    } else if (mkFilters.sortBy === "price_high") {
      query = query.order("price", { ascending: false });
    }

    query = query.range(mkPage * MK_PAGE_SIZE, mkPage * MK_PAGE_SIZE + MK_PAGE_SIZE - 1);
    const { data, error } = await query;

    if (error) {
      grid.innerHTML = `<div class="emptyState">❌ Could not load listings: ${escapeHtml(error.message)}</div>`;
      return;
    }

    const hasMore = (data || []).length === MK_PAGE_SIZE;
    mkAccumulatedListings = mkAccumulatedListings.concat(data || []);
    let listings = mkAccumulatedListings.slice();

    if (mkFilters.search) {
      const searchLower = mkFilters.search.toLowerCase();
      listings = listings.filter(l =>
        (l.title && l.title.toLowerCase().includes(searchLower)) ||
        (l.description && l.description.toLowerCase().includes(searchLower))
      );
    }

    if (mkFilters.location) {
      const locLower = mkFilters.location.toLowerCase();
      listings = listings.filter(l =>
        l.location && l.location.toLowerCase().includes(locLower)
      );
    }

    if (mkFilters.datePosted !== "any") {
      const now = Date.now();
      const cutoffMs = mkFilters.datePosted === "today" ? 24 * 60 * 60 * 1000
        : mkFilters.datePosted === "week" ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000; // month
      listings = listings.filter(l => l.created_at && (now - new Date(l.created_at).getTime()) <= cutoffMs);
    }

    listings = listings.filter(l => !l.flagged || l.posted_by === currentUser?.id);
    // Jobs marked "filled" stay visible on the poster's own listings/analytics but drop out of public browsing
    listings = listings.filter(l => !l.filled || l.posted_by === currentUser?.id);

    if (!listings.length) {
      grid.innerHTML = `<div class="emptyState">📭 No listings match your filters.</div>`;
      return;
    }

    renderMarketplaceListings(listings);
    renderLoadMoreButton(grid, hasMore, () => { mkPage++; applyMarketplaceFilters(true); });
  } catch (err) {
    console.error("Marketplace filter error:", err);
    grid.innerHTML = `<div class="emptyState">❌ Error loading listings.</div>`;
  }
}

// Phase 9 — shared "Load more" button, appended after a list container.
// Removes any previous one first so repeated calls don't stack duplicates.
function renderLoadMoreButton(container, hasMore, onClick) {
  const existing = container.parentElement?.querySelector(".loadMoreBtnWrap");
  if (existing) existing.remove();
  if (!hasMore) return;
  const wrap = document.createElement("div");
  wrap.className = "loadMoreBtnWrap";
  wrap.style.cssText = "text-align:center;margin-top:14px";
  wrap.innerHTML = `<button class="btn btnGhost btnSm" id="loadMoreBtn_${Math.random().toString(36).slice(2, 8)}">Load more ↓</button>`;
  container.after(wrap);
  wrap.querySelector("button").addEventListener("click", (e) => {
    e.target.textContent = "Loading…";
    e.target.disabled = true;
    onClick();
  });
}

// ============================================================================
// RENDER MARKETPLACE LISTING CARDS
// ============================================================================
function jobSalaryDisplay(l) {
  if (!l.salary_min && !l.salary_max) return "";
  if (l.salary_min && l.salary_max) return `₱${Number(l.salary_min).toLocaleString()}–₱${Number(l.salary_max).toLocaleString()}`;
  if (l.salary_min) return `₱${Number(l.salary_min).toLocaleString()}+`;
  return `Up to ₱${Number(l.salary_max).toLocaleString()}`;
}
const WORK_TYPE_LABEL = { remote: "🏠 Remote", onsite: "🏢 Onsite", hybrid: "🔀 Hybrid" };
const EXP_LEVEL_LABEL = { entry: "Entry Level", mid: "Mid Level", senior: "Senior Level" };

// ownerView=true renders employer-dashboard extras (applicant count + Mark as Filled) for "My Listings"
// Pending #17 — Seller ratings surfaced on marketplace cards (data already existed via
// profile_reviews / get_profile_rating, just wasn't shown here). Cached so repeated
// renders (filter changes, load more) don't re-fetch sellers we already know about.
let sellerRatingCache = {};
async function loadSellerRatings(sellerIds) {
  const unknown = [...new Set(sellerIds)].filter(id => id && !(id in sellerRatingCache));
  if (!unknown.length) return;
  const { data } = await supabaseClient.from("profile_reviews").select("subject_id, rating").in("subject_id", unknown);
  const sums = {}, counts = {};
  (data || []).forEach(r => {
    sums[r.subject_id] = (sums[r.subject_id] || 0) + r.rating;
    counts[r.subject_id] = (counts[r.subject_id] || 0) + 1;
  });
  unknown.forEach(id => {
    sellerRatingCache[id] = counts[id] ? { avg: sums[id] / counts[id], count: counts[id] } : { avg: 0, count: 0 };
  });
}
function renderSellerRatingHtml(sellerId) {
  const r = sellerRatingCache[sellerId];
  if (!r || !r.count) return "";
  const stars = "★".repeat(Math.round(r.avg)) + "☆".repeat(5 - Math.round(r.avg));
  return `<span class="mkCardRating" title="${r.avg.toFixed(1)} out of 5 (${r.count} review${r.count === 1 ? "" : "s"})">${stars} <span class="mkCardRatingCount">(${r.count})</span></span>`;
}

// ============================================================================
// REUSABLE LISTING CARD COMPONENT (Phase C.5 cleanup, July 18)
// One shared card renderer for marketplace/job listings — used by the
// Marketplace tab grid (renderMarketplaceListings) AND the Home dashboard's
// combined feed (loadDashboardFeed), so both places show the exact same
// card instead of two separately-maintained templates that could drift out
// of sync. Mirrors the existing communityCardHtml() pattern used for groups.
// ============================================================================
function listingCardHtml(l, { ownerView = false } = {}) {
  const photo = l.photos && l.photos[0] ? l.photos[0] : null;
  const typeIcon = l.type === "job" ? "💼" : l.type === "service" ? "🔧" : "🛍️";
  const isJob = l.type === "job";
  const condLabel = l.condition === "new" ? "New" : l.condition === "used" ? "Used" : l.condition === "for_parts" ? "For Parts" : "";
  const salary = isJob ? jobSalaryDisplay(l) : "";
  const priceDisplay = isJob ? (salary || "Salary negotiable") : (l.price ? "₱" + Number(l.price).toLocaleString() : "Negotiable");
  const isSaved = mkSavedListingIds.has(l.id);
  const isMine = currentUser && l.posted_by === currentUser.id;

  return `
    <div class="mkCard" data-mk-id="${l.id}">
      <div class="mkCardImage">
        ${photo
          ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy" />`
          : `<div class="mkCardPlaceholder">${typeIcon}</div>`
        }
        <button class="mkCardSaveBtn ${isSaved ? "saved" : ""}" data-mk-save="${l.id}" title="${isSaved ? "Unsave" : "Save"}">
          ${isSaved ? "❤️" : "🤍"}
        </button>
        ${l.filled ? `<span class="mkFilledRibbon">✅ Filled</span>` : ""}
        ${l.is_featured ? `<span class="mkFilledRibbon" style="background:var(--blue)">⭐ Featured</span>` : ""}
      </div>
      <div class="mkCardContent">
        <div class="mkCardTitle">${escapeHtml(l.title || "")}</div>
        <div class="mkCardPrice">${priceDisplay}</div>
        <div class="mkCardMeta">
          ${isJob && l.work_type ? `<span class="mkCardBadge mkJobBadge">${WORK_TYPE_LABEL[l.work_type] || escapeHtml(l.work_type)}</span>` : ""}
          ${isJob && l.experience_level ? `<span class="mkCardBadge mkJobBadge">${EXP_LEVEL_LABEL[l.experience_level] || escapeHtml(l.experience_level)}</span>` : ""}
          ${!isJob && condLabel ? `<span class="mkCardBadge">${condLabel}</span>` : ""}
          ${l.location ? `<span class="mkCardLoc">📍 ${escapeHtml(l.location)}</span>` : ""}
          ${l.view_count ? `<span class="mkCardViews">👁️ ${l.view_count}</span>` : ""}
          ${ownerView && isJob ? `<span class="mkCardViews">📨 ${l.inquiries_count || 0} applicant${l.inquiries_count === 1 ? "" : "s"}</span>` : ""}
        </div>
        <div class="mkCardSeller">
          <span>${nameLink(l.poster_name || "Seller", getUserVipRow(l.posted_by), l.posted_by)}</span>
          ${renderSellerRatingHtml(l.posted_by)}
          <span class="mkCardTime">${fmtDate(l.created_at)}</span>
        </div>
        ${ownerView && isJob && isMine ? `
          <button class="btn ${l.filled ? "btnGhost" : "btnPrimary"} btnSm mkMarkFilledBtn" data-mk-fill="${l.id}" data-mk-fill-state="${l.filled ? "1" : "0"}">
            ${l.filled ? "↩️ Reopen Job" : "✅ Mark as Filled"}
          </button>
        ` : ""}
      </div>
    </div>
  `;
}

// Wires up the click/save/fill behavior for a container full of listingCardHtml()
// cards — shared by Marketplace grid and the dashboard feed so the interaction
// logic (open detail, save, mark-filled) only has to be written/fixed once.
function wireListingCardEvents(container, listings) {
  container.querySelectorAll("[data-mk-id]").forEach(card => {
    const item = listings.find(l => l.id === card.dataset.mkId);
    if (!item) return;
    card.addEventListener("click", (e) => {
      if (e.target.closest("[data-mk-save]")) return;
      if (e.target.closest("[data-open-profile]")) return;
      if (e.target.closest("[data-mk-fill]")) return;
      openMarketplaceDetail(item);
    });
  });

  container.querySelectorAll("[data-mk-save]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSaveListing(btn.dataset.mkSave);
    });
  });

  container.querySelectorAll("[data-mk-fill]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const listingId = btn.dataset.mkFill;
      const nowFilled = btn.dataset.mkFillState !== "1";
      await toggleJobFilled(listingId, nowFilled);
    });
  });
}

async function renderMarketplaceListings(listings, ownerView) {
  const grid = $("mkGrid");
  if (!grid) return;

  await loadSellerRatings(listings.map(l => l.posted_by));

  grid.innerHTML = listings.map(l => listingCardHtml(l, { ownerView })).join("");
  wireListingCardEvents(grid, listings);
}

// ============================================================================
// EMPLOYER DASHBOARD: mark a job listing filled / reopen it
// ============================================================================
async function toggleJobFilled(listingId, filled) {
  try {
    const { error } = await supabaseClient
      .from("marketplace_listings")
      .update({ filled })
      .eq("id", listingId)
      .eq("posted_by", currentUser.id);
    if (error) throw error;
    showToast(filled ? "Marked as filled ✅" : "Job reopened");
    loadMyMarketplaceListings();
  } catch (err) {
    console.error("Mark filled error:", err);
    showToast("Error updating job status");
  }
}

// ============================================================================
// TOGGLE SAVE LISTING
// ============================================================================
async function toggleSaveListing(listingId) {
  if (!currentUser) {
    showToast("Log in to save listings");
    return;
  }

  try {
    const isSaved = mkSavedListingIds.has(listingId);

    if (isSaved) {
      const { error } = await supabaseClient
        .from("saved_listings")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("listing_id", listingId);

      if (error) throw error;
      mkSavedListingIds.delete(listingId);
      showToast("Removed from saved");
    } else {
      const { error } = await supabaseClient
        .from("saved_listings")
        .insert({
          user_id: currentUser.id,
          listing_id: listingId,
        });

      if (error) throw error;
      mkSavedListingIds.add(listingId);
      showToast("Added to saved ❤️");
    }

    const btn = document.querySelector(`[data-mk-save="${listingId}"]`);
    if (btn) {
      btn.classList.toggle("saved");
      btn.textContent = mkSavedListingIds.has(listingId) ? "❤️" : "🤍";
      btn.title = mkSavedListingIds.has(listingId) ? "Unsave" : "Save";
    }

    const countBadge = $("mkSavedCount");
    if (countBadge) {
      countBadge.textContent = mkSavedListingIds.size;
    }
  } catch (err) {
    console.error("Save listing error:", err);
    showToast("Error saving listing");
  }
}

// ============================================================================
// LOAD USER'S SAVED LISTING IDS (for caching)
// ============================================================================
async function loadUserSavedListingIds() {
  if (!currentUser) return;

  try {
    const { data, error } = await supabaseClient
      .from("saved_listings")
      .select("listing_id")
      .eq("user_id", currentUser.id);

    if (error) throw error;

    mkSavedListingIds = new Set((data || []).map(s => s.listing_id));
  } catch (err) {
    console.error("Error loading saved listings:", err);
  }
}

// ============================================================================
// LOAD SAVED LISTINGS VIEW
// ============================================================================
async function loadSavedListings() {
  const grid = $("mkGrid");
  if (!grid) return;

  grid.innerHTML = '<div class="emptyState">Loading...</div>';

  if (!currentUser) {
    grid.innerHTML = '<div class="emptyState">🔐 Log in to view saved listings</div>';
    return;
  }

  try {
    const { data: saved, error: savedError } = await supabaseClient
      .from("saved_listings")
      .select("listing_id")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    if (savedError) throw savedError;

    if (!saved || !saved.length) {
      grid.innerHTML = '<div class="emptyState">❤️ No saved listings yet</div>';
      return;
    }

    const listingIds = saved.map(s => s.listing_id);

    const { data: listings, error: listingsError } = await supabaseClient
      .from("marketplace_listings")
      .select("*")
      .in("id", listingIds);

    if (listingsError) throw listingsError;

    if (!listings || !listings.length) {
      grid.innerHTML = '<div class="emptyState">❤️ Your saved listings were deleted</div>';
      return;
    }

    renderMarketplaceListings(listings);
  } catch (err) {
    console.error("Error loading saved listings:", err);
    grid.innerHTML = `<div class="emptyState">❌ Error loading saved listings</div>`;
  }
}

// ============================================================================
// LOAD MY MARKETPLACE LISTINGS
// ============================================================================
async function loadMyMarketplaceListings() {
  const grid = $("mkGrid");
  if (!grid) return;

  grid.innerHTML = '<div class="emptyState">Loading...</div>';

  if (!currentUser) {
    grid.innerHTML = '<div class="emptyState">🔐 Log in to view your listings</div>';
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("marketplace_listings")
      .select("*")
      .eq("posted_by", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      grid.innerHTML = `
        <div class="emptyState">
          📭 No listings yet
          <br/><button class="btn btnPrimary btnSm" onclick="openPostListingModal()" style="margin-top:10px">+ Post a Listing</button>
        </div>
      `;
      return;
    }

    renderMarketplaceListings(data, true);
  } catch (err) {
    console.error("Error loading my listings:", err);
    grid.innerHTML = `<div class="emptyState">❌ Error loading listings</div>`;
  }
}

// ============================================================================
// LOAD ANALYTICS DASHBOARD
// ============================================================================
async function loadMyListingsAnalytics() {
  const grid = $("mkGrid");
  if (!grid) return;

  grid.innerHTML = '<div class="emptyState">Loading...</div>';

  if (!currentUser) {
    grid.innerHTML = '<div class="emptyState">🔐 Log in to view analytics</div>';
    return;
  }

  // Analytics is a VORTEX PRIME (VIP) perk.
  const membership = computeMembershipStatus(currentProfile || {});
  const isVip = membership.state === "trialing" || membership.state === "active";
  if (!isVip) {
    grid.innerHTML = `
      <div class="emptyState">
        👑 Analytics is a VIP feature
        <div class="itemMeta" style="margin-top:6px">See views, inquiries, and your top-performing listing in one place.</div>
        <button class="btn btnPrimary btnSm" id="mkAnalyticsUpgradeBtn" style="margin-top:12px">Upgrade to VIP</button>
      </div>
    `;
    $("mkAnalyticsUpgradeBtn")?.addEventListener("click", () => setActiveView("vip"));
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("marketplace_listings")
      .select("*")
      .eq("posted_by", currentUser.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      grid.innerHTML = `
        <div class="emptyState">
          📊 No listings to analyze
          <br/><button class="btn btnPrimary btnSm" onclick="openPostListingModal()" style="margin-top:10px">+ Post a Listing</button>
        </div>
      `;
      return;
    }

    const totalViews = data.reduce((sum, l) => sum + (l.view_count || 0), 0);
    const totalInquiries = data.reduce((sum, l) => sum + (l.inquiries_count || 0), 0);
    const totalListings = data.length;
    const avgViewsPerListing = totalListings > 0 ? Math.round(totalViews / totalListings) : 0;
    const topListing = data.sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0];

    grid.innerHTML = `
      <div class="mkAnalyticsDashboard">
        <div class="mkAnalyticsSummary">
          <div class="mkAnalyticsStat">
            <div class="mkAnalyticsValue">${totalListings}</div>
            <div class="mkAnalyticsLabel">Active Listings</div>
          </div>
          <div class="mkAnalyticsStat">
            <div class="mkAnalyticsValue">${totalViews.toLocaleString()}</div>
            <div class="mkAnalyticsLabel">Total Views</div>
          </div>
          <div class="mkAnalyticsStat">
            <div class="mkAnalyticsValue">${avgViewsPerListing}</div>
            <div class="mkAnalyticsLabel">Avg Views/Listing</div>
          </div>
          <div class="mkAnalyticsStat">
            <div class="mkAnalyticsValue">${totalInquiries.toLocaleString()}</div>
            <div class="mkAnalyticsLabel">Total Inquiries</div>
          </div>
        </div>

        <div class="mkAnalyticsTopListing">
          <div class="mkAnalyticsLabel">🏆 Top Performer</div>
          ${topListing ? `
            <div class="mkAnalyticsListingCard">
              <div class="mkAnalyticsListingTitle">${escapeHtml(topListing.title)}</div>
              <div class="mkAnalyticsListingViews">👁️ ${topListing.view_count || 0} views</div>
              ${topListing.price ? `<div class="mkAnalyticsListingPrice">₱${Number(topListing.price).toLocaleString()}</div>` : ""}
              <div class="mkAnalyticsListingAge">${fmtDate(topListing.created_at)}</div>
            </div>
          ` : ""}
        </div>

        <div class="mkAnalyticsListings">
          <div class="mkAnalyticsLabel">All Your Listings</div>
          ${data.map(l => `
            <div class="mkAnalyticsListingItem">
              <div class="mkAnalyticsListingInfo">
                <div class="mkAnalyticsItemTitle">${escapeHtml(l.title)}${l.filled ? ' <span class="mkAnalyticsFilledTag">Filled</span>' : ""}</div>
                <div class="mkAnalyticsItemMeta">
                  ${l.price ? `₱${Number(l.price).toLocaleString()} • ` : ""}
                  ${fmtDate(l.created_at)}
                </div>
              </div>
              <div class="mkAnalyticsItemStats">
                <span>👁️ ${l.view_count || 0}</span>
                <span>📨 ${l.inquiries_count || 0}</span>
              </div>
            </div>
          `).join("")}
        </div>

        <div class="mkEarningsTracker">
          <div class="mkAnalyticsLabel">💵 Earnings Tracker <span class="mkEarningsHint">(manual notes — no payment processing)</span></div>
          ${data.map(l => `
            <div class="mkEarningsItem">
              <div class="mkEarningsTitle">${escapeHtml(l.title)}</div>
              <textarea class="mkEarningsInput" rows="2" data-mk-earnings-id="${l.id}" placeholder="e.g. Sold for ₱4,500 on July 20, paid via GCash">${escapeHtml(l.earnings_notes || "")}</textarea>
              <button class="btn btnGhost btnSm mkEarningsSaveBtn" data-mk-earnings-save="${l.id}">Save note</button>
            </div>
          `).join("")}
        </div>
      </div>
    `;

    grid.querySelectorAll("[data-mk-earnings-save]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const listingId = btn.dataset.mkEarningsSave;
        const textarea = grid.querySelector(`[data-mk-earnings-id="${listingId}"]`);
        if (!textarea) return;
        btn.disabled = true; btn.textContent = "Saving…";
        try {
          const { error } = await supabaseClient
            .from("marketplace_listings")
            .update({ earnings_notes: textarea.value.trim() || null })
            .eq("id", listingId)
            .eq("posted_by", currentUser.id);
          if (error) throw error;
          showToast("Earnings note saved");
        } catch (err) {
          console.error("Earnings note save error:", err);
          showToast("Could not save note");
        }
        btn.disabled = false; btn.textContent = "Save note";
      });
    });
  } catch (err) {
    console.error("Error loading analytics:", err);
    grid.innerHTML = `<div class="emptyState">❌ Error loading analytics</div>`;
  }
}

// ============================================================================
// INCREMENT LISTING VIEW COUNT
// ============================================================================
async function incrementListingViews(listingId) {
  try {
    const { data: listing, error: getError } = await supabaseClient
      .from("marketplace_listings")
      .select("view_count")
      .eq("id", listingId)
      .single();

    if (getError) throw getError;

    const newCount = (listing?.view_count || 0) + 1;

    const { error: updateError } = await supabaseClient
      .from("marketplace_listings")
      .update({ view_count: newCount })
      .eq("id", listingId);

    if (updateError) throw updateError;
  } catch (err) {
    console.error("Error incrementing view count:", err);
  }
}

async function openMarketplaceDetail(l) {
  if (!l) return;

  // 🎯 PHASE 5A: Track view
  incrementListingViews(l.id);
  // 🎯 pending #12: like/comment parity with videos
  let iLikeThis = false;
  if (currentUser) {
    const { data: myLike } = await supabaseClient.from("marketplace_likes").select("id").eq("listing_id", l.id).eq("user_id", currentUser.id).maybeSingle();
    iLikeThis = !!myLike;
  }
  const isJob = l.type === "job";
  const isMine = l.posted_by === (currentUser && currentUser.id);
  const typeIcon = l.type === "job" ? "&#128188;" : l.type === "service" ? "&#128295;" : "&#128717;";
  const condLabel = l.condition === "new" ? "Brand New" : l.condition === "used" ? "Used" : l.condition === "for parts" ? "For Parts" : (l.condition || "");
  const photos = l.photos && l.photos.length ? l.photos : [];
  const salary = isJob ? jobSalaryDisplay(l) : "";
  const priceDisplay = isJob ? (salary || "Salary negotiable") : (l.price ? "&#8369;" + Number(l.price).toLocaleString() : "Price negotiable");
  openModal(`
    <div class="modalTitle">${typeIcon} ${escapeHtml(l.title || "")} ${l.filled ? '<span class="mkDetailFilledTag">✅ Filled</span>' : ""}</div>
    ${photos.length ? `<div class="mkDetailPhotos">${photos.map(p => `<img loading="lazy" src="${escapeHtml(p)}" />`).join("")}</div>` : ""}
    <div class="mkDetailPrice">${priceDisplay}</div>
    ${isJob && l.work_type ? `<div class="mkDetailCond">${WORK_TYPE_LABEL[l.work_type] || escapeHtml(l.work_type)}</div>` : ""}
    ${isJob && l.experience_level ? `<div class="mkDetailCond">${EXP_LEVEL_LABEL[l.experience_level] || escapeHtml(l.experience_level)}</div>` : ""}
    ${!isJob && condLabel ? `<div class="mkDetailCond">${escapeHtml(condLabel)}</div>` : ""}
    <div class="itemMeta" style="margin:8px 0">${escapeHtml(l.description || "")}</div>
    ${l.location ? `<div class="itemMeta">&#128205; ${escapeHtml(l.location)}</div>` : ""}
    <div class="mkSellerRow" style="margin:10px 0 14px">
      <span class="mkSellerName">&#129489; ${nameLink(l.poster_name || "Seller", getUserVipRow(l.posted_by), l.posted_by)}</span>
      <span class="mkTime">${fmtDate(l.created_at)}</span>
    </div>
    ${isMine && isJob ? `<div class="itemMeta" style="margin-bottom:10px">&#128228; ${l.inquiries_count || 0} applicant${l.inquiries_count === 1 ? "" : "s"} so far</div>` : ""}
    <div class="timelineActions" style="margin-bottom:10px">
      <button class="timelineActionBtn ${iLikeThis ? "isActive" : ""}" id="mkLikeBtn">👍 ${iLikeThis ? "Liked" : "Like"} (${l.likes_count || 0})</button>
      <button class="timelineActionBtn" id="mkCommentBtn">💬 Comments (${l.comments_count || 0})</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${!isMine ? `<button class="btn btnPrimary" id="mkMsgSeller" style="flex:1">&#128172; ${isJob ? "Apply / Message" : "Message Seller"}</button>` : ""}
      ${isMine && isJob ? `<button class="btn ${l.filled ? "btnGhost" : "btnPrimary"}" id="mkToggleFilled" style="flex:1">${l.filled ? "↩️ Reopen Job" : "✅ Mark as Filled"}</button>` : ""}
      ${!isMine ? `<button class="btn btnGhost" id="mkReportListing" style="color:var(--danger)">&#128681; Report</button>` : `<button class="btn btnDanger btnSm" id="mkDeleteListing">Delete</button>`}
    </div>
    <button class="btn btnGhost btnSm" id="mkModalClose" style="width:100%;margin-top:8px">Close</button>
  `);
  $("mkModalClose").addEventListener("click", closeModal);
  $("mkLikeBtn").addEventListener("click", async () => {
    if (!currentUser) return;
    if (iLikeThis) {
      await supabaseClient.from("marketplace_likes").delete().eq("listing_id", l.id).eq("user_id", currentUser.id);
    } else {
      const { error } = await supabaseClient.from("marketplace_likes").insert({ listing_id: l.id, user_id: currentUser.id });
      if (!error && l.posted_by) {
        createNotification({ user_id: l.posted_by, type: "post_liked", title: `${currentProfile?.full_name || "Someone"} liked your listing`, body: l.title || null });
      }
    }
    const { data: fresh } = await supabaseClient.from("marketplace_listings").select("*").eq("id", l.id).single();
    closeModal();
    openMarketplaceDetail(fresh || l);
  });
  $("mkCommentBtn").addEventListener("click", () => openMarketplaceCommentsModal(l));
  $("mkMsgSeller") && $("mkMsgSeller").addEventListener("click", async () => {
    if (isMine) { showToast("That is your own listing!"); return; }
    try { await supabaseClient.rpc("increment_listing_inquiries", { listing_id_input: l.id }); } catch (err) { console.error("Inquiry increment error:", err); }
    createNotification({
      user_id: l.posted_by, type: "marketplace_inquiry",
      title: `${currentProfile?.full_name || "Someone"} is interested in "${l.title}"`,
      body: isJob ? "They applied to your job listing." : "They messaged you about your listing.",
    });
    closeModal();
    setActiveView("chat");
    await createOrStartChat(l.posted_by);
  });
  $("mkToggleFilled") && $("mkToggleFilled").addEventListener("click", async () => {
    closeModal();
    await toggleJobFilled(l.id, !l.filled);
  });
  $("mkReportListing") && $("mkReportListing").addEventListener("click", () => {
    openModal(`
      <div class="modalTitle">&#128681; Report Listing</div>
      <div class="field"><label>Reason</label>
        <select id="mkReportReason">
          <option value="scam">Scam / Fraud</option>
          <option value="inappropriate">Inappropriate content</option>
          <option value="fake">Fake listing</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
        <button class="btn btnGhost" id="mkReportCancel">Cancel</button>
        <button class="btn btnDanger" id="mkReportSubmit">Report</button>
      </div>
    `);
    $("mkReportCancel").addEventListener("click", closeModal);
    $("mkReportSubmit").addEventListener("click", async () => {
      const reason = $("mkReportReason").value;
      await supabaseClient.from("marketplace_reports").insert({ listing_id: l.id, reporter_id: currentUser && currentUser.id, reason });
      // Mirror to unified admin queue
      await supabaseClient.from("user_reports").insert({
        reporter_id: currentUser?.id, reason, target_type: "listing", target_id: String(l.id), status: "pending"
      }).then(() => {}).catch(() => {});
      closeModal();
      showToast("Reported. Thank you!");
    });
  });
  $("mkDeleteListing") && $("mkDeleteListing").addEventListener("click", async () => {
    if (!confirm("Delete this listing?")) return;
    const { error } = await supabaseClient.from("marketplace_listings").delete().eq("id", l.id).eq("posted_by", currentUser.id);
    if (error) { showToast("Error: " + error.message); return; }
    closeModal();
    showToast("Listing deleted.");
    loadMarketplace();
  });
}

function openPostListingModal() {
  const membership = computeMembershipStatus(currentProfile || {});
  const isVip = membership.state === "trialing" || membership.state === "active";
  openModal(`
    <div class="modalTitle">&#128717; Post a Listing</div>
    <div class="field">
      <label>Type</label>
      <select id="listTypeInput">
        <option value="item">&#128717; Item for Sale</option>
        <option value="job">&#128188; Job / Hiring</option>
        <option value="service">&#128295; Service Offered</option>
      </select>
    </div>
    <div class="field"><label>Title</label><input type="text" id="listTitleInput" placeholder="e.g. iPhone 13 Pro, Video Editor Needed..." /></div>
    <div class="field" id="listPriceField"><label>Price / Budget (optional)</label><input type="number" id="listPriceInput" placeholder="e.g. 5000" /></div>
    <div class="field" id="listCondField">
      <label>Condition</label>
      <select id="listCondInput">
        <option value="new">Brand New</option>
        <option value="used" selected>Used</option>
        <option value="for parts">For Parts</option>
      </select>
    </div>
    <div class="field hidden" id="listJobFields">
      <label>Salary Range (PHP, optional)</label>
      <div class="mkPriceRange">
        <input type="number" id="listSalaryMinInput" placeholder="Min" min="0" />
        <span>—</span>
        <input type="number" id="listSalaryMaxInput" placeholder="Max" min="0" />
      </div>
      <label style="margin-top:10px">Work Type</label>
      <select id="listWorkTypeInput">
        <option value="">Not specified</option>
        <option value="remote">🏠 Remote</option>
        <option value="onsite">🏢 Onsite</option>
        <option value="hybrid">🔀 Hybrid</option>
      </select>
      <label style="margin-top:10px">Experience Level</label>
      <select id="listExpLevelInput">
        <option value="">Not specified</option>
        <option value="entry">Entry Level</option>
        <option value="mid">Mid Level</option>
        <option value="senior">Senior Level</option>
      </select>
    </div>
    <div class="field">
      <label>Description</label>
      <textarea id="listDescInput" rows="3" placeholder="Describe your listing..."></textarea>
      <button type="button" class="btn btnGhost btnSm hidden" id="btnGenerateJD" style="margin-top:6px">✨ Generate JD</button>
    </div>
    <div class="field"><label>Location (optional)</label><input type="text" id="listLocInput" placeholder="e.g. Batac, Ilocos Norte" /></div>
    <div class="field">
      <label>Photo (optional)</label>
      <div class="photoPickerWrap">
        <input type="file" id="listPhotoFile" accept="image/*" class="hidden" />
        <button type="button" class="btn btnGhost btnSm" id="btnPickListPhoto">📷 Choose photo</button>
        <span id="listPhotoName" style="font-size:12px;color:var(--muted);margin-left:8px"></span>
        <img loading="lazy" id="listPhotoPreview" class="hidden" style="width:100%;max-height:160px;object-fit:cover;border-radius:12px;margin-top:8px" />
      </div>
    </div>
    ${communityPickerFieldHtml("listCommunityInput")}
    <div class="field" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" id="listFeaturedInput" style="width:auto" ${isVip ? "" : "disabled"} />
      <label style="margin:0;display:flex;align-items:center;gap:6px">
        ⭐ Feature this listing ${isVip ? "" : `<span class="badge badgeVipNavy" style="font-size:10px">VIP only</span>`}
      </label>
    </div>
    ${!isVip ? `<div class="itemMeta" style="margin-top:-8px;margin-bottom:14px">Featured listings show at the top of the marketplace. <a href="#" id="listFeaturedUpsell">Upgrade to VIP →</a></div>` : ""}
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btnGhost" id="listCancel">Cancel</button>
      <button class="btn btnPrimary" id="listSubmit">Post Listing</button>
    </div>
  `);
  $("listFeaturedUpsell")?.addEventListener("click", (e) => { e.preventDefault(); closeModal(); setActiveView("vip"); });
  fillCommunityPickerOptions("listCommunityInput");
  $("listTypeInput").addEventListener("change", () => {
    const isJob = $("listTypeInput").value === "job";
    $("listCondField").classList.toggle("hidden", $("listTypeInput").value !== "item");
    $("listJobFields").classList.toggle("hidden", !isJob);
    $("listPriceField").classList.toggle("hidden", isJob);
    $("btnGenerateJD").classList.toggle("hidden", !isJob);
  });
  $("btnGenerateJD").addEventListener("click", async () => {
    const title = $("listTitleInput").value.trim();
    if (!title) { showToast("Add a job title first."); return; }
    const workType = $("listWorkTypeInput").value;
    const expLevel = $("listExpLevelInput").value;
    const btn = $("btnGenerateJD");
    btn.disabled = true; btn.textContent = "Generating…";
    try {
      const prompt = `Write a clear, professional job description for a listing on a community jobs board called VORTEXIA. ` +
        `Job title: "${title}".${workType ? ` Work type: ${workType}.` : ""}${expLevel ? ` Experience level: ${expLevel}.` : ""} ` +
        `Include a short overview, a few key responsibilities, and a few requirements. Keep it under 150 words, plain text, no markdown symbols.`;
      const { data, error } = await supabaseClient.functions.invoke("groq-ai", {
        body: { prompt, meta: { appName: "VORTEXIA", platform: "web", preferredLanguage: currentProfile?.language || "en" } },
      });
      if (error || !data?.text) throw error || new Error("No response");
      $("listDescInput").value = data.text.trim();
    } catch (err) {
      showToast("Could not generate a description right now — try again in a bit.");
    } finally {
      btn.disabled = false; btn.textContent = "✨ Generate JD";
    }
  });
  // Wire photo picker
  $("btnPickListPhoto").addEventListener("click", () => $("listPhotoFile").click());
  $("listPhotoFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    $("listPhotoName").textContent = file.name;
    const reader = new FileReader();
    reader.onload = ev => {
      $("listPhotoPreview").src = ev.target.result;
      $("listPhotoPreview").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  });

  $("listCancel").addEventListener("click", closeModal);
  $("listSubmit").addEventListener("click", async () => {
    if (!throttleAction("listSubmit", 4000)) return;
    const type = $("listTypeInput").value;
    const title = $("listTitleInput").value.trim();
    const price = $("listPriceInput").value.trim();
    const condition = $("listCondInput").value;
    const description = $("listDescInput").value.trim();
    const location = $("listLocInput").value.trim();
    const photoFile = $("listPhotoFile").files[0];
    const isJob = type === "job";
    const salaryMin = isJob ? $("listSalaryMinInput").value.trim() : "";
    const salaryMax = isJob ? $("listSalaryMaxInput").value.trim() : "";
    const workType = isJob ? $("listWorkTypeInput").value : "";
    const expLevel = isJob ? $("listExpLevelInput").value : "";
    if (!title || !description) {
      showToast("Please fill in title and description.");
      markFieldErrors([!title ? "listTitleInput" : null, !description ? "listDescInput" : null].filter(Boolean));
      return;
    }
    clearFieldErrors(["listTitleInput", "listDescInput"]);
    const mod = applyApprovalGate(moderateText(title + " " + description));

    let photoUrl = null;
    if (photoFile) {
      const btn = $("listSubmit");
      btn.disabled = true; btn.textContent = "Uploading…";
      photoUrl = await uploadProfileImage(photoFile, "marketplace");
      btn.disabled = false; btn.textContent = "Post Listing";
    }

    // Re-verify VIP status here (not just trust the disabled checkbox in the DOM) —
    // a non-VIP user could otherwise re-enable it via devtools.
    const membership = computeMembershipStatus(currentProfile || {});
    const isVip = membership.state === "trialing" || membership.state === "active";
    const wantsFeatured = isVip && $("listFeaturedInput").checked;

    const { error } = await supabaseClient.from("marketplace_listings").insert({
      title, description, type, condition,
      price: (!isJob && price) ? parseFloat(price) : null,
      location: location || null,
      photos: photoUrl ? [photoUrl] : [],
      posted_by: currentUser ? currentUser.id : null,
      poster_name: currentProfile ? currentProfile.full_name : "Seller",
      poster_avatar: currentProfile ? currentProfile.avatar_url : null,
      is_featured: wantsFeatured,
      flagged: mod.flagged, flag_reason: mod.reason,
      salary_min: salaryMin ? parseFloat(salaryMin) : null,
      salary_max: salaryMax ? parseFloat(salaryMax) : null,
      work_type: workType || null,
      experience_level: expLevel || null,
      community_id: $("listCommunityInput").value || null,
    });
    if (error) { showToast("Could not post: " + error.message); return; }
    closeModal();
    showToast(mod.flagged ? "Posted - pending review." : "Listing posted!");
    loadMarketplace();
    loadDashboardFeed();
  });
}
if ($("btnPostListing")) $("btnPostListing").addEventListener("click", openPostListingModal);
if ($("btnPostListingDash")) $("btnPostListingDash").addEventListener("click", openPostListingModal);

// ---------------------------------------------------------------------------
// Dashboard tiles — update values from already-loaded data
// ---------------------------------------------------------------------------
async function updateLatestUpdatesTile() {
  const valEl = $("tileLatestVal");
  const subEl = $("tileLatestSub");
  if (!valEl || !subEl) return;
  const { data, error } = await supabaseClient.from("feed_posts").select("title,created_at,pinned")
    .order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(1);
  if (error || !data || !data.length) {
    valEl.textContent = "No updates";
    subEl.textContent = "Check back soon";
    return;
  }
  const latest = data[0];
  valEl.textContent = latest.title && latest.title.length > 22 ? latest.title.slice(0, 22) + "…" : (latest.title || "Announcement");
  subEl.textContent = (latest.pinned ? "📌 Pinned · " : "") + fmtDate(latest.created_at);
}

function updateDashTiles() {
  // Meetings tile
  const upcoming = parseInt($("mUpcoming")?.textContent || "0", 10);
  if ($("tileMeetingVal")) $("tileMeetingVal").textContent = upcoming;
  if ($("tileMeetingSub")) {
    const firstItem = $("dashUpcomingList")?.querySelector(".itemTitle");
    $("tileMeetingSub").textContent = firstItem ? firstItem.textContent : "No meetings yet";
  }
  // Storage tile (reads from existing storageLabel)
  const storageLbl = $("storageLabel")?.textContent || "";
  if ($("tileStorageVal") && storageLbl) {
    const mbMatch = storageLbl.match(/([\d.]+)\s*MB/);
    $("tileStorageVal").textContent = mbMatch ? mbMatch[1] + " MB" : "0 MB";
  }
  // VIP tile
  const membership = computeMembershipStatus(currentProfile || {});
  if ($("tileVipVal")) $("tileVipVal").textContent = membership.badgeText || "Free";
  if ($("tileVipSub")) {
    if (membership.state === "trialing" || membership.state === "active") {
      $("tileVipSub").textContent = membership.detail || "Active";
    } else {
      $("tileVipSub").textContent = "Tap to upgrade ↗";
    }
  }
  // Online friends tile
  if ($("tileOnlineVal")) {
    const count = Object.values(communityVipCache || {}).filter(r => r.is_online).length;
    $("tileOnlineVal").textContent = count > 0 ? count : "—";
  }
}

// Tile tap handlers
const tileLatest = $("tileLatest");
if (tileLatest) tileLatest.addEventListener("click", () => {
  setActiveView("more");
  const feedSubBtn = document.querySelector('#moreSubTabs .subTabBtn[data-sub="feed"]');
  if (feedSubBtn) feedSubBtn.click();
});
const tileMeetings = $("tileMeetings");
if (tileMeetings) tileMeetings.addEventListener("click", () => setActiveView("meetings"));
const tileVip = $("tileVip");
if (tileVip) tileVip.addEventListener("click", () => setActiveView("vip"));
const tileQuickJoin = $("tileQuickJoin");
if (tileQuickJoin) tileQuickJoin.addEventListener("click", () => $("qaInstant")?.click());

// ---------------------------------------------------------------------------
// Dashboard feed — tab switching (For You / Popular / Latest / Following)
// ---------------------------------------------------------------------------
let dashFeedActiveTab = "foryou";

const dashFeedTabsEl = $("dashFeedTabs");
if (dashFeedTabsEl) {
  dashFeedTabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".dashFeedTab");
    if (!btn) return;
    dashFeedTabsEl.querySelectorAll(".dashFeedTab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    dashFeedActiveTab = btn.dataset.feedtab;
    loadDashboardFeed();
  });
}

// ---------------------------------------------------------------------------
// Workspace scaffold — video upload + list
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Phase 6: deeper Groq moderation pass + client-side auto-thumbnail for videos
// ---------------------------------------------------------------------------

// Groq-backed deep content check — catches things the local keyword blocklist
// (moderateText()) misses (scams, harassment, nuanced abuse, etc). Fails OPEN:
// if the AI call errors or returns something unparseable, we return null and the
// caller falls back to the local blocklist result instead of blocking the upload.
async function deepModerateVideo(title, description) {
  try {
    const prompt = `You are a content moderator for a community platform called VORTEXIA. ` +
      `Review the following video's title and description for policy violations: harassment, ` +
      `hate speech, scams or fraud, sexual content, graphic violence, or other harmful content. ` +
      `Respond with ONLY a raw JSON object (no markdown, no code fences, no extra text) in exactly ` +
      `this shape: {"flagged": true or false, "reason": "short reason" or null}.\n\n` +
      `Title: ${title}\nDescription: ${description || "(none)"}`;
    const { data, error } = await supabaseClient.functions.invoke("groq-ai", {
      body: { prompt, meta: { appName: "VORTEXIA", platform: "web", preferredLanguage: currentProfile?.language || "en" } },
    });
    if (error || !data?.text) return null;
    const clean = data.text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return { flagged: !!parsed.flagged, reason: parsed.reason || null };
  } catch (err) {
    console.warn("deepModerateVideo failed (falling back to local check):", err);
    return null;
  }
}

// Captures a frame from the chosen video file client-side (no server transcoding
// needed) and returns it as a JPEG Blob, or null if capture isn't possible. Never
// throws — thumbnail generation is best-effort and must never block an upload.
function captureVideoThumbnail(file) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
    try {
      const videoEl = document.createElement("video");
      videoEl.preload = "metadata";
      videoEl.muted = true;
      videoEl.playsInline = true;
      const objectUrl = URL.createObjectURL(file);
      videoEl.src = objectUrl;
      const cleanup = () => { try { URL.revokeObjectURL(objectUrl); } catch (e) {} };
      videoEl.addEventListener("loadedmetadata", () => {
        const seekTime = Math.min(2, (videoEl.duration || 2) * 0.25);
        try { videoEl.currentTime = seekTime; } catch (e) { finish(null); cleanup(); }
      });
      videoEl.addEventListener("seeked", () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = videoEl.videoWidth || 320;
          canvas.height = videoEl.videoHeight || 180;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => { cleanup(); finish(blob || null); }, "image/jpeg", 0.8);
        } catch (e) { cleanup(); finish(null); }
      });
      videoEl.addEventListener("error", () => { cleanup(); finish(null); });
      setTimeout(() => { cleanup(); finish(null); }, 8000); // safety net
    } catch (e) { finish(null); }
  });
}

// ---------------------------------------------------------------------------
// Phase 7B: AI Writing Assistant — "✨ Improve this" for chat + forum drafts.
// Reusable: pass the current draft text and a callback that applies the
// accepted result back into whichever input/textarea called it.
// ---------------------------------------------------------------------------
async function openAiImproveModal(originalText, onAccept) {
  if (!originalText || !originalText.trim()) { showToast("Type something first."); return; }
  openModal(`
    <div class="modalTitle">✨ Improve this</div>
    <div class="itemMeta" style="margin-bottom:6px">Original</div>
    <div style="white-space:pre-wrap;background:var(--panel2);border-radius:10px;padding:10px;font-size:13px;margin-bottom:12px">${escapeHtml(originalText)}</div>
    <div class="itemMeta" style="margin-bottom:6px">Suggested</div>
    <div id="aiImproveResult" style="white-space:pre-wrap;background:var(--panel2);border-radius:10px;padding:10px;font-size:13px;min-height:40px">Generating…</div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btnGhost" id="aiImproveDismiss">Dismiss</button>
      <button class="btn btnPrimary" id="aiImproveAccept" disabled>Use this</button>
    </div>
  `);
  $("aiImproveDismiss").addEventListener("click", closeModal);
  let improvedText = null;
  try {
    const prompt = `Improve the writing of this draft for a community platform called VORTEXIA. ` +
      `Keep the same language, meaning, and intent — just make it clearer, better organized, and more polished. ` +
      `Respond with ONLY the improved text, no preamble, no quotes, no markdown.\n\nDraft:\n${originalText}`;
    const { data, error } = await supabaseClient.functions.invoke("groq-ai", {
      body: { prompt, meta: { appName: "VORTEXIA", platform: "web", preferredLanguage: currentProfile?.language || "en" } },
    });
    if (error || !data?.text) throw error || new Error("No response");
    improvedText = data.text.trim();
    $("aiImproveResult").textContent = improvedText;
    $("aiImproveAccept").disabled = false;
  } catch (err) {
    $("aiImproveResult").textContent = "Could not generate a suggestion right now — try again in a bit.";
  }
  $("aiImproveAccept").addEventListener("click", () => {
    if (improvedText) onAccept(improvedText);
    closeModal();
  });
}

let wsActiveTab = "your-videos";

const wsTabsEl = $("wsTabs");
if (wsTabsEl) {
  wsTabsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".subTabBtn");
    if (!btn) return;
    wsTabsEl.querySelectorAll(".subTabBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    wsActiveTab = btn.dataset.wstab;
    loadWorkspace();
  });
}

const btnUploadVideo = $("btnUploadVideo");
if (btnUploadVideo) btnUploadVideo.addEventListener("click", () => $("videoFileInput")?.click());

const videoFileInput = $("videoFileInput");
if (videoFileInput) {
  videoFileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("video/")) { showToast("Please choose a video file."); return; }
    if (file.size > 500 * 1024 * 1024) { showToast("Video too large — max 500 MB."); return; }
    openModal(`
      <div class="modalTitle">🎬 Upload Video</div>
      <div class="field"><label>Title</label><input type="text" id="vidTitleInput" placeholder="Give your video a title" /></div>
      <div class="field"><label>Description</label><textarea id="vidDescInput" rows="3" placeholder="What's this video about?"></textarea></div>
      <div class="field"><label>Tags (comma separated)</label><input type="text" id="vidTagsInput" placeholder="e.g. tutorial, vlog, coding" /></div>
      <div class="field" style="display:flex;align-items:center;gap:10px">
        <input type="checkbox" id="vidAllowDownload" style="width:20px;height:20px;accent-color:var(--navy)" />
        <label for="vidAllowDownload" style="margin:0;font-weight:600">Allow download</label>
      </div>
      <div class="field" style="display:flex;align-items:center;gap:10px">
        <input type="checkbox" id="vidSaveDraft" style="width:20px;height:20px;accent-color:var(--navy)" />
        <label for="vidSaveDraft" style="margin:0;font-weight:600">Save as draft (only you can see it until you publish)</label>
      </div>
      <div class="itemMeta" id="vidUploadProgress" style="margin-top:8px"></div>
      ${communityPickerFieldHtml("vidCommunityInput")}
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
        <button class="btn btnGhost" id="vidCancel">Cancel</button>
        <button class="btn btnPrimary" id="vidSubmit">Upload</button>
      </div>
    `);
    fillCommunityPickerOptions("vidCommunityInput");
    $("vidCancel").addEventListener("click", () => { closeModal(); });
    $("vidSubmit").addEventListener("click", async () => {
      if (!throttleAction("vidSubmit", 4000)) return;
      const title = $("vidTitleInput").value.trim();
      const desc = $("vidDescInput").value.trim();
      const tags = $("vidTagsInput").value.split(",").map(t => t.trim()).filter(Boolean);
      const allowDownload = $("vidAllowDownload").checked;
      const saveDraft = $("vidSaveDraft").checked;
      if (!title) { showToast("Please add a title."); return; }
      const btn = $("vidSubmit");
      btn.disabled = true; btn.textContent = "Checking…";

      // Pass 1: instant local keyword check. Pass 2 (only if pass 1 is clean):
      // deeper Groq review that catches nuance the blocklist can't (scams,
      // harassment, etc). Either way this SOFT-flags (same pattern as forum
      // posts / marketplace listings) instead of blocking the upload outright —
      // flagged videos stay visible to their owner ("Under review") and hidden
      // from everyone else until reviewed.
      const quickMod = moderateText(title + " " + desc);
      let finalMod = quickMod;
      if (!quickMod.flagged) {
        $("vidUploadProgress").textContent = "Running content check…";
        const deepMod = await deepModerateVideo(title, desc);
        if (deepMod) finalMod = deepMod;
      }
      finalMod = applyApprovalGate(finalMod);

      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      btn.textContent = "Uploading…";
      $("vidUploadProgress").textContent = `Uploading ${sizeMB} MB — please keep this open…`;
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${currentUser.id}/videos/${Date.now()}.${ext}`;
      const { error: upErr } = await supabaseClient.storage.from("videos").upload(path, file, { upsert: false });
      if (upErr) { showToast("Upload failed: " + upErr.message); btn.disabled = false; btn.textContent = "Upload"; return; }

      // Best-effort auto-thumbnail — never blocks the upload if it fails.
      $("vidUploadProgress").textContent = "Generating thumbnail…";
      let thumbnailUrl = null;
      try {
        const thumbBlob = await captureVideoThumbnail(file);
        if (thumbBlob) {
          const thumbPath = `${currentUser.id}/video-thumbnails/${Date.now()}.jpg`;
          const { error: thumbErr } = await supabaseClient.storage
            .from("assets")
            .upload(thumbPath, thumbBlob, { upsert: true, contentType: "image/jpeg" });
          if (!thumbErr) {
            const { data: thumbUrlData } = supabaseClient.storage.from("assets").getPublicUrl(thumbPath);
            thumbnailUrl = thumbUrlData.publicUrl;
          }
        }
      } catch (e) { console.warn("Thumbnail generation failed:", e); }

      const { error: dbErr } = await supabaseClient.from("videos").insert({
        uploaded_by: currentUser.id,
        uploader_name: currentProfile?.full_name || "Creator",
        uploader_avatar: currentProfile?.avatar_url || null,
        title, description: desc, tags,
        file_path: path, thumbnail_url: thumbnailUrl, allow_download: allowDownload,
        view_count: 0, likes_count: 0, is_draft: saveDraft, is_pinned: false,
        flagged: finalMod.flagged, flag_reason: finalMod.reason,
        community_id: $("vidCommunityInput").value || null,
      });
      if (dbErr) {
        showToast("Could not save video info: " + dbErr.message);
        btn.disabled = false; btn.textContent = "Upload";
        return;
      }
      closeModal();
      showToast(saveDraft ? "💾 Saved as draft." : (finalMod.flagged ? "Posted - pending review." : "🎬 Video uploaded!"));
      loadWorkspace();
    });
  });
}

let wsSortMode = "recent";

async function loadWorkspace() {
  const list = $("wsVideoList");
  const tiles = $("wsVideoTiles");
  const sortRow = $("wsSortRow");
  const reels = $("wsVideoReels");
  if (!list || !tiles || !currentUser) return;

  if (wsActiveTab === "your-videos") {
    teardownReelsObserver();
    reels?.classList.add("hidden");
    list.classList.add("hidden");
    tiles.classList.remove("hidden");
    sortRow.classList.remove("hidden");
    tiles.innerHTML = `<div class="emptyState">Loading…</div>`;

    const { data, error } = await supabaseClient.from("videos")
      .select("*").eq("uploaded_by", currentUser.id).order("created_at", { ascending: false });
    if (error || !data || !data.length) {
      tiles.innerHTML = "";
      tiles.classList.add("hidden");
      list.classList.remove("hidden");
      list.innerHTML = `<div class="emptyState">No videos yet — tap <strong>+ Upload</strong> to share your first video!</div>`;
      return;
    }

    // Sort: pinned always float first when "Pinned first" is picked; otherwise
    // plain recency or view count.
    let sorted = [...data];
    if (wsSortMode === "views") sorted.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    else if (wsSortMode === "pinned") sorted.sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0) || new Date(b.created_at) - new Date(a.created_at));
    else sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    tiles.innerHTML = sorted.map(v => `
      <div class="wsTile" data-vid-id="${v.id}">
        ${v.thumbnail_url ? `<img loading="lazy" src="${escapeHtml(v.thumbnail_url)}" alt="" />` : `<div class="wsVideoThumbPlaceholder">🎬</div>`}
        ${v.is_draft ? `<span class="wsTileBadge wsTileBadge--draft">Draft</span>`
          : v.flagged ? `<span class="wsTileBadge wsTileBadge--review">Review</span>`
          : v.is_pinned ? `<span class="wsTileBadge wsTileBadge--pinned">📌 Pinned</span>` : ""}
        <button class="wsTilePinBtn" data-pin-toggle="${v.id}" title="${v.is_pinned ? "Unpin" : "Pin"}">${v.is_pinned ? "📌" : "📍"}</button>
        <div class="wsTileStats">👁 ${v.view_count || 0}</div>
      </div>`).join("");

    tiles.querySelectorAll("[data-vid-id]").forEach(card => {
      card.addEventListener("click", (e) => {
        if (e.target.closest("[data-pin-toggle]")) return;
        const vid = sorted.find(v => v.id === card.dataset.vidId);
        if (vid) openVideoPlayer(vid, true);
      });
    });
    tiles.querySelectorAll("[data-pin-toggle]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const vid = sorted.find(v => v.id === btn.dataset.pinToggle);
        if (!vid) return;
        const { error: pinErr } = await supabaseClient.from("videos").update({ is_pinned: !vid.is_pinned }).eq("id", vid.id);
        if (pinErr) { showToast("Could not update pin: " + pinErr.message); return; }
        showToast(vid.is_pinned ? "Unpinned." : "📌 Pinned to top.");
        loadWorkspace();
      });
    });

  } else {
    tiles.classList.add("hidden");
    list.classList.add("hidden");
    sortRow.classList.add("hidden");
    reels.classList.remove("hidden");
    reels.querySelector("#reelsScroller").innerHTML = `<div class="reelsEmptyState">Loading…</div>`;

    // "For You" — a real ranking algorithm instead of a plain views sort:
    // score = views + (likes weighted 3x) with a recency boost that decays
    // over ~14 days, so a fresh video with a handful of likes can still beat
    // an old video coasting on historical views. Pulls from ALL public
    // videos (not just people you follow) — that's what makes it "For You"
    // rather than just "Following".
    const { data: rawData, error } = await supabaseClient.from("videos")
      .select("*").eq("is_draft", false).order("created_at", { ascending: false }).limit(200);
    const now = Date.now();
    const data = (rawData || [])
      .filter(v => !v.flagged || v.uploaded_by === currentUser.id)
      .map(v => {
        const ageDays = Math.max(0, (now - new Date(v.created_at).getTime()) / 86400000);
        const recencyBoost = Math.max(0, 14 - ageDays) * 8; // fresh videos get a fading head start
        const score = (v.view_count || 0) + (v.likes_count || 0) * 3 + recencyBoost;
        return { ...v, _score: score };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, 30);

    if (error || !data.length) {
      reels.querySelector("#reelsScroller").innerHTML = `<div class="reelsEmptyState">No videos yet — check back soon!</div>`;
      return;
    }
    await renderVideoReels(data);
  }
}

// ============================================================
// TikTok-style vertical reel feed (Workspace > Feed)
// ============================================================
let reelsObserver = null;
let reelsViewedIds = new Set(); // avoid double-counting views per session

function teardownReelsObserver() {
  if (reelsObserver) { reelsObserver.disconnect(); reelsObserver = null; }
  // Pause any playing reel videos so they don't keep running in the background hidden tab.
  document.querySelectorAll("#reelsScroller video").forEach(v => { try { v.pause(); } catch (e) {} });
}

// Fully closes the reels feed and resets Workspace back to the Your Videos
// tab. Safe to call even if the reels feed isn't currently open.
function closeReelsFeed() {
  const reelsEl = $("wsVideoReels");
  if (!reelsEl || reelsEl.classList.contains("hidden")) return;
  teardownReelsObserver();
  reelsEl.classList.add("hidden");
  wsActiveTab = "your-videos";
  const wsTabsElLocal = $("wsTabs");
  wsTabsElLocal?.querySelectorAll(".subTabBtn").forEach(b => b.classList.toggle("active", b.dataset.wstab === "your-videos"));
}

async function renderVideoReels(data) {
  const scroller = $("reelsScroller");
  if (!scroller) return;

  const vidIds = data.map(v => v.id);
  const [{ data: likeRows }, { data: saveRows }] = await Promise.all([
    supabaseClient.from("video_likes").select("video_id").eq("user_id", currentUser.id).in("video_id", vidIds),
    supabaseClient.from("saved_videos").select("video_id").eq("user_id", currentUser.id).in("video_id", vidIds),
  ]);
  const myLikes = new Set((likeRows || []).map(r => r.video_id));
  const mySaves = new Set((saveRows || []).map(r => r.video_id));

  scroller.innerHTML = data.map(v => {
    const { data: urlData } = supabaseClient.storage.from("videos").getPublicUrl(v.file_path);
    const videoUrl = urlData?.publicUrl || "";
    const liked = myLikes.has(v.id);
    const saved = mySaves.has(v.id);
    return `
      <div class="reelSlide" data-reel-id="${v.id}">
        <video src="${escapeHtml(videoUrl)}" loop muted playsinline preload="metadata" data-reel-video="${v.id}"></video>
        <div class="reelGradientBottom"></div>
        ${v.is_draft ? `<span class="reelDraftBadge">Draft</span>` : ""}
        <button class="reelMuteBtn" data-reel-mute="${v.id}">🔇</button>
        <div class="reelInfo">
          <div class="reelAuthor">${nameLink(v.uploader_name || "Creator", getUserVipRow(v.uploaded_by), v.uploaded_by)}</div>
          <div class="reelTitle">${escapeHtml(v.title)}</div>
          ${v.description ? `<div class="reelDesc">${escapeHtml(v.description)}</div>` : ""}
        </div>
        <div class="reelActionRail">
          <button class="reelActionBtn ${liked ? "isActive" : ""}" data-reel-like="${v.id}">
            <span class="reelActionIcon">${liked ? "❤️" : "🤍"}</span>
            <span class="reelActionCount" data-reel-like-count="${v.id}">${v.likes_count || 0}</span>
          </button>
          <button class="reelActionBtn" data-reel-comment="${v.id}">
            <span class="reelActionIcon">💬</span>
            <span class="reelActionCount">Comment</span>
          </button>
          <button class="reelActionBtn" data-reel-share="${v.id}">
            <span class="reelActionIcon">↗️</span>
            <span class="reelActionCount">Share</span>
          </button>
          <button class="reelActionBtn ${saved ? "isSavedActive" : ""}" data-reel-save="${v.id}">
            <span class="reelActionIcon">${saved ? "🔖" : "📑"}</span>
            <span class="reelActionCount">Save</span>
          </button>
        </div>
      </div>`;
  }).join("");

  // Tap video to toggle play/pause; tap mute button to toggle sound.
  scroller.querySelectorAll("video[data-reel-video]").forEach(videoEl => {
    videoEl.addEventListener("click", () => {
      if (videoEl.paused) videoEl.play().catch(() => {}); else videoEl.pause();
    });
  });
  scroller.querySelectorAll("[data-reel-mute]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const videoEl = scroller.querySelector(`video[data-reel-video="${btn.dataset.reelMute}"]`);
      if (!videoEl) return;
      videoEl.muted = !videoEl.muted;
      btn.textContent = videoEl.muted ? "🔇" : "🔊";
    });
  });

  scroller.querySelectorAll("[data-reel-like]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const videoId = btn.dataset.reelLike;
      const v = data.find(x => x.id === videoId);
      const icon = btn.querySelector(".reelActionIcon");
      const countEl = btn.querySelector(`[data-reel-like-count="${videoId}"]`);
      const isLiked = btn.classList.contains("isActive");
      if (isLiked) {
        await supabaseClient.from("video_likes").delete().eq("video_id", videoId).eq("user_id", currentUser.id);
        btn.classList.remove("isActive");
        icon.textContent = "🤍";
        if (countEl) countEl.textContent = Math.max((v.likes_count || 1) - 1, 0);
        if (v) v.likes_count = Math.max((v.likes_count || 1) - 1, 0);
      } else {
        const { error } = await supabaseClient.from("video_likes").insert({ video_id: videoId, user_id: currentUser.id });
        if (error) { showToast("Could not like: " + error.message); return; }
        btn.classList.add("isActive");
        icon.textContent = "❤️";
        if (countEl) countEl.textContent = (v.likes_count || 0) + 1;
        if (v) v.likes_count = (v.likes_count || 0) + 1;
        if (v?.uploaded_by) createNotification({ user_id: v.uploaded_by, type: "post_liked", title: `${currentProfile?.full_name || "Someone"} liked your video`, body: v.title || null });
      }
    });
  });

  scroller.querySelectorAll("[data-reel-comment]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const v = data.find(x => x.id === btn.dataset.reelComment);
      if (v) openVideoCommentsModal(v);
    });
  });

  scroller.querySelectorAll("[data-reel-share]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const url = `${location.origin}${location.pathname}?video=${encodeURIComponent(btn.dataset.reelShare)}`;
      try { await navigator.clipboard.writeText(url); showToast("Link copied!"); }
      catch (err) { showToast(url); }
    });
  });

  scroller.querySelectorAll("[data-reel-save]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const videoId = btn.dataset.reelSave;
      const icon = btn.querySelector(".reelActionIcon");
      const isSaved = btn.classList.contains("isSavedActive");
      if (isSaved) {
        const { error } = await supabaseClient.from("saved_videos").delete().eq("video_id", videoId).eq("user_id", currentUser.id);
        if (error) { showToast("Could not unsave: " + error.message); return; }
        btn.classList.remove("isSavedActive");
        icon.textContent = "📑";
        showToast("Removed from saved");
      } else {
        const { error } = await supabaseClient.from("saved_videos").insert({ video_id: videoId, user_id: currentUser.id });
        if (error) { showToast("Could not save: " + error.message); return; }
        btn.classList.add("isSavedActive");
        icon.textContent = "🔖";
        showToast("Saved 🔖");
      }
    });
  });

  // Autoplay whichever slide is (mostly) in view; pause everything else.
  // This is what gives the swipe-and-it-just-plays TikTok feel.
  teardownReelsObserver();
  reelsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const videoEl = entry.target.querySelector("video[data-reel-video]");
      if (!videoEl) return;
      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        videoEl.play().catch(() => {});
        const vid = videoEl.dataset.reelVideo;
        if (vid && !reelsViewedIds.has(vid)) {
          reelsViewedIds.add(vid);
          supabaseClient.rpc("increment_video_views", { p_video_id: vid }).catch(() => {});
        }
      } else {
        videoEl.pause();
      }
    });
  }, { threshold: [0, 0.6, 1] });
  scroller.querySelectorAll(".reelSlide").forEach(slide => reelsObserver.observe(slide));
}

document.addEventListener("click", (e) => {
  if (e.target.closest("#reelsCloseBtn")) {
    closeReelsFeed();
    loadWorkspace();
  }
});

const wsSortSelectEl = $("wsSortSelect");
if (wsSortSelectEl) {
  wsSortSelectEl.addEventListener("change", () => { wsSortMode = wsSortSelectEl.value; loadWorkspace(); });
}

function openVideoPlayer(v, isOwnerContext = false) {
  const { data: urlData } = supabaseClient.storage.from("videos").getPublicUrl(v.file_path);
  const videoUrl = urlData?.publicUrl || "";
  // Increment view count (fire and forget) — skip for your own drafts, no
  // point inflating your own view count by previewing an unpublished video.
  if (!(isOwnerContext && v.is_draft)) {
    supabaseClient.rpc("increment_video_views", { p_video_id: v.id }).catch(() => {});
  }
  openModal(`
    <div class="modalTitle">${escapeHtml(v.title)}${v.is_draft ? ` <span class="badge" style="background:rgba(0,0,0,.5);color:#fff;font-size:10px">Draft</span>` : ""}</div>
    <video class="wsVideoPlayer" controls ${v.allow_download ? "" : "controlsList=\"nodownload\""} style="-webkit-tap-highlight-color:transparent">
      <source src="${escapeHtml(videoUrl)}" />Your browser does not support video.
    </video>
    <div class="itemMeta" style="margin:10px 0 4px">${escapeHtml(v.description || "")}</div>
    <div class="itemMeta">👁 ${v.view_count || 0} views • ❤️ ${v.likes_count || 0} likes</div>
    ${v.tags?.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${v.tags.map(t => `<span class="badge" style="background:var(--panel2);color:var(--navy)">#${escapeHtml(t)}</span>`).join("")}</div>` : ""}
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;flex-wrap:wrap">
      ${isOwnerContext && v.is_draft ? `<button class="btn btnPrimary btnSm" id="btnPublishDraft">📤 Publish</button>` : ""}
      ${isOwnerContext ? `<button class="btn btnGhost btnSm" id="btnTogglePinModal">${v.is_pinned ? "Unpin" : "📌 Pin to top"}</button>` : ""}
      ${isOwnerContext ? `<button class="btn btnGhost btnSm" id="btnEditVideoModal">✏️ Edit</button>` : ""}
      ${v.allow_download ? `<a class="btn btnGhost btnSm" href="${escapeHtml(videoUrl)}" download>⬇ Download</a>` : ""}
      ${isOwnerContext ? `<button class="btn btnDanger btnSm" id="btnDeleteVideoModal">🗑️ Delete</button>` : ""}
      <button class="btn btnGhost" id="modalCancel">Close</button>
    </div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  $("btnPublishDraft")?.addEventListener("click", async () => {
    const { error } = await supabaseClient.from("videos").update({ is_draft: false }).eq("id", v.id);
    if (error) { showToast("Could not publish: " + error.message); return; }
    showToast("🎬 Published!");
    closeModal();
    loadWorkspace();
  });
  $("btnTogglePinModal")?.addEventListener("click", async () => {
    const { error } = await supabaseClient.from("videos").update({ is_pinned: !v.is_pinned }).eq("id", v.id);
    if (error) { showToast("Could not update pin: " + error.message); return; }
    showToast(v.is_pinned ? "Unpinned." : "📌 Pinned to top.");
    closeModal();
    loadWorkspace();
  });
  $("btnEditVideoModal")?.addEventListener("click", () => { closeModal(); openEditVideoModal(v); });
  $("btnDeleteVideoModal")?.addEventListener("click", () => { openDeleteVideoConfirm(v); });
}

// Edit metadata on an already-uploaded video (title/description/tags/allow
// download). Does not touch the underlying file — re-uploading a new file
// is out of scope here, this is just fixing a typo or updating info.
function openEditVideoModal(v) {
  openModal(`
    <div class="modalTitle">✏️ Edit Video</div>
    <div class="field"><label>Title</label><input type="text" id="vidEditTitleInput" value="${escapeHtml(v.title || "")}" /></div>
    <div class="field"><label>Description</label><textarea id="vidEditDescInput" rows="3">${escapeHtml(v.description || "")}</textarea></div>
    <div class="field"><label>Tags (comma separated)</label><input type="text" id="vidEditTagsInput" value="${escapeHtml((v.tags || []).join(", "))}" /></div>
    <div class="field" style="display:flex;align-items:center;gap:10px">
      <input type="checkbox" id="vidEditAllowDownload" style="width:20px;height:20px;accent-color:var(--navy)" ${v.allow_download ? "checked" : ""} />
      <label for="vidEditAllowDownload" style="margin:0;font-weight:600">Allow download</label>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btnGhost" id="vidEditCancel">Cancel</button>
      <button class="btn btnPrimary" id="vidEditSave">Save</button>
    </div>
  `);
  $("vidEditCancel").addEventListener("click", closeModal);
  $("vidEditSave").addEventListener("click", async () => {
    const title = $("vidEditTitleInput").value.trim();
    if (!title) { showToast("Please add a title."); return; }
    const desc = $("vidEditDescInput").value.trim();
    const tags = $("vidEditTagsInput").value.split(",").map(t => t.trim()).filter(Boolean);
    const allowDownload = $("vidEditAllowDownload").checked;
    const btn = $("vidEditSave");
    btn.disabled = true; btn.textContent = "Saving…";
    const { error } = await supabaseClient.from("videos")
      .update({ title, description: desc, tags, allow_download: allowDownload })
      .eq("id", v.id);
    if (error) { showToast("Could not save: " + error.message); btn.disabled = false; btn.textContent = "Save"; return; }
    showToast("✅ Video updated.");
    closeModal();
    loadWorkspace();
  });
}

// Confirm + delete a video: removes the DB row, the video file, and the
// generated thumbnail (best-effort — a missing storage file shouldn't block
// the DB row from being removed since that's what actually makes it disappear
// from the owner's list and the public Feed).
function openDeleteVideoConfirm(v) {
  openModal(`
    <div class="modalTitle">🗑️ Delete this video?</div>
    <div class="itemMeta" style="margin-bottom:14px">This can't be undone. "${escapeHtml(v.title || "")}" will be permanently removed, including its likes and comments.</div>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button class="btn btnGhost" id="vidDeleteCancel">Cancel</button>
      <button class="btn btnDanger" id="vidDeleteConfirm">Delete</button>
    </div>
  `);
  $("vidDeleteCancel").addEventListener("click", closeModal);
  $("vidDeleteConfirm").addEventListener("click", async () => {
    const btn = $("vidDeleteConfirm");
    btn.disabled = true; btn.textContent = "Deleting…";
    const { error: dbErr } = await supabaseClient.from("videos").delete().eq("id", v.id).eq("uploaded_by", currentUser.id);
    if (dbErr) { showToast("Could not delete: " + dbErr.message); btn.disabled = false; btn.textContent = "Delete"; return; }
    try { await supabaseClient.storage.from("videos").remove([v.file_path]); } catch (e) { console.warn("Video file cleanup failed:", e); }
    if (v.thumbnail_url) {
      try {
        const thumbPath = v.thumbnail_url.split("/assets/").pop();
        if (thumbPath) await supabaseClient.storage.from("assets").remove([decodeURIComponent(thumbPath)]);
      } catch (e) { console.warn("Thumbnail cleanup failed:", e); }
    }
    showToast("🗑️ Video deleted.");
    closeModal();
    loadWorkspace();
  });
}

// ---------------------------------------------------------------------------
// DB: ensure videos table exists (create if first run)
// ---------------------------------------------------------------------------
async function ensureVideosTable() {
  // Try to select from videos — if it errors with "relation does not exist", log it
  // Actual table creation is done via Supabase migration (see continuity doc)
  const { error } = await supabaseClient.from("videos").select("id").limit(1);
  if (error && error.code === "42P01") {
    console.warn("videos table not found — run Phase 6 migration");
  }
}
ensureVideosTable();

/* ============================================================
   RUMBLE — Global Discussion (renamed from Forum)
   ============================================================ */
const FORUM_PAGE_SIZE = 50;
let forumPage = 0;
let forumAccumulated = [];
async function loadForum(loadMore = false) {
  const list = $("forumList");
  if (!list) return;
  await loadCommunityRoles();
  if (!loadMore) { forumPage = 0; forumAccumulated = []; }
  const { data, error } = await supabaseClient.from("forum_posts")
    .select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false })
    .range(forumPage * FORUM_PAGE_SIZE, forumPage * FORUM_PAGE_SIZE + FORUM_PAGE_SIZE - 1);
  if (error) { list.innerHTML = `<div class="emptyState">Could not load threads.</div>`; return; }
  const hasMore = (data || []).length === FORUM_PAGE_SIZE;
  forumAccumulated = forumAccumulated.concat(data || []);
  const visible = forumAccumulated.filter(f => !f.flagged || f.author_id === (currentUser && currentUser.id));
  if (!visible.length) { list.innerHTML = `<div class="emptyState">No threads yet - start the conversation!</div>`; return; }
  list.innerHTML = visible.map(f => {
    const authorRole = getUserRoleLabel(f.author_id);
    return `
    <div class="rumbleCard${f.is_pinned ? " rumbleCard--pinned" : ""}" data-thread="${f.id}">
      ${f.is_pinned ? `<div class="feedPinLabel">&#128204; Pinned</div>` : ""}
      <div class="rumbleTitle">${escapeHtml(f.title || "")}${f.flagged ? ` <span class="badge" style="color:var(--danger);font-size:10px">Under review</span>` : ""}</div>
      <div class="rumbleBody">${escapeHtml((f.body || "").slice(0, 120))}${(f.body || "").length > 120 ? "..." : ""}</div>
      <div class="rumbleFoot">
        <span class="rumbleAuthor">${nameLink(f.author_name || "Guest", getUserVipRow(f.author_id), f.author_id)} ${authorRole ? getRoleBadgeHtml(authorRole) : ""}</span>
        <span class="rumbleMeta">${fmtDate(f.created_at)}</span>
        <div class="rumbleActions">
          <button class="rumbleBtn" data-like="${f.id}">&#10084; ${f.likes_count || 0}</button>
          <button class="rumbleBtn" data-replies="${f.id}">&#128172; ${f.reply_count || 0}</button>
          ${f.author_id !== (currentUser && currentUser.id) ? `<button class="rumbleBtn rumbleBtn--report" data-report="${f.id}">&#128681;</button>` : ""}
          ${isAdminUser() ? `<button class="rumbleBtn rumbleBtn--delete" data-delete="${f.id}">&#128465;</button>` : ""}
        </div>
      </div>
    </div>
    `;
  }).join("");
  list.querySelectorAll("[data-like]").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); likeThread(btn.dataset.like); }));
  list.querySelectorAll("[data-report]").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); reportThread(btn.dataset.report); }));
  list.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); deleteThread(btn.dataset.delete); }));
  list.querySelectorAll("[data-replies]").forEach(btn => btn.addEventListener("click", (e) => { e.stopPropagation(); const post = visible.find(f => f.id === btn.dataset.replies); openThreadReplies(btn.dataset.replies, post); }));
  list.querySelectorAll(".rumbleCard").forEach(card => {
    card.addEventListener("click", (e) => { if (e.target.closest("[data-open-profile]")) return; const post = visible.find(f => f.id === card.dataset.thread); openThreadReplies(card.dataset.thread, post); });
  });
  renderLoadMoreButton(list, hasMore, () => { forumPage++; loadForum(true); });
}

async function likeThread(postId) {
  const { data: cur } = await supabaseClient.from("forum_posts").select("likes_count, author_id, title").eq("id", postId).single();
  await supabaseClient.from("forum_posts").update({ likes_count: (cur ? cur.likes_count || 0 : 0) + 1 }).eq("id", postId);
  if (cur?.author_id) {
    createNotification({
      user_id: cur.author_id, type: "post_liked",
      title: `${currentProfile?.full_name || "Someone"} liked your post`,
      body: cur.title || null,
    });
  }
  loadForum();
}

async function reportThread(postId) {
  openModal(`
    <div class="modalTitle">&#128681; Report Thread</div>
    <div class="field"><label>Reason</label>
      <select id="threadReportReason">
        <option value="spam">Spam</option>
        <option value="scam">Scam / Fraud</option>
        <option value="harassment">Harassment</option>
        <option value="inappropriate">Inappropriate</option>
        <option value="other">Other</option>
      </select>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
      <button class="btn btnGhost" id="threadReportCancel">Cancel</button>
      <button class="btn btnDanger" id="threadReportSubmit">Report</button>
    </div>
  `);
  $("threadReportCancel").addEventListener("click", closeModal);
  $("threadReportSubmit").addEventListener("click", async () => {
    const reason = $("threadReportReason").value;
    await supabaseClient.from("forum_reports").insert({ post_id: postId, reporter_id: currentUser && currentUser.id, reason });
    await supabaseClient.from("forum_posts").update({ flagged: true, flag_reason: reason }).eq("id", postId);
    // Also log to user_reports so admin moderation queue picks it up
    await supabaseClient.from("user_reports").insert({
      reporter_id: currentUser?.id, reason, target_type: "forum_post", target_id: String(postId), status: "pending"
    }).then(() => {}).catch(() => {}); // non-blocking
    closeModal();
    showToast("Reported. Thank you!");
    loadForum();
  });
}

async function deleteThread(postId) {
  if (!confirm("Delete this thread?")) return;
  await supabaseClient.from("forum_posts").delete().eq("id", postId);
  showToast("Thread deleted.");
  loadForum();
}

function openThreadReplies(postId, post) {
  if (!post) return;
  const authorRole = getUserRoleLabel(post.author_id);
  openModal(`
    <div class="modalTitle">&#128172; ${escapeHtml(post.title || "Thread")}</div>
    <div class="rumbleModalBody">${escapeHtml(post.body || "")}</div>
    <div class="rumbleModalMeta">${nameLink(post.author_name || "Guest", getUserVipRow(post.author_id), post.author_id)} ${authorRole ? getRoleBadgeHtml(authorRole) : ""} &bull; ${fmtDate(post.created_at)}</div>
    <div class="cardTitle" style="font-size:13px;margin:12px 0 6px">Replies</div>
    <div id="threadRepliesList"><div class="emptyState">Loading...</div></div>
    <div class="field" style="margin-top:10px">
      <textarea id="replyBodyInput" rows="2" placeholder="Write a reply..."></textarea>
      <button type="button" class="btn btnGhost btnSm" id="btnAiImproveReply" style="margin-top:6px">✨ Improve this</button>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button class="btn btnGhost" id="replyCancel">Close</button>
      <button class="btn btnPrimary" id="replySubmit">Reply</button>
    </div>
  `);
  $("replyCancel").addEventListener("click", closeModal);
  $("btnAiImproveReply").addEventListener("click", () => {
    openAiImproveModal($("replyBodyInput").value, (text) => { $("replyBodyInput").value = text; });
  });
  (async () => {
    const { data } = await supabaseClient.from("forum_comments").select("*").eq("post_id", postId).order("created_at").limit(50);
    const replyList = $("threadRepliesList");
    if (!replyList) return;
    if (!data || !data.length) { replyList.innerHTML = `<div class="emptyState">No replies yet.</div>`; return; }
    replyList.innerHTML = data.map(r => `
      <div class="replyCard">
        <span class="rumbleAuthor">${nameLink(r.author_name || "Guest", getUserVipRow(r.author_id), r.author_id)}</span>
        <span class="rumbleMeta"> &bull; ${fmtDate(r.created_at)}</span>
        <div style="margin-top:4px">${escapeHtml(r.body || "")}</div>
      </div>
    `).join("");
  })();
  $("replySubmit").addEventListener("click", async () => {
    const body = $("replyBodyInput").value.trim();
    if (!body) { showToast("Write something first."); return; }
    const mod = moderateText(body);
    const { error } = await supabaseClient.from("forum_comments").insert({
      post_id: postId, body,
      author_id: currentUser && currentUser.id, author_name: currentProfile ? currentProfile.full_name : "Guest",
      flagged: mod.flagged, flag_reason: mod.reason,
    });
    if (error) { showToast("Error: " + error.message); return; }
    const { data: cur } = await supabaseClient.from("forum_posts").select("reply_count").eq("id", postId).single();
    await supabaseClient.from("forum_posts").update({ reply_count: (cur ? cur.reply_count || 0 : 0) + 1 }).eq("id", postId);
    if (post.author_id) {
      createNotification({ user_id: post.author_id, type: "post_commented", title: `${currentProfile?.full_name || "Someone"} commented on your post`, body: body.slice(0, 120) });
    }
    showToast("Reply posted!");
    closeModal();
    loadForum();
  });
}

$("btnNewThread").addEventListener("click", () => {
  openModal(`
    <div class="modalTitle">🔥 Start a Thread</div>
    <div class="field"><label>Title</label><input type="text" id="threadTitleInput" placeholder="What's on your mind?" /></div>
    <div class="field">
      <label>Message</label>
      <textarea id="threadBodyInput" rows="4" placeholder="Tell the community..."></textarea>
      <button type="button" class="btn btnGhost btnSm" id="btnAiImproveThread" style="margin-top:6px">✨ Improve this</button>
    </div>
    <div class="field">
      <label>Photo (optional)</label>
      <div class="photoPickerWrap">
        <input type="file" id="threadPhotoFile" accept="image/*" class="hidden" />
        <button type="button" class="btn btnGhost btnSm" id="btnPickThreadPhoto">📷 Add photo</button>
        <span id="threadPhotoName" style="font-size:12px;color:var(--muted);margin-left:8px"></span>
        <img loading="lazy" id="threadPhotoPreview" class="hidden" style="width:100%;max-height:140px;object-fit:cover;border-radius:12px;margin-top:8px" />
      </div>
    </div>
    ${communityPickerFieldHtml("threadCommunityInput")}
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btnGhost" id="threadPostCancel">Cancel</button>
      <button class="btn btnPrimary" id="threadPostSubmit">Post</button>
    </div>
  `);
  fillCommunityPickerOptions("threadCommunityInput");
  $("btnPickThreadPhoto").addEventListener("click", () => $("threadPhotoFile").click());
  $("btnAiImproveThread").addEventListener("click", () => {
    openAiImproveModal($("threadBodyInput").value, (text) => { $("threadBodyInput").value = text; });
  });
  $("threadPhotoFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    $("threadPhotoName").textContent = file.name;
    const reader = new FileReader();
    reader.onload = ev => {
      $("threadPhotoPreview").src = ev.target.result;
      $("threadPhotoPreview").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  });
  $("threadPostCancel").addEventListener("click", closeModal);
  $("threadPostSubmit").addEventListener("click", async () => {
    if (!throttleAction("threadPostSubmit", 4000)) return;
    const title = $("threadTitleInput").value.trim();
    const body = $("threadBodyInput").value.trim();
    if (!title) { showToast("Please add a title."); return; }
    const mod = applyApprovalGate(moderateText(title + " " + body));
    const photoFile = $("threadPhotoFile").files[0];
    let photoUrl = null;
    if (photoFile) {
      const btn = $("threadPostSubmit");
      btn.disabled = true; btn.textContent = "Uploading…";
      photoUrl = await uploadProfileImage(photoFile, "rumble");
      btn.disabled = false; btn.textContent = "Post";
    }
    const { error } = await supabaseClient.from("forum_posts").insert({
      title, body, author_id: currentUser ? currentUser.id : null,
      author_name: currentProfile ? currentProfile.full_name : "Guest",
      post_image_url: photoUrl || null,
      reply_count: 0, flagged: mod.flagged, flag_reason: mod.reason,
      community_id: $("threadCommunityInput").value || null,
    });
    if (error) { showToast("Could not post: " + error.message); return; }
    closeModal();
    showToast(mod.flagged ? "Posted - pending review." : "Thread posted!");
    loadForum();
    loadDashboardFeed();
  });
});


/* ============================================================
   TWO-FACTOR AUTHENTICATION (TOTP via Supabase Auth MFA)
   ============================================================ */
$("btnTwoFactor").addEventListener("click", async () => {
  const { data: factorsData, error: factorsErr } = await supabaseClient.auth.mfa.listFactors();
  if (factorsErr) { showToast("Could not check 2FA status: " + factorsErr.message); return; }
  const verified = (factorsData?.totp || []).find(f => f.status === "verified");

  if (verified) {
    openModal(`
      <div class="modalTitle">Two-factor authentication</div>
      <div class="itemMeta" style="margin-bottom:14px">Two-factor authentication is <strong style="color:var(--greenDeep)">enabled</strong> on your account using an authenticator app.</div>
      <div style="display:flex;justify-content:flex-end;gap:8px">
        <button class="btn btnGhost" id="twofaClose">Close</button>
        <button class="btn btnDanger" id="twofaDisable">Turn off 2FA</button>
      </div>
    `);
    $("twofaClose").addEventListener("click", closeModal);
    $("twofaDisable").addEventListener("click", async () => {
      const { error } = await supabaseClient.auth.mfa.unenroll({ factorId: verified.id });
      if (error) { showToast("Could not disable 2FA: " + error.message); return; }
      closeModal();
      showToast("Two-factor authentication turned off.");
    });
    return;
  }

  // Not enrolled yet — start enrollment
  const { data: enrollData, error: enrollErr } = await supabaseClient.auth.mfa.enroll({ factorType: "totp" });
  if (enrollErr) { showToast("Could not start 2FA setup: " + enrollErr.message); return; }
  const factorId = enrollData.id;
  const qrSvg = enrollData.totp.qr_code;
  const secret = enrollData.totp.secret;

  openModal(`
    <div class="modalTitle">Set up two-factor authentication</div>
    <div class="itemMeta" style="margin-bottom:10px">Scan this QR code with an authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code it shows.</div>
    <div style="display:flex;justify-content:center;margin-bottom:10px">${qrSvg}</div>
    <div class="itemMeta" style="margin-bottom:14px;text-align:center">Or enter manually: <code>${escapeHtml(secret)}</code></div>
    <div class="field"><label>6-digit code</label><input type="text" id="twofaCodeInput" maxlength="6" placeholder="123456" /></div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px">
      <button class="btn btnGhost" id="twofaCancel">Cancel</button>
      <button class="btn btnPrimary" id="twofaVerify">Verify & enable</button>
    </div>
  `);
  $("twofaCancel").addEventListener("click", async () => {
    await supabaseClient.auth.mfa.unenroll({ factorId });
    closeModal();
  });
  $("twofaVerify").addEventListener("click", async () => {
    const code = $("twofaCodeInput").value.trim();
    if (!/^\d{6}$/.test(code)) { showToast("Enter the 6-digit code from your app."); return; }
    const { data: challengeData, error: challengeErr } = await supabaseClient.auth.mfa.challenge({ factorId });
    if (challengeErr) { showToast("Error: " + challengeErr.message); return; }
    const { error: verifyErr } = await supabaseClient.auth.mfa.verify({ factorId, challengeId: challengeData.id, code });
    if (verifyErr) { showToast("Incorrect code, try again."); return; }
    closeModal();
    showToast("Two-factor authentication enabled!");
  });
});

/* ============================================================
   COMMUNITY STATS (members, posts, online now, newest members)
   Requires: profiles.last_seen_at column (see supabase_more_tables.sql)
   "Online now" = profile updated its heartbeat in the last 5 minutes —
   an honest approximation, not full real-time presence tracking.
   ============================================================ */
async function loadCommunityStats() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [{ count: memberCount }, { count: forumCount }, { count: jobCount }, { count: onlineCount }, { data: newest }, { data: growth }] = await Promise.all([
    supabaseClient.from("profiles").select("*", { count: "exact", head: true }),
    supabaseClient.from("forum_posts").select("*", { count: "exact", head: true }),
    supabaseClient.from("marketplace_listings").select("*", { count: "exact", head: true }).eq("type", "job"),
    supabaseClient.from("profiles").select("*", { count: "exact", head: true }).gte("last_seen_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()),
    supabaseClient.from("profiles").select("id, full_name, avatar_url, created_at").order("created_at", { ascending: false }).limit(8),
    supabaseClient.from("profiles").select("created_at").gte("created_at", since).order("created_at"),
  ]);

  $("statMembers").textContent = memberCount ?? "–";
  $("statPosts").textContent = ((forumCount || 0) + (jobCount || 0)) || "–";
  $("statOnline").textContent = onlineCount ?? "–";

  if (growth) drawCommunityGrowthChart(growth);

  const list = $("newestMembersList");
  if (!newest || !newest.length) { list.innerHTML = `<div class="emptyState">No members yet.</div>`; return; }
  list.innerHTML = newest.map(m => {
    const initial = (m.full_name || "?").trim().charAt(0).toUpperCase();
    return `
    <div class="newestMemberTile" data-member="${m.id}">
      <div class="newestMemberAvatar">${m.avatar_url ? `<img loading="lazy" src="${escapeHtml(m.avatar_url)}" alt=""/>` : escapeHtml(initial)}</div>
      <div class="newestMemberName">${escapeHtml(m.full_name || "New member")}</div>
      <div class="newestMemberJoined">${fmtDate(m.created_at)}</div>
    </div>`;
  }).join("");
  list.querySelectorAll("[data-member]").forEach(tile => {
    tile.addEventListener("click", () => openProfileView(tile.dataset.member));
  });
}

/* Community stats chart: bucket new-member signups per day over the last
   30 days. Reuses the same bar-chart look as the admin analytics signup
   chart, so members see the community is actually growing, not just a
   static "members: 2" number. */
function drawCommunityGrowthChart(signups) {
  const canvas = $("communityGrowthChart");
  if (!canvas || !canvas.getContext) return;
  const days = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days[d.toISOString().slice(0, 10)] = 0;
  }
  signups.forEach(s => {
    const day = s.created_at.slice(0, 10);
    if (day in days) days[day]++;
  });
  const labels = Object.keys(days);
  const vals = Object.values(days);
  const max = Math.max(...vals, 1);
  const H = 70;
  const W = canvas.parentElement.offsetWidth || 240;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const padL = 24, padR = 6, padT = 8, padB = 16;
  const cW = W - padL - padR;
  const cH = H - padT - padB;
  const barW = Math.max(2, (cW / labels.length) - 2);
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  [0, 1].forEach(t => {
    const y = padT + cH * (1 - t);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillStyle = "#9aa3b5"; ctx.font = "9px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(Math.round(max * t), padL - 3, y + 3);
  });
  labels.forEach((lbl, i) => {
    const x = padL + i * (cW / labels.length);
    const barH = (vals[i] / max) * cH;
    const y = padT + cH - barH;
    const grad = ctx.createLinearGradient(0, y, 0, padT + cH);
    grad.addColorStop(0, "#2FD5D5");
    grad.addColorStop(1, "#0A2463");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x + 1, y, barW, barH, [2, 2, 0, 0]) : ctx.rect(x + 1, y, barW, barH);
    ctx.fill();
  });
  ctx.fillStyle = "#9aa3b5"; ctx.font = "8px sans-serif"; ctx.textAlign = "center";
  [0, 14, 29].forEach(i => {
    if (i < labels.length) {
      const x = padL + i * (cW / labels.length) + barW / 2;
      ctx.fillText(labels[i].slice(5), x, H - 3);
    }
  });
}

/* Heartbeat: update our own last_seen_at every 60s while the app is open,
   so "Online now" reflects reality rather than being hardcoded. */
let heartbeatInterval = null;
function startPresenceHeartbeat() {
  if (heartbeatInterval || !currentUser) return;
  const beat = () => supabaseClient.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", currentUser.id);
  beat();
  heartbeatInterval = setInterval(beat, 60000);
}

/* ---------- Active Status Bar: online friends (real presence via last_seen_at) ---------- */
async function renderActiveStatusBar() {
  const el = $("activeStatusBar");
  if (!el || !currentUser) return;
  const { data: follows } = await supabaseClient.from("follows").select("followee_id").eq("follower_id", currentUser.id);
  const followingIds = (follows || []).map(f => f.followee_id);
  if (!followingIds.length) { el.innerHTML = ""; return; }

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: online } = await supabaseClient.from("profiles").select("id, full_name, last_seen_at").in("id", followingIds).gte("last_seen_at", fiveMinAgo);
  if (!online || !online.length) { el.innerHTML = ""; return; }

  el.innerHTML = online.map(p => {
    const initial = (p.full_name || "?").trim().charAt(0).toUpperCase();
    return `
      <div class="activeStatusItem" data-user="${p.id}">
        <div class="activeStatusAvatar">${escapeHtml(initial)}<span class="activeStatusDot"></span></div>
        <div class="activeStatusName">${escapeHtml((p.full_name || "").split(" ")[0] || "Friend")}</div>
      </div>`;
  }).join("");
}

/* ---------- Global search (top bar 🔎) — Phase 7B Smart Search ---------- */
$("btnGlobalSearch").addEventListener("click", () => {
  openModal(`
    <div class="modalTitle">Smart Search</div>
    <div class="field" style="margin-bottom:8px">
      <input type="text" id="globalSearchInput" placeholder="Search anything — try: 'video editors in Manila' or 'freelance jobs under ₱5k'" />
    </div>
    <div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap" id="searchFilterRow">
      <button class="mkFilterBtn active" data-filter="all">All</button>
      <button class="mkFilterBtn" data-filter="people">People</button>
      <button class="mkFilterBtn" data-filter="forum">Forum</button>
      <button class="mkFilterBtn" data-filter="marketplace">Marketplace</button>
      <button class="mkFilterBtn" data-filter="videos">Videos</button>
    </div>
    <div id="globalSearchAiHint" style="display:none;font-size:12px;color:var(--muted);background:var(--panel2);border-radius:10px;padding:8px 12px;margin-bottom:8px">✨ AI interpreted: <strong id="searchAiInterpret"></strong></div>
    <div class="list" id="globalSearchResults"><div class="emptyState">Type to search. Try natural language!</div></div>
  `);
  const input = $("globalSearchInput");
  input.focus();
  let activeFilter = "all";
  $("searchFilterRow").addEventListener("click", e => {
    const btn = e.target.closest("[data-filter]");
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    $("searchFilterRow").querySelectorAll(".mkFilterBtn").forEach(b => b.classList.toggle("active", b.dataset.filter === activeFilter));
    if (input.value.trim().length >= 2) runSearch(input.value.trim());
  });

  input.addEventListener("input", debounce(() => {
    const q = input.value.trim();
    if (q.length < 2) { $("globalSearchResults").innerHTML = `<div class="emptyState">Type at least 2 characters.</div>`; $("globalSearchAiHint").style.display="none"; return; }
    runSearch(q);
  }, 380));

  async function runSearch(q) {
    const results = $("globalSearchResults");
    results.innerHTML = `<div class="emptyState">Searching…</div>`;
    $("globalSearchAiHint").style.display = "none";

    // Groq smart intent parsing for natural language queries (only on "all" or if query is long/natural)
    let parsedIntent = null;
    if (q.length > 10 && (activeFilter === "all" || q.includes(" "))) {
      try {
        const groqRes = await supabaseClient.functions.invoke("groq-ai", {
          body: {
            prompt: `Parse this search query into a structured intent JSON. Return ONLY valid JSON, no other text.
Query: "${q}"
Return: {"type": "people"|"marketplace"|"forum"|"videos"|"all", "keywords": ["word1","word2"], "maxPrice": null|number, "location": null|string, "category": null|string, "naturalSummary": "brief human-readable interpretation"}`,
            max_tokens: 150
          }
        });
        if (groqRes.data?.result) {
          try {
            const raw = groqRes.data.result.trim().replace(/```json|```/g, "").trim();
            parsedIntent = JSON.parse(raw);
            if (parsedIntent?.naturalSummary) {
              $("searchAiInterpret").textContent = parsedIntent.naturalSummary;
              $("globalSearchAiHint").style.display = "block";
            }
          } catch (_) { parsedIntent = null; }
        }
      } catch (_) { parsedIntent = null; }
    }

    const kw = parsedIntent?.keywords?.join(" ") || q;
    const intent = parsedIntent?.type || "all";
    const filterType = activeFilter !== "all" ? activeFilter : intent;

    const searches = [];
    if (filterType === "all" || filterType === "people") searches.push(supabaseClient.from("profiles").select("id, full_name, mg_id, reputation_tier").ilike("full_name", `%${kw}%`).limit(6));
    if (filterType === "all" || filterType === "forum") searches.push(supabaseClient.from("forum_posts").select("id, title, author_name, likes_count").ilike("title", `%${kw}%`).limit(6));
    if (filterType === "all" || filterType === "marketplace") {
      let mkQ = supabaseClient.from("marketplace_listings").select("id, title, price, type").ilike("title", `%${kw}%`);
      if (parsedIntent?.maxPrice) mkQ = mkQ.lte("price", parsedIntent.maxPrice);
      if (parsedIntent?.category) mkQ = mkQ.eq("type", parsedIntent.category);
      searches.push(mkQ.limit(6));
    }
    if (filterType === "all" || filterType === "videos") searches.push(supabaseClient.from("videos").select("id, title, uploader_name, view_count").ilike("title", `%${kw}%`).limit(6));

    const queryResults = await Promise.all(searches);
    const sections = [];
    let si = 0;
    if (filterType === "all" || filterType === "people") {
      const people = queryResults[si++]?.data;
      if (people?.length) sections.push(`<div class="itemMeta" style="margin:8px 0 4px">👤 People</div>` + people.map(p => `<div class="listItem" style="cursor:pointer" onclick="openProfileView('${p.id}');closeModal()"><div><div class="itemTitle">${escapeHtml(p.full_name || "—")}</div><div class="itemMeta">@${escapeHtml(p.mg_id || "")} • ${escapeHtml(p.reputation_tier || "newcomer")}</div></div></div>`).join(""));
    }
    if (filterType === "all" || filterType === "forum") {
      const forum = queryResults[si++]?.data;
      if (forum?.length) sections.push(`<div class="itemMeta" style="margin:8px 0 4px">💬 Forum</div>` + forum.map(f => `<div class="listItem"><div><div class="itemTitle">${escapeHtml(f.title)}</div><div class="itemMeta">by ${escapeHtml(f.author_name || "")} • 👍 ${f.likes_count || 0}</div></div></div>`).join(""));
    }
    if (filterType === "all" || filterType === "marketplace") {
      const mk = queryResults[si++]?.data;
      if (mk?.length) sections.push(`<div class="itemMeta" style="margin:8px 0 4px">🛍️ Marketplace</div>` + mk.map(j => `<div class="listItem"><div><div class="itemTitle">${escapeHtml(j.title)}</div><div class="itemMeta">${j.type || "item"}${j.price ? ` • ₱${Number(j.price).toLocaleString()}` : ""}</div></div></div>`).join(""));
    }
    if (filterType === "all" || filterType === "videos") {
      const vids = queryResults[si++]?.data;
      if (vids?.length) sections.push(`<div class="itemMeta" style="margin:8px 0 4px">🎬 Videos</div>` + vids.map(v => `<div class="listItem"><div><div class="itemTitle">${escapeHtml(v.title)}</div><div class="itemMeta">by ${escapeHtml(v.uploader_name || "")} • ${v.view_count || 0} views</div></div></div>`).join(""));
    }
    results.innerHTML = sections.length ? sections.join("") : `<div class="emptyState">No results for "${escapeHtml(q)}".</div>`;
  }
});

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ============================================================
   PHASE 7B — COMMUNITY RECOMMENDATIONS
   "People you may know" (followers-of-followers + shared skills)
   "Jobs you might like" (based on profile skills)
   ============================================================ */
let recoLoaded = false;
async function loadCommunityRecommendations() {
  if (!currentUser || recoLoaded) return;
  const recoCard = $("recoCard");
  if (!recoCard) return;

  // Get my profile for skills
  const mySkills = currentProfile?.skills || [];

  // --- People you may know: followers-of-followers ---
  const { data: myFollows } = await supabaseClient.from("follows").select("followee_id").eq("follower_id", currentUser.id);
  const followingIds = (myFollows || []).map(f => f.followee_id);

  let suggestedPeople = [];
  if (followingIds.length) {
    // Get who those people follow (2nd-degree)
    const { data: fof } = await supabaseClient.from("follows")
      .select("followee_id")
      .in("follower_id", followingIds)
      .neq("followee_id", currentUser.id)
      .limit(40);
    const fofIds = [...new Set((fof || []).map(f => f.followee_id).filter(id => !followingIds.includes(id)))];
    if (fofIds.length) {
      const { data: fofProfiles } = await supabaseClient.from("profiles")
        .select("id, full_name, mg_id, reputation_tier, skills")
        .in("id", fofIds.slice(0, 10));
      suggestedPeople = fofProfiles || [];
    }
  }

  // If still empty, try users with shared skills
  if (!suggestedPeople.length && mySkills.length) {
    const { data: skillMatch } = await supabaseClient.from("profiles")
      .select("id, full_name, mg_id, reputation_tier, skills")
      .contains("skills", [mySkills[0]])
      .neq("id", currentUser.id)
      .limit(8);
    suggestedPeople = (skillMatch || []).filter(p => !followingIds.includes(p.id));
  }

  // --- Jobs you might like: based on skills ---
  let recoJobs = [];
  if (mySkills.length) {
    // search marketplace listings by each skill keyword
    const skillQuery = mySkills.slice(0, 3).join("|");
    const { data: jobMatches } = await supabaseClient.from("marketplace_listings")
      .select("id, title, price, type, location, created_at")
      .or(mySkills.slice(0, 3).map(s => `title.ilike.%${s}%`).join(","))
      .in("type", ["job", "service"])
      .order("created_at", { ascending: false })
      .limit(5);
    recoJobs = jobMatches || [];
  }
  if (!recoJobs.length) {
    // Fallback: latest jobs
    const { data: latestJobs } = await supabaseClient.from("marketplace_listings")
      .select("id, title, price, type, location, created_at")
      .in("type", ["job", "service"])
      .order("created_at", { ascending: false })
      .limit(5);
    recoJobs = latestJobs || [];
  }

  // Render people
  const recoList = $("recoList");
  if (!suggestedPeople.length) {
    recoList.innerHTML = `<div class="emptyState">Follow more people to unlock recommendations.</div>`;
  } else {
    recoList.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">` + suggestedPeople.slice(0, 5).map(p => {
      const sharedSkills = mySkills.filter(s => (p.skills || []).includes(s));
      const reasonText = sharedSkills.length ? `Shares skills: ${sharedSkills.slice(0, 2).join(", ")}` : "Friend of someone you follow";
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:14px;background:var(--panel2)">
          <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,var(--cyan),var(--blue));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px;flex-shrink:0;cursor:pointer" onclick="openProfileView('${p.id}')">
            ${escapeHtml((p.full_name || "?").charAt(0).toUpperCase())}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:13.5px;cursor:pointer" onclick="openProfileView('${p.id}')">${escapeHtml(p.full_name || "—")}</div>
            <div style="font-size:11px;color:var(--muted)">${reasonText}</div>
          </div>
          <button class="btn btnGhost btnSm" onclick="followUserFromReco('${p.id}',this)">+ Follow</button>
        </div>`;
    }).join("") + `</div>`;
  }

  // Render jobs
  const recoJobsEl = $("recoJobs");
  if (!recoJobs.length) {
    recoJobsEl.innerHTML = `<div class="emptyState">No job recommendations yet — add skills to your profile.</div>`;
  } else {
    recoJobsEl.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">` + recoJobs.map(j => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px;border:1px solid var(--border);border-radius:14px;background:var(--panel2)">
        <div style="font-size:22px;flex-shrink:0">${j.type === "service" ? "🔧" : "💼"}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13.5px">${escapeHtml(j.title)}</div>
          <div style="font-size:11px;color:var(--muted)">${j.price ? `₱${Number(j.price).toLocaleString()}` : "Negotiable"}${j.location ? ` • ${escapeHtml(j.location)}` : ""}</div>
        </div>
      </div>`).join("") + `</div>`;
  }

  recoCard.style.display = "";
  recoLoaded = true;
}

async function followUserFromReco(userId, btn) {
  btn.disabled = true;
  btn.textContent = "…";
  const { error } = await supabaseClient.from("follows").insert({ follower_id: currentUser.id, followee_id: userId });
  if (error) { btn.textContent = "+ Follow"; btn.disabled = false; showToast("Could not follow. Try again."); return; }
  btn.textContent = "✓ Following";
  btn.classList.remove("btnGhost");
  btn.classList.add("btnPrimary");
  showToast("Following!");
}
