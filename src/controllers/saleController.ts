import type { Request, Response } from "express";
import { Op } from "sequelize";
import sequelize from "../db.js";
import { Product, Sale, SaleItem, Variant } from "../models.js";

export const createSale = async (req: Request, res: Response) => {
  // Usamos una "Transaction" para que si algo falla, no se guarde nada
  const t = await sequelize.transaction();

  try {
    const { total, paymentMethod, items } = req.body;

    // 1. Creamos la cabecera de la venta
    const sale = (await Sale.create(
      { total, paymentMethod },
      { transaction: t },
    )) as any;

    // 2. Procesamos cada artículo vendido
    for (const item of items) {
      const { variantId, quantity, priceAtSale } = item;

      // Buscamos la variante para ver si hay stock
      const variant = await Variant.findByPk(variantId);
      if (!variant || (variant as any).stock < quantity) {
        throw new Error(`Stock insuficiente para la variante ${variantId}`);
      }

      // Restamos el stock
      await Variant.update(
        { stock: (variant as any).stock - quantity },
        { where: { id: variantId }, transaction: t },
      );

      // Creamos el detalle de la venta
      await SaleItem.create(
        {
          saleId: sale.id,
          variantId,
          quantity,
          priceAtSale,
        },
        { transaction: t },
      );
    }

    // Si todo salió bien, confirmamos los cambios en la DB
    await t.commit();
    res
      .status(201)
      .json({ message: "Venta registrada con éxito", saleId: sale.id });
  } catch (error: any) {
    // Si algo falló, deshacemos todo lo que se intentó hacer
    await t.rollback();
    res
      .status(400)
      .json({ error: error.message || "Error al procesar la venta" });
  }
};

export const getSales = async (req: Request, res: Response) => {
  try {
    const sales = await Sale.findAll({
      // Incluimos los items de la venta y los detalles del producto/variante
      include: [
        {
          model: SaleItem,
          as: "items",
          include: [
            {
              model: Variant,
              include: [Product], // Para saber el nombre de la prenda vendida
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]], // Las más nuevas primero
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener historial" });
  }
};

export const getSalesReport = async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({
        error: "Es necesario proveer una fecha de inicio (start) y fin (end).",
      });
    }

    // Ajustamos las fechas para que tomen desde el primer segundo del inicio
    // hasta el último segundo del fin.
    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T23:59:59.999Z`);

    const sales = await Sale.findAll({
      where: {
        createdAt: {
          [Op.between]: [startDate, endDate],
        },
      },
      include: [
        {
          model: SaleItem,
          as: "items",
          include: [{ model: Variant, include: [Product] }],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    // Calculamos el resumen del periodo
    const totalPeriod = sales.reduce(
      (acc: number, sale: any) => acc + Number(sale.total),
      0,
    );

    res.json({
      period: { start, end },
      salesCount: sales.length,
      totalRevenue: totalPeriod,
      sales, // Enviamos el detalle de todas las ventas encontradas
    });
  } catch (error) {
    res.status(500).json({ error: "Error al generar el reporte de ventas." });
  }
};
