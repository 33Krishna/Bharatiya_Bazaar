import { Request, Response, NextFunction } from "express";
import { AnyZodObject } from "zod";

export default function validate(schema: AnyZodObject) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (err) {
      next(err); // Pass to errorMiddleware
    }
  };
}
