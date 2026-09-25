import findMyWay from 'find-my-way';

export class Router {
  constructor(options = {}) {
    this.router = findMyWay({
      defaultRoute: options.defaultRoute || ((req, res) => {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Route non trouvée' }));
      })
    });
  }

  get(path, handler) {
    this.router.on('GET', path, (req, res, params) => {
      req.params = params;
      return handler(req, res);
    });
  }

  post(path, handler) {
    this.router.on('POST', path, (req, res, params) => {
      req.params = params;
      return handler(req, res);
    });
  }

  put(path, handler) {
    this.router.on('PUT', path, (req, res, params) => {
      req.params = params;
      return handler(req, res);
    });
  }

  delete(path, handler) {
    this.router.on('DELETE', path, (req, res, params) => {
      req.params = params;
      return handler(req, res);
    });
  }

  lookup(req, res) {
    const baseURL = `http://${req.headers.host || 'localhost'}`;
    const parsedUrl = new URL(req.url, baseURL);
    req.query = Object.fromEntries(parsedUrl.searchParams.entries());
    req.pathname = parsedUrl.pathname;
    this.router.lookup(req, res);
  }
}