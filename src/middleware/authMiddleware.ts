//revisará si el usuario tiene el token antes de dejarlo pasar a las rutas de ventas o stock
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "clave_super_secreta_123";

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // El formato es "Bearer TOKEN"

  if (!token)
    return res.status(401).json({ error: "Acceso denegado. No hay token." });

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err)
      return res.status(403).json({ error: "Token inválido o expirado." });
    (req as any).user = user;
    next(); // Si todo está bien, lo deja pasar a la ruta
  });
};
