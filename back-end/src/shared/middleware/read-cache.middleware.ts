import type { RequestHandler } from "express";

type CachedJsonResponse = {
  body: unknown;
  expiresAt: number;
  statusCode: number;
};

const defaultCacheTtlMs = 15000;
const readCache = new Map<string, CachedJsonResponse>();

function isCacheableGet(path: string) {
  return path.startsWith("/api/") && !path.endsWith(".xlsx");
}

function requestCacheKey(request: Parameters<RequestHandler>[0]) {
  const authorization = request.header("authorization") ?? "anonymous";

  return `${authorization}:${request.originalUrl}`;
}

export function clearReadCache() {
  readCache.clear();
}

export function clearReadCacheOnMutationMiddleware(): RequestHandler {
  return (request, _response, next) => {
    if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
      clearReadCache();
    }

    next();
  };
}

export function readCacheMiddleware(options?: { ttlMs?: number }): RequestHandler {
  const ttlMs = options?.ttlMs ?? defaultCacheTtlMs;

  return (request, response, next) => {
    if (request.method !== "GET") {
      next();
      return;
    }

    if (!isCacheableGet(request.originalUrl)) {
      next();
      return;
    }

    const cacheKey = requestCacheKey(request);
    const cachedResponse = readCache.get(cacheKey);

    if (cachedResponse && cachedResponse.expiresAt > Date.now()) {
      response.status(cachedResponse.statusCode).json(cachedResponse.body);
      return;
    }

    if (cachedResponse) {
      readCache.delete(cacheKey);
    }

    const originalJson = response.json.bind(response);

    response.json = ((body: unknown) => {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        readCache.set(cacheKey, {
          body,
          expiresAt: Date.now() + ttlMs,
          statusCode: response.statusCode,
        });
      }

      return originalJson(body);
    }) as typeof response.json;

    response.on("finish", () => {
      response.json = originalJson as typeof response.json;
    });

    next();
  };
}
