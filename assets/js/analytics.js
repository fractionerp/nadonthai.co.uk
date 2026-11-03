(function () {
  'use strict';

  const measurementId = document.currentScript.dataset.measurementId;
  const storageKey = 'nadon-analytics-consent-v1';
  const preferenceLifetime = 180 * 24 * 60 * 60 * 1000;
  const banner = document.getElementById('analytics-consent');
  const settingsButtons = document.querySelectorAll('[data-analytics-settings]');
  const status = document.getElementById('analytics-consent-status');
  let loaded = false;
  let previousFocus;

  if (!measurementId || !banner) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  function readPreference() {
    try {
      const preference = JSON.parse(localStorage.getItem(storageKey));
      if (preference && preference.expires > Date.now() &&
          ['accepted', 'rejected'].includes(preference.choice)) return preference.choice;
    } catch (error) {
      // If storage is unavailable, ask again on the next page.
    }
    return null;
  }

  function clearAnalyticsCookies() {
    // GA4's default cookies are scoped to the root path and site domain.
    const domains = ['', location.hostname, '.' + location.hostname];
    document.cookie.split(';').forEach(function (cookie) {
      const name = cookie.split('=')[0].trim();
      if (name !== '_ga' && !name.startsWith('_ga_')) return;
      domains.forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax' +
          (domain ? '; domain=' + domain : '');
      });
    });
  }

  function enableAnalytics() {
    window['ga-disable-' + measurementId] = false;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    if (loaded) return;
    loaded = true;
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    document.head.appendChild(tag);
  }

  function disableAnalytics() {
    window['ga-disable-' + measurementId] = true;
    window.gtag('consent', 'update', { analytics_storage: 'denied' });
    clearAnalyticsCookies();
  }

  function showSettings() {
    previousFocus = document.activeElement;
    const choice = readPreference();
    status.textContent = choice ? 'Your current choice: analytics ' +
      (choice === 'accepted' ? 'accepted.' : 'rejected.') : '';
    banner.hidden = false;
    banner.querySelector('button').focus();
  }

  settingsButtons.forEach(function (button) {
    button.hidden = false;
    button.addEventListener('click', showSettings);
  });

  banner.querySelectorAll('[data-analytics-choice]').forEach(function (button) {
    button.addEventListener('click', function () {
      const choice = button.dataset.analyticsChoice;
      try {
        localStorage.setItem(storageKey, JSON.stringify({ choice: choice, expires: Date.now() + preferenceLifetime }));
      } catch (error) {
        // The choice still applies to this page when storage is unavailable.
      }
      if (choice === 'accepted') enableAnalytics();
      else disableAnalytics();
      banner.hidden = true;
      (previousFocus || settingsButtons[0]).focus({ preventScroll: true });
      // Remove the loaded Google script and its listeners after withdrawal.
      if (choice === 'rejected' && loaded) location.reload();
    });
  });

  // Keep other open tabs in step with a changed or cleared preference.
  window.addEventListener('storage', function (event) {
    if (event.key === storageKey || event.key === null) {
      disableAnalytics();
      location.reload();
    }
  });

  if (readPreference() === 'accepted') enableAnalytics();
  else {
    disableAnalytics();
    banner.hidden = readPreference() === 'rejected';
  }
}());
