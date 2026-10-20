/* ════════════════════════════════════════
   GIVR — APP.JS  v2
   ════════════════════════════════════════ */

const API_BASE = '/api';
let authMode = 'login';
let authRole = 'student';
let qrStream = null;
let qrScanActive = false;
let currentOrgEvents = [];
let pendingCoverImageData = null;
let settingsEditField = null;

/* ── CAUSE SVG ICONS ─────────────────────────────────────────────────────── */
const CAUSE_ICONS = {
  Animals:     `<img src="images/paw.png"     width="32" height="32" style="object-fit:contain">`,
  Environment: `<img src="images/leaves.png"  width="32" height="32" style="object-fit:contain">`,
  Elderly:     `<img src="images/elderly.png" width="32" height="32" style="object-fit:contain">`,
  Children:    `<img src="images/baby.png"    width="32" height="32" style="object-fit:contain">`,
  Community:   `<img src="images/team.png"       width="32" height="32" style="object-fit:contain">`,
  Education:   `<img src="images/graduation.png" width="32" height="32" style="object-fit:contain">`
};

function injectCauseIcons() {
  document.querySelectorAll('[data-cause-icon]').forEach(el => {
    const cause = el.getAttribute('data-cause-icon');
    if (CAUSE_ICONS[cause]) el.innerHTML = CAUSE_ICONS[cause];
  });
}

function causeThumbnail(cause, bg) {
  const svg = CAUSE_ICONS[cause] || '';
  return `<div class="cause-thumb" style="background:${bg || '#EEF2EB'}">${svg}</div>`;
}

function causeTrendIcon(cause, bg) {
  const svg = CAUSE_ICONS[cause] || '';
  return `<div class="trend-cause-icon">${svg}</div>`;
}

/* ── TIER SYSTEM ─────────────────────────────────────────────────────────── */
const TIERS = [
  { name:'GIVR Seeker',   min:0,   max:49,  cls:'seeker',   color:'#7C8B75' },
  { name:'GIVR Explorer', min:50,  max:149, cls:'explorer',  color:'#4D6644' },
  { name:'GIVR Pioneer',  min:150, max:349, cls:'pioneer',   color:'#A85F40' },
  { name:'GIVR Master',   min:350, max:Infinity, cls:'master', color:'#1E3A5F' }
];

function getTier(pts) {
  return TIERS.find(t => pts >= t.min && pts <= t.max) || TIERS[0];
}

function getTierTrackPct(pts) {
  const MAX = 350;
  return Math.min(100, Math.round((pts / MAX) * 100));
}

const TIER_REWARDS_MAP = {
  seeker:   [],
  explorer: [
    { title:'+50 Bonus Points',      desc:'Earn 50 extra points on your next event sign-up.', icon:'star' },
    { title:'Priority Event Access', desc:'Get 24-hour early access to new volunteer listings.', icon:'calendar' }
  ],
  pioneer: [
    { title:'+100 Bonus Points', desc:'Earn 100 extra points credited to your account.', icon:'star' },
    { title:'Exclusive Badge',   desc:'GIVR Pioneer badge on your public profile.', icon:'badge' }
  ],
  master: [
    { title:'+200 Bonus Points', desc:'200 points added instantly on reaching Master.', icon:'star' },
    { title:'Free Merchandise',  desc:'Redeem a Givr tote bag or cap. Limited stock.', icon:'gift' },
    { title:'Spotlight Feature', desc:'Your profile featured on the Givr home feed.', icon:'badge' }
  ]
};

const ICON_SVG = {
  star:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  badge:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>',
  gift:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>'
};

function renderLevelupRewardsForTier(tierCls, pts) {
  const list = document.getElementById('levelup-list');
  if (!list) return;
  const rewards = TIER_REWARDS_MAP[tierCls] || [];
  const tier = TIERS.find(function(t){ return t.cls === tierCls; });
  const unlocked = tier ? pts >= tier.min : false;
  if (rewards.length === 0) {
    list.innerHTML = '<div style="padding:16px 20px; color:var(--text3); font-size:13px;">Keep earning points to unlock rewards at the next tier!</div>';
    return;
  }
  list.innerHTML = rewards.map(function(r) {
    var iconSvg = ICON_SVG[r.icon] || '';
    var statusCls = unlocked ? 'unlocked' : 'locked';
    var statusTxt = unlocked ? 'Unlocked' : 'Locked';
    var iconColor = unlocked ? 'var(--sage)' : 'var(--text3)';
    return '<div class="levelup-item">'
      + '<div class="levelup-icon" style="color:' + iconColor + '">' + iconSvg + '</div>'
      + '<div class="levelup-body">'
      +   '<div class="lv-title">' + esc(r.title) + '</div>'
      +   '<div class="lv-desc">' + esc(r.desc) + '</div>'
      + '</div>'
      + '<div class="levelup-status ' + statusCls + '">' + statusTxt + '</div>'
      + '</div>';
  }).join('');
}

function renderTierSystem(pts) {
  var currentTier = getTier(pts);
  var nextTier = TIERS[TIERS.indexOf(currentTier) + 1];

  var bigEl = document.getElementById('rewards-pts-big');
  if (bigEl) bigEl.textContent = pts;

  var fill = document.getElementById('tier-track-fill');
  if (fill) fill.style.width = getTierTrackPct(pts) + '%';

  var nodes = document.querySelectorAll('.tier-dot');
  var thresholds = [0, 50, 150, 350];
  nodes.forEach(function(dot, i) {
    dot.classList.toggle('reached', pts >= thresholds[i]);
  });

  var msg = document.getElementById('tier-next-msg');
  if (msg) {
    if (nextTier) {
      msg.textContent = (nextTier.min - pts) + ' more points to ' + nextTier.name;
    } else {
      msg.textContent = 'You have reached the highest tier!';
    }
  }

  var carousel = document.getElementById('tier-carousel');
  var dotsEl   = document.getElementById('tier-carousel-dots');
  if (!carousel) return;

  var currentIdx = TIERS.indexOf(currentTier);

  carousel.innerHTML = TIERS.map(function(t, i) {
    var isCurrent   = t.cls === currentTier.cls;
    var isSurpassed = pts > t.max && t.max !== Infinity;
    var isLocked    = pts < t.min;
    var badgeHtml = '';
    if (isCurrent) {
      badgeHtml = '<div class="tier-card-badge">MY TIER</div>';
    } else if (isSurpassed) {
      badgeHtml = '<div class="tier-card-badge" style="background:rgba(0,0,0,.15)">SURPASSED</div>';
    } else if (isLocked) {
      badgeHtml = '<div class="tier-card-badge" style="background:rgba(0,0,0,.15)">LOCKED</div>';
    }
    var subText = '';
    if (isCurrent) {
      subText = '<div class="tier-card-sub">Current tier</div>';
    } else if (isSurpassed) {
      subText = '<div class="tier-card-sub">Congrats! You\'ve surpassed this level!</div>';
    } else {
      subText = '<div class="tier-card-sub">Unlocked at ' + t.min + ' pts</div>';
    }
    return '<div class="tier-carousel-slide" data-tier-cls="' + t.cls + '">'
      + '<div class="tier-card ' + t.cls + '">'
      + badgeHtml
      + '<div class="tier-card-name">' + esc(t.name) + '</div>'
      + '<div class="tier-card-cups">Current Points: <strong>' + pts + '</strong></div>'
      + subText
      + '<div class="tier-card-icon">'
      + '<svg viewBox="0 0 60 60" fill="none"><circle cx="30" cy="30" r="28" stroke="rgba(255,255,255,.3)" stroke-width="2"/><path d="M20 38c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="white" stroke-width="2" stroke-linecap="round"/><circle cx="30" cy="22" r="6" stroke="white" stroke-width="2"/></svg>'
      + '</div>'
      + '</div>'
      + '</div>';
  }).join('');

  if (dotsEl) {
    dotsEl.innerHTML = TIERS.map(function(t, i) {
      return '<div class="tier-carousel-dot' + (i === currentIdx ? ' active' : '') + '" data-dot="' + i + '"></div>';
    }).join('');
  }

  var slides = carousel.querySelectorAll('.tier-carousel-slide');
  if (slides[currentIdx]) {
    setTimeout(function() {
      var slideW = (slides[0] ? slides[0].offsetWidth : carousel.clientWidth) + 12;
      carousel.scrollLeft = currentIdx * slideW;
    }, 60);
  }

  carousel.onscroll = function() {
    var slideW = (slides[0] ? slides[0].offsetWidth : carousel.clientWidth) + 12;
    var idx = Math.min(TIERS.length - 1, Math.round(carousel.scrollLeft / slideW));
    var dots = dotsEl ? dotsEl.querySelectorAll('.tier-carousel-dot') : [];
    dots.forEach(function(d, i) { d.classList.toggle('active', i === idx); });
    var visibleSlide = slides[idx];
    if (visibleSlide) {
      renderLevelupRewardsForTier(visibleSlide.dataset.tierCls, pts);
    }
  };

  renderLevelupRewardsForTier(currentTier.cls, pts);
}

// ── UTILS ────────────────────────────────────────────────────────────────────
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
}
function getInitials(name) {
  return String(name || 'G').trim().split(/\s+/).slice(0,2)
    .map(x => x[0] || '').join('').toUpperCase() || 'G';
}
function avatarHtml(person, size = 44) {
  const style = `width:${size}px;height:${size}px;font-size:${Math.round(size*0.38)}px`;
  if (person?.avatar) {
    return `<div class="av" style="${style}"><img src="${esc(person.avatar)}" alt="${esc(person.name || '')}"></div>`;
  }
  const bg = person?.color || '#4D6644';
  const init = esc(person?.initials || getInitials(person?.name) || '?');
  return `<div class="av" style="${style};background:${bg}">${init}</div>`;
}

// ── API ──────────────────────────────────────────────────────────────────────
async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('givr_token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
}

