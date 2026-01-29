// src/db.ts
import { Sequelize } from "sequelize";
import "dotenv/config";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no definida en el .env");
}

// Neon requiere SSL, así de simple se configura en Sequelize:
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Necesario para Neon
    },
  },
  logging: false, // Para que no ensucie la consola con SQL
});

export default sequelize;
