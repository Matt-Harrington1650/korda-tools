type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
};

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={className}>
      <p className="kt-title-sm">{label}</p>
      <div className="mt-2 flex rounded-[var(--kt-radius-sm)] border border-[color:var(--kt-border)] p-1">
        {options.map((option) => (
          <button
            key={option.value}
            className={[
              'flex-1 rounded-[calc(var(--kt-radius-sm)-4px)] px-3 py-1.5 text-xs font-semibold transition',
              value === option.value
                ? 'bg-[color:var(--kt-accent)] text-white'
                : 'text-[color:var(--kt-text-secondary)] hover:bg-[color:var(--kt-accent-soft)]',
            ].join(' ')}
            onClick={() => {
              onChange(option.value);
            }}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

