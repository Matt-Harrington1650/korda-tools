import { describe, expect, it } from 'vitest';
import { MAX_FILE_SIZE_BYTES, MAX_TOTAL_VERSION_SIZE_BYTES } from './constants';
import { slugify, validateFileSelection, type SelectedToolFile } from './helpers';

const makeFile = (overrides: Partial<SelectedToolFile> = {}): SelectedToolFile => {
  return {
    originalName: 'tool.scr',
    mime: 'text/plain',
    sizeBytes: 1024,
    dataBase64: 'AA==',
    ...overrides,
  };
};

describe('customTools helpers', () => {
  it('slugifies names into url-safe values', () => {
    expect(slugify('AutoCAD Batch Runner v2')).toBe('autocad-batch-runner-v2');
    expect(slugify('___')).toBe('tool');
  });

  it('validates missing files', () => {
    expect(validateFileSelection([])).toEqual(['Attach at least one file.']);
  });

  it('validates duplicate names and per-file size limit', () => {
    const errors = validateFileSelection([
      makeFile({ originalName: 'A.SCR', sizeBytes: MAX_FILE_SIZE_BYTES + 1 }),
      makeFile({ originalName: 'a.scr' }),
    ]);

    expect(errors.some((value) => value.includes('exceeds'))).toBe(true);
    expect(errors).toContain('Duplicate file name: a.scr');
  });

  it('validates total package size limit', () => {
    const half = Math.floor(MAX_TOTAL_VERSION_SIZE_BYTES / 2) + 1;
    const errors = validateFileSelection([makeFile({ originalName: 'one.scr', sizeBytes: half }), makeFile({ originalName: 'two.scr', sizeBytes: half })]);

    expect(errors.some((value) => value.includes('Combined file size exceeds'))).toBe(true);
  });
});
