import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useBoardStore } from '../store/useBoardStore';
import type { Shape } from '../store/useBoardStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const useSocket = (boardId: string) => {
    const socketRef = useRef<Socket | null>(null);
    const { setShapes, addShape, removeCursor, setBoardName } = useBoardStore();

    const [socket, setSocket] = useState<Socket | null>(null);

    useEffect(() => {
        const newSocket = io(SOCKET_URL, {
            query: { boardId }
        });

        socketRef.current = newSocket;
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('Connected to socket server');
        });

        newSocket.on('init-state', (initialShapes: Shape[]) => {
            setShapes(initialShapes);
        });

        newSocket.on('shape-added', (shape: Shape) => {
            addShape(shape);
        });

        newSocket.on('shape-updated', (updatedShape: Shape) => {
            useBoardStore.getState().updateShape(updatedShape.id, updatedShape);
        });

        newSocket.on('shape-removed', (id: string) => {
            useBoardStore.getState().removeShape(id);
        });

        newSocket.on('cursor-move', (cursor: any) => {
            useBoardStore.getState().updateCursor(cursor.id, cursor);
        });

        newSocket.on('user-disconnected', (userId: string) => {
            removeCursor(userId);
        });

        newSocket.on('board-renamed', (newName: string) => {
            setBoardName(newName);
        });

        return () => {
            newSocket.disconnect();
        };
    }, [boardId]); // Removed store methods from dependency array to avoid reconnection loops if they change

    const emitAddShape = useCallback((shape: Shape) => {
        socketRef.current?.emit('shape-added', shape);
    }, []);

    const emitUpdateShape = useCallback((shape: Shape) => {
        socketRef.current?.emit('shape-updated', shape);
    }, []);

    const emitRemoveShape = useCallback((id: string) => {
        socketRef.current?.emit('shape-removed', id);
    }, []);

    const emitCursorMove = useCallback((cursor: { x: number; y: number; username?: string }) => {
        if (socketRef.current?.connected) { // Only emit cursor if connected to reduce noise
            socketRef.current?.emit('cursor-move', cursor);
        }
    }, []);

    const emitBoardRename = useCallback((newName: string) => {
        socketRef.current?.emit('board-renamed', newName);
    }, []);

    return {
        socket,
        emitAddShape,
        emitUpdateShape,
        emitRemoveShape,
        emitCursorMove,
        emitBoardRename,
    };
};
