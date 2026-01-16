import { create } from 'zustand';

export type Tool = 'select' | 'rectangle' | 'circle' | 'text' | 'sticky' | 'artboard' | 'hand' | 'image' | 'pen';

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
}));
