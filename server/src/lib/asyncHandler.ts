import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 ne transmet pas les rejets de promesse au middleware d'erreur.
 * Ce wrapper les capture et les passe à `next`, pour qu'une erreur imprévue
 * produise une réponse 500 au lieu d'abattre le processus.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
