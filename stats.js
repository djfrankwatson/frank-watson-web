/* ==================================================================
   Frank Watson - cookieless visitor statistics
   ==================================================================

   TWO LAYERS, both cookieless:

   1. LOCAL  - counters kept in the visitor's own browser, shown in
               admin.html. Always on. Never leaves the device.

   2. GOATCOUNTER - site-wide numbers from every visitor, shown on
               your GoatCounter dashboard. OFF until you fill in your
               site code below.

   ------------------------------------------------------------------
   >>> TO SWITCH ON SITE-WIDE STATS:
   1. Make a free account at https://www.goatcounter.com
      Pick a site code, e.g. "frankwatson".
   2. Put that code between the quotes below.
   3. Re-upload this file. Done.
   ------------------------------------------------------------------ */

(function () {
  'use strict';

  var CONFIG = {
    key: 'fw_stats_v1',

    // <<< YOUR GOATCOUNTER SITE CODE GOES HERE >>>
    // '' = off.  'frankwatson' = sends to https://frankwatson.goatcounter.com
    goatcounter: '',

    // Send events (track clicks, outbound links) to GoatCounter too,
    // not just plain page views.
    goatcounterEvents: true,

    // Set to true to hold GoatCounter back until the visitor presses
    // "Accept" on your cookie banner. Not required - GoatCounter sets
    // no cookies - but available if you prefer maximum caution.
    requireConsent: false,

    // Optional: your own collector URL (see the PHP option we discussed).
    endpoint: null,

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

  function slug(s) {
    return String(s).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'x';
  }

  function send(type, payload) {
    if (!CONFIG.endpoint) return;
    try {
      var body = JSON.stringify({ type: type, at: Date.now(), path: location.pathname, data: payload || {} });
      if (navigator.sendBeacon) navigator.sendBeacon(CONFIG.endpoint, new Blob([body], { type: 'application/json' }));
      else fetch(CONFIG.endpoint, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {}
  }

  /* ================= GoatCounter (site-wide, cookieless) ============= */
  var GC = (function () {
    var code = (CONFIG.goatcounter || '').trim();
    var queue = [], ready = false, started = false;

    function consented() {
      if (!CONFIG.requireConsent) return true;
      try { return localStorage.getItem('fw_consent') === 'accepted'; } catch (e) { return false; }
    }

    function start() {
      if (started || !code || !consented()) return;
      started = true;
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://gc.zgo.at/count.js';
      s.setAttribute('data-goatcounter', 'https://' + code + '.goatcounter.com/count');
      s.onload = function () {
        ready = true;
        queue.splice(0).forEach(function (v) { fire(v); });
      };
      s.onerror = function () { queue.length = 0; }; // blocked by an ad blocker: stay silent
      document.head.appendChild(s);
    }

    function fire(v) {
      try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count(v); } catch (e) {}
    }

    return {
      enabled: function () { return !!code; },
      start: start,
      // page view is sent automatically by count.js on load
      event: function (path, title) {
        if (!code || !CONFIG.goatcounterEvents) return;
        var v = { path: String(path).replace(/^\/+/, '').slice(0, 200), title: title || '', event: true };
        if (ready) fire(v); else if (queue.length < 40) queue.push(v);
      },
      // called if the visitor accepts consent later in the session
      retry: function () { start(); }
    };
  })();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', GC.start);
  else GC.start();

  // if consent is required and granted mid-session, start then
  if (CONFIG.requireConsent) {
    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t) return;
      if ((t.id === 'cookie-accept') || (t.classList && t.classList.contains('consent-accept'))) {
        setTimeout(GC.retry, 60);
      }
    }, true);
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
      GC.event(store.toLowerCase() + '-' + slug(track), store + ': ' + track);
      return;
    }

    var href = a.getAttribute('href') || '';
    if (/^mailto:/.test(href)) {
      bump(S.outbound, 'Booking e-mail'); save(); send('mail', {});
      GC.event('booking-email', 'Booking e-mail clicked');
      return;
    }

    if (/^https?:/.test(href)) {
      var host;
      try { host = new URL(href).hostname.replace(/^www\./, ''); } catch (e) { host = href; }
      if (host === location.hostname.replace(/^www\./, '')) return;
      var label = a.getAttribute('aria-label') || (a.textContent || '').trim().slice(0, 40) || host;
      if (a.closest('footer')) { bump(S.socials, label); }
      bump(S.outbound, label + ' (' + host + ')');
      save();
      send('outbound', { host: host, label: label });
      GC.event('out-' + slug(host), 'Outbound: ' + label);
      return;
    }

    if (a.classList.contains('consent-accept')) {
      bump(S.players, 'Player unlocked'); save(); send('player', {});
      GC.event('player-unlocked', 'Embedded player unlocked');
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
