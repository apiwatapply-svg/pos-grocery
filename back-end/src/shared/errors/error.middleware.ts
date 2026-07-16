import type { ErrorRequestHandler } from "express";
import { AppError } from "./app-error.ts";

export const errorMiddleware: ErrorRequestHandler = (error, request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  // Log unexpected errors so they show up in Render logs.
  console.error("[errorMiddleware] unexpected error", {
    method: request.method,
    url: request.originalUrl ?? request.url,
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  response.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected server error.",
    },
  });
};
