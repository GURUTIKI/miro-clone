import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import './index.css';

import React from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { Login } from './components/Login';

const BoardView: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();

  if (!boardId) return <div>Invalid Board ID</div>;

  return (
    <div className="w-full h-screen overflow-hidden bg-gray-50 relative">
      <Toolbar />
      <Canvas boardId={boardId} />
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
