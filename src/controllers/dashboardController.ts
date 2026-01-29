import type { Request, Response } from "express";
import { Sale } from "../models.js";

export const getStats = async (req: Request, res: Response) => {
  try {
    const sales = await Sale.findAll();

    // Calculamos el total recaudado sumando todos los 'total' de las ventas
    const totalRevenue = sales.reduce(
      (acc: number, sale: any) => acc + Number(sale.total),
      0,
    );
    const totalSalesCount = sales.length;

    res.json({
      totalRevenue,
      totalSalesCount,
      currency: "ARS",
    });
  } catch (error) {
    res.status(500).json({ error: "Error al generar estadísticas" });
  }
};
