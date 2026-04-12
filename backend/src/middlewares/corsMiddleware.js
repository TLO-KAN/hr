const allowedOrigins = (process.env.ALLOWED_ORIGINS || 
  'http://localhost:5173,http://localhost:3000').split(',');

export const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept'
  ],
  optionsSuccessStatus: 200,
  maxAge: 3600
};

export const corsErrorHandler = (err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS - Origin not allowed',
      code: 'CORS_BLOCKED'
    });
  }
  next(err);
};