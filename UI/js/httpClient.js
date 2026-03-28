/**
 * httpClient.js — All fetch calls in all files use this.
 * Headers: X-User-Email, X-User-Name. NEVER Authorization/Bearer.
 * Paths: always relative. NEVER absolute URLs.
 */

const SAFE_ORIGIN = window.location.origin;

class HttpClient {
  _headers() {
    return {
      'Content-Type': 'application/json',
      'X-User-Email': sessionStorage.getItem('blokhr_email') || '',
      'X-User-Name': sessionStorage.getItem('blokhr_name') || '',
    };
  }

  async get(path) {
    return this._req('GET', path);
  }

  async post(path, body) {
    return this._req('POST', path, body);
  }

  async put(path, body) {
    return this._req('PUT', path, body);
  }

  async patch(path, body) {
    return this._req('PATCH', path, body);
  }

  async delete(path) {
    return this._req('DELETE', path);
  }

  async _req(method, path, body) {
    if (path.startsWith('http')) {
      throw new Error('Absolute URLs are forbidden. Use relative paths only.');
    }
    const res = await fetch(path, {
      method,
      headers: this._headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw Object.assign(new Error(res.statusText), { status: res.status });
    }
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }
}

export const httpClient = new HttpClient();
export { SAFE_ORIGIN };
