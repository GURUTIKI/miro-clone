import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Use 0.0.0.0 to listen on all interfaces
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

interface Shape {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fill?: string;
  text?: string;
}

interface Board {
  id: string;
  name: string;
  password?: string;
  shapes: Shape[];
}

const boards: Record<string, Board> = {};

app.get('/boards', (req, res) => {
  const publicBoards = Object.values(boards).map(({ id, name, password }) => ({
    id,
    name,
    hasPassword: !!password
  }));
  res.json(publicBoards);
});

app.post('/boards', (req, res) => {
  const { name, password } = req.body;
  const id = uuidv4();
  boards[id] = {
    id,
    name,
    password,
    shapes: []
  };
  res.json({ id, name });
});

app.post('/boards/:id/verify', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const board = boards[id];

  if (!board) return res.status(404).json({ error: 'Board not found' });
  if (board.password && board.password !== password) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  res.json({ success: true });
});

// ... existing imports
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ... existing setup

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: timestamp + uuid + extension
    const uniqueSuffix = Date.now() + '-' + uuidv4();
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 3 * 1024 * 1024 // 3MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
  }
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Upload Endpoint
app.post('/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Max size is 3MB.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return the URL for the uploaded file
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.json({ url: fileUrl, filename: req.file.filename });
  });
});

// ... existing socket.io setup
io.on('connection', (socket) => {
});

