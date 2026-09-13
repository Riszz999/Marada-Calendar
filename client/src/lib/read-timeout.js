// Bound data reads, including response parsing. Mutations are never retried here.
export async function withReadTimeout(operation, signal, timeoutMs = 15000) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try { return await operation(controller.signal); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
