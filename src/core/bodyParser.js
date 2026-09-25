export const parseBody = (req) => {
  return new Promise((resolve) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      req.body = {};
      return resolve(req.body);
    }

    let rawData = '';
    req.on('data', (chunk) => {
      rawData += chunk.toString();
    });

    req.on('end', () => {
      const contentType = req.headers['content-type'] || '';

      if (contentType.includes('application/json')) {
        try {
          req.body = rawData ? JSON.parse(rawData) : {};
        } catch {
          req.body = {};
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(rawData);
        req.body = Object.fromEntries(params.entries());
      } else {
        req.body = rawData;
      }

      resolve(req.body);
    });

    req.on('error', () => {
      req.body = {};
      resolve(req.body);
    });
  });
};