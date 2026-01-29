import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models.js";

const JWT_SECRET = process.env.JWT_SECRET || "clave_super_secreta_123";

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    // Encriptamos la contraseña (10 rondas de salt)
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ username, password: hashedPassword });
    res.status(201).json({ message: "Usuario creado con éxito" });
  } catch (error) {
    res.status(500).json({ error: "Error al registrar usuario" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const user = (await User.findOne({ where: { username } })) as any;

    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    // Comparamos la contraseña escrita con la encriptada
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: "Contraseña incorrecta" });

    // Si es correcto, generamos el Token JWT (vence en 24h)
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "24h",
    });

    res.json({ message: "Login exitoso", token });
  } catch (error) {
    res.status(500).json({ error: "Error en el login" });
  }
};
