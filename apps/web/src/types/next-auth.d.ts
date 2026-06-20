import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'owner' | 'admin' | 'agent';
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'owner' | 'admin' | 'agent';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'owner' | 'admin' | 'agent';
  }
}
