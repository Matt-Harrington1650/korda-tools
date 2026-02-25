export const FILES_IN_PACKAGE_PLACEHOLDER = '{{FILES_IN_PACKAGE}}';

export const TEMPLATE_OPTIONS = [
  'AutoCAD AutoLISP (.LSP/.VLX/.FAS)',
  'AutoCAD Script (.SCR)',
  'AutoCAD CUIX Customization',
  'Generic (no template)',
] as const;

export type TemplateOption = (typeof TEMPLATE_OPTIONS)[number];

const EMPTY_FILES_LINE = '- (UI will populate this list from attached files at save time.)';

export const TOOL_INSTRUCTION_TEMPLATES: Record<TemplateOption, string> = {
  'AutoCAD AutoLISP (.LSP/.VLX/.FAS)': `# AutoCAD AutoLISP Installation Guide

## Supported AutoCAD versions
- [Placeholder: List tested AutoCAD versions and vertical products]

## Files in this package
${FILES_IN_PACKAGE_PLACEHOLDER}

## Installation
### Method 1: APPLOAD (manual load)
1. Copy package files to a local folder, such as \`C:\\CAD\\Tools\\<tool-name>\`.
2. In AutoCAD, run \`APPLOAD\`.
3. Browse to a \`.lsp\`, \`.vlx\`, or \`.fas\` file from this package and click **Load**.
4. Confirm a success message appears in the command line.

### Method 2: Startup Suite (auto-load each session)
1. Open \`APPLOAD\`.
2. In the **Startup Suite** section, click **Contents...** then **Add...**.
3. Select the main \`.lsp\`, \`.vlx\`, or \`.fas\` file from this package.
4. Restart AutoCAD and confirm it loads automatically.

### Method 3: Trusted Locations and SECURELOAD
1. Run \`OPTIONS\` and open the **Files** tab.
2. Add your tool folder under **Trusted Locations**.
3. Check \`SECURELOAD\` value and document expected setting:
- \`0\`: load any path (not recommended)
- \`1\`: warn before loading from untrusted paths
- \`2\`: block untrusted paths
4. If scripts are blocked, move files to a trusted location and reload.

### Method 4: Autoload via acad.lsp or acaddoc.lsp
1. Decide scope:
- \`acad.lsp\`: loaded once when AutoCAD starts.
- \`acaddoc.lsp\`: loaded for each opened drawing.
2. Place your loader file in a trusted support path.
3. Add an entry such as \`(load "your-loader-file")\` to the selected startup file.
4. Restart AutoCAD and verify functions are available.

## How to run commands / functions
- [Placeholder: Document command names, function calls, and sample usage]

## Verification
- [Placeholder: Describe expected command-line output or UI result]

## Troubleshooting
- If AutoCAD refuses to load the file, confirm \`SECURELOAD\` and Trusted Locations settings.
- If Windows marks files as blocked, open file properties and click **Unblock** (if shown).
- If \`(load ...)\` fails, verify the support path and file name spelling.
- If symbols are undefined, check that dependent LISP files were loaded first.
`,
  'AutoCAD Script (.SCR)': `# AutoCAD Script Installation Guide

## Supported AutoCAD versions
- [Placeholder: List tested AutoCAD versions]

## Files in this package
${FILES_IN_PACKAGE_PLACEHOLDER}

## Run script with SCRIPT command
1. Copy script files to a local folder with a stable path.
2. Open the target drawing in AutoCAD.
3. Run \`SCRIPT\`.
4. Select the \`.scr\` file and allow it to run to completion.

## Notes on relative paths and drawing state
- Use absolute paths in script steps when possible.
- If relative paths are required, launch AutoCAD with the expected working directory.
- Ensure required layers, UCS, units, or model/paper space context are set before execution.
- [Placeholder: List preconditions this script expects]

## Optional: bind script to a button or macro
1. Open \`CUI\`.
2. Create a command that calls your script (for example via a macro).
3. Add the command to ribbon, toolbar, or quick access toolbar.
4. Save and test from a clean drawing.

## Verification
- [Placeholder: What should be visible or changed when script finishes]

## Troubleshooting
- If execution stops, check for unresolved prompts in the command sequence.
- Ensure every prompt input is supplied in the script with proper line breaks.
- Avoid interactive commands that require manual selection unless explicitly scripted.
- Run against a copy of the drawing until behavior is validated.
`,
  'AutoCAD CUIX Customization': `# AutoCAD CUIX Customization Guide

## Supported AutoCAD versions
- [Placeholder: List tested AutoCAD versions]

## Files in this package
${FILES_IN_PACKAGE_PLACEHOLDER}

## Import partial customization via CUI
1. Copy the \`.cuix\` file to a local trusted location.
2. Run \`CUI\`.
3. In **Customizations In All Files**, right-click and choose **Load Partial Customization File**.
4. Select the package \`.cuix\` file and apply changes.

## Enterprise CUIX vs partial CUIX notes
- **Enterprise CUIX** is centrally managed and can lock down UI behavior.
- **Partial CUIX** is user-level and safer for distributing tool-specific commands.
- If enterprise policies exist, verify your partial CUIX does not conflict with locked elements.

## Assign commands to ribbon/toolbars
1. In \`CUI\`, locate commands/workspaces from the loaded partial CUIX.
2. Drag commands into ribbon panels, toolbars, or menus.
3. Save customization and switch workspace if needed.
4. Confirm icons/macros resolve correctly.

## Verification
- [Placeholder: List the ribbon tab/panel/toolbar elements expected after import]

## Troubleshooting
- If UI changes do not appear, run \`CUI\` and confirm the partial CUIX is loaded.
- If workspace does not refresh, switch workspaces or reload AutoCAD profile.
- If commands are missing, check command names/macros inside the imported CUIX.
- If enterprise CUIX overrides settings, coordinate with CAD admin policy.
`,
  'Generic (no template)': `# Installation Guide

## Purpose
- [Placeholder: Describe what this tool does]

## Files in this package
${FILES_IN_PACKAGE_PLACEHOLDER}

## Prerequisites
- [Placeholder: Required software, versions, permissions]

## Install
1. [Placeholder: Step 1]
2. [Placeholder: Step 2]
3. [Placeholder: Step 3]

## Verify
- [Placeholder: How to confirm installation worked]

## Rollback
- [Placeholder: How to safely undo this installation]
`,
};

const filesSectionHeading = /^## Files in this package\s*$/im;

const renderFileList = (fileNames: string[]): string => {
  if (fileNames.length === 0) {
    return EMPTY_FILES_LINE;
  }

  return fileNames.map((fileName) => `- \`${fileName}\``).join('\n');
};

export const applyPackageFilesToInstructions = (instructionsMd: string, fileNames: string[]): string => {
  const fileList = renderFileList(fileNames);

  if (instructionsMd.includes(FILES_IN_PACKAGE_PLACEHOLDER)) {
    return instructionsMd.replaceAll(FILES_IN_PACKAGE_PLACEHOLDER, fileList);
  }

  if (filesSectionHeading.test(instructionsMd)) {
    return instructionsMd.replace(filesSectionHeading, (heading) => `${heading}\n${fileList}`);
  }

  return `${instructionsMd.trimEnd()}\n\n## Files in this package\n${fileList}\n`;
};
