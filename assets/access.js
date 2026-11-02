/*
 * Shared access gate for the Sequence Stratigraphy platform.
 * Loaded by EVERY page (index, modules, Wheeler tools), so direct links no longer skip the login.
 *
 * LIMITATION (read before relying on this): the check runs in the browser. Anyone who reads the
 * page source or edits localStorage can get past it. Real protection needs hosting behind FAU
 * login (IdM/SSO); GitHub Pages cannot provide that. Decided Oct/Nov 2026: move to FAU hosting.
 *
 * Roster: SHA-256 hex digests of lower-cased, trimmed FAU IdM e-mails (e.g. ab12cdef@fauad.fau.de).
 * Never put plain-text student addresses here. Generate a digest with:
 *   printf '%s' 'ab12cdef@fauad.fau.de' | shasum -a 256
 */
(function () {
  'use strict';

  var STUDENT_EMAIL_HASHES = [
    // WS 2026/27 cohort: TO BE FILLED (roster not yet provided)
  ];

  var INSTRUCTOR_EMAIL_HASHES = [
    '7c5869c7cbc45b3a1233686ab5e2c67f758677f116bb38fd80e364205d06fdfb' // L. Caracciolo
  ];

  var EXPIRATION_DATE = new Date('2027-03-31T23:59:59'); // end of WS 2026/27
  var KEY = 'seqstrat_session';

  function sha256Hex(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function rootPath() {
    // assets/access.js is always one level below the site root
    var s = document.currentScript || document.querySelector('script[src$="assets/access.js"]');
    return s ? s.src.replace(/assets\/access\.js.*$/, '') : '/';
  }
  var ROOT = rootPath();

  function role(hash) {
    if (INSTRUCTOR_EMAIL_HASHES.indexOf(hash) !== -1) return 'Instructor';
    if (STUDENT_EMAIL_HASHES.indexOf(hash) !== -1) return new Date() > EXPIRATION_DATE ? 'Expired' : 'Student';
    return null;
  }

  function readSession() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }

  // Re-validate the saved session against the CURRENT lists on every visit,
  // so that users removed from the roster lose access.
  function validate() {
    var s = readSession();
    if (!s || !s.email) return Promise.resolve(null);
    return sha256Hex(String(s.email).toLowerCase().trim()).then(function (h) {
      var r = role(h);
      if (!r || r === 'Expired') { localStorage.removeItem(KEY); return r === 'Expired' ? { expired: true } : null; }
      return { name: s.name || '', role: r };
    });
  }

  function login(email, name) {
    email = String(email).toLowerCase().trim();
    return sha256Hex(email).then(function (h) {
      var r = role(h);
      if (r === 'Student' || r === 'Instructor') {
        localStorage.setItem(KEY, JSON.stringify({ email: email, name: String(name || '').trim(), t: new Date().toISOString() }));
      }
      return r;
    });
  }

  function logout() {
    localStorage.removeItem(KEY);
    window.location.href = ROOT + 'index.html';
  }

  var isLoginPage = document.documentElement.hasAttribute('data-login-page');

  // Hide protected pages until the session is validated (avoids a flash of content).
  if (!isLoginPage) {
    var st = document.createElement('style');
    st.id = 'gate-hide';
    st.textContent = 'body{visibility:hidden!important}';
    document.head.appendChild(st);
    validate().then(function (u) {
      if (!u || u.expired) {
        var back = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
        window.location.replace(ROOT + 'index.html?next=' + back + (u && u.expired ? '&expired=1' : ''));
        return;
      }
      window.SEQ_USER = u;
      var g = document.getElementById('gate-hide'); if (g) g.remove();
      document.dispatchEvent(new CustomEvent('seq-auth', { detail: u }));
    });
  }

  window.SeqAccess = { validate: validate, login: login, logout: logout, root: ROOT };
})();
