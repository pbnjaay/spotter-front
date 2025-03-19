"use client";

import { useRef, useEffect, useState } from "react";
import { format, parseISO, startOfDay, endOfDay, addDays, isWithinInterval } from "date-fns";
import { ELDLog, DUTY_STATUS_COLORS } from "@/types";
import { Button } from "@/components/ui/button";
import { generatePDF } from "./PDFGenerator";
import { showAlert } from "@/components/ui/CustomAlertDialog";

interface DailyLogSheetProps {
  logs: ELDLog[];
  tripId: number;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const GRID_HEIGHT = 200;
const HOUR_WIDTH = 30;

export default function DailyLogSheet({ logs, tripId }: DailyLogSheetProps) {
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (logs.length > 0) {
      return startOfDay(parseISO(logs[0].start_time));
    }
    return startOfDay(new Date());
  });
  
  const [dailyLogs, setDailyLogs] = useState<ELDLog[]>([]);
  const [driverName, setDriverName] = useState<string>("");
  const [driverNotes, setDriverNotes] = useState<string>("");
  const [totalHours, setTotalHours] = useState<Record<string, number>>({
    OFF: 0,
    SB: 0,
    D: 0,
    ON: 0
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<HTMLDivElement>(null);
  const logSheetRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const dayStart = startOfDay(currentDate);
    const dayEnd = endOfDay(currentDate);
    
    const filteredLogs = logs.filter(log => {
      const startTime = parseISO(log.start_time);
      const endTime = parseISO(log.end_time);
      
      
      return (
        isWithinInterval(startTime, { start: dayStart, end: dayEnd }) ||
        isWithinInterval(endTime, { start: dayStart, end: dayEnd }) ||
        (startTime < dayStart && endTime > dayEnd)
      );
    });
    
    setDailyLogs(filteredLogs);
    
    const hours: Record<string, number> = {
      OFF: 0,
      SB: 0,
      D: 0,
      ON: 0
    };
    
    filteredLogs.forEach(log => {
      const startTime = parseISO(log.start_time);
      const endTime = parseISO(log.end_time);
      
      
      const adjustedStart = startTime < dayStart ? dayStart : startTime;
      const adjustedEnd = endTime > dayEnd ? dayEnd : endTime;
      
      
      const durationHours = (adjustedEnd.getTime() - adjustedStart.getTime()) / (1000 * 60 * 60);
      
      
      hours[log.duty_status] += durationHours;
    });
    
    Object.keys(hours).forEach(key => {
      hours[key] = Math.round(hours[key] * 10) / 10;
    });
    
    setTotalHours(hours);
  }, [logs, currentDate]);
  
  
  useEffect(() => {
    if (canvasRef.current && signaturePadRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#000';
        
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        
        const startDrawing = (e: MouseEvent) => {
          isDrawing = true;
          const rect = canvas.getBoundingClientRect();
          [lastX, lastY] = [e.clientX - rect.left, e.clientY - rect.top];
        };
        
        const draw = (e: MouseEvent) => {
          if (!isDrawing) return;
          
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          ctx.beginPath();
          ctx.moveTo(lastX, lastY);
          ctx.lineTo(x, y);
          ctx.stroke();
          
          [lastX, lastY] = [x, y];
        };
        
        const stopDrawing = () => {
          if (isDrawing) {
            isDrawing = false;
            
            setDriverSignature(canvas.toDataURL());
          }
        };
        
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
        
        return () => {
          canvas.removeEventListener('mousedown', startDrawing);
          canvas.removeEventListener('mousemove', draw);
          canvas.removeEventListener('mouseup', stopDrawing);
          canvas.removeEventListener('mouseout', stopDrawing);
        };
      }
    }
  }, []);
  
  const clearSignature = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setDriverSignature(null);
      }
    }
  };
  
  const handlePreviousDay = () => {
    setCurrentDate(prev => addDays(prev, -1));
  };
  
  const handleNextDay = () => {
    setCurrentDate(prev => addDays(prev, 1));
  };
  
  const handleExportPDF = async () => {
    try {
      const success = await generatePDF({
        content: {
          title: "Driver's Daily Log",
          date: currentDate,
          driverName: driverName,
          remarks: driverNotes,
          hoursData: {
            offDuty: totalHours.OFF,
            sleeperBerth: totalHours.SB,
            driving: totalHours.D,
            onDuty: totalHours.ON
          },
          tripId: tripId
        },
        filename: `daily-log-${format(currentDate, 'yyyy-MM-dd')}-trip-${tripId}`
      });
      
      if (!success) {
        await showAlert('Error', 'There was an error generating the PDF. Please try again.');
      } else {
        await showAlert('Success', 'PDF generated successfully!');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      await showAlert('Error', 'There was an error generating the PDF. Please try again.');
    }
  };
  
  
  const getLogPosition = (log: ELDLog) => {
    const dayStart = startOfDay(currentDate);
    const startTime = parseISO(log.start_time);
    const endTime = parseISO(log.end_time);
    
    
    const adjustedStart = startTime < dayStart ? dayStart : startTime;
    const adjustedEnd = endTime > endOfDay(currentDate) ? endOfDay(currentDate) : endTime;
    
    
    const startHour = adjustedStart.getHours() + (adjustedStart.getMinutes() / 60);
    const endHour = adjustedEnd.getHours() + (adjustedEnd.getMinutes() / 60);
    
    return {
      left: `${startHour * HOUR_WIDTH}px`,
      width: `${(endHour - startHour) * HOUR_WIDTH}px`,
      status: log.duty_status
    };
  };
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Driver&apos;s Daily Log</h2>
        <div className="flex space-x-2">
          <Button onClick={handlePreviousDay} variant="outline" size="sm">Previous Day</Button>
          <span className="px-4 py-2 bg-gray-100 rounded font-medium">
            {format(currentDate, 'MMMM d, yyyy')}
          </span>
          <Button onClick={handleNextDay} variant="outline" size="sm">Next Day</Button>
        </div>
      </div>
      
      <div ref={logSheetRef} className="border rounded-lg p-4 bg-white">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Driver Name</label>
            <input
              type="text"
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Enter driver name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <div className="p-2 border rounded bg-gray-50">
              {format(currentDate, 'MM/dd/yyyy')}
            </div>
          </div>
        </div>
        
        
        <div className="mt-6 overflow-x-auto">
          <div className="relative" style={{ width: `${24 * HOUR_WIDTH}px`, height: `${GRID_HEIGHT}px` }}>
            
            <div className="flex border-b">
              {HOURS.map(hour => (
                <div 
                  key={hour} 
                  className="text-xs text-center font-medium"
                  style={{ width: `${HOUR_WIDTH}px` }}
                >
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </div>
              ))}
            </div>
            
            
            <div className="relative" style={{ height: `${GRID_HEIGHT}px` }}>
              {HOURS.map(hour => (
                <div 
                  key={hour} 
                  className="absolute border-l h-full"
                  style={{ left: `${hour * HOUR_WIDTH}px` }}
                />
              ))}
              
              
              <div className="absolute left-0 top-0 w-full" style={{ height: '25%' }}>
                <div className="absolute left-0 h-full bg-gray-100 border-b flex items-center px-2 font-medium text-xs">
                  OFF DUTY
                </div>
              </div>
              <div className="absolute left-0 top-25%" style={{ height: '25%' }}>
                <div className="absolute left-0 h-full bg-gray-100 border-b flex items-center px-2 font-medium text-xs">
                  SLEEPER BERTH
                </div>
              </div>
              <div className="absolute left-0 top-50%" style={{ height: '25%' }}>
                <div className="absolute left-0 h-full bg-gray-100 border-b flex items-center px-2 font-medium text-xs">
                  DRIVING
                </div>
              </div>
              <div className="absolute left-0 top-75%" style={{ height: '25%' }}>
                <div className="absolute left-0 h-full bg-gray-100 border-b flex items-center px-2 font-medium text-xs">
                  ON DUTY (NOT DRIVING)
                </div>
              </div>
              
              
              {dailyLogs.map((log, index) => {
                const { left, width, status } = getLogPosition(log);
                let top = '0%';
                
                if (status === 'OFF') top = '0%';
                else if (status === 'SB') top = '25%';
                else if (status === 'D') top = '50%';
                else if (status === 'ON') top = '75%';
                
                return (
                  <div
                    key={index}
                    className="absolute h-[25%] rounded-sm border border-gray-400 flex items-center justify-center text-xs"
                    style={{
                      left,
                      width,
                      top,
                      backgroundColor: DUTY_STATUS_COLORS[status],
                      overflow: 'hidden'
                    }}
                    title={`${format(parseISO(log.start_time), 'h:mm a')} - ${format(parseISO(log.end_time), 'h:mm a')}: ${log.remarks}`}
                  >
                    {parseFloat(width) > 60 && (
                      <span className="truncate px-1">
                        {format(parseISO(log.start_time), 'h:mm a')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="p-2 border rounded">
            <div className="text-xs font-medium">Off Duty</div>
            <div className="text-lg">{totalHours.OFF} hrs</div>
          </div>
          <div className="p-2 border rounded">
            <div className="text-xs font-medium">Sleeper Berth</div>
            <div className="text-lg">{totalHours.SB} hrs</div>
          </div>
          <div className="p-2 border rounded">
            <div className="text-xs font-medium">Driving</div>
            <div className="text-lg">{totalHours.D} hrs</div>
          </div>
          <div className="p-2 border rounded">
            <div className="text-xs font-medium">On Duty (Not Driving)</div>
            <div className="text-lg">{totalHours.ON} hrs</div>
          </div>
        </div>
        
        
        <div className="mt-6">
          <label className="block text-sm font-medium mb-1">Remarks</label>
          <textarea
            value={driverNotes}
            onChange={(e) => setDriverNotes(e.target.value)}
            className="w-full p-2 border rounded h-24"
            placeholder="Enter any remarks or notes for this day"
          />
        </div>
        
        
        <div className="mt-6">
          <label className="block text-sm font-medium mb-1">Driver Signature</label>
          <div ref={signaturePadRef} className="border rounded p-2 bg-gray-50">
            <canvas 
              ref={canvasRef} 
              width={400} 
              height={100} 
              className="border w-full bg-white"
            />
          </div>
          <div className="mt-2 flex justify-end">
            <Button onClick={clearSignature} variant="outline" size="sm">Clear Signature</Button>
          </div>
        </div>
      </div>
      
      <div className="mt-6 flex justify-between">
        <Button onClick={handleExportPDF} variant="default">
          Export to PDF
        </Button>
        <div className="text-sm text-gray-500">
          Trip ID: {tripId}
        </div>
      </div>
    </div>
  );
}
