const express = require('express');
const mongodb_sanitizer = require('express-mongo-sanitize');
const hpp = require('hpp');
const helmet = require('helmet');
const rate_limiter = require('express-rate-limit');
const cors = require('cors');
const xss = require('xss-clean');
const profileRoute = require('./route/profileRoute');
const app = express();
const cookieParser = require('cookie-parser');
const globalErrorHandler = require('./middleWare/globalErrorHandler');
const authRouter = require('./route/authRoute');
const morgan = require('morgan');
const { csrfCookie, csrfProtect } = require('./middleWare/csrfMiddleware');

app.use(
  cors({
    origin: [
      'http://localhost:5500',
      'http://localhost:3000',
      'https://insighta-web-portal-eta.vercel.app',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
  })
);
app.options('*', cors());

app.use(helmet());
app.use(xss());
app.use(hpp());
app.use(mongodb_sanitizer());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use(csrfCookie);
app.use(csrfProtect);

app.use(morgan('combined'));

const authLimiter = rate_limiter({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: JSON.stringify({
    status: 'error',
    message: 'Too many requests. Try again later.',
  }),
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rate_limiter({
  max: 500,
  windowMs: 60 * 60 * 1000,
  message: JSON.stringify({
    status: 'error',
    message: 'Too many requests from this IP. Try again later.',
  }),
});

app.use('/api', apiLimiter);
app.use('/auth', authLimiter, authRouter);
app.use('/api/auth', authRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', profileRoute);
app.use('/api', profileRoute);
app.use(globalErrorHandler);

module.exports = app;
