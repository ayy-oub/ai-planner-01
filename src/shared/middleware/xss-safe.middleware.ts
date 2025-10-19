import xss from 'xss';

function sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;

    for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;

        const value = obj[key];

        if (typeof value === 'string') {
            obj[key] = xss(value);
        } else if (typeof value === 'object') {
            sanitizeObject(value); // recursive
        }
    }

    return obj;
}

// Middleware
export const xssSafeMiddleware = (req: any, res: any, next: any) => {
    if (req.body) sanitizeObject(req.body);
    if (req.query) sanitizeObject(req.query);
    if (req.params) sanitizeObject(req.params);
    next();
};
