"use client";

export function ConfirmSubmitButton({
  confirmMessage,
  children,
  className = "text-xs text-red-600 hover:underline",
}: {
  confirmMessage: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
