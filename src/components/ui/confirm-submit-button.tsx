"use client";

import { useState } from "react";

export function ConfirmSubmitButton({
  confirmMessage,
  children,
  className = "text-xs text-red-600 hover:underline",
  disabled,
}: {
  confirmMessage: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <button
      type="submit"
      className={className}
      disabled={disabled || submitting}
      onClick={(e) => {
        if (!confirm(confirmMessage)) {
          e.preventDefault();
          return;
        }
        setSubmitting(true);
      }}
    >
      {children}
    </button>
  );
}
