import React, { useRef, useLayoutEffect } from 'react';
import { Stage, Layer, Rect, Circle, Text, Group, Transformer, Image as KonvaImage, Line, Path } from 'react-konva';
import useImage from 'use-image';
import { useBoardStore } from '../store/useBoardStore';
import type { Shape } from '../store/useBoardStore';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Plus, Minus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShareMenu } from './ShareMenu';
import { Toolbar } from './Toolbar';

const SCALE_BY = 1.05;

const URLImage: React.FC<{ shape: Shape }> = ({ shape }) => {
    const [image] = useImage(shape.imageUrl || '', 'anonymous');
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
    }, [localValue]);

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
                width: (shape.type === 'artboard' ? 300 : shape.width) * scale,
                minHeight: (shape.type === 'artboard' ? 24 : shape.height) * scale,
                fontSize: (shape.fontSize || (shape.type === 'text' ? 24 : (shape.type === 'artboard' ? 14 : 16))) * scale,
                fontFamily: shape.fontFamily || 'Inter',
                fontStyle: shape.fontStyle || 'normal',
                textDecoration: shape.textDecoration || 'none',
                color: shape.type === 'text' ? (shape.fill || '#000000') : '#333333',
                textAlign: (shape.align as any) || (shape.type === 'text' || shape.type === 'artboard' ? 'left' : 'center'),
                paddingTop: shape.type === 'sticky' ? (shape.height * scale / 3) : '2px',
                paddingLeft: (shape.type === 'text' || shape.type === 'artboard') ? '0' : '10px',
                paddingRight: (shape.type === 'text' || shape.type === 'artboard') ? '0' : '10px',
            }}
            value={localValue}
            autoFocus
            onChange={(e) => {
                setLocalValue(e.target.value);
            }}
            onBlur={handleCommit}
            onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCommit();
                }
            }}
        />
    );
};

interface CanvasProps {
    boardId: string;
    socket: any;
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
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [spacePressed, setSpacePressed] = React.useState(false);
    const drawingShapeIdRef = React.useRef<string | null>(null);
    const [showUsernameModal, setShowUsernameModal] = React.useState(false);
    const [username, setUsername] = React.useState('');
    const [tempUsername, setTempUsername] = React.useState('');
    const startPosRef = React.useRef<{ x: number, y: number } | null>(null);
    const [selectionBox, setSelectionBox] = React.useState<{ x: number, y: number, width: number, height: number } | null>(null);

    const {
        tool, setTool, shapes, cursors, addShape, updateShape, removeShape,
        selectedIds, setSelectedIds, scale, position, setViewport,
        activeColor, boardName, saveToHistory, undo, redo, copy, paste,
        isReadOnly, setIsReadOnly, setShareSettings
    } = useBoardStore();

    const emitBoardRename = (newName: string) => {
        // Optimistic update is already handled by store
        if (socket) {
            socket.emit('board-renamed', newName);
        }
    };

    React.useEffect(() => {
        const savedUsername = localStorage.getItem('miro-username');
        if (savedUsername) {
            setUsername(savedUsername);
        } else {
            setShowUsernameModal(true);
        }
    }, []);

