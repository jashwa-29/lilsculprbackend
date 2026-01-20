const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');

// Load environment variables
dotenv.config();
console.log('DEBUG: Mongo URI loaded:', process.env.MONGO_URI ? 'YES (First 20 chars: ' + process.env.MONGO_URI.substring(0, 20) + '...)' : 'NO (Undefined)');

// Import routes
const registrationRoutes = require("./routes/registration.routes");
const specialCourseRoutes = require("./routes/specialCourse.routes");

const app = express();

// --- Security Middleware ---
app.use(helmet()); // Security headers
app.use(morgan('dev')); // Request logging

// --- CORS Configuration ---   
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://lilsculpr.com', // Your production domain
  'https://www.lilsculpr.com',
  'http://127.0.0.1:5502',
  'http://127.0.0.1:5500'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

// Enable CORS for all routes including preflight
app.use(cors(corsOptions));

// --- Body Parser Middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- MongoDB Connection with Retry Logic ---
const connectDB = async () => {
  try {
    const dbUri = process.env.ATLAS_URI || process.env.MONGO_URI;
    const maskedUri = dbUri ? dbUri.replace(/\/\/.*@/, '//****:****@') : 'UNDEFINED';
    console.log(`📡 Attempting to connect to: ${maskedUri}`);
    
    if (!dbUri) {
        throw new Error('Database URI is not defined in environment variables (ATLAS_URI or MONGO_URI)');
    }

    await mongoose.connect(dbUri);
    console.log('✅ MongoDB Connected successfully');
    
    // Listen to connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed due to app termination');
      process.exit(0);
    });
     
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('Retrying connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};
 
connectDB();

// --- Test Route ---
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
        }
        .container {
          text-align: center;
          background: white;
          padding: 40px;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h2 {
          color: #333;
          margin-bottom: 20px;
        }
        .status {
          color: #27ae60;
          font-weight: bold;
          margin: 10px 0;
        }
        .info {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 10px;
          margin: 20px 0;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🎨 Lil Sculpr Clay Academy</h2>
        <div class="status">✅ API is running successfully!</div>
        <div class="info">
          Server Time: ${new Date().toLocaleString('en-IN')}<br>
          Database: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}<br>
          Environment: ${process.env.NODE_ENV || 'development'}
        </div>
        <p>Welcome to the Winter Carnival Workshop Backend API</p>
      </div>
    </body>
    </html>
  `);
});

// --- Health Check Endpoint ---
app.get('/api/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV,
    memory: process.memoryUsage()
  };
  res.json(health);
});

// --- API Routes ---   
app.use("/api/registrations", registrationRoutes);
app.use("/api/special-course", specialCourseRoutes);

// --- Static File Handling ---
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
  
// --- 404 Not Found Handler ---
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// --- Global Error Handler ---
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
    
  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      success: false,
      error: 'CORS policy violation',
      message: 'Origin not allowed'
    });
  }
  
  // Default error response
  res.status(err.status || 500).json({ 
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// --- Graceful Shutdown ---
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 Server running on port ${PORT}
  🌍 Environment: ${process.env.NODE_ENV || 'development'}
  📅 Started at: ${new Date().toLocaleString('en-IN')}
  🔗 Local: http://localhost:${PORT}
  🔗 Network: http://0.0.0.0:${PORT}
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('🔥 Unhandled Promise Rejection:', err);
  server.close(() => process.exit(1));
});