// ── AUTH HELPERS ─────────────────────────────────────────────────────────────
function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = msg || '';
}
function setAuthRole(roleName) {
  authRole = roleName === 'organisation' ? 'organisation' : 'student';
  document.getElementById('role-student').classList.toggle('active', authRole === 'student');
  document.getElementById('role-organisation').classList.toggle('active', authRole === 'organisation');
  const nameInput = document.getElementById('auth-name');
  if (nameInput) nameInput.placeholder = authRole === 'organisation' ? 'Organisation name' : 'Your name';
  showAuthError('');
}
function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  const isReg = authMode === 'register';
  document.getElementById('auth-name-wrap').style.display = isReg ? 'block' : 'none';
  document.getElementById('auth-submit').textContent = isReg ? 'Create account' : 'Log in';
  document.getElementById('auth-switch-prefix').textContent = isReg ? 'Already have an account?' : 'New to Givr?';
  document.getElementById('auth-switch').textContent = isReg ? 'Log in' : 'Create an account';
  document.getElementById('auth-password').autocomplete = isReg ? 'new-password' : 'current-password';
  showAuthError('');
}
async function authSubmit() {
  const name = (document.getElementById('auth-name')?.value || '').trim();
  const email = (document.getElementById('auth-email')?.value || '').trim();
  const password = document.getElementById('auth-password')?.value || '';
  showAuthError('');
  if (!email || !password || (authMode === 'register' && !name)) {
    return showAuthError('Please fill in all required fields.');
  }
  const btn = document.getElementById('auth-submit');
  btn.disabled = true;
  btn.textContent = authMode === 'register' ? 'Creating account…' : 'Logging in…';
  try {
    const result = await apiRequest(authMode === 'register' ? '/auth/register' : '/auth/login', {
      method: 'POST', body: JSON.stringify({ name, email, password, role: authRole })
    });
    if (result.user.role !== authRole) {
      throw new Error(`This email belongs to a ${result.user.role} account. Switch account type.`);
    }
    localStorage.setItem('givr_token', result.token);
    applySignedInUser(result.user);
    if (result.user.role === 'organisation') { openOrganisationDashboard(); return; }
    await syncEventsFromServer();
    if (authMode === 'register' || !state.onboarded) startQuiz(); else enterApp();
  } catch (err) {
    showAuthError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = authMode === 'register' ? 'Create account' : 'Log in';
  }
}
function applySignedInUser(user) {
  state.user = { ...user, initials: getInitials(user.name) };
  state.points = Number(user.points || 0);
  state.redeemed = Array.isArray(user.redeemed) ? user.redeemed : (state.redeemed || []);
  state.joinedEvents = Array.isArray(user.joinedEvents) ? user.joinedEvents : (state.joinedEvents || []);
  state.prefs = user.prefs || state.prefs || { causes: [], types: [], style: [], frequency: '' };
  state.onboarded = !!(state.prefs.causes?.length || state.prefs.types?.length);
  saveState();
}
async function syncEventsFromServer() {
  try {
    const result = await apiRequest('/events');
    const serverEvents = result.events || [];
    const ids = new Set(serverEvents.map(e => String(e.id)));
    state.events = [...serverEvents, ...state.events.filter(e => !ids.has(String(e.id)))];
    saveState();
  } catch (e) { console.warn('Sync failed:', e.message); }
}

// ── LOCAL DATA ───────────────────────────────────────────────────────────────
const EVENTS = [
  { id:1, title:'East Coast Beach Cleanup', org:'Green Futures SG', cause:'Environment', img:'images/beachcleanup.jpg', bg:'#E8EDE4', date:'Sat, 28 Sep', time:'9:00 AM', location:'East Coast Park, Singapore', dist:2.4, duration:2, durationLabel:'2 hrs', pts:100, slots:18, desc:"Help keep our shorelines clean! We'll tackle litter across a 2km stretch of East Coast Park beach. Gloves and bags provided. Great for first-timers.", types:['outdoor','hands-on'] },
  { id:2, title:'Animal Shelter Support Day', org:'SPCA Singapore', cause:'Animals', img:'images/animalss.jpg', bg:'#F0EBE1', date:'Sun, 29 Sep', time:'10:00 AM', location:'SPCA, 140 Kim Seng Road', dist:4.1, duration:3, durationLabel:'3 hrs', pts:150, slots:8, desc:'Spend the morning with dogs and cats awaiting adoption. Walk dogs, groom cats, and keep spaces clean.', types:['outdoor','hands-on','animals'] },
  { id:3, title:'Digital Skills for Seniors', org:'Silver Generation Office', cause:'Elderly', img:'images/elderlydigal.jpg', bg:'#F7F3EC', date:'Wed, 2 Oct', time:'2:00 PM', location:'Bedok CC, Block 11 Bedok North', dist:6.8, duration:2, durationLabel:'2 hrs', pts:100, slots:12, desc:'Teach seniors how to use smartphones for video calls, health apps, and online services.', types:['teaching','people'] },
  { id:4, title:'Community Food Distribution', org:'Food from the Heart', cause:'Community', img:'images/fooddistribution.jpg', bg:'#F3E9E3', date:'Sat, 5 Oct', time:'8:00 AM', location:'Ang Mo Kio Hub', dist:8.2, duration:4, durationLabel:'4 hrs', pts:200, slots:25, desc:'Help sort, pack, and distribute food to low-income families and elderly residents.', types:['hands-on','people','community'] },
  { id:5, title:"Children's Reading Programme", org:'ReadAble SG', cause:'Children', img:'images/childreading.jpg', bg:'#E8EDE4', date:'Sat, 12 Oct', time:'10:00 AM', location:'Tampines Public Library', dist:11.3, duration:2, durationLabel:'2 hrs', pts:100, slots:6, desc:'Read aloud to children aged 5–10 and run fun literacy activities.', types:['teaching','people','children'] },
  { id:6, title:'Community Garden Day', org:'NParks SG', cause:'Environment', img:'images/planting.jpg', bg:'#E8EDE4', date:'Sun, 6 Oct', time:'8:30 AM', location:'Bishan-Ang Mo Kio Park', dist:5.1, duration:3, durationLabel:'3 hrs', pts:150, slots:20, desc:'Maintain the community garden — planting, weeding, and learning about urban farming.', types:['outdoor','hands-on','environment'] },
  { id:7, title:'Elderly Home Visits', org:'Care Corner SG', cause:'Elderly', img:'images/elderlyhome.jpg', bg:'#F3E9E3', date:'Sat, 19 Oct', time:'11:00 AM', location:'Various locations, Central SG', dist:3.5, duration:2, durationLabel:'2 hrs', pts:100, slots:10, desc:'Visit elderly residents living alone to provide companionship and simple assistance.', types:['people','community'] },
  { id:8, title:'Wildlife Photography Walk', org:'Nature Society SG', cause:'Environment', img:'images/photographywalk.jpg', bg:'#E8EDE4', date:'Sun, 13 Oct', time:'7:00 AM', location:'Sungei Buloh Wetland Reserve', dist:14.2, duration:4, durationLabel:'4 hrs', pts:200, slots:15, desc:"Document Singapore's native wildlife to support conservation research.", types:['outdoor','environment'] }
];

const PEOPLE = [
  { id:'sarah',  name:'Sarah Lim',   initials:'SL', color:'#4D6644', avatar:'images/sarah.jpg',  bio:'Animal lover and outdoor enthusiast.',                   interests:['Animals','Environment'], mutual:3, events:14, hrs:32, pts:1240, history:['Animal Shelter Support Day','East Coast Beach Cleanup','Community Garden Day'] },
  { id:'marcus', name:'Marcus Tan',  initials:'MT', color:'#A85F40', avatar:'images/marcus.jpg', bio:'Making communities better, one event at a time.',         interests:['Community','Education'], mutual:1, events:9,  hrs:21, pts:900,  history:['Community Food Distribution','Digital Skills for Seniors'] },
  { id:'priya',  name:'Priya Nair',  initials:'PN', color:'#6E8A63', avatar:'images/priya.jpg',  bio:'Passionate about education and empowering youth.',       interests:['Education','Children'],  mutual:2, events:6,  hrs:14, pts:620,  history:["Children's Reading Programme"] },
  { id:'alex',   name:'Alex Chen',   initials:'AC', color:'#8A8480', avatar:'images/alex.jpg',   bio:'Weekend volunteer. Loves dogs and clean beaches.',       interests:['Animals','Community'],   mutual:0, events:3,  hrs:7,  pts:300,  history:[] }
];

const REWARDS = [
  { id:'chagee',    brand:'CHAGEE',         desc:'$5 voucher',  logo:'/images/chagee.webp',    cost:500  },
  { id:'grab',      brand:'Grab',           desc:'$5 voucher',  logo:'/images/grab.png',       cost:600  },
  { id:'ntuc',      brand:'NTUC FairPrice', desc:'$5 voucher',  logo:'/images/ntuc.png',       cost:550  },
  { id:'starbucks', brand:'Starbucks',      desc:'$8 voucher',  logo:'/images/starbucks.webp', cost:800  },
  { id:'shopee',    brand:'Shopee',         desc:'$10 voucher', logo:'/images/shopee.png',     cost:1000 },
  { id:'uniqlo',    brand:'UNIQLO',         desc:'$10 voucher', logo:'/images/uniqlo.png',     cost:1200 }
];

const QUIZ_QUESTIONS = [
  { id:'causes', title:'What causes matter to you?', hint:'Pick as many as you like.', type:'chips',
    options:['Animals','Environment','Elderly','Children','Education','Community'] },
  { id:'types', title:'How do you like to help?', hint:'Choose everything that appeals to you.', type:'chips',
    options:['Hands-on','Outdoor','Organising','Teaching','Digital / online'] },
  { id:'style', title:'What kind of volunteering sounds most like you?', hint:'Choose one or more.', type:'cards',
    options:[
      { title:'Meet people',       desc:"I'd like to meet new people while helping out." },
      { title:'Get hands-on',      desc:"I'd rather be active and involved." },
      { title:'Make a difference', desc:"I want to see a direct impact." },
      { title:'Fit it around me',  desc:"I want something flexible around my schedule." }
    ]},
  { id:'frequency', title:'How often would you like to volunteer?', hint:"No pressure — helps us pace suggestions.", type:'chips',
    options:['Whenever I have time','Once a month','A few times a month','Every week','Just exploring'] }
];

