import { format } from 'date-fns';
import { jsPDF } from 'jspdf';

interface ELDLog {
  start_time: string;
  end_time: string;
  duty_status: string;
  remarks?: string;
}

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
    carrierName?: string;
    truckNumber?: string;
    licenseNumber?: string;
    fromLocation?: string;
    toLocation?: string;
    totalMiles?: string;
    logs?: ELDLog[];
  };
  graphImage?: string | null;
  filename?: string;
}

const drawGraphFromData = (pdf: jsPDF, x: number, y: number, width: number, logs: ELDLog[]) => {
  const height = 50;
  const hourWidth = width / 24;
  
  pdf.setDrawColor(0);
  pdf.setFillColor(255, 255, 255);
  pdf.rect(x, y, width, height, 'FD');
  
  pdf.setDrawColor(200, 200, 200);
  pdf.setFontSize(8);
  
  for (let hour = 0; hour <= 24; hour++) {
    const hourX = x + (hour * hourWidth);
    
    pdf.line(hourX, y, hourX, y + height);
    
    if (hour < 24) {
      const label = hour === 0 ? '12 AM' : 
                   hour < 12 ? `${hour} AM` : 
                   hour === 12 ? '12 PM' : 
                   `${hour - 12} PM`;
      
      pdf.text(label, hourX + (hourWidth / 2), y + height + 5, { align: 'center' });
    }
  }
  
  const statusColors: Record<string, number[]> = {
    'OFF': [240, 240, 240],
    'SB': [220, 230, 250],
    'D': [220, 250, 230],
    'ON': [250, 230, 230]
  };
  
  const statusLabels: Record<string, string> = {
    'OFF': 'Off Duty',
    'SB': 'Sleeper Berth',
    'D': 'Driving',
    'ON': 'On Duty'
  };
  
  const statusPositions: Record<string, number> = {
    'OFF': 0,
    'SB': 1,
    'D': 2,
    'ON': 3
  };
  
  const statusHeight = height / 4;
  
  Object.entries(statusLabels).forEach(([status, label], index) => {
    const statusY = y + (index * statusHeight);
    
    pdf.setFillColor(statusColors[status][0], statusColors[status][1], statusColors[status][2]);
    pdf.rect(x - 30, statusY, 30, statusHeight, 'F');
    
    pdf.setFontSize(6);
    pdf.setTextColor(0);
    pdf.text(label, x - 15, statusY + (statusHeight / 2), { align: 'center' });
    
    pdf.setFillColor(statusColors[status][0], statusColors[status][1], statusColors[status][2], 0.2);
    pdf.rect(x, statusY, width, statusHeight, 'F');
  });
  
  if (logs && logs.length > 0) {
    logs.forEach(log => {
      try {
        const startTime = new Date(log.start_time);
        const endTime = new Date(log.end_time);
        
        const startHour = startTime.getHours() + (startTime.getMinutes() / 60);
        const endHour = endTime.getHours() + (endTime.getMinutes() / 60);
        
        const startX = x + (startHour * hourWidth);
        const logWidth = (endHour - startHour) * hourWidth;
        
        const status = log.duty_status as string;
        const statusIndex = statusPositions[status] || 0;
        const statusY = y + (statusIndex * statusHeight);
        
        pdf.setFillColor(statusColors[status][0], statusColors[status][1], statusColors[status][2]);
        pdf.setDrawColor(150, 150, 150);
        pdf.rect(startX, statusY, logWidth, statusHeight, 'FD');
      } catch (e) {
        console.error('Error drawing log entry:', e);
      }
    });
  }
};

