import jwt from "jsonwebtoken";
import { parseCookie } from "../controllers/httpUtils.js";

class AuthMiddleware {
  parseCookies(req, res, next) {
    req.cookies = parseCookie(req.headers.cookie);
    next();
  }

  verifyToken(req, res, next) {
    const token = req.cookies?.token;

    if (!token) {
      return res
        .status(401)
        .json({ message: "Acceso denegado. No se proporcionó un token." });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(403).json({ message: "Token inválido o expirado." });
    }
  }

  checkRole(...allowedRoles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ message: "No autenticado." });
      }

      if (!allowedRoles.includes(req.user.userLevel)) {
        return res.status(403).json({
          message: `Acceso denegado. Nivel requerido: ${allowedRoles.join(
            " o "
          )}. Su nivel: ${req.user.userLevel}`,
        });
      }

      next();
    };
  }
}

export default new AuthMiddleware();
