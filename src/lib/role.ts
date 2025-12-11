export type Role = 'admin' | 'user';

export function parseRole (role: string): Role {
  switch (role) {
    case 'admin':
      return 'admin';
    case 'user':
      return 'user';
    default:
      return 'user';
  }
}

export function formatRole (role: Role) {
  return role;
}
