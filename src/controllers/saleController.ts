import type { Request, Response } from "express";
import { Op } from "sequelize";
import sequelize from "../db.js";
import { Product, Sale, SaleItem, Variant, SalePayment } from "../models.js";

export const createSale = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();

  try {
    const { total, items, payments } = req.body;
    // 'payments' ahora es un array: [{method: 'Efectivo', amount: 5000}, {method: 'Tarjeta', amount: 7000}]

    // 1. VALIDACIÓN: Que la suma de pagos coincida con el total
    const totalPaid = payments.reduce(
      (acc: number, p: any) => acc + Number(p.amount),
      0,
    );
    if (Math.abs(totalPaid - total) > 0.01) {
      // Usamos margen por decimales
      throw new Error(
        "La suma de los pagos no coincide con el total de la venta",
      );
    }

    // 2. Creamos la cabecera de la venta (ya sin paymentMethod único)
    const sale = (await Sale.create({ total }, { transaction: t })) as any;

    // 3. Procesamos los Pagos (Múltiples)
    for (const p of payments) {
      await SalePayment.create(
        {
          saleId: sale.id,
          method: p.method,
          amount: p.amount,
        },
        { transaction: t },
      );
    }

    // 4. Procesamos los Artículos y Restamos Stock
    for (const item of items) {
      const { variantId, quantity, priceAtSale } = item;

      const variant = await Variant.findByPk(variantId);
      if (!variant || (variant as any).stock < quantity) {
        throw new Error(
          `Stock insuficiente para el SKU: ${(variant as any)?.sku || variantId}`,
        );
      }

      await Variant.update(
        { stock: (variant as any).stock - quantity },
        { where: { id: variantId }, transaction: t },
      );

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

    await t.commit();
    res
      .status(201)
      .json({ message: "Venta registrada con éxito", saleId: sale.id });
  } catch (error: any) {
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
    const startDate = new Date(`${start}T00:00:00.000Z`);
    const endDate = new Date(`${end}T23:59:59.999Z`);

    const sales = await Sale.findAll({
      where: { createdAt: { [Op.between]: [startDate, endDate] } },
      include: [
        { model: SalePayment, as: "payments" }, // Incluimos los pagos
        {
          model: SaleItem,
          as: "items",
          include: [{ model: Variant, include: [Product] }],
        },
      ],
    });

    // Calculamos totales por método
    const summaryMethods: any = {};
    sales.forEach((sale: any) => {
      sale.payments.forEach((p: any) => {
        summaryMethods[p.method] =
          (summaryMethods[p.method] || 0) + Number(p.amount);
      });
    });

    res.json({
      period: { start, end },
      totalRevenue: sales.reduce((acc, s: any) => acc + Number(s.total), 0),
      byMethod: summaryMethods, // Ejemplo: { Efectivo: 50000, Tarjeta: 30000 }
      sales,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al generar reporte" });
  }
};
