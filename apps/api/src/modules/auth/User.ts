export type User = {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  cref: string;
  signatureUrl: string | null;
  createdAt: Date;
};
