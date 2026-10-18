// Light/dark switch. With no saved choice the site follows the device; the button saves an override.
// Loaded in <head> so data-theme is set before first paint.
(function () {
  var root = document.documentElement;
  var query = window.matchMedia('(prefers-color-scheme: dark)');
  var KEY = 'theme';

  function saved() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) { return null; }
  }
  function effective() {
    return root.dataset.theme || (query.matches ? 'dark' : 'light');
  }

  var choice = saved();
  if (choice) root.dataset.theme = choice;

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('theme-btn');
    if (!btn) return;

    function label() {
      var next = effective() === 'dark' ? 'Light' : 'Dark';
      btn.textContent = next + ' mode';
    }
    function changed() {
      label();
      document.dispatchEvent(new Event('themechange'));
    }

    btn.hidden = false;
    label();
    btn.addEventListener('click', function () {
      var next = effective() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch (e) { /* choice lasts for this page view only */ }
      changed();
    });
    query.addEventListener('change', changed);
  });
})();
