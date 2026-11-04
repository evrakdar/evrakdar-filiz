export type JwtPayload = {
  sub: string;
  username: string;
  roles: string[];
  /** Filled by JwtAuthGuard from the database on every request; not trusted from the token. */
  departmentId?: string | null;
};

export type AuthenticatedRequest = {
  headers: {
    authorization?: string;
    [key: string]: string | string[] | undefined;
  };
  ip?: string;
  socket?: { remoteAddress?: string };
  user?: JwtPayload;
};

export type ChangePasswordDto = {
  currentPassword?: string;
  newPassword?: string;
};

export type LoginDto = {
  username?: string;
  password?: string;
};
