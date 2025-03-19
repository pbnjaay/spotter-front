"use client";

import { format } from "date-fns";
import jsPDF from "jspdf";

interface PDFGeneratorProps {
  content: {
    title: string;
    date: Date;
    driverName: string;
    remarks: string;
    hoursData: {
      offDuty: number;
      sleeperBerth: number;
      driving: number;
      onDuty: number;
    };
    tripId: number;
  };
  filename: string;
}

export const generatePDF = async ({
  content,
  filename
}: PDFGeneratorProps): Promise<boolean> => {
  try {
    
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    pdf.setFontSize(18);
    pdf.text(content.title, pageWidth / 2, margin, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text(`Date: ${format(content.date, 'MM/dd/yyyy')}`, margin, margin + 10);
    pdf.text(`Driver: ${content.driverName || 'Not specified'}`, margin, margin + 20);
    pdf.text(`Trip ID: ${content.tripId}`, margin, margin + 30);
    
    pdf.setFontSize(14);
    pdf.text('Hours of Service Summary', margin, margin + 45);
    
    const tableTop = margin + 50;
    const rowHeight = 10;
    const colWidth = contentWidth / 4;
    
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'bold');
    pdf.text('Off Duty', margin, tableTop);
    pdf.text('Sleeper Berth', margin + colWidth, tableTop);
    pdf.text('Driving', margin + colWidth * 2, tableTop);
    pdf.text('On Duty (Not Driving)', margin + colWidth * 3, tableTop);
    
    pdf.setFont(undefined, 'normal');
    pdf.text(`${content.hoursData.offDuty} hrs`, margin, tableTop + rowHeight);
    pdf.text(`${content.hoursData.sleeperBerth} hrs`, margin + colWidth, tableTop + rowHeight);
    pdf.text(`${content.hoursData.driving} hrs`, margin + colWidth * 2, tableTop + rowHeight);
    pdf.text(`${content.hoursData.onDuty} hrs`, margin + colWidth * 3, tableTop + rowHeight);
    
    pdf.line(margin, tableTop - 5, margin + contentWidth, tableTop - 5); 
    pdf.line(margin, tableTop + rowHeight + 5, margin + contentWidth, tableTop + rowHeight + 5); 
    
    pdf.setFontSize(14);
    pdf.text('Remarks', margin, tableTop + rowHeight * 3);
    
    pdf.setFontSize(10);
    const remarkText = content.remarks || 'No remarks provided.';
    const remarkLines = pdf.splitTextToSize(remarkText, contentWidth);
    pdf.text(remarkLines, margin, tableTop + rowHeight * 4);
    
    const footerText = `Generated on ${format(new Date(), 'MM/dd/yyyy HH:mm')}`;
    pdf.setFontSize(8);
    pdf.text(footerText, pageWidth / 2, pdf.internal.pageSize.getHeight() - 10, { align: 'center' });
    
    pdf.save(`${filename}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
};
