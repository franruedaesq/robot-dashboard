import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 8001;

// Enable CORS for all routes so the React app on :5173 can fetch the STLs
app.use(cors());

// Serve the directory where meshes are supposed to be as static files.
// We assume meshes will be placed inside src/assets/robots/
app.use('/', express.static(path.join(__dirname, 'src', 'assets', 'robots')));

app.listen(PORT, () => {
    console.log(`\n========================================================`);
    console.log(`🚀 Servidor Local de Meshes 3D encendido en http://localhost:${PORT}`);
    console.log(`========================================================`);
    console.log(`👉 IMPORTANTE: Para que tus archivos .urdf encuentren sus formas 3D (.stl/.dae)`);
    console.log(`   asegúrate de copiar la carpeta entera del robot (`);
    console.log(`   ej: turtlebot3_description) dentro de:`);
    console.log(`   📁 src/assets/robots/`);
    console.log(`========================================================\n`);
});
