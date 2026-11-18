(() => {
  const choices = ['display', 'lora', 'sans'];
  const key = 'nadon-thai-preview-type';
  const url = new URL(window.location.href);
  let saved;

  try {
    saved = sessionStorage.getItem(key);
  } catch {
    // The URL still controls the preview when storage is unavailable.
  }

  function setTypeface(value) {
    document.documentElement.dataset.headingFont = value;
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // The selection still applies to the current page.
    }
  }

  const initial = [url.searchParams.get('type'), saved].find(value => choices.includes(value)) || 'display';
  setTypeface(initial);

  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('preview-typeface');
    select.value = initial;
    select.closest('.type-preview').hidden = false;
    select.addEventListener('change', () => {
      setTypeface(select.value);
      const updated = new URL(window.location.href);
      updated.searchParams.set('type', select.value);
      history.replaceState(null, '', updated);
    });
  });
})();