// ── STATE ────────────────────────────────────────────────────────────────────
let state = {
  user: null,
  prefs: { causes:[], types:[], style:[], frequency:'' },
  points: 0,
  events: JSON.parse(JSON.stringify(EVENTS)),
  people: JSON.parse(JSON.stringify(PEOPLE)),
  connections: [],
  savedEvents: [],
  joinedEvents: [],
  redeemed: [],
  chatHistory: {},
  quizStep: 0,
  quizAnswers: { causes:[], types:[], style:[], frequency:[] },
  activeTab: 'home',
  currentEvent: null,
  currentChatId: null,
  currentChatType: null,
  activeCause: 'all',
  filterState: {},
  onboarded: false
};

function saveState() {
  try { localStorage.setItem('givr_state', JSON.stringify(state)); } catch (e) {}
}
function loadState() {
  try { const s = localStorage.getItem('givr_state'); if (s) { state = JSON.parse(s); return true; } } catch (e) {}
  return false;
}

// ── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  loadState();
  setTimeout(async () => {
    document.getElementById('loading').style.display = 'none';
    const token = localStorage.getItem('givr_token');
    if (!token) { state.user = null; showScreen('screen-auth'); return; }
    try {
      const result = await apiRequest('/me');
      applySignedInUser(result.user);
      if (result.user.role === 'organisation') { openOrganisationDashboard(); return; }
      await syncEventsFromServer();
      state.onboarded ? enterApp() : startQuiz();
    } catch (e) {
      localStorage.removeItem('givr_token');
      state.user = null;
      showScreen('screen-auth');
    }
  }, 900);
});

// ── SCREENS ──────────────────────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  document.getElementById('app-shell').classList.remove('active');
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; el.offsetHeight; el.classList.add('active'); }
  requestAnimationFrame(injectCauseIcons);
}
function showAppShell() {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  document.getElementById('app-shell').classList.add('active');
}

// ── TABS ─────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
  document.getElementById('tab-' + tab).style.display = 'block';
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const btn = document.querySelector(`[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');
  if (tab === 'home')     renderHome();
  if (tab === 'explore')  renderExplore();
  if (tab === 'network')  renderNetwork();
  if (tab === 'messages') renderMessages();
  if (tab === 'rewards')  renderRewards();
  requestAnimationFrame(injectCauseIcons);
}

// ── QUIZ ─────────────────────────────────────────────────────────────────────
function startQuiz() {
  state.quizStep = 0;
  state.quizAnswers = { causes:[], types:[], style:[], frequency:[] };
  showScreen('screen-quiz');
  renderQuizStep();
}
function renderQuizStep() {
  const q = QUIZ_QUESTIONS[state.quizStep];
  const pct = ((state.quizStep + 1) / QUIZ_QUESTIONS.length) * 100;
  document.getElementById('quiz-bar').style.width = pct + '%';
  document.getElementById('quiz-prog').textContent = `${state.quizStep + 1} / ${QUIZ_QUESTIONS.length}`;
  document.getElementById('quiz-back-btn').style.visibility = state.quizStep === 0 ? 'hidden' : 'visible';
  document.getElementById('quiz-continue').textContent = 'Continue';
  document.getElementById('quiz-continue').onclick = quizNext;
  const answers = state.quizAnswers[q.id] || [];
  let html = `<div class="quiz-q"><h2>${esc(q.title)}</h2><p class="hint">${esc(q.hint)}</p>`;
  if (q.type === 'chips') {
    html += `<div class="chip-grid">`;
    q.options.forEach(opt => {
      const sel = answers.includes(opt) ? 'selected' : '';
      html += `<div class="chip ${sel}" onclick="toggleQuizAnswer('${q.id}','${esc(opt)}',this)">${esc(opt)}</div>`;
    });
    html += `</div>`;
  } else {
    html += `<div class="card-grid">`;
    q.options.forEach(opt => {
      const sel = answers.includes(opt.title) ? 'selected' : '';
      html += `<div class="q-card ${sel}" onclick="toggleQuizAnswer('${q.id}','${esc(opt.title)}',this)"><h4>${esc(opt.title)}</h4><p>${esc(opt.desc)}</p></div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;
  const body = document.getElementById('quiz-body');
  body.innerHTML = html; body.scrollTop = 0;
}
function toggleQuizAnswer(qid, val, el) {
  const arr = state.quizAnswers[qid];
  const idx = arr.indexOf(val);
  if (idx > -1) { arr.splice(idx, 1); el.classList.remove('selected'); }
  else { arr.push(val); el.classList.add('selected'); }
}
function quizNext() {
  if (state.quizStep < QUIZ_QUESTIONS.length - 1) {
    state.quizStep++;
    renderQuizStep();
  } else {
    state.prefs = {
      causes: state.quizAnswers.causes,
      types:  state.quizAnswers.types,
      style:  state.quizAnswers.style,
      frequency: state.quizAnswers.frequency[0] || ''
    };
    state.onboarded = true;
    saveState();
    if (localStorage.getItem('givr_token')) {
      apiRequest('/me', { method:'PATCH', body:JSON.stringify({ prefs:state.prefs }) })
        .catch(e => console.warn(e.message));
    }
    showQuizDone();
  }
}
function quizBack() { if (state.quizStep > 0) { state.quizStep--; renderQuizStep(); } }
function showQuizDone() {
  document.getElementById('quiz-body').innerHTML = `
    <div class="quiz-done">
      <div class="done-icon"><img src="images/leaves.png" width="32" height="32"></div>
      <h2>You're all set.</h2>
      <p>Your Givr feed is ready. Let's find something worth showing up for.</p>
    </div>`;
  document.getElementById('quiz-prog').textContent = '✓';
  document.getElementById('quiz-bar').style.width = '100%';
  document.getElementById('quiz-back-btn').style.visibility = 'hidden';
  document.getElementById('quiz-continue').textContent = 'Enter Givr';
  document.getElementById('quiz-continue').onclick = enterApp;
}
function openQuizEdit() { closeProfile(); startQuiz(); }

// ── ENTER APP ────────────────────────────────────────────────────────────────
function enterApp() {
  showAppShell();
  updateTopNav();
  switchTab('home');
}
function updateTopNav() {
  document.getElementById('nav-pts').textContent = state.points;
  const btn = document.getElementById('nav-avatar');
  if (state.user?.avatar) {
    btn.innerHTML = `<img src="${esc(state.user.avatar)}" alt="Profile">`;
  } else {
    btn.textContent = state.user ? state.user.initials : 'G';
    btn.style.background = '';
  }
}

// ── PERSONALISATION ──────────────────────────────────────────────────────────
function scoreEvent(ev) {
  let score = 0;
  const causes = state.prefs.causes || [];
  const types  = state.prefs.types  || [];
  if (causes.some(c => ev.cause === c)) score += 3;
  const typeMap = { 'Hands-on':'hands-on','Outdoor':'outdoor','Helping animals':'animals','Helping people':'people','Teaching':'teaching' };
  types.forEach(t => { const m = typeMap[t] || t.toLowerCase(); if (ev.types?.includes(m)) score += 2; });
  return score;
}
function getSortedEvents() { return [...state.events].sort((a,b) => scoreEvent(b) - scoreEvent(a)); }

// ── HOME ─────────────────────────────────────────────────────────────────────
function renderHome() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  document.getElementById('home-greeting').textContent = greet;
  document.getElementById('greeting-name').textContent = state.user ? state.user.name : 'Volunteer';

  const sorted = getSortedEvents().slice(0, 6);
  document.getElementById('home-picks').innerHTML = sorted.map(ev => {
    const saved = state.savedEvents.includes(ev.id);
    const coverInner = ev.coverImage
      ? `<img class="cover-img" src="${esc(ev.coverImage)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`
      : `<img class="cover-img" src="${esc(ev.img)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">`;
    return `
      <div class="event-card-h" onclick="openEvent(${JSON.stringify(ev.id)})">
        <div class="img" style="background:${ev.bg};position:relative;overflow:hidden">
          ${coverInner}
          <button class="save-btn" onclick="toggleSave(event,${JSON.stringify(ev.id)})" style="position:absolute;top:8px;right:8px;z-index:2">${saved ? '<img src="images/save.png" width="20" height="20">' : '<img src="images/unsaved.png" width="20" height="20">'}</button>
          <div class="pts-chip" style="position:absolute;bottom:8px;right:8px;z-index:2">+${ev.pts} pts</div>
        </div>
        <div class="info">
          <div class="cause-label">${esc(ev.cause)}</div>
          <div class="title">${esc(ev.title)}</div>
          <div class="meta"><span>${esc(ev.date)}</span><span>${ev.dist} km · ${esc(ev.durationLabel)}</span></div>
        </div>
      </div>`;
  }).join('');

  const posts = [
    { pid:'sarah',  text:'Just signed up for East Coast Beach Cleanup 🌊 Anyone else joining?', time:'2h ago', tag:'East Coast Beach Cleanup' },
    { pid:'marcus', text:'Completed 4 volunteering events this month! Feeling great 💪',        time:'5h ago', tag:'<img src="images/party.png" width="14" height="14" style="vertical-align:middle;margin-right:4px">200 pts earned' },
    { pid:'priya',  text:'3 people you follow are joining Animal Shelter Support Day this Sunday.', time:'1d ago', tag:'<img src="images/paw.png" width="14" height="14" style="vertical-align:middle;margin-right:4px">Animals' }
  ];
  document.getElementById('social-feed').innerHTML = posts.map(p => {
    const person = state.people.find(x => x.id === p.pid) || {};
    return `
      <div class="social-post">
        <div class="post-header">
          <div class="mini-av" style="background:${person.color || '#4D6644'};width:36px;height:36px">
            ${person.avatar ? `<img src="${esc(person.avatar)}" alt="${esc(person.name || '')}">` : esc(person.initials || '?')}
          </div>
          <div class="post-meta">
            <div class="post-name">${esc(person.name || 'Volunteer')}</div>
            <div class="post-time">${esc(p.time)}</div>
          </div>
        </div>
        <div class="post-body">${esc(p.text)}</div>
        <div class="post-tag">${p.tag}</div>
        <div class="post-actions">
          <button class="post-action like-btn" id="like-${p.pid}" onclick="toggleLike(event,'${p.pid}')"><img src="images/heart.png" width="16" height="16" class="like-icon"> Like</button>
          <button class="post-action" onclick="openDM('${p.pid}')"><img src="images/message.png" width="16" height="16"> Reply</button>
        </div>
      </div>`;
  }).join('');

  document.getElementById('home-people').innerHTML = state.people.slice(0, 3).map(p => {
    const connected = state.connections.includes(p.id);
    const avMarkup = p.avatar
      ? `<div class="av" style="width:44px;height:44px;cursor:pointer" onclick="openUserProfile('${p.id}')"><img src="${esc(p.avatar)}" alt="${esc(p.name)}"></div>`
      : `<div class="av" style="width:44px;height:44px;background:${p.color};font-size:17px;cursor:pointer" onclick="openUserProfile('${p.id}')">${esc(p.initials)}</div>`;
    return `
      <div class="person-row">
        ${avMarkup}
        <div class="info" onclick="openUserProfile('${p.id}')" style="cursor:pointer">
          <div class="name">${esc(p.name)}</div>
          <div class="tags">${esc(p.interests.join(' · '))}</div>
          ${p.mutual ? `<div class="mutual">${p.mutual} mutual connections</div>` : ''}
        </div>
        <button class="connect-btn ${connected ? 'connected' : ''}" onclick="toggleConnect('${p.id}',this)">
          ${connected ? 'Connected' : 'Connect'}
        </button>
      </div>`;
  }).join('');

  const trends = [
    { cause:'Environment', bg:'#E8EDE4', count:'128 volunteers this week' },
    { cause:'Animals',     bg:'#F0EBE1', count:'94 volunteers this week'  },
    { cause:'Elderly',     bg:'#F7F3EC', count:'71 volunteers this week'  },
    { cause:'Community',   bg:'#F3E9E3', count:'58 volunteers this week'  }
  ];
  document.getElementById('trending-list').innerHTML = trends.map(t => `
    <div class="trend-row">
      ${causeTrendIcon(t.cause, t.bg)}
      <div class="info"><div class="name">${esc(t.cause)}</div><div class="count">${esc(t.count)}</div></div>
    </div>`).join('');
}

