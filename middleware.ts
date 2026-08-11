export const config = {
  matcher: '/:path*',
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export default function middleware(request: Request) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;

  // If credentials aren't configured, don't lock everyone out.
  if (!expectedUser || !expectedPass) {
    return;
  }

  const authHeader = request.headers.get('authorization');

  if (authHeader?.startsWith('Basic ')) {
    try {
      const decoded = atob(authHeader.slice(6));
      const separatorIndex = decoded.indexOf(':');
      const user = decoded.slice(0, separatorIndex);
      const pass = decoded.slice(separatorIndex + 1);

      if (timingSafeEqual(user, expectedUser) && timingSafeEqual(pass, expectedPass)) {
        return; // Authorized, let the request through.
      }
    } catch {
      // fall through to 401
    }
  }

  return new Response('Kirjautuminen vaaditaan', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Turvajohto OS", charset="UTF-8"',
    },
  });
}
