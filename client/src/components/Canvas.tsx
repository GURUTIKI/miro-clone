import React, { useRef, useLayoutEffect } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Image as KonvaImage, Path, Line } from 'react-konva';
import useImage from 'use-image';
import { useBoardStore } from '../store/useBoardStore';
import type { Shape } from '../store/useBoardStore';
import { v4 as uuidv4 } from 'uuid';
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
    const [localValue, setLocalValue] = React.useState(shape.text || '');

    const adjustHeight = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const newHeight = textarea.scrollHeight;
            textarea.style.height = `${newHeight}px`;
        }
    };

    useLayoutEffect(() => {
        adjustHeight();
    }, [localValue]); // Adjust height when local text changes

    const handleCommit = () => {
        const textarea = textareaRef.current;
        if (textarea) {
            const height = textarea.scrollHeight;
            useBoardStore.getState().saveToHistory();
            onUpdate(localValue, height / scale);
        }
        onBlur();
    };

    return (
        <textarea
            ref={textareaRef}
            className="text-editor-inplace"
            style={{
                position: 'fixed',
                top: ((shape.y + (shape.type === 'artboard' ? -20 : 0)) * scale) + position.y,
                left: (shape.x * scale) + position.x,
                width: shape.width * scale,
                minHeight: (shape.type === 'artboard' ? 24 : shape.height) * scale,
                fontSize: (shape.fontSize || (shape.type === 'text' ? 24 : (shape.type === 'artboard' ? 14 : 16))) * scale,
                fontFamily: shape.fontFamily || 'Inter',
                fontStyle: shape.fontStyle || 'normal',
                textDecoration: shape.textDecoration || 'none',
                color: shape.type === 'text' ? (shape.fill || '#000000') : '#000000',
                textAlign: (shape.align as any) || (shape.type === 'text' ? 'left' : 'center'),
                paddingTop: shape.type === 'sticky' ? (shape.height * scale / 3) : '2px',
                paddingLeft: shape.type === 'text' ? '0' : '10px',
                paddingRight: shape.type === 'text' ? '0' : '10px',
            }}
            value={localValue}
            autoFocus
            onChange={(e) => {
                setLocalValue(e.target.value);
                // Height adjustment handled by useLayoutEffect via dependency
            }}
            onBlur={handleCommit}
            onKeyDown={(e) => {
                // Stop propagation so backspace doesn't delete the shape
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommit();
                }
            }}
        />
    );
};

