// src/controllers/productController.ts
import { Op } from "sequelize";
import type { Request, Response } from "express";
import { Product, Variant } from "../models.js";

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { name, description, brand, category, variants } = req.body;

    // 1. Creamos el producto base
    const product = (await Product.create({
      name,
      description,
      brand,
      category,
    })) as any;

    // 2. Si vienen variantes (talles/colores), las creamos asociadas al producto
    if (variants && variants.length > 0) {
      const variantsWithId = variants.map((v: any) => ({
        ...v,
        productId: product.id,
      }));
      await Variant.bulkCreate(variantsWithId);
    }

    res
      .status(201)
      .json({ message: "Producto cargado con éxito", productId: product.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al crear el producto" });
  }
};

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { search, category, brand } = req.query;
    const whereClause: any = {};

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { brand: { [Op.iLike]: `%${search}%` } },
        { "$variants.sku$": { [Op.iLike]: `%${search}%` } }, // Busca en el SKU de las variantes asociadas
      ];
    }

    if (category) whereClause.category = category;
    if (brand) whereClause.brand = brand;

    const products = await Product.findAll({
      where: whereClause,
      include: [
        {
          model: Variant,
          as: "variants",
        },
      ],
      // subQuery: false es VITAL cuando usamos 'where' con filtros de tablas asociadas
      subQuery: false,
    });

    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener productos" });
  }
};

export const updateStock = async (req: Request, res: Response) => {
  try {
    const { id } = req.params; // El ID de la variante
    const { quantity } = req.body; // La cantidad a SUMAR (ej: 10)

    const variant = await Variant.findByPk(id);

    if (!variant) {
      return res.status(404).json({ error: "Variante no encontrada" });
    }

    // Calculamos el nuevo stock sumando lo que ya había + lo nuevo
    const nuevoStock = (variant as any).stock + quantity;

    await variant.update({ stock: nuevoStock });

    res.json({
      message: "Stock actualizado con éxito",
      sku: (variant as any).sku,
      stockAnterior: (variant as any).stock - quantity,
      stockActual: nuevoStock,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar el stock" });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);

    if (!product) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    await product.destroy(); // Con paranoid: true, esto solo llena la columna deletedAt
    res.json({ message: "Producto eliminado lógicamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar el producto" });
  }
};

export const restoreProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // .restore() es el método de Sequelize para revertir el soft delete
    await Product.restore({ where: { id } });
    res.json({ message: "Producto restaurado correctamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al restaurar" });
  }
};
