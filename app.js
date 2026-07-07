// MEET & GREET — app.js
// Auth (email+password only), dashboard, meetings, chat, whiteboard, profile.

let currentUser = null;
let currentProfile = null;
let meetingsCache = [];
let activeChatId = null;
let chatChannel = null;
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
  await onLoggedIn(data.user);
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
  }
});

$("btnLogout").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  currentUser = null; currentProfile = null;
  $("app").classList.add("hidden");
  $("authWrap").classList.remove("hidden");
});

async function onLoggedIn(user) {
  currentUser = user;
  $("authWrap").classList.add("hidden");
  $("app").classList.remove("hidden");
  populateTimezones($("mTimezone"));
  populateTimezones($("pTimezone"));
  await loadProfile();
  await loadMeetings();
  await loadChatThreads();
  startReminderLoop();
}

async function bootstrapSession() {
  const { data } = await supabaseClient.auth.getSession();
  if (data.session && data.session.user) {
    await onLoggedIn(data.session.user);
  }
}
bootstrapSession();

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
document.getElementById("navTabs").addEventListener("click", (e) => {
  const btn = e.target.closest(".navTab");
  if (!btn) return;
  document.querySelectorAll(".navTab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const view = btn.dataset.view;
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  $("view" + view.charAt(0).toUpperCase() + view.slice(1)).classList.add("active");
});

$("qaSchedule").addEventListener("click", () => document.querySelector('[data-view="meetings"]').click());
$("qaChat").addEventListener("click", () => document.querySelector('[data-view="chat"]').click());
$("qaInstant").addEventListener("click", startInstantMeeting);

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------
async function loadProfile() {
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", currentUser.id).single();
  if (error) { console.error(error); return; }
  currentProfile = data;
  renderProfile();
}

function renderProfile() {
  const p = currentProfile;
  const isVip = p.plan === "vip" || p.vip_status === "active";
  $("dashName").textContent = p.full_name || "Welcome";
  $("dashEmail").textContent = p.email || "";
  $("pName").value = p.full_name || "";
  $("pBio").value = p.bio || "";
  $("pAvatar").value = p.avatar_url || "";
  $("pEmail").value = p.email || "";
  $("pTimezone").value = p.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  $("pLanguage").value = p.language || "en";
  $("notifInApp").checked = p.notif_in_app !== false;
  $("notifEmail").checked = p.notif_email !== false;

  [ "planBadge", "dashPlanBadge", "profilePlanBadge" ].forEach(id => {
    const el = $(id);
    el.textContent = isVip ? "VIP Verified" : "Free";
    el.className = "badge " + (isVip ? "badgeVip" : "badgeFree");
  });

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

$("btnSaveProfile").addEventListener("click", async () => {
  const updates = {
    full_name: $("pName").value.trim(),
    bio: $("pBio").value.trim(),
    avatar_url: $("pAvatar").value.trim(),
    timezone: $("pTimezone").value,
    language: $("pLanguage").value,
    notif_in_app: $("notifInApp").checked,
    notif_email: $("notifEmail").checked,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseClient.from("profiles").update(updates).eq("id", currentUser.id);
  if (error) { showToast("Could not save profile: " + error.message); return; }
  showToast("Profile saved.");
  await loadProfile();
});

$("btnChangePassword").addEventListener("click", async () => {
  const pw = $("pNewPassword").value;
  if (!pw || pw.length < 6) { showToast("Password must be at least 6 characters."); return; }
  const { error } = await supabaseClient.auth.updateUser({ password: pw });
  if (error) { showToast("Could not update password: " + error.message); return; }
  $("pNewPassword").value = "";
  showToast("Password updated.");
});

$("btnDeleteAccount").addEventListener("click", async () => {
  if (!confirm("This will permanently delete your MEET & GREET profile data. Continue?")) return;
  const { error } = await supabaseClient.from("profiles").delete().eq("id", currentUser.id);
  if (error) { showToast("Could not delete profile: " + error.message); return; }
  await supabaseClient.auth.signOut();
  showToast("Your profile data has been deleted.");
  location.reload();
});

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------
$("formSchedule").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = $("mTitle").value.trim();
  const date = $("mDate").value;
  const time = $("mTime").value;
  const duration = parseInt($("mDuration").value, 10) || 40;
  const timezone = $("mTimezone").value;
  const passcode = $("mPasscode").value.trim() || null;
  const invitesRaw = $("mInvites").value.trim();
  const invited_emails = invitesRaw ? invitesRaw.split(",").map(s => s.trim()).filter(Boolean) : [];

  if (!date || !time) { showToast("Please pick a date and time."); return; }
  const scheduled_at = new Date(`${date}T${time}:00`).toISOString();

  const { data, error } = await supabaseClient.from("meetings").insert({
    title, scheduled_at, duration_minutes: duration, timezone, passcode,
    invited_emails, created_by: currentUser.id, status: "scheduled",
  }).select().single();

  if (error) { showToast("Could not schedule meeting: " + error.message); return; }

  await addParticipantsByEmail(data.id, invited_emails);
  showToast("Meeting scheduled.");
  $("formSchedule").reset();
  $("mDuration").value = 40;
  await loadMeetings();
});

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
  const { data, error } = await supabaseClient.from("meetings").insert({
    title: "Instant Meeting",
    scheduled_at: new Date().toISOString(),
    duration_minutes: 40,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    status: "live",
    created_by: currentUser.id,
  }).select().single();
  if (error) { showToast("Could not start meeting: " + error.message); return; }
  await loadMeetings();
  joinMeeting(data);
}

