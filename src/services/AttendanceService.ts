import { AppEvent, AttendanceRecord } from '../types';
import { StorageService } from './storage';
import { generateId, getLocalDateString } from '../utils';

export const AttendanceService = {
  async generatePendingAttendances(events: AppEvent[], existingRecords: AttendanceRecord[]): Promise<AttendanceRecord[]> {
    const today = new Date();
    const todayStr = getLocalDateString(today);
    const currentMins = today.getHours() * 60 + today.getMinutes();
    
    const newRecords: AttendanceRecord[] = [];
    const classEvents = events.filter(e => e.category === 'Faculdade/Aulas' && e.recurrence === 'weekly' && e.subjectId);

    // Fast lookup for existing records: Set of "eventId:date"
    const existingSet = new Set(existingRecords.map(r => `${r.eventId}:${r.date}`));

    for (const event of classEvents) {
      if (!event.subjectId || !event.date) continue;
      
      const startDate = new Date(event.date + 'T12:00:00');
      if (isNaN(startDate.getTime())) continue;

      const targetDayOfWeek = startDate.getDay();
      
      // Align cursor to the exact first occurrence of targetDayOfWeek on or after startDate
      const cursorDate = new Date(startDate);
      const dayDiff = (targetDayOfWeek - cursorDate.getDay() + 7) % 7;
      cursorDate.setDate(cursorDate.getDate() + dayDiff);
      
      // Step by 7 days directly instead of daily iteration
      while (cursorDate <= today) {
        const dateStr = getLocalDateString(cursorDate);
        
        // Check if class has finished
        let isPast = false;
        if (dateStr < todayStr) {
          isPast = true;
        } else if (dateStr === todayStr) {
          const [endH, endM] = (event.endTime || '23:59').split(':').map(Number);
          if ((endH * 60 + endM) < currentMins) {
            isPast = true;
          }
        }
        
        if (isPast) {
          const key = `${event.id}:${dateStr}`;
          if (!existingSet.has(key)) {
            existingSet.add(key); // prevent duplicates in the same pass
            newRecords.push({
              id: generateId('att'),
              subjectId: event.subjectId,
              eventId: event.id,
              date: dateStr,
              status: 'pending'
            });
          }
        }
        
        // Advance exactly 1 week (7 days)
        cursorDate.setDate(cursorDate.getDate() + 7);
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
