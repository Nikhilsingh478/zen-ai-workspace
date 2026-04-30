import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-6 mb-10">
      <div>
        <h1 className="text-[28px] md:text-[34px] font-semibold tracking-tight leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm text-secondary">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}