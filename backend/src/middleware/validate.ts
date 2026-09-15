import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny } from "zod";

export function validate(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!result.success) {
      next(result.error);
      return;
    }
    const parsed = result.data as { body?: unknown; query?: unknown; params?: unknown };
    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.query !== undefined) req.query = parsed.query as never;
    if (parsed.params !== undefined) req.params = parsed.params as never;
    next();
  };
}
