import jwt from 'jsonwebtoken';

const JWT_SECRET = '12345';

export const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' }); // Token valid for 24 hours
};

// export const verifyToken = (token) => {
//     try {
//         return jwt.verify(token,JWT_SECRET);

//     } catch (error) {
//         console.log(error);
//         throw new Error('Invalid or expired token')

//     }
// };
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.log(error);
        throw new Error('Invalid or expired token');
    }
};