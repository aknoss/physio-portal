export type Schedule = {
  patientId: string;
  weekdays: number[];
  startDate: string;
  endDate: string | null;
};
