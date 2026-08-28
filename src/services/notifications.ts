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

export function formatNotificationTimeNotice(minutesBefore: number, timePart: string): string {
  if (minutesBefore <= 0) return "Começando agora!";
  if (minutesBefore < 60) return `Começa em ${minutesBefore} minutos (${timePart})`;
  if (minutesBefore >= 60 && minutesBefore < 1440) {
    const hours = Math.floor(minutesBefore / 60);
    const remMinutes = minutesBefore % 60;
    if (remMinutes === 0) {
      return `Começa em ${hours} ${hours === 1 ? 'hora' : 'horas'} (${timePart})`;
    }
    return `Começa em ${hours}h ${remMinutes}min (${timePart})`;
  }
  if (minutesBefore === 1440) return `Começa amanhã às ${timePart}`;
  if (minutesBefore === 10080) return `Começa em 1 semana (${timePart})`;
  const days = Math.floor(minutesBefore / 1440);
  return `Começa em ${days} dias (${timePart})`;
}

export const NotificationService = {
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        try {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'Lumen Acadêmico',
            description: 'Notificações de aulas, provas e estudos do Lumen',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#00FFAA',
            enableLights: true,
            enableVibrate: true,
            showBadge: true,
            bypassDnd: false,
          });
        } catch (channelErr) {
          // Trata com segurança falhas de permissão de canal ou vibração no Android
          console.warn('Erro ao configurar canal de notificação Android (vibração/permissão)', channelErr);
        }
      }

      let existingStatus = 'undetermined';
      try {
        const perm = await Notifications.getPermissionsAsync();
        existingStatus = perm?.status || 'undetermined';
      } catch (getErr) {
        // Trata negações ou exceções de leitura de permissões
        console.warn('Erro ao consultar permissões de notificação / alarmes exatos', getErr);
      }

      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        try {
          const req = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
            },
            android: {},
          });
          finalStatus = req?.status || 'denied';
        } catch (reqErr) {
          // Trata com try/catch seguro qualquer negação de alarme exato (SCHEDULE_EXACT_ALARM) ou restrição do Android 12+
          console.warn('Erro ao requisitar permissões de notificação do SO (SCHEDULE_EXACT_ALARM / restrições de bateria)', reqErr);
          finalStatus = 'denied';
        }
      }
      return finalStatus === 'granted';
    } catch (e) {
      console.warn('Erro geral ao solicitar permissões de notificação', e);
      return false;
    }
  },

  async scheduleEventNotifications(event: AppEvent): Promise<void> {
    if (!event || typeof event !== 'object' || !event.id) return;

    try {
      // First, cancel any existing notifications for this event
      await this.cancelEventNotifications(event.id);

      if (event.isNotified === false || !Array.isArray(event.alerts) || event.alerts.length === 0) return;
      if (!event.date || typeof event.date !== 'string' || !event.startTime) return;

      const datePart = event.date.split('T')[0];
      const timePart = typeof event.startTime === 'string' && event.startTime.includes(':')
        ? event.startTime
        : '08:00';
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
        if (typeof minutesBefore !== 'number' || isNaN(minutesBefore)) continue;
        const triggerDate = subMinutes(eventDate, minutesBefore);
        if (isNaN(triggerDate.getTime())) continue;

        const hour = triggerDate.getHours();
        const minute = triggerDate.getMinutes();

        const timeNotice = formatNotificationTimeNotice(minutesBefore, timePart);

        const content = {
          title: `${categoryEmoji} ${event.title || 'Compromisso'}`,
          body: event.description ? `${timeNotice} • ${event.description}` : timeNotice,
          data: { eventId: event.id },
          sound: true,
          vibrate: [0, 250, 250, 250],
        };

        try {
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
        } catch (scheduleErr) {
          // Gracefully suppress OS denial / exact alarm rejection for this single alert
          console.warn(`Falha ao agendar alerta (${minutesBefore}min) do evento ${event.id}`, scheduleErr);
        }
      }
    } catch (err) {
      console.warn('Falha ao processar notificações do evento', event?.id, err);
    }
  },

  async cancelEventNotifications(eventId: string): Promise<void> {
    if (!eventId || typeof eventId !== 'string') return;
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      if (Array.isArray(scheduled)) {
        for (const notif of scheduled) {
          if (notif?.content?.data?.eventId === eventId) {
            await Notifications.cancelScheduledNotificationAsync(notif.identifier);
          }
        }
      }
    } catch (e) {
      console.warn('Falha ao cancelar notificações', eventId, e);
    }
  }
};
