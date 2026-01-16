
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    ArrowRight,
    Zap,
    Infinity,
    Lock,
    LogOut
} from 'lucide-react';

interface Board {
    id: string;
    name: string;
    hasPassword?: boolean;
}

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [boards, setBoards] = useState<Board[]>([]);
    const [newBoardName, setNewBoardName] = useState('');
    const [password, setPassword] = useState('');
    const [joinPassword, setJoinPassword] = useState('');
    const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
    const [company, setCompany] = useState<{ id: string; name: string } | null>(null);

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // Check for company session
        const savedCompany = localStorage.getItem('company') || sessionStorage.getItem('company');
        if (!savedCompany) {
            navigate('/');
            return;
        }
        setCompany(JSON.parse(savedCompany));
        fetchBoards(JSON.parse(savedCompany).id);
    }, [navigate]);

    const fetchBoards = async (companyId: string) => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'https://miro-clone-5oig.onrender.com';
            const res = await fetch(`${API_URL}/boards?companyId=${companyId}`);
            if (!res.ok) throw new Error('Failed to connect to server');
            const data = await res.json();
            setBoards(data);
        } catch (error) {
            console.error('Failed to fetch boards:', error);
        }
    };

    const handleCreateBoard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBoardName.trim() || !company) return;

        setError('');
        setIsLoading(true);

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'https://miro-clone-5oig.onrender.com';
            const res = await fetch(`${API_URL}/boards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newBoardName, password, companyId: company.id }),
            });

            if (!res.ok) throw new Error(`Server error: ${res.status}`);

            const data = await res.json();
            navigate(`/board/${data.id}`);
        } catch (error: any) {
            console.error('Failed to create board:', error);
            setError('Failed to create board. Is the server running?');
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinBoard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedBoardId) return;

        setError('');
        setIsLoading(true);

        // In a real app we'd verify password here or on join
        // For simple MVP we just pass it to the view or verify via API
        if (joinPassword) {
            // Verify password API
            try {
                const API_URL = import.meta.env.VITE_API_URL || 'https://miro-clone-5oig.onrender.com';
                const res = await fetch(`${API_URL}/boards/${selectedBoardId}/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: joinPassword }),
                });
                if (res.ok) {
                    navigate(`/board/${selectedBoardId}`);
                } else {
                    alert('Incorrect password');
                }
            } catch (error) {
                console.error('Failed to verify:', error);
                setError('Connection failed');
            } finally {
                setIsLoading(false);
            }
        } else {
            navigate(`/board/${selectedBoardId}`);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('company');
        sessionStorage.removeItem('company');
        navigate('/');
    };

    if (!company) return null;

    return (
        <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-gray-50 via-white to-blue-50 flex items-center justify-center p-6 overflow-auto">
            <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
                {/* Left Side - Branding (Visible on medium+ screens) */}
                <div className="hidden md:flex bg-white relative overflow-hidden flex-col justify-between p-12 border-r border-gray-100/50 h-full rounded-l-3xl">
                    <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-30"></div>
                    <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-100 rounded-full blur-3xl opacity-30 animate-pulse"></div>
                    <div className="absolute top-1/2 -right-20 w-80 h-80 bg-indigo-100 rounded-full blur-3xl opacity-30"></div>

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <span className="text-white font-bold text-xl tracking-tight">H</span>
                                </div>
                                <div>
                                    <span className="text-2xl font-bold text-gray-900 tracking-tight block">Huddleround</span>
                                    <span className="text-sm text-gray-500 font-medium">{company.name}</span>
                                </div>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600 hover:text-gray-900"
                                title="Logout"
                            >
                                <LogOut size={20} />
                            </button>
                        </div>

                        <h1 className="text-4xl font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
                            Where ideas come to life
                        </h1>
                        <p className="text-lg text-gray-600 leading-relaxed max-w-sm font-medium">
                            Create, collaborate, and bring your team's best ideas to the board. Start brainstorming in seconds.
                        </p>
                    </div>

                    <div className="relative z-10 grid grid-cols-2 gap-6">
                        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 group">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3 text-blue-600 group-hover:scale-110 transition-transform">
                                <Infinity size={24} strokeWidth={2.5} />
                            </div>
                            <h3 className="font-bold text-gray-900 mb-1">Infinite Canvas</h3>
                            <p className="text-sm text-gray-500 font-medium">Space for every idea</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 group">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3 text-blue-600 group-hover:scale-110 transition-transform">
                                <Zap size={24} strokeWidth={2.5} />
                            </div>
                            <h3 className="font-bold text-gray-900 mb-1">Real-time Sync</h3>
                            <p className="text-sm text-gray-500 font-medium">Collaborate instantly</p>
                        </div>
                    </div>
                </div>

                {/* Right Side - Forms */}
                <div className="bg-white p-10 rounded-3xl shadow-2xl border border-gray-100 relative overflow-hidden">
                    {/* Subtle decorative gradient */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-100/40 to-purple-100/40 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>

                    <div className="relative z-10">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Get Started</h2>
                            <p className="text-gray-500">Create a new board or join an existing one</p>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-100 mb-6 animate-fade-in flex items-center gap-2">
                                <span className="text-red-500">⚠️</span>
                                {error}
                            </div>
                        )}

                        <div className="space-y-6">
                            {/* Create Board Form */}
                            <form onSubmit={handleCreateBoard} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Board Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newBoardName}
                                        onChange={(e) => setNewBoardName(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all placeholder-gray-400 text-gray-800 font-medium"
                                        placeholder="My Awesome Board"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Password <span className="text-gray-400 font-normal text-xs">(Optional)</span>
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white outline-none transition-all placeholder-gray-400 text-gray-800 font-medium"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={`w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 px-6 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 font-semibold text-base flex items-center justify-center gap-2 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0
                                    ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={20} strokeWidth={2.5} />
                                            Create New Board
                                        </>
                                    )}
                                </button>
                            </form>

                            {/* Divider */}
                            <div className="relative flex items-center gap-4 py-3">
                                <div className="h-px bg-gray-200 flex-1"></div>
                                <span className="text-xs text-gray-400 font-semibold tracking-wide">OR</span>
                                <div className="h-px bg-gray-200 flex-1"></div>
                            </div>

                            {/* Join Board Form */}
                            <form onSubmit={handleJoinBoard} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        Select Board to Join
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={selectedBoardId || ''}
                                            onChange={(e) => setSelectedBoardId(e.target.value)}
                                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-700 appearance-none cursor-pointer font-medium pr-10"
                                        >
                                            <option value="" disabled>Choose a board...</option>
                                            {boards.map((b) => (
                                                <option key={b.id} value={b.id}>
                                                    {b.name} {b.hasPassword ? '🔒' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {selectedBoardId && boards.find(b => b.id === selectedBoardId)?.hasPassword && (
                                    <div className="animate-fade-in">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                            <Lock size={14} />
                                            Board Password
                                        </label>
                                        <input
                                            type="password"
                                            value={joinPassword}
                                            onChange={(e) => setJoinPassword(e.target.value)}
                                            className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400 font-medium"
                                            placeholder="Enter password"
                                            required
                                        />
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={!selectedBoardId}
                                    className={`w-full py-3.5 px-6 rounded-xl shadow-md transition-all duration-200 font-semibold text-base flex items-center justify-center gap-2
                                        ${selectedBoardId
                                            ? 'bg-gray-900 text-white shadow-gray-900/20 hover:bg-black hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0'
                                            : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'}`}
                                >
                                    Join Board
                                    <ArrowRight size={18} strokeWidth={2.5} />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
