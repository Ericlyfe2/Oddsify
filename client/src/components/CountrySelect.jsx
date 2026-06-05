import { useEffect, useMemo, useRef, useState } from 'react';
import { COUNTRIES, countryByCode } from '../data/countries.js';

/**
 * Searchable country picker with flag emojis.
 * Controlled component: pass `value` (ISO-2 code) + `onChange(code)`.
 */
export default function CountrySelect({
  id = 'country-select',
  value = '',
  onChange,
  placeholder = 'Select your country…',
  required = true,
  invalid = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const selected = countryByCode(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open) setActiveIdx(0);
  }, [open, query]);

  function pick(c) {
    onChange?.(c.code);
    setOpen(false);
    setQuery('');
  }

  function onKey(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    }
    if (e.key === 'Enter' && open && filtered[activeIdx]) {
      e.preventDefault();
      pick(filtered[activeIdx]);
    }
  }

  return (
    <div ref={wrapRef} className={`country-select${invalid ? ' invalid' : ''}${disabled ? ' disabled' : ''}`}>
      <button
        type="button"
        id={id}
        className="country-select-trigger field"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKey}
      >
        <span className="cs-flag" aria-hidden="true">
          {selected ? selected.flag : '🌍'}
        </span>
        <span className="cs-label">{selected ? selected.name : placeholder}</span>
        <span className="cs-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="country-select-pop" role="dialog">
          <input
            type="text"
            autoFocus
            className="cs-search"
            placeholder="Search country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
          />
          <ul ref={listRef} role="listbox" aria-label="Countries" className="cs-list">
            {filtered.length === 0 && <li className="cs-empty">No matches.</li>}
            {filtered.map((c, i) => (
              <li
                key={c.code}
                role="option"
                aria-selected={c.code === value}
                className={`cs-item${i === activeIdx ? ' active' : ''}${c.code === value ? ' selected' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => pick(c)}
              >
                <span className="cs-flag" aria-hidden="true">
                  {c.flag}
                </span>
                <span className="cs-name">{c.name}</span>
                <span className="cs-code">{c.code}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {required && <input type="hidden" name="country" value={value || ''} aria-hidden="true" tabIndex={-1} />}
    </div>
  );
}
