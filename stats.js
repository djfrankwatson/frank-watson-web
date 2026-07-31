/* ------------------------------------------------------------------
   Frank Watson - lightweight, cookieless visitor statistics
   ------------------------------------------------------------------
   - Stores everything in the visitor's own browser (localStorage).
   - No cookies, no third-party requests, no IP logging, no fingerprinting.
   - Read the numbers in admin.html
   - OPTIONAL: set FW.endpoint below to a URL and every event is also
     POSTed there, so you can collect stats across all visitors.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var CONFIG = {
    key: 'fw_stats_v1',
    endpoint: null,      // e.g. 'https://your-worker.workers.dev/collect'
    maxRecent: 300,
    maxDurations: 500
  };

  var LS;
  try { LS = window.localStorage; LS.setItem('__t', '1'); LS.removeItem('__t'); }
  catch (e) { return; } // private mode / storage blocked -> do nothing

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function blank() {
    return {
      v: 1, firstSeen: Date.now(), lastSeen: Date.now(),
      views: 0, sessions: 0,
      days: {}, hours: {}, weekdays: {},
      referrers: {}, devices: {}, browsers: {}, os: {}, langs: {}, screens: {},
      sections: {}, clicks: {}, stores: {}, socials: {}, outbound: {},
      durations: [], recent: [], players: {}
    };
  }

  function load() {
    try {
      var raw = LS.getItem(CONFIG.key);
      if (!raw) return blank();
      var d = JSON.parse(raw);
      var b = blank();
      for (var k in b) if (!(k in d)) d[k] = b[k];
      return d;
    } catch (e) { return blank(); }
  }

  var S = load();
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { S.lastSeen = Date.now(); LS.setItem(CONFIG.key, JSON.stringify(S)); } catch (e) {}
    }, 120);
  }
  function saveNow() {
    try { S.lastSeen = Date.now(); LS.setItem(CONFIG.key, JSON.stringify(S)); } catch (e) {}
  }

  function bump(obj, k, n) { if (!k) return; obj[k] = (obj[k] || 0) + (n || 1); }

  function send(type, payload) {
    if (!CONFIG.endpoint) return;
    try {
      var body = JSON.stringify({ type: type, at: Date.now(), path: location.pathname, data: payload || {} });
      if (navigator.sendBeacon) navigator.sendBeacon(CONFIG.endpoint, new Blob([body], { type: 'application/json' }));
      else fetch(CONFIG.endpoint, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {}
  }

  /* ---------- environment ---------- */
  var ua = navigator.userAgent;
  function device() {
    if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return 'Tablet';
    if (/Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua)) return 'Mobile';
    return 'Desktop';
  }
  function browser() {
    if (/Edg\//.test(ua)) return 'Edge';
    if (/OPR\/|Opera/.test(ua)) return 'Opera';
    if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
    if (/Firefox\//.test(ua)) return 'Firefox';
    if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
    return 'Other';
  }
  function osName() {
    if (/Windows/.test(ua)) return 'Windows';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Other';
  }
  function refName() {
    var r = document.referrer;
    if (!r) return 'Direct / bookmark';
    try {
      var h = new URL(r).hostname.replace(/^www\./, '');
      if (h === location.hostname.replace(/^www\./, '')) return 'Internal';
      if (/google\./.test(h)) return 'Google';
      if (/bing\./.test(h)) return 'Bing';
      if (/duckduckgo/.test(h)) return 'DuckDuckGo';
      if (/facebook|fb\./.test(h)) return 'Facebook';
      if (/instagram/.test(h)) return 'Instagram';
      if (/t\.co|twitter|x\.com/.test(h)) return 'X / Twitter';
      if (/soundcloud/.test(h)) return 'SoundCloud';
      if (/mixcloud/.test(h)) return 'Mixcloud';
      if (/spotify/.test(h)) return 'Spotify';
      if (/beatport/.test(h)) return 'Beatport';
      return h;
    } catch (e) { return 'Other'; }
  }
  function bucketScreen() {
    var w = window.innerWidth;
    if (w < 480) return '< 480';
    if (w < 768) return '480-767';
    if (w < 1024) return '768-1023';
    if (w < 1440) return '1024-1439';
    return '1440+';
  }

  /* ---------- page view ---------- */
  var now = new Date();
  var day = today();
  if (!S.days[day]) S.days[day] = { views: 0, sessions: 0 };
  S.days[day].views++;
  S.views++;
  bump(S.hours, String(now.getHours()));
  bump(S.weekdays, String(now.getDay()));
  bump(S.devices, device());
  bump(S.browsers, browser());
  bump(S.os, osName());
  bump(S.langs, (navigator.language || 'unknown').slice(0, 5));
  bump(S.screens, bucketScreen());
  bump(S.referrers, refName());

  var isNewSession = false;
  try {
    if (!sessionStorage.getItem('fw_sess')) {
      sessionStorage.setItem('fw_sess', String(Date.now()));
      isNewSession = true;
    }
  } catch (e) { isNewSession = true; }

  if (isNewSession) {
    S.sessions++;
    S.days[day].sessions++;
    S.recent.unshift({ t: Date.now(), ref: refName(), dev: device(), br: browser(), path: location.pathname });
    if (S.recent.length > CONFIG.maxRecent) S.recent.length = CONFIG.maxRecent;
  }
  save();
  send('pageview', { ref: refName(), dev: device(), br: browser(), os: osName(), newSession: isNewSession });

  /* ---------- section visibility ---------- */
  if (typeof IntersectionObserver === 'function') {
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = e.target.id || e.target.className.split(' ')[0];
        if (!id || seen[id]) return;
        seen[id] = 1;
        bump(S.sections, id);
        save();
      });
    }, { threshold: 0.35 });
    document.querySelectorAll('section[id], section').forEach(function (s) { io.observe(s); });
  }

  /* ---------- clicks ---------- */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest ? ev.target.closest('a,button') : null;
    if (!a) return;

    var store = a.getAttribute('data-store');
    var track = a.getAttribute('data-track');
    if (store && track) {
      bump(S.clicks, store + ' :: ' + track);
      bump(S.stores, store);
      var dk = today();
      if (!S.days[dk]) S.days[dk] = { views: 0, sessions: 0 };
      S.days[dk].clicks = (S.days[dk].clicks || 0) + 1;
      save();
      send('store_click', { store: store, track: track });
      return;
    }

    var href = a.getAttribute('href') || '';
    if (/^mailto:/.test(href)) { bump(S.outbound, 'Booking e-mail'); save(); send('mail', {}); return; }

    if (/^https?:/.test(href)) {
      var host;
      try { host = new URL(href).hostname.replace(/^www\./, ''); } catch (e) { host = href; }
      if (host === location.hostname.replace(/^www\./, '')) return;
      var label = a.getAttribute('aria-label') || (a.textContent || '').trim().slice(0, 40) || host;
      if (a.closest('footer')) { bump(S.socials, label); }
      bump(S.outbound, label + ' (' + host + ')');
      save();
      send('outbound', { host: host, label: label });
      return;
    }

    if (a.classList.contains('consent-accept')) {
      bump(S.players, 'Player unlocked'); save(); send('player', {});
    }
  }, true);

  /* ---------- time on page ---------- */
  var start = Date.now(), logged = false;
  function logTime() {
    if (logged) return; logged = true;
    var secs = Math.round((Date.now() - start) / 1000);
    if (secs > 1 && secs < 3600) {
      S.durations.push(secs);
      if (S.durations.length > CONFIG.maxDurations) S.durations.shift();
    }
    saveNow();
    send('duration', { seconds: secs });
  }
  addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') logTime(); });
  addEventListener('pagehide', logTime);

  /* expose for admin.html */
  window.FWStats = {
    key: CONFIG.key,
    read: load,
    reset: function () { try { LS.removeItem(CONFIG.key); } catch (e) {} }
  };
})();
