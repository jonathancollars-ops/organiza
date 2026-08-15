import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AppEvent } from '../types';
import { parseISO, subMinutes } from 'date-fns';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const NotificationService = {
  async requestPermissions() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00FFAA',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  },

  async scheduleEventNotifications(event: AppEvent) {
    // First, cancel any existing notifications for this event
    await this.cancelEventNotifications(event.id);

    if (event.isNotified === false || event.alerts.length === 0) return;

    const eventDate = parseISO(`${event.date.split('T')[0]}T${event.startTime}:00`);

    for (const minutesBefore of event.alerts) {
      const triggerDate = subMinutes(eventDate, minutesBefore);
      const hour = triggerDate.getHours();
      const minute = triggerDate.getMinutes();
      
      const content = {
        title: event.title,
        body: event.description ? event.description : `Começa em ${minutesBefore} minutos!`,
        data: { eventId: event.id },
        sound: true,
      };

      if (event.recurrence === 'daily') {
        // Daily recurring notification
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour,
            minute,
            channelId: 'default',
          },
        });
      } else if (event.recurrence === 'weekly') {
        // Weekly recurring notification
        // Note: date-fns getDay returns 0-6 (Sun-Sat). Expo requires 1-7 (Sun-Sat).
        const triggerWeekday = triggerDate.getDay() + 1;
        await Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: triggerWeekday,
            hour,
            minute,
            channelId: 'default',
          },
        });
      } else {
        // One-time notification
        if (triggerDate.getTime() > Date.now()) {
          await Notifications.scheduleNotificationAsync({
            content,
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate.getTime(),
              channelId: 'default',
            },
          });
        }
      }
    }
  },

  async cancelEventNotifications(eventId: string) {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.eventId === eventId) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  }
};
