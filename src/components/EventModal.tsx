import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch, Platform, KeyboardAvoidingView, Alert } from 'react-native';
import Slider from '@react-native-community/slider';
import { Calendar } from 'react-native-calendars';
import { AppEvent, EventCategory, RecurrenceType, ThemeType } from '../types';
import { getThemeColors, CategoryColors, getContrastTextColor } from '../theme';
import { generateId, getLocalDateString } from '../utils';
import * as Haptics from 'expo-haptics';

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

export const EventModal: React.FC<EventModalProps> = ({ visible, onClose, onSave, onDelete, theme, initialEvent, initialDate, isDateLocked }) => {
  const colors = getThemeColors(theme);
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<EventCategory>('Saúde/Academia');
  const [date, setDate] = useState(initialDate || getLocalDateString());
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
    if (!timeStr || !timeStr.includes(':')) return 480;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
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
        setDate(initialDate || getLocalDateString());
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
    Haptics.selectionAsync();
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const startTimeStr = formatTime(startMinutes);
    const endTimeStr = formatTime(startMinutes + durationMinutes);
    
    const newEvent: AppEvent = {
      id: initialEvent ? initialEvent.id : generateId('evt'),
      title: title.trim(),
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
    if (!initialEvent || !onDelete) return;
    Alert.alert(
      'Excluir Compromisso',
      `Tem certeza que deseja excluir "${initialEvent.title || 'este compromisso'}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              onDelete(initialEvent.id);
            } catch (e) {
              console.warn('Erro ao excluir compromisso:', e);
            }
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', justifyContent: 'flex-end' }}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={(e) => e.stopPropagation?.()}>
            <View style={styles.dragHandle} />
            
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.title, { color: colors.text }]}>
                {initialEvent ? 'Editar Compromisso' : 'Novo Compromisso'}
              </Text>
              
              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                placeholder="Título do compromisso"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={setTitle}
              />

              <Text style={[styles.label, { color: colors.text }]}>Categoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                {CATEGORIES.map(c => {
                  const isSelected = category === c;
                  const catColor = CategoryColors[c] || colors.primary;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.badge,
                        {
                          backgroundColor: isSelected ? catColor : colors.surfaceSubtle,
                          borderColor: isSelected ? catColor : colors.border,
                          borderWidth: 1
                        }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setCategory(c);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: isSelected ? getContrastTextColor(catColor) : colors.text, fontWeight: '700' }}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={styles.row}>
                <View style={{ flex: 1, marginBottom: 14 }}>
                  <Text style={[styles.label, { color: colors.text }]}>Data</Text>
                  {isDateLocked ? (
                    <View style={[styles.input, { backgroundColor: colors.background, opacity: 0.7, paddingVertical: 14 }]}>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{date.split('-').reverse().join('/')} (Bloqueado)</Text>
                    </View>
                  ) : (
                    <View>
                      <TouchableOpacity 
                        style={[styles.input, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.background }]} 
                        onPress={() => {
                          Haptics.selectionAsync();
                          setShowCalendar(!showCalendar);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{date.split('-').reverse().join('/')}</Text>
                        <Text style={{ color: colors.primary, fontWeight: '700' }}>📅 Alterar</Text>
                      </TouchableOpacity>
                      
                      {showCalendar && (
                        <View style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                          <Calendar
                            current={date}
                            onDayPress={(day: any) => {
                              Haptics.selectionAsync();
                              setDate(day.dateString);
                              setShowCalendar(false);
                            }}
                            markedDates={{
                              [date]: { selected: true, selectedColor: colors.primary, selectedTextColor: getContrastTextColor(colors.primary) }
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

              <View style={[styles.sliderCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
                  <Text style={[styles.label, { color: colors.text, marginBottom: 0, marginTop: 0 }]}>Horário de Início</Text>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>
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

              <View style={[styles.sliderCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
                  <Text style={[styles.label, { color: colors.text, marginBottom: 0, marginTop: 0 }]}>Duração do Evento</Text>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>
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
                <Text style={{ color: colors.textSecondary, alignSelf: 'flex-end', fontSize: 12, fontWeight: '600' }}>
                  Término às {formatTime(startMinutes + durationMinutes)}
                </Text>
              </View>

              <Text style={[styles.label, { color: colors.text }]}>Recorrência</Text>
              <View style={styles.row}>
                {[
                  { id: 'none', label: 'Único' },
                  { id: 'daily', label: 'Diário' },
                  { id: 'weekly', label: 'Semanal' },
                  { id: 'monthly', label: 'Mensal' }
                ].map(r => {
                  const isSelected = recurrence === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        styles.badge,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderWidth: 1
                        }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setRecurrence(r.id as RecurrenceType);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: isSelected ? getContrastTextColor(colors.primary) : colors.text, fontWeight: '700' }}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={[styles.switchRow, { borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.text, marginBottom: 0, flex: 1 }]}>Destaque (Evento Importante ⭐)</Text>
                <Switch 
                  value={isImportant} 
                  onValueChange={(val) => {
                    Haptics.selectionAsync();
                    setIsImportant(val);
                  }} 
                  trackColor={{ false: colors.border, true: colors.primary }} 
                  thumbColor={isImportant ? '#fff' : '#f4f3f4'}
                />
              </View>

              <View style={[styles.switchRow, { borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.text, marginBottom: 0, flex: 1 }]}>Ativar Notificações 🔔</Text>
                <Switch 
                  value={isNotified} 
                  onValueChange={(val) => {
                    Haptics.selectionAsync();
                    setIsNotified(val);
                  }} 
                  trackColor={{ false: colors.border, true: colors.primary }} 
                  thumbColor={isNotified ? '#fff' : '#f4f3f4'}
                />
              </View>

              {isNotified && (
                <>
                  <Text style={[styles.label, { color: colors.text, marginTop: 14 }]}>Lembretes Múltiplos</Text>
                  
                  <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 13, fontWeight: '600' }}>Padrões:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.horizontalScroll, { marginBottom: 14 }]}>
                    {ALERT_OPTIONS.map(option => {
                      const isSelected = alerts.includes(option.value);
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[
                            styles.badge,
                            { 
                              backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle, 
                              borderColor: isSelected ? colors.primary : colors.border, 
                              borderWidth: 1 
                            }
                          ]}
                          onPress={() => toggleAlert(option.value)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: isSelected ? getContrastTextColor(colors.primary) : colors.text, fontWeight: '700' }}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={{ color: colors.textSecondary, marginBottom: 8, fontSize: 13, fontWeight: '600' }}>Personalizado:</Text>
                  <View style={[styles.row, { marginBottom: 14, alignItems: 'center' }]}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8, color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                      placeholder="Ex: 5"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={customAlertVal}
                      onChangeText={setCustomAlertVal}
                    />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginRight: 8 }}>
                      <TouchableOpacity 
                        style={[styles.badge, { backgroundColor: customAlertUnit === 1 ? colors.primary : colors.surfaceSubtle, borderWidth: 1, borderColor: customAlertUnit === 1 ? colors.primary : colors.border }]}
                        onPress={() => setCustomAlertUnit(1)}
                      >
                        <Text style={{ color: customAlertUnit === 1 ? getContrastTextColor(colors.primary) : colors.text, fontWeight: '700' }}>Min</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.badge, { backgroundColor: customAlertUnit === 60 ? colors.primary : colors.surfaceSubtle, borderWidth: 1, borderColor: customAlertUnit === 60 ? colors.primary : colors.border }]}
                        onPress={() => setCustomAlertUnit(60)}
                      >
                        <Text style={{ color: customAlertUnit === 60 ? getContrastTextColor(colors.primary) : colors.text, fontWeight: '700' }}>Hora</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.badge, { backgroundColor: customAlertUnit === 1440 ? colors.primary : colors.surfaceSubtle, borderWidth: 1, borderColor: customAlertUnit === 1440 ? colors.primary : colors.border }]}
                        onPress={() => setCustomAlertUnit(1440)}
                      >
                        <Text style={{ color: customAlertUnit === 1440 ? getContrastTextColor(colors.primary) : colors.text, fontWeight: '700' }}>Dia</Text>
                      </TouchableOpacity>
                    </ScrollView>
                    <TouchableOpacity 
                      style={[styles.badge, { backgroundColor: colors.primary, justifyContent: 'center', height: 44, borderRadius: 12, marginRight: 0 }]} 
                      onPress={addCustomAlert}
                    >
                      <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '800', fontSize: 16 }}>+</Text>
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
                            style={[styles.badge, { backgroundColor: colors.dangerLight, borderColor: colors.danger, borderWidth: 1, marginRight: 8, marginBottom: 8 }]}
                            onPress={() => toggleAlert(val)}
                          >
                            <Text style={{ color: theme === 'light' ? colors.dangerDark : colors.danger, fontWeight: '700' }}>{label} ✕</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              <View style={[styles.row, { marginTop: 24, gap: 8 }]}>
                {initialEvent && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger, borderWidth: 1 }]}
                    onPress={handleDelete}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: theme === 'light' ? colors.dangerDark : colors.danger, fontWeight: '800' }}>Excluir</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '800' }}>Salvar</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 30 }} />
            </ScrollView>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, maxHeight: '90%' },
  dragHandle: { width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(150,150,150,0.4)', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 18, letterSpacing: -0.5 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, marginBottom: 14, fontSize: 15 },
  label: { fontSize: 14, marginBottom: 8, fontWeight: '700', marginTop: 8 },
  horizontalScroll: { flexDirection: 'row', marginBottom: 14 },
  badge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, marginBottom: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderCard: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  actionBtn: { flex: 1, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }
});
