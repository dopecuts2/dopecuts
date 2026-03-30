import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';

type ManageIdentity = { phone?: string; email?: string };

const DEFAULT_TTL_MIN = 15; // 15 minutes

export function signManageToken(identity: ManageIdentity, ttlMinutes = DEFAULT_TTL_MIN) {
  const payload = { ...identity, typ: 'manage' as const };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${ttlMinutes}m` });
}

export function verifyManageToken(token: string): ManageIdentity | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ManageIdentity & { typ?: string };
    if (decoded && decoded.typ === 'manage' && (decoded.phone || decoded.email)) {
      return { phone: decoded.phone, email: decoded.email };
    }
    return null;
  } catch {
    return null;
  }
}

export function readManageTokenFromReq(req: any): string | null {
  const h = req.headers?.authorization || req.get?.('authorization');
  if (h && typeof h === 'string' && h.toLowerCase().startsWith('bearer ')) {
    return h.slice(7).trim();
  }
  if (req.body?.manageToken && typeof req.body.manageToken === 'string') {
    return req.body.manageToken.trim();
  }
  return null;
}
