import { Request, Response, NextFunction } from 'express';

const allowedDomains = ['localhost', 'dopecuts.ca'];

export const authGuard = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.get('origin'); // e.g., 'https://dopecuts.ca'
    
    if (origin) {
        const hostname = new URL(origin).hostname; // e.g., 'dopecuts.ca'
        if (allowedDomains.some(domain => hostname.includes(domain))) {
            return next();
        }
    }

    // Allow requests without an origin (e.g. from Postman, curl) for testing
    if (!origin) {
        return next();
    }
    
    return res.status(403).json({ message: 'Forbidden: Access denied' });
};