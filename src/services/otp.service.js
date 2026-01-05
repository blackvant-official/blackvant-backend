import bcrypt from "bcrypt";
import crypto from "crypto";

const OTP_EXPIRY_MINUTES = 10;
const SALT_ROUNDS = 10;

export function generateOtp() {
  return crypto.randomInt(100000, 999999).toString();
}

export async function hashOtp(otp) {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

export function getOtpExpiry() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}
