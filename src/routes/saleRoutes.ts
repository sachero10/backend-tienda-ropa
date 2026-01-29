import { Router } from "express";
import {
  createSale,
  getSales,
  getSalesReport,
} from "../controllers/saleController.js";

const router = Router();

router.post("/", createSale);
router.get("/", getSales);
router.get("/report", getSalesReport); // Ruta: GET /api/sales/report

export default router;
