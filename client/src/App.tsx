import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { useSocket } from './hooks/useSocket';
import './index.css';

import React from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';

const BoardView: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const { emitAddShape, emitUpdateShape, emitRemoveShape, emitCursorMove, emitBoardRename, socket } = useSocket(boardId || '');

  if (!boardId) return <div>Invalid Board ID</div>;

  return (
    <div className="w-full h-screen overflow-hidden bg-gray-50 relative">
      <Toolbar emitAddShape={emitAddShape} emitBoardRename={emitBoardRename} />
      <Canvas
        boardId={boardId}
        socket={socket}
        emitAddShape={emitAddShape}
        emitUpdateShape={emitUpdateShape}
        emitRemoveShape={emitRemoveShape}
        emitCursorMove={emitCursorMove}
      />
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/board/:boardId" element={<BoardView />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
