import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

export const Login: React.FC = () => {
    const [isCreating, setIsCreating] = useState(false);
    const [newCompanyName, setNewCompanyName] = useState('');
    const [newCompanyCode, setNewCompanyCode] = useState('');

    // Existing state
    const [companyCode, setCompanyCode] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Check if user is already logged in
        const savedCompany = localStorage.getItem('company');
        if (savedCompany) {
            navigate('/dashboard');
        }
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_URL}/companies/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: companyCode })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Invalid company code');
            }

            const company = await res.json();

            // Save company data
            if (rememberMe) {
                localStorage.setItem('company', JSON.stringify(company));
            } else {
                sessionStorage.setItem('company', JSON.stringify(company));
            }

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Strong token validation
        if (newCompanyCode.length < 8) {
            setError('Company code must be at least 8 characters long');
            return;
        }

        setLoading(true);

        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const res = await fetch(`${API_URL}/companies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCompanyName, code: newCompanyCode })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create company');
            }

            const company = await res.json();

            // Auto login
            sessionStorage.setItem('company', JSON.stringify(company));
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo/Branding */}
                <div className="text-center mb-8">
                    <div className="inline-block bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl shadow-lg mb-4">
                        <div className="text-white font-bold text-2xl tracking-tight">WB</div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Whiteboard</h1>
                    <p className="text-gray-600">
                        {isCreating ? 'Create a new company workspace' : 'Enter your company code to get started'}
                    </p>
                </div>

                {/* Form Container */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                    {isCreating ? (
                        <form onSubmit={handleCreateCompany} className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Company Name
                                </label>
                                <input
                                    type="text"
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    placeholder="e.g., Acme Corp"
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-lg"
                                    required
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Create Access Token
                                </label>
                                <input
                                    type="text"
                                    value={newCompanyCode}
                                    onChange={(e) => setNewCompanyCode(e.target.value.toUpperCase())}
                                    placeholder="e.g., ACME2024SECRET"
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-lg font-mono"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-2">
                                    Must be at least 8 characters. Share this with your team.
                                </p>
                            </div>

                            {error && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !newCompanyName.trim() || !newCompanyCode.trim()}
                                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <LogIn size={20} />
                                {loading ? 'Creating...' : 'Create Company'}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setIsCreating(false); setError(''); }}
                                className="w-full text-gray-500 hover:text-gray-700 font-medium py-2 transition-colors"
                            >
                                Cancel
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label htmlFor="companyCode" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Company Code
                                </label>
                                <input
                                    id="companyCode"
                                    type="text"
                                    value={companyCode}
                                    onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                                    placeholder="e.g., DEMO2024"
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors text-lg font-mono"
                                    required
                                    autoFocus
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 text-red-700 text-sm">
                                    {error}
                                </div>
                            )}

                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="w-5 h-5 rounded border-2 border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-gray-700 group-hover:text-gray-900 transition-colors">
                                    Remember me
                                </span>
                            </label>

                            <button
                                type="submit"
                                disabled={loading || !companyCode.trim()}
                                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold py-3 rounded-xl transition-all shadow-md hover:shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                <LogIn size={20} />
                                {loading ? 'Logging in...' : 'Access Boards'}
                            </button>
                        </form>
                    )}

                    {!isCreating && (
                        <div className="mt-6 pt-6 border-t border-gray-100">
                            <p className="text-sm text-gray-500 text-center">
                                Don't have a company code?
                            </p>
                            <button
                                onClick={() => { setIsCreating(true); setError(''); }}
                                className="w-full text-blue-600 hover:text-blue-700 font-bold text-center mt-2 hover:underline transition-all"
                            >
                                Create company login
                            </button>
                            <p className="text-xs text-gray-400 text-center mt-4">
                                Demo code: <span className="font-mono font-semibold">DEMO2024</span>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
