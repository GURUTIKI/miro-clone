import { create } from 'zustand';

export type Tool = 'select' | 'rectangle' | 'circle' | 'text' | 'sticky' | 'artboard' | 'hand' | 'image' | 'pen' | 'palette';

export interface Shape {
    id: string;
    type: Tool;
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontStyle?: string;
    textDecoration?: string;
    align?: string;
    imageUrl?: string;
    points?: number[]; // For freehand pen
    stroke?: string;   // For pen
    strokeWidth?: number; // For pen
    locked?: boolean;
}

export interface Cursor {
    id: string;
    x: number;
    y: number;
    color: string;
    username?: string;
}

interface BoardStore {
    tool: Tool;
    shapes: Shape[];
    cursors: Record<string, Cursor>;
    selectedIds: string[];
    scale: number;
    position: { x: number; y: number };
    activeColor: string;
    penWidth: number;
    isDarkMode: boolean;
    boardName: string;
    past: Shape[][];
    future: Shape[][];
    clipboard: Shape[];
    isPublic: boolean;
    sharePermission: 'view' | 'edit';
    shareToken?: string;
    isReadOnly: boolean;

    setTool: (tool: Tool) => void;
    setActiveColor: (color: string) => void;
    setShapes: (shapes: Shape[]) => void;
    addShape: (shape: Shape) => void;
    updateShape: (id: string, updates: Partial<Shape>) => void;
    removeShape: (id: string) => void;
    updateCursor: (id: string, cursor: Partial<Cursor>) => void;
    removeCursor: (id: string) => void;
    setSelectedIds: (ids: string[]) => void;
    setViewport: (scale: number, position: { x: number; y: number }) => void;
    toggleDarkMode: () => void;
    setBoardName: (name: string) => void;
    setPenWidth: (width: number) => void;
    toggleLock: (id: string) => void;
    saveToHistory: () => void;
    undo: () => void;
    redo: () => void;
    copy: () => void;
    paste: (position?: { x: number, y: number }) => Shape[];
    setShareSettings: (settings: { isPublic?: boolean, sharePermission?: 'view' | 'edit', shareToken?: string }) => void;
    setIsReadOnly: (isReadOnly: boolean) => void;
}

export const useBoardStore = create<BoardStore>((set) => ({
    tool: 'select',
    shapes: [],
    cursors: {},
    selectedIds: [],
    scale: 1,
    position: { x: 0, y: 0 },
    activeColor: '#fff9c4', // Default yellow
    penWidth: 3,
    isDarkMode: localStorage.getItem('theme') === 'dark',
    boardName: 'Untitled Board',
    past: [],
    future: [],
    clipboard: [],
    isPublic: false,
    sharePermission: 'view',
    isReadOnly: false,

    setTool: (tool) => set({ tool }),
    setActiveColor: (color) => set({ activeColor: color }),
    setShapes: (shapes) => set({ shapes }),
    addShape: (shape) => set((state) => ({ shapes: [...state.shapes, shape] })),
    updateShape: (id, updates) =>
        set((state) => ({
            shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),
    removeShape: (id) =>
        set((state) => ({
            shapes: state.shapes.filter((s) => s.id !== id),
        })),
    updateCursor: (id, cursor) =>
        set((state) => ({
            cursors: {
                ...state.cursors,
                [id]: { ...(state.cursors[id] || { id, x: 0, y: 0, color: '#2196f3' }), ...cursor },
            },
        })),
    removeCursor: (id) =>
        set((state) => {
            const newCursors = { ...state.cursors };
            delete newCursors[id];
            return { cursors: newCursors };
        }),
    setSelectedIds: (ids) => set({ selectedIds: ids }),
    setViewport: (scale, position) => set({ scale, position }),
    toggleDarkMode: () => set((state) => {
        const next = !state.isDarkMode;
        localStorage.setItem('theme', next ? 'dark' : 'light');
        if (next) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        return { isDarkMode: next };
    }),
    setBoardName: (name) => set({ boardName: name }),
    setPenWidth: (width) => set({ penWidth: width }),
    toggleLock: (id) =>
        set((state) => ({
            shapes: state.shapes.map((s) => (s.id === id ? { ...s, locked: !s.locked } : s)),
        })),

    saveToHistory: () =>
        set((state) => {
            if (state.isReadOnly) return state;
            // Only keep last 50 steps
            const newPast = [...state.past, state.shapes].slice(-50);
            return { past: newPast, future: [] };
        }),

    undo: () =>
        set((state) => {
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            const newPast = state.past.slice(0, state.past.length - 1);
            return {
                past: newPast,
                shapes: previous,
                future: [state.shapes, ...state.future],
            };
        }),

    redo: () =>
        set((state) => {
            if (state.future.length === 0) return state;
            const next = state.future[0];
            const newFuture = state.future.slice(1);
            return {
                past: [...state.past, state.shapes],
                shapes: next,
                future: newFuture,
            };
        }),

    copy: () =>
        set((state) => {
            const selectedShapes = state.shapes.filter((s) => state.selectedIds.includes(s.id));
            if (selectedShapes.length === 0) return state;
            return { clipboard: selectedShapes };
        }),

    paste: (pos) => {
        let newShapes: Shape[] = [];
        set((state) => {
            if (state.clipboard.length === 0) return state;

            const offset = 20;
            newShapes = state.clipboard.map((s) => {
                const newId = crypto.randomUUID();
                return {
                    ...s,
                    id: newId,
                    x: pos ? pos.x + (s.x - state.clipboard[0].x) : s.x + offset,
                    y: pos ? pos.y + (s.y - state.clipboard[0].y) : s.y + offset,
                    locked: false,
                };
            });

            return {
                shapes: [...state.shapes, ...newShapes],
                selectedIds: newShapes.map((s) => s.id),
            };
        });
        return newShapes;
    },

    setShareSettings: (settings) => set((state) => ({ ...state, ...settings })),
    setIsReadOnly: (isReadOnly) => set({ isReadOnly }),
}));
