/**
 * Masks customer email for privacy protection.
 * e.g., honggildong@gmail.com -> ho*****g@gmail.com
 *       user@domain.com -> us**r@domain.com
 *       ab@domain.com -> a*@domain.com
 */
export function maskEmail(email?: string): string {
  if (!email) return '';
  const parts = email.trim().split('@');
  if (parts.length !== 2) return email;

  const [localPart, domain] = parts;

  if (localPart.length <= 2) {
    return `${localPart[0]}*@${domain}`;
  } else if (localPart.length <= 4) {
    return `${localPart[0]}**${localPart.slice(-1)}@${domain}`;
  } else {
    const visibleStart = localPart.slice(0, 2);
    const visibleEnd = localPart.slice(-1);
    const maskedLength = Math.min(Math.max(localPart.length - 3, 3), 5);
    const maskedMiddle = '*'.repeat(maskedLength);
    return `${visibleStart}${maskedMiddle}${visibleEnd}@${domain}`;
  }
}
