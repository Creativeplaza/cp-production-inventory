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
      categories: [{ code: 'MEA', name: 'อุปกรณ์วัด', active: true }, { code: 'CAM', name: 'กล้อง / สแกน 3D', active: true }, { code: 'TOL', name: 'เครื่องมือ', active: true }, { code: 'OTH', name: 'อื่นๆ', active: true }],
      photos: [],
      invites: [], badInvite: [],
      loans: [], events: [], seq: {}
    };
  }
  function load() { var d; try { d = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch (e) { d = seed(); } mockDb = d; return d; }
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
  function nameOf(db, un) { var u = db.users.find(function (x) { return x.username === un; }); return u ? u.name : un; }
  function assetBy(db, id) { return db.assets.find(function (x) { return x.assetId === id; }); }
  function loanOut(db, l) {
    var o = JSON.parse(JSON.stringify(l));
    o.requesterName = nameOf(db, l.requester); o.approverName = nameOf(db, l.approver);
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
    if (api === 'bundle') return { success: true, assets: db.assets.map(function (a) { var ph = db.photos.filter(function (x) { return x.status === 'attached' && x.kind === 'asset' && x.assetId === a.assetId; }).sort(function (x, y) { return x.position - y.position; }); return Object.assign({}, a, { photoCount: ph.length, coverPhotoId: ph.length ? ph[0].photoId : '' }); }), loans: db.loans.slice().reverse().map(function (l) { return loanOut(db, l); }), loansTruncated: false,
      approvers: approvers(db), categories: db.categories, roles: db.roles.map(function (r) { return { roleId: r.roleId, name: r.name }; }), me: { username: u.username, name: u.name, role: u.role, perms: perms(u) }, serverTime: Date.now() };
    if (api === 'getAsset') {
      var a = assetBy(db, p.id); if (!a) return err(404, 'NOT_FOUND');
      var ph = db.photos.filter(function (x) { return x.status === 'attached' && x.kind === 'asset' && x.assetId === a.assetId; }).sort(function (x, y) { return x.position - y.position; })
        .map(function (x) { return { photoId: x.photoId, thumb: x.thumb, width: x.width, height: x.height, uploadedAt: x.uploadedAt }; });
      return { success: true, item: a, photos: ph,
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
      if (db.users.some(function (x) { return x.username === un; })) return err(409, 'USER_EXISTS');
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
        if (b.kind === 'asset' ? !P.assetManage : b.kind === 'return' ? !P.loanIssue : true) return err(403, 'FORBIDDEN');
        if (!/^data:image\/jpeg;base64,/.test(b.thumb || '') || !b.data) return err(400, 'PHOTO_INVALID');
        if (db.photos.filter(function (x) { return x.status === 'pending' && x.uploadedBy === u.username; }).length >= 30) return err(429, 'PHOTO_QUOTA');
        var pid = 'P' + (db.photos.length + 1) + '-' + Math.random().toString(36).slice(2, 7);
        db.photos.push({ photoId: pid, kind: b.kind, thumb: b.thumb, width: b.width, height: b.height, status: 'pending', uploadedBy: u.username, uploadedAt: now, assetId: '', loanId: '', position: 0 });
        ev(db, u.username, 'photo_upload', '', '', '', '', pid, rid); save(db);
        return { success: true, photo: { photoId: pid, kind: b.kind, thumb: b.thumb, width: b.width, height: b.height } };
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
        var used = db.assets.filter(function (x) { return x.category === b.code; }).length;
        if (used) return err(409, 'CATEGORY_IN_USE', { count: used });
        db.categories = db.categories.filter(function (x) { return x.code !== b.code; });
        ev(db, u.username, 'category_delete', '', '', '', '', b.code, rid); save(db); return { success: true };
      }
      case 'asset_create': {
        if (!P.assetManage) return err(403, 'FORBIDDEN');
        if (!db.categories.some(function (x) { return x.code === b.category && x.active; })) return err(400, 'หมวดนี้ปิดใช้หรือไม่มีอยู่');
        var pe = photoSet(b.photoIds, 'asset', 1, 5, null); if (pe) return err(400, pe === 'PHOTO_COUNT' ? 'ต้องมีรูป 1–5 รูป' : 'PHOTO_INVALID');
        if (!/^[A-Z]{2,4}$/.test(b.category || '')) return err(400, 'หมวดไม่ถูกต้อง');
        if (!/^[A-Z0-9-]{2,24}$/.test(b.sku || '')) return err(400, 'SKU ไม่ถูกต้อง');
        if (!b.name) return err(400, 'ต้องระบุชื่อ');
        // §17.2: next number = max over live + deleted assets of this prefix (never reuse an AssetID)
        var n = db.assets.concat(db.deletedAssets || []).reduce(function (m, x) { var k = x.assetId.split('-'); return k[0] === b.category ? Math.max(m, +k[1] || 0) : m; }, 0) + 1;
        var id = b.category + '-' + String(n).padStart(4, '0');
        var na = { assetId: id, sku: b.sku, name: b.name, category: b.category, model: b.model || '', serial: b.serial || '', location: b.location || '',
          status: 'available', currentLoanId: '', holder: '', project: '', dueDate: '', notes: b.notes || '', createdAt: now, updatedAt: now };
        db.assets.push(na); attach(b.photoIds, 'asset', id); ev(db, u.username, 'asset_create', '', id, '', 'available', '', rid); save(db); return { success: true, asset: na };
      }
      case 'asset_update': {
        if (!P.assetManage) return err(403, 'FORBIDDEN');
        var ua = assetBy(db, b.assetId); if (!ua) return err(404, 'NOT_FOUND');
        if (b.photoIds !== undefined) { var pu = photoSet(b.photoIds, 'asset', 1, 5, ua.assetId); if (pu) return err(400, pu === 'PHOTO_COUNT' ? 'ต้องมีรูป 1–5 รูป' : 'PHOTO_INVALID'); attach(b.photoIds, 'asset', ua.assetId); }
        ['sku', 'name', 'model', 'serial', 'location', 'notes'].forEach(function (k) { if (b[k] !== undefined) ua[k] = b[k]; });
        if (b.status && b.status !== ua.status) {
          if (ua.currentLoanId) return err(409, 'BAD_TRANSITION');
          if (['available', 'inspection', 'maintenance', 'lost', 'retired'].indexOf(b.status) < 0) return err(409, 'BAD_TRANSITION');
          setAsset(db, ua.assetId, b.status, null, u.username, 'asset_update', rid);
        } else ev(db, u.username, 'asset_update', '', ua.assetId, ua.status, ua.status, '', rid);
        ua.updatedAt = now; save(db); return { success: true, asset: ua };
      }
      case 'loan_request': {
        if (!P.loanRequest) return err(403, 'FORBIDDEN');
        var ids = b.assetIds || [];
        if (!ids.length || ids.length > 20 || new Set(ids).size !== ids.length) return err(400, 'รายการอุปกรณ์ไม่ถูกต้อง');
        if (!b.project || b.project.length > 120) return err(400, 'ต้องระบุ Project');
        if (!b.dueDate || b.dueDate < todayBkk()) return err(400, 'กำหนดคืนต้องไม่ก่อนวันนี้');
        if (!approvers(db).some(function (x) { return x.username === b.approver; })) return err(400, 'ผู้อนุมัติไม่ถูกต้อง');
        if (b.approver === u.username && u.role !== 'admin') return err(403, 'SELF_APPROVE');
        var bad = ids.filter(function (id) { var x = assetBy(db, id); return !x || x.status !== 'available'; });
        if (bad.length) return err(409, 'ASSET_UNAVAILABLE', { assetIds: bad });
        var d = todayBkk().replace(/-/g, ''); db.seq[d] = (db.seq[d] || 0) + 1;
        var l = { loanId: 'L-' + d + '-' + String(db.seq[d]).padStart(3, '0'), project: b.project, requester: u.username, approver: b.approver,
          status: 'pending', purpose: b.purpose || '', requestedAt: now, dueDate: b.dueDate, approvedAt: '', approvedBy: '', rejectReason: '',
          checkedOutAt: '', checkedOutBy: '', returnedAt: '', updatedAt: now,
          items: ids.map(function (id) { return { assetId: id, itemStatus: 'requested', checkedOutAt: '', checkedOutBy: '', conditionOut: '', returnedAt: '', returnedBy: '', conditionIn: '', damaged: false, lost: false, note: '' }; }) };
        db.loans.push(l); ids.forEach(function (id) { setAsset(db, id, 'reserved', l, u.username, 'loan_request', rid); });
        save(db); return { success: true, loan: loanOut(db, l) };
      }
      case 'loan_approve': case 'loan_reject': {
        if (b.action === 'loan_reject' && !String(b.reason || '').trim()) return err(400, 'ต้องระบุเหตุผล');
        if (!loan) return err(404, 'NOT_FOUND');
        if (!(u.role === 'admin' || (P.loanApprove && loan.approver === u.username))) return err(403, 'NOT_APPROVER');
        if (loan.requester === u.username && u.role !== 'admin') return err(403, 'SELF_APPROVE');
        if (loan.status !== 'pending') return err(409, 'BAD_TRANSITION');
        if (b.action === 'loan_approve') { loan.status = 'approved'; loan.approvedAt = now; loan.approvedBy = u.username; ev(db, u.username, 'loan_approve', loan.loanId, '', 'pending', 'approved', '', rid); }
        else { loan.status = 'rejected'; loan.rejectReason = b.reason || ''; loan.items.forEach(function (i) { i.itemStatus = 'cancelled'; setAsset(db, i.assetId, 'available', null, u.username, 'loan_reject', rid); }); }
        loan.updatedAt = now; save(db); return { success: true, loan: loanOut(db, loan) };
      }
      case 'loan_cancel': {
        if (!String(b.reason || '').trim()) return err(400, 'ต้องระบุเหตุผล');
        if (!loan) return err(404, 'NOT_FOUND');
        if (!(u.role === 'admin' || loan.requester === u.username)) return err(403, 'FORBIDDEN');
        if (['pending', 'approved'].indexOf(loan.status) < 0) return err(409, 'BAD_TRANSITION');
        loan.status = 'cancelled'; loan.items.forEach(function (i) { i.itemStatus = 'cancelled'; setAsset(db, i.assetId, 'available', null, u.username, 'loan_cancel', rid); });
        loan.updatedAt = now; save(db); return { success: true, loan: loanOut(db, loan) };
      }
      case 'loan_checkout': {
        if (!loan) return err(404, 'NOT_FOUND'); if (!P.loanIssue) return err(403, 'FORBIDDEN');
        if (loan.status !== 'approved') return err(409, 'BAD_TRANSITION');
        loan.status = 'checked_out'; loan.checkedOutAt = now; loan.checkedOutBy = u.username;
        loan.items.forEach(function (i) { i.itemStatus = 'checked_out'; i.checkedOutAt = now; i.checkedOutBy = u.username; i.conditionOut = b.conditionOut || ''; setAsset(db, i.assetId, 'checked_out', loan, u.username, 'loan_checkout', rid); });
        loan.updatedAt = now; save(db); return { success: true, loan: loanOut(db, loan) };
      }
      case 'loan_return': {
        if (!loan) return err(404, 'NOT_FOUND'); if (!P.loanIssue) return err(403, 'FORBIDDEN');
        if (['checked_out', 'partially_returned'].indexOf(loan.status) < 0) return err(409, 'BAD_TRANSITION');
        var rs = b.items || []; if (!rs.length) return err(400, 'เลือกอุปกรณ์ที่รับคืน');
        if (rs.some(function (x) { return !String(x.conditionIn || '').trim(); })) return err(400, 'ต้องระบุสภาพตอนคืน');
        if (rs.some(function (x) { return x.damaged && x.lost; })) return err(400, 'เสียหายและสูญหายพร้อมกันไม่ได้');
        var allIds = []; rs.forEach(function (x) { allIds = allIds.concat(x.photoIds || []); });
        if (new Set(allIds).size !== allIds.length) return err(400, 'รูปซ้ำข้ามรายการ');
        for (var z = 0; z < rs.length; z++) { var rz = photoSet(rs[z].photoIds, 'return', 1, 3, null); if (rz) return err(400, rz === 'PHOTO_COUNT' ? 'ทุกชิ้นต้องมีรูป 1–3 รูป' : 'PHOTO_INVALID'); }
        for (var k = 0; k < rs.length; k++) {
          var it = loan.items.find(function (i) { return i.assetId === rs[k].assetId; });
          if (!it || it.itemStatus !== 'checked_out') return err(409, 'BAD_TRANSITION', { assetIds: [rs[k].assetId] });
        }
        rs.forEach(function (x) {
          var it = loan.items.find(function (i) { return i.assetId === x.assetId; });
          it.itemStatus = x.lost ? 'lost' : 'returned'; it.returnedAt = now; it.returnedBy = u.username;
          it.conditionIn = x.conditionIn || ''; it.damaged = !!x.damaged; it.lost = !!x.lost; it.note = x.note || '';
          setAsset(db, x.assetId, x.lost ? 'lost' : x.damaged ? 'inspection' : 'available', null, u.username, 'loan_return', rid);
          attach(x.photoIds, 'return', x.assetId, loan.loanId);
        });
        var open = loan.items.some(function (i) { return i.itemStatus === 'checked_out'; });
        loan.status = open ? 'partially_returned' : 'returned'; if (!open) loan.returnedAt = now;
        loan.updatedAt = now; save(db); return { success: true, loan: loanOut(db, loan) };
      }
      case 'user_create': case 'user_update': {
        if (!P.userManage) return err(403, 'FORBIDDEN');
        if (b.pin !== undefined && !/^\d{4}$/.test(b.pin)) return err(400, 'PIN ต้องเป็นตัวเลข 4 หลัก');
        if (b.role !== undefined && !db.roles.some(function (r) { return r.roleId === b.role; })) return err(400, 'Role ไม่ถูกต้อง');
        var ex = db.users.find(function (x) { return x.username === b.username; });
        if (!P.isAdmin && (b.role === 'admin' || (ex && ex.role === 'admin'))) return err(403, 'FORBIDDEN');
        if (!P.isAdmin && b.username === u.username && (b.role !== undefined || b.active !== undefined)) return err(403, 'FORBIDDEN');
        if (b.action === 'user_create') { if (ex) return err(409, 'USER_EXISTS'); db.users.push({ username: b.username, name: b.name, role: b.role, active: true, pin: b.pin }); }
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

  var READS = ['me', 'bundle', 'getAsset', 'listLoans', 'listUsers', 'listInvites', 'listRoles', 'getPhoto', 'assetCovers'];
  window.CPI_MOCK = {
    post: function (b) { return new Promise(function (res) { setTimeout(function () { res(READS.indexOf(b.action) >= 0 ? get(b.action, b) : post(b)); }, 180); }); },
    reset: function () { localStorage.removeItem(KEY); }
  };
})();
