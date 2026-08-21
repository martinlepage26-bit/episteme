import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

function cx(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-ink text-paper hover:bg-ink/85 disabled:bg-ink/40",
    secondary: "border border-ink/25 text-ink hover:bg-ink/5 disabled:opacity-40",
    ghost: "text-ink/70 hover:text-ink hover:bg-ink/5 disabled:opacity-40",
    danger: "border border-red-700/40 text-red-800 hover:bg-red-50 disabled:opacity-40",
  };
  return (
    <button
      className={cx(
        "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("rounded-md border border-ink/12 bg-white/60 p-4", className)}>{children}</div>;
}

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink/55" {...props} />;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "w-full rounded-sm border border-ink/20 bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-ink/35 focus:border-ink/50 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full rounded-sm border border-ink/20 bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-ink/35 focus:border-ink/50 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "w-full rounded-sm border border-ink/20 bg-white px-2.5 py-1.5 text-sm text-ink focus:border-ink/50 focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-sm border border-ink/20 px-1.5 py-0.5 font-mono text-[11px] text-ink/70",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-ink/20 p-6 text-center text-sm text-ink/45">{children}</p>;
}
