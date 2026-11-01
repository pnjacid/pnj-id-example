import { randomBytes } from 'node:crypto';

export function sessionStore(redis, secure) {
  const name = secure ? '__Host-pnj_session' : 'pnj_session';
  const attributes = `HttpOnly; SameSite=Lax; Path=/${secure ? '; Secure' : ''}`;
  function id(request) {
    const value = (request.headers.cookie ?? '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
    return /^[A-Za-z0-9_-]{43}$/.test(value ?? '') ? value : undefined;
  }
  return {
    async read(request, consume = false) {
      const value = id(request);
      if (!value) return;
      const key = `pnj:session:${value}`;
      const data = consume ? await redis.getDel(key) : await redis.get(key);
      return data ? JSON.parse(data) : undefined;
    },
    async destroy(request, response) {
      const value = id(request);
      if (value) await redis.del(`pnj:session:${value}`);
      response.setHeader('set-cookie', `${name}=; ${attributes}; Max-Age=0`);
    },
    async create(response, data, ttl) {
      const value = randomBytes(32).toString('base64url');
      await redis.set(`pnj:session:${value}`, JSON.stringify(data), { EX: ttl });
      response.setHeader('set-cookie', `${name}=${value}; ${attributes}; Max-Age=${ttl}`);
    }
  };
}
