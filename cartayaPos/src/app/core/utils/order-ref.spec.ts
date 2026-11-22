import { shortOrderRef } from './order-ref';

describe('shortOrderRef', () => {
  it('shortens a UUID to 6 uppercase characters', () => {
    expect(shortOrderRef('42e9b3d6-1234-4abc-9def-0123456789ab')).toBe('6789AB');
  });

  it('gives the same reference for the same id everywhere', () => {
    const id = 'queue-1700000000000-ufaztu';
    expect(shortOrderRef(id)).toBe(shortOrderRef(id));
    expect(shortOrderRef(id)).toBe('UFAZTU');
  });

  it('handles empty values', () => {
    expect(shortOrderRef(undefined)).toBe('');
    expect(shortOrderRef('')).toBe('');
  });
});
