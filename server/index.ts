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
    origin: "*", // Allow all origins for now (you can restrict this to your Netlify domain later)
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

interface Company {
  id: string;
  name: string;
  code: string; // Access code for the company
}

interface Board {
  id: string;
  name: string;
  password?: string;
  shapes: Shape[];
  companyId: string; // Link to company
}

const companies: Record<string, Company> = {
  // Seed with a demo company
  'demo-company-id': {
    id: 'demo-company-id',
    name: 'Demo Company',
    code: 'DEMO2024'
  }
};
const boards: Record<string, Board> = {};

// Company endpoints
app.post('/companies/login', (req, res) => {
  const { code } = req.body;

  const company = Object.values(companies).find(c => c.code === code);

  if (!company) {
    return res.status(401).json({ error: 'Invalid company code' });
  }

  res.json({ id: company.id, name: company.name });
});

app.post('/companies', (req, res) => {
  const { name, code } = req.body;
  const id = uuidv4();

  companies[id] = {
    id,
    name,
    code
  };

  res.json({ id, name });
});

// Board endpoints
app.get('/boards', (req, res) => {
  const { companyId } = req.query;

  let boardsList = Object.values(boards);

  // Filter by company if companyId is provided
  if (companyId) {
    boardsList = boardsList.filter(b => b.companyId === companyId);
  }

  const publicBoards = boardsList.map(({ id, name, password }) => ({
    id,
    name,
    hasPassword: !!password
  }));
  res.json(publicBoards);
});

app.post('/boards', (req, res) => {
  const { name, password, companyId } = req.body;

  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required' });
  }

  const id = uuidv4();
  boards[id] = {
    id,
    name,
    password,
    shapes: [],
    companyId
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

app.get('/boards/:id', (req, res) => {
  const { id } = req.params;
  const board = boards[id];

  if (!board) return res.status(404).json({ error: 'Board not found' });

  res.json({ id: board.id, name: board.name });
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

// Socket.IO real-time synchronization
const userColors: Record<string, string> = {};

// Helper to generate pastel colors
const generatePastelColor = () => {
  const hue = Math.floor(Math.random() * 360);
  // High brightness and lower saturation for pastel look
  return `hsl(${hue}, 70%, 80%)`;
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Assign a persistent pastel color to this connection
  userColors[socket.id] = generatePastelColor();

  const boardId = socket.handshake.query.boardId as string;

  if (boardId) {
    socket.join(boardId);

    // Initialize board if it doesn't exist
    if (!boards[boardId]) {
      boards[boardId] = {
        id: boardId,
        name: `Board ${boardId.slice(0, 8)}`,
        shapes: [],
        companyId: 'demo-company-id' // Default to demo company for now
      };
    }

    // Send initial state to the newly connected client
    socket.emit('init-state', boards[boardId].shapes);

    // Handle shape added
    socket.on('shape-added', (shape: Shape) => {
      if (boards[boardId]) {
        boards[boardId].shapes.push(shape);
        socket.to(boardId).emit('shape-added', shape);
      }
    });

    // Handle shape updated
    socket.on('shape-updated', (updatedShape: Shape) => {
      if (boards[boardId]) {
        const index = boards[boardId].shapes.findIndex(s => s.id === updatedShape.id);
        if (index !== -1) {
          boards[boardId].shapes[index] = updatedShape;
        }
        socket.to(boardId).emit('shape-updated', updatedShape);
      }
    });

    // Handle shape removed
    socket.on('shape-removed', (shapeId: string) => {
      if (boards[boardId]) {
        boards[boardId].shapes = boards[boardId].shapes.filter(s => s.id !== shapeId);
        socket.to(boardId).emit('shape-removed', shapeId);
      }
    });

    // Handle cursor movement
    socket.on('cursor-move', (cursor: { x: number; y: number; username?: string }) => {
      socket.to(boardId).emit('cursor-move', {
        id: socket.id,
        x: cursor.x,
        y: cursor.y,
        color: userColors[socket.id],
        username: cursor.username
      });
    });
  }

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    delete userColors[socket.id];
    if (boardId) {
      socket.to(boardId).emit('user-disconnected', socket.id);
    }
  });
});