// ── EXPLORE ──────────────────────────────────────────────────────────────────
async function findEventByCode() {
  const input = document.getElementById('event-code-input');
  const code = (input?.value || '').trim();
  if (!code) { showToast('Enter the event code first'); return; }
  try {
    const result = await apiRequest(`/events/code/${encodeURIComponent(code)}`);
    const event = result.event;
    if (!state.events.some(e => String(e.id) === String(event.id))) state.events.unshift(event);
    saveState(); openEvent(event.id);
  } catch (e) { showToast(e.message); }
}
function renderExplore() { filterEvents(); }
function setCauseFilter(el, cause) {
  state.activeCause = cause;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  filterEvents();
}
function filterEvents() {
  const q = (document.getElementById('explore-search')?.value || '').toLowerCase();
  let evs = getSortedEvents();
  if (state.activeCause !== 'all') evs = evs.filter(e => e.cause === state.activeCause);
  if (q) evs = evs.filter(e =>
    e.title.toLowerCase().includes(q) || e.cause.toLowerCase().includes(q) || e.org.toLowerCase().includes(q));

  if (!evs.length) {
    document.getElementById('explore-list').innerHTML = `
      <div class="empty-state">
        <div class="e-icon"><img src="images/search.png" width="40" height="40"></div>
        <h3>No results</h3>
        <p>Try a different search or filter.</p>
      </div>`;
    return;
  }
  document.getElementById('explore-list').innerHTML = evs.map(ev => {
    const saved  = state.savedEvents.includes(ev.id);
    const joined = state.joinedEvents.includes(ev.id);
    const thumbInner = ev.coverImage
      ? `<img class="cover-thumb" src="${esc(ev.coverImage)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:var(--radius-sm)">`
      : `<img src="${esc(ev.img)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:var(--radius-sm)">`; 
    return `
      <div class="event-item" onclick="openEvent(${JSON.stringify(ev.id)})">
        <div class="ev-img" style="background:${ev.bg};position:relative;overflow:hidden">${thumbInner}</div>
        <div class="ev-body">
          <div class="cause">${esc(ev.cause)}</div>
          <div class="ev-title">${esc(ev.title)}</div>
          <div class="ev-meta">${esc(ev.date)} · ${ev.dist} km · ${esc(ev.durationLabel)}${joined ? ' · <span style="color:var(--sage);font-weight:600">Joined</span>' : ''}</div>
        </div>
        <div class="ev-right">
          <div class="pts-pill">+${ev.pts}</div>
          <button class="save-icon ${saved ? 'saved' : ''}" onclick="toggleSave(event,${JSON.stringify(ev.id)})">${saved ? '<img src="images/save.png" width="20" height="20">' : '<img src="images/unsaved.png" width="20" height="20">'}</button>
        </div>
      </div>`;
  }).join('');
}
function toggleLike(e, pid) {
  e.stopPropagation();
  const btn = e.currentTarget;
  const img = btn.querySelector('.like-icon');
  const isLiked = btn.classList.contains('liked');
  if (isLiked) {
    btn.classList.remove('liked');
    img.src = 'images/heart.png';
    btn.style.color = '';
    btn.style.borderColor = '';
  } else {
    btn.classList.add('liked');
    img.src = 'images/redheart.png';
    img.classList.add('heart-pop');
    setTimeout(() => img.classList.remove('heart-pop'), 400);
    btn.style.color = '#e05c7a';
    btn.style.borderColor = '#e05c7a';
  }
}

function toggleSave(e, id) {
  e.stopPropagation();
  const idx = state.savedEvents.indexOf(id);
  if (idx > -1) { state.savedEvents.splice(idx, 1); showToast('Removed from saved'); }
  else { state.savedEvents.push(id); showToast('Event saved'); }
  saveState();
  if (state.activeTab === 'explore') filterEvents();
  if (state.activeTab === 'home')    renderHome();
}

// ── EVENT DETAIL ─────────────────────────────────────────────────────────────
function openEvent(id) {
  state.currentEvent = id;
  const ev = state.events.find(e => String(e.id) === String(id));
  if (!ev) return;
  const joined = state.joinedEvents.includes(id);
  const saved  = state.savedEvents.includes(id);
  const joiners = state.people.slice(0, 2).map(p => {
    const avMarkup = p.avatar
      ? `<div class="av" style="width:40px;height:40px"><img src="${esc(p.avatar)}" alt="${esc(p.name)}"></div>`
      : `<div class="av" style="width:40px;height:40px;background:${p.color};font-size:16px">${esc(p.initials)}</div>`;
    return `
      <div class="joiner-row">
        ${avMarkup}
        <div class="info"><div class="name">${esc(p.name)}</div><div class="tags">${esc(p.interests.join(' · '))}</div></div>
        <div class="joiner-actions">
          <button class="btn-sm" onclick="openUserProfile('${p.id}')">Profile</button>
          <button class="btn-sm" onclick="openDM('${p.id}')">Message</button>
        </div>
      </div>`;
  }).join('');

  const heroContent = ev.coverImage
    ? `<img class="ev-cover" src="${esc(ev.coverImage)}" alt="${esc(ev.title)}">`
    : `<img class="ev-cover" src="${esc(ev.img)}" alt="${esc(ev.title)}">`;

  document.getElementById('ev-detail-content').innerHTML = `
    <div class="ev-detail-hero" style="background:${ev.bg}">
      ${heroContent}
      <button class="ev-detail-back" onclick="closeEvent()">←</button>
      <button class="ev-detail-save" onclick="toggleSave(event,${JSON.stringify(ev.id)})">${saved ? '<img src="images/save.png" width="20" height="20">' : '<img src="images/unsaved.png" width="20" height="20">'}</button>
    </div>
    <div class="ev-detail-body">
      <div class="ev-org">${esc(ev.org)}</div>
      <h1 class="ev-title-big">${esc(ev.title)}</h1>
      <div class="ev-chips-row">
        <div class="ev-chip">${esc(ev.date)}</div>
        <div class="ev-chip">${esc(ev.time)}</div>
        <div class="ev-chip">${ev.dist} km away</div>
        <div class="ev-chip">${esc(ev.durationLabel)}</div>
        <div class="ev-chip pts">★ +${ev.pts} pts</div>
        ${ev.eventCode ? `<div class="ev-chip">Code: ${esc(ev.eventCode)}</div>` : ''}
      </div>
      <div class="ev-section"><h4>About</h4><p class="ev-desc">${esc(ev.desc)}</p></div>
      <div class="ev-section"><h4>Location</h4><p class="ev-desc">${esc(ev.location)}</p></div>
      <div class="ev-section"><h4>Who's joining</h4><div class="joiners-list">${joiners}</div></div>
      ${joined ? `
        <div class="ev-section">
          <button class="btn-secondary" style="max-width:280px" onclick="completeEvent(${JSON.stringify(ev.id)})">
            ▦ Scan QR to check out
          </button>
        </div>` : ''}
    </div>
    <div class="ev-sticky-footer">
      <div class="slots-info">
        <div class="slots-num">${ev.slots}</div>
        <div class="slots-label">slots</div>
      </div>
      ${joined
        ? `<button class="signup-btn joined" disabled>Joined ✓</button>
           <button class="chat-link" onclick="openEventChat(${JSON.stringify(ev.id)})">Chat →</button>`
        : `<button class="signup-btn" onclick="signUpEvent(${JSON.stringify(ev.id)})">Sign Up</button>`}
    </div>`;
  document.getElementById('screen-event').scrollTop = 0;
  showScreen('screen-event');
}
function closeEvent() {
  showAppShell();
  if (state.activeTab === 'explore') renderExplore(); else renderHome();
}
async function signUpEvent(id) {
  if (state.joinedEvents.some(j => String(j) === String(id))) return;
  try { await apiRequest(`/events/${encodeURIComponent(id)}/join`, { method:'POST', body:'{}' }); }
  catch (e) { showToast(e.message); return; }
  state.joinedEvents.push(id);
  const ev = state.events.find(e => String(e.id) === String(id));
  if (ev) ev.slots = Math.max(0, ev.slots - 1);
  if (!state.chatHistory[`group_${id}`]) {
    state.chatHistory[`group_${id}`] = [
      { from:'sarah',  name:'Sarah',  text:'Hey everyone! 👋',           time:'9:02 AM' },
      { from:'marcus', name:'Marcus', text:`Excited for ${ev?.title || 'this'}!`, time:'9:14 AM' }
    ];
  }
  saveState();
  document.getElementById('youre-in-event-name').textContent =
    `You've signed up for ${ev?.title || 'this event'}.`;
  document.getElementById('youre-in-modal').classList.add('open');
}
function closeYoureIn() {
  document.getElementById('youre-in-modal').classList.remove('open');
  openEvent(state.currentEvent);
}
function goToEventChat() {
  document.getElementById('youre-in-modal').classList.remove('open');
  openEventChat(state.currentEvent);
}
function completeEvent(id) { state.currentEvent = id; openAttendanceScanner(); }

