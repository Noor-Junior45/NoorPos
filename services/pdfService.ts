import { Sale, Customer } from "../types";
import { StoreService } from "./storeService";

export const generateInvoicePDF = async (sale: Sale) => {
    // @ts-ignore
    const jspdf = window.jspdf;

    if (typeof jspdf === 'undefined') {
        alert("PDF Library not loaded yet. Check internet connection.");
        return;
    }

    const settings = await StoreService.getSettings();
    const { jsPDF } = jspdf;
    // @ts-ignore
    const doc = new jsPDF();
    const pageWidth = 210;
    
    // Brand Colors
    const darkHeader = [31, 41, 55]; // Slate-800
    const accentText = [79, 70, 229]; // Indigo-600
    const lightText = [107, 114, 128]; // Slate-500

    // --- 1. Top Header: INVOICE ---
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkHeader[0], darkHeader[1], darkHeader[2]);
    doc.text("INVOICE", 14, 25);

    // --- 2. Company Details (Left) ---
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(settings.storeName || "Company Name", 14, 35);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);
    let currentY = 40;
    if (settings.storeAddress) {
        doc.text(settings.storeAddress, 14, currentY);
        currentY += 5;
    }
    if (settings.storePhone) {
        doc.text(`Phone: ${settings.storePhone}`, 14, currentY);
        currentY += 5;
    }
    if (settings.storeEmail) {
        doc.text(settings.storeEmail, 14, currentY);
    }

    // --- 3. Bill To & Date (Right) ---
    const rightColX = pageWidth - 14;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(darkHeader[0], darkHeader[1], darkHeader[2]);
    doc.text("BILL TO:", rightColX - 50, 35);
    
    doc.setFont("helvetica", "normal");
    doc.text(sale.customerName, rightColX, 35, { align: 'right' });
    
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE #:", rightColX - 50, 45);
    doc.setFont("helvetica", "normal");
    doc.text(sale.id.slice(0, 10).toUpperCase(), rightColX, 45, { align: 'right' });
    
    doc.setFont("helvetica", "bold");
    doc.text("DATE:", rightColX - 50, 52);
    doc.setFont("helvetica", "normal");
    doc.text(new Date(sale.timestamp).toLocaleDateString(), rightColX, 52, { align: 'right' });

    // --- 4. Main Table ---
    const tableHeaders = [["#", "ITEM DETAILS", "PRICE", "DISCOUNT", "QTY", "TOTAL"]];
    const tableRows = sale.items.map((item, idx) => {
        const disc = item.discount || 0;
        const lineTotal = (item.sellPrice * item.quantity) - disc;
        return [
            (idx + 1).toString(),
            item.name,
            `${settings.currencySymbol} ${item.sellPrice.toFixed(2)}`,
            disc > 0 ? `${settings.currencySymbol} ${disc.toFixed(2)}` : "-",
            item.quantity.toString(),
            `${settings.currencySymbol} ${lineTotal.toFixed(2)}`
        ];
    });

    // @ts-ignore
    doc.autoTable({
        startY: 65,
        head: tableHeaders,
        body: tableRows,
        theme: 'striped',
        headStyles: {
            fillColor: darkHeader,
            textColor: 255,
            fontSize: 9,
            fontStyle: 'bold',
            halign: 'center'
        },
        styles: {
            fontSize: 9,
            cellPadding: 4,
            textColor: [50, 50, 50]
        },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { halign: 'left' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'center' },
            5: { halign: 'right', fontStyle: 'bold' }
        }
    });

    // --- 5. Footer Calculations ---
    // @ts-ignore
    let finalY = doc.lastAutoTable.finalY + 10;
    const totalsLabelX = pageWidth - 60;
    const totalsValueX = pageWidth - 14;

    const totalDiscount = sale.items.reduce((acc, item) => acc + (item.discount || 0), 0);

    const drawTotalRow = (label: string, value: string, isBold = false) => {
        doc.setFontSize(10);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(darkHeader[0], darkHeader[1], darkHeader[2]);
        doc.text(label, totalsLabelX, finalY);
        doc.text(value, totalsValueX, finalY, { align: 'right' });
        finalY += 6;
    };

    drawTotalRow("Gross Total:", `${settings.currencySymbol} ${sale.subtotal.toFixed(2)}`);
    if (totalDiscount > 0) {
        doc.setTextColor(220, 38, 38); // Red
        drawTotalRow("Total Discounts:", `- ${settings.currencySymbol} ${totalDiscount.toFixed(2)}`);
    }
    drawTotalRow("Tax:", `${settings.currencySymbol} ${sale.tax.toFixed(2)}`);
    
    finalY += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(totalsLabelX, finalY, totalsValueX, finalY);
    finalY += 8;

    doc.setFontSize(14);
    drawTotalRow("Net Payable:", `${settings.currencySymbol} ${sale.total.toFixed(2)}`, true);

    finalY += 4;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(lightText[0], lightText[1], lightText[2]);

    const paid = sale.amountPaid !== undefined ? sale.amountPaid : sale.total;
    const due = sale.total - paid;

    let payText = `Payment Mode: ${sale.paymentMethod || 'Cash'}`;
    if (due > 0.01) {
        payText += ` | Paid: ${settings.currencySymbol}${paid.toFixed(2)} | Balance Due: ${settings.currencySymbol}${due.toFixed(2)}`;
    } else {
        payText += ` | Fully Paid`;
    }
    doc.text(payText, totalsValueX, finalY, { align: 'right' });

    // --- 6. Final Thank You ---
    finalY = Math.max(finalY + 30, 270);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold italic");
    doc.setTextColor(darkHeader[0], darkHeader[1], darkHeader[2]);
    doc.text("Thank you for your business!", pageWidth / 2, finalY, { align: 'center' });

    // --- 7. Output Logic ---
    if (settings.directPrintEnabled) {
        // Direct Print: Use blob URL and print
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            iframe.contentWindow?.print();
            setTimeout(() => {
                document.body.removeChild(iframe);
                URL.revokeObjectURL(url);
            }, 1000);
        };
    } else {
        // Standard Download
        doc.save(`Invoice_${sale.id.slice(0, 8).toUpperCase()}.pdf`);
    }
};

export const generateCustomerStatementPDF = async (customer: Customer, sales: Sale[]) => {
    // @ts-ignore
    const jspdf = window.jspdf;
    if (typeof jspdf === 'undefined') return;

    const settings = await StoreService.getSettings();
    const { jsPDF } = jspdf;
    // @ts-ignore
    const doc = new jsPDF();
    const pageWidth = 210;

    doc.setFontSize(22);
    doc.setTextColor(31, 41, 55);
    doc.text("Statement of Account", 14, 20);

    doc.setFontSize(10);
    doc.text(`Customer: ${customer.name}`, 14, 35);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 40);

    const tableColumn = ["Date", "Invoice #", "Status", "Amount"];
    const tableRows = sales.map(sale => {
        const paid = sale.amountPaid !== undefined ? sale.amountPaid : sale.total;
        const due = sale.total - paid;
        return [
            new Date(sale.timestamp).toLocaleDateString(),
            sale.id.slice(0, 8).toUpperCase(),
            due > 0.01 ? "Pending" : "Paid",
            `${settings.currencySymbol} ${sale.total.toFixed(2)}`
        ];
    });

    // @ts-ignore
    doc.autoTable({
        startY: 50,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [31, 41, 55] },
    });

    doc.save(`Statement_${customer.name.replace(/\s+/g, '_')}.pdf`);
};