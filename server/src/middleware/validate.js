/** Zod-powered body/query validator. Usage: validate(schema) */
export const validate =
  (schema, source = 'body') =>
  (req, _res, next) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (e) {
      next(e);
    }
  };
