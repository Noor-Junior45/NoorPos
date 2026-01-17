
import React, { useEffect, useState } from 'react';
import { Sale, StoreSettings } from '../types';
import { Card, Button, Badge, LoadingSpinner } from '../components/UI';
import { Printer, Download, CheckCircle, Clock, AlertCircle, ShieldCheck, MapPin, Phone, Mail } from 'lucide-react';
import { generateInvoicePDF } from '../services/pdfService';

export const PublicInvoice: React.FC = () => {
    const [data, setData] = useState<{ sale: Sale; settings: StoreSettings } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        const fetchInvoice = async () => {
            const pathParts = window.location.pathname.split('/');
            const filename = pathParts[pathParts.length - 1]; // e.g. "INV-123.html"
            const saleId = filename.replace('.html', '');

            try {
                const res = await fetch(`/api/storage?publicSaleId=${saleId}`);
                if (!res.ok) throw new Error("Invoice not found or link expired.");
                
                const json = await res.json();
                
                // 3-Day Expiry Check (72 hours)
                const createdDate = new Date(json.sale.timestamp).getTime();
                const now = new Date().getTime();
                const diffHours = (now - createdDate) / (1000 * 60 * 60);

                if (diffHours > 72) {
                    setIsExpired(true);
                } else {
                    setData(json);
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchInvoice();
    }, []);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <LoadingSpinner />
        </div>
    );

    if (isExpired) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <Card className="max-w-md text-center p-10 border-2 border-red-100">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Clock size={40} />
                </div>
                <h1 className="text-2xl font-black text-gray-900 mb-3">Link Expired</h1>
                <p className="text-gray-500 mb-8 font-medium">For security reasons, public invoice links are only valid for 3 days. Please contact the store for a fresh copy.</p>
                <Button variant="neutral" onClick={() => window.location.href = '/'} className="w-full">Return Home</Button>
            </Card>
        </div>
    );

    if (error || !data) return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
            <Card className="max-w-md text-center p-10 border-2 border-amber-100">
                <div className="w-20 h-20 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle size={40} />
                </div>
                <h1 className="text-2xl font-black text-gray-900 mb-3">Invoice Unavailable</h1>
                <p className="text-gray-500 mb-8 font-medium">{error || "We couldn't retrieve this invoice record."}</p>
                <Button variant="neutral" onClick={() => window.location.href = '/'} className="w-full">Return Home</Button>
            </Card>
        </div>
    );

    const { sale, settings } = data;
    const paid = sale.amountPaid !== undefined ? sale.amountPaid : sale.total;
    const due = sale.total - paid;
    const isFullyPaid = due <= 0.01;

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:py-12 animate-in fade-in duration-500">
            <div className="max-w-3xl mx-auto">
                <Card className="!p-0 overflow-hidden shadow-2xl border-0 ring-1 ring-black/5 bg-white">
                    {/* Header Banner */}
                    <div className={`h-2 ${isFullyPaid ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                    
                    <div className="p-6 md:p-10">
                        {/* Store Header */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 pb-8 border-b border-gray-100">
                            <div className="space-y-1">
                                {settings.logo && <img src={settings.logo} className="h-12 object-contain mb-4" alt="Logo"/>}
                                <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">{settings.storeName || 'Digital Invoice'}</h1>
                                <div className="text-sm text-gray-400 font-medium space-y-0.5">
                                    {settings.storeAddress && <p className="flex items-center gap-1.5"><MapPin size={14}/> {settings.storeAddress}</p>}
                                    {settings.storePhone && <p className="flex items-center gap-1.5"><Phone size={14}/> {settings.storePhone}</p>}
                                </div>
                            </div>
                            <div className="text-left md:text-right space-y-1">
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 ${isFullyPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                    {isFullyPaid ? <CheckCircle size={12}/> : <Clock size={12}/>}
                                    {isFullyPaid ? 'Fully Paid' : 'Balance Due'}
                                </div>
                                <p className="text-3xl font-black text-gray-900 leading-none mt-2">₹{sale.total.toFixed(0)}</p>
                                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Invoice #{sale.id.slice(0, 10).toUpperCase()}</p>
                            </div>
                        </div>

                        {/* Customer Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                            <div>
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Billed To:</h3>
                                <p className="text-lg font-bold text-gray-800">{sale.customerName}</p>
                                <p className="text-sm text-gray-500 font-medium">{new Date(sale.timestamp).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })}</p>
                            </div>
                            <div className="md:text-right">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Payment Info:</h3>
                                <p className="text-sm font-bold text-gray-800">Method: {sale.paymentMethod || 'Cash'}</p>
                                {!isFullyPaid && <p className="text-sm font-black text-red-500 mt-1">Pending: ₹{due.toFixed(2)}</p>}
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="rounded-2xl border border-gray-100 overflow-hidden mb-8">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-4 py-4 font-black text-gray-400 uppercase text-[9px] tracking-widest">Item Description</th>
                                        <th className="px-4 py-4 font-black text-gray-400 uppercase text-[9px] tracking-widest text-center">Qty</th>
                                        <th className="px-4 py-4 font-black text-gray-400 uppercase text-[9px] tracking-widest text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {sale.items.map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-4">
                                                <p className="font-bold text-gray-800">{item.name}</p>
                                                <p className="text-[10px] text-gray-400 font-medium italic">Price: ₹{item.sellPrice.toFixed(2)}</p>
                                            </td>
                                            <td className="px-4 py-4 text-center font-bold text-gray-700">{item.quantity}</td>
                                            <td className="px-4 py-4 text-right font-black text-gray-900">₹{((item.sellPrice * item.quantity) - (item.discount || 0)).toFixed(0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary */}
                        <div className="max-w-[280px] ml-auto space-y-3 pt-4">
                            <div className="flex justify-between text-sm text-gray-500 font-medium">
                                <span>Subtotal</span>
                                <span>₹{sale.subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm text-gray-500 font-medium pb-4 border-b border-gray-100">
                                <span>Tax</span>
                                <span>₹{sale.tax.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xl font-black text-gray-950 pt-2">
                                <span>Total Paid</span>
                                <span className="text-emerald-600">₹{paid.toFixed(0)}</span>
                            </div>
                        </div>

                        {/* Footer Disclaimer */}
                        <div className="mt-16 pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
                                <ShieldCheck size={14} className="text-emerald-400 opacity-60"/>
                                <span>Verified Transaction Noor POS</span>
                            </div>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => generateInvoicePDF(sale)}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-900 text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-200 active:scale-95"
                                >
                                    <Download size={14}/> PDF Receipt
                                </button>
                                <button 
                                    onClick={() => window.print()}
                                    className="p-3 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all active:scale-95"
                                >
                                    <Printer size={18}/>
                                </button>
                            </div>
                        </div>
                    </div>
                </Card>
                
                <p className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-8">
                    Link valid for 3 days • {settings.storeName}
                </p>
            </div>
        </div>
    );
};
