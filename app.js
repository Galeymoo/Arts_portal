const express = require('express');
const session = require('express-session');
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const { sequelize } = require('./models'); // ✅ Ensure sequelize is imported
const authRoutes = require('./routes/authRoutes');
const artworkRoutes = require('./routes/artworkRoutes');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Session store configuration
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: "Session",
  checkExpirationInterval: 15 * 60 * 1000, // Clean expired sessions every 15 min
  expiration: 24 * 60 * 60 * 1000, // Session expiration: 1 day
});

// Trust proxy in production
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'public/uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Set view engine and static assets
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Parse incoming request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'defaultsecret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false
}));

// Expose session user to views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// Routes
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/feed');
  }
  res.render('landing');
});
app.use('/', authRoutes);
app.use('/', artworkRoutes(upload)); // ✅ Pass multer to artwork routes

// Sync database and start server
const PORT = process.env.PORT || 3000;

sessionStore.sync()
  .then(() => sequelize.sync({ force: false }))
  .then(() => {
    console.log("✅ Database and session store synchronized!");
    app.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("❌ Error syncing the database or session store:", error);
  });
