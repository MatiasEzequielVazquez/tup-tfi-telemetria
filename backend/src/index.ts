import express from 'express';
import { crearSql } from './db.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL en backend/.env');
  process.exit(1);
}

const sql = crearSql(url);
const app = express();

// Chequeo de salud: confirma que la API está viva y llega a la base.
app.get('/health', async (_req, res) => {
  try {
    const [fila] = await sql<{ unidades: number }[]>`select count(*)::int as unidades from unidades`;
    res.json({ status: 'ok', db: 'ok', unidades: fila?.unidades ?? 0 });
  } catch (e) {
    res.status(503).json({ status: 'error', db: (e as Error).message });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`API en http://localhost:${port}`));