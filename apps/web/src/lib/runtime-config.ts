const valueOrDefault = (value: string | undefined, fallback: string): string =>
  value?.trim() || fallback;

export const runtimeConfig = {
  appName: valueOrDefault(process.env.NEXT_PUBLIC_APP_NAME, "LOVE Andaman"),
  environment: valueOrDefault(process.env.NEXT_PUBLIC_APP_ENV, "local"),
} as const;
