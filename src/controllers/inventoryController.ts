import type { Request, Response } from "express";
import { Op } from "sequelize";
import { Variant, Product } from "../models.js";

export const getLowStock = async (req: Request, res: Response) => {
  try {
    // Leemos el valor del .env, si no existe usamos 5 por defecto
    const threshold = Number(process.env.LOW_STOCK_THRESHOLD) || 5;

    const lowStockVariants = await Variant.findAll({
      where: {
        stock: {
          [Op.lte]: threshold, // Buscamos stock menor o igual al límite
        },
      },
      include: [{ model: Product }], // Incluimos el producto para saber el nombre
    });

    res.json({
      threshold,
      count: lowStockVariants.length,
      items: lowStockVariants,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener alerta de stock" });
  }
};
