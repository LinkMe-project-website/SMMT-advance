// MEET & GREET — app.js
// Auth (email+password only), dashboard, meetings, chat, whiteboard, profile.

let currentUser = null;
let currentProfile = null;
let meetingsCache = [];
let plansCache = [];
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
  await loadPlans();
  await loadProfile();
  await loadMeetings();
  await loadChatThreads();
  startReminderLoop();
  handleVipRedirectParam();
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
  if (view === "whiteboard" && !wbRoomId) renderWhiteboardPicker();
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
  const membership = computeMembershipStatus(p);
  const isVip = membership.state === "trialing" || membership.state === "active";
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

  renderAiCompanion(isVip);
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

async function startFreeTrial(planId) {
  const { error } = await supabaseClient.rpc("start_free_trial", { p_plan_id: planId });
  if (error) { showToast(error.message || "Could not start your free trial."); return; }
  showToast("Free trial started! Enjoy your VIP features.");
  await loadProfile();
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
  const rooms = meetingsCache.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

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

  const room = meetingsCache.find(m => m.id === roomId);
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
          appName: "MEET & GREET",
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
  if (currentProfile) {
    const membership = computeMembershipStatus(currentProfile);
    renderAiCompanion(membership.state === "trialing" || membership.state === "active");
  }
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

