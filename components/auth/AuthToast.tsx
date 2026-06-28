"use client";

export type ToastType = "success" | "error" | "warning" | "info";

export type ToastState = {
  message: string;
  type: ToastType;
};

type AuthToastProps = {
  toast: ToastState | null;
};

export default function AuthToast({ toast }: AuthToastProps) {
  if (!toast) return null;

  return (
    <div className="fixed left-1/2 top-5 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
      <div
        className={`theme-feedback theme-feedback-toast rounded-2xl border px-4 py-3 text-center text-sm font-bold shadow-2xl backdrop-blur-xl ${
          toast.type === "success"
            ? "theme-feedback-success"
            : toast.type === "error"
              ? "theme-feedback-error"
              : toast.type === "warning"
                ? "theme-feedback-warning"
                : "theme-feedback-info"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}
