import type { Request, Response } from "express";
import { Op } from "sequelize";
import sequelize from "../db.js";
import { Product, Sale, SaleItem, Variant, SalePayment } from "../models.js";

export const createSale = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();

  try {
    // LOG DE SEGURIDAD: Para ver exactamente qué manda el frontend
    console.log("BODY RECIBIDO:", JSON.stringify(req.body, null, 2));

    // Forzamos que los valores sean números desde el inicio
    const total = Number(req.body.total);
    const discount = Number(req.body.discount || 0);
    const { items, payments } = req.body;

    // --- LOGS DE DEPURACIÓN (Míralos en el Dashboard de Render) ---
    console.log("--- NUEVA VENTA ---");
    console.log("Total recibido:", total);
    console.log("Descuento recibido:", discount);

    // 1. VALIDACIÓN: Pagos vs Total
    const totalPaid = payments.reduce(
      (acc: number, p: any) => acc + Number(p.amount),
      0,
    );

    if (Math.abs(totalPaid - total) > 0.01) {
      throw new Error(
        `Los pagos (${totalPaid}) no coinciden con el total (${total})`,
      );
    }

    // 2. VALIDACIÓN: Integridad de Productos vs Total + Descuento
    const sumItems = items.reduce(
      (acc: number, item: any) =>
        acc + Number(item.priceAtSale) * item.quantity,
      0,
    );

    // El cálculo correcto: Lo que valen los productos menos el descuento debe ser igual al total enviado
    const expectedTotal = Number((sumItems - discount).toFixed(2));
    const receivedTotal = Number(total.toFixed(2));

    console.log("Suma de productos (sin desc):", sumItems);
    console.log("Total esperado (Suma - Desc):", expectedTotal);

    if (Math.abs(expectedTotal - receivedTotal) > 0.01) {
      throw new Error(
        `Error de integridad: El total esperado era ${expectedTotal} pero se recibió ${receivedTotal}`,
      );
    }

    // 3. Crear la Venta
    const sale = (await Sale.create(
      { total, discount },
      { transaction: t },
    )) as any;

    // 4. Procesar Pagos
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

    // 5. Artículos y Stock
    for (const item of items) {
      const { variantId, quantity, priceAtSale } = item;
      const variant = await Variant.findByPk(variantId);

      if (!variant || (variant as any).stock < quantity) {
        throw new Error(`Stock insuficiente para variante: ${variantId}`);
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
    console.error("ERROR EN VENTA:", error.message); // Esto saldrá en Render
    res
      .status(400)
      .json({ error: error.message || "Error al procesar la venta" });
  }
};

export const getSales = async (req: Request, res: Response) => {
  try {
    const sales = await Sale.findAll({
      include: [
        {
          model: SalePayment,
          as: "payments",
        },
        {
          model: SaleItem,
          as: "items",
          include: [
            {
              model: Variant,
              include: [{ model: Product }], // Para saber el nombre de la prenda vendida
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]], // Las más nuevas primero
    });
    console.log(`Ventas encontradas: ${sales.length}`); // Log para depurar en Render
    res.json(sales);
  } catch (error) {
    console.error("ERROR EN GET_SALES:", error);
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
