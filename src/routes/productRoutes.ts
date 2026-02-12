// src/routes/productRoutes.ts
import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProducts,
  restoreProduct,
  updateProduct,
  updateStock,
} from "../controllers/productController.js";

const router = Router();

router.post("/", createProduct); // POST /api/products
router.get("/", getProducts); // GET /api/products
router.patch("/:id", updateProduct); // PATCH /api/products/ID_DEL_PRODUCTO. Actualiza datos generales del producto (nombre, descripción, marca, categoría)
router.patch("/variants/:id/stock", updateStock); // PATCH /api/products/variants/:id/stock - Actualizar stock de una variante específica
router.delete("/:id", deleteProduct); // DELETE /api/products/ID_DEL_PRODUCTO
router.patch("/:id/restore", restoreProduct); // PATCH /api/products/ID_DEL_PRODUCTO/restore. Restaura un producto eliminado lógicamente

export default router;
