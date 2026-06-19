export function getSafeRedirect(value: string | null) {
  if (!value) return "/";

  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";

  return value;
}

export function getRedirectAfterLogin() {
  if (typeof window === "undefined") return "/";

  const params = new URLSearchParams(window.location.search);
  const nextFromUrl = params.get("next");
  const nextFromStorage = localStorage.getItem("redirect-after-login");

  const redirectAfterLogin = getSafeRedirect(nextFromUrl || nextFromStorage);

  localStorage.setItem("redirect-after-login", redirectAfterLogin);

  return redirectAfterLogin;
}

export function getGoogleCallbackUrl() {
  if (typeof window === "undefined") return "";

  const origin = window.location.origin;
  const redirectAfterLogin = getRedirectAfterLogin();

  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", redirectAfterLogin);

  return callbackUrl.toString();
}