// ── CHAT ─────────────────────────────────────────────────────────────────────
function openEventChat(id) {
  const ev = state.events.find(e => String(e.id) === String(id));
  state.currentChatId   = `group_${id}`;
  state.currentChatType = 'group';
  const avEl = document.getElementById('chat-header-av');
  avEl.innerHTML = ev ? `<img src="${ev.img}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : '<img src="images/message.png" width="44" height="44">';
  avEl.style.background = 'transparent';
  avEl.style.fontSize = '22px';
  document.getElementById('chat-header-name').textContent = ev?.title || 'Event Chat';
  document.getElementById('chat-header-sub').textContent = 'Group chat';
  document.getElementById('chat-back').onclick = () => showScreen('screen-event');
  renderChat(); showScreen('screen-chat');
}
function openDM(pid) {
  const p = state.people.find(x => x.id === pid); if (!p) return;
  state.currentChatId   = `dm_${pid}`;
  state.currentChatType = 'dm';
  if (!state.chatHistory[state.currentChatId]) state.chatHistory[state.currentChatId] = [];
  const avEl = document.getElementById('chat-header-av');
  if (p.avatar) {
    avEl.innerHTML = `<img src="${esc(p.avatar)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    avEl.style.background = 'transparent'; avEl.style.fontSize = '0';
  } else {
    avEl.textContent = p.initials; avEl.style.background = p.color; avEl.style.fontSize = '16px';
  }
  document.getElementById('chat-header-name').textContent = p.name;
  document.getElementById('chat-header-sub').textContent  = p.interests.join(' · ');
  document.getElementById('chat-back').onclick = () => {
    showAppShell();
    if (state.activeTab === 'messages') renderMessages(); else renderHome();
  };
  renderChat(); showScreen('screen-chat');
}
function renderChat() {
  const msgs = state.chatHistory[state.currentChatId] || [];
  let html = `<div class="chat-date-sep">Today</div>`;
  msgs.forEach(m => {
    if (m.from === 'me') {
      html += `<div class="chat-bubble-wrap me"><div class="chat-bubble me">${esc(m.text)}</div></div>`;
    } else {
      const p = state.people.find(x => x.id === m.from);
      const cbAv = p?.avatar
        ? `<div class="cb-av" style="background:${p?.color||'#4D6644'};overflow:hidden"><img src="${esc(p.avatar)}" style="width:100%;height:100%;object-fit:cover"></div>`
        : `<div class="cb-av" style="background:${p?.color||'#4D6644'}">${esc(m.name?.[0]||'?')}</div>`;
      html += `<div class="chat-bubble-wrap">${cbAv}<div><div class="cb-name">${esc(m.name||'')}</div><div class="chat-bubble other">${esc(m.text)}</div></div></div>`;
    }
  });
  document.getElementById('chat-messages').innerHTML = html;
  setTimeout(() => { const el = document.getElementById('chat-messages'); el.scrollTop = el.scrollHeight; }, 40);
}
function sendMsg() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim(); if (!text) return;
  if (!state.chatHistory[state.currentChatId]) state.chatHistory[state.currentChatId] = [];
  state.chatHistory[state.currentChatId].push({
    from:'me', text,
    time: new Date().toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit' })
  });
  input.value = ''; renderChat(); saveState();
  if (state.currentChatType === 'group') {
    setTimeout(() => {
      const replies = ["Can't wait! 🙌", 'See you all there!', 'This is going to be great 🌱', "I'll bring a friend too!"];
      const ri = Math.floor(Math.random() * 2);
      const names = ['Sarah','Marcus']; const froms = ['sarah','marcus'];
      state.chatHistory[state.currentChatId].push({
        from: froms[ri], name: names[ri],
        text: replies[Math.floor(Math.random() * replies.length)],
        time: new Date().toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit' })
      });
      renderChat(); saveState();
    }, 1100);
  }
}

// ── NETWORK ──────────────────────────────────────────────────────────────────
function renderNetwork() { renderSuggestions(); renderConnections(); }
function switchNetworkTab(tab, el) {
  document.querySelectorAll('.ntab').forEach(t => t.classList.remove('active')); el.classList.add('active');
  document.getElementById('network-suggestions').style.display = tab === 'suggestions' ? 'block' : 'none';
  document.getElementById('network-connections').style.display = tab === 'connections'  ? 'block' : 'none';
}
function personRowHtml(p, showConnect = true, extraBtn = '') {
  const avMarkup = p.avatar
    ? `<div class="av" style="width:44px;height:44px;cursor:pointer" onclick="openUserProfile('${p.id}')"><img src="${esc(p.avatar)}" alt="${esc(p.name)}"></div>`
    : `<div class="av" style="width:44px;height:44px;background:${p.color};font-size:17px;cursor:pointer" onclick="openUserProfile('${p.id}')">${esc(p.initials)}</div>`;
  const connected = state.connections.includes(p.id);
  return `
    <div class="person-row">
      ${avMarkup}
      <div class="info" onclick="openUserProfile('${p.id}')" style="cursor:pointer">
        <div class="name">${esc(p.name)}</div>
        <div class="tags">${esc(p.interests.join(' · '))}</div>
        <div class="mutual">${p.mutual ? `${p.mutual} mutual connections` : 'New to Givr'}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        ${showConnect ? `<button class="connect-btn ${connected ? 'connected' : ''}" onclick="toggleConnect('${p.id}',this)">${connected ? 'Connected' : 'Connect'}</button>` : ''}
        <button class="message-btn" onclick="openDM('${p.id}')">Message</button>
        ${extraBtn}
      </div>
    </div>`;
}
function renderSuggestions() {
  const unconnected = state.people.filter(p => !state.connections.includes(p.id));
  document.getElementById('suggestions-list').innerHTML = unconnected.length
    ? unconnected.map(p => personRowHtml(p)).join('')
    : `<div class="empty-state"><div class="e-icon"><img src="images/leaves.png" width="40" height="40"></div><h3>You know everyone!</h3><p>Suggestions refresh as new volunteers join.</p></div>`;
}
function renderConnections() {
  const connected = state.connections.map(id => state.people.find(x => x.id === id)).filter(Boolean);
  document.getElementById('connections-list').innerHTML = connected.length
    ? connected.map(p => personRowHtml(p, false)).join('')
    : `<div class="empty-state"><div class="e-icon"><img src="images/team.png" width="40" height="40"></div><h3>No connections yet.</h3><p>Connect with volunteers who share your interests.</p></div>`;
}
function toggleConnect(id, btn) {
  const idx = state.connections.indexOf(id);
  if (idx > -1) { state.connections.splice(idx, 1); btn.textContent = 'Connect'; btn.classList.remove('connected'); showToast('Connection removed'); }
  else { state.connections.push(id); btn.textContent = 'Connected'; btn.classList.add('connected'); showToast('Connected!'); }
  saveState();
  if (state.activeTab === 'network') { renderSuggestions(); renderConnections(); }
}

// ── PEOPLE SEARCH (home section) ─────────────────────────────────────────────
function togglePeopleSearch() {
  const bar = document.getElementById('people-search-bar');
  const input = document.getElementById('people-search-input');
  const isOpen = bar.style.display !== 'none';
  bar.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    input.value = '';
    document.getElementById('people-search-results').innerHTML = '';
    input.focus();
  }
}
function filterPeopleSearch(query) {
  const out = document.getElementById('people-search-results');
  if (!query.trim()) { out.innerHTML = ''; return; }
  const q = query.toLowerCase();
  const hits = state.people.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.interests.some(i => i.toLowerCase().includes(q))
  );
  if (!hits.length) {
    out.innerHTML = '<p style="font-size:13px;color:var(--text2);padding:8px 4px">No people found.</p>';
    return;
  }
  out.innerHTML = hits.map(p => {
    const av = p.avatar
      ? `<img src="${esc(p.avatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0">`
      : `<div style="width:40px;height:40px;border-radius:50%;background:${p.color};flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px">${esc(p.initials)}</div>`;
    const connected = state.connections.includes(p.id);
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border2)">
      ${av}
      <div style="flex:1;cursor:pointer" onclick="openUserProfile('${p.id}')">
        <div style="font-size:14px;font-weight:500;color:var(--text)">${esc(p.name)}</div>
        <div style="font-size:12px;color:var(--text2)">${esc(p.interests.join(' · '))}</div>
      </div>
      <button onclick="toggleConnect('${p.id}',this)"
        style="padding:6px 14px;border-radius:20px;border:1.5px solid var(--sage);
               background:${connected ? 'var(--sage)' : 'transparent'};
               color:${connected ? '#fff' : 'var(--sage)'};font-size:13px;cursor:pointer">
        ${connected ? 'Connected' : 'Connect'}
      </button>
    </div>`;
  }).join('');
}

// ── MESSAGES SEARCH ───────────────────────────────────────────────────────────
function toggleMsgSearch() {
  const bar = document.getElementById('msg-search-bar');
  const input = document.getElementById('msg-search-input');
  const isOpen = bar.style.display !== 'none';
  bar.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    input.value = '';
    document.getElementById('msg-search-results').innerHTML = '';
    input.focus();
  }
}
function filterMsgSearch(query) {
  const out = document.getElementById('msg-search-results');
  if (!query.trim()) { out.innerHTML = ''; return; }
  const q = query.toLowerCase();
  const hits = state.people.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.interests.some(i => i.toLowerCase().includes(q))
  );
  if (!hits.length) {
    out.innerHTML = '<p style="font-size:13px;color:var(--text2);padding:8px 4px">No people found.</p>';
    return;
  }
  out.innerHTML = hits.map(p => {
    const av = p.avatar
      ? `<img src="${esc(p.avatar)}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0">`
      : `<div style="width:40px;height:40px;border-radius:50%;background:${p.color};flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px">${esc(p.initials)}</div>`;
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border2);cursor:pointer"
         onclick="openDM('${p.id}')">
      ${av}
      <div style="flex:1">
        <div style="font-size:14px;font-weight:500;color:var(--text)">${esc(p.name)}</div>
        <div style="font-size:12px;color:var(--text2)">${esc(p.interests.join(' · '))}</div>
      </div>
      <div style="font-size:12px;color:var(--sage);font-weight:500">Message →</div>
    </div>`;
  }).join('');
}

