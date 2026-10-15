import { request as httpRequest } from 'node:http';

// Test servers use OS-assigned ports, including ports blocked by the Fetch standard.
export function requestHttp(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: response.statusCode,
          headers: {
            get(name) {
              const value = response.headers[name.toLowerCase()];
              return Array.isArray(value) ? value.join(', ') : value ?? null;
            },
          },
          async json() { return JSON.parse(body); },
          async text() { return body; },
        });
      });
    });
    request.on('error', reject);
    if (options.body !== undefined) request.write(options.body);
    request.end();
  });
}
