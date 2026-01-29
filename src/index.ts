// src/index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import sequelize from "./db.js";
import productRoutes from "./routes/productRoutes.js";
import saleRoutes from "./routes/saleRoutes.js";
import { getStats } from "./controllers/dashboardController.js";
import { getLowStock } from "./controllers/inventoryController.js";
import { register, login } from "./controllers/authController.js";
import { authenticateToken } from "./middleware/authMiddleware.js";

const app = express();
app.use(cors());
app.use(express.json());

// Rutas públicas
app.post("/api/auth/register", register);
app.post("/api/auth/login", login);

app.get("/health", (req, res) => {
  res.json({ status: "online", orm: "sequelize" });
});

// Rutas protegidas (Agregamos el middleware antes de las rutas)
app.use("/api/products", authenticateToken, productRoutes);
app.use("/api/sales", authenticateToken, saleRoutes);
app.get("/api/dashboard/stats", authenticateToken, getStats);
app.get("/api/inventory/low-stock", authenticateToken, getLowStock);

// Iniciar DB y Servidor
try {
  await sequelize.authenticate();
  console.log("✅ Conexión a Neon (Sequelize) exitosa.");
  // sync() crea las tablas si no existen
  await sequelize.sync({ alter: true });
  // await sequelize.sync({ force: true });
} catch (error) {
  console.error("❌ Error conectando a la DB:", error);
}

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});
