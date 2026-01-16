
import React, { useState } from 'react';
import { Share2, Link, Eye, Edit3, Check, Copy, FileText, ImageIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import { useBoardStore } from '../store/useBoardStore';

interface ShareMenuProps {
    boardId: string;
    stageRef: React.RefObject<any>;
    boardName: string;
}

export const ShareMenu: React.FC<ShareMenuProps> = ({ boardId, stageRef, boardName }) => {
    const { isPublic, sharePermission, shareToken, setShareSettings } = useBoardStore();
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyLink = () => {
        const url = `${window.location.origin}/board/${boardId}${shareToken ? `?token=${shareToken}` : ''}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const togglePublic = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'https://miro-clone-5oig.onrender.com';
            const res = await fetch(`${API_URL}/boards/${boardId}/share`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublic: !isPublic, sharePermission })
            });
            const data = await res.json();
            setShareSettings({ isPublic: data.isPublic, sharePermission: data.sharePermission, shareToken: data.shareToken });
        } catch (err) {
            console.error('Failed to update share settings:', err);
            alert('Failed to update share settings. check console for details.');
        }
    };

    const updatePermission = async (permission: 'view' | 'edit') => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'https://miro-clone-5oig.onrender.com';
            await fetch(`${API_URL}/boards/${boardId}/share`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isPublic, sharePermission: permission })
            });
            setShareSettings({ sharePermission: permission });
        } catch (err) {
            console.error('Failed to update permission:', err);
            alert('Failed to update permission. please try again.');
        }
    };

    const exportImage = (format: 'png' | 'jpeg') => {
        if (!stageRef.current) return;
        const uri = stageRef.current.toDataURL({ pixelRatio: 2, mimeType: `image/${format}` });
        const link = document.createElement('a');
        link.download = `${boardName}.${format}`;
        link.href = uri;
        link.click();
    };

    const exportPDF = () => {
        if (!stageRef.current) return;
        try {
            const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [stageRef.current.width() * 2, stageRef.current.height() * 2]
            });
            pdf.addImage(uri, 'PNG', 0, 0, stageRef.current.width() * 2, stageRef.current.height() * 2);
            pdf.save(`${boardName}.pdf`);
        } catch (err) {
            console.error('PDF export failed:', err);
            alert('PDF Export Failed! ' + (err as Error).message);
        }
    };

    const exportArtboardsAsPDF = () => {
        if (!stageRef.current) return;
        try {
            const stage = stageRef.current;
            const shapes = useBoardStore.getState().shapes;
            const artboards = shapes.filter(s => s.type === 'artboard');

            if (artboards.length === 0) {
                alert('No artboards found to export.');
                return;
            }

            const pdf = new jsPDF({ orientation: 'landscape', unit: 'px' });

            artboards.forEach((ab, index) => {
                const uri = stage.toDataURL({
                    x: ab.x,
                    y: ab.y,
                    width: ab.width,
                    height: ab.height,
                    pixelRatio: 2
                });

                if (index > 0) pdf.addPage([ab.width * 2, ab.height * 2], 'landscape');
                else {
                    (pdf as any).setPage(1);
                    (pdf as any).internal.pageSize.width = ab.width * 2;
                    (pdf as any).internal.pageSize.height = ab.height * 2;
                }

                pdf.addImage(uri, 'PNG', 0, 0, ab.width * 2, ab.height * 2);
            });

            pdf.save(`${boardName}-artboards.pdf`);
        } catch (err) {
            console.error('Artboard PDF export failed:', err);
            alert('Artboard PDF Export Failed! ' + (err as Error).message);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-md transition-all hover:scale-105 active:scale-95 text-sm"
            >
                <Share2 size={16} />
                Share
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 p-4 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Share Board</h3>

                        <div className="space-y-4 mb-6">
                            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-2">
                                    <Link size={14} className="text-gray-400" />
                                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Public Link</span>
                                </div>
                                <button
                                    onClick={togglePublic}
                                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${isPublic ? 'bg-blue-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>

                            {isPublic && (
                                <div className="animate-in slide-in-from-top-2 duration-200">
                                    <div className="flex gap-2 mb-3">
                                        <button
                                            onClick={() => updatePermission('view')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${sharePermission === 'view' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            <Eye size={12} /> View
                                        </button>
                                        <button
                                            onClick={() => updatePermission('edit')}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${sharePermission === 'edit' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}
                                        >
                                            <Edit3 size={12} /> Edit
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleCopyLink}
                                        className="w-full flex items-center justify-between p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all font-bold text-xs"
                                    >
                                        <span className="truncate max-w-[180px]">Copy Shareable Link</span>
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-gray-100 dark:bg-gray-700 mb-4"></div>

                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Export Board</h3>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => exportImage('png')}
                                className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors"
                            >
                                <ImageIcon size={14} className="text-pink-500" /> Download as PNG
                            </button>
                            <button
                                onClick={() => exportImage('jpeg')}
                                className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors"
                            >
                                <ImageIcon size={14} className="text-pink-500" /> Download as JPG
                            </button>
                            <button
                                onClick={exportPDF}
                                className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors"
                            >
                                <FileText size={14} className="text-red-500" /> Download Board PDF
                            </button>
                            <button
                                onClick={exportArtboardsAsPDF}
                                className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 transition-colors"
                            >
                                <FileText size={14} className="text-blue-500" /> Download Artboards PDF
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
