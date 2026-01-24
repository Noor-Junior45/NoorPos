
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
    
    // Check if Thermal or A4
    const isThermal = settings.printPaperSize === 'Thermal';
    
    // Setup Document
    // Thermal paper is usually 80mm wide. Height is continuous, so we set a long height.
    const doc = isThermal 
        ? new jsPDF({ unit: 'mm', format: [80, 2000] }) // Long strip for thermal
        : new jsPDF(); // Default A4

    const pageWidth = isThermal ? 80 : 210;
    const margin = isThermal ? 2 : 14;
    const contentWidth = pageWidth - (margin * 2);
    
    // Fonts & Colors
    const darkHeader = [31, 41, 55]; // Slate-800
    const lightText = [107, 114, 128]; // Slate-500

    let currentY = isThermal ? 5 : 25;

    // --- HEADER SECTION ---
    doc.setTextColor(darkHeader[0], darkHeader[1], darkHeader[2]);
    
    if (isThermal) {
        // Thermal Header: Centered
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(settings.storeName || "RECEIPT", pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        
        if (settings.storeAddress) {
            const splitAddr = doc.splitTextToSize(settings.storeAddress, contentWidth);
            doc.text(splitAddr, pageWidth / 2, currentY, { align: 'center' });
            currentY += (splitAddr.length * 3.5);
        }
        if (settings.storePhone) {
            doc.text(`Phone: ${settings.storePhone}`, pageWidth / 2, currentY, { align: 'center' });
            currentY += 4;
        }
        
        // Divider
        doc.setLineWidth(0.1);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 4;

        // Sale Info
        doc.text(`Invoice #: ${sale.id.slice(0, 8).toUpperCase()}`, margin, currentY);
        currentY += 3.5;
        doc.text(`Date: ${new Date(sale.timestamp).toLocaleString()}`, margin, currentY);
        currentY += 3.5;
        doc.text(`Customer: ${sale.customerName}`, margin, currentY);
        currentY += 5;

    } else {
        // A4 Header: Standard Layout
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.text("INVOICE", 14, 25);

        doc.setFontSize(10);
        doc.text(settings.storeName || "Company Name", 14, 35);
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(lightText[0], lightText[1], lightText[2]);
        let tempY = 40;
        if (settings.storeAddress) { doc.text(settings.storeAddress, 14, tempY); tempY += 5; }
        if (settings.storePhone) { doc.text(`Phone: ${settings.storePhone}`, 14, tempY); tempY += 5; }
        
        const rightColX = pageWidth - 14;
        doc.setTextColor(darkHeader[0], darkHeader[1], darkHeader[2]);
        doc.setFontSize(10);
        
        doc.text("BILL TO:", rightColX - 50, 35);
        doc.text(sale.customerName, rightColX, 35, { align: 'right' });
        
        doc.text("INVOICE #:", rightColX - 50, 45);
        doc.text(sale.id.slice(0, 10).toUpperCase(), rightColX, 45, { align: 'right' });
        
        doc.text("DATE:", rightColX - 50, 52);
        doc.text(new Date(sale.timestamp).toLocaleDateString(), rightColX, 52, { align: 'right' });
        
        currentY = 65;
    }

    // --- ITEMS TABLE ---
    const currency = settings.currencySymbol || '₹';
    
    if (isThermal) {
        // Simplified Thermal Table
        // Header
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Item", margin, currentY);
        doc.text("Qty", pageWidth - 25, currentY, { align: 'right' });
        doc.text("Amt", pageWidth - margin, currentY, { align: 'right' });
        currentY += 1;
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 4;

        // Items
        doc.setFont("helvetica", "normal");
        sale.items.forEach(item => {
            const lineTotal = ((item.customPrice ?? item.sellPrice) * item.quantity) - (item.discount || 0);
            
            // Name Wrapping
            const nameWidth = contentWidth - 25; // Space for Qty and Amt
            const splitName = doc.splitTextToSize(item.name, nameWidth);
            
            doc.text(splitName, margin, currentY);
            doc.text(item.quantity.toString(), pageWidth - 25, currentY, { align: 'right' });
            doc.text(`${lineTotal.toFixed(0)}`, pageWidth - margin, currentY, { align: 'right' });
            
            currentY += (splitName.length * 3.5) + 1;
        });
        
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 4;

    } else {
        // A4 Full Table
        const tableHeaders = [["#", "ITEM DETAILS", "PRICE", "DISCOUNT", "QTY", "TOTAL"]];
        const tableRows = sale.items.map((item, idx) => {
            const disc = item.discount || 0;
            const lineTotal = ((item.customPrice ?? item.sellPrice) * item.quantity) - disc;
            return [
                (idx + 1).toString(),
                item.name,
                `${currency} ${(item.customPrice ?? item.sellPrice).toFixed(2)}`,
                disc > 0 ? `${currency} ${disc.toFixed(2)}` : "-",
                item.quantity.toString(),
                `${currency} ${lineTotal.toFixed(2)}`
            ];
        });

        // @ts-ignore
        doc.autoTable({
            startY: currentY,
            head: tableHeaders,
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: darkHeader, textColor: 255, fontSize: 9, fontStyle: 'bold', halign: 'center' },
            styles: { fontSize: 9, cellPadding: 4, textColor: [50, 50, 50] },
            columnStyles: {
                0: { halign: 'center', cellWidth: 10 },
                1: { halign: 'left' },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'center' },
                5: { halign: 'right', fontStyle: 'bold' }
            }
        });
        // @ts-ignore
        currentY = doc.lastAutoTable.finalY + 10;
    }

    // --- FOOTER TOTALS ---
    const totalDiscount = sale.items.reduce((acc, item) => acc + (item.discount || 0), 0);
    const paid = sale.amountPaid !== undefined ? sale.amountPaid : sale.total;
    const due = sale.total - paid;

    if (isThermal) {
        doc.setFontSize(8);
        const rightX = pageWidth - margin;
        
        // Helper
        const printRow = (label: string, val: string, bold = false) => {
            doc.setFont("helvetica", bold ? "bold" : "normal");
            doc.text(label, margin, currentY);
            doc.text(val, rightX, currentY, { align: 'right' });
            currentY += 4;
        };

        printRow("Subtotal", `${currency} ${sale.subtotal.toFixed(2)}`);
        if (totalDiscount > 0) printRow("Savings", `-${currency} ${totalDiscount.toFixed(2)}`);
        if (sale.tax > 0) printRow("Tax", `${currency} ${sale.tax.toFixed(2)}`);
        
        currentY += 1;
        doc.setFontSize(12);
        printRow("TOTAL", `${currency} ${sale.total.toFixed(0)}`, true);
        
        doc.setFontSize(8);
        currentY += 2;
        printRow("Paid via " + (sale.paymentMethod || 'Cash'), `${currency} ${paid.toFixed(0)}`);
        if (due > 0) printRow("Balance Due", `${currency} ${due.toFixed(0)}`, true);

        // Footer Message
        currentY += 8;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold italic");
        doc.text("Thank You!", pageWidth / 2, currentY, { align: 'center' });
        
        if (settings.invoiceFooterNote) {
            currentY += 4;
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            const note = doc.splitTextToSize(settings.invoiceFooterNote, contentWidth);
            doc.text(note, pageWidth / 2, currentY, { align: 'center' });
        }

    } else {
        // A4 Footer
        const totalsLabelX = pageWidth - 60;
        const totalsValueX = pageWidth - 14;

        const drawTotalRow = (label: string, value: string, isBold = false) => {
            doc.setFontSize(10);
            doc.setFont("helvetica", isBold ? "bold" : "normal");
            doc.setTextColor(darkHeader[0], darkHeader[1], darkHeader[2]);
            doc.text(label, totalsLabelX, currentY);
            doc.text(value, totalsValueX, currentY, { align: 'right' });
            currentY += 6;
        };

        drawTotalRow("Gross Total:", `${currency} ${sale.subtotal.toFixed(2)}`);
        if (totalDiscount > 0) {
            doc.setTextColor(220, 38, 38);
            drawTotalRow("Total Discounts:", `- ${currency} ${totalDiscount.toFixed(2)}`);
        }
        drawTotalRow("Tax:", `${currency} ${sale.tax.toFixed(2)}`);
        
        currentY += 2;
        doc.setDrawColor(200, 200, 200);
        doc.line(totalsLabelX, currentY, totalsValueX, currentY);
        currentY += 8;

        doc.setFontSize(14);
        drawTotalRow("Net Payable:", `${currency} ${sale.total.toFixed(2)}`, true);

        // Payment Details
        currentY += 4;
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(lightText[0], lightText[1], lightText[2]);

        let payText = `Payment Mode: ${sale.paymentMethod || 'Cash'}`;
        if (due > 0.01) {
            payText += ` | Paid: ${currency}${paid.toFixed(2)} | Balance Due: ${currency}${due.toFixed(2)}`;
        } else {
            payText += ` | Fully Paid`;
        }
        doc.text(payText, totalsValueX, currentY, { align: 'right' });

        // Final Thank You
        currentY = Math.max(currentY + 30, 270);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold italic");
        doc.setTextColor(darkHeader[0], darkHeader[1], darkHeader[2]);
        doc.text("Thank you for your business!", pageWidth / 2, currentY, { align: 'center' });
    }

    // --- OUTPUT ---
    if (settings.directPrintEnabled) {
        // Direct Print
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
        // Download
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
