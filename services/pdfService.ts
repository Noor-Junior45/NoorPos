import { Sale, Customer } from "../types";
import { StoreService } from "./storeService";

// Define interface for the library since we are using a global CDN in index.html
interface JsPDFInstance {
    text: (text: string, x: number, y: number, options?: any) => any;
    setFontSize: (size: number) => any;
    setTextColor: (r: number, g: number, b: number) => any;
    setFont: (fontName: string, fontStyle?: string) => any;
    save: (filename: string) => any;
    autoTable: (options: any) => any;
    addImage: (data: string, format: string, x: number, y: number, w: number, h: number) => any;
    line: (x1: number, y1: number, x2: number, y2: number) => any;
    setDrawColor: (r: number, g: number, b: number) => any;
    rect: (x: number, y: number, w: number, h: number, style?: string) => any;
}

export const generateInvoicePDF = async (sale: Sale) => {
    // @ts-ignore - Check if library is loaded (from CDN) on window object
    const jspdf = window.jspdf;

    if (typeof jspdf === 'undefined') {
        alert("PDF Library not loaded yet. Check internet connection.");
        return;
    }

    // Fetch dynamic settings
    const settings = await StoreService.getSettings();

    const { jsPDF } = jspdf;
    // @ts-ignore
    const doc = new jsPDF();
    const pageWidth = 210; // A4 width in mm
    
    // Theme Colors (Terra Cotta / Bronze accent)
    const accentColor = [204, 122, 80]; // #cc7a50 style
    const darkColor = [31, 41, 55]; // Slate-800

    // --- Header Section ---
    
    // 1. Logo or Company Name (Left)
    if (settings.logo) {
        try {
            // Aspect ratio math would be better here, but for now we fit into a box
            doc.addImage(settings.logo, 'JPEG', 14, 15, 30, 30);
            
            // Company info below logo if logo exists
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
            doc.text(settings.storeName || "Company Name", 14, 52);
        } catch (e) {
             // Fallback if image fails
             doc.setFontSize(24);
             doc.setFont("helvetica", "bold");
             doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
             doc.text(settings.storeName || "Company Name", 14, 25);
        }
    } else {
        doc.setFontSize(24);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
        doc.text(settings.storeName || "Company Name", 14, 25);
    }

    // Company Details (Below Name/Logo)
    let yPos = settings.logo ? 60 : 35;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); // Slate-500
    
    if (settings.storeAddress) {
        doc.text(settings.storeAddress, 14, yPos);
        yPos += 5;
    }
    if (settings.storePhone) {
        doc.text(`Phone: ${settings.storePhone}`, 14, yPos);
        yPos += 5;
    }
    if (settings.storeEmail) {
        doc.text(settings.storeEmail, 14, yPos);
    }


    // 2. Invoice Title & Meta (Right)
    doc.setFontSize(32);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text("INVOICE", pageWidth - 14, 30, { align: 'right' });

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    
    const metaX = pageWidth - 45;
    const valueX = pageWidth - 14;
    let metaY = 45;

    // Invoice #
    doc.text("Invoice #", metaX, metaY, { align: 'right' });
    doc.setFont("helvetica", "normal");
    doc.text(sale.id.slice(0, 8).toUpperCase(), valueX, metaY, { align: 'right' });
    metaY += 6;

    // Date
    doc.setFont("helvetica", "bold");
    doc.text("Invoice Date", metaX, metaY, { align: 'right' });
    doc.setFont("helvetica", "normal");
    doc.text(new Date(sale.timestamp).toLocaleDateString(), valueX, metaY, { align: 'right' });
    metaY += 6;

    // Due Date (Calculated as +14 days default)
    const dueDate = new Date(sale.timestamp);
    dueDate.setDate(dueDate.getDate() + 14);
    
    doc.setFont("helvetica", "bold");
    doc.text("Due Date", metaX, metaY, { align: 'right' });
    doc.setFont("helvetica", "normal");
    doc.text(dueDate.toLocaleDateString(), valueX, metaY, { align: 'right' });


    // --- Bill To Section ---
    const billToY = Math.max(yPos + 15, 80); // Ensure it doesn't overlap header
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text("Bill To", 14, billToY);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.text(sale.customerName || "Walk-in Customer", 14, billToY + 6);
    
    
    // --- Table ---
    // Columns: QTY | Description | Unit Price | Amount
    const tableColumn = ["QTY", "Description", "Unit Price", "Amount"];
    const tableRows = sale.items.map(item => [
        item.quantity.toString(),
        item.name, // Description
        `${settings.currencySymbol} ${item.sellPrice.toFixed(2)}`,
        `${settings.currencySymbol} ${(item.sellPrice * item.quantity).toFixed(2)}`
    ]);

    // @ts-ignore - autoTable is a plugin
    doc.autoTable({
        startY: billToY + 15,
        head: [tableColumn],
        body: tableRows,
        theme: 'plain', // Clean look
        styles: {
            font: 'helvetica',
            fontSize: 10,
            cellPadding: 3,
            textColor: darkColor
        },
        headStyles: {
            fillColor: accentColor,
            textColor: 255,
            fontStyle: 'bold',
            halign: 'left' // Match prompt alignment
        },
        columnStyles: {
            0: { halign: 'center', fontStyle: 'bold' }, // QTY
            2: { halign: 'right' }, // Price
            3: { halign: 'right' }  // Amount
        },
        alternateRowStyles: {
             fillColor: [249, 250, 251] // Very light gray stripe
        }
    });

    // --- Totals Section ---
    // @ts-ignore
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const totalsX = pageWidth - 60; // Label X
    const totalsValueX = pageWidth - 14; // Value X (Right aligned)
    let currentTotalY = finalY;

    // Subtotal
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    
    doc.text("Subtotal", totalsX, currentTotalY, { align: 'left' });
    doc.text(`${settings.currencySymbol} ${sale.subtotal.toFixed(2)}`, totalsValueX, currentTotalY, { align: 'right' });
    currentTotalY += 6;

    // Tax
    doc.text(`Sales Tax`, totalsX, currentTotalY, { align: 'left' });
    doc.text(`${settings.currencySymbol} ${sale.tax.toFixed(2)}`, totalsValueX, currentTotalY, { align: 'right' });
    currentTotalY += 2;

    // Divider Line
    doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.line(totalsX - 5, currentTotalY + 3, pageWidth - 14, currentTotalY + 3);
    currentTotalY += 10;

    // Grand Total
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text("Total (USD)", totalsX, currentTotalY, { align: 'left' }); // Or Currency Symbol
    doc.text(`${settings.currencySymbol} ${sale.total.toFixed(2)}`, totalsValueX, currentTotalY, { align: 'right' });

    doc.save(`invoice_${sale.id.slice(0, 8)}.pdf`);
};

export const generateCustomerStatementPDF = async (customer: Customer, sales: Sale[]) => {
    // Legacy support for statement, updated to match simple clean style
    // @ts-ignore
    const jspdf = window.jspdf;
    if (typeof jspdf === 'undefined') return;

    const settings = await StoreService.getSettings();
    const { jsPDF } = jspdf;
    // @ts-ignore
    const doc = new jsPDF();
    const pageWidth = 210;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(204, 122, 80);
    doc.text(settings.storeName || "Company", 14, 20);
    
    doc.setFontSize(16);
    doc.setTextColor(0,0,0);
    doc.text("Statement of Account", 14, 30);

    // Customer Info
    doc.setFontSize(10);
    doc.text(`Customer: ${customer.name}`, 14, 45);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 50);

    // Table
    const tableColumn = ["Date", "Inv #", "Amount"];
    const tableRows = sales.map(sale => [
        new Date(sale.timestamp).toLocaleDateString(),
        sale.id.slice(0, 8).toUpperCase(),
        `${settings.currencySymbol} ${sale.total.toFixed(2)}`
    ]);

    // @ts-ignore
    doc.autoTable({
        startY: 60,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [204, 122, 80] },
    });

    doc.save(`statement_${customer.name}.pdf`);
};