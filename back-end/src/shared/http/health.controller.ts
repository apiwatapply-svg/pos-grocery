import type { RequestHandler } from "express";

export const getHealth: RequestHandler = (_request, response) => {
  response.json({
    success: true,
    data: {
      service: "pos-grocery-api",
      status: "ok",
    },
  });
};
