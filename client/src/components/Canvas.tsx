import React, { useRef, useLayoutEffect } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Image as KonvaImage, Path } from 'react-konva';
import useImage from 'use-image';
import { useBoardStore } from '../store/useBoardStore';
import type { Shape } from '../store/useBoardStore';
import { v4 as uuidv4 } from 'uuid';
import { useSocket } from '../hooks/useSocket';
import { LogOut, Plus, Minus } from 'lucide-react';

const SCALE_BY = 1.05;

const URLImage: React.FC<{ shape: Shape }> = ({ shape }) => {
    const [image] = useImage(shape.imageUrl || '');
    return (
        <KonvaImage
            image={image}
            width={shape.width}
            height={shape.height}
        />
    );
};

const InPlaceEditor: React.FC<{
    shape: Shape;
    scale: number;
    position: { x: number; y: number };
    onUpdate: (text: string, height: number) => void;
    onBlur: () => void;
}> = ({ shape, scale, position, onUpdate, onBlur }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const newHeight = textarea.scrollHeight;
            textarea.style.height = `${newHeight}px`;
            onUpdate(textarea.value, newHeight / scale);
        }
    };

    useLayoutEffect(() => {
        adjustHeight();
    }, [shape.text]);

    return (
        <textarea
            ref={textareaRef}
            className="text-editor-inplace"
            style={{
                position: 'fixed',
                top: (shape.y * scale) + position.y,
                left: (shape.x * scale) + position.x,
                width: shape.width * scale,
                minHeight: shape.height * scale,
                fontSize: (shape.fontSize || (shape.type === 'text' ? 24 : 16)) * scale,
                fontFamily: shape.fontFamily || 'Inter',
                fontStyle: shape.fontStyle || 'normal',
                textDecoration: shape.textDecoration || 'none',
                color: shape.type === 'text' ? (shape.fill || '#000000') : '#000000',
                textAlign: (shape.align as any) || (shape.type === 'text' ? 'left' : 'center'),
                paddingTop: shape.type === 'sticky' ? (shape.height * scale / 3) : '2px',
                paddingLeft: shape.type === 'text' ? '0' : '10px',
                paddingRight: shape.type === 'text' ? '0' : '10px',
            }}
            value={shape.text || ''}
            autoFocus
            onChange={(e) => {
                const textarea = e.target;
                textarea.style.height = 'auto';
                const newHeight = textarea.scrollHeight;
                textarea.style.height = `${newHeight}px`;
                onUpdate(textarea.value, newHeight / scale);
            }}
            onBlur={onBlur}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onBlur();
                }
            }}
        />
    );
};