async function loadMeetings() {
  const { data, error } = await supabaseClient.from("meetings").select("*").order("scheduled_at", { ascending: true });
  if (error) { console.error(error); return; }
  meetingsCache = data || [];
  renderMeetings();
  renderDashboard();
}

function renderDashboard() {
  const now = Date.now();
  const upcoming = meetingsCache.filter(m => m.status !== "chat" && m.status !== "ended" && (!m.scheduled_at || new Date(m.scheduled_at).getTime() >= now - 60*60*1000));
  const history = meetingsCache.filter(m => m.status === "ended");
  $("mUpcoming").textContent = upcoming.length;
  $("mHistory").textContent = history.length;

  const list = $("dashUpcomingList");
  if (!upcoming.length) { list.innerHTML = `<div class="emptyState">No upcoming meetings yet.</div>`; return; }
  list.innerHTML = upcoming.slice(0, 5).map(m => meetingListItemHTML(m)).join("");
  bindMeetingListButtons(list);
}

function meetingListItemHTML(m) {
  const isHost = m.created_by === currentUser.id;
  return `
    <div class="listItem" data-id="${m.id}">
      <div>
        <div class="itemTitle">${escapeHtml(m.title || "Untitled meeting")}</div>
        <div class="itemMeta">${fmtDate(m.scheduled_at)} • ${m.duration_minutes} min • ${escapeHtml(m.timezone || "")} ${isHost ? "• You are host" : ""}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btnGhost btnSm" data-copy="${m.id}">Copy link</button>
        <button class="btn btnPrimary btnSm" data-join="${m.id}">Join</button>
      </div>
    </div>`;
}

