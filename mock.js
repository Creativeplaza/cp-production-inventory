/* Local mock of the backend contract v0.5.2 (PRODUCTION_INVENTORY_CONTRACT.md §5–6, §13).
   Active only when CPI_CONFIG.API_URL is empty. State lives in localStorage so flows can be tested end-to-end.
   Mock users (PIN 1234): admin, appr (approver), store (storekeeper), req (requester). */
(function () {
  if (window.CPI_CONFIG.API_URL) return;
  var KEY = 'cpi_mock_v3';
  function seed() {
    var now = new Date().toISOString();
    function a(id, sku, name, cat, model, serial, loc) {
      return { assetId: id, sku: sku, name: name, category: cat, model: model, serial: serial, location: loc, status: 'available',
        currentLoanId: '', holder: '', project: '', dueDate: '', notes: '', createdAt: now, updatedAt: now };
    }
    function st(id, sku, name, cat, kind, unit, qty, min, loc) {
      return { stockId: id, sku: sku, name: name, category: cat, division: 'production', kind: kind, unit: unit, onHand: qty, minLevel: min, location: loc, notes: '', active: true, createdAt: now, updatedAt: now };
    }
    return {
      users: [
        { username: 'admin', name: 'ผู้ดูแลระบบ', role: 'admin', active: true },
        { username: 'appr', name: 'หัวหน้าฝ่ายผลิต', role: 'approver', active: true },
        { username: 'store', name: 'เจ้าหน้าที่คลัง', role: 'storekeeper', active: true },
        { username: 'req', name: 'ช่างหน้างาน', role: 'requester', active: true }
      ],
      assets: [
        a('MEA-0001', 'MEA-LDM50', 'เครื่องวัดระยะเลเซอร์ 50 ม.', 'MEA', 'Bosch GLM 50', 'BS50-1182', 'ตู้ A ชั้น 1'),
        a('MEA-0002', 'MEA-LDM50', 'เครื่องวัดระยะเลเซอร์ 50 ม.', 'MEA', 'Bosch GLM 50', 'BS50-1190', 'ตู้ A ชั้น 1'),
        a('MEA-0003', 'MEA-TAPE8', 'ตลับเมตร 8 ม.', 'MEA', 'Stanley 8m', '', 'ตู้ A ชั้น 2'),
        a('MEA-0004', 'MEA-LVL', 'เลเซอร์วัดระดับ', 'MEA', 'Bosch GLL 3-80', 'GLL-2231', 'ตู้ A ชั้น 3'),
        a('CAM-0001', 'CAM-SCAN3D', 'เครื่องสแกน 3 มิติ', 'CAM', 'Creality Raptor', 'CR-77120', 'ตู้ B'),
        a('TOL-0001', 'TOL-WHEEL', 'ล้อวัดระยะ', 'TOL', 'Measuring wheel 10km', '', 'ตู้ B')
      ],
      roles: [
        { roleId: 'admin', name: 'ผู้ดูแลระบบ', perms: ALL_PERMS.slice(), system: true },
        { roleId: 'approver', name: 'ผู้อนุมัติ', perms: ['loan.request', 'loan.approve', 'report.view'], system: false },
        { roleId: 'storekeeper', name: 'ผู้ดูแลคลัง', perms: ['loan.request', 'loan.issue', 'report.view'], system: false },
        { roleId: 'requester', name: 'ผู้เบิก', perms: ['loan.request'], system: false }
      ],
      categories: [{ code: 'MEA', name: 'อุปกรณ์วัด', active: true }, { code: 'CAM', name: 'กล้อง / สแกน 3D', active: true }, { code: 'TOL', name: 'เครื่องมือ', active: true }, { code: 'OTH', name: 'อื่นๆ', active: true }, { code: 'SVN', name: 'วัสดุสิ้นเปลือง', active: true }],
      // v0.13 §23: counted / consumable stock (one row per SKU, quantity on hand + ledger)
      stock: [
        st('SVN-S0001', 'SVN-TAPE', 'เทปผ้า 2 นิ้ว', 'SVN', 'consumable', 'ม้วน', 24, 10, 'ชั้น C'),
        st('SVN-S0002', 'SVN-TIE', 'เคเบิลไทร์ 8 นิ้ว', 'SVN', 'consumable', 'ถุง', 3, 5, 'ชั้น C'),
        st('TOL-S0001', 'TOL-HDMI5', 'สาย HDMI 5 ม.', 'TOL', 'counted', 'เส้น', 20, 4, 'ตู้ B')
      ],
      stockMoves: [], stockOutcomes: [],
      photos: [],
      invites: [], badInvite: [],
      loans: [], events: [], seq: {}
    };
  }
  function load() { var d; try { d = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { d = seed(); }
    if (!d.stock) { var s0 = seed(); d.stock = s0.stock; d.stockMoves = []; d.stockOutcomes = []; if (!d.categories.some(function (c) { return c.code === 'SVN'; })) d.categories.push({ code: 'SVN', name: 'วัสดุสิ้นเปลือง', active: true }); }
    if (!d.stockMoves.length) d.stock.forEach(function (x) { if (x.onHand > 0) d.stockMoves.push({ moveId: 'M' + (d.stockMoves.length + 1), at: x.createdAt, actor: 'admin', stockId: x.stockId, type: 'create', qty: x.onHand, loanId: '', note: '' }); });
    if (!d.units) { d.units = []; d.loanUnits = []; d.unitEvents = []; d.stock.forEach(function (x) { if (x.kind === 'counted') for (var i = 1; i <= x.onHand; i++) d.units.push({ unitId: x.sku + '-' + String(i).padStart(2, '0'), stockId: x.stockId, status: 'available', holder: '', loanId: '', seq: i }); }); }
    mockDb = d; return d; }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }
  var CODES = { 400: 'VALIDATION', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'BAD_TRANSITION', 429: 'RATE_LIMITED', 503: 'BUSY' };
  // v0.4 envelope: {success:false,status,code,error}. Second arg is a SYMBOL when upper-case, else a human message.
  function err(status, msg, extra) {
    var sym = /^[A-Z_]+$/.test(msg) ? msg : CODES[status];
    return Object.assign({ success: false, status: status, code: sym, error: /^[A-Z_]+$/.test(msg) ? sym : msg }, extra || {});
  }
  function sessUser(db, token) {
    var u = token && token.indexOf('mock-') === 0 ? token.slice(5) : '';
    return db.users.find(function (x) { return x.username === u && x.active; }) || null;
  }
  var ALL_PERMS = ['loan.request', 'loan.approve', 'loan.issue', 'asset.manage', 'report.view', 'user.manage'];
  var mockDb = null;
  function has(u, key) { if (u.role === 'admin') return true; var r = mockDb.roles.find(function (x) { return x.roleId === u.role; }); return !!r && r.perms.indexOf(key) >= 0; }
  function perms(u) {
    return { loanRequest: has(u, 'loan.request'), loanApprove: has(u, 'loan.approve'), loanIssue: has(u, 'loan.issue'), assetManage: has(u, 'asset.manage'),
      reportView: has(u, 'report.view'), userManage: has(u, 'user.manage'), isAdmin: u.role === 'admin' };
  }
  // v0.9 profile: public fields only (no hash/salt/role internals)
  function avatarOf(db, u) { var x = u.avatarPhotoId && db.photos.find(function (p) { return p.photoId === u.avatarPhotoId && p.status === 'attached'; }); return x ? x.thumb : ''; }
  function profileOf(db, u) { return { username: u.username, name: u.name, phone: u.phone || '', department: u.department || '', avatarThumb: avatarOf(db, u) }; }
  function nameOf(db, un) { var u = db.users.find(function (x) { return x.username === un; }) || (db.deletedUsers || []).find(function (x) { return x.username === un; }); return u ? u.name : un; }
  function takenName(db, un) { return db.users.some(function (x) { return x.username === un; }) || (db.deletedUsers || []).some(function (x) { return x.username === un; }); }
  // v0.12 §22: blank Division (older rows) reads as production
  var DIVS = ['production', 'operation', 'backoffice', 'central'];
  function divOut(a) { return Object.assign({}, a, { division: a.division || 'production' }); }
  // v0.13 §23 stock helpers
  var OPEN_LOAN = ['pending', 'approved'];
  function stockBy(db, id) { return (db.stock || []).find(function (x) { return x.stockId === id; }); }
  function reservedOf(db, id) {
    return db.loans.reduce(function (n, l) { return OPEN_LOAN.indexOf(l.status) < 0 ? n : (l.stockLines || []).reduce(function (m, x) { return x.stockId === id && x.lineStatus === 'requested' ? m + x.qtyRequested : m; }, n); }, 0);
  }
  function stockOut(db, x) {
    var r = reservedOf(db, x.stockId), av = x.onHand - r;
    var o = Object.assign({}, x, { reserved: r, available: av, deficit: Math.max(0, r - x.onHand), lowStock: x.minLevel > 0 && av <= x.minLevel });
    if (x.kind === 'counted') o.unitCounts = unitCounts(db, x.stockId);
    return o;
  }
  function move(db, actor, id, type, qty, loanId, note) { db.stockMoves.push({ moveId: 'M' + (db.stockMoves.length + 1), at: new Date().toISOString(), actor: actor, stockId: id, type: type, qty: qty, loanId: loanId || '', note: note || '' }); }
  function outcome(db, actor, loanId, id, ret, used, lost, reason) { db.stockOutcomes.push({ outcomeId: 'O' + (db.stockOutcomes.length + 1), at: new Date().toISOString(), actor: actor, loanId: loanId, stockId: id, returned: ret, used: used, lost: lost, reason: reason || '' }); }
  function isInt(v, lo, hi) { return typeof v === 'number' && Math.floor(v) === v && v >= lo && v <= hi; }
  function outstanding(x) { return x.qtyIssued - x.qtyReturned - x.qtyUsed - x.qtyLost; }
  var LEFTOVER_MS = 30 * 864e5;
  // v0.14 §24: auto SKU {CAT}-{NNN} shared by assets + stock; per-unit tracking for counted
  function nextSku(db, cat) {
    var re = new RegExp('^' + cat + '-(\\d{3,})$'), m = 0;
    db.assets.concat(db.deletedAssets || [], db.stock || []).forEach(function (x) { var k = re.exec(x.sku || ''); if (k) m = Math.max(m, +k[1]); });
    return cat + '-' + String(m + 1).padStart(3, '0');
  }
  function unitsOf(db, id) { return db.units.filter(function (x) { return x.stockId === id; }); }
  function unitCounts(db, id) { var c = { available: 0, out: 0, inspection: 0, lost: 0, retired: 0 }; unitsOf(db, id).forEach(function (x) { c[x.status]++; }); return c; }
  function uev(db, actor, x, from, to, loanId, reason, note) { db.unitEvents.push({ eventId: 'U' + (db.unitEvents.length + 1), at: new Date().toISOString(), actor: actor, unitId: x.unitId, stockId: x.stockId, loanId: loanId || '', from: from, to: to, reason: reason || '', note: note || '' }); }
  function addUnits(db, actor, sx, n) {
    var seq = unitsOf(db, sx.stockId).reduce(function (m, x) { return Math.max(m, x.seq); }, 0);
    for (var i = 1; i <= n; i++) { var u0 = { unitId: sx.sku + '-' + String(seq + i).padStart(2, '0'), stockId: sx.stockId, status: 'available', holder: '', loanId: '', seq: seq + i }; db.units.push(u0); uev(db, actor, u0, '', 'available', '', '', ''); }
  }
  function unitOut(db, x) { return Object.assign({}, x, { holderName: x.holder ? nameOf(db, x.holder) : '' }); }
  function assetBy(db, id) { return db.assets.find(function (x) { return x.assetId === id; }); }
  function loanOut(db, l) {
    var o = JSON.parse(JSON.stringify(l));
    o.stockLines = (l.stockLines || []).map(function (x) { var y = Object.assign({}, x); if (x.kind === 'counted') { y.qtyDamaged = x.qtyDamaged || 0; y.units = db.loanUnits.filter(function (z) { return z.loanId === l.loanId && z.stockId === x.stockId; }).map(function (z) { return { unitId: z.unitId, outcome: z.outcome }; }); } if (x.kind === 'consumable' && x.qtyIssued > 0 && l.checkedOutAt) y.leftoverUntil = new Date(Date.parse(l.checkedOutAt) + LEFTOVER_MS).toISOString(); return y; });
    o.requesterName = nameOf(db, l.requester); o.approverName = l.approver ? nameOf(db, l.approver) : ''; o.approvedByName = l.approvedBy ? nameOf(db, l.approvedBy) : '';
    o.items.forEach(function (it) {
      var a = assetBy(db, it.assetId), del = !a && (db.deletedAssets || []).find(function (x) { return x.assetId === it.assetId; });
      a = a || del || {}; it.assetName = a.name || ''; it.sku = a.sku || ''; it.assetDeleted = !!del;
      it.photos = db.photos.filter(function (x) { return x.status === 'attached' && x.kind === 'return' && x.loanId === l.loanId && x.assetId === it.assetId; }).map(function (x) { return { photoId: x.photoId, thumb: x.thumb }; });
    });
    return o;
  }
  function approvers(db) {
    return db.users.filter(function (u) { return u.active && has(u, 'loan.approve'); })
      .map(function (u) { return { username: u.username, name: u.name }; });
  }
  function ev(db, actor, action, loanId, assetId, from, to, detail, rid) {
    db.events.push({ eventId: 'E' + (db.events.length + 1), at: new Date().toISOString(), actor: actor, action: action,
      loanId: loanId || '', assetId: assetId || '', fromStatus: from || '', toStatus: to || '', detail: detail || '', requestId: rid || '' });
  }
  function todayBkk() { return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); }
  function setAsset(db, id, status, loan, actor, action, rid) {
    var a = assetBy(db, id); var from = a.status; a.status = status; a.updatedAt = new Date().toISOString();
    if (loan && (status === 'reserved' || status === 'checked_out')) { a.currentLoanId = loan.loanId; a.holder = loan.requester; a.project = loan.project; a.dueDate = loan.dueDate; }
    else { a.currentLoanId = ''; a.holder = ''; a.project = ''; a.dueDate = ''; }
    ev(db, actor, action, loan && loan.loanId, id, from, status, '', rid);
  }

  function get(api, p) {
    var db = load(); var u = sessUser(db, p.token);
    if (!u) return err(401, 'Unauthorized');
    if (api === 'me') return { success: true, user: { username: u.username, name: u.name, role: u.role }, perms: perms(u) };
    if (api === 'bundle') return { success: true, assets: db.assets.map(function (a) { var ph = db.photos.filter(function (x) { return x.status === 'attached' && x.kind === 'asset' && x.assetId === a.assetId; }).sort(function (x, y) { return x.position - y.position; }); return Object.assign(divOut(a), { photoCount: ph.length, coverPhotoId: ph.length ? ph[0].photoId : '' }); }), loans: db.loans.slice().reverse().map(function (l) { return loanOut(db, l); }), loansTruncated: false,
      approvers: approvers(db), categories: db.categories, roles: db.roles.map(function (r) { return { roleId: r.roleId, name: r.name }; }),
      stock: (db.stock || []).map(function (x) { return stockOut(db, x); }),
      deletedUsers: (db.deletedUsers || []).map(function (x) { return { username: x.username, name: x.name }; }),
      people: db.users.filter(function (x) { return x.active; }).map(function (x) { return profileOf(db, x); }),
      me: Object.assign(profileOf(db, u), { role: u.role, perms: perms(u), avatarPhotoId: u.avatarPhotoId || '' }), serverTime: Date.now() };
    if (api === 'listStockUnits') {
      var sx0 = stockBy(db, p.stockId); if (!sx0) return err(404, 'NOT_FOUND');
      var all = unitsOf(db, sx0.stockId).filter(function (x) { return !p.status || x.status === p.status; }).sort(function (a, c) { return a.seq - c.seq; });
      var lim = Math.min(200, p.limit || 200), start = p.cursor ? +p.cursor : 0; if (p.cursor && !(start > 0)) return err(400, 'VALIDATION');
      var page = all.slice(start, start + lim);
      return { success: true, items: page.map(function (x) { return unitOut(db, x); }), cursor: start + lim < all.length ? String(start + lim) : '', hasMore: start + lim < all.length };
    }
    if (api === 'getUnit') {
      var ux = db.units.find(function (x) { return x.unitId === p.unitId; }); if (!ux) return err(404, 'NOT_FOUND');
      var hist = db.unitEvents.filter(function (e) { return e.unitId === ux.unitId; }).slice().reverse();
      return { success: true, unit: unitOut(db, ux), item: stockOut(db, stockBy(db, ux.stockId)), history: hist.slice(0, 100).map(function (e) { return Object.assign({}, e, { actorName: nameOf(db, e.actor) }); }), historyTruncated: hist.length > 100 };
    }
    if (api === 'getStock') {
      var sx = stockBy(db, p.stockId); if (!sx) return err(404, 'NOT_FOUND');
      var mv = db.stockMoves.filter(function (m) { return m.stockId === sx.stockId; }).slice().reverse();
      var openL = db.loans.filter(function (l) { return (l.stockLines || []).some(function (x) { return x.stockId === sx.stockId && (x.lineStatus === 'requested' || x.lineStatus === 'issued'); }) && ['pending', 'approved', 'checked_out', 'partially_returned'].indexOf(l.status) >= 0; }).map(function (l) { return loanOut(db, l); });
      return { success: true, item: stockOut(db, sx), moves: mv.slice(0, 100).map(function (m) { return Object.assign({}, m, { actorName: nameOf(db, m.actor) }); }), movesTruncated: mv.length > 100, loans: openL };
    }
    if (api === 'getAsset') {
      var a = assetBy(db, p.id); if (!a) return err(404, 'NOT_FOUND');
      var ph = db.photos.filter(function (x) { return x.status === 'attached' && x.kind === 'asset' && x.assetId === a.assetId; }).sort(function (x, y) { return x.position - y.position; })
        .map(function (x) { return { photoId: x.photoId, thumb: x.thumb, width: x.width, height: x.height, uploadedAt: x.uploadedAt }; });
      return { success: true, item: divOut(a), photos: ph,
        loans: db.loans.filter(function (l) { return l.items.some(function (i) { return i.assetId === a.assetId; }); }).reverse().map(function (l) { return loanOut(db, l); }),
        events: db.events.filter(function (e) { return e.assetId === a.assetId; }).reverse().slice(0, 100) };
    }
    if (api === 'listLoans') {
      if (!has(u, 'report.view')) return err(403, 'FORBIDDEN');
      var all = db.loans.slice().reverse(), start = +(p.cursor || 0), lim = Math.min(+p.limit || 500, 1000);
      return { success: true, items: all.slice(start, start + lim).map(function (l) { return loanOut(db, l); }), hasMore: start + lim < all.length, nextCursor: start + lim < all.length ? String(start + lim) : '' };
    }
    if (api === 'assetCovers') {
      var ids = p.assetIds; if (!Array.isArray(ids) || !ids.length || ids.length > 40) return err(400, 'VALIDATION');
      return { success: true, covers: ids.map(function (id) { var ph = db.photos.filter(function (x) { return x.status === 'attached' && x.kind === 'asset' && x.assetId === id; }).sort(function (x, y) { return x.position - y.position; })[0]; return ph ? { assetId: id, photoId: ph.photoId, thumb: ph.thumb } : null; }).filter(Boolean) };
    }
    if (api === 'getPhoto') {
      var pp = db.photos.find(function (x) { return x.photoId === p.photoId; });
      if (!pp || (pp.status === 'pending' && pp.uploadedBy !== u.username) || (pp.status === 'detached' && pp.uploadedBy !== u.username && u.role !== 'admin')) return err(404, 'NOT_FOUND');
      return { success: true, photo: { photoId: pp.photoId, mime: 'image/jpeg', data: pp.thumb.split(',')[1] } };
    }
    if (api === 'listUsers') { if (!has(u, 'user.manage')) return err(403, 'FORBIDDEN'); return { success: true, items: db.users.map(function (x) { return { username: x.username, name: x.name, role: x.role, active: x.active, lastLoginAt: x.lastLoginAt || '' }; }) }; }
    if (api === 'listInvites') { if (!has(u, 'user.manage')) return err(403, 'FORBIDDEN'); return { success: true, items: db.invites.map(function (i) { var o = Object.assign({}, i); delete o.code; return o; }).reverse() }; }
    if (api === 'listRoles') { if (!has(u, 'user.manage')) return err(403, 'FORBIDDEN'); return { success: true, permKeys: ALL_PERMS, items: db.roles.map(function (r) { return Object.assign({}, r, { perms: r.system ? ALL_PERMS.slice() : r.perms, userCount: db.users.filter(function (x) { return x.role === r.roleId; }).length }); }) }; }
    return err(400, 'Unknown api');
  }

  function post(b) {
    var db = load();
    if (b.action === 'login') {
      var lu = db.users.find(function (x) { return x.username === String(b.username || '').toLowerCase() && x.active; });
      if (!lu || typeof b.pin !== 'string' || !/^\d{4}$/.test(b.pin) || b.pin !== (lu.pin || '1234')) return err(401, 'INVALID_CREDENTIALS');
      lu.lastLoginAt = new Date().toISOString(); save(db);
      return { success: true, token: 'mock-' + lu.username, user: { username: lu.username, name: lu.name, role: lu.role } };
    }
    if (b.action === 'logout') return { success: true };
    if (b.action === 'register') {
      var t0 = Date.now(); db.badInvite = (db.badInvite || []).filter(function (t) { return t > t0 - 900000; });
      var code = String(b.inviteCode || '').toUpperCase().replace(/[\s-]/g, '').slice(0, 32);
      var inv = db.invites.find(function (i) { return i.code === code; });
      var valid = inv && !inv.revoked && inv.uses < inv.maxUses && Date.parse(inv.expiresAt) > t0 && db.roles.some(function (r) { return r.roleId === inv.role; });
      // v0.5.1: valid codes pass the invalid-code cooldown; only wrong codes are throttled.
      if (!valid) { if (db.badInvite.length >= 20) return err(429, 'RATE_LIMIT'); db.badInvite.push(t0); save(db); return err(400, 'INVITE_INVALID'); }
      var un = String(b.username || '').trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,24}$/.test(un) || !String(b.name || '').trim() || !/^\d{4}$/.test(b.pin || '')) return err(400, 'ข้อมูลไม่ครบ');
      if (takenName(db, un)) return err(409, 'USER_EXISTS');
      var nu = { username: un, name: b.name.trim(), role: inv.role, active: true, pin: b.pin, lastLoginAt: new Date().toISOString() };
      db.users.push(nu); inv.uses++; inv.lastUsedAt = new Date().toISOString(); ev(db, un, 'register', '', '', '', inv.role, inv.inviteId, '');
      save(db); return { success: true, token: 'mock-' + un, user: { username: un, name: nu.name, role: nu.role } };
    }
    var u = sessUser(db, b.token); if (!u) return err(401, 'Unauthorized');
    var P = perms(u), rid = b.requestId;
    var dup = rid && db.events.find(function (e) { return e.requestId === rid; });
    if (dup) return { success: true, duplicate: true };
    // photos (§14): validate a set of ids for attachment
    function photoSet(ids, kind, min, max, assetId) {
      if (!Array.isArray(ids) || ids.length < min || ids.length > max || new Set(ids).size !== ids.length) return 'PHOTO_COUNT';
      var t = Date.now();
      for (var q = 0; q < ids.length; q++) {
        var x = db.photos.find(function (y) { return y.photoId === ids[q]; });
        var keep = x && x.status === 'attached' && kind === 'asset' && x.kind === 'asset' && assetId && x.assetId === assetId;
        var fresh = x && x.status === 'pending' && x.kind === kind && x.uploadedBy === u.username && t - Date.parse(x.uploadedAt) < 864e5;
        if (!keep && !fresh) return 'PHOTO_INVALID';
      }
      return '';
    }
    function attach(ids, kind, assetId, loanId) {
      if (kind === 'asset') db.photos.forEach(function (x) { if (x.kind === 'asset' && x.assetId === assetId && x.status === 'attached' && ids.indexOf(x.photoId) < 0) { x.status = 'detached'; } });
      ids.forEach(function (id, i) { var x = db.photos.find(function (y) { return y.photoId === id; }); x.status = 'attached'; x.assetId = assetId; x.loanId = loanId || ''; x.position = i + 1; });
    }
    var loan = b.loanId && db.loans.find(function (l) { return l.loanId === b.loanId; });
    var now = new Date().toISOString(), r;
    switch (b.action) {
      case 'photo_upload': {
        if (b.kind === 'asset' ? !P.assetManage : b.kind === 'return' ? !P.loanIssue : b.kind !== 'avatar') return err(403, 'FORBIDDEN');
        if (!/^data:image\/jpeg;base64,/.test(b.thumb || '') || !b.data) return err(400, 'PHOTO_INVALID');
        if (db.photos.filter(function (x) { return x.status === 'pending' && x.uploadedBy === u.username; }).length >= 30) return err(429, 'PHOTO_QUOTA');
        var pid = 'P' + (db.photos.length + 1) + '-' + Math.random().toString(36).slice(2, 7);
        db.photos.push({ photoId: pid, kind: b.kind, thumb: b.thumb, width: b.width, height: b.height, status: 'pending', uploadedBy: u.username, uploadedAt: now, assetId: '', loanId: '', position: 0 });
        ev(db, u.username, 'photo_upload', '', '', '', '', pid, rid); save(db);
        return { success: true, photo: { photoId: pid, kind: b.kind, thumb: b.thumb, width: b.width, height: b.height } };
      }
      case 'profile_update': {
        var allowed = ['name', 'phone', 'department', 'avatarPhotoId'], keys = Object.keys(b).filter(function (k) { return ['action', 'token', 'requestId'].indexOf(k) < 0; });
        if (!keys.length || keys.some(function (k) { return allowed.indexOf(k) < 0; })) return err(400, 'ข้อมูลโปรไฟล์ไม่ถูกต้อง');
        if (b.name !== undefined && (!String(b.name).trim() || String(b.name).trim().length > 60)) return err(400, 'ชื่อ 1–60 ตัวอักษร');
        if (b.phone !== undefined && (String(b.phone).length > 20 || !/^[0-9+\-() ]*$/.test(b.phone))) return err(400, 'เบอร์โทรไม่ถูกต้อง');
        if (b.department !== undefined && String(b.department).length > 60) return err(400, 'แผนกยาวเกินไป');
        var me = db.users.find(function (x) { return x.username === u.username; });
        if (b.avatarPhotoId !== undefined && b.avatarPhotoId !== '') {
          var av = db.photos.find(function (x) { return x.photoId === b.avatarPhotoId; });
          if (!av || av.status !== 'pending' || av.kind !== 'avatar' || av.uploadedBy !== u.username) return err(400, 'PHOTO_INVALID');
        }
        if (b.avatarPhotoId !== undefined) {
          db.photos.forEach(function (x) { if (x.kind === 'avatar' && x.photoId === me.avatarPhotoId && x.status === 'attached') x.status = 'detached'; });
          if (b.avatarPhotoId) db.photos.find(function (x) { return x.photoId === b.avatarPhotoId; }).status = 'attached';
          me.avatarPhotoId = b.avatarPhotoId;
        }
        if (b.name !== undefined) me.name = String(b.name).trim();
        if (b.phone !== undefined) me.phone = String(b.phone).trim();
        if (b.department !== undefined) me.department = String(b.department).trim();
        ev(db, u.username, 'profile_update', '', '', '', '', '', rid); save(db);
        return { success: true, user: Object.assign(profileOf(db, me), { role: me.role, avatarPhotoId: me.avatarPhotoId || '' }) };
      }
      case 'category_upsert': {
        if (!P.assetManage) return err(403, 'FORBIDDEN');
        if (!/^[A-Z]{2,4}$/.test(b.code || '') || !String(b.name || '').trim()) return err(400, 'ข้อมูลหมวดไม่ถูกต้อง');
        var cat = db.categories.find(function (x) { return x.code === b.code; });
        if (cat) { cat.name = b.name.trim(); cat.active = b.active !== false; } else db.categories.push({ code: b.code, name: b.name.trim(), active: b.active !== false });
        ev(db, u.username, 'category_upsert', '', '', '', '', b.code, rid); save(db); return { success: true };
      }
      case 'asset_delete': {
        if (!P.assetManage) return err(403, 'FORBIDDEN');
        var da = assetBy(db, b.assetId); if (!da) return err(404, 'NOT_FOUND');
        if (b.confirm !== da.assetId) return err(400, 'CONFIRM_MISMATCH');
        var busy = !!da.currentLoanId || da.status === 'reserved' || da.status === 'checked_out' || db.loans.some(function (l) {
          return ['pending', 'approved', 'checked_out', 'partially_returned'].indexOf(l.status) >= 0 && l.items.some(function (i) { return i.assetId === da.assetId && (i.itemStatus === 'requested' || i.itemStatus === 'checked_out'); });
        });
        if (busy) return err(409, 'ASSET_IN_USE');
        db.deletedAssets = db.deletedAssets || [];
        db.deletedAssets.push({ assetId: da.assetId, sku: da.sku, name: da.name, category: da.category, model: da.model, serial: da.serial, deletedAt: now, deletedBy: u.username });
        db.assets = db.assets.filter(function (x) { return x !== da; });
        db.photos.forEach(function (x) { if (x.kind === 'asset' && x.assetId === da.assetId && x.status === 'attached') { x.status = 'detached'; x.detachedAt = now; } });
        ev(db, u.username, 'asset_delete', '', da.assetId, da.status, '', '', rid); save(db); return { success: true };
      }
      case 'category_delete': {
        if (!P.assetManage) return err(403, 'FORBIDDEN');
        if (!db.categories.some(function (x) { return x.code === b.code; })) return err(404, 'NOT_FOUND');
        var used = db.assets.filter(function (x) { return x.category === b.code; }).length, usedS = (db.stock || []).filter(function (x) { return x.category === b.code; }).length;
        if (used || usedS) return err(409, 'CATEGORY_IN_USE', { count: used + usedS, assets: used, stock: usedS });
        db.categories = db.categories.filter(function (x) { return x.code !== b.code; });
        ev(db, u.username, 'category_delete', '', '', '', '', b.code, rid); save(db); return { success: true };
      }
      case 'asset_create': {
        if (!P.assetManage) return err(403, 'FORBIDDEN');
        if ('sku' in b) return err(400, 'VALIDATION');
        var ref = null;
        if (b.sameAs !== undefined) {
          if ('name' in b || 'model' in b || 'category' in b) return err(400, 'VALIDATION');
          ref = assetBy(db, b.sameAs); if (!ref) return err(404, 'NOT_FOUND');
          b.category = ref.category; b.name = ref.name; b.model = ref.model;
          if (b.division === undefined) b.division = ref.division || 'production';
          if (b.location === undefined) b.location = ref.location;
        }
        if (!db.categories.some(function (x) { return x.code === b.category && x.active; })) return err(400, 'หมวดนี้ปิดใช้หรือไม่มีอยู่');
        if (b.division !== undefined && DIVS.indexOf(b.division) < 0) return err(400, 'VALIDATION');
        var pe = photoSet(b.photoIds, 'asset', 1, 5, null); if (pe) return err(400, pe === 'PHOTO_COUNT' ? 'ต้องมีรูป 1–5 รูป' : 'PHOTO_INVALID');
        if (!/^[A-Z]{2,4}$/.test(b.category || '')) return err(400, 'หมวดไม่ถูกต้อง');
        if (!b.name) return err(400, 'ต้องระบุชื่อ');
        var skuA = ref ? ref.sku : nextSku(db, b.category);
        // §17.2: next number = max over live + deleted assets of this prefix (never reuse an AssetID)
        var n = db.assets.concat(db.deletedAssets || []).reduce(function (m, x) { var k = x.assetId.split('-'); return k[0] === b.category ? Math.max(m, +k[1] || 0) : m; }, 0) + 1;
        var id = b.category + '-' + String(n).padStart(4, '0');
        var na = { assetId: id, sku: skuA, name: b.name, category: b.category, model: b.model || '', serial: b.serial || '', location: b.location || '',
          status: 'available', currentLoanId: '', holder: '', project: '', dueDate: '', notes: b.notes || '', division: b.division || 'production', createdAt: now, updatedAt: now };
        db.assets.push(na); attach(b.photoIds, 'asset', id); ev(db, u.username, 'asset_create', '', id, '', 'available', '', rid); save(db); return { success: true, asset: divOut(na) };
      }
      case 'asset_update': {
        if (!P.assetManage) return err(403, 'FORBIDDEN');
        if ('sku' in b) return err(400, 'VALIDATION');
        var ua = assetBy(db, b.assetId); if (!ua) return err(404, 'NOT_FOUND');
        if (b.photoIds !== undefined) { var pu = photoSet(b.photoIds, 'asset', 1, 5, ua.assetId); if (pu) return err(400, pu === 'PHOTO_COUNT' ? 'ต้องมีรูป 1–5 รูป' : 'PHOTO_INVALID'); attach(b.photoIds, 'asset', ua.assetId); }
        if (b.division !== undefined && DIVS.indexOf(b.division) < 0) return err(400, 'VALIDATION');
        ['name', 'model', 'serial', 'location', 'notes', 'division'].forEach(function (k) { if (b[k] !== undefined) ua[k] = b[k]; });
        if (!ua.division) ua.division = 'production'; // like the backend: an edit writes the default into a blank legacy row
        if (b.status && b.status !== ua.status) {
          if (ua.currentLoanId) return err(409, 'BAD_TRANSITION');
          if (['available', 'inspection', 'maintenance', 'lost', 'retired'].indexOf(b.status) < 0) return err(409, 'BAD_TRANSITION');
          setAsset(db, ua.assetId, b.status, null, u.username, 'asset_update', rid);
        } else ev(db, u.username, 'asset_update', '', ua.assetId, ua.status, ua.status, '', rid);
        ua.updatedAt = now; save(db); return { success: true, asset: divOut(ua) };
      }
      case 'loan_request': {
        if (!P.loanRequest) return err(403, 'FORBIDDEN');
        var ids = b.assetIds || [], sl = b.stockLines || [];
        if (!Array.isArray(ids) || !Array.isArray(sl) || (!ids.length && !sl.length) || ids.length > 20 || sl.length > 20 || new Set(ids).size !== ids.length) return err(400, 'รายการอุปกรณ์ไม่ถูกต้อง');
        if (new Set(sl.map(function (x) { return x.stockId; })).size !== sl.length || sl.some(function (x) { return !isInt(x.qty, 1, 9999); })) return err(400, 'VALIDATION');
        for (var si = 0; si < sl.length; si++) {
          var sx = stockBy(db, sl[si].stockId); if (!sx || !sx.active) return err(400, 'VALIDATION');
          var avl = Math.max(0, sx.onHand - reservedOf(db, sx.stockId)); if (sl[si].qty > avl) return err(409, 'STOCK_SHORT', { stockId: sx.stockId, available: avl });
        }
        if (!b.project || b.project.length > 120) return err(400, 'ต้องระบุ Project');
        if (!b.dueDate || b.dueDate < todayBkk()) return err(400, 'กำหนดคืนต้องไม่ก่อนวันนี้');
        // v0.10 §20: approver is not chosen; any loan.approve holder decides (a sent value is ignored)
        var bad = ids.filter(function (id) { var x = assetBy(db, id); return !x || x.status !== 'available'; });
        if (bad.length) return err(409, 'ASSET_UNAVAILABLE', { assetIds: bad });
        var d = todayBkk().replace(/-/g, ''); db.seq[d] = (db.seq[d] || 0) + 1;
        var l = { loanId: 'L-' + d + '-' + String(db.seq[d]).padStart(3, '0'), project: b.project, requester: u.username, approver: '',
          status: 'pending', purpose: b.purpose || '', requestedAt: now, dueDate: b.dueDate, approvedAt: '', approvedBy: '', rejectReason: '',
          checkedOutAt: '', checkedOutBy: '', returnedAt: '', updatedAt: now,
          items: ids.map(function (id) { return { assetId: id, itemStatus: 'requested', checkedOutAt: '', checkedOutBy: '', conditionOut: '', returnedAt: '', returnedBy: '', conditionIn: '', damaged: false, lost: false, note: '' }; }),
          stockLines: sl.map(function (x) { var sx = stockBy(db, x.stockId); return { stockId: sx.stockId, kind: sx.kind, unit: sx.unit, name: sx.name, qtyRequested: x.qty, qtyIssued: 0, qtyReturned: 0, qtyUsed: 0, qtyLost: 0, lineStatus: 'requested', updatedAt: now }; }) };
        db.loans.push(l); ids.forEach(function (id) { setAsset(db, id, 'reserved', l, u.username, 'loan_request', rid); });
        save(db); return { success: true, loan: loanOut(db, l) };
      }
      case 'loan_approve': case 'loan_reject': {
        if (b.action === 'loan_reject' && !String(b.reason || '').trim()) return err(400, 'ต้องระบุเหตุผล');
        if (!loan) return err(404, 'NOT_FOUND');
        if (!(u.role === 'admin' || P.loanApprove)) return err(403, 'NOT_APPROVER');
        if (loan.requester === u.username && u.role !== 'admin') return err(403, 'SELF_APPROVE');
        if (loan.status !== 'pending') return err(409, 'BAD_TRANSITION');
        if (b.action === 'loan_approve') { loan.status = 'approved'; loan.approvedAt = now; loan.approvedBy = u.username; ev(db, u.username, 'loan_approve', loan.loanId, '', 'pending', 'approved', '', rid); }
        else { loan.status = 'rejected'; loan.approvedAt = now; loan.approvedBy = u.username; loan.rejectReason = b.reason || ''; (loan.stockLines || []).forEach(function (x) { if (x.lineStatus === 'requested') x.lineStatus = 'cancelled'; }); loan.items.forEach(function (i) { i.itemStatus = 'cancelled'; setAsset(db, i.assetId, 'available', null, u.username, 'loan_reject', rid); }); }
        loan.updatedAt = now; save(db); return { success: true, loan: loanOut(db, loan) };
      }
      case 'loan_cancel': {
        if (!String(b.reason || '').trim()) return err(400, 'ต้องระบุเหตุผล');
        if (!loan) return err(404, 'NOT_FOUND');
        if (!(u.role === 'admin' || loan.requester === u.username)) return err(403, 'FORBIDDEN');
        if (['pending', 'approved'].indexOf(loan.status) < 0) return err(409, 'BAD_TRANSITION');
        loan.status = 'cancelled'; (loan.stockLines || []).forEach(function (x) { if (x.lineStatus === 'requested') x.lineStatus = 'cancelled'; }); loan.items.forEach(function (i) { i.itemStatus = 'cancelled'; setAsset(db, i.assetId, 'available', null, u.username, 'loan_cancel', rid); });
        loan.updatedAt = now; save(db); return { success: true, loan: loanOut(db, loan) };
      }
      case 'loan_checkout': {
        if (!loan) return err(404, 'NOT_FOUND'); if (!P.loanIssue) return err(403, 'FORBIDDEN');
        if (loan.status !== 'approved') return err(409, 'BAD_TRANSITION');
        // v0.13 §23.5: one checkout; validate every stock line before issuing anything
        var lines = loan.stockLines || [], issue = {}, pickU = {}, seenU = {};
        if (b.stockIssue !== undefined) {
          if (!Array.isArray(b.stockIssue) || b.stockIssue.length !== lines.length) return err(400, 'VALIDATION');
          for (var q1 = 0; q1 < b.stockIssue.length; q1++) { var e1 = b.stockIssue[q1]; var ln = lines.find(function (x) { return x.stockId === e1.stockId; });
            if (!ln || (e1.stockId in issue)) return err(400, 'VALIDATION');
            if (ln.kind === 'counted') {
              if ('qty' in e1 || !Array.isArray(e1.unitIds) || e1.unitIds.length > ln.qtyRequested) return err(400, 'VALIDATION');
              for (var q0 = 0; q0 < e1.unitIds.length; q0++) { var uid = e1.unitIds[q0], un = db.units.find(function (x) { return x.unitId === uid; });
                if (seenU[uid] || !un || un.stockId !== ln.stockId) return err(400, 'VALIDATION'); if (un.status !== 'available') return err(409, 'BAD_TRANSITION', { unitId: uid }); seenU[uid] = 1; }
              pickU[e1.stockId] = e1.unitIds; issue[e1.stockId] = e1.unitIds.length;
            } else { if ('unitIds' in e1 || !isInt(e1.qty, 0, ln.qtyRequested)) return err(400, 'VALIDATION'); issue[e1.stockId] = e1.qty; }
          }
        } else { if (lines.some(function (x) { return x.kind === 'counted'; })) return err(400, 'VALIDATION'); lines.forEach(function (x) { issue[x.stockId] = x.qtyRequested; }); }
        for (var q2 = 0; q2 < lines.length; q2++) { var sx2 = stockBy(db, lines[q2].stockId); if (issue[lines[q2].stockId] > sx2.onHand) return err(409, 'STOCK_SHORT', { stockId: sx2.stockId, onHand: sx2.onHand }); }
        loan.checkedOutAt = now; loan.checkedOutBy = u.username;
        loan.items.forEach(function (i) { i.itemStatus = 'checked_out'; i.checkedOutAt = now; i.checkedOutBy = u.username; i.conditionOut = b.conditionOut || ''; setAsset(db, i.assetId, 'checked_out', loan, u.username, 'loan_checkout', rid); });
        lines.forEach(function (x) {
          var q = issue[x.stockId], sx3 = stockBy(db, x.stockId); x.qtyIssued = q; x.updatedAt = now;
          if (q > 0) { sx3.onHand -= q; sx3.updatedAt = now; move(db, u.username, x.stockId, 'issue', -q, loan.loanId, ''); }
          if (x.kind === 'consumable') { x.qtyUsed = q; x.lineStatus = 'closed'; if (q > 0) outcome(db, u.username, loan.loanId, x.stockId, 0, q, 0, ''); }
          else {
            x.lineStatus = q > 0 ? 'issued' : 'closed'; x.qtyDamaged = 0;
            (pickU[x.stockId] || []).forEach(function (uid) { var un = db.units.find(function (y) { return y.unitId === uid; });
              un.status = 'out'; un.holder = loan.requester; un.loanId = loan.loanId; db.loanUnits.push({ loanId: loan.loanId, stockId: x.stockId, unitId: uid, issuedAt: now, outcome: 'out', outcomeAt: '' }); uev(db, u.username, un, 'available', 'out', loan.loanId, '', ''); });
          }
        });
        var open1 = loan.items.length > 0 || lines.some(function (x) { return x.lineStatus === 'issued'; });
        loan.status = open1 ? 'checked_out' : 'returned'; if (!open1) loan.returnedAt = now;
        loan.updatedAt = now; save(db); return { success: true, loan: loanOut(db, loan) };
      }
      case 'loan_return': {
        if (!loan) return err(404, 'NOT_FOUND'); if (!P.loanIssue) return err(403, 'FORBIDDEN');
        if (['checked_out', 'partially_returned'].indexOf(loan.status) < 0) return err(409, 'BAD_TRANSITION');
        var rs = b.items || [], sr = b.stockReturn || [];
        if (!rs.length && !sr.length) return err(400, 'เลือกอุปกรณ์ที่รับคืน');
        if (new Set(sr.map(function (x) { return x.stockId; })).size !== sr.length) return err(400, 'VALIDATION');
        for (var q3 = 0; q3 < sr.length; q3++) {
          var r3 = sr[q3], l3 = (loan.stockLines || []).find(function (x) { return x.stockId === r3.stockId; });
          if (!l3) return err(400, 'VALIDATION'); if (l3.kind !== 'counted') return err(400, 'WRONG_KIND');
          if (l3.lineStatus !== 'issued') return err(409, 'BAD_TRANSITION');
          // v0.14 §24.4: counted returns are per unit
          if ('returned' in r3 || 'used' in r3 || 'lost' in r3 || !Array.isArray(r3.units) || !r3.units.length) return err(400, 'VALIDATION');
          var su = {};
          for (var q4 = 0; q4 < r3.units.length; q4++) { var ru = r3.units[q4], lu = db.loanUnits.find(function (y) { return y.loanId === loan.loanId && y.unitId === ru.unitId; });
            if (su[ru.unitId] || ['returned', 'damaged', 'lost', 'used'].indexOf(ru.outcome) < 0) return err(400, 'VALIDATION');
            if (!lu || lu.outcome !== 'out' || lu.stockId !== r3.stockId) return err(400, 'VALIDATION'); su[ru.unitId] = 1; }
          if (r3.units.some(function (x) { return x.outcome !== 'returned'; }) && !String(r3.reason || '').trim()) return err(400, 'ต้องระบุเหตุผลเมื่อชำรุด/หาย/ใช้หมด');
        }
        if (rs.some(function (x) { return !String(x.conditionIn || '').trim(); })) return err(400, 'ต้องระบุสภาพตอนคืน');
        if (rs.some(function (x) { return x.damaged && x.lost; })) return err(400, 'เสียหายและสูญหายพร้อมกันไม่ได้');
        var allIds = []; rs.forEach(function (x) { allIds = allIds.concat(x.photoIds || []); });
        if (new Set(allIds).size !== allIds.length) return err(400, 'รูปซ้ำข้ามรายการ');
        for (var z = 0; z < rs.length; z++) { var rz = photoSet(rs[z].photoIds, 'return', 1, 3, null); if (rz) return err(400, rz === 'PHOTO_COUNT' ? 'ทุกชิ้นต้องมีรูป 1–3 รูป' : 'PHOTO_INVALID'); }
        for (var k = 0; k < rs.length; k++) {
          var it = loan.items.find(function (i) { return i.assetId === rs[k].assetId; });
          if (!it || it.itemStatus !== 'checked_out') return err(409, 'BAD_TRANSITION', { assetIds: [rs[k].assetId] });
        }
        sr.forEach(function (x) {
          var l4 = loan.stockLines.find(function (y) { return y.stockId === x.stockId; }), sx4 = stockBy(db, x.stockId), cnt = { returned: 0, damaged: 0, lost: 0, used: 0 };
          var TO = { returned: 'available', damaged: 'inspection', lost: 'lost', used: 'retired' };
          x.units.forEach(function (ru) {
            var lu = db.loanUnits.find(function (y) { return y.loanId === loan.loanId && y.unitId === ru.unitId; }), un = db.units.find(function (y) { return y.unitId === ru.unitId; });
            lu.outcome = ru.outcome; lu.outcomeAt = now; un.status = TO[ru.outcome]; un.holder = ''; un.loanId = ''; cnt[ru.outcome]++;
            uev(db, u.username, un, 'out', un.status, loan.loanId, ru.outcome === 'returned' ? '' : x.reason, ru.note || '');
          });
          l4.qtyReturned += cnt.returned + cnt.damaged; l4.qtyDamaged = (l4.qtyDamaged || 0) + cnt.damaged; l4.qtyUsed += cnt.used; l4.qtyLost += cnt.lost; l4.updatedAt = now; if (!outstanding(l4)) l4.lineStatus = 'closed';
          if (cnt.returned) { sx4.onHand += cnt.returned; sx4.updatedAt = now; move(db, u.username, x.stockId, 'return', cnt.returned, loan.loanId, ''); }
          outcome(db, u.username, loan.loanId, x.stockId, cnt.returned + cnt.damaged, cnt.used, cnt.lost, x.reason || ''); db.stockOutcomes[db.stockOutcomes.length - 1].damaged = cnt.damaged;
        });
        rs.forEach(function (x) {
          var it = loan.items.find(function (i) { return i.assetId === x.assetId; });
          it.itemStatus = x.lost ? 'lost' : 'returned'; it.returnedAt = now; it.returnedBy = u.username;
          it.conditionIn = x.conditionIn || ''; it.damaged = !!x.damaged; it.lost = !!x.lost; it.note = x.note || '';
          setAsset(db, x.assetId, x.lost ? 'lost' : x.damaged ? 'inspection' : 'available', null, u.username, 'loan_return', rid);
          attach(x.photoIds, 'return', x.assetId, loan.loanId);
        });
        // v0.13 §23.6: closes only when every asset is terminal and every counted line has nothing outstanding
        var open = loan.items.some(function (i) { return i.itemStatus === 'checked_out'; }) || (loan.stockLines || []).some(function (x) { return x.lineStatus === 'issued'; });
        var some = loan.items.some(function (i) { return i.itemStatus === 'returned' || i.itemStatus === 'lost'; }) || (loan.stockLines || []).some(function (x) { return x.kind === 'counted' && x.qtyReturned + x.qtyUsed + x.qtyLost > 0; });
        loan.status = !open ? 'returned' : some ? 'partially_returned' : 'checked_out'; if (!open) loan.returnedAt = now;
        loan.updatedAt = now; save(db); return { success: true, loan: loanOut(db, loan) };
      }
      case 'stock_create': {
        if (!P.assetManage) return err(403, 'FORBIDDEN');
        if (!db.categories.some(function (x) { return x.code === b.category && x.active; })) return err(400, 'หมวดนี้ปิดใช้หรือไม่มีอยู่');
        if (DIVS.indexOf(b.division) < 0 || ['consumable', 'counted'].indexOf(b.kind) < 0 || 'sku' in b || !String(b.name || '').trim() || !String(b.unit || '').trim() || String(b.unit).length > 12) return err(400, 'VALIDATION');
        if (!isInt(b.initialQty, 0, 1e6) || !isInt(b.minLevel, 0, 1e6)) return err(400, 'VALIDATION');
        if (b.kind === 'counted' && b.initialQty > 200) return err(409, 'CAPACITY');
        var nS = db.stock.reduce(function (m, x) { var k = x.stockId.split('-S'); return k[0] === b.category ? Math.max(m, +k[1] || 0) : m; }, 0) + 1;
        if (nS > 9999) return err(409, 'CAPACITY');
        var ns = { stockId: b.category + '-S' + String(nS).padStart(4, '0'), sku: nextSku(db, b.category), name: b.name.trim(), category: b.category, division: b.division, kind: b.kind, unit: b.unit.trim(), onHand: b.initialQty, minLevel: b.minLevel, location: b.location || '', notes: b.notes || '', active: true, createdAt: now, updatedAt: now };
        db.stock.push(ns); if (b.initialQty > 0) move(db, u.username, ns.stockId, 'create', b.initialQty, '', '');
        if (ns.kind === 'counted') addUnits(db, u.username, ns, b.initialQty);
        ev(db, u.username, 'stock_create', '', '', '', '', ns.stockId, rid); save(db); return { success: true, stock: stockOut(db, ns) };
      }
      case 'stock_update': {
        if (!P.assetManage) return err(403, 'FORBIDDEN');
        if ('unit' in b || 'onHand' in b || 'category' in b || 'sku' in b || 'kind' in b) return err(400, 'VALIDATION');
        var su = stockBy(db, b.stockId); if (!su) return err(404, 'NOT_FOUND');
        if (b.division !== undefined && DIVS.indexOf(b.division) < 0) return err(400, 'VALIDATION');
        if (b.kind !== undefined && ['consumable', 'counted'].indexOf(b.kind) < 0) return err(400, 'VALIDATION');
        if (b.minLevel !== undefined && !isInt(b.minLevel, 0, 1e6)) return err(400, 'VALIDATION');
        ['name', 'sku', 'minLevel', 'location', 'notes', 'division', 'kind', 'active'].forEach(function (k) { if (b[k] !== undefined) su[k] = b[k]; });
        su.updatedAt = now; save(db); return { success: true, stock: stockOut(db, su) };
      }
      case 'stock_receive': case 'stock_adjust': {
        if (!P.assetManage) return err(403, 'FORBIDDEN');
        var sr2 = stockBy(db, b.stockId); if (!sr2) return err(404, 'NOT_FOUND');
        var warn = null;
        if (b.action === 'stock_receive') {
          if (!isInt(b.qty, 1, 1e6) || sr2.onHand + b.qty > 1e6) return err(400, 'VALIDATION');
          if (sr2.kind === 'counted' && (b.qty > 200 || unitsOf(db, sr2.stockId).length + b.qty > 9999)) return err(409, 'CAPACITY');
          sr2.onHand += b.qty; move(db, u.username, sr2.stockId, 'receive', b.qty, '', b.note || '');
          if (sr2.kind === 'counted') addUnits(db, u.username, sr2, b.qty);
        } else {
          if (sr2.kind === 'counted') return err(400, 'WRONG_KIND');
          if (!isInt(b.countedQty, 0, 1e6) || !String(b.reason || '').trim()) return err(400, 'VALIDATION');
          var dlt = b.countedQty - sr2.onHand; if (!dlt) return err(400, 'NO_CHANGE');
          sr2.onHand = b.countedQty; move(db, u.username, sr2.stockId, 'adjust', dlt, '', b.reason);
          var o2 = stockOut(db, sr2); if (o2.available < 0) warn = { warning: 'RESERVED_EXCEEDS', deficit: o2.deficit };
        }
        sr2.updatedAt = now; save(db); return Object.assign({ success: true, stock: stockOut(db, sr2) }, warn || {});
      }
      case 'stock_unit_update': {
        if (!P.assetManage) return err(403, 'FORBIDDEN');
        var uu = db.units.find(function (x) { return x.unitId === b.unitId; }); if (!uu) return err(404, 'NOT_FOUND');
        if (['available', 'inspection', 'lost', 'retired'].indexOf(b.status) < 0 || !String(b.reason || '').trim()) return err(400, 'VALIDATION');
        if (uu.status === b.status) return err(400, 'NO_CHANGE');
        if (uu.status === 'out' || uu.status === 'lost' || uu.status === 'retired') return err(409, 'BAD_TRANSITION');
        var sxu = stockBy(db, uu.stockId), from = uu.status;
        if (from === 'available') { sxu.onHand -= 1; move(db, u.username, sxu.stockId, 'adjust', -1, '', b.reason); }
        if (b.status === 'available') { sxu.onHand += 1; move(db, u.username, sxu.stockId, 'adjust', 1, '', b.reason); }
        uu.status = b.status; uev(db, u.username, uu, from, b.status, '', b.reason, b.note || ''); save(db);
        return { success: true, unit: unitOut(db, uu), stock: stockOut(db, sxu) };
      }
      case 'stock_return_leftover': {
        if (!P.loanIssue) return err(403, 'FORBIDDEN');
        if (!loan) return err(404, 'NOT_FOUND');
        var l5 = (loan.stockLines || []).find(function (x) { return x.stockId === b.stockId; }); if (!l5) return err(400, 'VALIDATION');
        if (l5.kind !== 'consumable') return err(400, 'WRONG_KIND');
        if (!(l5.qtyIssued > 0) || l5.lineStatus !== 'closed') return err(409, 'BAD_TRANSITION');
        if (!(Date.now() < Date.parse(loan.checkedOutAt) + LEFTOVER_MS)) return err(409, 'LEFTOVER_EXPIRED');
        if (!isInt(b.qty, 1, l5.qtyUsed)) return err(400, 'VALIDATION');
        l5.qtyUsed -= b.qty; l5.qtyReturned += b.qty; l5.updatedAt = now;
        var sx5 = stockBy(db, b.stockId); sx5.onHand += b.qty; sx5.updatedAt = now; move(db, u.username, b.stockId, 'return', b.qty, loan.loanId, b.note || '');
        outcome(db, u.username, loan.loanId, b.stockId, b.qty, -b.qty, 0, ''); save(db); return { success: true, loan: loanOut(db, loan), stock: stockOut(db, sx5) };
      }
      case 'user_delete': {
        // v0.11 §21: permanent delete, name kept for history, username never reused
        if (!P.userManage) return err(403, 'FORBIDDEN');
        var du = db.users.find(function (x) { return x.username === b.username; });
        if (!du) return err(404, 'NOT_FOUND');
        if (String(b.confirm || '').trim().toLowerCase() !== du.username) return err(400, 'CONFIRM_MISMATCH');
        if (du.username === u.username) return err(403, 'SELF_DELETE');
        if (!P.isAdmin && du.role === 'admin') return err(403, 'FORBIDDEN');
        if (du.role === 'admin' && du.active && db.users.filter(function (x) { return x.active && x.role === 'admin'; }).length === 1) return err(409, 'LAST_ADMIN');
        var openL = db.loans.filter(function (l) { return l.requester === du.username && ['pending', 'approved', 'checked_out', 'partially_returned'].indexOf(l.status) >= 0; }).map(function (l) { return l.loanId; });
        var held = db.assets.filter(function (a) { return a.holder === du.username; }).map(function (a) { return a.assetId; });
        if (openL.length || held.length) return err(409, 'USER_IN_USE', { loanIds: openL, assetIds: held });
        db.deletedUsers = db.deletedUsers || [];
        db.deletedUsers.push({ username: du.username, name: du.name, role: du.role, phone: du.phone || '', department: du.department || '', deletedAt: now, deletedBy: u.username });
        db.photos.forEach(function (x) { if (x.kind === 'avatar' && x.photoId === du.avatarPhotoId && x.status === 'attached') x.status = 'detached'; });
        db.users = db.users.filter(function (x) { return x !== du; });
        ev(db, u.username, 'user_delete', '', '', '', '', du.username, rid); save(db); return { success: true };
      }
      case 'user_create': case 'user_update': {
        if (!P.userManage) return err(403, 'FORBIDDEN');
        if (b.pin !== undefined && !/^\d{4}$/.test(b.pin)) return err(400, 'PIN ต้องเป็นตัวเลข 4 หลัก');
        if (b.role !== undefined && !db.roles.some(function (r) { return r.roleId === b.role; })) return err(400, 'Role ไม่ถูกต้อง');
        var ex = db.users.find(function (x) { return x.username === b.username; });
        if (!P.isAdmin && (b.role === 'admin' || (ex && ex.role === 'admin'))) return err(403, 'FORBIDDEN');
        if (!P.isAdmin && b.username === u.username && (b.role !== undefined || b.active !== undefined)) return err(403, 'FORBIDDEN');
        if (b.action === 'user_create') { if (ex || takenName(db, b.username)) return err(409, 'USER_EXISTS'); db.users.push({ username: b.username, name: b.name, role: b.role, active: true, pin: b.pin }); }
        else {
          if (!ex) return err(404, 'NOT_FOUND');
          var admins = db.users.filter(function (x) { return x.active && x.role === 'admin'; });
          if (ex.role === 'admin' && admins.length === 1 && (b.active === false || (b.role && b.role !== 'admin'))) return err(409, 'LAST_ADMIN');
          ['name', 'role', 'active', 'pin'].forEach(function (k) { if (b[k] !== undefined) ex[k] = b[k]; }); }
        ev(db, u.username, b.action, '', '', '', '', b.username, rid); save(db); return { success: true };
      }
      case 'invite_create': {
        if (!P.userManage) return err(403, 'FORBIDDEN');
        if (!db.roles.some(function (r) { return r.roleId === b.role; })) return err(400, 'Role ไม่ถูกต้อง');
        if (b.role === 'admin' && !P.isAdmin) return err(403, 'FORBIDDEN');
        var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', c = ''; var rnd = crypto.getRandomValues(new Uint8Array(8)); for (var q = 0; q < 8; q++) c += A[rnd[q] % A.length];
        var mx = Math.max(1, Math.min(50, b.maxUses || 1)), days = Math.max(1, Math.min(30, b.expiresDays || 7));
        var invn = { inviteId: 'I' + (db.invites.length + 1), code: c, codeHint: c.slice(-2), role: b.role, maxUses: mx, uses: 0,
          expiresAt: new Date(Date.now() + days * 864e5).toISOString(), revoked: false, note: b.note || '', createdBy: u.username, createdAt: now, lastUsedAt: '' };
        db.invites.push(invn); ev(db, u.username, 'invite_create', '', '', '', b.role, invn.inviteId, rid); save(db);
        var pub = Object.assign({}, invn); delete pub.code; return { success: true, invite: pub, code: c };
      }
      case 'invite_revoke': {
        if (!P.userManage) return err(403, 'FORBIDDEN');
        var iv = db.invites.find(function (i) { return i.inviteId === b.inviteId; }); if (!iv) return err(404, 'NOT_FOUND');
        if (iv.role === 'admin' && !P.isAdmin) return err(403, 'FORBIDDEN');
        iv.revoked = true; ev(db, u.username, 'invite_revoke', '', '', '', '', iv.inviteId, rid); save(db); return { success: true };
      }
      case 'role_upsert': {
        if (!P.isAdmin) return err(403, 'FORBIDDEN');
        if (!/^[a-z][a-z0-9_]{1,23}$/.test(b.roleId || '') || !String(b.name || '').trim()) return err(400, 'ข้อมูล role ไม่ถูกต้อง');
        if (!Array.isArray(b.perms) || b.perms.some(function (k) { return ALL_PERMS.indexOf(k) < 0; })) return err(400, 'สิทธิ์ไม่ถูกต้อง');
        b.perms = b.perms.filter(function (k, i, a) { return a.indexOf(k) === i; });
        var ro = db.roles.find(function (r) { return r.roleId === b.roleId; });
        if (ro && ro.system) return err(403, 'FORBIDDEN');
        if (ro) { ro.name = b.name.trim(); ro.perms = b.perms.slice(); } else db.roles.push({ roleId: b.roleId, name: b.name.trim(), perms: b.perms.slice(), system: false });
        ev(db, u.username, 'role_upsert', '', '', '', '', b.roleId, rid); save(db); return { success: true };
      }
      case 'role_delete': {
        if (!P.isAdmin) return err(403, 'FORBIDDEN');
        var rd = db.roles.find(function (r) { return r.roleId === b.roleId; }); if (!rd) return err(404, 'NOT_FOUND'); if (rd.system) return err(403, 'FORBIDDEN');
        var t1 = Date.now();
        if (db.users.some(function (x) { return x.role === rd.roleId; }) || db.invites.some(function (i) { return i.role === rd.roleId && !i.revoked && i.uses < i.maxUses && Date.parse(i.expiresAt) > t1; })) return err(409, 'ROLE_IN_USE');
        db.roles = db.roles.filter(function (r) { return r !== rd; }); ev(db, u.username, 'role_delete', '', '', '', '', b.roleId, rid); save(db); return { success: true };
      }
    }
    return err(400, 'Unknown action');
  }

  var READS = ['me', 'bundle', 'getAsset', 'getStock', 'listStockUnits', 'getUnit', 'listLoans', 'listUsers', 'listInvites', 'listRoles', 'getPhoto', 'assetCovers'];
  window.CPI_MOCK = {
    post: function (b) { return new Promise(function (res) { setTimeout(function () { res(READS.indexOf(b.action) >= 0 ? get(b.action, b) : post(b)); }, 180); }); },
    reset: function () { localStorage.removeItem(KEY); }
  };
})();
