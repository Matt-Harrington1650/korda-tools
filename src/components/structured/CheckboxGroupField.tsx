import type { ChangeEvent } from 'react';

export type CheckboxGroupOption = {
  value: string;
  label: string;
  description?: string;
};

type CheckboxGroupFieldProps = {
  legend: string;
  options: CheckboxGroupOption[];
  selectedValues: string[];
  onChange: (nextValues: string[]) => void;
  helperText?: string;
};

export function CheckboxGroupField({
  legend,
  options,
  selectedValues,
  onChange,
  helperText,
}: CheckboxGroupFieldProps) {
  const selected = new Set(selectedValues);

  const onToggle =
    (value: string) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      const next = new Set(selected);
      if (event.target.checked) {
        next.add(value);
      } else {
        next.delete(value);
      }
      onChange(Array.from(next));
    };

  return (
    <fieldset className="space-y-2">
      <legend className="kt-title-sm">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="kt-panel-muted flex cursor-pointer items-start gap-2 px-3 py-2 text-sm text-[color:var(--kt-text-secondary)]"
          >
            <input
              checked={selected.has(option.value)}
              className="kt-checkbox mt-0.5"
              onChange={onToggle(option.value)}
              type="checkbox"
            />
            <span>
              <span className="block font-medium text-[color:var(--kt-text-primary)]">{option.label}</span>
              {option.description ? <span className="block text-xs text-[color:var(--kt-text-muted)]">{option.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {helperText ? <p className="text-xs text-[color:var(--kt-text-muted)]">{helperText}</p> : null}
    </fieldset>
  );
}

