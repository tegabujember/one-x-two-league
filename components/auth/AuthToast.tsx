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
        className={`rounded-2xl border px-4 py-3 text-center text-sm font-bold shadow-2xl backdrop-blur-xl ${
          toast.type === "success"
            ? "border-green-400/30 bg-green-500/20 text-green-100"
            : toast.type === "error"
              ? "border-red-400/30 bg-red-500/20 text-red-100"
              : toast.type === "warning"
                ? "border-yellow-400/30 bg-yellow-500/20 text-yellow-100"
                : "border-blue-400/30 bg-blue-500/20 text-blue-100"
        }`}
      >
        {toast.message}
      </div>
    </div>
  );
}