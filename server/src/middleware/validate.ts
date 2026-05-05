import { ZodSchema } from 'zod'
import { Request, Response, NextFunction } from 'express'

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source])
      req[source] = data
      next()
    } catch (error: any) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors?.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      })
    }
  }
}
