import { validateEventName, validateProperties } from '../../src/utils/validation';

describe('validateEventName', () => {
  it('accepts valid event names', () => {
    expect(validateEventName('button_clicked')).toBeNull();
    expect(validateEventName('$screen')).toBeNull();
    expect(validateEventName('$identify')).toBeNull();
    expect(validateEventName('event123')).toBeNull();
    expect(validateEventName('A')).toBeNull();
  });

  it('rejects empty event name', () => {
    expect(validateEventName('')).toBe('event name is required');
  });

  it('rejects event name exceeding max length', () => {
    const longName = 'a'.repeat(257);
    const error = validateEventName(longName);
    expect(error).toContain('exceeds 256 character limit');
    expect(error).toContain('got 257');
  });

  it('rejects event name with invalid characters', () => {
    expect(validateEventName('event with spaces')).toContain('alphanumeric');
    expect(validateEventName('event-dashes')).toContain('alphanumeric');
    expect(validateEventName('event.dots')).toContain('alphanumeric');
  });
});

describe('validateProperties', () => {
  it('accepts valid properties', () => {
    expect(validateProperties({ key: 'value', num: 42 })).toBeNull();
  });

  it('accepts empty properties', () => {
    expect(validateProperties({})).toBeNull();
  });

  it('rejects too many properties', () => {
    const props: Record<string, unknown> = {};
    for (let i = 0; i < 257; i++) {
      props[`key_${i}`] = 'value';
    }
    const error = validateProperties(props);
    expect(error).toContain('too many properties');
    expect(error).toContain('got 257');
  });

  it('rejects property key exceeding max length', () => {
    const longKey = 'k'.repeat(257);
    const error = validateProperties({ [longKey]: 'value' });
    expect(error).toContain('exceeds 256 character limit');
  });

  it('rejects property value exceeding max size', () => {
    const largeValue = 'x'.repeat(9000);
    const error = validateProperties({ key: largeValue });
    expect(error).toContain('exceeds 8192 byte limit');
  });
});
