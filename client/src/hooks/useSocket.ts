import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useBoardStore } from '../store/useBoardStore';
import type { Shape } from '../store/useBoardStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const useSocket = (boardId: string) => {
    const socketRef = useRef<Socket | null>(null);
    const { setShapes, addShape, updateShape, updateCursor, removeCursor } = useBoardStore();

    useEffect(() => {
        socketRef.current = io(SOCKET_URL, {
            query: { boardId }
        });

        const socket = socketRef.current;

        socket.on('connect', () => {
            console.log('Connected to socket server');
        });

        socket.on('init-state', (initialShapes: Shape[]) => {
            setShapes(initialShapes);
        });

        socket.on('shape-added', (shape: Shape) => {
            addShape(shape);
        });

        socket.on('shape-updated', (updatedShape: Shape) => {
            useBoardStore.getState().updateShape(updatedShape.id, updatedShape);
        });

        socket.on('shape-removed', (id: string) => {
            useBoardStore.getState().removeShape(id);
        });

        socket.on('cursor-move', (cursor: any) => {
            useBoardStore.getState().updateCursor(cursor.id, cursor);
        });

        socket.on('user-disconnected', (userId: string) => {
            removeCursor(userId);
        });

        return () => {
            socket.disconnect();
        };
    }, [setShapes, addShape, updateShape, updateCursor, removeCursor]);

    const emitAddShape = (shape: Shape) => {
        socketRef.current?.emit('shape-added', shape);
    };

    const emitUpdateShape = (shape: Shape) => {
        socketRef.current?.emit('shape-updated', shape);
    };

    const emitRemoveShape = (id: string) => {
        socketRef.current?.emit('shape-removed', id);
    };

    const emitCursorMove = (cursor: { x: number; y: number }) => {
        socketRef.current?.emit('cursor-move', cursor);
    };

    return {
        emitAddShape,
        emitUpdateShape,
        emitRemoveShape,
        emitCursorMove,
    };
};
