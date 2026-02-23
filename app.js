/* ─────────────────────────────────────────
   CALC-9000 · Calculator Logic
   ───────────────────────────────────────── */

(function () {
  'use strict';

  // ── State ──────────────────────────────────
  const state = {
    current:     '0',    // what's shown
    previous:    null,   // stored operand
    operator:    null,   // pending operator
    justEvaled:  false,  // did we just press "="
    expression:  '',     // history line
  };

  // ── DOM ────────────────────────────────────
  const resultEl     = document.getElementById('result');
  const expressionEl = document.getElementById('expression');

  // ── Helpers ───────────────────────────────
  function updateDisplay(flash = true) {
    resultEl.textContent = state.current;
    resultEl.classList.remove('error');

    // Scale down font if number is long
    const len = state.current.replace('-', '').replace('.', '').length;
    resultEl.style.fontSize = len > 10 ? '20px' : len > 7 ? '28px' : '';

    expressionEl.textContent = state.expression || '\u00a0';

    if (flash) {
      resultEl.classList.remove('flash');
      void resultEl.offsetWidth; // reflow to restart
      resultEl.classList.add('flash');
    }
  }

  function showError(msg = 'Error') {
    resultEl.textContent = msg;
    resultEl.classList.add('error');
    state.current    = '0';
    state.previous   = null;
    state.operator   = null;
    state.expression = '';
    state.justEvaled = false;
  }

  function formatNumber(num) {
    if (!isFinite(num)) return 'Error';
    // Round to avoid floating point weirdness (up to 10 sig figs)
    const rounded = parseFloat(num.toPrecision(10));
    // If it's an integer after rounding, show without decimal noise
    const str = String(rounded);
    // Max display length guard
    if (str.length > 15) return rounded.toExponential(6);
    return str;
  }

  function compute(a, op, b) {
    switch (op) {
      case '+': return a + b;
      case '−': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? Infinity : a / b;
      default:  return b;
    }
  }

  // ── Actions ───────────────────────────────
  const actions = {

    num(value) {
      // After "=" start fresh but allow building new number
      if (state.justEvaled) {
        state.current    = value;
        state.expression = '';
        state.justEvaled = false;
        return;
      }
      if (state.current === '0' || state.current === '-0') {
        state.current = (state.current === '-0' ? '-' : '') + value;
      } else {
        if (state.current.length >= 15) return; // cap length
        state.current += value;
      }
    },

    decimal() {
      if (state.justEvaled) {
        state.current    = '0.';
        state.expression = '';
        state.justEvaled = false;
        return;
      }
      if (!state.current.includes('.')) {
        state.current += '.';
      }
    },

    op(value) {
      const cur = parseFloat(state.current);

      if (state.operator && !state.justEvaled) {
        // Chain operations — evaluate pending
        const result = compute(parseFloat(state.previous), state.operator, cur);
        if (!isFinite(result)) { showError('∞'); return; }
        const formatted = formatNumber(result);
        state.previous  = formatted;
        state.current   = formatted;
        state.expression = `${formatted} ${value}`;
      } else {
        state.previous  = state.current;
        state.expression = `${state.current} ${value}`;
      }

      state.operator   = value;
      state.justEvaled = false;
      // Next number input will replace current
      state._waitingForOperand = true;
      // Trick: mark we want fresh input next time
      state._replaceNext = true;
    },

    equals() {
      if (!state.operator || state.previous === null) return;

      const a   = parseFloat(state.previous);
      const b   = parseFloat(state.current);
      const result = compute(a, state.operator, b);

      if (!isFinite(result)) { showError(result === Infinity ? '∞' : 'Error'); return; }

      const formatted = formatNumber(result);
      state.expression = `${state.previous} ${state.operator} ${state.current} =`;
      state.current    = formatted;
      state.operator   = null;
      state.previous   = null;
      state.justEvaled = true;
      state._replaceNext = false;
    },

    clear() {
      state.current    = '0';
      state.previous   = null;
      state.operator   = null;
      state.expression = '';
      state.justEvaled = false;
      state._replaceNext = false;
    },

    sign() {
      if (state.current === '0') return;
      state.current = state.current.startsWith('-')
        ? state.current.slice(1)
        : '-' + state.current;
    },

    percent() {
      const val = parseFloat(state.current) / 100;
      state.current = formatNumber(val);
    },
  };

  // Intercept num/decimal to handle replace-next
  const originalNum     = actions.num.bind(actions);
  const originalDecimal = actions.decimal.bind(actions);

  actions.num = function (value) {
    if (state._replaceNext) {
      state.current      = value;
      state._replaceNext = false;
      return;
    }
    originalNum(value);
  };

  actions.decimal = function () {
    if (state._replaceNext) {
      state.current      = '0.';
      state._replaceNext = false;
      return;
    }
    originalDecimal();
  };

  // ── Event Delegation ──────────────────────
  document.querySelector('.button-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn');
    if (!btn) return;

    const action = btn.dataset.action;
    const value  = btn.dataset.value;

    if (!action || !actions[action]) return;

    actions[action](value);
    updateDisplay();
  });

  // ── Keyboard Support ──────────────────────
  const keyMap = {
    '0': () => actions.num('0'),
    '1': () => actions.num('1'),
    '2': () => actions.num('2'),
    '3': () => actions.num('3'),
    '4': () => actions.num('4'),
    '5': () => actions.num('5'),
    '6': () => actions.num('6'),
    '7': () => actions.num('7'),
    '8': () => actions.num('8'),
    '9': () => actions.num('9'),
    '.': () => actions.decimal(),
    ',': () => actions.decimal(),
    '+': () => actions.op('+'),
    '-': () => actions.op('−'),
    '*': () => actions.op('×'),
    '/': () => actions.op('÷'),
    'Enter':     () => actions.equals(),
    '=':         () => actions.equals(),
    'Backspace':  () => {
      if (state.current.length > 1) {
        state.current = state.current.slice(0, -1);
        if (state.current === '-') state.current = '0';
      } else {
        state.current = '0';
      }
    },
    'Escape': () => actions.clear(),
    '%':      () => actions.percent(),
  };

  document.addEventListener('keydown', (e) => {
    const handler = keyMap[e.key];
    if (!handler) return;
    e.preventDefault();
    handler();
    updateDisplay();

    // Visual feedback — briefly highlight matching button
    const btn = [...document.querySelectorAll('.btn')].find(b => {
      if (e.key >= '0' && e.key <= '9') return b.dataset.value === e.key;
      if (e.key === '.' || e.key === ',') return b.dataset.action === 'decimal';
      if (e.key === 'Enter' || e.key === '=') return b.dataset.action === 'equals';
      if (e.key === 'Escape') return b.dataset.action === 'clear';
      if (e.key === '+') return b.dataset.value === '+';
      if (e.key === '-') return b.dataset.value === '−';
      if (e.key === '*') return b.dataset.value === '×';
      if (e.key === '/') return b.dataset.value === '÷';
      return false;
    });
    if (btn) {
      btn.style.filter = 'brightness(1.6)';
      setTimeout(() => { btn.style.filter = ''; }, 120);
    }
  });

  // ── Initial render ─────────────────────────
  updateDisplay(false);

})();