export const generatePDF = async ({ content, graphImage, filename }: PDFGeneratorProps): Promise<boolean> => {
  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const defaultFilename = `daily-log-${format(new Date(content.date), 'yyyy-MM-dd')}-trip-${content.tripId}`;
    const outputFilename = filename || defaultFilename;
    
    const pageWidth = pdf.internal.pageSize.width;
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);
    
    pdf.setFontSize(18);
    pdf.text(content.title, pageWidth / 2, margin + 5, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.text(`Date: ${format(content.date, 'MM/dd/yyyy')}`, pageWidth / 2, margin + 12, { align: 'center' });
    
    let currentY = margin + 20;
    
    pdf.setFontSize(14);
    pdf.text('Driver Information', margin, currentY);
    currentY += 7;
    
    pdf.setFontSize(10);
    pdf.text(`Driver: ${content.driverName}`, margin, currentY);
    currentY += 5;
    
    if (content.carrierName) {
      pdf.text(`Carrier: ${content.carrierName}`, margin, currentY);
      currentY += 5;
    }
    
    if (content.truckNumber) {
      pdf.text(`Truck #: ${content.truckNumber}`, margin, currentY);
      currentY += 5;
    }
    
    if (content.licenseNumber) {
      pdf.text(`License #: ${content.licenseNumber}`, margin, currentY);
      currentY += 5;
    }
    
    currentY += 5;
    
    if (content.fromLocation || content.toLocation || content.totalMiles) {
      pdf.setFontSize(14);
      pdf.text('Trip Details', margin, currentY);
      currentY += 7;
      
      pdf.setFontSize(10);
      
      if (content.fromLocation) {
        pdf.text(`From: ${content.fromLocation}`, margin, currentY);
        currentY += 5;
      }
      
      if (content.toLocation) {
        pdf.text(`To: ${content.toLocation}`, margin, currentY);
        currentY += 5;
      }
      
      if (content.totalMiles) {
        pdf.text(`Total Miles: ${content.totalMiles}`, margin, currentY);
        currentY += 5;
      }
      
      currentY += 5;
    }
    
    pdf.setFontSize(14);
    pdf.text('Hours of Service Summary', margin, currentY);
    currentY += 10;
    
    const tableTop = currentY;
    const colWidth = contentWidth / 4;
    const rowHeight = 10;
    
    pdf.setFillColor(240, 240, 240);
    pdf.rect(margin, tableTop, contentWidth, rowHeight, 'F');
    
    pdf.setFontSize(9);
    pdf.text('Off Duty', margin + (colWidth * 0) + (colWidth / 2), tableTop + 7, { align: 'center' });
    pdf.text('Sleeper Berth', margin + (colWidth * 1) + (colWidth / 2), tableTop + 7, { align: 'center' });
    pdf.text('Driving', margin + (colWidth * 2) + (colWidth / 2), tableTop + 7, { align: 'center' });
    pdf.text('On Duty (Not Driving)', margin + (colWidth * 3) + (colWidth / 2), tableTop + 7, { align: 'center' });
    
    pdf.line(margin, tableTop, margin + contentWidth, tableTop);
    pdf.line(margin, tableTop + rowHeight, margin + contentWidth, tableTop + rowHeight);
    
    pdf.line(margin, tableTop, margin, tableTop + rowHeight * 2);
    pdf.line(margin + colWidth, tableTop, margin + colWidth, tableTop + rowHeight * 2);
    pdf.line(margin + colWidth * 2, tableTop, margin + colWidth * 2, tableTop + rowHeight * 2);
    pdf.line(margin + colWidth * 3, tableTop, margin + colWidth * 3, tableTop + rowHeight * 2);
    pdf.line(margin + colWidth * 4, tableTop, margin + colWidth * 4, tableTop + rowHeight * 2);
    
    pdf.setFontSize(10);
    pdf.text(`${content.hoursData.offDuty} hrs`, margin + (colWidth * 0) + (colWidth / 2), tableTop + rowHeight + 7, { align: 'center' });
    pdf.text(`${content.hoursData.sleeperBerth} hrs`, margin + (colWidth * 1) + (colWidth / 2), tableTop + rowHeight + 7, { align: 'center' });
    pdf.text(`${content.hoursData.driving} hrs`, margin + (colWidth * 2) + (colWidth / 2), tableTop + rowHeight + 7, { align: 'center' });
    pdf.text(`${content.hoursData.onDuty} hrs`, margin + (colWidth * 3) + (colWidth / 2), tableTop + rowHeight + 7, { align: 'center' });
    
    pdf.line(margin, tableTop + rowHeight * 2, margin + contentWidth, tableTop + rowHeight * 2);
    
    currentY = tableTop + rowHeight * 2 + 10;
    
    if (graphImage) {
      pdf.setFontSize(14);
      pdf.text('Daily Activity Graph', margin, currentY);
      currentY += 10;
      
      try {
        pdf.addImage(graphImage, 'PNG', margin, currentY, contentWidth, 50);
        currentY += 55;
      } catch (error) {
        console.error('Error adding graph image to PDF:', error);
        if (content.logs) {
          currentY = tableTop + rowHeight * 3;
          pdf.setFontSize(14);
          pdf.text('Daily Activity Graph', margin, currentY);
          currentY += 10;
          
          drawGraphFromData(pdf, margin, currentY, contentWidth, content.logs);
          currentY += 55;
        }
      }
    }
    else if (content.logs) {
      pdf.setFontSize(14);
      pdf.text('Daily Activity Graph', margin, currentY);
      currentY += 10;
      
      drawGraphFromData(pdf, margin, currentY, contentWidth, content.logs);
      currentY += 55;
    }
    
    if (content.remarks && content.remarks.trim() !== '') {
      pdf.setFontSize(14);
      pdf.text('Remarks', margin, currentY);
      currentY += 7;
      
      pdf.setFontSize(10);
      
      const textLines = pdf.splitTextToSize(content.remarks, contentWidth);
      pdf.text(textLines, margin, currentY);
      currentY += textLines.length * 5 + 5;
    }
    
    pdf.setFontSize(10);
    pdf.text(`Trip ID: ${content.tripId}`, margin, currentY);
    currentY += 5;
    
    pdf.text(`Generated on: ${format(new Date(), 'MM/dd/yyyy hh:mm a')}`, margin, currentY);
    
    pdf.save(`${outputFilename}.pdf`);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    return false;
  }
};
