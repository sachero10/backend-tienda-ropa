// src/models.ts
import { DataTypes, Model } from "sequelize";
import sequelize from "./db.js";

// 1. PRODUCTO (La entidad general: Ej. Remera "Vintage")
export const Product = sequelize.define(
  "Product",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    brand: { type: DataTypes.STRING },
    category: { type: DataTypes.STRING },
  },
  {
    timestamps: true, // Agrega createdAt y updatedAt automáticamente
    paranoid: true, // Agrega deletedAt y no borra el registro
  },
);

// 2. VARIANTE (El stock real: Ej. Remera "Vintage" - Talle L - Color Rojo)
export const Variant = sequelize.define(
  "Variant",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    size: { type: DataTypes.STRING, allowNull: false }, // Talle
    color: { type: DataTypes.STRING, allowNull: false }, // Color
    costPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, // Precio costo
    sellPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 }, // Precio venta
    stock: { type: DataTypes.INTEGER, defaultValue: 0 }, // Cantidad disponible
    sku: { type: DataTypes.STRING, unique: true }, // Código único de barra/etiqueta
  },
  {
    timestamps: true, // Agrega createdAt y updatedAt automáticamente
    paranoid: true, // Agrega deletedAt y no borra el registro
  },
);

// 3. VENTA (Cabecera de la transacción)
export const Sale = sequelize.define("Sale", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  total: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, // Monto FINAL cobrado (ya con descuento aplicado)
  discount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

// 4. MÉTODOS DE PAGO POR VENTA
export const SalePayment = sequelize.define("SalePayment", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  method: {
    type: DataTypes.STRING,
    allowNull: false,
  }, // 'Efectivo', 'Tarjeta', 'Transferencia', etc.
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
});

// 5. DETALLE DE VENTA (Qué se llevó en cada venta)
export const SaleItem = sequelize.define("SaleItem", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  quantity: { type: DataTypes.INTEGER, allowNull: false },
  priceAtSale: { type: DataTypes.DECIMAL(10, 2), allowNull: false }, // Precio al que se vendió en ese momento
});

// 6. USUARIO (Para autenticación y roles)
export const User = sequelize.define("User", {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: "admin" }, // Por si después tenés 'empleado'
});

// --- RELACIONES (Asociaciones) ---

// Un Producto tiene muchas Variantes (Remera -> Talles/Colores)
Product.hasMany(Variant, { as: "variants", foreignKey: "productId" });
Variant.belongsTo(Product, { foreignKey: "productId" });

// Una Venta tiene muchos Items
Sale.hasMany(SaleItem, { as: "items", foreignKey: "saleId" });
SaleItem.belongsTo(Sale, { foreignKey: "saleId" });

// Un Item de venta pertenece a una Variante específica
Variant.hasMany(SaleItem, { foreignKey: "variantId" });
SaleItem.belongsTo(Variant, { foreignKey: "variantId" });

// Una Venta tiene muchos Pagos
Sale.hasMany(SalePayment, { as: "payments", foreignKey: "saleId" });
SalePayment.belongsTo(Sale, { foreignKey: "saleId" });

export default { Product, Variant, Sale, SaleItem, SalePayment };
