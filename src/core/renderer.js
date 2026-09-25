import ejs from 'ejs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIEWS_DIR = path.join(__dirname, '../../views');

export class Renderer {
  static async render(res, viewName, data = {}, statusCode = 200) {
    const viewPath = path.join(VIEWS_DIR, `${viewName}.ejs`);
    try {
      const html = await ejs.renderFile(viewPath, data);
      res.writeHead(statusCode, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(html)
      });
      res.end(html);
    } catch (error) {
      console.error(error);
      const fallbackHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Erreur</title></head><body><h1>Erreur interne du serveur (500)</h1><p>${error.message}</p></body></html>`;
      res.writeHead(500, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(fallbackHtml)
      });
      res.end(fallbackHtml);
    }
  }
}