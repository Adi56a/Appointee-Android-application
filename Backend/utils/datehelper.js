function getISTStartOfDay() {
  const now = new Date();

  // IST offset = +5:30
  const istOffset = 5.5 * 60 * 60 * 1000;

  const istTime = new Date(now.getTime() + istOffset);
  istTime.setHours(0, 0, 0, 0);

  return istTime;
}