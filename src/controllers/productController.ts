// src/controllers/productController.ts
import sequelize from "../db.js";
import { Op } from "sequelize";
import type { Request, Response } from "express";
import { Product, Variant } from "../models.js";

// Función auxiliar para generar SKU si viene vacío
const generateSKU = (productName: string, size: string, color: string) => {
  const cleanName = productName.substring(0, 3).toUpperCase();
  const cleanSize = size.toUpperCase();
  const cleanColor = color.substring(0, 3).toUpperCase();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${cleanName}-${cleanSize}-${cleanColor}-${random}`; // EJ: REM-L-ROJ-4821
};

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
      // Usamos Op.or para buscar en nombre, marca del producto o SKU de la variante
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { brand: { [Op.iLike]: `%${search}%` } },
        { "$variants.sku$": { [Op.iLike]: `%${search}%` } },
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
          required: false, // Esto permite que si buscás por marca, el producto aparezca aunque no coincida el SKU
        },
      ],
      subQuery: false, // Obligatorio para que el limit y el filtrado por asociación no rompan la query
    });

    res.json(products);
  } catch (error) {
    console.error("ERROR EN GET_PRODUCTS:", error);
    res.status(500).json({ error: "Error al obtener productos" });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  const { id } = req.params;

  try {
    const { name, description, brand, category, variants } = req.body;

    // 1. Verificar que el producto exista (incluso si está borrado lógicamente, por si queremos restaurar al editar)
    const product = await Product.findByPk(id, { paranoid: false });

    if (!product) {
      await t.rollback();
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    // 2. Actualizar datos del Padre (Producto)
    await product.update(
      { name, description, brand, category },
      { transaction: t },
    );

    // 3. Procesar las Variantes (Hijos)
    if (variants && Array.isArray(variants)) {
      for (const v of variants) {
        // Lógica de SKU: Si viene vacío, lo generamos. Si viene, lo usamos.
        const skuFinal =
          v.sku && v.sku.trim() !== ""
            ? v.sku
            : generateSKU(name, v.size, v.color);

        if (v.id) {
          // A) Si tiene ID, es una variante existente -> ACTUALIZAR
          const variantToUpdate = await Variant.findByPk(v.id);
          if (variantToUpdate) {
            await variantToUpdate.update(
              {
                size: v.size,
                color: v.color,
                costPrice: v.costPrice,
                sellPrice: v.sellPrice,
                stock: v.stock, // Aquí permitimos corregir el stock manual
                sku: skuFinal,
              },
              { transaction: t },
            );
          }
        } else {
          // B) Si NO tiene ID, es una variante nueva -> CREAR
          await Variant.create(
            {
              productId: id, // Vinculamos al padre
              size: v.size,
              color: v.color,
              costPrice: v.costPrice,
              sellPrice: v.sellPrice,
              stock: v.stock,
              sku: skuFinal,
            },
            { transaction: t },
          );
        }
      }
    }

    await t.commit();
    res.json({ message: "Producto actualizado correctamente", product });
  } catch (error: any) {
    await t.rollback();
    console.error("Error al actualizar producto:", error);
    res.status(500).json({ error: "Error al actualizar el producto" });
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