// ── MESSAGES ─────────────────────────────────────────────────────────────────
function renderMessages() {
  document.getElementById('msg-badge').style.display = 'none';
  let html = '';
  if (state.joinedEvents.length) {
    html += `<div class="msg-label">Event chats</div>`;
    state.joinedEvents.forEach(id => {
      const ev = state.events.find(e => String(e.id) === String(id));
      const history = state.chatHistory[`group_${id}`] || [];
      const last = history[history.length - 1];
      html += `
        <div class="msg-row" onclick="openEventChat(${id})">
          <div class="av" style="width:44px;height:44px;overflow:hidden;border-radius:50%"><img src="${ev?.img||'images/message.png'}" style="width:100%;height:100%;object-fit:cover"></div>
          <div class="body">
            <div class="name-row"><div class="name">${esc(ev?.title||'Event Chat')}</div><div class="time">${esc(last?.time||'')}</div></div>
            <div class="preview">${last ? esc(`${last.name||'You'}: ${last.text}`) : 'Say hi to the group!'}</div>
          </div>
        </div>`;
    });
  }
  const dmKeys = Object.keys(state.chatHistory).filter(k => k.startsWith('dm_'));
  html += `<div class="msg-label">Direct messages</div>`;
  const shownDMs = new Set(dmKeys);
  dmKeys.forEach(k => {
    const pid = k.replace('dm_','');
    const p = state.people.find(x => x.id === pid);
    const history = state.chatHistory[k] || [];
    const last = history[history.length - 1];
    const unread = last && last.from !== 'me';
    const avContent = p?.avatar
      ? `<img src="${esc(p.avatar)}" alt="${esc(p?.name||'')}">` : esc(p?.initials||'?');
    html += `
      <div class="msg-row" onclick="openDM('${pid}')">
        <div class="av" style="background:${p?.color||'#9B9590'};width:44px;height:44px">${avContent}</div>
        <div class="body">
          <div class="name-row"><div class="name ${unread?'unread':''}">${esc(p?.name||pid)}</div><div class="time">${esc(last?.time||'')}</div></div>
          <div class="preview ${unread?'unread':''}">${esc(last?.text||'')}</div>
        </div>
        ${unread ? '<div class="unread-dot"></div>' : ''}
      </div>`;
  });
  if (!shownDMs.has('dm_sarah')) {
    html += `<div class="msg-row" onclick="openDM('sarah')"><div class="av" style="background:#4D6644;width:44px;height:44px"><img src="images/sarah.jpg" alt="Sarah"></div><div class="body"><div class="name-row"><div class="name unread">Sarah Lim</div><div class="time">10:22 AM</div></div><div class="preview unread">Anyone heading there from town?</div></div><div class="unread-dot"></div></div>`;
  }
  if (!shownDMs.has('dm_marcus')) {
    html += `<div class="msg-row" onclick="openDM('marcus')"><div class="av" style="background:#A85F40;width:44px;height:44px"><img src="images/marcus.jpg" alt="Marcus"></div><div class="body"><div class="name-row"><div class="name unread">Marcus Tan</div><div class="time">8:45 AM</div></div><div class="preview unread">I'll be there around 8:30.</div></div><div class="unread-dot"></div></div>`;
  }
  if (!html.includes('msg-row')) {
    html = `<div class="empty-state"><div class="e-icon"><img src="images/message.png" width="40" height="40"></div><h3>No messages yet.</h3><p>Connect with volunteers to start a conversation.</p><button class="e-btn" onclick="switchTab('network')">Find volunteers</button></div>`;
  }
  document.getElementById('messages-list').innerHTML = html;
}

// ── REWARDS ──────────────────────────────────────────────────────────────────
function renderRewards() {
  renderTierSystem(state.points);
  const sorted = [...REWARDS].sort((a, b) => {
    const aR = state.redeemed.some(x => x.rewardId === a.id);
    const bR = state.redeemed.some(x => x.rewardId === b.id);
    const aA = state.points >= a.cost;
    const bA = state.points >= b.cost;
    const aG = aR ? 2 : aA ? 0 : 1;
    const bG = bR ? 2 : bA ? 0 : 1;
    return aG - bG || a.cost - b.cost;
  });
  document.getElementById('rewards-grid').innerHTML = sorted.map(r => {
    const canAfford = state.points >= r.cost;
    const redeemed  = state.redeemed.some(x => x.rewardId === r.id);
    const disabled  = redeemed || !canAfford;
    const btnText   = redeemed ? 'Redeemed' : canAfford ? 'Redeem' : `Need ${r.cost - state.points} more`;
    return `
      <article class="reward-card ${disabled ? 'reward-unavailable' : ''}">
        <div class="reward-brand">
          <img src="${esc(r.logo)}" alt="${esc(r.brand)}" class="brand-logo">
          <div class="reward-brand-name">${esc(r.brand)}</div>
        </div>
        <div class="reward-desc">${esc(r.desc)}</div>
        <div class="reward-card-footer">
          <div class="reward-pts">★ ${r.cost}</div>
          <button class="redeem-btn ${disabled ? 'disabled' : ''}" ${disabled ? 'disabled' : `onclick="redeemReward('${r.id}')"`}>${btnText}</button>
        </div>
      </article>`;
  }).join('');

  const redemptions = state.redeemed;
  const titleEl = document.getElementById('redeemed-section-title');
  if (redemptions.length) {
    titleEl.style.display = 'block';
    document.getElementById('redeemed-list').innerHTML = [...redemptions].reverse().map(r => {
      const reward = REWARDS.find(x => x.id === r.rewardId);
      return `
        <div class="redeemed-item">
          <div>
            <div class="brand">${esc(reward ? `${reward.brand} ${reward.desc}` : r.rewardId)}</div>
            <div class="date">${esc(r.date)}</div>
          </div>
          <div class="code">${esc(r.code)}</div>
        </div>`;
    }).join('');
  } else {
    titleEl.style.display = 'none';
  }
}
async function redeemReward(id) {
  const reward = REWARDS.find(r => r.id === id);
  if (!reward || state.points < reward.cost) { showToast('Not enough points'); return; }
  try {
    const result = await apiRequest('/rewards/redeem', { method:'POST', body:JSON.stringify({ rewardId:id }) });
    state.points = result.totalPoints;
    state.redeemed.push(result.redeemed);
    if (state.user) state.user.points = result.totalPoints;
    updateTopNav(); saveState();
    document.getElementById('redeem-reward-name').textContent = `${reward.brand} ${reward.desc}`;
    document.getElementById('redeem-code').textContent = result.redeemed.code;
    document.getElementById('redeem-modal').classList.add('open');
  } catch (e) { showToast(e.message); }
}
function closeRedeemModal() {
  document.getElementById('redeem-modal').classList.remove('open');
  renderRewards();
}

