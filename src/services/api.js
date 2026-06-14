const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

/**
 * Purpose:
 * Canonical API service for RailSentinel. It provides a small, reusable fetch
 * wrapper with timeout handling, JSON parsing, auth header injection, and
 * consistent error shaping for all frontend data access.
 *
 * Dependencies:
 * - browser fetch API
 * - AbortController for request timeout support
 * - Optional auth token/provider passed through configuration
 *
 * Props:
 * - baseUrl: API origin or relative base path
 * - getToken: optional function that returns a bearer token
 * - timeoutMs: optional request timeout override
 * - defaultHeaders: optional baseline headers merged into each request
 *
 * State:
 * - None persisted globally
 * - Each call creates isolated request state and AbortController instances
 */

class ApiError extends Error {
  constructor(message, { status = 0, body = null, url = '' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

function isPlainObject(value) {
  return Boolean(value) && Object.prototype.toString.call(value) === '[object Object]';
}

function joinUrl(baseUrl, path) {
  if (!baseUrl) {
    return path;
  }

  const base = String(baseUrl).replace(/\/+$/, '');
  const suffix = String(path ?? '').replace(/^\/+/, '');
  return suffix ? `${base}/${suffix}` : base;
}

async function readResponseBody(response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

function buildHeaders(defaultHeaders, token, extraHeaders, hasBody) {
  const headers = {
    ...defaultHeaders,
    ...(extraHeaders ?? {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (hasBody && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function normalizeRequestBody(body) {
  if (body == null) {
    return undefined;
  }

  if (typeof body === 'string' || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams || body instanceof ArrayBuffer) {
    return body;
  }

  if (isPlainObject(body) || Array.isArray(body)) {
    return JSON.stringify(body);
  }

  return body;
}

function createApiClient({ baseUrl = '', getToken = null, timeoutMs = DEFAULT_TIMEOUT_MS, defaultHeaders = {} } = {}) {
  async function request(path, options = {}) {
    const {
      method = 'GET',
      headers: requestHeaders,
      body,
      signal,
      timeout = timeoutMs,
      parseAs = 'json',
      credentials = 'same-origin',
    } = options;

    const controller = new AbortController();
    const timeoutId = Number.isFinite(timeout) && timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;
    const token = typeof getToken === 'function' ? await getToken() : null;
    const url = joinUrl(baseUrl, path);
    const hasBody = body !== undefined && body !== null && method !== 'GET' && method !== 'HEAD';
    const preparedBody = normalizeRequestBody(body);

    const mergedHeaders = buildHeaders(defaultHeaders, token, requestHeaders, hasBody);
    const signals = [controller.signal, signal].filter(Boolean);

    const abortListenerController = new AbortController();
    const combinedSignal = signals.length > 1
      ? (() => {
          const forwardAbort = () => abortListenerController.abort();
          for (const currentSignal of signals) {
            if (currentSignal.aborted) {
              abortListenerController.abort();
              break;
            }
            currentSignal.addEventListener('abort', forwardAbort, { once: true });
          }
          return abortListenerController.signal;
        })()
      : signals[0] ?? controller.signal;

    try {
      const response = await fetch(url, {
        method,
        headers: mergedHeaders,
        body: preparedBody,
        signal: combinedSignal,
        credentials,
      });

      const responseBody = parseAs === 'raw' ? response : await readResponseBody(response);

      if (!response.ok) {
        throw new ApiError(`Request failed with status ${response.status}`, {
          status: response.status,
          body: responseBody,
          url,
        });
      }

      return responseBody;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error?.name === 'AbortError') {
        throw new ApiError('Request timed out or was aborted', {
          status: 0,
          body: null,
          url,
        });
      }

      throw new ApiError(error?.message ?? 'Network request failed', {
        status: 0,
        body: null,
        url,
      });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  return {
    request,
    get: (path, options = {}) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options = {}) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' }),
  };
}

const api = createApiClient({
  baseUrl: typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_BASE_URL ?? '' : '',
});

export { ApiError, createApiClient };
export default api;
