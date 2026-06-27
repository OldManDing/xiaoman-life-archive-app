import { normalizeRecordTypeForMedia } from '../../src/modules/records/records.service';

describe('RecordsService helpers', () => {
  it('keeps text records as text when no media is attached', () => {
    expect(normalizeRecordTypeForMedia('text', [])).toBe('text');
  });

  it('normalizes text records with media to mixed records', () => {
    expect(normalizeRecordTypeForMedia('text', ['m_001'])).toBe('mixed');
  });

  it('keeps explicit media record types unchanged', () => {
    expect(normalizeRecordTypeForMedia('video', ['m_001'])).toBe('video');
  });
});
