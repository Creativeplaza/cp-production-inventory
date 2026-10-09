/* Creative Plaza — Production Inventory frontend. Contract: PRODUCTION_INVENTORY_CONTRACT.md v0.5.2 */
(function () {
  'use strict';
  var CFG = window.CPI_CONFIG;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var ASSET_STATUS = { available: 'ว่าง', reserved: 'จองแล้ว', checked_out: 'ถูกเบิก', inspection: 'รอตรวจ', maintenance: 'ซ่อม', lost: 'สูญหาย', retired: 'เลิกใช้งาน' };
  var LOAN_STATUS = { pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ปฏิเสธ', checked_out: 'จ่ายออกแล้ว', partially_returned: 'คืนบางส่วน', returned: 'คืนครบ', cancelled: 'ยกเลิก' };
  var ITEM_STATUS = { requested: 'รอจ่าย', checked_out: 'อยู่กับผู้เบิก', returned: 'คืนแล้ว', lost: 'สูญหาย', cancelled: 'ยกเลิก' };
  var CATEGORIES = { MEA: 'อุปกรณ์วัด', CAM: 'กล้อง / สแกน 3D', TOL: 'เครื่องมือ', OTH: 'อื่นๆ' };
  var ROLES = { admin: 'ผู้ดูแลระบบ', approver: 'ผู้อนุมัติ', storekeeper: 'ผู้ดูแลคลัง', requester: 'ผู้เบิก' };

  var S = { gen: 0, dataGen: 0, modal: 0, token: null, me: null, assets: [], loans: [], approvers: [], cart: [], printSel: null, statFilter: '', loanFilter: 'action', report: 'register' };

  /* ---------- utils ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function bkkDate(iso) { return iso ? new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString().slice(0, 10) : ''; }
  function today() { return bkkDate(new Date().toISOString()); }
  function fmtDate(iso) {
    if (!iso) return '–';
    var d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T00:00:00+07:00') : new Date(iso);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: CFG.TZ });
  }
  function fmtDT(iso) { return iso ? new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: CFG.TZ }) : '–'; }
  function csvDT(iso) {
    if (!iso) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
    var d = new Date(new Date(iso).getTime() + 7 * 3600e3).toISOString(); return d.slice(0, 10) + ' ' + d.slice(11, 16);
  }
  function daysLate(due) { if (!due) return 0; var t = today(); return t > due ? Math.round((Date.parse(t) - Date.parse(due)) / 864e5) : 0; }
  function pill(cls, text) { return '<span class="pill s-' + esc(cls) + '">' + esc(text) + '</span>'; }
  function userName(un) {
    if (!un) return '–';
    if (S.me && un === S.me.username) return S.me.name;
    var a = S.approvers.find(function (x) { return x.username === un; }); if (a) return a.name;
    var l = S.loans.find(function (x) { return x.requester === un; }); return l ? l.requesterName : un;
  }
  function toast(msg, isErr) {
    var t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = 'toast'; }, 3200);
  }
  var ERR_TEXT = { ASSET_UNAVAILABLE: 'มีอุปกรณ์ที่ไม่ว่างแล้ว', BAD_TRANSITION: 'สถานะเปลี่ยนไปแล้ว กรุณารีเฟรช', SELF_APPROVE: 'อนุมัติใบเบิกของตัวเองไม่ได้',
    NOT_APPROVER: 'คุณไม่ใช่ผู้อนุมัติของใบนี้', FORBIDDEN: 'ไม่มีสิทธิ์ทำรายการนี้', NOT_FOUND: 'ไม่พบข้อมูล', BUSY: 'ระบบไม่ว่าง ลองใหม่อีกครั้ง',
    INVALID_CREDENTIALS: 'ชื่อผู้ใช้หรือ PIN ไม่ถูกต้อง', RATE_LIMITED: 'ใส่ PIN ผิดหลายครั้ง กรุณารอ 15 นาที', LAST_ADMIN: 'ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน',
    IDEMPOTENCY_CONFLICT: 'คำขอซ้ำไม่ตรงกับของเดิม กรุณาลองใหม่', USER_EXISTS: 'ชื่อผู้ใช้นี้มีแล้ว',
    SESSION_CAPACITY: 'มีผู้ใช้งานพร้อมกันเต็ม กรุณาลองใหม่ภายหลัง', NOT_CONFIGURED: 'ระบบยังไม่ได้ตั้งค่า', INTERNAL: 'ระบบขัดข้อง กรุณาลองใหม่' };
  ERR_TEXT.RATE_LIMIT = ERR_TEXT.RATE_LIMITED;
  ERR_TEXT.INVITE_INVALID = 'รหัสเชิญไม่ถูกต้อง หมดอายุ หรือถูกใช้ครบแล้ว'; ERR_TEXT.ROLE_IN_USE = 'ยังมีผู้ใช้หรือรหัสเชิญที่ใช้ role นี้อยู่';
  function errText(r) {
    var t = (r && ERR_TEXT[r.code]) || (r && r.error) || 'เกิดข้อผิดพลาด';
    if (r && r.assetIds && r.assetIds.length) t += ': ' + r.assetIds.join(', ');
    return t;
  }

  /* ---------- API ---------- */
  // Mock API only on a local dev host with no API_URL; a deployed page without API_URL fails closed.
  var USE_MOCK = !CFG.API_URL && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !!window.CPI_MOCK;
  var NOT_CONFIGURED = !CFG.API_URL && !USE_MOCK;
  // Contract §1/§5: every call is POST text/plain with the token in the body (never in the URL).
  // Reads are side-effect free → one retry on network failure is safe.
  function apiGet(action, params) {
    return send(Object.assign({ action: action, token: S.token || '' }, params || {}), false);
  }
  // Mutations are idempotent per requestId (contract §6) → one retry with the SAME requestId after a network failure is safe.
  function apiPost(action, body) {
    return send(Object.assign({ action: action, token: S.token || '', requestId: uuid() }, body || {}), false);
  }
  // Session generation guard: S.gen changes on every login/logout. A response that comes back for an older
  // generation is dropped (never settles), so late data/401s can't repopulate state or log out a newer session.
  // Thin top progress bar while any request is in flight (the API is slow → show that work is happening).
  var inflight = 0, barTimer = null;
  function busy(delta) {
    inflight = Math.max(0, inflight + delta);
    var bar = $('#topProgress');
    if (inflight && !barTimer && bar.hidden) barTimer = setTimeout(function () { barTimer = null; if (inflight) bar.hidden = false; }, 150);
    if (!inflight) { clearTimeout(barTimer); barTimer = null; bar.hidden = true; }
  }
  function send(b, retried, gen) {
    if (gen === undefined) gen = S.gen;
    if (NOT_CONFIGURED) return Promise.reject({ code: 'NOT_CONFIGURED', error: 'ระบบยังไม่ได้ตั้งค่า' });
    busy(1);
    var p = USE_MOCK ? window.CPI_MOCK.post(b)
      : fetchJson(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(b) });
    return p.then(function (r) { return { r: r }; }, function (e) {
      if (gen === S.gen && !retried && b.action !== 'login' && e && e.network) return send(b, true, gen).then(function (r) { return { r: r }; }, function (e2) { return { e: e2 }; });
      return { e: e };
    }).then(function (o) {
      busy(-1);
      if (gen !== S.gen) return new Promise(function () {});
      if (o.e) throw o.e;
      return check(o.r);
    });
  }
  function fetchJson(url, opt) {
    var ctl = new AbortController(); var to = setTimeout(function () { ctl.abort(); }, 30000);
    opt.signal = ctl.signal; opt.redirect = 'follow';
    return fetch(url, opt).then(function (r) { return r.text(); }).then(function (t) {
      // Apps Script occasionally returns a transient HTML error page instead of JSON → treat like a network blip.
      try { return JSON.parse(t); } catch (e) { throw { network: true, transient: true, error: 'เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง ลองใหม่อีกครั้ง' }; }
    }, function () { throw { network: true, error: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้' }; }).finally(function () { clearTimeout(to); });
  }
  function check(r) {
    if (r && r.success) return r;
    if (r && r.status === 401 && S.token) { logout(true); }
    throw r || { error: 'เกิดข้อผิดพลาด' };
  }

  /* ---------- auth ---------- */
  function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function stored(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function showLogin() {
    $('#app').hidden = true; $('#login').hidden = false; $('#mockHint').hidden = !USE_MOCK;
    if (NOT_CONFIGURED) { $('#loginErr').textContent = 'ระบบยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ — ติดต่อผู้ดูแล'; $('#loginForm [type=submit]').disabled = true; $('#regForm [type=submit]').disabled = true; } $('#loginForm [name=username]').focus(); }
  // PIN = groups of 4 digit boxes (digits only). Each group mirrors into the hidden input named by data-pin
  // in the same form; filling the last box of the form's last group submits (login) or moves on (register).
  var pinGroups = $$('.pin-boxes').map(function (g) {
    var boxes = $$('.pin-box', g), form = g.closest('form'), hidden = form[g.dataset.pin];
    var grp = { boxes: boxes, form: form,
      sync: function () { hidden.value = boxes.map(function (b) { return b.value; }).join(''); },
      clear: function () { boxes.forEach(function (b) { b.value = ''; }); grp.sync(); },
      focus: function () { boxes[0].focus(); } };
    function fill(digits, from) {
      digits.split('').slice(0, 4 - from).forEach(function (d, k) { boxes[from + k].value = d; });
      grp.sync();
      if (hidden.value.length < 4) { boxes[Math.min(from + digits.length, 3)].focus(); return; }
      var groups = pinGroups.filter(function (x) { return x.form === form; }), i = groups.indexOf(grp);
      if (i < groups.length - 1) groups[i + 1].focus(); else boxes[3].blur(), form.dispatchEvent(new CustomEvent('pincomplete'));
    }
    boxes.forEach(function (box, i) {
      box.addEventListener('input', function () { var d = box.value.replace(/\D/g, ''); box.value = ''; if (d) fill(d, i); else grp.sync(); });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !box.value && i > 0) { boxes[i - 1].value = ''; boxes[i - 1].focus(); grp.sync(); e.preventDefault(); }
        if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowRight' && i < 3) boxes[i + 1].focus();
      });
      box.addEventListener('paste', function (e) { var d = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, ''); e.preventDefault(); if (d) fill(d, i); });
      box.addEventListener('focus', function () { box.select(); });
    });
    return grp;
  });
  function pinGroup(form, name) { return pinGroups.find(function (g) { return g.form === form && g.form[name] && g.boxes[0].closest('.pin-boxes').dataset.pin === name; }); }
  var loginPin = pinGroup($('#loginForm'), 'pin'), regPin = pinGroup($('#regForm'), 'pin'), regPin2 = pinGroup($('#regForm'), 'pin2');
  $('#loginForm').username.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); loginPin.focus(); } });
  $('#loginForm').addEventListener('pincomplete', function () { if (this.username.value.trim()) this.requestSubmit(); });

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector('[type=submit]');
    if (!/^\d{4}$/.test(f.pin.value)) { $('#loginErr').textContent = 'กรอก PIN 4 หลัก'; loginPin.focus(); return; }
    if (btn.disabled) return;
    btn.disabled = true; $('#loginErr').textContent = '';
    send({ action: 'login', username: f.username.value.trim().toLowerCase(), pin: f.pin.value }, true).then(function (r) {
      S.gen++; S.token = r.token; store('cpi_token', r.token); loginPin.clear(); switchTab('assets'); boot();
    }).catch(function (r) { loginPin.clear(); loginPin.focus(); $('#loginErr').textContent = r && r.status === 429 ? ERR_TEXT.RATE_LIMITED : errText(r); })
      .finally(function () { btn.disabled = false; });
  });

  /* ---------- register (invite code, contract §13.4) ---------- */
  function normCode(v) { return String(v || '').toUpperCase().replace(/[\s-]/g, ''); }
  function showRegister(code) {
    $('#loginForm').hidden = true; $('#regForm').hidden = false; $('#regErr').textContent = '';
    if (code) $('#regForm').invite.value = normCode(code);
    ($('#regForm').invite.value ? $('#regForm').username : $('#regForm').invite).focus();
  }
  function showLoginForm() { $('#regForm').hidden = true; $('#loginForm').hidden = false; $('#loginForm').username.focus(); }
  $('#toRegister').addEventListener('click', function () { showRegister(''); });
  $('#toLogin').addEventListener('click', showLoginForm);
  $('#regForm').invite.addEventListener('input', function () { this.value = normCode(this.value).slice(0, 12); });
  $('#regForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector('[type=submit]'), err = $('#regErr');
    var code = normCode(f.invite.value), username = f.username.value.trim().toLowerCase(), name = f.name.value.trim();
    err.textContent = '';
    if (!/^[A-Z0-9]{6,12}$/.test(code)) { err.textContent = 'รหัสเชิญไม่ถูกต้อง'; f.invite.focus(); return; }
    if (!/^[a-z0-9._-]{3,24}$/.test(username)) { err.textContent = 'ชื่อผู้ใช้ใช้ได้เฉพาะ a-z 0-9 . _ - (3–24 ตัว)'; f.username.focus(); return; }
    if (!name) { err.textContent = 'กรอกชื่อที่แสดง'; f.name.focus(); return; }
    if (!/^\d{4}$/.test(f.pin.value)) { err.textContent = 'ตั้ง PIN 4 หลัก'; regPin.focus(); return; }
    if (f.pin.value !== f.pin2.value) { err.textContent = 'PIN ยืนยันไม่ตรงกัน'; regPin2.clear(); regPin2.focus(); return; }
    if (btn.disabled) return; btn.disabled = true;
    // register is not idempotent and must never auto-repeat (contract §13.7 S3-1): on an uncertain or
    // login-required outcome the account may already exist → send the user to login with the username filled.
    function toLoginAfter(msg) {
      regPin.clear(); regPin2.clear(); f.reset(); showLoginForm();
      $('#loginForm').username.value = username; $('#loginErr').textContent = msg; loginPin.focus();
    }
    var RECOVER = 'ถ้าสมัครสำเร็จแล้ว ให้เข้าสู่ระบบด้วยชื่อผู้ใช้และ PIN ที่ตั้งไว้';
    send({ action: 'register', inviteCode: code, username: username, name: name, pin: f.pin.value }, true).then(function (r) {
      if (r.loginRequired || !r.token) { toLoginAfter('สมัครสำเร็จ — เข้าสู่ระบบด้วย PIN ที่ตั้งไว้'); return; }
      regPin.clear(); regPin2.clear(); f.reset(); showLoginForm();
      S.gen++; S.token = r.token; store('cpi_token', r.token); boot().then(function () { toast('ยินดีต้อนรับ ' + r.user.name); });
    }).catch(function (r) {
      if (r && (r.network || r.code === 'INTERNAL' || !r.status)) { toLoginAfter('ไม่แน่ใจว่าสมัครสำเร็จหรือไม่ — ' + RECOVER); return; }
      err.textContent = r && r.status === 429 ? 'รหัสเชิญผิดหลายครั้งเกินไป กรุณารอสักครู่' :
        (r && (r.code === 'USER_EXISTS' || r.code === 'INVITE_INVALID')) ? errText(r) + ' · ' + RECOVER : errText(r);
    })
      .finally(function () { btn.disabled = false; });
  });
  function logout(expired) {
    if (S.token && !expired) send({ action: 'logout', token: S.token }, true).catch(function () {});
    S.gen++; S.dataGen++; allLoansP = null; $('#btnCsv').disabled = false; // reusable control left disabled by a dropped request
    S.token = null; S.me = null; S.cart = []; S.assets = []; S.loans = []; S.approvers = []; S.printSel = null; allLoans = null; store('cpi_token', null);
    S.users = []; S.invites = []; S.roles = []; closeDrawer();
    closeSheet(); ['#assetList', '#loanList', '#repTable', '#stats', '#printArea', '#usersBody', '#sideCard'].forEach(function (sel) { $(sel).innerHTML = ''; });
    if (expired) toast('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', true);
    showLogin();
  }
  $('#btnLogout').addEventListener('click', function () { if (confirm('ออกจากระบบ?')) logout(false); });

  /* ---------- load ---------- */
  function skeleton() {
    var card = '<li class="item skel"><span class="sk sk-box"></span><div class="main"><span class="sk sk-line w60"></span><span class="sk sk-line w35"></span></div><span class="sk sk-pill"></span></li>';
    $('#stats').innerHTML = new Array(5).join('<div class="stat skel"><span class="sk sk-num"></span><span class="sk sk-line w50"></span></div>');
    $('#assetList').innerHTML = $('#loanList').innerHTML = new Array(7).join(card);
    $('#usersBody').innerHTML = '<ul class="list">' + new Array(5).join(card) + '</ul>';
  }
  function boot() {
    // Show the app shell with skeletons right away; the first bundle can take several seconds.
    if (!S.me) { skeleton(); $('#login').hidden = true; $('#app').hidden = false; $('#app').classList.add('app-enter'); }
    return reload().then(function () {
      $('#login').hidden = true; $('#app').hidden = false;
      var deep = new URLSearchParams(location.search).get('a');
      if (deep) { history.replaceState(null, '', location.pathname); openAsset(deep); }
    }).catch(function (r) { if (r && r.status !== 401) toast(errText(r), true); if (!S.me) showLogin(); });
  }
  function reload() {
    return apiGet('bundle').then(function (r) {
      if (!r.me || !Array.isArray(r.assets) || !Array.isArray(r.loans) || !Array.isArray(r.approvers)) throw { error: 'ข้อมูลจากเซิร์ฟเวอร์ไม่ครบ' };
      S.me = r.me; S.assets = r.assets; S.loans = r.loans; S.approvers = r.approvers;
      if (Array.isArray(r.roles) && !S.users.length) S.roles = r.roles;
      // Fail closed: anything but an explicit false means the bundle may not hold every loan.
      S.loansTruncated = r.loansTruncated !== false; allLoans = null; allLoansP = null; S.dataGen++;
      S.cart = S.cart.filter(function (id) { var a = assetById(id); return a && a.status === 'available'; });
      var first = !$('#assetList').querySelector('.item:not(.skel)');
      renderAll(); if (first) stagger();
    });
  }
  function assetById(id) { return S.assets.find(function (a) { return a.assetId === id; }); }
  function P() { return (S.me && S.me.perms) || {}; }
  function roleName(id) { var r = (S.roles || []).find(function (x) { return x.roleId === id; }); return r ? r.name : (ROLES[id] || id || ''); }

  function renderAll() {
    $('#who').textContent = S.me.name; $('#whoRole').textContent = roleName(S.me.role);
    $('#avatar').textContent = (S.me.name || S.me.username || '?').trim().charAt(0).toUpperCase();
    $('.side-user').title = S.me.name + ' · ' + roleName(S.me.role);
    $('#navUsers').hidden = !P().userManage; $('#navReport').hidden = !P().reportView;
    $('#assetAdminBar').hidden = !P().assetManage;
    if ((S.tab === 'users' && !P().userManage) || (S.tab === 'report' && !P().reportView)) switchTab('assets');
    var cats = {}; S.assets.forEach(function (a) { cats[a.category] = 1; }); Object.keys(CATEGORIES).forEach(function (c) { cats[c] = 1; });
    fillSelect($('#fCat'), Object.keys(cats).sort().map(function (c) { return [c, c + ' · ' + (CATEGORIES[c] || c)]; }), 'ทุกหมวด');
    fillSelect($('#fStatus'), Object.keys(ASSET_STATUS).map(function (k) { return [k, ASSET_STATUS[k]]; }), 'ทุกสถานะ');
    var projects = {}; S.loans.forEach(function (l) { projects[l.project] = 1; });
    $('#projectList').innerHTML = Object.keys(projects).map(function (p) { return '<option value="' + esc(p) + '">'; }).join('');
    renderStats(); renderAssets(); renderLoans(); renderCart(); renderReport(); renderSideCard();
  }
  function fillSelect(sel, pairs, allLabel) {
    var v = sel.value;
    sel.innerHTML = '<option value="">' + esc(allLabel) + '</option>' + pairs.map(function (p) { return '<option value="' + esc(p[0]) + '">' + esc(p[1]) + '</option>'; }).join('');
    sel.value = v;
  }

  /* ---------- side menu (collapsible on desktop, drawer on mobile) ---------- */
  var TAB_TITLES = { assets: 'อุปกรณ์', loans: 'ใบเบิก', report: 'รายงาน', users: 'ผู้ใช้' };
  $$('.side-nav [data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.dataset.tab); closeDrawer(); });
  });
  function switchTab(t) {
    S.tab = t;
    $$('.side-nav [data-tab]').forEach(function (x) { x.setAttribute('aria-selected', String(x.dataset.tab === t)); });
    ['assets', 'loans', 'report', 'users'].forEach(function (x) { $('#tab-' + x).hidden = x !== t; });
    $('#pageTitle').textContent = TAB_TITLES[t] || '';
    replay($('#tab-' + t), 'page-enter'); replay($('#pageTitle'), 'title-enter'); stagger();
    $('#cartBar').hidden = t !== 'assets' || !S.cart.length;
    if (t === 'users' && S.me) loadUsersTab();
    try { sessionStorage.setItem('cpi_tab', t); } catch (e) {}
  }
  // Restart a CSS entrance animation on an element.
  function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  // Cards cascade in on the next render of the lists (tab switch / fresh data), not on every filter keystroke.
  var staggerT = null;
  function stagger() {
    ['#assetList', '#loanList', '#usersBody'].forEach(function (s) { replay($(s), 'stagger'); });
    clearTimeout(staggerT); staggerT = setTimeout(function () { ['#assetList', '#loanList', '#usersBody'].forEach(function (s) { $(s).classList.remove('stagger'); }); }, 900);
  }
  function setCollapsed(on) { $('#app').classList.toggle('collapsed', on); store('cpi_side', on ? '1' : null); }
  $('#btnCollapse').addEventListener('click', function () {
    if (window.matchMedia('(max-width: 859px)').matches) { closeDrawer(); return; }
    setCollapsed(!$('#app').classList.contains('collapsed'));
  });
  setCollapsed(stored('cpi_side') === '1');
  function openDrawer() { $('#side').classList.add('open'); $('#scrim').hidden = false; }
  function closeDrawer() { $('#side').classList.remove('open'); $('#scrim').hidden = true; }
  $('#btnMenu').addEventListener('click', openDrawer);
  $('#scrim').addEventListener('click', closeDrawer);
  $('#sideCard').addEventListener('click', function () { switchTab('loans'); closeDrawer(); });
  function renderSideCard() {
    var pend = S.loans.filter(function (l) { return l.status === 'pending'; }).length;
    var od = S.assets.filter(isOverdueAsset).length;
    $('#sideCard').innerHTML = '<span class="sc-ico">' + (od ? '⚠' : '◆') + '</span><span class="nav-txt"><b>' + (od ? 'ค้างคืน ' + od + ' ชิ้น' : 'ภาพรวมวันนี้') + '</b>' +
      '<small>รออนุมัติ ' + pend + ' ใบ · ว่าง ' + S.assets.filter(function (a) { return a.status === 'available'; }).length + ' ชิ้น</small></span>';
    $('#sideCard').classList.toggle('warn', !!od);
  }

  /* ---------- assets tab ---------- */
  function isOverdueAsset(a) { return a.status === 'checked_out' && a.dueDate && a.dueDate < today(); }
  function renderStats() {
    var c = { available: 0, out: 0, pending: 0, overdue: 0 };
    S.assets.forEach(function (a) {
      if (a.status === 'available') c.available++;
      if (a.status === 'checked_out') c.out++;
      if (isOverdueAsset(a)) c.overdue++;
    });
    c.pending = S.loans.filter(function (l) { return l.status === 'pending'; }).length;
    var defs = [['available', 'ว่าง', c.available], ['checked_out', 'ถูกเบิก', c.out], ['reserved', 'จอง / รออนุมัติ', c.pending], ['overdue', 'ค้างคืน', c.overdue]];
    $('#stats').innerHTML = defs.map(function (d) {
      return '<button class="stat' + (d[0] === 'overdue' && d[2] ? ' bad' : '') + '" data-s="' + d[0] + '" aria-pressed="' + (S.statFilter === d[0]) + '"><b>' + d[2] + '</b><span>' + d[1] + '</span></button>';
    }).join('');
  }
  $('#stats').addEventListener('click', function (e) {
    var b = e.target.closest('.stat'); if (!b) return;
    S.statFilter = S.statFilter === b.dataset.s ? '' : b.dataset.s; $('#fStatus').value = '';
    renderStats(); renderAssets();
  });
  ['#q', '#fCat', '#fStatus'].forEach(function (s) { $(s).addEventListener('input', function () { if (s === '#fStatus') { S.statFilter = ''; renderStats(); } renderAssets(); }); });

  function filteredAssets() {
    var q = $('#q').value.trim().toLowerCase(), cat = $('#fCat').value, st = $('#fStatus').value, sf = S.statFilter;
    return S.assets.filter(function (a) {
      if (cat && a.category !== cat) return false;
      if (st && a.status !== st) return false;
      if (sf === 'overdue' && !isOverdueAsset(a)) return false;
      if (sf && sf !== 'overdue' && a.status !== sf) return false;
      if (q && [a.assetId, a.name, a.sku, a.model, a.serial, a.holder, userName(a.holder), a.project, a.location].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function renderAssets() {
    var list = filteredAssets(), printing = !!S.printSel;
    $('#assetList').innerHTML = list.length ? list.map(function (a) {
      var inCart = S.cart.indexOf(a.assetId) >= 0, od = isOverdueAsset(a);
      var box = printing ? '<input type="checkbox" class="check" data-print="' + esc(a.assetId) + '"' + (S.printSel[a.assetId] ? ' checked' : '') + ' aria-label="เลือกพิมพ์ ' + esc(a.assetId) + '">'
        : a.status === 'available' && P().loanRequest ? '<input type="checkbox" class="check" data-cart="' + esc(a.assetId) + '"' + (inCart ? ' checked' : '') + ' aria-label="ใส่ตะกร้า ' + esc(a.assetId) + '">'
        : '<span class="check"></span>';
      var meta = [a.sku, a.location].filter(Boolean).join(' · ');
      var who = a.holder ? '<div class="meta">' + esc(userName(a.holder)) + ' · ' + esc(a.project) + (a.dueDate ? ' · คืน <span class="' + (od ? 'overdue-txt' : '') + '">' + fmtDate(a.dueDate) + (od ? ' (เกิน ' + daysLate(a.dueDate) + ' วัน)' : '') + '</span>' : '') + '</div>' : '';
      return '<li class="item' + (inCart ? ' in-cart' : '') + '">' + box +
        '<div class="main" data-open="' + esc(a.assetId) + '"><div><span class="id">' + esc(a.assetId) + '</span> <span class="name">' + esc(a.name) + '</span></div>' +
        '<div class="meta">' + esc(meta) + '</div>' + who + '</div>' +
        '<div class="side">' + (od ? pill('overdue', 'ค้างคืน') : pill(a.status, ASSET_STATUS[a.status] || a.status)) + '</div></li>';
    }).join('') : '<li class="empty">' + (S.assets.length ? 'ไม่พบอุปกรณ์ตามตัวกรอง' : 'ยังไม่มีอุปกรณ์ในระบบ') + '</li>';
    if (printing) $('#printCount').textContent = 'เลือก ' + Object.keys(S.printSel).length + ' ชิ้น';
  }
  $('#assetList').addEventListener('click', function (e) {
    var c = e.target.closest('[data-cart]'); if (c) { toggleCart(c.dataset.cart, c.checked); return; }
    var p = e.target.closest('[data-print]'); if (p) { if (p.checked) S.printSel[p.dataset.print] = 1; else delete S.printSel[p.dataset.print]; renderAssets(); return; }
    var o = e.target.closest('[data-open]'); if (o) openAsset(o.dataset.open);
  });

  /* ---------- cart ---------- */
  function toggleCart(id, on) {
    var i = S.cart.indexOf(id);
    if (on && i < 0) { if (S.cart.length >= 20) { toast('เบิกได้สูงสุด 20 ชิ้นต่อใบ', true); renderAssets(); return; } S.cart.push(id); }
    if (!on && i >= 0) S.cart.splice(i, 1);
    renderAssets(); renderCart();
  }
  function renderCart() {
    $('#cartText').textContent = 'ตะกร้า ' + S.cart.length + ' ชิ้น';
    $('#cartBar').hidden = !S.cart.length || $('#tab-assets').hidden;
  }
  $('#btnCartClear').addEventListener('click', function () { S.cart = []; renderAssets(); renderCart(); });
  $('#btnCartGo').addEventListener('click', openRequestForm);

  function openRequestForm() {
    var appr = S.approvers.filter(function (a) { return a.username !== S.me.username || P().isAdmin; });
    var items = S.cart.map(function (id) { var a = assetById(id) || {}; return '<li><span><b>' + esc(id) + '</b> ' + esc(a.name) + '</span><button type="button" class="btn ghost sm" data-rm="' + esc(id) + '">นำออก</button></li>'; }).join('');
    openSheet('เบิกอุปกรณ์ (' + S.cart.length + ' ชิ้น)',
      '<ul class="loan-items" id="reqItems">' + items + '</ul>' +
      '<form id="reqForm" class="tab">' +
      '<label>Project ที่ใช้ *<input name="project" list="projectList" maxlength="120" required></label>' +
      '<div class="row"><label>ผู้อนุมัติ *<select name="approver" required><option value="">เลือก…</option>' +
      appr.map(function (a) { return '<option value="' + esc(a.username) + '">' + esc(a.name) + '</option>'; }).join('') + '</select></label>' +
      '<label>กำหนดคืน *<input type="date" name="dueDate" min="' + today() + '" required></label></div>' +
      '<label>วัตถุประสงค์ / หน้างาน<textarea name="purpose" rows="2" maxlength="500"></textarea></label>' +
      '<p class="muted small">ผู้เบิก / ผู้รับผิดชอบ: <b>' + esc(S.me.name) + '</b></p>' +
      '<button class="btn primary block" type="submit">ส่งคำขอเบิก</button></form>');
    $('#reqItems').addEventListener('click', function (e) {
      var b = e.target.closest('[data-rm]'); if (!b) return;
      toggleCart(b.dataset.rm, false); if (S.cart.length) openRequestForm(); else closeSheet();
    });
    $('#reqForm').addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, btn = f.querySelector('[type=submit]'); btn.disabled = true;
      apiPost('loan_request', { assetIds: S.cart.slice(), project: f.project.value.trim(), approver: f.approver.value, dueDate: f.dueDate.value, purpose: f.purpose.value.trim() })
        .then(function (r) { S.cart = []; closeSheet(); toast('ส่งคำขอแล้ว · ' + r.loan.loanId); return reload(); })
        .catch(function (r) { toast(errText(r), true); if (r && r.status === 409) reload(); })
        .finally(function () { btn.disabled = false; });
    });
  }

  /* ---------- asset detail ---------- */
  function qrSvg(text, cell) {
    var q = qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: cell || 4, margin: 2, scalable: true });
  }
  function assetUrl(id) { return CFG.APP_URL + '?a=' + encodeURIComponent(id); }
  function openAsset(id) {
    var a = assetById(id);
    if (!a) { toast('ไม่พบอุปกรณ์ ' + id, true); return; }
    openSheet(a.assetId + ' · ' + a.name, '<p class="muted">กำลังโหลด…</p>');
    var mg = S.modal;
    render(a, null, false);
    apiGet('getAsset', { id: id }).then(function (r) { if (mg === S.modal) render(r.item, r.loans || [], !!r.truncated); })
      .catch(function (r) { if (mg === S.modal) toast(errText(r), true); });

    function render(a, loans, truncated) {
      var od = isOverdueAsset(a), loan = a.currentLoanId && S.loans.find(function (l) { return l.loanId === a.currentLoanId; });
      var act = [];
      if (a.status === 'available' && P().loanRequest) act.push('<button class="btn primary" data-act="cart">' + (S.cart.indexOf(a.assetId) >= 0 ? '✓ อยู่ในตะกร้าแล้ว' : '+ ใส่ตะกร้าเบิก') + '</button>');
      if (loan) act.push('<button class="btn" data-act="loan">ดูใบเบิก ' + esc(loan.loanId) + '</button>');
      if (P().assetManage) act.push('<button class="btn" data-act="edit">แก้ไข</button>', '<button class="btn" data-act="print">พิมพ์ฉลาก</button>');
      var hist = !loans ? '<p class="muted small">กำลังโหลดประวัติ…</p>' : loans.length ? '<ul class="timeline">' + loans.slice(0, 20).map(function (l) {
        var it = (l.items || []).find(function (i) { return i.assetId === a.assetId; }) || {};
        var end = it.itemStatus === 'lost' ? ' → แจ้งสูญหาย ' + fmtDT(it.returnedAt) : ' → คืน ' + fmtDT(it.returnedAt);
        return '<li><b>' + esc(l.loanId) + '</b> ' + pill(loanPillClass(l), loanStatusText(l)) + '<br>' + esc(l.project) + ' · ' + esc(l.requesterName || l.requester) +
          '<br><span class="muted">ออก ' + fmtDT(it.checkedOutAt) + end + (it.damaged ? ' · เสียหาย' : '') + '</span></li>';
      }).join('') + '</ul>' + (loans.length > 20 || truncated ? '<p class="muted small">แสดงเฉพาะรายการล่าสุด — ประวัติทั้งหมดดูได้ที่แท็บรายงาน</p>' : '')
        : '<p class="muted small">ยังไม่มีประวัติการเบิก</p>';
      $('#sheetBody').innerHTML =
        '<div class="qr-box">' + qrSvg(assetUrl(a.assetId)) + '<div>' + (od ? pill('overdue', 'ค้างคืน ' + daysLate(a.dueDate) + ' วัน') : pill(a.status, ASSET_STATUS[a.status])) +
        '<p class="muted small">' + esc(a.sku) + '</p></div></div>' +
        '<dl class="kv"><dt>รุ่น</dt><dd>' + esc(a.model || '–') + '</dd><dt>Serial</dt><dd>' + esc(a.serial || '–') + '</dd>' +
        '<dt>หมวด</dt><dd>' + esc(CATEGORIES[a.category] || a.category) + '</dd><dt>ที่เก็บ</dt><dd>' + esc(a.location || '–') + '</dd>' +
        (a.holder ? '<dt>ผู้ถือ</dt><dd>' + esc(userName(a.holder)) + '</dd><dt>Project</dt><dd>' + esc(a.project) + '</dd><dt>กำหนดคืน</dt><dd>' + fmtDate(a.dueDate) + '</dd>' : '') +
        (a.notes ? '<dt>หมายเหตุ</dt><dd>' + esc(a.notes) + '</dd>' : '') + '</dl>' +
        '<div class="row">' + act.join('') + '</div><h3>ประวัติการเบิก (ล่าสุด)</h3>' + hist;
      $('#sheetBody').onclick = function (e) {
        var b = e.target.closest('[data-act]'); if (!b) return;
        if (b.dataset.act === 'cart') { if (S.cart.indexOf(a.assetId) < 0) toggleCart(a.assetId, true); closeSheet(); switchTab('assets'); }
        if (b.dataset.act === 'loan') openLoan(loan.loanId);
        if (b.dataset.act === 'edit') openAssetForm(a);
        if (b.dataset.act === 'print') printLabels([a.assetId]);
      };
    }
  }

  /* ---------- asset create / edit ---------- */
  $('#btnAddAsset').addEventListener('click', function () { openAssetForm(null); });
  function openAssetForm(a) {
    var edit = !!a; a = a || {};
    var statusOpts = edit && !a.currentLoanId ? ['available', 'inspection', 'maintenance', 'lost', 'retired'] : [];
    openSheet(edit ? 'แก้ไข ' + a.assetId : 'เพิ่มอุปกรณ์',
      '<form id="assetForm" class="tab">' +
      (edit ? '' : '<div class="row"><label>หมวด *<select name="category" required>' + Object.keys(CATEGORIES).map(function (c) { return '<option value="' + c + '">' + c + ' · ' + CATEGORIES[c] + '</option>'; }).join('') + '</select></label>' +
        '<label>จำนวนชิ้น<input type="number" name="qty" min="1" max="50" value="1"></label></div>') +
      '<label>ชื่ออุปกรณ์ *<input name="name" required maxlength="120" value="' + esc(a.name) + '"></label>' +
      '<div class="row"><label>SKU (รหัสรุ่น) *<input name="sku" required pattern="[A-Z0-9-]{2,24}" placeholder="เช่น MEA-LDM50" value="' + esc(a.sku) + '"></label>' +
      '<label>รุ่น / ยี่ห้อ<input name="model" maxlength="120" value="' + esc(a.model) + '"></label></div>' +
      '<div class="row"><label>Serial<input name="serial" maxlength="80" value="' + esc(a.serial) + '"></label>' +
      '<label>ที่จัดเก็บ<input name="location" maxlength="80" value="' + esc(a.location) + '"></label></div>' +
      (statusOpts.length ? '<label>สถานะ<select name="status">' + statusOpts.map(function (s) { return '<option value="' + s + '"' + (s === a.status ? ' selected' : '') + '>' + ASSET_STATUS[s] + '</option>'; }).join('') + '</select></label>' : '') +
      '<label>หมายเหตุ<textarea name="notes" rows="2" maxlength="500">' + esc(a.notes) + '</textarea></label>' +
      (edit ? '' : '<p class="muted small">จำนวนหลายชิ้น = รุ่นเดียวกัน SKU เดียวกัน ระบบออกรหัส + QR แยกให้ทีละชิ้น (Serial ใส่ทีหลังได้)</p>') +
      '<button class="btn primary block" type="submit">' + (edit ? 'บันทึก' : 'เพิ่ม') + '</button></form>');
    var f = $('#assetForm');
    f.sku.addEventListener('input', function () { f.sku.value = f.sku.value.toUpperCase(); });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var btn = f.querySelector('[type=submit]'); btn.disabled = true;
      var body = { name: f.name.value.trim(), sku: f.sku.value.trim(), model: f.model.value.trim(), serial: f.serial.value.trim(), location: f.location.value.trim(), notes: f.notes.value.trim() };
      var p;
      if (edit) { body.assetId = a.assetId; if (f.status && f.status.value !== a.status) body.status = f.status.value; p = apiPost('asset_update', body); }
      else {
        body.category = f.category.value; var n = Math.max(1, Math.min(50, +f.qty.value || 1)), made = [];
        p = (function next(i) {
          if (i >= n) return Promise.resolve();
          return apiPost('asset_create', Object.assign({}, body, { serial: i === 0 ? body.serial : '' })).then(function (r) { made.push(r.asset.assetId); return next(i + 1); });
        })(0).then(function () { toast('เพิ่มแล้ว ' + made.join(', ')); });
      }
      p.then(function () { if (edit) toast('บันทึกแล้ว'); closeSheet(); return reload(); })
        .catch(function (r) { toast(errText(r), true); reload(); }).finally(function () { btn.disabled = false; });
    });
  }

  /* ---------- QR label printing (A4, 5×9) ---------- */
  $('#btnPrintMode').addEventListener('click', function () { S.printSel = {}; $('#printBar').hidden = false; $('#assetAdminBar').hidden = true; renderAssets(); });
  $('#btnPrintCancel').addEventListener('click', endPrintMode);
  $('#btnPrintAll').addEventListener('click', function () { filteredAssets().forEach(function (a) { S.printSel[a.assetId] = 1; }); renderAssets(); });
  $('#btnPrintGo').addEventListener('click', function () {
    var ids = Object.keys(S.printSel); if (!ids.length) { toast('ยังไม่ได้เลือกอุปกรณ์', true); return; }
    printLabels(ids); endPrintMode();
  });
  function endPrintMode() { S.printSel = null; $('#printBar').hidden = true; $('#assetAdminBar').hidden = !P().assetManage; renderAssets(); }
  function printLabels(ids) {
    $('#printArea').innerHTML = ids.map(function (id) {
      var a = assetById(id) || { assetId: id, name: '' };
      return '<div class="label">' + qrSvg(assetUrl(id), 2) + '<div class="t"><img class="co" src="logo-print.png" alt=""><span class="aid">' + esc(id) + '</span><span class="nm">' + esc(a.name) + '</span></div></div>';
    }).join('');
    setTimeout(function () { window.print(); }, 50);
  }

  /* ---------- loans tab ---------- */
  $('#loanFilter').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return; S.loanFilter = b.dataset.f;
    $$('#loanFilter .chip').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); renderLoans();
  });
  function loanActions(l) {
    var me = S.me.username, p = P(), a = [];
    if (l.status === 'pending' && (p.isAdmin || (p.loanApprove && l.approver === me && l.requester !== me))) a.push(['approve', 'อนุมัติ', 'primary'], ['reject', 'ปฏิเสธ', 'danger']);
    if (l.status === 'approved' && p.loanIssue) a.push(['checkout', 'จ่ายของ', 'primary']);
    if ((l.status === 'checked_out' || l.status === 'partially_returned') && p.loanIssue) a.push(['return', 'รับคืน', 'primary']);
    if ((l.status === 'pending' || l.status === 'approved') && (l.requester === me || p.isAdmin)) a.push(['cancel', 'ยกเลิก', 'ghost']);
    return a;
  }
  // A loan closes when every item is returned OR lost; returnedAt is the closure time, not proof of physical return.
  function loanHasLost(l) { return (l.items || []).some(function (i) { return i.itemStatus === 'lost'; }); }
  function loanStatusText(l) { return l.status === 'returned' && loanHasLost(l) ? 'ปิดใบ (มีของสูญหาย)' : (LOAN_STATUS[l.status] || l.status); }
  function loanPillClass(l) { return l.status === 'returned' && loanHasLost(l) ? 'lost' : l.status; }
  function loanOverdue(l) { return (l.status === 'checked_out' || l.status === 'partially_returned') && l.dueDate < today(); }
  function renderLoans() {
    var me = S.me.username, f = S.loanFilter;
    var needAction = S.loans.filter(function (l) { return loanActions(l).some(function (x) { return x[0] !== 'cancel'; }); });
    var b = $('#loanBadge'); b.hidden = !needAction.length; b.textContent = needAction.length;
    var list = S.loans.filter(function (l) {
      if (f === 'action') return needAction.indexOf(l) >= 0 || (l.requester === me && ['pending', 'approved'].indexOf(l.status) >= 0) || loanOverdue(l);
      if (f === 'active') return ['pending', 'approved', 'checked_out', 'partially_returned'].indexOf(l.status) >= 0;
      if (f === 'mine') return l.requester === me || l.approver === me;
      return true;
    });
    $('#loanList').innerHTML = list.length ? list.map(loanCard).join('') : '<li class="empty">' + (f === 'action' ? 'ไม่มีรายการที่ต้องจัดการ 🎉' : 'ไม่มีใบเบิก') + '</li>';
  }
  function loanCard(l) {
    var od = loanOverdue(l);
    var items = (l.items || []).map(function (i) {
      return '<li><span><b>' + esc(i.assetId) + '</b> ' + esc(i.assetName) + '</span>' + pill(i.itemStatus === 'checked_out' && od ? 'overdue' : i.itemStatus, ITEM_STATUS[i.itemStatus] || i.itemStatus) + '</li>';
    }).join('');
    var acts = loanActions(l).map(function (x) { return '<button class="btn sm ' + x[2] + '" data-la="' + x[0] + '" data-id="' + esc(l.loanId) + '">' + x[1] + '</button>'; }).join('');
    return '<li class="item"><div class="main" style="cursor:default">' +
      '<div class="row" style="justify-content:space-between;align-items:center"><span><span class="id">' + esc(l.loanId) + '</span> · ' + esc(l.project) + '</span>' +
      '<span style="flex:0">' + pill(od ? 'overdue' : loanPillClass(l), od ? 'เกินกำหนด ' + daysLate(l.dueDate) + ' วัน' : loanStatusText(l)) + '</span></div>' +
      '<div class="meta">ผู้เบิก ' + esc(l.requesterName || l.requester) + ' · อนุมัติโดย ' + esc(l.approverName || l.approver) + '</div>' +
      '<div class="meta">ขอ ' + fmtDT(l.requestedAt) + ' · ออก ' + fmtDT(l.checkedOutAt) + ' · กำหนดคืน ' + fmtDate(l.dueDate) + (l.returnedAt ? (loanHasLost(l) ? ' · ปิดใบ ' : ' · คืนครบ ') + fmtDT(l.returnedAt) : '') + '</div>' +
      (l.purpose ? '<div class="meta">' + esc(l.purpose) + '</div>' : '') + (l.rejectReason ? '<div class="meta overdue-txt">เหตุผล: ' + esc(l.rejectReason) + '</div>' : '') +
      '<ul class="loan-items">' + items + '</ul>' + (acts ? '<div class="loan-actions">' + acts + '</div>' : '') + '</div></li>';
  }
  $('#loanList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-la]'); if (b) loanAction(b.dataset.la, b.dataset.id, b);
  });
  function openLoan(id) {
    var l = S.loans.find(function (x) { return x.loanId === id; }); if (!l) return;
    openSheet('ใบเบิก ' + l.loanId, '<ul class="list">' + loanCard(l) + '</ul>');
    $('#sheetBody').onclick = function (e) { var b = e.target.closest('[data-la]'); if (b) loanAction(b.dataset.la, b.dataset.id, b); };
  }
  function loanAction(act, id, btn) {
    var l = S.loans.find(function (x) { return x.loanId === id; }); if (!l) return;
    if (act === 'return') { openReturn(l); return; }
    var body = { loanId: id }, label = { approve: 'อนุมัติ', reject: 'ปฏิเสธ', checkout: 'จ่ายของ', cancel: 'ยกเลิก' }[act];
    if (act === 'reject' || act === 'cancel') {
      var why = prompt('เหตุผลที่' + label + ' ' + id + ' (จำเป็น)'); if (why === null) return;
      if (!why.trim()) { toast('ต้องระบุเหตุผล', true); return; } body.reason = why.trim().slice(0, 500);
    }
    else if (act === 'checkout') { if (!confirm('ยืนยันจ่ายของ ' + l.items.length + ' ชิ้น ให้ ' + (l.requesterName || l.requester) + '?')) return; }
    else if (!confirm(label + ' ใบเบิก ' + id + '?')) return;
    btn.disabled = true;
    apiPost('loan_' + act, body).then(function () { toast(label + 'แล้ว · ' + id); closeSheet(); return reload(); })
      .catch(function (r) { toast(errText(r), true); reload(); }).finally(function () { btn.disabled = false; });
  }
  function openReturn(l) {
    var out = l.items.filter(function (i) { return i.itemStatus === 'checked_out'; });
    openSheet('รับคืน · ' + l.loanId,
      '<p class="muted small">เลือกชิ้นที่รับคืนตอนนี้ (คืนบางชิ้นได้ — ชิ้นที่เหลือยังผูกกับใบเบิกและผู้รับผิดชอบเดิม)</p>' +
      '<form id="retForm" class="tab">' + out.map(function (i) {
        return '<div class="ret-row" data-id="' + esc(i.assetId) + '"><label style="flex-direction:row;display:flex;gap:8px;align-items:center;color:var(--text);font-size:15px"><input type="checkbox" class="check" name="pick" checked> <b>' + esc(i.assetId) + '</b> ' + esc(i.assetName) + '</label>' +
          '<div class="flags"><label><input type="checkbox" name="damaged"> เสียหาย (ส่งตรวจ)</label><label><input type="checkbox" name="lost"> สูญหาย</label></div>' +
          '<input name="cond" placeholder="สภาพ / หมายเหตุ (ถ้ามี)" maxlength="200"></div>';
      }).join('') + '<button class="btn primary block" type="submit">ยืนยันรับคืน</button></form>');
    $('#retForm').addEventListener('change', function (e) {
      var n = e.target.name; if ((n === 'damaged' || n === 'lost') && e.target.checked) {
        var other = e.target.closest('.ret-row').querySelector('[name=' + (n === 'damaged' ? 'lost' : 'damaged') + ']'); other.checked = false;
      }
    });
    $('#retForm').addEventListener('submit', function (e) {
      e.preventDefault(); var btn = e.target.querySelector('[type=submit]');
      var items = $$('.ret-row', e.target).filter(function (r) { return r.querySelector('[name=pick]').checked; }).map(function (r) {
        var cond = r.querySelector('[name=cond]').value.trim(), dmg = r.querySelector('[name=damaged]').checked, lost = r.querySelector('[name=lost]').checked;
        // Backend requires a non-empty conditionIn → default to the flag the user ticked.
        return { assetId: r.dataset.id, conditionIn: cond || (lost ? 'สูญหาย' : dmg ? 'เสียหาย' : 'ปกติ'), damaged: dmg, lost: lost, note: cond };
      });
      if (!items.length) { toast('เลือกอย่างน้อย 1 ชิ้น', true); return; }
      btn.disabled = true;
      apiPost('loan_return', { loanId: l.loanId, items: items }).then(function (r) {
        var done = r.loan && r.loan.status === 'returned';
        toast(done ? (loanHasLost(r.loan) ? 'ปิดใบแล้ว (มีของสูญหาย) · ' : 'คืนครบแล้ว · ') + l.loanId : 'บันทึกแล้ว ' + items.length + ' ชิ้น'); closeSheet(); return reload();
      }).catch(function (r) { toast(errText(r), true); reload(); }).finally(function () { btn.disabled = false; });
    });
  }

  /* ---------- report tab ---------- */
  $('#repType').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; S.report = b.dataset.r;
    $$('#repType button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); renderReport();
  });
  ['#rFrom', '#rTo', '#rProject', '#rHolder', '#rSku', '#rStatus'].forEach(function (s) { $(s).addEventListener('input', renderReport); });

  // History/overdue reports must cover ALL loans, not just the bundle window → page through listLoans until hasMore=false.
  var allLoans = null, allLoansP = null;
  // Fail closed: every page must be well-formed; hasMore=true needs a new, non-empty cursor; no repeated
  // cursor or duplicate loan; any error → nothing cached, so export stays blocked.
  function loadAllLoans() {
    if (allLoans) return Promise.resolve(allLoans);
    if (allLoansP) return allLoansP;
    var acc = [], seenCursor = {}, seenLoan = {}, bad = function (m) { throw { error: 'ประวัติใบเบิกไม่ครบ (' + m + ')' }; };
    var p = allLoansP = (function page(cursor) {
      return apiGet('listLoans', cursor ? { cursor: cursor, limit: 1000 } : { limit: 1000 }).then(function (r) {
        if (!Array.isArray(r.items) || typeof r.hasMore !== 'boolean') bad('รูปแบบไม่ถูกต้อง');
        r.items.forEach(function (l) { if (!l || !l.loanId || seenLoan[l.loanId]) bad('ใบซ้ำ'); seenLoan[l.loanId] = 1; acc.push(l); });
        if (!r.hasMore) return acc;
        if (typeof r.nextCursor !== 'string' || !r.nextCursor || seenCursor[r.nextCursor]) bad('cursor ไม่ถูกต้อง');
        seenCursor[r.nextCursor] = 1;
        return page(r.nextCursor);
      });
    })('').then(function (all) { if (allLoansP === p) allLoans = all; return all; })
      .finally(function () { if (allLoansP === p) allLoansP = null; });
    return p;
  }
  function reportLoans() { return allLoans || S.loans; }
  function reportRows() {
    var f = { from: $('#rFrom').value, to: $('#rTo').value, project: $('#rProject').value.trim().toLowerCase(), holder: $('#rHolder').value, sku: $('#rSku').value.trim().toUpperCase(), status: $('#rStatus').value };
    var t = S.report;
    if (t === 'register') {
      return { head: ['รหัสทรัพย์สิน', 'SKU', 'ชื่อ', 'หมวด', 'รุ่น', 'Serial', 'ที่จัดเก็บ', 'สถานะ', 'ผู้ถือ', 'Project', 'กำหนดคืน'],
        rows: S.assets.filter(function (a) { return (!f.sku || a.sku.indexOf(f.sku) >= 0) && (!f.status || a.status === f.status); }).map(function (a) {
          return [a.assetId, a.sku, a.name, a.category, a.model, a.serial, a.location, ASSET_STATUS[a.status] || a.status, a.holder ? userName(a.holder) : '', a.project, a.dueDate];
        }) };
    }
    var rows = [];
    reportLoans().forEach(function (l) {
      if (f.project && l.project.toLowerCase().indexOf(f.project) < 0) return;
      if (f.holder && l.requester !== f.holder) return;
      var rd = bkkDate(l.requestedAt);
      if (t === 'history' && ((f.from && rd < f.from) || (f.to && rd > f.to))) return;
      if (t === 'history' && f.status && l.status !== f.status) return;
      (l.items || []).forEach(function (i) {
        if (f.sku && (i.sku || '').indexOf(f.sku) < 0) return;
        if (t === 'overdue') {
          if (i.itemStatus !== 'checked_out') return;
          rows.push([i.assetId, i.assetName, l.requesterName || l.requester, l.project, l.loanId, csvDT(i.checkedOutAt), l.dueDate, daysLate(l.dueDate) || 0]);
        } else {
          rows.push([l.loanId, l.project, l.requesterName || l.requester, l.approverName || l.approver, i.assetId, i.sku || '', i.assetName, csvDT(l.requestedAt), csvDT(l.approvedAt),
            csvDT(i.checkedOutAt), l.dueDate, i.itemStatus === 'returned' ? csvDT(i.returnedAt) : '', i.itemStatus === 'returned' || i.itemStatus === 'lost' ? csvDT(i.returnedAt) : '',
            i.lost ? 'สูญหาย' : i.damaged ? 'เสียหาย' : (i.conditionIn || ''), ITEM_STATUS[i.itemStatus] || i.itemStatus, loanStatusText(l)]);
        }
      });
    });
    if (t === 'overdue') {
      rows.sort(function (a, b) { return b[7] - a[7]; });
      return { head: ['รหัสทรัพย์สิน', 'ชื่อ', 'ผู้รับผิดชอบ', 'Project', 'เลขใบเบิก', 'วันเวลาจ่ายออก', 'กำหนดคืน', 'เกินกำหนด (วัน)'], rows: rows };
    }
    return { head: ['เลขใบเบิก', 'Project', 'ผู้รับผิดชอบ', 'ผู้อนุมัติ', 'รหัสทรัพย์สิน', 'SKU', 'ชื่อ', 'วันเวลาขอ', 'วันเวลาอนุมัติ', 'วันเวลาจ่ายออก', 'กำหนดคืน', 'วันเวลาคืนจริง', 'วันเวลาปิดรายการ (คืน/สูญหาย)', 'สภาพตอนคืน', 'สถานะชิ้น', 'สถานะใบ'], rows: rows };
  }
  function rangeBad() { var f = $('#rFrom').value, t = $('#rTo').value; return S.report === 'history' && f && t && f > t; }
  function renderReport() {
    if (!S.me) return;
    var t = S.report;
    if (rangeBad()) { $('#repCount').textContent = 'ช่วงวันที่ไม่ถูกต้อง (วันเริ่มอยู่หลังวันสิ้นสุด)'; $('#repTable').innerHTML = ''; return; }
    $$('#repFilters [data-for]').forEach(function (l) { l.hidden = l.dataset.for.split(' ').indexOf(t) < 0; });
    var holders = {}; reportLoans().forEach(function (l) { holders[l.requester] = l.requesterName || l.requester; });
    fillSelect($('#rHolder'), Object.keys(holders).map(function (k) { return [k, holders[k]]; }), 'ทั้งหมด');
    var st = t === 'register' ? ASSET_STATUS : LOAN_STATUS;
    fillSelect($('#rStatus'), Object.keys(st).map(function (k) { return [k, st[k]]; }), 'ทั้งหมด');
    if (t !== 'register' && !allLoans && S.loansTruncated) {
      $('#repCount').textContent = 'กำลังโหลดประวัติทั้งหมด…';
      var dg = S.dataGen;
      loadAllLoans().then(function () { if (dg === S.dataGen) renderReport(); }).catch(function (e) { if (dg === S.dataGen) $('#repCount').textContent = 'โหลดประวัติไม่ครบ: ' + errText(e); });
    }
    var r = reportRows();
    $('#repCount').textContent = r.rows.length + ' แถว' + (r.rows.length > 300 ? ' (แสดง 300 แรก, CSV ครบ)' : '') + (t !== 'register' && !allLoans && S.loansTruncated ? ' · กำลังโหลดเพิ่ม…' : '');
    $('#repTable').innerHTML = '<thead><tr>' + r.head.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (r.rows.length ? r.rows.slice(0, 300).map(function (row) {
        return '<tr>' + row.map(function (c, i) { var v = (r.head[i] || '').indexOf('กำหนดคืน') === 0 && c ? fmtDate(c) : c; return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>';
      }).join('') : '<tr><td colspan="' + r.head.length + '" class="muted">ไม่มีข้อมูล</td></tr>') + '</tbody>';
  }
  // CSV: UTF-8 BOM so Excel reads Thai; cells starting with = + - @ get a leading ' (formula injection guard).
  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  $('#btnCsv').addEventListener('click', function () {
    var btn = this;
    if (rangeBad()) { toast('ช่วงวันที่ไม่ถูกต้อง', true); return; }
    if (S.report !== 'register' && S.loansTruncated && !allLoans) {
      // Continue the export only if no reload/logout happened meanwhile (dataGen covers both). A dropped
      // stale request never settles, so logout() resets this button itself.
      var dg = S.dataGen; btn.disabled = true;
      loadAllLoans().then(function () {
        btn.disabled = false; if (dg !== S.dataGen) return;
        renderReport(); btn.click();
      }).catch(function (e) { btn.disabled = false; if (dg === S.dataGen) toast('Export ไม่ได้ — โหลดประวัติไม่ครบ: ' + errText(e), true); });
      return;
    }
    var r = reportRows();
    var csv = '﻿' + [r.head].concat(r.rows).map(function (row) { return row.map(csvCell).join(','); }).join('\r\n');
    var name = { register: 'ทะเบียนทรัพย์สิน', history: 'ประวัติเบิกคืน', overdue: 'ค้างคืน' }[S.report];
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'CP-ProductionInventory-' + name + '-' + today() + '.csv'; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });

  /* ---------- users tab: invites / people / roles (contract §13) ---------- */
  var PERM_KEYS = [['loan.request', 'เบิก'], ['loan.approve', 'อนุมัติ'], ['loan.issue', 'จ่าย/รับคืน'], ['asset.manage', 'จัดการอุปกรณ์'], ['report.view', 'รายงาน'], ['user.manage', 'จัดการผู้ใช้']];
  S.userSub = 'invites'; S.users = []; S.invites = []; S.roles = [];
  $('#userSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; S.userSub = b.dataset.u;
    $$('#userSeg button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); renderUsersTab();
  });
  function loadUsersTab() {
    var dg = S.dataGen;
    $('#segRoles').hidden = !P().isAdmin; if (S.userSub === 'roles' && !P().isAdmin) S.userSub = 'invites';
    $$('#userSeg button').forEach(function (x) { x.setAttribute('aria-pressed', String(x.dataset.u === S.userSub)); });
    if (!S.users.length) $('#usersBody').innerHTML = '<p class="muted">กำลังโหลด…</p>';
    return Promise.all([apiGet('listUsers'), apiGet('listInvites'), apiGet('listRoles')]).then(function (rs) {
      if (dg !== S.dataGen) return;
      S.users = rs[0].items || []; S.invites = rs[1].items || []; S.roles = rs[2].items || [];
      renderUsersTab();
    }).catch(function (r) { if (dg === S.dataGen) $('#usersBody').innerHTML = '<p class="form-error">' + esc(errText(r)) + '</p>'; });
  }
  function assignableRoles() { return S.roles.filter(function (r) { return r.roleId !== 'admin' || P().isAdmin; }); }
  function roleOptions(sel) { return assignableRoles().map(function (r) { return '<option value="' + esc(r.roleId) + '"' + (r.roleId === sel ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join(''); }
  function renderUsersTab() {
    var sub = S.userSub, body = $('#usersBody');
    if (sub === 'invites') {
      var now = Date.now();
      var live = S.invites.filter(function (i) { return !i.revoked && i.uses < i.maxUses && Date.parse(i.expiresAt) > now; });
      body.innerHTML = '<div class="toolbar end"><button class="btn primary" id="btnInvite">+ สร้างรหัสเชิญ</button></div>' +
        '<ul class="list">' + (S.invites.length ? S.invites.map(function (i) {
          var ok = live.indexOf(i) >= 0, state = i.revoked ? ['cancelled', 'ยกเลิกแล้ว'] : i.uses >= i.maxUses ? ['returned', 'ใช้ครบแล้ว'] : Date.parse(i.expiresAt) <= now ? ['retired', 'หมดอายุ'] : ['pending', 'ใช้ได้'];
          return '<li class="item"><div class="main" style="cursor:default"><div><span class="id">••••••' + esc(i.codeHint) + '</span> · ' + esc(roleName(i.role)) + '</div>' +
            '<div class="meta">ใช้แล้ว ' + i.uses + '/' + i.maxUses + ' · หมดอายุ ' + fmtDT(i.expiresAt) + (i.note ? ' · ' + esc(i.note) : '') + '</div></div>' +
            '<div class="side">' + pill(state[0], state[1]) + (ok && (P().isAdmin || i.role !== 'admin') ? '<button class="btn sm danger" data-revoke="' + esc(i.inviteId) + '">ยกเลิก</button>' : '') + '</div></li>';
        }).join('') : '<li class="empty">ยังไม่มีรหัสเชิญ — สร้างแล้วส่งลิงก์/QR ให้พนักงานสมัครเอง</li>') + '</ul>';
      $('#btnInvite').onclick = openInviteForm;
      body.onclick = function (e) {
        var b = e.target.closest('[data-revoke]'); if (!b || !confirm('ยกเลิกรหัสเชิญนี้? ใช้สมัครไม่ได้อีก')) return; b.disabled = true;
        apiPost('invite_revoke', { inviteId: b.dataset.revoke }).then(function () { toast('ยกเลิกรหัสแล้ว'); loadUsersTab(); }).catch(function (r) { toast(errText(r), true); b.disabled = false; });
      };
    } else if (sub === 'people') {
      body.innerHTML = '<div class="toolbar end"><button class="btn" id="btnAddUser">+ เพิ่มผู้ใช้เอง</button></div><ul class="list">' + S.users.map(function (u) {
        var off = u.active === false || u.active === 'FALSE';
        return '<li class="item"><span class="avatar">' + esc((u.name || u.username).charAt(0).toUpperCase()) + '</span><div class="main" style="cursor:default"><div><span class="id">' + esc(u.name) + '</span> <span class="muted small">@' + esc(u.username) + '</span></div>' +
          '<div class="meta">' + esc(roleName(u.role)) + ' · เข้าใช้ล่าสุด ' + fmtDT(u.lastLoginAt) + '</div></div>' +
          '<div class="side">' + (off ? pill('cancelled', 'ปิดใช้งาน') : pill('available', 'ใช้งาน')) + (canEditUser(u) ? '<button class="btn sm" data-u="' + esc(u.username) + '">แก้ไข</button>' : '') + '</div></li>';
      }).join('') + '</ul>';
      $('#btnAddUser').onclick = function () { openSheet('เพิ่มผู้ใช้', userForm({})); bindUserForm(null); };
      body.onclick = function (e) {
        var b = e.target.closest('[data-u]'); if (!b) return; var u = S.users.find(function (x) { return x.username === b.dataset.u; });
        openSheet('แก้ไขผู้ใช้ @' + u.username, userForm(u)); bindUserForm(u);
      };
    } else {
      body.innerHTML = '<div class="table-wrap"><table class="perm-table"><thead><tr><th>Role</th>' + PERM_KEYS.map(function (k) { return '<th>' + k[1] + '</th>'; }).join('') + '<th>ผู้ใช้</th><th></th></tr></thead><tbody>' +
        S.roles.map(function (r) {
          var lock = r.system;
          return '<tr data-role="' + esc(r.roleId) + '"><td><b>' + esc(r.name) + '</b><br><span class="muted small">' + esc(r.roleId) + (lock ? ' · ล็อก' : '') + '</span></td>' +
            PERM_KEYS.map(function (k) { return '<td class="c"><input type="checkbox" class="check" data-perm="' + k[0] + '"' + (lock || r.perms.indexOf(k[0]) >= 0 ? ' checked' : '') + (lock ? ' disabled' : '') + ' aria-label="' + esc(r.name + ' ' + k[1]) + '"></td>'; }).join('') +
            '<td class="c">' + r.userCount + '</td><td>' + (lock ? '' : '<button class="btn sm primary" data-save>บันทึก</button>' + (r.userCount ? '' : ' <button class="btn sm danger" data-del>ลบ</button>')) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<form id="roleForm" class="card"><h3>เพิ่ม Role ใหม่</h3><div class="row"><label>รหัส role (a-z 0-9 _)<input name="roleId" required pattern="[a-z][a-z0-9_]{1,23}" placeholder="เช่น site_lead"></label>' +
        '<label>ชื่อที่แสดง<input name="name" required maxlength="40" placeholder="เช่น หัวหน้าหน้างาน"></label></div><button class="btn primary">เพิ่ม role</button>' +
        '<p class="muted small">สร้างแล้วติ๊กสิทธิ์ในตารางด้านบนแล้วกดบันทึก · สิทธิ์ที่เปลี่ยนมีผลทันทีกับทุกคนใน role นั้น</p></form>';
      body.onclick = function (e) {
        var tr = e.target.closest('tr[data-role]'); if (!tr) return; var id = tr.dataset.role, r = S.roles.find(function (x) { return x.roleId === id; });
        if (e.target.closest('[data-save]')) {
          var perms = $$('[data-perm]', tr).filter(function (c) { return c.checked; }).map(function (c) { return c.dataset.perm; });
          apiPost('role_upsert', { roleId: id, name: r.name, perms: perms }).then(function () { toast('บันทึกสิทธิ์ ' + r.name + ' แล้ว'); return Promise.all([loadUsersTab(), reload()]); }).catch(function (x) { toast(errText(x), true); });
        }
        if (e.target.closest('[data-del]') && confirm('ลบ role ' + r.name + '?')) {
          apiPost('role_delete', { roleId: id }).then(function () { toast('ลบ role แล้ว'); loadUsersTab(); }).catch(function (x) { toast(errText(x), true); });
        }
      };
      $('#roleForm').onsubmit = function (e) {
        e.preventDefault(); var f = e.target;
        apiPost('role_upsert', { roleId: f.roleId.value.trim(), name: f.name.value.trim(), perms: ['loan.request'] }).then(function () { toast('เพิ่ม role แล้ว'); loadUsersTab(); }).catch(function (x) { toast(errText(x), true); });
      };
    }
  }
  // §13.7: non-admin managers may edit name/PIN of themselves and of non-admin users; never an admin, never their own role/active.
  function canEditUser(u) { return P().isAdmin || u.role !== 'admin'; }

  function openInviteForm() {
    openSheet('สร้างรหัสเชิญ', '<form id="invForm" class="tab">' +
      '<label>สมัครแล้วได้ Role<select name="role" required>' + roleOptions('requester') + '</select></label>' +
      '<div class="row"><label>ใช้ได้กี่คน<input type="number" name="maxUses" min="1" max="50" value="1" required></label>' +
      '<label>หมดอายุใน (วัน)<input type="number" name="expiresDays" min="1" max="30" value="7" required></label></div>' +
      '<label>หมายเหตุ (เช่น ทีมช่างไซต์ A)<input name="note" maxlength="120"></label>' +
      '<button class="btn primary block" type="submit">สร้างรหัส</button></form>');
    var mg = S.modal;
    $('#invForm').addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, btn = f.querySelector('[type=submit]'); btn.disabled = true;
      var body = { role: f.role.value, maxUses: Math.max(1, Math.min(50, +f.maxUses.value || 1)), expiresDays: Math.max(1, Math.min(30, +f.expiresDays.value || 7)) };
      if (f.note.value.trim()) body.note = f.note.value.trim();
      // The one-time code is shown only if this form is still the open modal; otherwise never reopen it.
      apiPost('invite_create', body).then(function (r) {
        loadUsersTab();
        if (mg === S.modal) showInviteCode(r);
        else toast('สร้างรหัสเชิญแล้ว แต่ไม่ได้แสดงรหัส — ยกเลิกรหัสนั้นในรายการแล้วสร้างใหม่', true);
      }).catch(function (r) { if (mg === S.modal) { toast(errText(r), true); btn.disabled = false; } });
    });
  }
  // The full code exists only in this response (contract §13.3) — show it once with link + QR to share.
  function showInviteCode(r) {
    if (!r.code) { openSheet('สร้างรหัสแล้ว', '<p>ระบบสร้างรหัสแล้ว แต่แสดงรหัสซ้ำไม่ได้ — ยกเลิกรหัสนี้แล้วสร้างใหม่</p>'); return; }
    var link = CFG.APP_URL + '?invite=' + encodeURIComponent(r.code), inv = r.invite || {};
    openSheet('รหัสเชิญ', '<p class="muted small">แสดงครั้งเดียว — คัดลอกหรือให้สแกน QR ก่อนปิดหน้านี้</p>' +
      '<div class="invite-code">' + esc(r.code.replace(/(.{4})/, '$1 ')) + '</div>' +
      '<div class="qr-box">' + qrSvg(link) + '<div><p>Role: <b>' + esc(roleName(inv.role)) + '</b></p><p class="muted small">ใช้ได้ ' + esc(inv.maxUses) + ' คน · หมดอายุ ' + fmtDT(inv.expiresAt) + '</p></div></div>' +
      '<div class="row"><button class="btn" id="cpCode">คัดลอกรหัส</button><button class="btn primary" id="cpLink">คัดลอกลิงก์สมัคร</button></div>');
    function copy(t, msg) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast(msg); }, function () { prompt('คัดลอก:', t); }); }
    $('#cpCode').onclick = function () { copy(r.code, 'คัดลอกรหัสแล้ว'); };
    $('#cpLink').onclick = function () { copy(link, 'คัดลอกลิงก์แล้ว'); };
  }

  function userForm(u) {
    var edit = !!u.username, self = edit && u.username === S.me.username;
    return '<form id="userForm" class="tab">' +
      (edit ? '' : '<label>ชื่อผู้ใช้ (a-z 0-9 . _ -)<input name="username" pattern="[a-z0-9._-]{3,24}" required autocapitalize="none"></label>') +
      '<label>ชื่อที่แสดง<input name="name" required maxlength="60" value="' + esc(u.name) + '"></label>' +
      '<div class="row"><label>Role<select name="role"' + (self ? ' disabled' : '') + '>' + roleOptions(u.role || 'requester') + '</select></label>' +
      '<label>' + (edit ? 'PIN ใหม่ (เว้นว่าง = ไม่เปลี่ยน)' : 'PIN (ตัวเลข 4 หลัก)') + '<input name="pin" type="password" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="new-password"' + (edit ? '' : ' required') + '></label></div>' +
      (self ? '<p class="muted small">เปลี่ยน role ของตัวเองไม่ได้</p>' : '') +
      (edit && !self ? '<label style="flex-direction:row;display:flex;gap:8px;align-items:center;color:var(--text)"><input type="checkbox" name="active" class="check"' + (u.active === false || u.active === 'FALSE' ? '' : ' checked') + '> เปิดใช้งาน</label>' : '') +
      '<button class="btn primary block" type="submit">' + (edit ? 'บันทึก' : 'เพิ่มผู้ใช้') + '</button></form>';
  }
  function bindUserForm(u) {
    var pf = $('#userForm').pin; pf.addEventListener('input', function () { pf.value = pf.value.replace(/\D/g, '').slice(0, 4); });
    $('#userForm').addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target, btn = f.querySelector('[type=submit]'); btn.disabled = true;
      var body = { name: f.name.value.trim() }, self = u && u.username === S.me.username;
      if (!self) body.role = f.role.value;
      if (f.pin.value) body.pin = f.pin.value;
      if (u) { body.username = u.username; if (!self) body.active = f.active.checked; } else body.username = f.username.value.trim().toLowerCase();
      apiPost(u ? 'user_update' : 'user_create', body).then(function () { toast('บันทึกแล้ว'); closeSheet(); loadUsersTab(); reload(); })
        .catch(function (r) { toast(errText(r), true); }).finally(function () { btn.disabled = false; });
    });
  }

  /* ---------- scanner ---------- */
  var scanner = null;
  function loadScript(src, sri) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = src; s.integrity = sri; s.crossOrigin = 'anonymous';
      s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  function parseScan(text) {
    try { var u = new URL(text); var a = u.searchParams.get('a'); if (a) return a.toUpperCase(); } catch (e) {}
    return String(text).trim().toUpperCase();
  }
  $('#btnScan').addEventListener('click', function () {
    openSheet('สแกน QR อุปกรณ์',
      '<div id="scanView"></div><p class="muted small" id="scanMsg">เล็งกล้องไปที่ QR บนอุปกรณ์</p>' +
      '<form id="manualForm" class="toolbar"><input name="id" placeholder="หรือพิมพ์รหัส เช่น MEA-0001" autocapitalize="characters"><button class="btn">เปิด</button></form>', stopScanner);
    $('#manualForm').addEventListener('submit', function (e) { e.preventDefault(); var v = e.target.id.value; if (v) onScan(v); });
    var go = window.Html5Qrcode ? Promise.resolve() : loadScript('https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js', 'sha384-c9d8RFSL+u3exBOJ4Yp3HUJXS4znl9f+z66d1y54ig+ea249SpqR+w1wyvXz/lk+');
    go.then(function () {
      if (!$('#scanView')) return;
      scanner = new Html5Qrcode('scanView');
      return scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, onScan, function () {});
    }).catch(function () { var m = $('#scanMsg'); if (m) m.textContent = 'เปิดกล้องไม่ได้ — อนุญาตการใช้กล้อง หรือพิมพ์รหัสด้านล่าง'; });
  });
  function onScan(text) {
    var id = parseScan(text);
    if (!assetById(id)) { var m = $('#scanMsg'); if (m) m.textContent = 'ไม่พบรหัส ' + id + ' ในระบบ'; return; }
    stopScanner().then(function () { if (navigator.vibrate) navigator.vibrate(60); openAsset(id); });
  }
  function stopScanner() {
    var s = scanner; scanner = null;
    return s ? s.stop().catch(function () {}).then(function () { try { s.clear(); } catch (e) {} }) : Promise.resolve();
  }

  /* ---------- sheet ---------- */
  var onSheetClose = null;
  function openSheet(title, html, onClose) {
    S.modal++;
    if (onSheetClose) { var f = onSheetClose; onSheetClose = null; f(); }
    $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = html; $('#sheetBody').onclick = null;
    clearTimeout(sheetHideT); $('#overlay').classList.remove('closing');
    if ($('#overlay').hidden) { $('#overlay').hidden = false; replay($('#overlay'), 'opening'); }
    onSheetClose = onClose || null;
  }
  var sheetHideT = null;
  function closeSheet() {
    S.modal++; if (onSheetClose) { var f = onSheetClose; onSheetClose = null; f(); }
    var ov = $('#overlay'); if (ov.hidden) return;
    ov.classList.remove('opening'); ov.classList.add('closing');
    clearTimeout(sheetHideT);
    sheetHideT = setTimeout(function () { ov.hidden = true; ov.classList.remove('closing'); $('#sheetBody').innerHTML = ''; }, 180);
  }
  $('#sheetClose').addEventListener('click', closeSheet);
  $('#overlay').addEventListener('click', function (e) { if (e.target === e.currentTarget) closeSheet(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('#overlay').hidden) closeSheet(); });

  /* ---------- start ---------- */
  document.addEventListener('visibilitychange', function () { if (!document.hidden && S.me && $('#overlay').hidden) reload().catch(function () {}); });
  S.tab = 'assets';
  try { var t0 = sessionStorage.getItem('cpi_tab'); if (t0 && TAB_TITLES[t0]) S.tab = t0; } catch (e) {}
  switchTab(S.tab);
  // Invite link (?invite=CODE): drop it from the URL/history right away, then open the sign-up form.
  var inviteParam = new URLSearchParams(location.search).get('invite');
  if (inviteParam) history.replaceState(null, '', location.pathname);
  S.token = stored('cpi_token');
  if (S.token && !inviteParam) boot();
  else { if (inviteParam) { store('cpi_token', null); S.token = null; } showLogin(); if (inviteParam) showRegister(inviteParam); }
})();
