export const DAY = 86_400_000;
export const localDate = (date: Date) =>
  new Date(date.getTime() + 390 * 60_000).toISOString().slice(0, 10);
export const localTime = (date: Date) =>
  new Date(date.getTime() + 390 * 60_000).toISOString().slice(11, 16);
export const dateStart = (date: string) => new Date(`${date}T00:00:00+06:30`);
export const donationDate = (row: {
  pickupTime: Date | null;
  dropoffTime: Date | null;
  createdAt: Date;
}) => row.pickupTime ?? row.dropoffTime ?? row.createdAt;