function renderMeetings() {
  const upcoming = meetingsCache.filter(m => m.status !== "chat" && m.status !== "ended");
  const history = meetingsCache.filter(m => m.status === "ended");
  const list = $("meetingsList");
  let html = "";
  if (upcoming.length) html += upcoming.map(meetingListItemHTML).join("");
  if (history.length) {
    html += `<div class="itemMeta" style="margin-top:10px">Past meetings</div>`;
    html += history.map(m => `
      <div class="listItem" data-id="${m.id}" style="opacity:.7">
        <div>
          <div class="itemTitle">${escapeHtml(m.title || "Untitled meeting")}</div>
          <div class="itemMeta">${fmtDate(m.ended_at || m.scheduled_at)} • ended</div>
        </div>
      </div>`).join("");
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
}

function joinMeeting(meeting) {
  const room = `meetandgreet-${meeting.meeting_code}`;
  $("callTitleText").textContent = meeting.title || "Meeting";
  $("callIframe").src = `https://meet.jit.si/${encodeURIComponent(room)}#userInfo.displayName="${encodeURIComponent(currentProfile?.full_name || "Guest")}"`;
  $("callFrameWrap").classList.remove("hidden");
}

$("btnLeaveCall").addEventListener("click", () => {
  $("callIframe").src = "about:blank";
  $("callFrameWrap").classList.add("hidden");
});

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
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
// Chat
// ---------------------------------------------------------------------------
async function loadChatThreads() {
  const threads = meetingsCache.filter(m => m.status === "chat");
  renderChatThreads(threads);
}

function renderChatThreads(threads) {
  const el = $("chatThreads");
  if (!threads.length) { el.innerHTML = `<div class="emptyState">No conversations yet.</div>`; return; }
  el.innerHTML = threads.map(t => `
    <div class="listItem" data-thread="${t.id}" style="cursor:pointer">
      <div class="itemTitle" style="font-size:13px">${escapeHtml(t.title)}</div>
    </div>`).join("");
  el.querySelectorAll("[data-thread]").forEach(item => {
    item.addEventListener("click", () => selectThread(item.dataset.thread, threads.find(t => t.id === item.dataset.thread)));
  });
}

$("btnNewChat").addEventListener("click", () => {
  openModal(`
    <div class="modalTitle">Start a new chat</div>
    <div class="field"><label>Their MEET & GREET email</label><input type="email" id="newChatEmail" placeholder="teammate@example.com" /></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btnGhost" id="modalCancel">Cancel</button>
      <button class="btn btnPrimary" id="modalCreateChat">Start chat</button>
    </div>
  `);
  $("modalCancel").addEventListener("click", closeModal);
  $("modalCreateChat").addEventListener("click", async () => {
    const email = $("newChatEmail").value.trim();
    if (!email) return;
    const { data: found } = await supabaseClient.rpc("lookup_profile_by_email", { p_email: email });
    const match = Array.isArray(found) ? found[0] : found;
    if (!match || !match.id) { showToast("No MEET & GREET account found with that email yet."); return; }
    const { data: room, error } = await supabaseClient.from("meetings").insert({
      title: `Chat with ${match.full_name || email}`,
      status: "chat", created_by: currentUser.id,
    }).select().single();
    if (error) { showToast(error.message); return; }
    await supabaseClient.from("meeting_participants").insert([
      { room_id: room.id, user_id: currentUser.id, role: "member" },
      { room_id: room.id, user_id: match.id, role: "member" },
    ]);
    closeModal();
    await loadMeetings();
    await loadChatThreads();
    selectThread(room.id, room);
  });
});

async function selectThread(id, meta) {
  activeChatId = id;
  if (chatChannel) { supabaseClient.removeChannel(chatChannel); chatChannel = null; }

  $("chatInput").disabled = false;
  $("chatSend").disabled = false;

  const { data, error } = await supabaseClient.from("meeting_messages").select("*").eq("room_id", id).order("created_at", { ascending: true });
  if (error) { console.error(error); return; }
  renderChatMessages(data || []);

  chatChannel = supabaseClient.channel("chat:" + id)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "meeting_messages", filter: `room_id=eq.${id}` }, (payload) => {
      appendChatMessage(payload.new);
    }).subscribe();
}

function renderChatMessages(msgs) {
  const el = $("chatMessages");
  el.innerHTML = "";
  msgs.forEach(appendChatMessage);
}

function appendChatMessage(m) {
  const el = $("chatMessages");
  if (el.querySelector(".emptyState")) el.innerHTML = "";
  const mine = m.sender_id === currentUser.id;
  const div = document.createElement("div");
  div.className = "bubble " + (mine ? "bubbleMine" : "bubbleTheirs");
  div.innerHTML = `${escapeHtml(m.body)}<div class="bubbleMeta">${new Date(m.created_at).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}</div>`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

$("chatSend").addEventListener("click", sendChatMessage);
$("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter") sendChatMessage(); });

async function sendChatMessage() {
  const body = $("chatInput").value.trim();
  if (!body || !activeChatId) return;
  $("chatInput").value = "";
  const { error } = await supabaseClient.from("meeting_messages").insert({ room_id: activeChatId, sender_id: currentUser.id, body });
  if (error) showToast(error.message);
}

// ---------------------------------------------------------------------------
// Modal helper
// ---------------------------------------------------------------------------
function openModal(html) {
  $("modalCard").innerHTML = html;
  $("modalOverlay").classList.remove("hidden");
}
function closeModal() { $("modalOverlay").classList.add("hidden"); }
$("modalOverlay").addEventListener("click", (e) => { if (e.target.id === "modalOverlay") closeModal(); });

// ---------------------------------------------------------------------------
// Whiteboard (local canvas, personal scratchpad)
// ---------------------------------------------------------------------------
(function setupWhiteboard() {
  const canvas = $("wbCanvas");
  const ctx = canvas.getContext("2d");
  let drawing = false, color = "#0f2419";

  function resize() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.lineCap = "round"; ctx.lineWidth = 3;
  }
  window.addEventListener("resize", resize);
  setTimeout(resize, 50);

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }
  function start(e) { drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e) { if (!drawing) return; const p = pos(e); ctx.strokeStyle = color; ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); }
  function end() { drawing = false; }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  canvas.addEventListener("touchstart", start);
  canvas.addEventListener("touchmove", move);
  canvas.addEventListener("touchend", end);

  document.querySelectorAll(".wbToolbar [data-color]").forEach(btn => {
    btn.addEventListener("click", () => color = btn.dataset.color);
  });
  $("wbClear").addEventListener("click", () => ctx.clearRect(0, 0, canvas.width, canvas.height));
})();
