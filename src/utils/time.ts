const timeUnits: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000
};

export function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }

  const rawAmount = match[1]!;
  const unit = match[2]!;
  return Number(rawAmount) * timeUnits[unit]!;
}

export function addDuration(date: Date, duration: string): Date {
  return new Date(date.getTime() + durationToMs(duration));
}
