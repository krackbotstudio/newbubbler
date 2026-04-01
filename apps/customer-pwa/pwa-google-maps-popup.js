/* PWA-only: simple Google map popup + deterministic fetch */

if (typeof window !== 'undefined' && !window.__WEYOU_PWA_MAP_POPUP_INIT__) {
  window.__WEYOU_PWA_MAP_POPUP_INIT__ = true;

  const TARGET_TEXT = 'open google maps to search';
  const STORAGE_KEY = 'weyou:pwa-map-address';

  let modalEl = null;
  let queryInput = null;
  let mapFrame = null;
  let statusEl = null;

  function toSafeText(v) {
    return String(v || '').trim();
  }

  function parsePincode(text) {
    const m = toSafeText(text).match(/\b(\d{6})\b/);
    return m ? m[1] : '';
  }

  function parseCity(text) {
    const parts = toSafeText(text).split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return parts[parts.length - 2];
    return parts[0] || '';
  }

  function buildPayloadFromQuery(rawQuery, mapSrc) {
    const q = toSafeText(rawQuery);
    const fromMapQ = (() => {
      const src = toSafeText(mapSrc);
      const m = src.match(/[?&]q=([^&]+)/);
      return m?.[1] ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
    })();
    const text = q || fromMapQ || 'Selected on Google map';
    const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
    const streetArea = parts.slice(0, Math.max(1, parts.length - 2)).join(', ') || text;
    const payload = {
      houseNo: '',
      streetArea,
      city: parseCity(text),
      pincode: parsePincode(text),
      addressLine: text,
      googleUrl: mapSrc || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`,
    };
    return payload;
  }

  function setControlledValue(el, value) {
    if (!el) return;
    const setter =
      Object.getOwnPropertyDescriptor(window.HTMLInputElement?.prototype || {}, 'value')?.set ||
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement?.prototype || {}, 'value')?.set ||
      Object.getOwnPropertyDescriptor(el.__proto__ || {}, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.setAttribute('value', value);
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true, composed: true }));
  }

  function findInputByPlaceholder(placeholder) {
    const selector = `input[placeholder="${placeholder}"], textarea[placeholder="${placeholder}"]`;
    return document.querySelector(selector);
  }

  function findInputByPlaceholderIncludes(fragment) {
    const key = String(fragment || '').toLowerCase();
    const all = Array.from(document.querySelectorAll('input[placeholder],textarea[placeholder]'));
    return all.find((el) => String(el.getAttribute('placeholder') || '').toLowerCase().includes(key)) || null;
  }

  function applyPayload(payload) {
    const houseInput = findInputByPlaceholder('House / Flat no.') || findInputByPlaceholderIncludes('house');
    const streetInput = findInputByPlaceholder('Street & area') || findInputByPlaceholderIncludes('street');
    const cityInput = findInputByPlaceholder('City') || findInputByPlaceholderIncludes('city');
    const pinInput = findInputByPlaceholder('Pincode (6 digits)') || findInputByPlaceholderIncludes('pincode');
    const fullInput = findInputByPlaceholder('Full address (optional; auto-filled from map)') || findInputByPlaceholderIncludes('full address');
    const linkInput = findInputByPlaceholder('Google Maps link (optional)') || findInputByPlaceholderIncludes('google maps');

    setControlledValue(houseInput, payload.houseNo || '');
    setControlledValue(streetInput, payload.streetArea || '');
    setControlledValue(cityInput, payload.city || '');
    setControlledValue(pinInput, payload.pincode || '');
    setControlledValue(fullInput, payload.addressLine || '');
    setControlledValue(linkInput, payload.googleUrl || '');

    requestAnimationFrame(() => {
      setControlledValue(houseInput, payload.houseNo || '');
      setControlledValue(streetInput, payload.streetArea || '');
      setControlledValue(cityInput, payload.city || '');
      setControlledValue(pinInput, payload.pincode || '');
      setControlledValue(fullInput, payload.addressLine || '');
      setControlledValue(linkInput, payload.googleUrl || '');
    });

    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
    if (window?.dispatchEvent && window?.CustomEvent) {
      window.dispatchEvent(new window.CustomEvent('weyou:pwa-map-address', { detail: payload }));
    }
  }

  function closeModal() {
    if (modalEl?.parentNode) modalEl.parentNode.removeChild(modalEl);
    modalEl = null;
    queryInput = null;
    mapFrame = null;
    statusEl = null;
  }

  function updateMapFromQuery() {
    if (!mapFrame || !queryInput) return;
    const q = toSafeText(queryInput.value);
    const src = q
      ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`
      : 'https://www.google.com/maps?output=embed';
    mapFrame.setAttribute('src', src);
    if (statusEl) statusEl.textContent = q ? 'Tap Fetch address to apply this location.' : 'Enter and search location first.';
  }

  function onFetch() {
    if (!queryInput || !mapFrame) return;
    const payload = buildPayloadFromQuery(queryInput.value, mapFrame.src);
    applyPayload(payload);
    closeModal();
  }

  function openModal() {
    if (modalEl) return;
    modalEl = document.createElement('div');
    modalEl.style.cssText = [
      'position:fixed',
      'inset:0',
      'background:rgba(0,0,0,.25)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'z-index:999999',
      'padding:16px',
    ].join(';');

    const card = document.createElement('div');
    card.style.cssText = [
      'width:min(860px,96vw)',
      'height:min(700px,92vh)',
      'background:#fff',
      'border-radius:14px',
      'border:1px solid #f5c6dc',
      'display:flex',
      'flex-direction:column',
      'overflow:hidden',
      'font-family:Roboto,"Segoe UI",Arial,sans-serif',
      'box-shadow:0 16px 48px rgba(136,14,79,.18)',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #fde2ef;background:#fff7fb;';
    const title = document.createElement('div');
    title.textContent = 'Search location';
    title.style.cssText = 'font-size:22px;font-weight:700;color:#880e4f;letter-spacing:.1px;';
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText =
      'border:none;background:transparent;font-size:22px;cursor:pointer;color:#880e4f;line-height:1;padding:4px 8px;border-radius:8px;';
    closeBtn.onclick = closeModal;
    header.appendChild(title);
    header.appendChild(closeBtn);

    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid #fde2ef;background:#fff;';
    queryInput = document.createElement('input');
    queryInput.type = 'text';
    queryInput.placeholder = 'Search address or area';
    queryInput.style.cssText =
      'flex:1;min-width:0;height:42px;border:1px solid #f5c6dc;border-radius:8px;padding:0 12px;font-size:16px;color:#202124;outline:none;background:#fff7fb;';
    queryInput.onfocus = () => {
      queryInput.style.borderColor = '#c2185b';
      queryInput.style.boxShadow = '0 0 0 1px #c2185b';
    };
    queryInput.onblur = () => {
      queryInput.style.borderColor = '#f5c6dc';
      queryInput.style.boxShadow = 'none';
    };
    queryInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateMapFromQuery();
      }
    });
    const searchBtn = document.createElement('button');
    searchBtn.type = 'button';
    searchBtn.textContent = 'Search';
    searchBtn.style.cssText =
      'height:42px;padding:0 16px;border:none;border-radius:8px;background:#c2185b;color:#fff;font-size:15px;font-weight:600;cursor:pointer;';
    searchBtn.onclick = updateMapFromQuery;
    controls.appendChild(queryInput);
    controls.appendChild(searchBtn);

    const mapWrap = document.createElement('div');
    mapWrap.style.cssText = 'position:relative;flex:1;min-height:420px;background:#fff7fb;';
    mapFrame = document.createElement('iframe');
    mapFrame.src = 'https://www.google.com/maps?output=embed';
    mapFrame.style.cssText = 'border:none;position:absolute;inset:0;width:100%;height:100%;';
    mapFrame.referrerPolicy = 'no-referrer-when-downgrade';
    mapWrap.appendChild(mapFrame);

    statusEl = document.createElement('div');
    statusEl.style.cssText = 'padding:10px 14px;font-size:13px;color:#6b7280;border-top:1px solid #fde2ef;background:#fff;';
    statusEl.textContent = 'Enter and search location first.';

    const footer = document.createElement('div');
    footer.style.cssText =
      'display:flex;justify-content:center;align-items:center;padding:12px 14px;border-top:1px solid #fde2ef;background:#fff7fb;';
    const fetchBtn = document.createElement('button');
    fetchBtn.type = 'button';
    fetchBtn.textContent = 'Fetch address';
    fetchBtn.style.cssText =
      'height:42px;min-width:180px;padding:0 18px;border:none;border-radius:999px;background:#c2185b;color:#fff;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 2px 6px rgba(194,24,91,.25);';
    fetchBtn.onclick = onFetch;
    footer.appendChild(fetchBtn);

    card.appendChild(header);
    card.appendChild(controls);
    card.appendChild(mapWrap);
    card.appendChild(statusEl);
    card.appendChild(footer);
    modalEl.appendChild(card);
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closeModal();
    });
    document.body.appendChild(modalEl);
  }

  window.addEventListener('weyou:pwa-map-popup-open', openModal);

  document.addEventListener(
    'click',
    (e) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest('button,div,a,span');
      if (!trigger) return;
      const txt = String(trigger.textContent || '').trim().toLowerCase();
      const matched = txt === TARGET_TEXT || txt.endsWith(TARGET_TEXT);
      if (!matched) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      openModal();
    },
    true
  );
}

