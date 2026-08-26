import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AppEvent } from '../types';
import { parseISO, subMinutes } from 'date-fns';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const NotificationService = {
  async requestPermissions() {
    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Lumen Acadêmico',
          description: 'Notificações de aulas, provas e estudos do Lumen',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00FFAA',
          enableLights: true,
          enableVibrate: true,
          showBadge: true,
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      return finalStatus === 'granted';
    } catch (e) {
      console.warn('Erro ao solicitar permissões de notificação', e);
      return false;
    }
  },

  async scheduleEventNotifications(event: AppEvent) {
    try {
      // First, cancel any existing notifications for this event
      await this.cancelEventNotifications(event.id);

      if (event.isNotified === false || !event.alerts || event.alerts.length === 0) return;
      if (!event.date || !event.startTime) return;

      const datePart = event.date.split('T')[0];
      const timePart = event.startTime.includes(':') ? event.startTime : '08:00';
      const eventDate = parseISO(`${datePart}T${timePart}:00`);
      
      if (isNaN(eventDate.getTime())) return;

      const categoryEmoji = event.category?.includes('Prova') || event.title?.toLowerCase().includes('prova')
        ? '📝'
        : event.category?.includes('Saúde') || event.category?.includes('Academia')
        ? '💪'
        : event.category?.includes('Lazer')
        ? '☕'
        : '📅';

      for (const minutesBefore of event.alerts) {
        const triggerDate = subMinutes(eventDate, minutesBefore);
        if (isNaN(triggerDate.getTime())) continue;

        const hour = triggerDate.getHours();
        const minute = triggerDate.getMinutes();

        const timeNotice = minutesBefore === 0
          ? 'Começando agora!'
          : minutesBefore < 60
          ? `Começa em ${minutesBefore} minutos (${event.startTime})`
          : `Começa em ${Math.floor(minutesBefore / 60)}h (${event.startTime})`;

        const content = {
          title: `${categoryEmoji} ${event.title}`,
          body: event.description ? `${timeNotice} • ${event.description}` : timeNotice,
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
    } catch (err) {
      console.warn('Falha ao agendar notificações do evento', event.id, err);
    }
  },

  async cancelEventNotifications(eventId: string) {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      for (const notif of scheduled) {
        if (notif.content.data?.eventId === eventId) {
          await Notifications.cancelScheduledNotificationAsync(notif.identifier);
        }
      }
    } catch (e) {
      console.warn('Falha ao cancelar notificações', eventId, e);
    }
  }
};
