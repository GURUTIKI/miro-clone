import React, { useRef } from 'react';
import {
    MousePointer2,
    Type,
    StickyNote,
    Layout,
    Circle,
    Square,
    Hand,
    Image as ImageIcon,
    Pencil,
    Settings,
    Sun,
    Moon,
    Palette,
    Undo2,
    Redo2
} from 'lucide-react';
import { useBoardStore } from '../store/useBoardStore';
import type { Tool, Shape } from '../store/useBoardStore';
import { useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const tools: { id: Tool; icon: any; label: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'hand', icon: Hand, label: 'Hand' },
    { id: 'rectangle', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: Circle, label: 'Circle' },
    { id: 'text', icon: Type, label: 'Text' },
    { id: 'pen', icon: Pencil, label: 'Pen' },
    { id: 'sticky', icon: StickyNote, label: 'Sticky Note' },
    { id: 'artboard', icon: Layout, label: 'Artboard' },
    { id: 'image', icon: ImageIcon, label: 'Image' },
    { id: 'palette' as Tool, icon: Palette, label: 'Colors' },
];

export const Toolbar: React.FC<{
    emitAddShape: (shape: Shape) => void,
    emitBoardRename: (newName: string) => void
}> = ({ emitAddShape, emitBoardRename }) => {
    const {
        tool, setTool, activeColor, setActiveColor, addShape,
        setSelectedIds, isDarkMode, toggleDarkMode, boardName,
        setBoardName, undo, redo, past, future
    } = useBoardStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input so same file can be selected again if needed
        e.target.value = '';

        if (file.size > 3 * 1024 * 1024) {
            alert('File size exceeds 3MB limit.');
            return;
        }

        const formData = new FormData();
        formData.append('image', file);

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Upload failed');
            }

            const data = await res.json();
            const imageUrl = data.url;

            // Create image shape
            const id = uuidv4();
            const newShape: Shape = {
                id,
                type: 'image',
                x: window.innerWidth / 2 - 100, // Center roughly
                y: window.innerHeight / 2 - 100, // Center roughly
                width: 200,
                height: 200, // Placeholder, usually we want to load aspect ratio
                fill: 'transparent',
                imageUrl: imageUrl,
            };

            // Fix: Load image to get dimensions ?
            // For now, let's just add it. Canvas will handle loading.
            // Ideally we want to set aspect ratio.
            // We can load it mostly invisibly to check dimensions.
            const img = new Image();
            img.onload = () => {
                const aspectRatio = img.width / img.height;
                let finalWidth = 200;
                let finalHeight = 200;

                if (img.width > img.height) {
                    finalWidth = 300;
                    finalHeight = 300 / aspectRatio;
                } else {
                    finalHeight = 300;
                    finalWidth = 300 * aspectRatio;
                }

                newShape.width = finalWidth;
                newShape.height = finalHeight;

                addShape(newShape);
                emitAddShape(newShape);
                setSelectedIds([id]);
                setTool('select');
            };
            img.src = imageUrl;

        } catch (error: any) {
            console.error('Image upload failed:', error);
            alert(error.message);
        }
    };

    return (
        <div className="fixed left-6 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 bg-white/95 backdrop-blur-xl p-2 rounded-2xl shadow-lg border border-gray-200/60 z-50 transition-all duration-300 hover:shadow-xl dark:bg-slate-900/95 dark:border-slate-800">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
            />
            {tools.map((t) => (
                <button
                    key={t.id}
                    onClick={() => {
                        if (t.id === 'image') {
                            fileInputRef.current?.click();
                        } else {
                            setTool(t.id);
                        }
                    }}
                    className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center group relative
            ${tool === t.id && t.id !== 'image' && t.id !== 'palette'
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105'
                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800 hover:text-gray-900 hover:scale-105 active:scale-95'
                        }`}
                    title={t.label}
                >
                    <t.icon size={18} strokeWidth={tool === t.id && t.id !== 'image' ? 2.5 : 2} className="transition-transform duration-200" />

                    {/* Tooltip */}
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                        {t.label}
                    </span>
                </button>
            ))}

            {/* Text Styling Toolbar */}
            {tool === 'text' && (
                <TextToolbar />
            )}
            {/* Also show text toolbar if we have selected a text item */}
            {tool === 'select' && (
                <TextToolbar />
            )}

            {/* Pen Styling Toolbar */}
            {tool === 'pen' && (
                <PenToolbar />
            )}

            {/* Global Palette Overlay */}
            {tool === 'palette' && (
                <div className="absolute left-full top-0 ml-3 bg-white/95 backdrop-blur-xl p-4 rounded-2xl shadow-xl border border-gray-200/60 flex flex-col gap-3 min-w-[180px] animate-fade-in">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-red-500 via-green-500 to-blue-500"></div>
                        <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Global Colors</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                        {['#333333', '#EB5757', '#F2994A', '#F2C94C', '#219653', '#2F80ED', '#9B51E0', '#fff9c4', '#ffccbc', '#b3e5fc', '#c8e6c9', '#f8bbd0'].map((color) => (
                            <button
                                key={color}
                                className={`w-8 h-8 rounded-lg border-2 transition-all hover:scale-110 active:scale-95 shadow-sm ${activeColor === color ? 'border-blue-500 ring-2 ring-blue-500/40' : 'border-transparent'}`}
                                style={{ backgroundColor: color }}
                                onClick={() => {
                                    setActiveColor(color);
                                    // Switch back to previous tool or just stay? 
                                    // User said "whatever tool you pick after selecting a colour"
                                    // So we just stay in palette mode or switch to select?
                                    // Let's stay so they can see selection.
                                }}
                            />
                        ))}
                    </div>
                    <div className="h-px bg-gray-100 my-1"></div>
                    <p className="text-[10px] text-gray-500 font-medium italic">Select a color, then pick a tool to draw.</p>
                </div>
            )}

            {/* Undo/Redo Section */}
            <div className="h-px bg-[var(--border-ui)] my-1"></div>
            <div className="flex flex-col gap-1.5 font-medium">
                <button
                    onClick={undo}
                    disabled={past.length === 0}
                    className="p-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed group relative transition-all"
                    title="Undo (Ctrl+Z)"
                >
                    <Undo2 size={18} />
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                        Undo (Ctrl+Z)
                    </span>
                </button>
                <button
                    onClick={redo}
                    disabled={future.length === 0}
                    className="p-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed group relative transition-all"
                    title="Redo (Ctrl+Shift+Z)"
                >
                    <Redo2 size={18} />
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-[10px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-lg">
                        Redo (Ctrl+Shift+Z)
                    </span>
                </button>
            </div>

            {/* Settings Menu */}
            <div className="h-px bg-[var(--border-ui)] my-1"></div>
            <SettingsMenu
                isDarkMode={isDarkMode}
                toggleDarkMode={toggleDarkMode}
                boardName={boardName}
                setBoardName={setBoardName}
                emitBoardRename={emitBoardRename}
            />
        </div>
    );
};

const PenToolbar = () => {
    const { penWidth, setPenWidth } = useBoardStore();

    return (
        <div className="absolute left-full top-0 ml-3 bg-[var(--bg-toolbar)] backdrop-blur-xl p-3 rounded-2xl shadow-[var(--shadow-ui)] border border-[var(--border-ui)] flex flex-col gap-3 w-max animate-fade-in z-[60]">
            {/* Color section removed in favor of global palette */}

            <div className="h-px bg-[var(--border-ui)]"></div>

            <p className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider">Thickness</p>
            <div className="flex items-center gap-2">
                <input
                    type="range"
                    min="1"
                    max="20"
                    value={penWidth}
                    onChange={(e) => setPenWidth(parseInt(e.target.value))}
                    className="w-24 accent-blue-600"
                />
                <span className="text-xs font-mono text-[var(--text-primary)] w-4">{penWidth}</span>
            </div>
        </div>
    );
};

const SettingsMenu = ({ isDarkMode, toggleDarkMode, boardName, setBoardName, emitBoardRename }: any) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const { boardId } = useParams<{ boardId: string }>();

    const handleNameChange = async (e: React.FocusEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        if (!newName || newName === boardName) return;

        setBoardName(newName);
        emitBoardRename(newName);

        // Update on server
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            await fetch(`${API_URL}/boards/${boardId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName })
            });
        } catch (err) {
            console.error('Failed to update board name', err);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center group relative
                    ${isOpen ? 'bg-gray-100 dark:bg-slate-800 text-blue-600' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                title="Settings"
            >
                <Settings size={18} className={isOpen ? 'rotate-90' : ''} />
            </button>

            {isOpen && (
                <div className="absolute left-full bottom-0 ml-3 bg-[var(--bg-toolbar)] backdrop-blur-xl p-4 rounded-2xl shadow-[var(--shadow-ui)] border border-[var(--border-ui)] flex flex-col gap-4 w-64 animate-fade-in z-[70]">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-[var(--text-secondary)] tracking-wider mb-2 block">Board Name</label>
                        <input
                            type="text"
                            defaultValue={boardName}
                            onBlur={handleNameChange}
                            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            className="w-full p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-ui)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                    </div>

                    <div className="h-px bg-[var(--border-ui)]"></div>

                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--text-primary)]">Theme</span>
                        <button
                            onClick={toggleDarkMode}
                            className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-ui)] text-[var(--text-primary)] hover:bg-opacity-80 transition-all"
                        >
                            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                            <span className="text-xs">{isDarkMode ? 'Light' : 'Dark'}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const TextToolbar = () => {
    // ... existing TextToolbar code ...
    const { selectedIds, shapes, updateShape, tool } = useBoardStore();

    // Find selected text shape (just perform on first valid text shape or all?)
    // For now, let's just use the first selected item if it's text
    // Or if current tool is text, we show defaults

    const selectedShape = selectedIds && selectedIds.length === 1
        ? shapes.find(s => s.id === selectedIds[0])
        : null;

    const isTextSelected = selectedShape?.type === 'text';

    // Only show if tool is text OR a text item is selected
    if (tool !== 'text' && !isTextSelected) return null;

    // Default values if nothing selected
    const currentFontSize = selectedShape?.fontSize || 24;
    const currentFontFamily = selectedShape?.fontFamily || 'Inter';
    const currentFontStyle = selectedShape?.fontStyle || 'normal';
    const currentDecoration = selectedShape?.textDecoration || 'none';
    const isBold = currentFontStyle.includes('bold');
    const isItalic = currentFontStyle.includes('italic');
    const isUnderline = currentDecoration === 'underline';

    const TEXT_COLORS = ['#333333', '#EB5757', '#F2994A', '#F2C94C', '#219653', '#2F80ED', '#9B51E0'];

    const handleUpdate = (updates: any) => {
        if (selectedIds.length > 0) {
            // Apply to all selected text nodes
            selectedIds.forEach(id => {
                const s = shapes.find(shape => shape.id === id);
                if (s && s.type === 'text') {
                    updateShape(id, updates);
                }
            });
        }
        // Ideally we'd update a default text style in store too
    };

    const toggleStyle = (type: 'bold' | 'italic') => {
        let newStyle = currentFontStyle;
        if (type === 'bold') {
            newStyle = isBold ? newStyle.replace('bold', '').trim() : `${newStyle} bold`.trim();
        } else if (type === 'italic') {
            newStyle = isItalic ? newStyle.replace('italic', '').trim() : `${newStyle} italic`.trim();
        }
        handleUpdate({ fontStyle: newStyle || 'normal' });
    };

    return (
        <div className="absolute left-full top-0 ml-3 bg-white/95 backdrop-blur-xl p-3 rounded-2xl shadow-lg border border-gray-200/60 flex flex-col gap-3 w-max animate-fade-in">
            {/* Font Family */}
            <select
                title="Font Family"
                className="w-full p-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={currentFontFamily}
                onChange={(e) => handleUpdate({ fontFamily: e.target.value })}
            >
                <option value="Inter">Inter</option>
                <option value="Arial">Arial</option>
                <option value="Courier New">Mono</option>
                <option value="Comic Sans MS">Comic</option>
            </select>

            <div className="flex gap-2">
                {/* Font Size */}
                <input
                    type="number"
                    title="Font Size"
                    className="w-16 p-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={currentFontSize}
                    onChange={(e) => handleUpdate({ fontSize: parseInt(e.target.value) || 24 })}
                    min={12}
                    max={120}
                />

                {/* Style Toggles */}
                <div className="flex gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
                    <button
                        onClick={() => toggleStyle('bold')}
                        className={`p-1.5 rounded-md transition-all ${isBold ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
                        title="Bold"
                    >
                        <span className="font-bold">B</span>
                    </button>
                    <button
                        onClick={() => toggleStyle('italic')}
                        className={`p-1.5 rounded-md transition-all ${isItalic ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
                        title="Italic"
                    >
                        <span className="italic">I</span>
                    </button>
                    <button
                        onClick={() => handleUpdate({ textDecoration: isUnderline ? 'none' : 'underline' })}
                        className={`p-1.5 rounded-md transition-all ${isUnderline ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
                        title="Underline"
                    >
                        <span className="underline">U</span>
                    </button>
                </div>
            </div>

            {/* Color Picker */}
            <div className="grid grid-cols-7 gap-1">
                {TEXT_COLORS.map((color) => (
                    <button
                        key={color}
                        className={`w-6 h-6 rounded-full border border-gray-200 transition-all hover:scale-110 active:scale-95 ${selectedShape?.fill === color ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => handleUpdate({ fill: color })}
                        title={color}
                    />
                ))}
            </div>
        </div>
    );
};
