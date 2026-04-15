import { sanitizeProperties } from '../../src/privacy/sanitizer';

describe('sanitizeProperties', () => {
  it('does not strip user-provided properties', () => {
    const props = { email: 'test@example.com', name: 'John' };
    const result = sanitizeProperties(props, false);
    expect(result).toEqual(props);
  });

  it('strips PII from auto-captured properties', () => {
    const props = {
      email: 'test@example.com',
      password: 'secret',
      screenName: 'Home',
      button: 'signup',
    };
    const result = sanitizeProperties(props, true);
    expect(result).toEqual({ screenName: 'Home', button: 'signup' });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('password');
  });

  it('strips SSN-like keys', () => {
    const result = sanitizeProperties({ ssn: '123-45-6789', safe: 'ok' }, true);
    expect(result).not.toHaveProperty('ssn');
    expect(result).toHaveProperty('safe');
  });

  it('strips credit card keys', () => {
    const result = sanitizeProperties({ credit_card: '4111...', amount: 100 }, true);
    expect(result).not.toHaveProperty('credit_card');
    expect(result).toHaveProperty('amount');
  });

  it('strips phone number keys', () => {
    const result = sanitizeProperties({ phone_number: '555-1234', id: 1 }, true);
    expect(result).not.toHaveProperty('phone_number');
    expect(result).toHaveProperty('id');
  });

  it('handles empty properties', () => {
    expect(sanitizeProperties({}, true)).toEqual({});
    expect(sanitizeProperties({}, false)).toEqual({});
  });
});
