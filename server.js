import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.static("docs"));

const PORT = 3000;

// URL de la API externa que provee los partidos del Mundial 2026
const API_PARTIDOS = "https://worldcup26.ir/get/games";

// Endpoint propio: el navegador le pide los partidos a NUESTRO servidor,
// y nuestro servidor se los pide a la API externa.
// Esto evita problemas de CORS y nos permite normalizar los datos
// antes de mandarlos al frontend.
app.get("/api/partidos", async (req, res) => {
    try {
        const respuesta = await fetch(API_PARTIDOS);

        if (!respuesta.ok) {
            throw new Error(`La API externa respondió con estado ${respuesta.status}`);
        }

        const datos = await respuesta.json();

        res.json(datos);

    } catch (error) {
        console.error("Error obteniendo partidos de la API externa:", error.message);
        res.status(502).json({
            error: "No se pudieron obtener los partidos desde la API externa.",
            detalle: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
