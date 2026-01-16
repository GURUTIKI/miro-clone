import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useBoardStore } from '../store/useBoardStore';
import type { Shape } from '../store/useBoardStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const useSocket = (boardId: string) => {
    const socketRef = useRef<Socket | null>(null);
    const { setShapes, addShape, removeCursor } = useBoardStore();

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

        return () => {
            newSocket.disconnect();
        };
    }, [boardId]); // Removed store methods from dependency array to avoid reconnection loops if they change

    const emitAddShape = (shape: Shape) => {
        socketRef.current?.emit('shape-added', shape);
    };

    const emitUpdateShape = (shape: Shape) => {
        socketRef.current?.emit('shape-updated', shape);
    };

    const emitRemoveShape = (id: string) => {
        socketRef.current?.emit('shape-removed', id);
    };

    const emitCursorMove = (cursor: { x: number; y: number; username?: string }) => {
        socketRef.current?.emit('cursor-move', cursor);
    };

    return {
        socket,
        emitAddShape,
        emitUpdateShape,
        emitRemoveShape,
        emitCursorMove,
    };
};
