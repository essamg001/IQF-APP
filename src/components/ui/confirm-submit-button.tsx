"use client";

import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { useTranslations } from "@/lib/i18n/locale-context";

/**
 * A submit button gated behind a confirmation -- deliberately NOT using the
 * browser's native window.confirm(). That used to gate every destructive
 * action in the app, but confirm() is silently suppressed or unsupported in
 * some real environments (kiosk tablets, embedded webviews, some in-app
 * browsers): it returns false/undefined with zero visible dialog, and the
 * button just looks completely dead with no error, no feedback, nothing.
 * Real-world evidence this actually happened, not just a theoretical risk:
 * confirmed live in this app's own sandboxed test browser AND independently
 * reported by the owner as several buttons "not working" throughout the app.
 *
 * The button itself is type="button", not type="submit" -- confirming in
 * the dialog calls form.requestSubmit() explicitly, which starts the
 * submission immediately and independently of this component's own
 * disabled state. That also closes a second, separate bug the previous
 * native-confirm() version had: setting `submitting` synchronously inside
 * the same click that was supposed to let the browser's default submit
 * action run could disable the button before that default action fired,
 * silently dropping the very first genuine click.
 */
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
  const [showConfirm, setShowConfirm] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const common = useTranslations().common;

  // `disabled` (typically the parent's useActionState `pending`) going back
  // to false is the real signal the submit settled -- whether it succeeded
  // or the server action returned a validation error. Without this, a
  // rejected submission (e.g. the "two different people" sign-off rule, or
  // any other early-return validation) left `submitting` stuck true forever
  // with no re-render to ever reset it, permanently dead-clicking the button
  // for the rest of that component's life.
  useEffect(() => {
    if (!disabled) setSubmitting(false);
  }, [disabled]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        disabled={disabled || submitting}
        onClick={() => setShowConfirm(true)}
      >
        {children}
      </button>
      {showConfirm && (
        <ConfirmDialog
          message={confirmMessage}
          confirmLabel={common.confirm}
          cancelLabel={common.cancel}
          onCancel={() => setShowConfirm(false)}
          onConfirm={() => {
            setShowConfirm(false);
            setSubmitting(true);
            buttonRef.current?.form?.requestSubmit();
          }}
        />
      )}
    </>
  );
}
