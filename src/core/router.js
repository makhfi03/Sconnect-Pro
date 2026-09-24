export class Router {
  constructor() {
    this.routes = [];
  }

  addRoute(method, path, handler) {
    this.routes.push({ method, path, handler });
  }

  get(path, handler) { this.addRoute('GET', path, handler); }
  post(path, handler) { this.addRoute('POST', path, handler); }
  put(path, handler) { this.addRoute('PUT', path, handler); }
  delete(path, handler) { this.addRoute('DELETE', path, handler); }

  async handle(req, res) {
    const baseURL = `http://${req.headers.host || 'localhost'}`;
    const parsedUrl = new URL(req.url, baseURL);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    const route = this.routes.find(r => r.method === method && r.path === pathname);

    if (route) {
      req.query = Object.fromEntries(parsedUrl.searchParams.entries());
      await route.handler(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Route non trouvée' }));
    }
  }
}