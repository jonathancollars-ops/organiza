import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch } from 'react-native';
import Slider from '@react-native-community/slider';
import { Calendar } from 'react-native-calendars';
import { AppEvent, EventCategory, RecurrenceType, ThemeType } from '../types';
import { getThemeColors, CategoryColors } from '../theme';

interface EventModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (event: AppEvent) => void;
  onDelete?: (eventId: string) => void;
  theme: ThemeType;
  initialEvent?: AppEvent | null;
  initialDate?: string | null;
  isDateLocked?: boolean;
}

const CATEGORIES: EventCategory[] = ['Saúde/Academia', 'Faculdade/Aulas', 'Provas/Trabalhos', 'Lazer', 'Outros'];

const ALERT_OPTIONS = [
  { label: 'Na hora', value: 0 },
  { label: '15 min antes', value: 15 },
  { label: '1 hora antes', value: 60 },
  { label: '1 dia antes', value: 1440 },
  { label: '1 semana antes', value: 10080 },
];

const HOURS = Array.from({ length: 17 }, (_, i) => `${(i + 7).toString().padStart(2, '0')}:00`);

export const EventModal: React.FC<EventModalProps> = ({ visible, onClose, onSave, onDelete, theme, initialEvent, initialDate, isDateLocked }) => {
  const colors = getThemeColors(theme);
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('Saúde/Academia');
  const [date, setDate] = useState('');
  const [startMinutes, setStartMinutes] = useState(480);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [customAlertVal, setCustomAlertVal] = useState('');
  const [customAlertUnit, setCustomAlertUnit] = useState<number>(1); // 1=min, 60=hour, 1440=day
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [alerts, setAlerts] = useState<number[]>([0]); // Default "Na hora"
  const [isImportant, setIsImportant] = useState(false);
  const [isNotified, setIsNotified] = useState(true);
  const [showCalendar, setShowCalendar] = useState(false);

  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  };

  const formatTime = (totalMinutes: number) => {
    const total = totalMinutes % 1440; // max 24h
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const formatDuration = (totalMinutes: number) => {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h} hora${h > 1 ? 's' : ''}`;
    return `${m} minutos`;
  };

  React.useEffect(() => {
    if (visible) {
      if (initialEvent) {
        setTitle(initialEvent.title);
        setCategory(initialEvent.category);
        setDate(initialEvent.date);
        const start = parseTime(initialEvent.startTime);
        setStartMinutes(start);
        
        if (initialEvent.endTime) {
           let end = parseTime(initialEvent.endTime);
           if (end < start) end += 1440; // crossed midnight
           setDurationMinutes(end - start);
        } else {
           setDurationMinutes(60);
        }

        setRecurrence(initialEvent.recurrence);
        setAlerts(initialEvent.alerts || [0]);
        setIsImportant(initialEvent.isImportant || false);
        setIsNotified(initialEvent.isNotified !== false);
      } else {
        setTitle('');
        setCategory('Saúde/Academia');
        setDate(initialDate || new Date().toISOString().split('T')[0]);
        setStartMinutes(480);
        setDurationMinutes(60);
        setRecurrence('none');
        setAlerts([0]);
        setIsImportant(false);
        setIsNotified(true);
      }
    }
  }, [visible, initialEvent, initialDate]);

  const toggleAlert = (val: number) => {
    if (alerts.includes(val)) {
      setAlerts(alerts.filter(a => a !== val));
    } else {
      setAlerts([...alerts, val]);
    }
  };

  const addCustomAlert = () => {
    const val = parseInt(customAlertVal, 10);
    if (!isNaN(val) && val > 0) {
      const totalMin = val * customAlertUnit;
      if (!alerts.includes(totalMin)) {
        setAlerts([...alerts, totalMin]);
      }
    }
    setCustomAlertVal('');
  };

  const handleSave = () => {
    if (!title.trim() || !date.trim()) return;
    
    const startTimeStr = formatTime(startMinutes);
    const endTimeStr = formatTime(startMinutes + durationMinutes);
    
    const newEvent: AppEvent = {
      id: initialEvent ? initialEvent.id : Date.now().toString(),
      title,
      category,
      date,
      startTime: startTimeStr,
      endTime: endTimeStr,
      recurrence,
      alerts,
      isCompleted: initialEvent ? initialEvent.isCompleted : false,
      isImportant,
      isNotified,
    };
    onSave(newEvent);
  };

  const handleDelete = () => {
    if (initialEvent && onDelete) {
      onDelete(initialEvent.id);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <ScrollView>
            <Text style={[styles.title, { color: colors.text }]}>Novo Compromisso</Text>
            
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Título"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <Text style={[styles.label, { color: colors.text }]}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.badge,
                    { backgroundColor: category === c ? CategoryColors[c] : 'transparent', borderColor: CategoryColors[c], borderWidth: 1 }
                  ]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={{ color: category === c ? '#000' : colors.text }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10, marginBottom: 15 }}>
                <Text style={[styles.label, { color: colors.text }]}>Data</Text>
                {isDateLocked ? (
                  <View style={[styles.input, { backgroundColor: colors.background, opacity: 0.7, paddingVertical: 14 }]}>
                    <Text style={{ color: colors.text }}>{date.split('-').reverse().join('/')} (Bloqueado nesta visão)</Text>
                  </View>
                ) : (
                  <View>
                    <TouchableOpacity 
                      style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]} 
                      onPress={() => setShowCalendar(!showCalendar)}
                    >
                      <Text style={{ color: colors.text, fontSize: 16 }}>{date.split('-').reverse().join('/')}</Text>
                      <Text style={{ color: colors.primary }}>📅 Escolher</Text>
                    </TouchableOpacity>
                    
                    {showCalendar && (
                      <View style={{ marginBottom: 20, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                        <Calendar
                          current={date}
                          onDayPress={(day: any) => {
                            setDate(day.dateString);
                            setShowCalendar(false);
                          }}
                          markedDates={{
                            [date]: { selected: true, selectedColor: colors.primary, selectedTextColor: '#000' }
                          }}
                          theme={{
                            calendarBackground: colors.surface,
                            textSectionTitleColor: colors.textSecondary,
                            dayTextColor: colors.text,
                            monthTextColor: colors.text,
                            arrowColor: colors.primary,
                          }}
                        />
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>

            <View style={{ marginBottom: 20 }}>
              <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
                <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Horário de Início</Text>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18 }}>
                  {formatTime(startMinutes)}
                </Text>
              </View>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0}
                maximumValue={1425} // 23:45
                step={15}
                value={startMinutes}
                onValueChange={setStartMinutes}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
            </View>

            <View style={{ marginBottom: 20 }}>
              <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
                <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Duração do Evento</Text>
                <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18 }}>
                  {formatDuration(durationMinutes)}
                </Text>
              </View>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={15}
                maximumValue={720} // 12 horas
                step={15}
                value={durationMinutes}
                onValueChange={setDurationMinutes}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor={colors.border}
                thumbTintColor={colors.primary}
              />
              <Text style={{ color: colors.textSecondary, alignSelf: 'flex-end', fontSize: 12 }}>
                Término às {formatTime(startMinutes + durationMinutes)}
              </Text>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Recorrência</Text>
            <View style={styles.row}>
              {['none', 'daily', 'weekly'].map(r => (
                <TouchableOpacity
                  key={r}
                  style={[
                    styles.badge,
                    { backgroundColor: recurrence === r ? colors.primary : 'transparent', borderColor: colors.primary, borderWidth: 1 }
                  ]}
                  onPress={() => setRecurrence(r as RecurrenceType)}
                >
                  <Text style={{ color: recurrence === r ? '#000' : colors.text }}>
                    {r === 'none' ? 'Único' : r === 'daily' ? 'Diário' : 'Semanal'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={[styles.row, { marginTop: 15, alignItems: 'center' }]}>
              <Text style={[styles.label, { color: colors.text, marginBottom: 0, flex: 1 }]}>Destaque (Evento Importante)</Text>
              <Switch 
                value={isImportant} 
                onValueChange={setIsImportant} 
                trackColor={{ true: colors.primary }} 
                thumbColor={isImportant ? '#fff' : '#f4f3f4'}
              />
            </View>

            <View style={[styles.row, { marginTop: 15, alignItems: 'center' }]}>
              <Text style={[styles.label, { color: colors.text, marginBottom: 0, flex: 1 }]}>Ativar Notificações</Text>
              <Switch 
                value={isNotified} 
                onValueChange={setIsNotified} 
                trackColor={{ true: colors.primary }} 
                thumbColor={isNotified ? '#fff' : '#f4f3f4'}
              />
            </View>

            {isNotified && (
              <>
                <Text style={[styles.label, { color: colors.text, marginTop: 15 }]}>Lembretes Múltiplos</Text>
                
                <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 13 }}>Padrões:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.horizontalScroll, { marginBottom: 15 }]}>
                  {ALERT_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.badge,
                        { 
                          backgroundColor: alerts.includes(option.value) ? colors.primary : 'transparent', 
                          borderColor: colors.primary, 
                          borderWidth: 1 
                        }
                      ]}
                      onPress={() => toggleAlert(option.value)}
                    >
                      <Text style={{ color: alerts.includes(option.value) ? '#000' : colors.text }}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 13 }}>Personalizado:</Text>
                <View style={[styles.row, { marginBottom: 15, alignItems: 'center' }]}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 10, color: colors.text, borderColor: colors.border }]}
                    placeholder="Ex: 5"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="numeric"
                    value={customAlertVal}
                    onChangeText={setCustomAlertVal}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginRight: 10 }}>
                    <TouchableOpacity 
                      style={[styles.badge, { backgroundColor: customAlertUnit === 1 ? colors.primary : colors.surface, borderWidth: 1, borderColor: colors.primary }]}
                      onPress={() => setCustomAlertUnit(1)}
                    >
                      <Text style={{ color: customAlertUnit === 1 ? '#000' : colors.text }}>Min</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.badge, { backgroundColor: customAlertUnit === 60 ? colors.primary : colors.surface, borderWidth: 1, borderColor: colors.primary }]}
                      onPress={() => setCustomAlertUnit(60)}
                    >
                      <Text style={{ color: customAlertUnit === 60 ? '#000' : colors.text }}>Hora</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.badge, { backgroundColor: customAlertUnit === 1440 ? colors.primary : colors.surface, borderWidth: 1, borderColor: colors.primary }]}
                      onPress={() => setCustomAlertUnit(1440)}
                    >
                      <Text style={{ color: customAlertUnit === 1440 ? '#000' : colors.text }}>Dia</Text>
                    </TouchableOpacity>
                  </ScrollView>
                  <TouchableOpacity 
                    style={[styles.badge, { backgroundColor: colors.primary, justifyContent: 'center', height: 44, borderRadius: 8, marginRight: 0 }]} 
                    onPress={addCustomAlert}
                  >
                    <Text style={{ color: '#000', fontWeight: 'bold' }}>+</Text>
                  </TouchableOpacity>
                </View>

                {alerts.filter(a => !ALERT_OPTIONS.find(o => o.value === a)).length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {alerts.filter(a => !ALERT_OPTIONS.find(o => o.value === a)).map(val => {
                      let label = `${val} min`;
                      if (val % 1440 === 0) label = `${val/1440} dia(s)`;
                      else if (val % 60 === 0) label = `${val/60} hora(s)`;
                      return (
                        <TouchableOpacity
                          key={val}
                          style={[styles.badge, { backgroundColor: colors.surface, borderColor: '#ef4444', borderWidth: 1, marginRight: 8, marginBottom: 8 }]}
                          onPress={() => toggleAlert(val)}
                        >
                          <Text style={{ color: '#ef4444' }}>{label} ✕</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}

            <View style={[styles.row, { marginTop: 30 }]}>
              {initialEvent && (
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#ff4444' }]} onPress={handleDelete}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>Excluir</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'transparent' }]} onPress={onClose}>
                <Text style={{ color: colors.textSecondary, fontWeight: 'bold' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                <Text style={{ color: '#000', fontWeight: 'bold' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: { height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, marginBottom: 15 },
  label: { fontSize: 16, marginBottom: 8, fontWeight: '600' },
  horizontalScroll: { flexDirection: 'row', marginBottom: 15 },
  badge: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, marginRight: 10, marginBottom: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { flex: 1, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginHorizontal: 5 }
});
