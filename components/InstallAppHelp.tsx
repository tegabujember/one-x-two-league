"use client";

import { useSyncExternalStore } from "react";

function isStandaloneMode() {
  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function subscribeToDisplayModeChange(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia("(display-mode: standalone)");

  mediaQuery.addEventListener("change", onStoreChange);

  return () => {
    mediaQuery.removeEventListener("change", onStoreChange);
  };
}

function getShouldShowInstallHelp() {
  return !isStandaloneMode();
}

export default function InstallAppHelp() {
  const shouldShow = useSyncExternalStore(
    subscribeToDisplayModeChange,
    getShouldShowInstallHelp,
    () => false
  );

  if (!shouldShow) {
    return null;
  }

  return (
    <section
      aria-labelledby="install-app-heading"
      className="theme-feedback theme-feedback-install mt-5 rounded-2xl border p-4 text-right"
    >
      <h2
        id="install-app-heading"
        className="theme-install-heading text-sm font-black"
      >
        התקנת האפליקציה
      </h2>

      <div className="mt-2 space-y-2 text-xs leading-5">
        <p>
          באייפון: פתחו ב-Safari, לחצו על שיתוף ואז &quot;הוסף למסך
          הבית&quot;.
        </p>
        <p>
          באנדרואיד: פתחו ב-Chrome ובחרו &quot;התקן אפליקציה&quot; או
          &quot;הוסף למסך הבית&quot;.
        </p>
      </div>
    </section>
  );
}
