import { env } from '@/config/env';
import jwt from 'jsonwebtoken';
interface TokenPayload {
  userId: number;
  userType: 'Monk' | 'Donor';
}
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_TOKEN_SECRET, {
    expiresIn: env.JWT_ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
};
