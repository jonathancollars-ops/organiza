import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { ThemeType } from '../types';
import { getThemeColors } from '../theme';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: 'aula' | 'prova' | 'outro') => void;
  theme: ThemeType;
}

export const EventTypeModal: React.FC<Props> = ({ visible, onClose, onSelect, theme }) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const handleSelect = (type: 'aula' | 'prova' | 'outro') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSelect(type);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.modalContainer} onPress={(e) => e.stopPropagation?.()}>
          <View style={styles.dragHandle} />

          <View style={styles.header}>
            <Text style={styles.title}>O que deseja adicionar?</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtnContainer}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.optionBtn} onPress={() => handleSelect('aula')} activeOpacity={0.7}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Text style={styles.optionIcon}>📚</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Aula / Matéria</Text>
              <Text style={styles.optionSubtitle}>Adicione sua grade de horários semanais</Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 18, fontWeight: '700' }}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionBtn} onPress={() => handleSelect('prova')} activeOpacity={0.7}>
            <View style={[styles.iconCircle, { backgroundColor: colors.dangerLight }]}>
              <Text style={styles.optionIcon}>📝</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Prova / Trabalho</Text>
              <Text style={styles.optionSubtitle}>Avaliações vinculadas a uma matéria</Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 18, fontWeight: '700' }}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionBtn} onPress={() => handleSelect('outro')} activeOpacity={0.7}>
            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={styles.optionIcon}>📌</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Outra Atividade</Text>
              <Text style={styles.optionSubtitle}>Treino, Médico, Lazer, Reuniões...</Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 18, fontWeight: '700' }}>›</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5
  },
  closeBtnContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceSubtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionIcon: {
    fontSize: 22,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 3,
  },
  optionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  }
});