// ── OWN PROFILE ──────────────────────────────────────────────────────────────
function openProfile() {
  const u = state.user || {};
  document.getElementById('profile-name').textContent = u.name || 'Volunteer';
  document.getElementById('profile-email').textContent = u.email || '';
  const avEl = document.getElementById('profile-av');
  if (u.avatar) {
    avEl.innerHTML = `<img src="${esc(u.avatar)}" alt="Profile photo">`;
  } else {
    avEl.textContent = u.initials || getInitials(u.name) || 'G';
    avEl.style.background = '';
  }
  document.getElementById('pstat-events').textContent = state.joinedEvents.length + 8;
  document.getElementById('pstat-hrs').textContent    = state.joinedEvents.length * 2 + 18;
  document.getElementById('pstat-pts').textContent    = state.points;
  document.getElementById('pstat-conns').textContent  = state.connections.length + 4;

  const causes = state.prefs.causes?.length ? state.prefs.causes : ['Animals','Environment','Community'];
  document.getElementById('profile-tags').innerHTML = causes.map(t => `<div class="tag">${esc(t)}</div>`).join('');

  const defaultHistory = [
    { img:'images/beach.png',  name:'East Coast Beach Cleanup',  date:'Sep 28, 2026' },
    { img:'images/paw.png',    name:'Animal Shelter Support Day', date:'Sep 15, 2026' },
    { img:'images/leaves.png', name:'Community Garden Day',       date:'Aug 30, 2026' }
  ];
  const recentJoined = state.joinedEvents.map(id => {
    const ev = state.events.find(e => String(e.id) === String(id));
    return ev ? { img:ev.img, name:ev.title, date:'Recently' } : null;
  }).filter(Boolean);
  const allHistory = [...recentJoined, ...defaultHistory].slice(0, 5);
  document.getElementById('profile-history').innerHTML = allHistory.map(h => `
    <div class="history-item">
      <div class="h-icon"><img src="${h.img}" alt="${esc(h.name)}"></div>
      <div class="h-info"><div class="name">${esc(h.name)}</div><div class="date">${esc(h.date)}</div></div>
    </div>`).join('');
  showScreen('screen-profile');
}
function closeProfile() { showAppShell(); renderHome(); }
async function logout() {
  try { await apiRequest('/auth/logout', { method:'POST', body:'{}' }); } catch (e) {}
  localStorage.removeItem('givr_token');
  state.user = null; state.onboarded = false; state.points = 0; saveState();
  stopQrScanner(); showScreen('screen-auth');
}
function uploadProfilePhoto(event) {
  const file = event.target.files?.[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Choose an image file'); return; }
  if (file.size > 600000) { showToast('Photo must be under 600 KB'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const result = await apiRequest('/me', { method:'PATCH', body:JSON.stringify({ avatar:reader.result }) });
      state.user.avatar = result.user.avatar;
      updateTopNav(); openProfile(); saveState(); showToast('Profile photo updated');
    } catch (e) { showToast(e.message); }
  };
  reader.readAsDataURL(file);
}

// ── OTHER USER PROFILE ───────────────────────────────────────────────────────
function openUserProfile(id) {
  const p = state.people.find(x => x.id === id); if (!p) return;
  const connected = state.connections.includes(id);
  const avMarkup = p.avatar
    ? `<div class="profile-av" style="width:72px;height:72px;font-size:0"><img src="${esc(p.avatar)}" alt="${esc(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%"></div>`
    : `<div class="profile-av" style="width:72px;height:72px;background:${p.color};font-size:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700">${esc(p.initials)}</div>`;
  document.getElementById('user-profile-content').innerHTML = `
    <button class="up-back" onclick="showAppShell()">← Back</button>
    <div class="up-hero">
      <div class="up-top">
        ${avMarkup}
        <div><div class="profile-name">${esc(p.name)}</div><div class="profile-email">"${esc(p.bio)}"</div></div>
      </div>
      <div class="profile-stats-row" style="margin:0">
        <div class="pstat"><div class="pstat-num">${p.events}</div><div class="pstat-lab">Events</div></div>
        <div class="pstat"><div class="pstat-num">${p.hrs}</div><div class="pstat-lab">Hours</div></div>
        <div class="pstat"><div class="pstat-num">${p.pts}</div><div class="pstat-lab">Points</div></div>
      </div>
      <div class="up-actions">
        <button class="up-connect ${connected ? 'connected' : ''}" id="up-conn-${id}" onclick="toggleConnect('${id}',this)">${connected ? 'Connected ✓' : 'Connect'}</button>
        <button class="up-msg" onclick="openDM('${id}')">Message</button>
      </div>
    </div>
    <div class="profile-section">
      <h4>Interests</h4>
      <div class="tag-list">${p.interests.map(t => `<div class="tag">${esc(t)}</div>`).join('')}</div>
    </div>
    <div class="profile-section">
      <h4>Volunteering history</h4>
      <div class="profile-history">
        ${p.history.length
          ? p.history.map(h => `<div class="history-item"><div class="h-icon"><img src="images/leaves.png" alt="${esc(h)}"></div><div class="h-info"><div class="name">${esc(h)}</div></div></div>`).join('')
          : '<p style="font-size:14px;color:var(--text3)">New to Givr</p>'}
      </div>
    </div>`;
  document.getElementById('screen-user-profile').scrollTop = 0;
  showScreen('screen-user-profile');
}

// ── ORGANISATION PORTAL ──────────────────────────────────────────────────────
function openOrganisationDashboard() {
  if (!state.user || state.user.role !== 'organisation') { showScreen('screen-auth'); return; }
  document.getElementById('org-welcome-name').textContent = `Welcome, ${state.user.name}.`;
  showScreen('screen-org');
  loadOrganisationEvents();
}

function handleCoverUpload(event) {
  const file = event.target.files?.[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Choose an image file'); return; }
  if (file.size > 1500000) { showToast('Image must be under 1.5 MB'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    pendingCoverImageData = reader.result;
    const preview = document.getElementById('org-cover-preview');
    preview.innerHTML = `<img src="${esc(reader.result)}" alt="Cover preview">`;
  };
  reader.readAsDataURL(file);
}

async function createOrganisationEvent(event) {
  event.preventDefault();
  const errorEl = document.getElementById('org-event-error'); errorEl.textContent = '';
  const submit = document.getElementById('org-event-form').querySelector('button[type="submit"]');
  const dateRaw = document.getElementById('org-event-date').value;
  const timeRaw = document.getElementById('org-event-time').value;
  const date = dateRaw ? new Date(`${dateRaw}T12:00:00`).toLocaleDateString('en-SG', { weekday:'short', day:'numeric', month:'short', year:'numeric' }) : '';
  const time = timeRaw ? new Date(`2000-01-01T${timeRaw}:00`).toLocaleTimeString('en-SG', { hour:'numeric', minute:'2-digit' }) : '';
  const payload = {
    title:    document.getElementById('org-event-title').value.trim(),
    cause:    document.getElementById('org-event-cause').value,
    date, time,
    location: document.getElementById('org-event-location').value.trim(),
    slots:    Number(document.getElementById('org-event-slots').value),
    pts:      Number(document.getElementById('org-event-points').value),
    desc:     document.getElementById('org-event-desc').value.trim(),
    coverImage: pendingCoverImageData || null
  };
  submit.disabled = true; submit.textContent = 'Publishing…';
  try {
    const result = await apiRequest('/events', { method:'POST', body:JSON.stringify(payload) });
    document.getElementById('org-event-form').reset();
    document.getElementById('org-cover-preview').innerHTML = `<span class="cover-placeholder-icon"><img src="images/image.png" width="32" height="32"></span><span class="cover-placeholder-text">Add a cover image (optional)</span>`;
    pendingCoverImageData = null;
    showToast(`Published · Code: ${result.event.eventCode}`);
    await loadOrganisationEvents();
  } catch (e) { errorEl.textContent = e.message; }
  finally { submit.disabled = false; submit.textContent = 'Publish opportunity'; }
}

async function loadOrganisationEvents() {
  const container = document.getElementById('org-events-list'); if (!container) return;
  container.innerHTML = '<p class="muted-text">Loading…</p>';
  try {
    const result = await apiRequest('/org/events');
    currentOrgEvents = result.events || [];
    if (!currentOrgEvents.length) {
      container.innerHTML = '<div class="org-empty"><strong>No opportunities yet</strong><p>Published events will appear here.</p></div>';
      return;
    }
    container.innerHTML = currentOrgEvents.map((ev, index) => {
      const coverHtml = ev.coverImage
        ? `<img class="org-event-cover" src="${esc(ev.coverImage)}" alt="${esc(ev.title)}">`
        : `<div class="org-event-cover-placeholder"><img src="${ev.img || 'images/leaves.png'}" style="width:100%;height:100%;object-fit:cover;border-radius:12px"></div>`;
      const attendeesHtml = ev.attendees.length
        ? ev.attendees.map(a => {
            const avContent = a.avatar ? `<img src="${esc(a.avatar)}" alt="${esc(a.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : esc(getInitials(a.name));
            return `
              <div class="org-attendee">
                <div class="org-att-av" style="${!a.avatar ? 'background:var(--sage-light);color:var(--sage)' : ''}">${avContent}</div>
                <div class="org-att-info">
                  <div class="att-name">${esc(a.name)}</div>
                  <div class="att-email">${esc(a.email)}</div>
                </div>
                <div class="att-status ${a.completed ? 'done' : 'pending'}">${a.completed ? 'Checked out' : 'Pending'}</div>
              </div>`;
          }).join('')
        : '<p class="muted-text" style="padding:8px 0">No sign-ups yet.</p>';
      return `
        <article class="org-event-card">
          ${coverHtml}
          <div class="org-event-main">
            <div class="event-cause-label">${esc(ev.cause)}</div>
            <h3>${esc(ev.title)}</h3>
            <p>${esc(ev.date)} · ${esc(ev.time)} · ${esc(ev.location)}</p>
            <div class="event-code-pill">
              Event code <strong>${esc(ev.eventCode)}</strong>
              <button onclick="copyText('${esc(ev.eventCode)}')">Copy</button>
            </div>
            <div class="org-event-stats">
              <span><img src="images/team.png" width="16" height="16"> ${ev.attendees.length} signed up</span>
              <span>✓ ${ev.attendees.filter(a => a.completed).length} checked out</span>
              <span>🎫 ${ev.slots} slots</span>
            </div>
          </div>
          <div class="org-qr-section">
            <div>
              <div class="org-qr" id="org-qr-${index}"></div>
            </div>
            <div class="org-qr-info">
              <small>Show this QR code at the end of the event for check-out.</small>
              <button class="btn-ghost-sm" onclick="copyText('GIVR_ATTENDANCE:${esc(ev.id)}:${esc(ev.attendanceToken)}')">Copy QR payload</button>
            </div>
          </div>
          <div class="org-event-actions">
            <button onclick=...><img src="images/team.png" width="16" height="16"> View participants (${ev.attendees.length})</button>
            <button class="btn-view-chat" onclick="openOrgEventChat(${JSON.stringify(ev.id)})">💬 Group chat</button>
          </div>
          <div style="padding:0 16px 16px;display:none" id="attendees-inline-${index}">
            ${attendeesHtml}
          </div>
        </article>`;
    }).join('');

    currentOrgEvents.forEach((ev, index) => {
      const qrEl = document.getElementById(`org-qr-${index}`); if (!qrEl) return;
      const payload = `GIVR_ATTENDANCE:${ev.id}:${ev.attendanceToken}`;
      if (window.QRCode) {
        new QRCode(qrEl, { text:payload, width:120, height:120, colorDark:'#1E1C18', colorLight:'#FFFFFF', correctLevel:QRCode.CorrectLevel.M });
      } else {
        qrEl.innerHTML = `<div class="qr-fallback">QR library unavailable.<code>${esc(payload)}</code></div>`;
      }
    });
  } catch (e) { container.innerHTML = `<p class="auth-error" style="padding:16px">${esc(e.message)}</p>`; }
}

function showAttendeesModal(index) {
  const ev = currentOrgEvents[index]; if (!ev) return;
  document.getElementById('attendees-modal-title').textContent = `${ev.title} — Participants (${ev.attendees.length})`;
  const list = document.getElementById('attendees-modal-list');
  if (!ev.attendees.length) {
    list.innerHTML = '<p class="muted-text" style="padding:16px">No sign-ups yet.</p>';
  } else {
    list.innerHTML = ev.attendees.map(a => {
      const avContent = a.avatar ? `<img src="${esc(a.avatar)}" alt="${esc(a.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : esc(getInitials(a.name));
      return `
        <div class="org-attendee">
          <div class="org-att-av" style="${!a.avatar ? 'background:var(--sage-light);color:var(--sage)' : ''}">${avContent}</div>
          <div class="org-att-info">
            <div class="att-name">${esc(a.name)}</div>
            <div class="att-email">${esc(a.email)}</div>
          </div>
          <div class="att-status ${a.completed ? 'done' : 'pending'}">${a.completed ? '✓ Out' : 'Pending'}</div>
        </div>`;
    }).join('');
  }
  document.getElementById('attendees-modal').classList.add('open');
}
function closeAttendeesModal(e) {
  if (!e || e.target === document.getElementById('attendees-modal')) {
    document.getElementById('attendees-modal').classList.remove('open');
  }
}

function openOrgEventChat(eventId) {
  const ev = currentOrgEvents.find(e => String(e.id) === String(eventId));
  state.currentChatId = `group_${eventId}`;
  state.currentChatType = 'group';
  if (!state.chatHistory[state.currentChatId]) state.chatHistory[state.currentChatId] = [];
  const avEl = document.getElementById('chat-header-av');
  avEl.innerHTML = ev ? `<img src="${ev.img}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : '<img src="images/message.png" width="44" height="44">';
  avEl.style.background = 'transparent'; avEl.style.fontSize = '22px';
  document.getElementById('chat-header-name').textContent = ev?.title || 'Event Chat';
  document.getElementById('chat-header-sub').textContent = 'Group chat';
  document.getElementById('chat-back').onclick = () => showScreen('screen-org');
  renderChat(); showScreen('screen-chat');
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied')).catch(() => showToast(text));
  } else { showToast(text); }
}

// ── QR SCANNER ───────────────────────────────────────────────────────────────
function openAttendanceScanner() {
  showScreen('screen-scanner');
  // Auto-start camera after short delay for screen transition
  setTimeout(() => startQrScanner(), 300);
}

function openSavedEvents() {
  const list = document.getElementById('saved-events-list');
  if (!state.savedEvents.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="e-icon"><img src="images/save.png" width="40" height="40"></div>
      <h3>No saved events yet.</h3>
      <p>Tap the bookmark icon on any event to save it here.</p>
    </div>`;
  } else {
    list.innerHTML = state.savedEvents.map(id => {
      const ev = state.events.find(e => String(e.id) === String(id));
      if (!ev) return '';
      return `
        <div class="event-item" onclick="openEvent(${JSON.stringify(ev.id)})">
          <div class="ev-img" style="background:${ev.bg};position:relative;overflow:hidden"><img src="${esc(ev.img)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:var(--radius-sm)"></div>
          <div class="ev-body">
            <div class="cause">${esc(ev.cause)}</div>
            <div class="ev-title">${esc(ev.title)}</div>
            <div class="ev-meta">${esc(ev.date)} · ${ev.dist} km · ${esc(ev.durationLabel)}</div>
          </div>
          <div class="ev-right">
            <div class="pts-pill">+${ev.pts}</div>
          </div>
        </div>`;
    }).join('');
  }
  showScreen('screen-scan');
}

function closeSavedEvents() {
  closeProfile();
}

async function startQrScanner() {
  const msg = document.getElementById('scan-message');
  if (!msg) return;
  if (!('BarcodeDetector' in window)) {
    msg.textContent = 'Auto QR scanning not supported here. Use your camera app or paste the QR content below.';
    return;
  }
  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:'environment' } }, audio:false });
    const video = document.getElementById('qr-video');
    video.srcObject = qrStream; video.style.display = 'block';
    document.getElementById('scanner-placeholder').style.display = 'none';
    await video.play();
    const detector = new BarcodeDetector({ formats:['qr_code'] });
    qrScanActive = true;
    document.getElementById('start-scan-btn').textContent = 'Scanning…';
    const scan = async () => {
      if (!qrScanActive) return;
      try {
        const codes = await detector.detect(video);
        if (codes.length && codes[0].rawValue) {
          document.getElementById('qr-payload-input').value = codes[0].rawValue;
          stopQrScanner(); await submitAttendancePayload(); return;
        }
      } catch (e) {}
      requestAnimationFrame(scan);
    };
    scan();
  } catch (e) {
    if (msg) msg.textContent = 'Camera access failed. Allow camera access or paste the QR content below.';
  }
}
function stopQrScanner() {
  qrScanActive = false;
  if (qrStream) { qrStream.getTracks().forEach(t => t.stop()); qrStream = null; }
  const video = document.getElementById('qr-video');
  if (video) { video.pause(); video.srcObject = null; video.style.display = 'none'; }
  const ph = document.getElementById('scanner-placeholder');
  if (ph) ph.style.display = 'flex';
  const btn = document.getElementById('start-scan-btn');
  if (btn) btn.textContent = 'Open camera';
}
function closeAttendanceScanner() {
  stopQrScanner();
  if (state.currentEvent) openEvent(state.currentEvent);
  else { showAppShell(); switchTab('home'); }
}
async function submitAttendancePayload() {
  const payloadEl = document.getElementById('qr-payload-input');
  if (!payloadEl) return;
  const payload = payloadEl.value.trim();
  const match = payload.match(/^GIVR_ATTENDANCE:([^:]+):([a-f0-9]+)$/i);
  if (!match) { document.getElementById('scan-message').textContent = 'QR content does not look like a Givr attendance code.'; return; }
  try {
    const result = await apiRequest(`/events/${encodeURIComponent(match[1])}/complete`, {
      method:'POST', body:JSON.stringify({ payload })
    });
    state.points = result.totalPoints;
    if (state.user) state.user.points = result.totalPoints;
    state.completedEvents = state.completedEvents || [];
    if (!state.completedEvents.some(id => String(id) === String(match[1]))) state.completedEvents.push(match[1]);
    updateTopNav(); saveState(); stopQrScanner();
    document.getElementById('scan-message').textContent = `Confirmed for ${result.eventTitle}. +${result.pointsEarned} pts!`;
    showPointsAnim(`+${result.pointsEarned} pts`, 'Attendance verified. Thank you!');
    setTimeout(() => { showAppShell(); switchTab('rewards'); }, 1800);
  } catch (e) { document.getElementById('scan-message').textContent = e.message; }
}

