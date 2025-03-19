import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { showAlert } from "@/components/ui/CustomAlertDialog";
import { addDays, format, parseISO } from "date-fns";
import html2canvas from 'html2canvas-pro';
import { useEffect, useRef, useState } from "react";
import { generatePDF } from "./PDFGenerator";

interface ELDLog {
  start_time: string;
  end_time: string;
  duty_status: string;
  remarks?: string;
}

interface DailyLogSheetProps {
  logs: ELDLog[];
  driverName: string;
  tripId: number;
}

const HOUR_WIDTH = 40;
const GRID_HEIGHT = 200;

const DUTY_STATUS_LABELS: Record<string, string> = {
  OFF: 'Off Duty',
  SB: 'Sleeper Berth',
  D: 'Driving',
  ON: 'On Duty (Not Driving)'
};

const DUTY_STATUS_COLORS: Record<string, string> = {
  OFF: 'rgb(243, 244, 246)',
  SB: 'rgb(219, 234, 254)',
  D: 'rgb(220, 252, 231)',
  ON: 'rgb(254, 226, 226)'
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const DailyLogSheet: React.FC<DailyLogSheetProps> = ({ logs, driverName: initialDriverName, tripId }) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [dailyLogs, setDailyLogs] = useState<ELDLog[]>([]);
  const [totalHours, setTotalHours] = useState<Record<string, number>>({
    OFF: 0,
    SB: 0,
    D: 0,
    ON: 0
  });
  const [driverNotes, setDriverNotes] = useState<string>("");
  
  const [carrierName, setCarrierName] = useState<string>("");
  const [truckNumber, setTruckNumber] = useState<string>("");
  const [licenseNumber, setLicenseNumber] = useState<string>("");
  const [fromLocation, setFromLocation] = useState<string>("");
  const [toLocation, setToLocation] = useState<string>("");
  const [totalMiles, setTotalMiles] = useState<string>("");
  const [driverName, setDriverName] = useState<string>(initialDriverName || "");
  
  const logSheetRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const filteredLogs = logs.filter(log => {
      const logDate = format(new Date(log.start_time), 'yyyy-MM-dd');
      return logDate === dateStr;
    });
    
    setDailyLogs(filteredLogs);
    
    const hours: Record<string, number> = {
      OFF: 0,
      SB: 0,
      D: 0,
      ON: 0
    };
    
    filteredLogs.forEach(log => {
      const start = new Date(log.start_time);
      const end = new Date(log.end_time);
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      
      if (log.duty_status in hours) {
        hours[log.duty_status] += durationHours;
      }
    });
    
    Object.keys(hours).forEach(key => {
      hours[key] = parseFloat(hours[key].toFixed(2));
    });
    
    setTotalHours(hours);
  }, [logs, currentDate]);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.style.minWidth = `${HOUR_WIDTH * 24}px`;
      graphRef.current.style.minHeight = `${GRID_HEIGHT}px`;
    }
  }, []);

  const handlePreviousDay = () => {
    setCurrentDate(prev => addDays(prev, -1));
  };
  
  const handleNextDay = () => {
    setCurrentDate(prev => addDays(prev, 1));
  };
  
  const handleExportPDF = async () => {
    try {
      const graphContainer = document.getElementById('daily-activity-graph');
      if (!graphContainer) {
        showAlert("Error", "Graph container not found");
        return;
      }

      let graphImage = null;
      try {
        
        const originalScrollTop = window.scrollY;
        
        
        graphContainer.scrollIntoView({ behavior: 'auto', block: 'start' });
        
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const canvas = await html2canvas(graphContainer, {
          scale: 2,
          logging: true,
          useCORS: true,
          allowTaint: true,
          scrollX: 0,
          scrollY: 0,
          backgroundColor: 'white',
          onclone: (clonedDoc, clonedElement) => {
            
            clonedElement.style.width = `${graphContainer.scrollWidth}px`;
            clonedElement.style.height = `${graphContainer.scrollHeight}px`;
            clonedElement.style.position = 'relative';
            clonedElement.style.overflow = 'visible';
          }
        });
        
        
        window.scrollTo(0, originalScrollTop);
        
        graphImage = canvas.toDataURL('image/png');
      } catch (error) {
        console.error("Error capturing graph:", error);
      }

      const dailyLogs = logs.filter(log => {
        const logDate = new Date(log.start_time);
        return (
          logDate.getDate() === currentDate.getDate() &&
          logDate.getMonth() === currentDate.getMonth() &&
          logDate.getFullYear() === currentDate.getFullYear()
        );
      });

      generatePDF({
        content: {
          title: `Driver's Daily Log - ${format(currentDate, 'yyyy-MM-dd')}`,
          date: currentDate,
          driverName,
          remarks: driverNotes,
          hoursData: {
            offDuty: totalHours.OFF,
            sleeperBerth: totalHours.SB,
            driving: totalHours.D,
            onDuty: totalHours.ON
          },
          carrierName,
          truckNumber,
          licenseNumber,
          fromLocation,
          toLocation,
          totalMiles,
          logs: dailyLogs,
          tripId
        },
        graphImage
      });

      showAlert("Success", "PDF generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      showAlert("Error", "Failed to generate PDF");
    }
  };
  
  const getLogPosition = (log: ELDLog) => {
    const start = new Date(log.start_time);
    const end = new Date(log.end_time);
    
    const startHour = start.getHours() + (start.getMinutes() / 60);
    const endHour = end.getHours() + (end.getMinutes() / 60);
    
    const left = `${startHour * HOUR_WIDTH + 140}px`;
    const width = `${(endHour - startHour) * HOUR_WIDTH}px`;
    
    return {
      left,
      width,
      status: log.duty_status
    };
  };
  
  return (
    <div ref={logSheetRef} className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between items-center mb-6">
        <Button onClick={handlePreviousDay} variant="outline" size="sm">
          Previous Day
        </Button>
        <h2 className="text-xl font-bold">
          {format(currentDate, 'EEEE, MMMM d, yyyy')}
        </h2>
        <Button onClick={handleNextDay} variant="outline" size="sm">
          Next Day
        </Button>
      </div>
      
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Driver Information</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="driver-name" className="text-sm font-medium mb-1">Driver Name</Label>
              <Input
                id="driver-name"
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Enter driver name"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="carrier-name" className="text-sm font-medium mb-1">Carrier Name</Label>
              <Input
                id="carrier-name"
                type="text"
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                placeholder="Enter carrier name"
              />
            </div>
            <div>
              <Label htmlFor="truck-number" className="text-sm font-medium mb-1">Truck Number</Label>
              <Input
                id="truck-number"
                type="text"
                value={truckNumber}
                onChange={(e) => setTruckNumber(e.target.value)}
                placeholder="Enter truck number"
              />
            </div>
            <div>
              <Label htmlFor="license-number" className="text-sm font-medium mb-1">License Number</Label>
              <Input
                id="license-number"
                type="text"
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="Enter license number"
              />
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <h3 className="text-lg font-medium mb-2">Trip Details</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="from-location" className="text-sm font-medium mb-1">From Location</Label>
              <Input
                id="from-location"
                type="text"
                value={fromLocation}
                onChange={(e) => setFromLocation(e.target.value)}
                placeholder="Enter from location"
              />
            </div>
            <div>
              <Label htmlFor="to-location" className="text-sm font-medium mb-1">To Location</Label>
              <Input
                id="to-location"
                type="text"
                value={toLocation}
                onChange={(e) => setToLocation(e.target.value)}
                placeholder="Enter to location"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <Label htmlFor="total-miles" className="text-sm font-medium mb-1">Total Miles</Label>
              <Input
                id="total-miles"
                type="text"
                value={totalMiles}
                onChange={(e) => setTotalMiles(e.target.value)}
                placeholder="Enter total miles"
              />
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-2">Daily Activity Graph</h3>
          <div className="border rounded p-4 overflow-auto relative"
            style={{ 
              width: '100%', 
              height: `${GRID_HEIGHT + 50}px`,
              backgroundColor: 'white' 
            }}
          >
            <div 
              ref={graphRef} 
              id="daily-activity-graph"
              className="relative" 
              style={{ 
                width: `${24 * HOUR_WIDTH + 140}px`, 
                height: `${GRID_HEIGHT}px`, 
                minWidth: '100%' 
              }}
            >
              <div className="flex border-b ml-[140px]">
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
                    className="absolute border-l border-gray-300 h-full"
                    style={{ left: `${hour * HOUR_WIDTH + 140}px` }}
                  />
                ))}
                
                <div className="absolute left-[140px] right-0 top-[25%] border-b border-gray-400 z-5"></div>
                <div className="absolute left-[140px] right-0 top-[50%] border-b border-gray-400 z-5"></div>
                <div className="absolute left-[140px] right-0 top-[75%] border-b border-gray-400 z-5"></div>
                
                <div className="absolute left-0 top-0 w-[140px] z-10" style={{ height: '25%' }}>
                  <div className="absolute left-0 h-full w-full bg-gray-100 border-b flex items-center px-2 font-medium text-xs">
                    <div className="w-32 p-1 rounded" style={{ backgroundColor: DUTY_STATUS_COLORS.OFF }}>{DUTY_STATUS_LABELS.OFF}</div>
                  </div>
                </div>
                <div className="absolute left-0 w-[140px] z-10" style={{ height: '25%', top: '25%' }}>
                  <div className="absolute left-0 h-full w-full bg-gray-100 border-b flex items-center px-2 font-medium text-xs">
                    <div className="w-32 p-1 rounded" style={{ backgroundColor: DUTY_STATUS_COLORS.SB }}>{DUTY_STATUS_LABELS.SB}</div>
                  </div>
                </div>
                <div className="absolute left-0 w-[140px] z-10" style={{ height: '25%', top: '50%' }}>
                  <div className="absolute left-0 h-full w-full bg-gray-100 border-b flex items-center px-2 font-medium text-xs">
                    <div className="w-32 p-1 rounded" style={{ backgroundColor: DUTY_STATUS_COLORS.D }}>{DUTY_STATUS_LABELS.D}</div>
                  </div>
                </div>
                <div className="absolute left-0 w-[140px] z-10" style={{ height: '25%', top: '75%' }}>
                  <div className="absolute left-0 h-full w-full bg-gray-100 border-b flex items-center px-2 font-medium text-xs">
                    <div className="w-32 p-1 rounded" style={{ backgroundColor: DUTY_STATUS_COLORS.ON }}>{DUTY_STATUS_LABELS.ON}</div>
                  </div>
                </div>
                
                <div className="absolute left-[140px] top-0 right-0" style={{ height: '25%', backgroundColor: 'rgba(243, 244, 246, 0.2)' }}></div>
                <div className="absolute left-[140px] right-0" style={{ height: '25%', top: '25%', backgroundColor: 'rgba(219, 234, 254, 0.2)' }}></div>
                <div className="absolute left-[140px] right-0" style={{ height: '25%', top: '50%', backgroundColor: 'rgba(220, 252, 231, 0.2)' }}></div>
                <div className="absolute left-[140px] right-0" style={{ height: '25%', top: '75%', backgroundColor: 'rgba(254, 226, 226, 0.2)' }}></div>
                
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
        </div>
        
        <div className="mt-6 grid grid-cols-4 gap-4">
          <div className="p-2 border rounded" style={{ backgroundColor: DUTY_STATUS_COLORS.OFF }}>
            <div className="text-xs font-medium">{DUTY_STATUS_LABELS.OFF}</div>
            <div className="text-lg">{totalHours.OFF} hrs</div>
          </div>
          <div className="p-2 border rounded" style={{ backgroundColor: DUTY_STATUS_COLORS.SB }}>
            <div className="text-xs font-medium">{DUTY_STATUS_LABELS.SB}</div>
            <div className="text-lg">{totalHours.SB} hrs</div>
          </div>
          <div className="p-2 border rounded" style={{ backgroundColor: DUTY_STATUS_COLORS.D }}>
            <div className="text-xs font-medium">{DUTY_STATUS_LABELS.D}</div>
            <div className="text-lg">{totalHours.D} hrs</div>
          </div>
          <div className="p-2 border rounded" style={{ backgroundColor: DUTY_STATUS_COLORS.ON }}>
            <div className="text-xs font-medium">{DUTY_STATUS_LABELS.ON}</div>
            <div className="text-lg">{totalHours.ON} hrs</div>
          </div>
        </div>
        
        <div className="mt-6">
          <Label htmlFor="driver-notes" className="block text-sm font-medium mb-1">Remarks</Label>
          <Textarea
            id="driver-notes"
            value={driverNotes}
            onChange={(e) => setDriverNotes(e.target.value)}
            placeholder="Enter any remarks or notes for this day"
            className="h-24"
          />
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

export default DailyLogSheet;
