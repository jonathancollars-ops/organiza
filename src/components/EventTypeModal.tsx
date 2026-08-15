import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { ThemeType } from '../types';
import { getThemeColors } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (type: 'aula' | 'prova' | 'outro') => void;
  theme: ThemeType;
}

export const EventTypeModal: React.FC<Props> = ({ visible, onClose, onSelect, theme }) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>O que deseja adicionar?</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.optionBtn} onPress={() => onSelect('aula')}>
            <Text style={styles.optionIcon}>📚</Text>
            <View>
              <Text style={styles.optionTitle}>Aula / Matéria</Text>
              <Text style={styles.optionSubtitle}>Adicione sua grade de horários semanais</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionBtn} onPress={() => onSelect('prova')}>
            <Text style={styles.optionIcon}>📝</Text>
            <View>
              <Text style={styles.optionTitle}>Prova / Trabalho</Text>
              <Text style={styles.optionSubtitle}>Avaliações vinculadas a uma matéria</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionBtn} onPress={() => onSelect('outro')}>
            <Text style={styles.optionIcon}>📌</Text>
            <View>
              <Text style={styles.optionTitle}>Outra Atividade</Text>
              <Text style={styles.optionSubtitle}>Treino, Médico, Lazer, Reuniões...</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeBtn: {
    fontSize: 24,
    color: colors.textSecondary,
    padding: 5,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: {
    fontSize: 28,
    marginRight: 15,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  }
});
