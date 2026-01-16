import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

export const Login: React.FC = () => {
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Logo/Branding */}
                <div className="text-center mb-8">
                    <div className="inline-block bg-gradient-to-br from-blue-500 to-blue-600 p-4 rounded-2xl shadow-lg mb-4">
                        <div className="text-white font-bold text-2xl tracking-tight">WB</div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Whiteboard</h1>
                    <p className="text-gray-600">Enter your company code to get started</p>
                </div>

                {/* Login Form */}
                <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
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

                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <p className="text-sm text-gray-500 text-center">
                            Don't have a company code? Contact your administrator.
                        </p>
                        <p className="text-xs text-gray-400 text-center mt-2">
                            Demo code: <span className="font-mono font-semibold">DEMO2024</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
