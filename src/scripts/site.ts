// Общий клиентский код: UTM-метки, окно заявки, отправка форм, анимации.

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
    __calc?: { summary: string; text: string } | null;
  }
}

const METRIKA_ID = 0; // TODO: номер счётчика Яндекс Метрики
export const goal = (name: string) => {
  try {
    if (METRIKA_ID && window.ym) window.ym(METRIKA_ID, 'reachGoal', name);
  } catch {}
};

// ---------- UTM: запоминаем первый источник визита ----------
const UTM_KEY = 'p35_src';
function captureSource() {
  try {
    const p = new URLSearchParams(location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid'];
    const found: Record<string, string> = {};
    keys.forEach((k) => {
      const v = p.get(k);
      if (v) found[k] = v.slice(0, 200);
    });
    if (Object.keys(found).length || !localStorage.getItem(UTM_KEY)) {
      found.referrer = document.referrer ? new URL(document.referrer).hostname : '';
      found.landing = location.pathname;
      localStorage.setItem(UTM_KEY, JSON.stringify(found));
    }
  } catch {}
}
function getSource(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(UTM_KEY) || '{}');
  } catch {
    return {};
  }
}

// ---------- Маска телефона ----------
function formatPhone(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('8')) d = '7' + d.slice(1);
  if (d && !d.startsWith('7')) d = '7' + d;
  d = d.slice(0, 11);
  const r = d.slice(1);
  let out = '+7';
  if (r.length) out += ' (' + r.slice(0, 3);
  if (r.length >= 3) out += ')';
  if (r.length > 3) out += ' ' + r.slice(3, 6);
  if (r.length > 6) out += '-' + r.slice(6, 8);
  if (r.length > 8) out += '-' + r.slice(8, 10);
  return out;
}

// ---------- Окно заявки ----------
const modal = document.getElementById('lead-modal') as HTMLDialogElement | null;
let currentSource = 'Всплывающее окно';

function openLead(source: string, withCalc: boolean) {
  if (!modal) return;
  currentSource = source;
  const summary = modal.querySelector<HTMLElement>('[data-calc-summary]');
  const calcInput = modal.querySelector<HTMLInputElement>('input[name="calc"]');
  const calc = withCalc ? window.__calc : null;
  if (summary) {
    summary.classList.toggle('hidden', !calc);
    summary.innerHTML = calc ? calc.summary : '';
  }
  if (calcInput) calcInput.value = calc ? calc.text : '';
  modal.showModal();
  document.documentElement.style.overflow = 'hidden';
  goal('lead_open');
}
modal?.addEventListener('close', () => (document.documentElement.style.overflow = ''));
modal?.addEventListener('click', (e) => {
  if (e.target === modal) modal.close();
});

document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const opener = t.closest<HTMLElement>('[data-open-lead]');
  if (opener) {
    e.preventDefault();
    openLead(opener.dataset.leadSource || 'Кнопка', opener.hasAttribute('data-with-calc'));
  }
  if (t.closest('[data-close-lead]')) modal?.close();
  if (t.closest('[data-goal="phone_click"]')) goal('phone_click');
});

// ---------- Формы ----------
document.querySelectorAll<HTMLFormElement>('form[data-lead-form]').forEach((form) => {
  const startedAt = Date.now();
  const phone = form.querySelector<HTMLInputElement>('[data-phone]');
  const err = form.querySelector<HTMLElement>('[data-form-error]');
  const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]');

  phone?.addEventListener('input', () => (phone.value = formatPhone(phone.value)));
  phone?.addEventListener('focus', () => {
    if (!phone.value) phone.value = '+7 (';
  });


  const showError = (msg: string) => {
    if (!err) return;
    err.textContent = msg;
    err.classList.remove('hidden');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err?.classList.add('hidden');
    const fd = new FormData(form);
    const digits = String(fd.get('phone') || '').replace(/\D/g, '');
    if (digits.length !== 11) return showError('Проверьте номер телефона — нужно 10 цифр после +7.');
    if (!fd.get('consent')) return showError('Нужно согласие на обработку данных.');

    // Копия на GitHub Pages: сервера заявок там нет.
    if (import.meta.env.PUBLIC_MIRROR === '1') {
      return showError(`Заявки принимаем на потолки35.рф или по телефону ${form.dataset.phone}.`);
    }

    const payload: Record<string, unknown> = Object.fromEntries(fd.entries());
    payload.source = form.closest('dialog') ? currentSource : form.dataset.source;
    payload.page = location.pathname;
    payload.utm = getSource();
    payload.elapsed = Date.now() - startedAt;

    if (btn) btn.disabled = true;
    btn?.classList.add('opacity-60');
    try {
      const res = await fetch('/api/lead/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'Ошибка отправки');
      form.classList.add('hidden');
      const success = form.nextElementSibling as HTMLElement | null;
      success?.classList.remove('hidden');
      success?.classList.add('flex');
      goal('lead_sent');
    } catch (ex) {
      showError((ex as Error).message + '. Позвоните нам — ответим сразу.');
    } finally {
      if (btn) btn.disabled = false;
      btn?.classList.remove('opacity-60');
    }
  });
});

// ---------- Появление блоков ----------
const io = new IntersectionObserver(
  (entries) =>
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add('is-visible');
        io.unobserve(en.target);
      }
    }),
  { rootMargin: '0px 0px -10% 0px' },
);
document.querySelectorAll('.reveal, .line-draw').forEach((el) => io.observe(el));

captureSource();

// Отклик кнопок: от места нажатия расходится тёплый свет.
const pressable = '.btn-primary, .btn-glow, .btn-ghost, .btn-ghost-dark, [data-dec], [data-inc], [data-reviews-prev], [data-reviews-next]';
document.addEventListener('pointerdown', (e) => {
  const el = (e.target as Element).closest<HTMLElement>(pressable);
  if (!el) return;
  const box = el.getBoundingClientRect();
  el.style.setProperty('--press-x', `${e.clientX - box.left}px`);
  el.style.setProperty('--press-y', `${e.clientY - box.top}px`);
  el.classList.remove('is-pressed');
  void el.offsetWidth; // перезапуск анимации при быстрых нажатиях
  el.classList.add('is-pressed');
});
document.addEventListener('animationend', (e) => {
  if (e.animationName === 'press-light') (e.target as Element).classList.remove('is-pressed');
});
