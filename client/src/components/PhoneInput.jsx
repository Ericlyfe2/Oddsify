/**
 * E.164 phone input. Auto-strips spaces/dashes/parens on every keystroke,
 * caps length at the spec maximum (1 + 15), and exposes real-time error
 * messages keyed to the validation spec. Designed to drop into the same
 * `.field` chrome used by LoginPage etc.
 */
import { useMemo } from 'react';
import { E164_HINT, E164_PLACEHOLDER, autoFormatPhoneInput, validatePhone } from '../lib/phone.js';

export default function PhoneInput({
  id,
  value,
  onChange,
  showHint = true,
  showError = true,
  allowEmpty = false,
  className,
  autoFocus,
  required,
  name = 'phone',
  ariaLabel = 'Phone number',
}) {
  const error = useMemo(() => validatePhone(value, { allowEmpty }), [value, allowEmpty]);
  const touched = (value ?? '').length > 0;
  const isValid = !error;

  return (
    <div className={`phone-input ${className || ''}`.trim()}>
      <div className={`field${touched && !isValid ? ' invalid' : ''}${touched && isValid ? ' valid' : ''}`}>
        <span className="field-icon" aria-hidden="true">
          {touched && isValid ? '✓' : '📱'}
        </span>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          autoFocus={autoFocus}
          required={required}
          aria-label={ariaLabel}
          aria-invalid={touched && !isValid ? 'true' : 'false'}
          placeholder={E164_PLACEHOLDER}
          value={value || ''}
          onChange={(e) => onChange(autoFormatPhoneInput(e.target.value))}
          onPaste={(e) => {
            // Sanitize pasted content immediately so spaces/dashes never
            // momentarily appear in the field.
            e.preventDefault();
            const pasted = e.clipboardData?.getData('text') || '';
            onChange(autoFormatPhoneInput(pasted));
          }}
        />
      </div>
      {showHint && !touched && <p className="phone-hint">{E164_HINT}</p>}
      {showError && touched && error && <p className="phone-error">{error.message}</p>}
    </div>
  );
}
