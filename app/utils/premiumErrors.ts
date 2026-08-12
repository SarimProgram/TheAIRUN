export async function parseApiError(response: Response, fallback: string): Promise<Error> {
  const statusSuffix = response.status ? ` (HTTP ${response.status})` : '';

  try {
    const text = await response.text();
    if (!text) return new Error(`${fallback}${statusSuffix}`);
    const data = JSON.parse(text);
    if (response.status === 403 && data?.code === 'PREMIUM_REQUIRED') {
      const accessStatus = data?.billing?.accessStatus;
      const reason = data?.paywallReason ?? data?.billing?.paywallReason;
      const context = [accessStatus, reason].filter(Boolean).join(', ');
      return new Error(`Premium verification failed${statusSuffix}${context ? `: ${context}` : ''}`);
    }
    const message = data?.error || data?.message || fallback;
    const code = data?.code ? ` [${data.code}]` : '';
    return new Error(`${message}${statusSuffix}${code}`);
  } catch {
    return new Error(`${fallback}${statusSuffix}`);
  }
}
