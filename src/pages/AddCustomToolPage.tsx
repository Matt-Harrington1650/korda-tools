import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { customToolsLibraryService } from '../features/customToolsLibrary/service';
import { CUSTOM_TOOL_ALLOWED_EXTENSIONS, MAX_FILE_SIZE_BYTES, MAX_TOTAL_VERSION_SIZE_BYTES } from '../features/customToolsLibrary/constants';
import { formatBytes, pickToolFiles, slugify, validateFileSelection, type SelectedToolFile } from '../features/customToolsLibrary/helpers';
import {
  applyPackageFilesToInstructions,
  TEMPLATE_OPTIONS,
  TOOL_INSTRUCTION_TEMPLATES,
  type TemplateOption,
} from '../features/customToolsLibrary/toolTemplates';

const stepTitles = ['Metadata', 'Template', 'Version', 'Files', 'Review'] as const;

export function AddCustomToolPage() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [category, setCategory] = useState('cad');
  const [tagsText, setTagsText] = useState('autocad');
  const [description, setDescription] = useState('');
  const [template, setTemplate] = useState<TemplateOption>('Generic (no template)');
  const [instructionsMd, setInstructionsMd] = useState(TOOL_INSTRUCTION_TEMPLATES['Generic (no template)']);
  const [version, setVersion] = useState('1.0.0');
  const [changelogMd, setChangelogMd] = useState('');
  const [files, setFiles] = useState<SelectedToolFile[]>([]);
  const [submitError, setSubmitError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedTags = useMemo(() => {
    return tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }, [tagsText]);

  const fileValidationErrors = useMemo(() => validateFileSelection(files), [files]);

  const nextStep = (): void => {
    if (stepIndex === 0) {
      const errors: string[] = [];
      if (!name.trim()) {
        errors.push('Name is required.');
      }
      if (!slug.trim()) {
        errors.push('Slug is required.');
      }
      if (!category.trim()) {
        errors.push('Category is required.');
      }
      if (!description.trim()) {
        errors.push('Description is required.');
      }
      setValidationErrors(errors);
      if (errors.length > 0) {
        return;
      }
    }

    if (stepIndex === 1) {
      if (!instructionsMd.trim()) {
        setValidationErrors(['Instructions markdown is required.']);
        return;
      }
    }

    if (stepIndex === 2) {
      if (!version.trim()) {
        setValidationErrors(['Version is required.']);
        return;
      }
    }

    if (stepIndex === 3) {
      if (fileValidationErrors.length > 0) {
        setValidationErrors(fileValidationErrors);
        return;
      }
    }

    setValidationErrors([]);
    setStepIndex((current) => Math.min(stepTitles.length - 1, current + 1));
  };

  const previousStep = (): void => {
    setValidationErrors([]);
    setStepIndex((current) => Math.max(0, current - 1));
  };

  const pickFiles = async (): Promise<void> => {
    setSubmitError('');

    try {
      const selected = await pickToolFiles({ multiple: true });
      if (selected.length === 0) {
        return;
      }

      const merged = [...files];
      const existing = new Set(merged.map((file) => file.originalName.toLowerCase()));
      selected.forEach((file) => {
        const key = file.originalName.toLowerCase();
        if (!existing.has(key)) {
          merged.push(file);
          existing.add(key);
        }
      });

      setFiles(merged);
      setValidationErrors(validateFileSelection(merged));
    } catch (pickError) {
      setSubmitError(pickError instanceof Error ? pickError.message : 'Failed to pick files.');
    }
  };

  const saveTool = async (): Promise<void> => {
    setSubmitError('');
    setValidationErrors([]);

    if (fileValidationErrors.length > 0) {
      setValidationErrors(fileValidationErrors);
      setStepIndex(3);
      return;
    }

    setIsSubmitting(true);

    try {
      const finalInstructionsMd = applyPackageFilesToInstructions(
        instructionsMd,
        files.map((file) => file.originalName),
      );

      const existing = await customToolsLibraryService.listTools({ query: slug.trim() });
      const existingBySlug = existing.find((tool) => tool.slug.toLowerCase() === slug.trim().toLowerCase());

      if (existingBySlug) {
        const added = await customToolsLibraryService.addToolVersion({
          toolId: existingBySlug.id,
          version: version.trim(),
          changelogMd: changelogMd.trim() || undefined,
          instructionsMd: finalInstructionsMd,
          files: files.map((file) => ({
            originalName: file.originalName,
            mime: file.mime,
            dataBase64: file.dataBase64,
          })),
        });

        navigate(`/tools/${added.toolId}`);
        return;
      }

      const created = await customToolsLibraryService.createTool({
        metadata: {
          name: name.trim(),
          slug: slug.trim(),
          category: category.trim(),
          description: description.trim(),
          tags: parsedTags,
        },
        version: version.trim(),
        changelogMd: changelogMd.trim() || undefined,
        instructionsMd: finalInstructionsMd,
        files: files.map((file) => ({
          originalName: file.originalName,
          mime: file.mime,
          dataBase64: file.dataBase64,
        })),
      });

      navigate(`/tools/${created.toolId}`);
    } catch (saveError) {
      setSubmitError(saveError instanceof Error ? saveError.message : 'Failed to save tool package.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-5 rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Add Custom Tool</h2>
          <p className="mt-1 text-sm text-slate-600">Create a versioned tool package with installation instructions and file attachments.</p>
        </div>
        <Link className="text-sm font-medium text-slate-700 hover:text-slate-900" to="/tools">
          Back to Tools Library
        </Link>
      </div>

      <ol className="grid gap-2 md:grid-cols-5">
        {stepTitles.map((title, index) => (
          <li
            className={`rounded border px-3 py-2 text-sm ${
              index === stepIndex ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
            key={title}
          >
            {index + 1}. {title}
          </li>
        ))}
      </ol>

      {stepIndex === 0 ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  const nextName = event.target.value;
                  setName(nextName);
                  if (!slugTouched) {
                    setSlug(slugify(nextName));
                  }
                }}
                value={name}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Slug</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                value={slug}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Category</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  setCategory(event.target.value);
                }}
                value={category}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Tags</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  setTagsText(event.target.value);
                }}
                placeholder="autocad, scripts"
                value={tagsText}
              />
            </label>
          </div>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              rows={4}
              value={description}
            />
          </label>
        </div>
      ) : null}

      {stepIndex === 1 ? (
        <div className="space-y-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Template</span>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              onChange={(event) => {
                const selectedTemplate = event.target.value as TemplateOption;
                setTemplate(selectedTemplate);
                setInstructionsMd(TOOL_INSTRUCTION_TEMPLATES[selectedTemplate]);
              }}
              value={template}
            >
              {TEMPLATE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Instructions Markdown</span>
            <textarea
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm"
              onChange={(event) => {
                setInstructionsMd(event.target.value);
              }}
              rows={16}
              value={instructionsMd}
            />
          </label>
        </div>
      ) : null}

      {stepIndex === 2 ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Version</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  setVersion(event.target.value);
                }}
                placeholder="1.0.0"
                value={version}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Changelog (optional)</span>
              <input
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                onChange={(event) => {
                  setChangelogMd(event.target.value);
                }}
                placeholder="Initial release"
                value={changelogMd}
              />
            </label>
          </div>
        </div>
      ) : null}

      {stepIndex === 3 ? (
        <div className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            Allowed extensions: {CUSTOM_TOOL_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(', ')}
            <br />
            Max file size: {formatBytes(MAX_FILE_SIZE_BYTES)}
            <br />
            Max total per version: {formatBytes(MAX_TOTAL_VERSION_SIZE_BYTES)}
          </div>

          <button
            className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            onClick={() => {
              void pickFiles();
            }}
            type="button"
          >
            Attach Files
          </button>

          {files.length === 0 ? <p className="text-sm text-slate-600">No files attached yet.</p> : null}
          {files.length > 0 ? (
            <ul className="space-y-2">
              {files.map((file) => (
                <li className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2" key={file.originalName}>
                  <span className="text-sm text-slate-700">
                    {file.originalName} ({formatBytes(file.sizeBytes)})
                  </span>
                  <button
                    className="rounded border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    onClick={() => {
                      setFiles((current) => current.filter((item) => item.originalName !== file.originalName));
                    }}
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {stepIndex === 4 ? (
        <div className="space-y-4 text-sm text-slate-700">
          <div className="rounded border border-slate-200 bg-slate-50 p-4">
            <p>
              <span className="font-medium text-slate-900">Name:</span> {name}
            </p>
            <p>
              <span className="font-medium text-slate-900">Slug:</span> {slug}
            </p>
            <p>
              <span className="font-medium text-slate-900">Category:</span> {category}
            </p>
            <p>
              <span className="font-medium text-slate-900">Tags:</span> {parsedTags.join(', ') || 'None'}
            </p>
            <p>
              <span className="font-medium text-slate-900">Version:</span> {version}
            </p>
            <p>
              <span className="font-medium text-slate-900">Template:</span> {template}
            </p>
            <p>
              <span className="font-medium text-slate-900">Files:</span> {files.length}
            </p>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
            <p className="mt-2 text-sm text-slate-700">{description}</p>
          </div>
        </div>
      ) : null}

      {validationErrors.length > 0 ? (
        <ul className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {validationErrors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {submitError ? <p className="text-sm text-rose-700">{submitError}</p> : null}

      <div className="flex items-center justify-between">
        <button
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          disabled={stepIndex === 0 || isSubmitting}
          onClick={previousStep}
          type="button"
        >
          Back
        </button>

        {stepIndex < stepTitles.length - 1 ? (
          <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800" onClick={nextStep} type="button">
            Next
          </button>
        ) : (
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-70"
            disabled={isSubmitting}
            onClick={() => {
              void saveTool();
            }}
            type="button"
          >
            {isSubmitting ? 'Saving...' : 'Save Tool'}
          </button>
        )}
      </div>
    </section>
  );
}
