// dopecuts-server/src/middleware/isAdmin.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';
import { Admin } from '../models/admin.model';

// Extend the Express Request type to include an 'admin' property
declare global {
  namespace Express {
    interface Request {
      admin?: any;
    }
  }
}

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. Please log in.' });
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    
    // Optional: Check if the admin still exists in the database
    const adminExists = await Admin.findById(decoded.id);
    if (!adminExists) {
      return res.status(401).json({ message: 'Admin not found. Authorization failed.' });
    }
    
    req.admin = decoded; // Attach admin payload to the request
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token. Please log in again.' });
  }
};