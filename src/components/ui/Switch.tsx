/**
 * An on/off setting: a real checkbox with `role="switch"`, its label and a line under it. The
 * whole row toggles it (44px+ target).
 */
export function Switch({
  label,
  description,
  checked,
  disabled = false,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex min-h-14 items-center justify-between gap-4 rounded-2xl px-1 py-2 ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      }`}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15px] font-medium">{label}</span>
        {description && <span className="text-[13px] text-text-2">{description}</span>}
      </span>
      <span className="relative flex-none">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="flex h-7 w-12 items-center rounded-full bg-line-3 p-0.5 transition-colors peer-checked:bg-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus [&>span]:transition-transform peer-checked:[&>span]:translate-x-5 rtl:peer-checked:[&>span]:-translate-x-5"
        >
          <span className="size-6 rounded-full bg-surface shadow-sm" />
        </span>
      </span>
    </label>
  );
}
