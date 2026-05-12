export type Patient = {
  id: string;
  fullName: string;
  address: string;
  phone: string;
  sessionPriceCents: number;
  notes: string | null;
  active: boolean;
  createdAt: Date;
};
