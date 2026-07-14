function maskPhone(phone) {
  if (!phone) return phone;

  const digits = String(phone);
  if (digits.length <= 8) return '*'.repeat(digits.length);

  const start = digits.slice(0, 4);
  const end = digits.slice(-4);
  const middle = '*'.repeat(digits.length - 8);

  return `${start}${middle}${end}`;
}

module.exports = maskPhone;
