export async function parseApiError(response: Response, fallback: string): Promise<Error> {
  try {
    const text = await response.text();
    if (!text) return new Error(fallback);
    const data = JSON.parse(text);
    if (response.status === 403 && data?.code === 'PREMIUM_REQUIRED') {
      return new Error('Premium required');
    }
    return new Error(data?.error || data?.message || fallback);
  } catch {
    return new Error(fallback);
  }
}

