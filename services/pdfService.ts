import { Sale } from "../types";

// Define interface for the library since we are using a global CDN in index.html
interface JsPDFInstance {
    text: (text: string, x: number, y: number, options?: any) => any;
    setFontSize: (size: number) => any;
    save: (filename: string) => any;
    autoTable: (options: any) => any;
    addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => any;
    line: (x1: number, y1: number, x2: number, y2: number) => any;
}

export const generateInvoicePDF = (sale: Sale) => {
    // @ts-ignore - Check if library is loaded (from CDN) on window object
    const jspdf = window.jspdf;

    if (typeof jspdf === 'undefined') {
        alert("PDF Library not loaded yet. Check internet connection.");
        return;
    }

    const { jsPDF } = jspdf;
    // @ts-ignore
    const doc = new jsPDF();
    const pageWidth = 210; // A4 width in mm

    // Header / Logo Placeholder
    doc.setFontSize(22);
    doc.text("GlassStore POS", 14, 20);
    
    doc.setFontSize(10);
    doc.text("1234 Future Street, Tech City", 14, 26);
    doc.text("Phone: (555) 123-4567", 14, 31);

    // Invoice Info
    doc.setFontSize(14);
    doc.text("INVOICE", pageWidth - 40, 20);
    doc.setFontSize(10);
    doc.text(`Invoice #: ${sale.id.slice(0, 8).toUpperCase()}`, pageWidth - 60, 28);
    doc.text(`Date: ${new Date(sale.timestamp).toLocaleDateString()}`, pageWidth - 60, 33);
    doc.text(`Customer: ${sale.customerName}`, pageWidth - 60, 38);

    // Divider
    doc.line(14, 45, pageWidth - 14, 45);

    // Table
    const tableColumn = ["Item", "Qty", "Price", "Total"];
    const tableRows = sale.items.map(item => [
        item.name,
        item.quantity.toString(),
        `Rs. ${item.sellPrice.toFixed(2)}`,
        `Rs. ${(item.sellPrice * item.quantity).toFixed(2)}`
    ]);

    // @ts-ignore - autoTable is a plugin
    doc.autoTable({
        startY: 50,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], textColor: 255 }, // Slate-700
        footStyles: { fillColor: [241, 245, 249] }, // Slate-100
    });

    // Totals
    // @ts-ignore
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.text(`Subtotal: Rs. ${sale.subtotal.toFixed(2)}`, 140, finalY);
    doc.text(`Tax (18%): Rs. ${sale.tax.toFixed(2)}`, 140, finalY + 5);
    
    doc.setFontSize(12);
    doc.text(`Grand Total: Rs. ${sale.total.toFixed(2)}`, 140, finalY + 12);

    // Footer
    doc.setFontSize(8);
    doc.text("Thank you for your business!", 105, 280, { align: 'center' });

    doc.save(`invoice_${sale.id.slice(0, 8)}.pdf`);
};