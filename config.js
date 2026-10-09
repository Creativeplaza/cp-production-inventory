/* Creative Plaza — Production Inventory: the single place for frontend deployment values.
   Ownership transfer: frontend side = change API_URL here. Backend side must also move the DB Sheet,
   Script Properties (DB_SHEET_ID, REQ_HMAC_KEY, INVITE_HMAC_KEY — never regenerate), users and the
   approved web-app deployment (see contract §1, §13.7). */
window.CPI_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyydgzaxlZehBnpbrbku0a9A0Be_lJr0jsFT9yLjPP7C6ronWG1rzHi8NuSbM89_xhY/exec', // Apps Script /exec (designer.creativeplaza@gmail.com, v0.5.2 deploy 1); empty = local mock
  APP_URL: location.origin + location.pathname.replace(/[^/]*$/, ''), // base used inside QR codes
  COMPANY: 'Creative Plaza',
  TZ: 'Asia/Bangkok'
};
