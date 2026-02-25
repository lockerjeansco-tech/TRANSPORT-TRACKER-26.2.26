import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { Parcel } from '../types';
import toast from 'react-hot-toast';

export const generateProfessionalReceipt = (parcel: Parcel & { id: string }) => {
  try {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Header - Company Info
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('ParcelTracker Pro', 20, 25);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Professional Transport Management System', 20, 32);
    
    doc.setFontSize(12);
    doc.text('RECEIPT', pageWidth - 40, 25, { align: 'right' });

    // Body
    doc.setTextColor(30, 41, 59); // slate-800
    doc.setFontSize(10);
    
    // Left Column: Party Details
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', 20, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(parcel.partyName, 20, 62);
    doc.text(`State: ${parcel.state}`, 20, 67);

    // Right Column: LR Details
    doc.setFont('helvetica', 'bold');
    doc.text('LR DETAILS:', pageWidth - 80, 55);
    doc.setFont('helvetica', 'normal');
    doc.text(`LR No: ${parcel.lrNumber}`, pageWidth - 80, 62);
    doc.text(`Date: ${format(new Date(parcel.date || Date.now()), 'dd MMM yyyy')}`, pageWidth - 80, 67);
    doc.text(`Transport: ${parcel.transport || 'N/A'}`, pageWidth - 80, 72);

    let finalY = 85;

    // Table with Error Handling
    try {
      autoTable(doc, {
        startY: 85,
        head: [['Description', 'Weight (kg)', 'Rate (₹)', 'Total (₹)']],
        body: [
          [
            `Parcel Delivery to ${parcel.state}`,
            parcel.weight.toFixed(2),
            parcel.rate.toFixed(2),
            parcel.totalAmount.toFixed(2)
          ]
        ],
        theme: 'striped',
        headStyles: { fillColor: [99, 102, 241], textColor: 255 }, // indigo-500
        styles: { fontSize: 10, cellPadding: 5 },
        columnStyles: {
          3: { halign: 'right' }
        }
      });
      
      finalY = (doc as any).lastAutoTable.finalY;
    } catch (tableError) {
      console.error("AutoTable generation failed:", tableError);
      toast.error("Table generation failed. Using simplified layout.");
      
      // Fallback Layout
      doc.setDrawColor(200);
      doc.line(20, 85, pageWidth - 20, 85);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Description', 20, 92);
      doc.text('Weight', 100, 92);
      doc.text('Rate', 130, 92);
      doc.text('Total', 160, 92);
      
      doc.line(20, 95, pageWidth - 20, 95);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`Parcel Delivery to ${parcel.state}`, 20, 102);
      doc.text(parcel.weight.toFixed(2), 100, 102);
      doc.text(parcel.rate.toFixed(2), 130, 102);
      doc.text(parcel.totalAmount.toFixed(2), 160, 102);
      
      doc.line(20, 108, pageWidth - 20, 108);
      
      finalY = 115;
    }

    // Summary
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', pageWidth - 80, finalY + 20);
    doc.setFont('helvetica', 'normal');
    
    doc.text('Total Amount:', pageWidth - 80, finalY + 30);
    doc.text(`₹${parcel.totalAmount.toLocaleString()}`, pageWidth - 20, finalY + 30, { align: 'right' });
    
    doc.text('Paid Amount:', pageWidth - 80, finalY + 37);
    doc.text(`₹${parcel.paidAmount.toLocaleString()}`, pageWidth - 20, finalY + 37, { align: 'right' });
    
    const balance = parcel.totalAmount - parcel.paidAmount;
    doc.setFont('helvetica', 'bold');
    if (balance > 0) {
      doc.setTextColor(185, 28, 28); // red-700
    } else {
      doc.setTextColor(21, 128, 61); // green-700
    }
    doc.text('Balance Due:', pageWidth - 80, finalY + 47);
    doc.text(`₹${balance.toLocaleString()}`, pageWidth - 20, finalY + 47, { align: 'right' });

    // Footer
    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('This is a computer-generated receipt and does not require a physical signature.', pageWidth / 2, 280, { align: 'center' });
    doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, 285, { align: 'center' });

    // Save
    doc.save(`Receipt_${parcel.lrNumber}_${parcel.partyName}.pdf`);
  } catch (error) {
    console.error("PDF Generation Error:", error);
    toast.error("Failed to generate receipt. Please try again.");
  }
};
