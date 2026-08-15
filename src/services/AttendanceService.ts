import { AppEvent, AttendanceRecord, Subject } from '../types';
import { StorageService } from './storage';

export const AttendanceService = {
  async generatePendingAttendances(events: AppEvent[], existingRecords: AttendanceRecord[]): Promise<AttendanceRecord[]> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentMins = today.getHours() * 60 + today.getMinutes();
    
    let newRecords: AttendanceRecord[] = [];
    
    const classEvents = events.filter(e => e.category === 'Faculdade/Aulas' && e.recurrence === 'weekly' && e.subjectId);

    for (const event of classEvents) {
      if (!event.subjectId) continue;
      
      const startDate = new Date(event.date + 'T12:00:00');
      const targetDayOfWeek = startDate.getDay();
      
      // Iterate from startDate up to today
      let cursorDate = new Date(startDate);
      
      while (cursorDate <= today) {
        if (cursorDate.getDay() === targetDayOfWeek) {
          const dateStr = cursorDate.toISOString().split('T')[0];
          
          // Check if class has finished
          let isPast = false;
          if (dateStr < todayStr) {
            isPast = true;
          } else if (dateStr === todayStr) {
            const [endH, endM] = event.endTime.split(':').map(Number);
            if ((endH * 60 + endM) < currentMins) {
              isPast = true;
            }
          }
          
          if (isPast) {
            // Check if record exists
            const exists = existingRecords.some(r => r.eventId === event.id && r.date === dateStr);
            if (!exists) {
              newRecords.push({
                id: `att_${Date.now()}_${Math.random()}`,
                subjectId: event.subjectId,
                eventId: event.id,
                date: dateStr,
                status: 'pending'
              });
            }
          }
        }
        // Advance 1 day
        cursorDate.setDate(cursorDate.getDate() + 1);
      }
    }
    
    if (newRecords.length > 0) {
      const updatedRecords = [...existingRecords, ...newRecords];
      await StorageService.saveAttendances(updatedRecords);
      return updatedRecords;
    }
    
    return existingRecords;
  }
};