// ── TOAST / ANIM ─────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
function showPointsAnim(val, msg) {
  const el = document.getElementById('pts-anim');
  document.getElementById('pts-anim-val').textContent = val;
  document.getElementById('pts-anim-msg').textContent = msg;
  el.classList.add('show'); updateTopNav();
  setTimeout(() => el.classList.remove('show'), 2100);
}

// ── OTP (placeholder) ────────────────────────────────────────────────────────
function sendOTP() { showToast('Phone OTP not connected. Use email and password.'); }
function otpNext(el, idx) { if (el.value.length === 1 && idx < 5) document.querySelectorAll('.otp-digit')[idx+1]?.focus(); }
function verifyOTP() { showToast('Phone OTP not connected. Use email and password.'); }

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function openSettings() {
  const u = state.user || {};
  document.getElementById('settings-name-val').textContent  = u.name  || '—';
  document.getElementById('settings-email-val').textContent = u.email || '—';
  document.getElementById('settings-phone-val').textContent = u.phone
    ? u.phone.replace(/(\d{3})\d+(\d{2})/, '$1****$2') : 'Not set';
  document.getElementById('settings-gender-val').textContent = u.gender || 'Not set';

  const avEl = document.getElementById('settings-av-preview');
  if (u.avatar) {
    avEl.innerHTML = `<img src="${esc(u.avatar)}" alt="Photo">`;
  } else {
    avEl.textContent = getInitials(u.name) || 'G';
    avEl.style.background = 'var(--sage)';
  }

  showScreen('screen-settings');
}
function closeSettings() { showScreen('screen-profile'); }

function openSettingsEdit(field) {
  settingsEditField = field;
  const modal = document.getElementById('settings-edit-modal');
  const titleEl = document.getElementById('settings-edit-title');
  const labelEl = document.getElementById('settings-edit-label');
  const inputEl = document.getElementById('settings-edit-input');
  const genderChips = document.getElementById('settings-gender-chips');

  genderChips.style.display = 'none';
  inputEl.style.display = 'block';

  if (field === 'name') {
    titleEl.textContent = 'Edit name';
    labelEl.textContent = 'Name';
    inputEl.value = state.user?.name || '';
    inputEl.type  = 'text';
  } else if (field === 'gender') {
    titleEl.textContent = 'Gender';
    labelEl.textContent = '';
    inputEl.style.display = 'none';
    genderChips.style.display = 'flex';
    const options = ['Male', 'Female', 'Non-binary', 'Prefer not to say'];
    genderChips.innerHTML = options.map(o => {
      const sel = (state.user?.gender === o) ? 'selected' : '';
      return `<div class="chip ${sel}" onclick="selectGenderChip(this,'${esc(o)}')">${esc(o)}</div>`;
    }).join('');
  }

  modal.classList.add('open');
}
function selectGenderChip(el, val) {
  document.querySelectorAll('#settings-gender-chips .chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  el.dataset.val = val;
}
function closeSettingsEdit(e) {
  if (!e || e.target === document.getElementById('settings-edit-modal')) {
    document.getElementById('settings-edit-modal').classList.remove('open');
  }
}
async function saveSettingsEdit() {
  let updates = {};
  if (settingsEditField === 'name') {
    const val = document.getElementById('settings-edit-input').value.trim();
    if (!val) { showToast('Name cannot be empty'); return; }
    updates.name = val;
  } else if (settingsEditField === 'gender') {
    const sel = document.querySelector('#settings-gender-chips .chip.selected');
    if (!sel) { showToast('Select a gender option'); return; }
    updates.gender = sel.textContent.trim();
  }
  try {
    const result = await apiRequest('/me', { method:'PATCH', body:JSON.stringify(updates) });
    applySignedInUser({ ...state.user, ...result.user });
    updateTopNav(); saveState();
    document.getElementById('settings-edit-modal').classList.remove('open');
    openSettings();
    showToast('Saved');
  } catch (e) { showToast(e.message); }
}

async function uploadProfilePhotoFromSettings(event) {
  const file = event.target.files?.[0]; if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Choose an image file'); return; }
  if (file.size > 600000) { showToast('Photo must be under 600 KB'); return; }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const result = await apiRequest('/me', { method:'PATCH', body:JSON.stringify({ avatar:reader.result }) });
      state.user.avatar = result.user.avatar;
      updateTopNav(); saveState();
      openSettings();
      showToast('Profile photo updated');
    } catch (e) { showToast(e.message); }
  };
  reader.readAsDataURL(file);
}