export const Canvas: React.FC<{ boardId: string }> = ({ boardId }) => {
    const stageRef = useRef<any>(null);
    const transformerRef = useRef<any>(null);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [boardName, setBoardName] = React.useState<string>('');
    const [spacePressed, setSpacePressed] = React.useState(false);
    const drawingShapeIdRef = React.useRef<string | null>(null);

    // Username modal state
    const [showUsernameModal, setShowUsernameModal] = React.useState(false);
    const [username, setUsername] = React.useState('');
    const [rememberMe, setRememberMe] = React.useState(false);
    const [tempUsername, setTempUsername] = React.useState('');
    const startPosRef = React.useRef<{ x: number, y: number } | null>(null);

    const [selectionBox, setSelectionBox] = React.useState<{ x: number, y: number, width: number, height: number } | null>(null);

    const { tool, setTool, shapes, cursors, addShape, updateShape, removeShape, selectedIds, setSelectedIds, scale, position, setViewport, activeColor } = useBoardStore();
    const { emitAddShape, emitUpdateShape, emitCursorMove, emitRemoveShape } = useSocket(boardId);

    // Check for saved username on mount
    React.useEffect(() => {
        const savedUsername = localStorage.getItem('miro-username');
        if (savedUsername) {
            setUsername(savedUsername);
        } else {
            setShowUsernameModal(true);
        }
    }, []);

    React.useEffect(() => {
        const fetchBoardName = async () => {
            try {
                const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001';
                const res = await fetch(`${API_URL}/boards/${boardId}`);
                if (res.ok) {
                    const data = await res.json();
                    setBoardName(data.name);
                }
            } catch (error) {
                console.error('Failed to fetch board name:', error);
            }
        };
        fetchBoardName();
    }, [boardId]);

    React.useEffect(() => {
        if (transformerRef.current) {
            const stage = stageRef.current;
            const nodes = selectedIds
                .map(id => stage.findOne('#' + id))
                .filter(node => node !== undefined);

            if (nodes.length > 0) {
                transformerRef.current.nodes(nodes);
                transformerRef.current.getLayer().batchDraw();
            } else {
                transformerRef.current.nodes([]);
                transformerRef.current.getLayer().batchDraw();
            }
        }
    }, [selectedIds, shapes]);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.key === 'Backspace' || e.key === 'Delete') && selectedIds.length > 0 && !editingId) {
                selectedIds.forEach(id => {
                    removeShape(id);
                    emitRemoveShape(id);
                });
                setSelectedIds([]);
            }
            if (e.code === 'Space' && !editingId && tool !== 'text') {
                setSpacePressed(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setSpacePressed(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [selectedIds, editingId, removeShape, emitRemoveShape, setSelectedIds, tool]);

    const handleMouseDown = (e: any) => {
        // If clicking on empty space
        if (e.target === e.target.getStage()) {
            // Pointer tool + not panning (no spacebar) = Box Selection
            if (tool === 'select' && !spacePressed) {
                // Clear selection unless Shift is held (can implement shift later, for now clear)
                setSelectedIds([]);

                const stage = stageRef.current;
                const sc = stage.scaleX();
                const pos = stage.position();
                const pointer = stage.getPointerPosition();
                const x = (pointer.x - pos.x) / sc;
                const y = (pointer.y - pos.y) / sc;

                startPosRef.current = { x, y };
                setSelectionBox({ x, y, width: 0, height: 0 });
                return;
            }

            // Start drawing (if valid tool)
            // If Hand tool or Panning, do nothing (dragging handles pan).
            if (tool === 'hand' || spacePressed) return;

            const stage = stageRef.current;
            const sc = stage.scaleX();
            const pos = stage.position();
            const pointer = stage.getPointerPosition();
            const x = (pointer.x - pos.x) / sc;
            const y = (pointer.y - pos.y) / sc;

            startPosRef.current = { x, y };

            const id = uuidv4();
            drawingShapeIdRef.current = id;

            const newShape: Shape = {
                id,
                type: tool,
                x,
                y,
                width: tool === 'text' ? 100 : 1, // Start text wider so it doesn't squash
                height: tool === 'text' ? 30 : 1,
                fill: tool === 'sticky' ? activeColor : (tool === 'artboard' ? '#ffffff' : (tool === 'text' ? '#000000' : '#e3f2fd')),
                text: tool === 'text' ? '' : (tool === 'artboard' ? 'Artboard' : ''),
                fontSize: tool === 'text' ? 24 : undefined,
                fontFamily: tool === 'text' ? 'Inter' : undefined,
                fontStyle: tool === 'text' ? 'normal' : undefined,
                textDecoration: tool === 'text' ? 'none' : undefined,
            };

            addShape(newShape);
            // Don't emit yet, wait until mouse up to emit final shape? 
            // Or emit now? Better emit now so others see it appearing
            emitAddShape(newShape);

            // Auto-select immediately
            setSelectedIds([id]);
            setEditingId(tool === 'text' ? id : null); // If text, edit immediately? No wait for mouseup might correspond to drag completion.
            // Actually user complained dragging text didn't work. Keeping editingId null for now to allow drag.
        }
    };

    const handleMouseMove = (e: any) => {
        const stage = e.target.getStage();
        const pointer = stage.getPointerPosition();

        if (!pointer) return;

        const sc = stage.scaleX();
        const pos = stage.position();
        const x = (pointer.x - pos.x) / sc;
        const y = (pointer.y - pos.y) / sc;

        emitCursorMove({ x, y, username });

        // Handle Box Selection
        if (tool === 'select' && !spacePressed && startPosRef.current && !drawingShapeIdRef.current) {
            const startX = startPosRef.current.x;
            const startY = startPosRef.current.y;
            const width = x - startX;
            const height = y - startY;

            setSelectionBox({ x: startX, y: startY, width, height });
            return;
        }

        // Handle drawing resize
        if (drawingShapeIdRef.current && startPosRef.current) {
            const startX = startPosRef.current.x;
            const startY = startPosRef.current.y;

            let newX = startX;
            let newY = startY;
            let width = x - startX;
            let height = y - startY;

            // Handle negative width/height (dragging left/up)
            if (width < 0) {
                newX = x;
                width = Math.abs(width);
            }
            if (height < 0) {
                newY = y;
                height = Math.abs(height);
            }

            const updatedShape = {
                ...shapes.find(s => s.id === drawingShapeIdRef.current)!,
                x: newX,
                y: newY,
                width: Math.max(5, width), // Min size 5
                height: Math.max(5, height)
            };

            // Update local store immediately for smooth drawing
            updateShape(drawingShapeIdRef.current, updatedShape);

            // Throttle emit? For now just emit, assuming websocket handles it ok
            emitUpdateShape(updatedShape);
        }
    };

    const handleMouseUp = () => {
        // End box selection
        if (selectionBox) {
            const box = selectionBox;
            // Normalize box
            const x = box.width < 0 ? box.x + box.width : box.x;
            const y = box.height < 0 ? box.y + box.height : box.y;
            const w = Math.abs(box.width);
            const h = Math.abs(box.height);

            // Find overlapping shapes
            const foundIds = shapes.filter(shape => {
                // AABB intersection
                return (
                    x < shape.x + shape.width &&
                    x + w > shape.x &&
                    y < shape.y + shape.height &&
                    y + h > shape.y
                );
            }).map(s => s.id);

            setSelectedIds(foundIds);
            setSelectionBox(null);
            startPosRef.current = null;
            return;
        }

        if (drawingShapeIdRef.current) {
            // Default size enforcement if too small (single click creation)
            const shape = shapes.find(s => s.id === drawingShapeIdRef.current);
            if (shape) {
                // Minimum size enforcement
                const isText = tool === 'text';
                const defaultSize = tool === 'sticky' || tool === 'artboard' ? 150 : (isText ? 100 : 100);

                // If text, drag might define width, but height is auto-calculated usually
                // For now, let's just respect the dragged width for text too

                const updated = {
                    ...shape,
                    width: shape.width < 50 ? defaultSize : shape.width,
                    height: shape.height < 20 ? (isText ? shape.height : defaultSize) : shape.height
                };
                updateShape(shape.id, updated);
                emitUpdateShape(updated);

                // If text was created, enter edit mode
                if (isText) {
                    setEditingId(shape.id);
                }
            }

            drawingShapeIdRef.current = null;
            startPosRef.current = null;
        }
    };

    // Auto-switch to pointer when clicking an object
    // We can handle this by wrapping the shape onClick
    const handleShapeClick = (id: string, e: any) => {
        e.cancelBubble = true;
        if (tool !== 'select' && tool !== 'hand' && !spacePressed) {
            // If we are using a tool (like rect), clicking an existing shape usually shouldn't select it 
            // unless we want to replace it? 
            // But user request "if i click on something ... automatically goes to pointer tool"
            // implies they want to select it.
            setTool('select');
        }
        setSelectedIds([id]);
    };

    const handleWheel = (e: any) => {
        e.evt.preventDefault();
        const stage = stageRef.current;
        if (!stage) return;

        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const newScale = e.evt.deltaY < 0 ? oldScale * SCALE_BY : oldScale / SCALE_BY;

        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };

        setViewport(newScale, newPos);
    };

    const handleStageClick = () => {
        // Only handle clearing selection here if we didn't just draw
        // Note: mouseup fires before click
        // We can probably remove most logic from here as mousedown handles creation now
    };

    const handleStageDblClick = (e: any) => {
        // Check if we clicked on a shape
        if (e.target !== e.target.getStage()) {
            let clickedNode = e.target;
            console.log('Stage Double Click on:', clickedNode.className, clickedNode.id());

            // The shape ID might be on the group (parent) or the node itself
            let shapeId = clickedNode.id();
            if (!shapeId && clickedNode.getParent()) {
                shapeId = clickedNode.getParent().id();
            }

            console.log('Resolved Shape ID:', shapeId);

            const shape = shapes.find(s => s.id === shapeId);
            if (shape) {
                console.log('Found Shape:', shape.type);
                if (shape.type === 'text' || shape.type === 'sticky' || shape.type === 'artboard') {
                    console.log('Setting editingId');
                    setEditingId(shapeId);
                }
            } else {
                console.log('Shape not found in store');
            }
        } else {
            console.log('Clicked on stage directly');
        }
    };
    const renderShape = (shape: Shape) => {
        if (shape.type === 'image') {
            return <URLImage shape={shape} />;
        }

        if (shape.type === 'artboard') {
            return (
                <>
                    <Rect
                        width={shape.width}
                        height={shape.height}
                        fill="#ffffff"
                        stroke="#e0e0e0"
                        strokeWidth={1}
                    />
                    <Text
                        id={shape.id + '-label'} // Add partial ID so double click can find parent
                        text="Artboard"
                        y={-20}
                        fontSize={14}
                        fill="#999"
                    />
                </>
            );
        }
        if (shape.type === 'rectangle' || shape.type === 'sticky') {
            return (
                <>
                    <Rect
                        width={shape.width}
                        height={shape.height}
                        fill={shape.fill}
                        shadowBlur={shape.type === 'sticky' ? 5 : 0}
                        cornerRadius={shape.type === 'sticky' ? 2 : 4}
                    />
                    {shape.text && editingId !== shape.id && (
                        <Text
                            text={shape.text}
                            textDecoration={shape.textDecoration}
                            fontFamily={shape.fontFamily}
                            fontStyle={shape.fontStyle}
                            align={shape.align || 'center'}
                            width={shape.width} // Text needs width to wrap
                            fill="#333" // Fix: Always use dark text for sticky notes/rects
                            wrap="word"
                            ellipsis={true}
                            height={shape.height}
                            padding={10}
                            verticalAlign="middle"
                        />
                    )}
                </>
            );
        }

        if (shape.type === 'circle') {
            return (
                <Circle
                    radius={shape.width / 2}
                    fill={shape.fill}
                />
            );
        }

        if (shape.type === 'text') {
            return (
                <Text
                    text={editingId === shape.id ? '' : (shape.text || 'Type something...')}
                    fontSize={shape.fontSize || 24}
                    fontFamily={shape.fontFamily || 'Inter'}
                    fontStyle={shape.fontStyle || 'normal'}
                    textDecoration={shape.textDecoration || 'none'}
                    fill={shape.fill || '#333'}
                    width={shape.width}
                    align={shape.align || 'left'}
                />
            )
        }

        return null;
    };

    return (
        <>
            <div
                className="fixed inset-0 w-full h-full overflow-hidden canvas-grid"
                style={{
                    backgroundSize: `${20 * scale}px ${20 * scale}px`,
                    backgroundPosition: `${position.x}px ${position.y}px`,
                    cursor: tool === 'hand' || spacePressed ? 'grab' : (tool === 'select' ? 'default' : 'crosshair')
                }}
            >
                <Stage
                    ref={stageRef}
                    width={window.innerWidth}
                    height={window.innerHeight}
                    scaleX={scale}
                    scaleY={scale}
                    x={position.x}
                    y={position.y}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseUp={handleMouseUp}
                    onClick={handleStageClick}
                    onDblClick={handleStageDblClick}
                    onMouseMove={handleMouseMove}
                    draggable={(tool === 'hand' || spacePressed) && !drawingShapeIdRef.current && !selectionBox}
                    onDragMove={(e) => {
                        if (tool === 'hand' || spacePressed) {
                            setViewport(scale, { x: e.target.x(), y: e.target.y() });
                        }
                    }}
                >
                    <Layer>
                        {/* Background is now handled by CSS grid pattern */}
                        {shapes.map((shape) => {
                            const isSelected = selectedIds.includes(shape.id);
                            return (
                                <Group
                                    key={shape.id}
                                    id={shape.id}
                                    x={shape.x}
                                    y={shape.y}
                                    draggable={(tool === 'select' && !spacePressed) || (tool === 'hand' && false)} // Only draggable in select mode
                                    onClick={(e) => handleShapeClick(shape.id, e)}
                                    onDragStart={() => {
                                        // If not already selected, select it (exclusive)
                                        if (!selectedIds.includes(shape.id)) {
                                            setSelectedIds([shape.id]);
                                        }
                                        if (tool !== 'select') setTool('select'); // Auto-switch on drag too
                                    }}
                                    onDragEnd={(e: any) => {
                                        const updated = {
                                            ...shape,
                                            x: e.target.x(),
                                            y: e.target.y(),
                                        };
                                        updateShape(shape.id, updated);
                                        emitUpdateShape(updated);
                                    }}
                                    onTransformEnd={(e: any) => {
                                        const node = e.target;
                                        const scaleX = node.scaleX();
                                        const scaleY = node.scaleY();

                                        // Reset scale to 1
                                        node.scaleX(1);
                                        node.scaleY(1);

                                        // For Groups (sticky notes, rectangles), we need to get the actual shape dimensions
                                        // The group itself might have width/height of 0
                                        let baseWidth = shape.width;
                                        let baseHeight = shape.height;

                                        // Calculate new width/height based on the scale applied
                                        let newWidth = baseWidth * scaleX;
                                        let newHeight = baseHeight * scaleY;
                                        let newX = node.x();
                                        let newY = node.y();

                                        // Handle horizontal flipping
                                        if (newWidth < 0) {
                                            newX += newWidth;
                                            newWidth = Math.abs(newWidth);
                                        }

                                        // Handle vertical flipping
                                        if (newHeight < 0) {
                                            newY += newHeight;
                                            newHeight = Math.abs(newHeight);
                                        }

                                        // Enforce minimum size
                                        newWidth = Math.max(20, newWidth);
                                        newHeight = Math.max(20, newHeight);

                                        const updated = {
                                            ...shape,
                                            x: newX,
                                            y: newY,
                                            width: newWidth,
                                            height: newHeight,
                                        };

                                        updateShape(shape.id, updated);
                                        emitUpdateShape(updated);
                                    }}
                                    onContextMenu={(e: any) => {
                                        e.evt.preventDefault();
                                        if (confirm('Delete this shape?')) {
                                            removeShape(shape.id);
                                            emitRemoveShape(shape.id);
                                            setSelectedIds([]);
                                        }
                                    }}
                                    stroke={isSelected ? '#2196f3' : 'transparent'}
                                    strokeWidth={2}
                                >
                                    {renderShape(shape)}
                                </Group>
                            );
                        })}

                        {/* Render multiplayer cursors */}
                        {Object.values(cursors).map((cursor) => (
                            <Group key={cursor.id} x={cursor.x} y={cursor.y}>
                                {/* Cursor Pointer (Arrow) */}
                                <Path
                                    data="M0,0 L12,12 L8,12 L12,20 L10,21 L6,13 L2,17 L0,0Z"
                                    fill={cursor.color}
                                    stroke="white"
                                    strokeWidth={1}
                                />

                                {/* Label Bubble */}
                                <Group x={16} y={0}>
                                    <Rect
                                        width={Math.max(60, (cursor.username?.length || 8) * 8)}
                                        height={22}
                                        fill={cursor.color}
                                        cornerRadius={[0, 8, 8, 8]}
                                        shadowColor="black"
                                        shadowBlur={2}
                                        shadowOpacity={0.2}
                                        shadowOffset={{ x: 1, y: 1 }}
                                    />
                                    <Text
                                        text={cursor.username || cursor.id.slice(0, 8)}
                                        fontSize={12}
                                        fill="#ffffff"
                                        fontStyle="bold"
                                        padding={5}
                                        y={5}
                                    />
                                </Group>
                            </Group>
                        ))}

                        {/* Selection Box Render */}
                        {selectionBox && (
                            <Rect
                                x={selectionBox.x}
                                y={selectionBox.y}
                                width={selectionBox.width}
                                height={selectionBox.height}
                                fill="rgba(33, 150, 243, 0.2)"
                                stroke="#2196f3"
                                strokeWidth={1}
                            />
                        )}

                        {selectedIds.length > 0 && <Transformer ref={transformerRef} />}
                    </Layer>
                </Stage>

                {editingId && shapes.find(s => s.id === editingId) && (
                    <InPlaceEditor
                        shape={shapes.find(s => s.id === editingId)!}
                        scale={scale}
                        position={position}
                        onBlur={() => setEditingId(null)}
                        onUpdate={(text, height) => {
                            const shape = shapes.find(s => s.id === editingId)!;
                            const updated = {
                                ...shape,
                                text,
                                height: Math.max(shape.height, height)
                            };
                            updateShape(editingId, updated);
                            emitUpdateShape(updated);
                        }}
                    />
                )}
            </div>

            {/* Top Bar Overlay */}
            <div className="fixed top-0 left-0 right-0 h-16 pointer-events-none z-50 flex items-center justify-between px-6 pt-3">
                {/* Left: Branding & Board Info */}
                <div className="pointer-events-auto flex items-center gap-3 bg-white/95 backdrop-blur-xl px-4 py-2.5 rounded-xl shadow-md border border-gray-200/50 hover:shadow-lg transition-shadow">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg text-white font-bold text-xs tracking-tight shadow-sm">
                        WB
                    </div>
                    <div className="h-5 w-px bg-gray-200"></div>
                    <div>
                        <h1 className="font-semibold text-gray-900 text-sm leading-tight">{boardName || `Board ${boardId.slice(0, 8)}`}</h1>
                        <p className="text-[10px] text-gray-500 font-medium">Saved just now</p>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="pointer-events-auto flex items-center gap-2">

                    {/* Active Users List */}
                    <div className="flex items-center -space-x-2 mr-2">
                        {Object.values(cursors).slice(0, 3).map((cursor) => (
                            <div
                                key={cursor.id}
                                className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
                                style={{ backgroundColor: cursor.color }}
                                title={cursor.username || cursor.id}
                            >
                                {(cursor.username || cursor.id).slice(0, 2).toUpperCase()}
                            </div>
                        ))}
                        {Object.values(cursors).length > 3 && (
                            <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-gray-600 text-[10px] font-bold shadow-sm">
                                +{Object.values(cursors).length - 3}
                            </div>
                        )}

                        {/* Current User Avatar */}
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-white shadow-md cursor-pointer hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center text-white text-xs font-bold z-10">
                            {username ? username.slice(0, 2).toUpperCase() : 'ME'}
                        </div>
                    </div>

                    {/* Separator */}
                    <div className="h-8 w-px bg-gray-200 mx-1"></div>

                    {/* Exit Board */}
                    <button
                        onClick={() => window.location.href = '/'}
                        className="bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 px-4 py-2.5 rounded-lg border border-gray-200 shadow-sm text-sm font-medium transition-all hover:border-gray-300 flex items-center gap-2"
                        title="Exit Board"
                    >
                        <LogOut size={16} strokeWidth={2} />
                        Exit
                    </button>
                </div>
            </div>

            {/* Zoom Controls (Bottom Right) */}
            <div className="fixed bottom-6 right-6 flex flex-col gap-2 pointer-events-auto shadow-lg bg-white rounded-lg p-1 border border-gray-100">
                <button
                    className="p-2 hover:bg-gray-50 text-gray-700 rounded transition-colors"
                    onClick={() => {
                        const newScale = scale * 1.2;
                        setViewport(newScale, position);
                    }}
                    title="Zoom In"
                >
                    <Plus size={20} />
                </button>
                <div className="h-px bg-gray-100 mx-2"></div>
                <button
                    className="p-2 hover:bg-gray-50 text-gray-700 rounded transition-colors"
                    onClick={() => {
                        const newScale = scale / 1.2;
                        setViewport(newScale, position);
                    }}
                    title="Zoom Out"
                >
                    <Minus size={20} />
                </button>
            </div>

            {/* Username Modal */}
            {showUsernameModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-fade-in">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Hi, who's there?!</h2>
                        <p className="text-gray-600 mb-6">Let others know who you are</p>

                        <input
                            type="text"
                            value={tempUsername}
                            onChange={(e) => setTempUsername(e.target.value)}
                            placeholder="Enter your name..."
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors mb-4 text-lg"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && tempUsername.trim()) {
                                    const finalUsername = tempUsername.trim();
                                    setUsername(finalUsername);
                                    if (rememberMe) {
                                        localStorage.setItem('miro-username', finalUsername);
                                    }
                                    setShowUsernameModal(false);
                                }
                            }}
                        />

                        <label className="flex items-center gap-2 mb-6 cursor-pointer group">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-5 h-5 rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            />
                            <span className="text-gray-700 group-hover:text-gray-900 transition-colors">Remember me</span>
                        </label>

                        <button
                            onClick={() => {
                                if (tempUsername.trim()) {
                                    const finalUsername = tempUsername.trim();
                                    setUsername(finalUsername);
                                    if (rememberMe) {
                                        localStorage.setItem('miro-username', finalUsername);
                                    }
                                    setShowUsernameModal(false);
                                }
                            }}
                            disabled={!tempUsername.trim()}
                            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed"
                        >
                            Join Board
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