    React.useEffect(() => {
        const fetchBoardData = async () => {
            try {
                const API_URL = import.meta.env.VITE_API_URL || 'https://miro-clone-5oig.onrender.com';
                const token = searchParams.get('token');
                const res = await fetch(`${API_URL}/boards/${boardId}${token ? `?token=${token}` : ''}`);
                if (res.ok) {
                    const data = await res.json();
                    useBoardStore.getState().setBoardName(data.name);
                    useBoardStore.getState().setShareSettings({
                        isPublic: data.isPublic,
                        sharePermission: data.sharePermission,
                        shareToken: data.shareToken
                    });

                    const isCompanyUser = !!(localStorage.getItem('company') || sessionStorage.getItem('company'));
                    if (!isCompanyUser) {
                        if (data.isPublic && data.sharePermission === 'view') {
                            setIsReadOnly(true);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to fetch board data:', error);
            }
        };
        fetchBoardData();
    }, [boardId, searchParams, setIsReadOnly, setShareSettings]);

    React.useEffect(() => {
        if (transformerRef.current) {
            const stage = stageRef.current;
            const nodes = selectedIds
                .map(id => {
                    const node = stage.findOne('#' + id);
                    if (!node) return null;
                    const shape = shapes.find(s => s.id === id);
                    // Enable transformer for everything except pen strokes as requested
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
            if (isReadOnly) return;
            if ((e.key === 'Backspace' || e.key === 'Delete')) {
                if (editingId) return;
                if (selectedIds.length > 0) {
                    e.preventDefault();
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

            if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
                if (editingId) return;
                e.preventDefault();
                if (e.shiftKey) redo();
                else undo();
            }

            if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
                if (editingId) return;
                copy();
            }

            if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
                if (editingId) return;
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
    }, [selectedIds, editingId, removeShape, emitRemoveShape, setSelectedIds, tool, shapes, saveToHistory, undo, redo, copy, paste, spacePressed, isReadOnly, emitAddShape]);

    const handleMouseDown = (e: any) => {
        if (isReadOnly) return;
        if (e.target === e.target.getStage()) {
            if (tool === 'select' && !spacePressed) {
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

            if (tool === 'hand' || spacePressed) return;

            const stage = stageRef.current;
            const sc = stage.scaleX();
            const pointer = stage.getPointerPosition();
            const x = (pointer.x - stage.x()) / sc;
            const y = (pointer.y - stage.y()) / sc;

            const id = uuidv4();
            drawingShapeIdRef.current = id;

            if (['rectangle', 'circle', 'artboard', 'sticky', 'text', 'image'].includes(tool)) {
                const newShape: Shape = {
                    id,
                    type: tool as any,
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
                startPosRef.current = { x, y };
                setSelectedIds([id]);
            } else if (tool === 'pen') {
                const newShape: Shape = {
                    id,
                    type: 'pen',
                    x: 0,
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

        if (isReadOnly) return;

        if (tool === 'select' && !spacePressed && startPosRef.current && !drawingShapeIdRef.current) {
            const startX = startPosRef.current.x;
            const startY = startPosRef.current.y;
            const width = pos.x - startX;
            const height = pos.y - startY;

            setSelectionBox({ x: startX, y: startY, width, height });
            return;
        }

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
        if (isReadOnly) return;
        if (selectionBox) {
            const box = selectionBox;
            const x = box.width < 0 ? box.x + box.width : box.x;
            const y = box.height < 0 ? box.y + box.height : box.y;
            const w = Math.abs(box.width);
            const h = Math.abs(box.height);

            const foundIds = shapes.filter(shape => {
                let sX = shape.x;
                let sY = shape.y;
                let sW = shape.width;
                let sH = shape.height;

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

                return (x < sX + sW && x + w > sX && y < sY + sH && y + h > sY);
            }).map(s => s.id);

            setSelectedIds(foundIds);
            setSelectionBox(null);
            startPosRef.current = null;
            return;
        }

        if (drawingShapeIdRef.current) {
            const shape = shapes.find(s => s.id === drawingShapeIdRef.current);
            if (shape) {
                const isText = tool === 'text';
                const defaultSize = tool === 'sticky' || tool === 'artboard' ? 150 : 100;

                const updated = {
                    ...shape,
                    width: shape.width < 50 ? (isText ? shape.width : defaultSize) : shape.width,
                    height: shape.height < 20 ? (isText ? shape.height : defaultSize) : shape.height
                };
                updateShape(shape.id, updated);
                emitUpdateShape(updated);
                saveToHistory();

                if (isText) {
                    setEditingId(shape.id);
                }
            }
            drawingShapeIdRef.current = null;
            startPosRef.current = null;
        }
    };

    const handleShapeClick = (id: string, e: any) => {
        e.cancelBubble = true;
        if (isReadOnly) return;
        if (tool !== 'select' && tool !== 'hand' && !spacePressed) {
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

    const handleStageDblClick = (e: any) => {
        if (isReadOnly) return;
        if (e.target !== e.target.getStage()) {
            let clickedNode = e.target;
            let shapeId = clickedNode.id();
            if (shapeId && shapeId.endsWith('-label')) shapeId = shapeId.replace('-label', '');
            if (!shapeId && clickedNode.getParent()) {
                shapeId = clickedNode.getParent().id();
                if (shapeId && shapeId.endsWith('-label')) shapeId = shapeId.replace('-label', '');
            }

            const shape = shapes.find(s => s.id === shapeId);
            if (shape && (shape.type === 'text' || shape.type === 'sticky' || shape.type === 'artboard')) {
                setEditingId(shapeId);
            }
        }
    };

    const renderShape = (shape: Shape) => {
        if (shape.type === 'image') return <URLImage shape={shape} />;
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
                    {editingId !== shape.id && (
                        <Text
                            id={shape.id + '-label'}
                            text={shape.text || (shape.locked ? "Artboard (Locked)" : "Artboard")}
                            y={-20}
                            fontSize={14}
                            fill={shape.locked ? "#ef4444" : "#999"}
                            fontStyle={(shape.locked || shape.text) ? "bold" : "normal"}
                        />
                    )}
                    <Group
                        x={shape.width - 24}
                        y={-28}
                        onClick={(e) => {
                            e.cancelBubble = true;
                            if (isReadOnly) return;
                            useBoardStore.getState().toggleLock(shape.id);
                        }}
                    >
                        <Rect width={24} height={24} fill="transparent" />
                        <Text text={shape.locked ? "🔒" : "🔓"} fontSize={16} align="center" verticalAlign="middle" />
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
                            align={shape.align || 'center'}
                            width={shape.width}
                            fill="#333"
                            wrap="word"
                            height={shape.height}
                            padding={10}
                            verticalAlign="middle"
                        />
                    )}
                </>
            );
        }
        if (shape.type === 'circle') return <Circle radius={shape.width / 2} fill={shape.fill} />;
        if (shape.type === 'text') {
            return (
                <Text
                    text={editingId === shape.id ? '' : (shape.text || 'Type something...')}
                    fontSize={shape.fontSize || 24}
                    fill={shape.fill || '#333'}
                    width={shape.width}
                    align={shape.align || 'left'}
                />
            );
        }
        if (shape.type === 'pen') {
            return <Line points={shape.points || []} stroke={shape.stroke || '#000'} strokeWidth={shape.strokeWidth || 3} tension={0.5} lineCap="round" lineJoin="round" />;
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
                        {shapes.map((shape) => {
                            // const isSelected = selectedIds.includes(shape.id); // Removed unused
                            return (
                                <Group
                                    key={shape.id}
                                    id={shape.id}
                                    x={shape.type === 'pen' ? 0 : shape.x}
                                    y={shape.type === 'pen' ? 0 : shape.y}
                                    draggable={!isReadOnly && tool === 'select' && !spacePressed}
                                    onClick={(e) => handleShapeClick(shape.id, e)}
                                    onDragStart={(e: any) => {
                                        if (shape.locked || isReadOnly) {
                                            e.target.stopDrag();
                                            return;
                                        }
                                        if (!selectedIds.includes(shape.id)) setSelectedIds([shape.id]);
                                        if (tool !== 'select') setTool('select');
                                    }}
                                    onDragEnd={(e: any) => {
                                        if (shape.locked || isReadOnly) return;
                                        const updated = { ...shape, x: e.target.x(), y: e.target.y() };
                                        saveToHistory();
                                        updateShape(shape.id, updated);
                                        emitUpdateShape(updated);
                                    }}
                                    onTransformEnd={(e: any) => {
                                        if (isReadOnly) return;
                                        const node = e.target;
                                        const scaleX = node.scaleX();
                                        const scaleY = node.scaleY();
                                        node.scaleX(1); node.scaleY(1);
                                        let newWidth = Math.max(20, shape.width * scaleX);
                                        let newHeight = Math.max(20, shape.height * scaleY);
                                        const updated = { ...shape, x: node.x(), y: node.y(), width: newWidth, height: newHeight };
                                        saveToHistory();
                                        updateShape(shape.id, updated);
                                        emitUpdateShape(updated);
                                    }}
                                >
                                    {renderShape(shape)}
                                </Group>
                            );
                        })}
                        <Transformer
                            ref={transformerRef}
                            rotateEnabled={false}
                            borderStroke="#2196f3"
                            anchorFill="#2196f3"
                            anchorSize={8}
                            padding={5}
                            boundBoxFunc={(oldBox, newBox) => {
                                // Prevent resizing to 0
                                if (newBox.width < 5 || newBox.height < 5) {
                                    return oldBox;
                                }
                                return newBox;
                            }}
                        />
                        {selectionBox && (
                            <Rect
                                x={selectionBox.width < 0 ? selectionBox.x + selectionBox.width : selectionBox.x}
                                y={selectionBox.height < 0 ? selectionBox.y + selectionBox.height : selectionBox.y}
                                width={Math.abs(selectionBox.width)}
                                height={Math.abs(selectionBox.height)}
                                fill="rgba(33, 150, 243, 0.1)"
                                stroke="#2196f3"
                                strokeWidth={1}
                            />
                        )}
                        {Object.values(cursors).map((cursor) => (
                            <Group key={cursor.id} x={cursor.x} y={cursor.y}>
                                <Path data="M0,0 L0,15 L4,11 L8,11 Z" fill={cursor.color} stroke="white" strokeWidth={1} />
                                {cursor.username && (
                                    <Text text={cursor.username} y={20} fill={cursor.color} fontSize={12} fontStyle="bold" />
                                )}
                            </Group>
                        ))}
                    </Layer>
                </Stage>
            </div>

            {/* Editing Text Overlay */}
            {editingId && shapes.find(s => s.id === editingId) && (
                <InPlaceEditor
                    shape={shapes.find(s => s.id === editingId)!}
                    scale={scale}
                    position={position}
                    onUpdate={(text, height) => {
                        const shape = shapes.find(s => s.id === editingId)!;
                        // For artboards, only update text, never height (as it's just the label)
                        const updated = shape.type === 'artboard'
                            ? { ...shape, text }
                            : { ...shape, text, height };

                        updateShape(editingId, updated);
                        emitUpdateShape(updated);
                    }}
                    onBlur={() => setEditingId(null)}
                />
            )}

            {/* Top Bar - Left: Board Name */}
            <div className="fixed top-6 left-6 flex items-center gap-3 z-50 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm p-1.5 pr-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm transition-all hover:shadow-md h-[52px]">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20">H</div>
                <div className="flex items-center h-full">
                    <h1 className="text-sm font-bold text-gray-800 dark:text-white leading-none">{boardName || 'Untitled Board'}</h1>
                </div>
            </div>

            {/* Toolbar */}
            {!isReadOnly && (
                <Toolbar
                    emitAddShape={emitAddShape}
                    emitBoardRename={emitBoardRename}
                />
            )}

            {/* Controls Overlay */}
            <div className="fixed top-6 right-6 flex flex-col items-end gap-3 z-50">
                <div className="flex items-center gap-2">
                    {/* Collaborators List */}
                    <div className="flex items-center -space-x-2 mr-2">
                        {Object.values(cursors).filter(c => c.username && c.id !== socket?.id).map((cursor) => (
                            <div
                                key={cursor.id}
                                className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-bold shadow-sm"
                                style={{ backgroundColor: cursor.color }}
                                title={cursor.username}
                            >
                                {cursor.username?.charAt(0).toUpperCase()}
                            </div>
                        ))}
                    </div>

                    <ShareMenu boardId={boardId} stageRef={stageRef} boardName={boardName} />
                    <button
                        onClick={() => navigate('/dashboard')}
                        title="Exit Board"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold border border-gray-100 dark:border-gray-700 shadow-sm transition-all text-sm group"
                    >
                        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                        Exit
                    </button>
                </div>
            </div>

            {/* Bottom Right: Zoom Controls */}
            <div className="fixed bottom-6 right-6 flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm z-50">
                <button onClick={() => setViewport(scale / SCALE_BY, position)} className="p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"><Minus size={16} /></button>
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                <button onClick={() => setViewport(scale * SCALE_BY, position)} className="p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-gray-500 transition-colors"><Plus size={16} /></button>
            </div>

            {/* Bottom Centered: Dimensions Indicator */}
            {selectedIds.length === 1 && shapes.find(s => s.id === selectedIds[0]) && shapes.find(s => s.id === selectedIds[0])?.type !== 'pen' && (
                <div
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm px-3 py-1.5 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 z-50 pointer-events-auto flex items-center gap-2 animate-fade-in"
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">W</span>
                        <input
                            type="number"
                            className="w-16 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-center"
                            value={Math.round(shapes.find(s => s.id === selectedIds[0])!.width)}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val > 0) {
                                    const s = shapes.find(s => s.id === selectedIds[0])!;
                                    const updated = { ...s, width: val };
                                    updateShape(s.id, updated);
                                    emitUpdateShape(updated);
                                }
                            }}
                        />
                    </div>
                    <span className="text-gray-300 dark:text-gray-600">×</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">H</span>
                        <input
                            type="number"
                            className="w-16 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-center"
                            value={Math.round(shapes.find(s => s.id === selectedIds[0])!.height)}
                            onChange={(e) => {
                                const val = parseInt(e.target.value);
                                if (!isNaN(val) && val > 0) {
                                    const s = shapes.find(s => s.id === selectedIds[0])!;
                                    const updated = { ...s, height: val };
                                    updateShape(s.id, updated);
                                    emitUpdateShape(updated);
                                }
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Username Modal */}
            {
                showUsernameModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 w-full max-w-md shadow-2xl border border-white/20 animate-scale-up">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white text-3xl font-black mx-auto mb-4 shadow-lg">H</div>
                                <h2 className="text-2xl font-black text-gray-900 dark:text-white">What's your name?</h2>
                                <p className="text-gray-500 mt-2">Others on the board will see this.</p>
                            </div>
                            <input
                                type="text"
                                placeholder="Your name"
                                value={tempUsername}
                                onChange={(e) => setTempUsername(e.target.value)}
                                className="w-full px-5 py-4 bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl mb-6 focus:border-blue-500 focus:outline-none transition-all text-lg font-medium dark:text-white"
                                autoFocus
                            />
                            <button
                                onClick={() => {
                                    if (tempUsername.trim()) {
                                        setUsername(tempUsername);
                                        localStorage.setItem('miro-username', tempUsername);
                                        setShowUsernameModal(false);
                                    }
                                }}
                                disabled={!tempUsername.trim()}
                                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-3 rounded-xl transition-all shadow-md"
                            >
                                Join Board
                            </button>
                        </div>
                    </div>
                )
            }
        </>
    );
};
