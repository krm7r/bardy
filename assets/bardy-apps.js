(() => {
  const page = document.body.dataset.app;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const api = path => fetch(path, { headers: { Accept: 'application/json' } }).then(async response => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'تعذر الوصول إلى الخدمة');
    return data;
  });
  const status = (node, text, kind = '') => { if (!node) return; node.textContent = text; node.className = `app-status ${kind}`; };
  const formatNumber = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) : '—';
  const formatDate = value => { try { return new Intl.DateTimeFormat('ar-EG', { weekday:'short', day:'numeric', month:'short' }).format(new Date(value)); } catch { return value || '—'; } };
  const formatTime = value => { try { return new Intl.DateTimeFormat('ar-EG', { hour:'numeric', minute:'2-digit' }).format(new Date(value)); } catch { return value || '—'; } };
  const weatherIcon = code => ({ clearsky_day:'☀️', clearsky_night:'🌙', fair_day:'🌤️', fair_night:'🌙', partlycloudy_day:'⛅', partlycloudy_night:'☁️', cloudy:'☁️', lightrain:'🌦️', rain:'🌧️', heavyrain:'🌧️', lightsnow:'🌨️', snow:'❄️', fog:'🌫️' }[code] || '🌤️');
  const weatherLabel = code => ({ clearsky_day:'سماء صافية', clearsky_night:'سماء صافية', fair_day:'جو لطيف', fair_night:'جو لطيف', partlycloudy_day:'غائم جزئيًا', partlycloudy_night:'غائم جزئيًا', cloudy:'غائم', lightrain:'أمطار خفيفة', rain:'أمطار', heavyrain:'أمطار غزيرة', fog:'ضباب' }[code] || 'حالة جوية متغيرة');

  async function loadWeather(city = 'Cairo') {
    const form = $('#weather-form'), result = $('#weather-result'), state = $('#weather-status');
    status(state, 'جاري تحديث الطقس…', 'loading');
    result.innerHTML = '';
    try {
      const data = await api(`/app/weather?city=${encodeURIComponent(city)}`);
      const series = data.forecast?.properties?.timeseries || [];
      const first = series[0]?.data || {};
      const details = first.instant?.details || {};
      const code = first.next_1_hours?.summary?.symbol_code || first.next_6_hours?.summary?.symbol_code || 'fair_day';
      const cards = series.slice(0, 6).map(item => {
        const d = item.data?.instant?.details || {}, c = item.data?.next_1_hours?.summary?.symbol_code || item.data?.next_6_hours?.summary?.symbol_code || code;
        return `<article class="forecast-card"><time>${formatTime(item.time)}</time><div class="forecast-icon" aria-hidden="true">${weatherIcon(c)}</div><strong>${formatNumber(d.air_temperature)}°</strong><small>${esc(weatherLabel(c))}</small></article>`;
      }).join('');
      result.innerHTML = `<div class="weather-summary"><div class="weather-current"><div class="temperature">${formatNumber(details.air_temperature)}°</div><div class="condition">${esc(weatherLabel(code))} · ${esc(data.cityArabicOrLocalized || data.city)}</div></div><div class="metric-card"><span>الرطوبة</span><strong>${formatNumber(details.relative_humidity)}%</strong></div><div class="metric-card"><span>الرياح</span><strong>${formatNumber(details.wind_speed)} م/ث</strong></div><div class="metric-card"><span>الضغط</span><strong>${formatNumber(details.air_pressure_at_sea_level)}</strong><small>hPa</small></div><div class="metric-card"><span>الإحداثيات</span><strong>${Number(data.latitude).toFixed(2)}°</strong><small>${Number(data.longitude).toFixed(2)}°</small></div></div><div class="app-panel" style="margin-top:18px"><div class="app-panel-head"><h2>الساعات القادمة</h2><span class="app-muted">${esc(data.cityArabicOrLocalized || data.city)}</span></div><div class="forecast-grid">${cards}</div></div><p class="app-muted" style="margin:14px 3px 0">المصدر: ${esc(data.source || 'خدمة الطقس')} · آخر تحديث للبيانات: ${esc(data.forecast?.properties?.meta?.updated_at || 'قريبًا')}</p>`;
      status(state, `تم التحديث الآن · ${new Date().toLocaleTimeString('ar-EG', { hour:'numeric', minute:'2-digit' })}`);
    } catch (error) { result.innerHTML = '<div class="empty-state">تعذر تحميل الطقس. جرّب اسم مدينة أخرى.</div>'; status(state, error.message, 'error'); }
  }

  async function loadCurrencies() {
    const form = $('#currency-form'), result = $('#currency-result'), state = $('#currency-status');
    const base = $('#currency-base').value || 'USD';
    const quotes = [...document.querySelectorAll('input[name="quote"]:checked')].map(input => input.value);
    status(state, 'جاري جلب أسعار البنك المركزي…', 'loading');
    result.innerHTML = '';
    try {
      const data = await api(`/app/currencies?base=${encodeURIComponent(base)}&quotes=${encodeURIComponent(quotes.join(','))}`);
      const rows = (data.data || []).map(item => `<article class="currency-card"><div class="currency-code"><span>${esc(base)} مقابل</span><strong style="display:inline;margin:0;font-size:15px">${esc(item.quote)}</strong></div><strong>${formatNumber(item.rate)}</strong><div class="currency-unit">${esc(item.method === 'cbe-buy' ? 'سعر شراء رسمي' : item.method || 'سعر رسمي')}</div><div class="currency-foot"><span>بيانات اليوم</span><span class="trend neutral">● مباشر من CBE</span></div></article>`).join('');
      result.innerHTML = `<div class="currency-grid">${rows || '<div class="empty-state">لم تصل أسعار للعملات المختارة.</div>'}</div><div class="app-panel" style="margin-top:18px"><div class="app-panel-head"><h2>ملخص الأسعار</h2><span class="app-muted">تاريخ النشر: ${esc(data.date || '—')}</span></div><table class="rate-table"><thead><tr><th>العملة الأساسية</th><th>العملة المقابلة</th><th>السعر</th><th>نوع السعر</th></tr></thead><tbody>${(data.data || []).map(item => `<tr><td>${esc(data.base)}</td><td>${esc(item.quote)}</td><td><strong>${formatNumber(item.rate)}</strong></td><td>${esc(item.method === 'cbe-buy' ? 'شراء رسمي' : item.method || 'رسمي')}</td></tr>`).join('')}</tbody></table><p class="app-muted" style="margin:14px 0 0">هذه الصفحة تعرض السعر الرسمي الحالي. لا نعرض نسبة تقلب تاريخية إلا عند توفر سلسلة تاريخية موثوقة من المصدر نفسه.</p><a class="source-link" href="${esc(data.sourceUrl)}" target="_blank" rel="noopener noreferrer">فتح مصدر البنك المركزي المصري ↗</a></div>`;
      status(state, `تم التحديث · ${data.date || 'اليوم'}`);
    } catch (error) { result.innerHTML = '<div class="empty-state">تعذر تحميل أسعار العملات حاليًا.</div>'; status(state, error.message, 'error'); }
  }

  function initCalculator() {
    const expression = $('#calc-expression'), result = $('#calc-result'), history = $('#calc-history'), state = $('#calc-status');
    let value = '';
    let records = [];
    try { records = JSON.parse(localStorage.getItem('bardy:calc-history:v1') || '[]'); } catch {}
    const renderHistory = () => { history.innerHTML = records.length ? records.slice(0, 8).map(item => `<div class="history-item"><span>${esc(item.expression)}</span><strong>= ${esc(item.result)}</strong></div>`).join('') : '<div class="empty-state">ستظهر العمليات الأخيرة هنا.</div>'; };
    const render = () => { expression.textContent = value || '0'; result.textContent = value ? '…' : '0'; };
    const calculate = () => {
      if (!value) return;
      try {
        if (!/^[0-9+\-*/().%\s]+$/.test(value)) throw new Error('استخدم أرقامًا وعلامات حساب فقط');
        const answer = Function(`"use strict"; return (${value})`)();
        if (!Number.isFinite(answer)) throw new Error('تعذر حساب العملية');
        const item = { expression: value, result: String(Number(answer.toFixed(10))) };
        records = [item, ...records.filter(old => old.expression !== item.expression)].slice(0, 8);
        localStorage.setItem('bardy:calc-history:v1', JSON.stringify(records));
        value = item.result; result.textContent = item.result; expression.textContent = item.expression; renderHistory(); status(state, 'تم الحساب');
      } catch (error) { status(state, error.message, 'error'); }
    };
    document.querySelectorAll('[data-key]').forEach(button => button.addEventListener('click', () => { const key = button.dataset.key; if (key === 'clear') value = ''; else if (key === 'back') value = value.slice(0, -1); else if (key === '=') return calculate(); else value += key; render(); }));
    document.addEventListener('keydown', event => { if (page !== 'calc') return; if (/^[0-9+\-*/().%]$/.test(event.key)) { value += event.key; render(); } if (event.key === 'Enter') calculate(); if (event.key === 'Backspace') { value = value.slice(0, -1); render(); } if (event.key === 'Escape') { value = ''; render(); } });
    render(); renderHistory();
  }

  if (page === 'weather') {
    $('#weather-form')?.addEventListener('submit', event => { event.preventDefault(); loadWeather($('#weather-city').value.trim() || 'Cairo'); });
    loadWeather('Cairo');
  }
  if (page === 'currencies') {
    $('#currency-form')?.addEventListener('submit', event => { event.preventDefault(); loadCurrencies(); });
    document.querySelectorAll('input[name="quote"]').forEach(input => input.addEventListener('change', loadCurrencies));
    loadCurrencies();
  }
  if (page === 'calc') initCalculator();
})();