// Define props interface
interface CanvasProps {
    boardId: string;
    socket: any; // Using any for simplicity as socket type is imported, strict typing preferred: Socket | null
    emitAddShape: (shape: Shape) => void;
    emitUpdateShape: (shape: Shape) => void;
    emitRemoveShape: (id: string) => void;
    emitCursorMove: (cursor: { x: number; y: number; username?: string }) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
    boardId,
    socket,
    emitAddShape,
    emitUpdateShape,
    emitRemoveShape,
    emitCursorMove
}) => {
    const stageRef = useRef<any>(null);
    const transformerRef = useRef<any>(null);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [spacePressed, setSpacePressed] = React.useState(false);
    const drawingShapeIdRef = React.useRef<string | null>(null);

    // Username modal state
    const [showUsernameModal, setShowUsernameModal] = React.useState(false);
    const [username, setUsername] = React.useState('');
    const [rememberMe, setRememberMe] = React.useState(false);
    const [tempUsername, setTempUsername] = React.useState('');
    const startPosRef = React.useRef<{ x: number, y: number } | null>(null);

    const [selectionBox, setSelectionBox] = React.useState<{ x: number, y: number, width: number, height: number } | null>(null);

    const {
        tool, setTool, shapes, cursors, addShape, updateShape, removeShape,
        selectedIds, setSelectedIds, scale, position, setViewport,
        activeColor, boardName, saveToHistory, undo, redo, copy, paste
    } = useBoardStore();
    // Socket connection is now handled by parent
    // const { emitAddShape, emitUpdateShape, emitCursorMove, emitRemoveShape, socket } = useSocket(boardId);

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
                const API_URL = import.meta.env.VITE_API_URL || 'https://miro-clone-5oig.onrender.com';
                const res = await fetch(`${API_URL}/boards/${boardId}`);
                if (res.ok) {
                    const data = await res.json();
                    useBoardStore.getState().setBoardName(data.name);
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
                .map(id => {
                    const node = stage.findOne('#' + id);
                    if (!node) return null;
                    // Skip transformer nodes for pen tool
                    const shape = shapes.find(s => s.id === id);
                    if (shape?.type === 'pen') return null;
                    return node;
                })
                .filter(node => node !== null);

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
            // Delete / Backspace
            if ((e.key === 'Backspace' || e.key === 'Delete')) {
                // If editing text, do not delete shapes
                if (editingId) return;

                if (selectedIds.length > 0) {
                    e.preventDefault(); // Prevent browser back navigation
                    console.log('Deleting shapes:', selectedIds);

                    const toRemove = selectedIds.filter(id => {
                        const s = shapes.find(shape => shape.id === id);
                        return !s?.locked;
                    });

                    if (toRemove.length > 0) {
                        saveToHistory();
                        toRemove.forEach(id => {
                            removeShape(id);
                            emitRemoveShape(id);
                        });
                        setSelectedIds([]);
                    }
                }
            }

            // Undo (Cmd+Z / Ctrl+Z)
            if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
                if (editingId) return;
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
            }

            // Copy (Cmd+C / Ctrl+C)
            if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
                if (editingId) return;
                copy();
            }

            // Paste (Cmd+V / Ctrl+V)
            if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
                if (editingId) return;
                // Get pointer position for paste
                const stage = stageRef.current;
                if (stage) {
                    const sc = stage.scaleX();
                    const pointer = stage.getPointerPosition();
                    if (pointer) {
                        const x = (pointer.x - stage.x()) / sc;
                        const y = (pointer.y - stage.y()) / sc;
                        saveToHistory();
                        const pasted = paste({ x, y });
                        pasted.forEach(s => emitAddShape(s));
                    }
                }
            }

            // Space for Panning
            if (e.code === 'Space' && !editingId && tool !== 'text') {
                if (!spacePressed) {
                    setSpacePressed(true);
                }
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
    }, [selectedIds, editingId, removeShape, emitRemoveShape, setSelectedIds, tool, shapes, saveToHistory, undo, redo, copy, paste, spacePressed]);

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
            const pos = stage.getPointerPosition(); // Use getPointerPosition for drawing start
            const x = (pos.x - stage.x()) / sc;
            const y = (pos.y - stage.y()) / sc;

            const id = uuidv4();
            drawingShapeIdRef.current = id;

            if (['rectangle', 'circle', 'artboard', 'sticky', 'text', 'image'].includes(tool)) {
                const newShape: Shape = {
                    id,
                    type: tool,
                    x,
                    y,
                    width: 5,
                    height: 5,
                    fill: activeColor,
                    ...(tool === 'text' ? { text: 'Type here', fontSize: 24 } : {}),
                    ...(tool === 'sticky' ? { width: 150, height: 150 } : {}),
                    ...(tool === 'artboard' ? { width: 400, height: 300, fill: activeColor } : {})
                };

                addShape(newShape);
                emitAddShape(newShape);
                drawingShapeIdRef.current = id;
                startPosRef.current = { x, y };
                setSelectedIds([id]);
            } else if (tool === 'pen') {
                const newShape: Shape = {
                    id,
                    type: 'pen',
                    x: 0, // Pen tool coordinates are absolute within its points array
                    y: 0,
                    width: 0,
                    height: 0,
                    fill: 'transparent',
                    points: [x, y],
                    stroke: activeColor,
                    strokeWidth: useBoardStore.getState().penWidth
                };

                addShape(newShape);
                emitAddShape(newShape);
                drawingShapeIdRef.current = id;
                startPosRef.current = { x, y };
                setSelectedIds([id]);
            }
        }
    };

    const handleMouseMove = (e: any) => {
        const stage = e.target.getStage();
        const pointer = stage.getPointerPosition();

        if (!pointer) return;

        const sc = stage.scaleX();
        const pos = {
            x: (pointer.x - stage.x()) / sc,
            y: (pointer.y - stage.y()) / sc
        };

        emitCursorMove({ x: pos.x, y: pos.y, username });

        // Handle Box Selection
        if (tool === 'select' && !spacePressed && startPosRef.current && !drawingShapeIdRef.current) {
            const startX = startPosRef.current.x;
            const startY = startPosRef.current.y;
            const width = pos.x - startX;
            const height = pos.y - startY;

            setSelectionBox({ x: startX, y: startY, width, height });
            return;
        }

        // Handle drawing resize or pen drawing
        if (drawingShapeIdRef.current && startPosRef.current) {
            const shape = shapes.find(s => s.id === drawingShapeIdRef.current);
            if (!shape) return;

            if (shape.type === 'pen') {
                const newPoints = [...(shape.points || []), pos.x, pos.y];
                const updatedShape = { ...shape, points: newPoints };
                updateShape(shape.id, updatedShape);
                emitUpdateShape(updatedShape);
            } else {
                const startX = startPosRef.current.x;
                const startY = startPosRef.current.y;

                const width = pos.x - startX;
                const height = pos.y - startY;

                const updatedShape = {
                    ...shape,
                    x: width < 0 ? pos.x : startX,
                    y: height < 0 ? pos.y : startY,
                    width: Math.abs(width),
                    height: Math.abs(height)
                };

                updateShape(shape.id, updatedShape);
                emitUpdateShape(updatedShape);
            }
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
                let sX = shape.x;
                let sY = shape.y;
                let sW = shape.width;
                let sH = shape.height;

                // For pen tools, we calculate the bounding box from points
                if (shape.type === 'pen' && shape.points) {
                    const pts = shape.points;
                    let minX = pts[0], maxX = pts[0], minY = pts[1], maxY = pts[1];
                    for (let i = 0; i < pts.length; i += 2) {
                        minX = Math.min(minX, pts[i]);
                        maxX = Math.max(maxX, pts[i]);
                        minY = Math.min(minY, pts[i + 1]);
                        maxY = Math.max(maxY, pts[i + 1]);
                    }
                    sX = minX;
                    sY = minY;
                    sW = maxX - minX;
                    sH = maxY - minY;
                }

                // AABB intersection
                return (
                    x < sX + sW &&
                    x + w > sX &&
                    y < sY + sH &&
                    y + h > sY
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
                saveToHistory(); // Save after creation/resize is finalized

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

            // Handle artboard labels which have "-label" suffix
            if (shapeId && shapeId.endsWith('-label')) {
                shapeId = shapeId.replace('-label', '');
            }

            if (!shapeId && clickedNode.getParent()) {
                shapeId = clickedNode.getParent().id();
                if (shapeId && shapeId.endsWith('-label')) {
                    shapeId = shapeId.replace('-label', '');
                }
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
                        cornerRadius={4}
                    />
                    <Text
                        id={shape.id + '-label'}
                        text={shape.text || (shape.locked ? "Artboard (Locked)" : "Artboard")}
                        y={-20}
                        fontSize={14}
                        fill={shape.locked ? "#ef4444" : "#999"}
                        fontStyle={(shape.locked || shape.text) ? "bold" : "normal"}
                    />
                    <Group
                        x={shape.width - 24}
                        y={-28}
                        onClick={(e) => {
                            e.cancelBubble = true;
                            useBoardStore.getState().toggleLock(shape.id);
                        }}
                    >
                        <Rect width={24} height={24} fill="transparent" />
                        <Text
                            text={shape.locked ? "🔒" : "🔓"}
                            fontSize={16}
                            align="center"
                            verticalAlign="middle"
                        />
                    </Group>
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

        if (shape.type === 'pen') {
            return (
                <Line
                    points={shape.points || []}
                    stroke={shape.stroke || '#000'}
                    strokeWidth={shape.strokeWidth || 3}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                />
            );
        }

        return null;
    };

    return (
        <>
            <div
                className="fixed inset-0 w-full h-full overflow-hidden canvas-grid"
                style={{
                    backgroundSize: `${20 * scale}px ${20 * scale} px`,
                    backgroundPosition: `${position.x}px ${position.y} px`,
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
                                    x={shape.type === 'pen' ? 0 : shape.x} // Pen tool handles its own coordinates
                                    y={shape.type === 'pen' ? 0 : shape.y} // Pen tool handles its own coordinates
                                    draggable={(tool === 'select' && !spacePressed) || (tool === 'hand' && false)} // Only draggable in select mode
                                    onClick={(e) => handleShapeClick(shape.id, e)}
                                    onDragStart={(e: any) => {
                                        if (shape.locked) {
                                            e.target.stopDrag();
                                            return;
                                        }
                                        // If not already selected, select it (exclusive)
                                        if (!selectedIds.includes(shape.id)) {
                                            setSelectedIds([shape.id]);
                                        }
                                        if (tool !== 'select') setTool('select'); // Auto-switch on drag too
                                    }}
                                    onDragEnd={(e: any) => {
                                        if (shape.locked) return;
                                        const updated = {
                                            ...shape,
                                            x: e.target.x(),
                                            y: e.target.y(),
                                        };
                                        saveToHistory();
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

                                        saveToHistory();
                                        updateShape(shape.id, updated);
                                        emitUpdateShape(updated);
                                    }}
                                    onContextMenu={(e: any) => {
                                        e.evt.preventDefault();
                                        if (confirm('Delete this shape?')) {
                                            saveToHistory();
                                            removeShape(shape.id);
                                            emitRemoveShape(shape.id);
                                            setSelectedIds([]);
                                        }
                                    }}
                                    stroke={(isSelected && shape.type !== 'pen') ? (shape.locked ? '#ef4444' : '#2196f3') : 'transparent'}
                                    strokeWidth={2}
                                >
                                    {renderShape(shape)}
                                </Group>
                            );
                        })}

                        {/* Render multiplayer cursors */}
                        {Object.values(cursors)
                            .filter(cursor => cursor.id !== socket?.id && cursor.id !== 'undefined') // Filter out self and invalid IDs
                            .map((cursor) => (
                                <Group key={cursor.id} x={cursor.x} y={cursor.y}>
                                    {/* Cursor Pointer (Navigation Arrow matching local style) */}
                                    <Path
                                        data="M6 3L13 22L17 14L25 11L6 3Z"
                                        fill={cursor.color}
                                        stroke="white"
                                        strokeWidth={2}
                                        lineJoin="round"
                                        lineCap="round"
                                        shadowColor="black"
                                        shadowBlur={4}
                                        shadowOpacity={0.2}
                                        shadowOffset={{ x: 2, y: 2 }}
                                    />

                                    {/* User Name Label */}
                                    <Text
                                        text={cursor.username || cursor.id.slice(0, 8)}
                                        fontSize={14}
                                        fill={cursor.color}
                                        fontStyle="bold"
                                        x={28}
                                        y={18}
                                        align="left"
                                        verticalAlign="middle"
                                        shadowColor="white"
                                        shadowBlur={0}
                                        shadowOffset={{ x: 1, y: 1 }}
                                        shadowOpacity={1}
                                    />
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
                <div className="pointer-events-auto flex items-center gap-3 bg-[var(--bg-toolbar)] backdrop-blur-xl px-4 py-2.5 rounded-xl shadow-md border border-[var(--border-ui)] hover:shadow-lg transition-shadow">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-2 rounded-lg text-white font-bold text-xs tracking-tight shadow-sm">
                        WB
                    </div>
                    <div className="h-5 w-px bg-[var(--border-ui)]"></div>
                    <div>
                        <h1 className="font-semibold text-[var(--text-primary)] text-sm leading-tight">{boardName || `Board ${boardId.slice(0, 8)} `}</h1>
                        <p className="text-[10px] text-[var(--text-secondary)] font-medium">Saved just now</p>
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
                    <div className="h-8 w-px bg-[var(--border-ui)] mx-1"></div>

                    {/* Exit Board */}
                    <button
                        onClick={() => window.location.href = '/'}
                        className="bg-[var(--bg-toolbar)] hover:bg-opacity-90 text-[var(--text-primary)] px-4 py-2.5 rounded-lg border border-[var(--border-ui)] shadow-sm text-sm font-medium transition-all hover:border-blue-500/50 flex items-center gap-2"
                        title="Exit Board"
                    >
                        <LogOut size={16} strokeWidth={2} />
                        Exit
                    </button>
                </div>
            </div>

            {/* Zoom Controls (Bottom Right) */}
            <div className="fixed bottom-6 right-6 flex flex-col gap-2 pointer-events-auto shadow-lg bg-[var(--bg-toolbar)] backdrop-blur-xl rounded-lg p-1 border border-[var(--border-ui)]">
                <button
                    className="p-2 hover:bg-[var(--bg-canvas)] text-[var(--text-primary)] rounded transition-colors"
                    onClick={() => {
                        const newScale = scale * 1.2;
                        setViewport(newScale, position);
                    }}
                    title="Zoom In"
                >
                    <Plus size={20} />
                </button>
                <div className="h-px bg-[var(--border-ui)] mx-2"></div>
                <button
                    className="p-2 hover:bg-[var(--bg-canvas)] text-[var(--text-primary)] rounded transition-colors"
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
            {/* UI Overlays */}
            {selectedIds.length === 1 && (
                <DimensionIndicator
                    shape={shapes.find(s => s.id === selectedIds[0])}
                    updateShape={updateShape}
                    emitUpdateShape={emitUpdateShape}
                />
            )}
        </>
    );
};

const DimensionIndicator = ({ shape, updateShape, emitUpdateShape }: any) => {
    if (!shape || shape.type === 'pen' || shape.type === 'hand' || shape.type === 'select') return null;

    const [localDimensions, setLocalDimensions] = React.useState({ width: shape.width, height: shape.height });

    React.useEffect(() => {
        setLocalDimensions({ width: Math.round(shape.width), height: Math.round(shape.height) });
    }, [shape.width, shape.height]);

    const handleCommit = (e: React.KeyboardEvent | React.FocusEvent) => {
        const updates = {
            width: Number((e.currentTarget as any).form?.width?.value) || localDimensions.width,
            height: Number((e.currentTarget as any).form?.height?.value) || localDimensions.height
        };
        const updated = { ...shape, ...updates };
        updateShape(shape.id, updated);
        emitUpdateShape(updated);
    };

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-[var(--bg-toolbar)] backdrop-blur-xl p-2 rounded-2xl shadow-[var(--shadow-ui)] border border-[var(--border-ui)] flex items-center gap-3 animate-fade-in z-50">
            <form className="flex items-center gap-2" onSubmit={(e) => e.preventDefault()}>
                <div className="flex items-center gap-1.5 px-2">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">W</span>
                    <input
                        name="width"
                        type="number"
                        value={localDimensions.width}
                        onChange={(e) => setLocalDimensions(prev => ({ ...prev, width: Number(e.target.value) }))}
                        onBlur={handleCommit}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') handleCommit(e);
                        }}
                        className="w-16 bg-transparent text-sm font-medium text-[var(--text-primary)] focus:outline-none"
                    />
                </div>
                <div className="w-px h-4 bg-[var(--border-ui)]"></div>
                <div className="flex items-center gap-1.5 px-2">
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]">H</span>
                    <input
                        name="height"
                        type="number"
                        value={localDimensions.height}
                        onChange={(e) => setLocalDimensions(prev => ({ ...prev, height: Number(e.target.value) }))}
                        onBlur={handleCommit}
                        onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') handleCommit(e);
                        }}
                        className="w-16 bg-transparent text-sm font-medium text-[var(--text-primary)] focus:outline-none"
                    />
                </div>
            </form>
        </div>
    );
};
