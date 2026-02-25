import { describe, expect, it } from 'vitest';
import {
  applyPackageFilesToInstructions,
  FILES_IN_PACKAGE_PLACEHOLDER,
  TOOL_INSTRUCTION_TEMPLATES,
} from './toolTemplates';

describe('toolTemplates', () => {
  it('injects attached files into placeholder token', () => {
    const template = TOOL_INSTRUCTION_TEMPLATES['Generic (no template)'];
    const output = applyPackageFilesToInstructions(template, ['setup.scr', 'README.md']);

    expect(output).toContain('- `setup.scr`');
    expect(output).toContain('- `README.md`');
    expect(output).not.toContain(FILES_IN_PACKAGE_PLACEHOLDER);
  });

  it('appends files section when placeholder was removed', () => {
    const source = '# Installation\n\n## Verify\n- Works';
    const output = applyPackageFilesToInstructions(source, ['custom.lsp']);

    expect(output).toContain('## Files in this package');
    expect(output).toContain('- `custom.lsp`');
  });
});
