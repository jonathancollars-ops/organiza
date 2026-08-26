import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Subject,
  CourseProgressData,
  CourseSemester,
  CourseHistorySubject,
  CRSimulationScenario
} from '../types';
import { generateId } from '../utils';
import { calculateFinalGrade } from '../components/GradeEngine';

const COURSE_PROGRESS_STORAGE_KEY = '@lumen_course_progress';

export const DEFAULT_CURRICULUM_TEMPLATE: CourseProgressData = {
  courseName: 'Graduação',
  targetCR: 8.5,
  baselineCR: 8.0,
  totalRequiredCredits: 200,
  completedCredits: 80,
  totalRequiredHours: 3200,
  completedHours: 1280,
  semesters: [
    {
      semesterNumber: 1,
      title: '1º Semestre',
      subjects: [
        { id: 'sub_1_1', name: 'Cálculo Diferencial e Integral I', code: 'MAT101', credits: 5, hours: 80, isCompleted: true, grade: 8.5 },
        { id: 'sub_1_2', name: 'Geometria Analítica e Álgebra Linear', code: 'MAT102', credits: 4, hours: 60, isCompleted: true, grade: 7.8 },
        { id: 'sub_1_3', name: 'Introdução à Programação', code: 'CC101', credits: 4, hours: 60, isCompleted: true, grade: 9.0 },
        { id: 'sub_1_4', name: 'Física Geral I', code: 'FIS101', credits: 4, hours: 60, isCompleted: true, grade: 7.2 },
        { id: 'sub_1_5', name: 'Metodologia Científica', code: 'HUM101', credits: 2, hours: 30, isCompleted: true, grade: 9.5 }
      ]
    },
    {
      semesterNumber: 2,
      title: '2º Semestre',
      subjects: [
        { id: 'sub_2_1', name: 'Cálculo Diferencial e Integral II', code: 'MAT201', credits: 5, hours: 80, isCompleted: true, grade: 8.0 },
        { id: 'sub_2_2', name: 'Estruturas de Dados', code: 'CC201', credits: 4, hours: 60, isCompleted: true, grade: 8.7 },
        { id: 'sub_2_3', name: 'Física Geral II', code: 'FIS201', credits: 4, hours: 60, isCompleted: true, grade: 7.5 },
        { id: 'sub_2_4', name: 'Circuitos Digitais', code: 'ENG201', credits: 4, hours: 60, isCompleted: true, grade: 8.2 }
      ]
    },
    {
      semesterNumber: 3,
      title: '3º Semestre',
      subjects: [
        { id: 'sub_3_1', name: 'Cálculo III', code: 'MAT301', credits: 4, hours: 60, isCompleted: true, grade: 7.9 },
        { id: 'sub_3_2', name: 'Algoritmos Avançados', code: 'CC301', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_3_3', name: 'Eletromagnetismo', code: 'FIS301', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_3_4', name: 'Probabilidade e Estatística', code: 'EST301', credits: 4, hours: 60, isCompleted: false }
      ]
    },
    {
      semesterNumber: 4,
      title: '4º Semestre',
      subjects: [
        { id: 'sub_4_1', name: 'Sistemas Operacionais', code: 'CC401', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_4_2', name: 'Bancos de Dados', code: 'CC402', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_4_3', name: 'Redes de Computadores', code: 'CC403', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_4_4', name: 'Engenharia de Software', code: 'CC404', credits: 4, hours: 60, isCompleted: false }
      ]
    },
    {
      semesterNumber: 5,
      title: '5º Semestre',
      subjects: [
        { id: 'sub_5_1', name: 'Inteligência Artificial', code: 'CC501', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_5_2', name: 'Compiladores', code: 'CC502', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_5_3', name: 'Sistemas Distribuídos', code: 'CC503', credits: 4, hours: 60, isCompleted: false }
      ]
    },
    {
      semesterNumber: 6,
      title: '6º Semestre',
      subjects: [
        { id: 'sub_6_1', name: 'Segurança da Informação', code: 'CC601', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_6_2', name: 'Computação Gráfica', code: 'CC602', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_6_3', name: 'Otimização e Pesquisa Operacional', code: 'MAT601', credits: 4, hours: 60, isCompleted: false }
      ]
    },
    {
      semesterNumber: 7,
      title: '7º Semestre',
      subjects: [
        { id: 'sub_7_1', name: 'Trabalho de Conclusão de Curso I', code: 'TCC701', credits: 3, hours: 45, isCompleted: false },
        { id: 'sub_7_2', name: 'Estágio Supervisionado', code: 'EST701', credits: 6, hours: 120, isCompleted: false },
        { id: 'sub_7_3', name: 'Tópicos Especiais I', code: 'TOP701', credits: 4, hours: 60, isCompleted: false }
      ]
    },
    {
      semesterNumber: 8,
      title: '8º Semestre',
      subjects: [
        { id: 'sub_8_1', name: 'Trabalho de Conclusão de Curso II', code: 'TCC801', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_8_2', name: 'Empreendedorismo e Inovação', code: 'ADM801', credits: 2, hours: 30, isCompleted: false },
        { id: 'sub_8_3', name: 'Ética e Cidadania', code: 'HUM801', credits: 2, hours: 30, isCompleted: false }
      ]
    }
  ]
};

export class CourseCRService {
  /**
   * Calculates the weighted cumulative Grade Point Average (CR / GPA) from completed subjects.
   * Formula: CR = Sum(Grade * Credits) / Sum(Credits)
   */
  static calculateHistoricalCR(data: CourseProgressData): number {
    let totalWeightedScore = 0;
    let totalCredits = 0;

    data.semesters.forEach(sem => {
      sem.subjects.forEach(sub => {
        if (sub.isCompleted && typeof sub.grade === 'number' && !isNaN(sub.grade)) {
          const credits = sub.credits > 0 ? sub.credits : 1;
          totalWeightedScore += sub.grade * credits;
          totalCredits += credits;
        }
      });
    });

    if (totalCredits === 0) {
      return data.baselineCR || 0;
    }

    const calculated = totalWeightedScore / totalCredits;
    return Number(calculated.toFixed(2));
  }

  /**
   * Calculates degree completion progress metrics (Credits and % Completion).
   */
  static calculateDegreeProgress(data: CourseProgressData): {
    completedCredits: number;
    totalRequiredCredits: number;
    completionPercentage: number;
    completedSubjectsCount: number;
    totalSubjectsCount: number;
  } {
    let completedCredits = 0;
    let totalCredits = 0;
    let completedSubjectsCount = 0;
    let totalSubjectsCount = 0;

    data.semesters.forEach(sem => {
      sem.subjects.forEach(sub => {
        const credits = sub.credits > 0 ? sub.credits : (sub.hours ? Math.round(sub.hours / 15) : 4);
        totalCredits += credits;
        totalSubjectsCount++;

        if (sub.isCompleted) {
          completedCredits += credits;
          completedSubjectsCount++;
        }
      });
    });

    const targetTotalCredits = data.totalRequiredCredits > 0 ? data.totalRequiredCredits : Math.max(totalCredits, 1);
    const effectiveCompleted = totalSubjectsCount > 0 ? completedCredits : Math.max(completedCredits, data.completedCredits || 0);
    const percentage = Math.min((effectiveCompleted / targetTotalCredits) * 100, 100.0);

    return {
      completedCredits: effectiveCompleted,
      totalRequiredCredits: targetTotalCredits,
      completionPercentage: Number(percentage.toFixed(1)),
      completedSubjectsCount,
      totalSubjectsCount
    };
  }

  /**
   * Simulates dynamic CR scenarios based on current semester active subjects.
   */
  static simulateCRScenarios(
    courseData: CourseProgressData,
    currentSemesterSubjects: Subject[]
  ): {
    currentCR: number;
    scenarios: CRSimulationScenario[];
  } {
    const historicalCR = this.calculateHistoricalCR(courseData);

    let pastCredits = 0;
    let pastWeightedSum = 0;

    courseData.semesters.forEach(sem => {
      sem.subjects.forEach(sub => {
        if (sub.isCompleted && typeof sub.grade === 'number' && !isNaN(sub.grade)) {
          const credits = sub.credits > 0 ? sub.credits : 4;
          pastWeightedSum += sub.grade * credits;
          pastCredits += credits;
        }
      });
    });

    if (pastCredits === 0) {
      pastCredits = courseData.completedCredits || 40;
      pastWeightedSum = historicalCR * pastCredits;
    }

    // Evaluate current semester subjects
    let currentSemesterCredits = 0;
    let currentSemesterWorstSum = 0; // If future exams get 0
    let currentSemesterBestSum = 0; // If future exams get 10
    let currentSemesterEstimatedSum = 0;

    currentSemesterSubjects.forEach(sub => {
      const credits = sub.workloadHours ? Math.round(sub.workloadHours / 20) : 4;
      currentSemesterCredits += credits;

      if (sub.gradeGroups && sub.gradeGroups.length > 0) {
        const calc = calculateFinalGrade(sub.gradeGroups, sub.passGrade || 7.0);
        const currentScore = calc.score; // current average on graded items
        
        currentSemesterEstimatedSum += currentScore * credits;
        currentSemesterWorstSum += (calc.hasMissingItems ? currentScore * 0.7 : currentScore) * credits;
        currentSemesterBestSum += 10.0 * credits;
      } else {
        // No grades entered yet
        currentSemesterEstimatedSum += (sub.passGrade || 7.0) * credits;
        currentSemesterWorstSum += 0 * credits;
        currentSemesterBestSum += 10.0 * credits;
      }
    });

    const totalCreditsAll = pastCredits + Math.max(currentSemesterCredits, 1);
    
    // Scenario 1: Current Estimated CR
    const currentEstimatedCR = Number(((pastWeightedSum + currentSemesterEstimatedSum) / totalCreditsAll).toFixed(2));
    
    // Scenario 2: Worst Case (Pior Caso / Parar Agora com notas zeradas)
    const worstCaseCR = Number(((pastWeightedSum + currentSemesterWorstSum) / totalCreditsAll).toFixed(2));
    
    // Scenario 3: Best Case (Tirar 10 em tudo)
    const bestCaseCR = Number(((pastWeightedSum + currentSemesterBestSum) / totalCreditsAll).toFixed(2));

    // Scenario 4: Target CR Required Average
    const targetCR = courseData.targetCR || 8.5;
    const requiredTotalSum = targetCR * totalCreditsAll;
    const neededInCurrent = (requiredTotalSum - pastWeightedSum) / Math.max(currentSemesterCredits, 1);
    const neededFormatted = Math.min(Math.max(neededInCurrent, 0), 10).toFixed(2);

    const scenarios: CRSimulationScenario[] = [
      {
        title: '📊 Projeção Atual no Semestre',
        projectedCR: currentEstimatedCR,
        difference: Number((currentEstimatedCR - historicalCR).toFixed(2)),
        description: `Mantendo o ritmo atual nas ${currentSemesterSubjects.length} disciplinas vigentes.`,
        type: 'current',
        badgeColor: '#3B82F6'
      },
      {
        title: '🛑 Pior Caso (Parar Hoje / Nota Zero)',
        projectedCR: worstCaseCR,
        difference: Number((worstCaseCR - historicalCR).toFixed(2)),
        description: 'Se você não realizar mais nenhuma avaliação e tirar zero nas provas restantes.',
        type: 'worst_case',
        badgeColor: '#EF4444'
      },
      {
        title: `🎯 Meta Desejada (CR ${targetCR})`,
        projectedCR: targetCR,
        difference: Number((targetCR - historicalCR).toFixed(2)),
        description: neededInCurrent > 10 
          ? `Alvo matematicamente inalcançável neste semestre (exigiria média ${neededFormatted}).`
          : `Você precisa de média ponderada de no mínimo ${neededFormatted} nas matérias deste semestre.`,
        type: 'target',
        badgeColor: '#10B981'
      },
      {
        title: '🚀 Melhor Caso (Nota 10 em tudo)',
        projectedCR: bestCaseCR,
        difference: Number((bestCaseCR - historicalCR).toFixed(2)),
        description: 'Se gabaritar todas as provas e trabalhos pendentes até o final do semestre.',
        type: 'best_case',
        badgeColor: '#8B5CF6'
      }
    ];

    return {
      currentCR: historicalCR,
      scenarios
    };
  }

  /**
   * Toggles completion status of a subject in the curriculum matrix.
   */
  static toggleSubjectCompletion(data: CourseProgressData, subjectId: string): CourseProgressData {
    const updatedSemesters = data.semesters.map(sem => {
      const updatedSubjects = sem.subjects.map(sub => {
        if (sub.id === subjectId) {
          return { ...sub, isCompleted: !sub.isCompleted };
        }
        return sub;
      });
      return { ...sem, subjects: updatedSubjects };
    });

    const progress = this.calculateDegreeProgress({ ...data, semesters: updatedSemesters });

    return {
      ...data,
      semesters: updatedSemesters,
      completedCredits: progress.completedCredits,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Adds a new subject to a specific semester in the curriculum matrix.
   */
  static addSubjectToSemester(
    data: CourseProgressData,
    semesterNumber: number,
    subject: { name: string; credits: number; hours?: number; code?: string; isCompleted?: boolean }
  ): CourseProgressData {
    const newSubject: CourseHistorySubject = {
      id: generateId(),
      name: subject.name.trim(),
      code: subject.code?.trim(),
      credits: subject.credits > 0 ? subject.credits : 4,
      hours: subject.hours || subject.credits * 15,
      isCompleted: !!subject.isCompleted
    };

    let semesterFound = false;
    const updatedSemesters = data.semesters.map(sem => {
      if (sem.semesterNumber === semesterNumber) {
        semesterFound = true;
        return { ...sem, subjects: [...sem.subjects, newSubject] };
      }
      return sem;
    });

    if (!semesterFound) {
      updatedSemesters.push({
        semesterNumber,
        title: `${semesterNumber}º Semestre`,
        subjects: [newSubject]
      });
      updatedSemesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
    }

    const progress = this.calculateDegreeProgress({ ...data, semesters: updatedSemesters });

    return {
      ...data,
      semesters: updatedSemesters,
      completedCredits: progress.completedCredits,
      totalRequiredCredits: progress.totalRequiredCredits,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Calculates the minimum grade required in the Final Exam (Prova Final) for approval.
   * Standard Brazilian university formula: Final = (PassGrade * 2) - CurrentAverage
   * or weighted (Average * 6 + Final * 4) / 10 >= PassGrade => Final = (PassGrade * 10 - Average * 6) / 4
   */
  static calculateFinalExamRequirement(
    currentAverage: number,
    passGrade: number = 7.0,
    finalPassThreshold: number = 5.0
  ): {
    status: 'approved' | 'final_exam' | 'reproved';
    neededGrade: number;
    message: string;
    badgeColor: string;
  } {
    if (currentAverage >= passGrade) {
      return {
        status: 'approved',
        neededGrade: 0,
        message: 'Aprovado direto! Você já atingiu a média necessária.',
        badgeColor: '#10B981'
      };
    }

    // Formula: (CurrentAvg * 6 + Final * 4) / 10 >= finalPassThreshold (usually 5.0)
    // => Final = (finalPassThreshold * 10 - CurrentAvg * 6) / 4
    const needed = (finalPassThreshold * 10 - currentAverage * 6) / 4;
    const roundedNeeded = Math.max(0, Number(needed.toFixed(2)));

    if (roundedNeeded > 10.0) {
      return {
        status: 'reproved',
        neededGrade: roundedNeeded,
        message: `Reprovado direto. Média necessária (${roundedNeeded.toFixed(1)}) excede 10.0.`,
        badgeColor: '#EF4444'
      };
    }

    return {
      status: 'final_exam',
      neededGrade: roundedNeeded,
      message: `Você precisa de nota ${roundedNeeded.toFixed(1)} na Prova Final para ser aprovado.`,
      badgeColor: '#F59E0B'
    };
  }

  /**
   * Parses raw historical text or transcripts into structured CourseProgressData.
   */
  static parseHistoryText(rawText: string, existingData?: CourseProgressData): CourseProgressData {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsedSubjects: CourseHistorySubject[] = [];

    // Check if there is an explicit CR stated in the text (e.g. "CR Acumulado: 8.42" or "GPA: 3.8")
    let extractedCR: number | undefined = undefined;
    const crMatch = rawText.match(/(?:cr|ira|coeficiente|media\s*geral|gpa|indice)[\s:=]+(\d{1,2}[.,]\d{1,2})/i);
    if (crMatch) {
      extractedCR = parseFloat(crMatch[1].replace(',', '.'));
    }

    // Parse subjects line by line
    lines.forEach(line => {
      // Look for patterns like: "Cálculo I - 80h - Aprovado" or "MAT101 Cálculo 1 4 cr 8.5"
      const gradeMatch = line.match(/\b(10|\d[.,]\d|\d)\b/);
      const hoursMatch = line.match(/(\d+)\s*(h|horas|ch|cr|créditos)/i);
      
      const isApproved = /aprovado|aprovada|concluído|concluída|dispensado|isento|aprov/i.test(line);
      const isReproved = /reprovado|reprovada|trancado|cancelado|reprov/i.test(line);

      const cleanName = line
        .replace(/MAT\d+|FIS\d+|CC\d+|ENG\d+|[A-Z]{2,4}\d{3,4}/g, '')
        .replace(/\b\d+\s*(h|horas|ch|cr|créditos)\b/gi, '')
        .replace(/aprovado|aprovada|concluído|concluída|reprovado|reprovada|trancado|isento/gi, '')
        .replace(/[0-9.,]+/g, '')
        .replace(/[-|–:()]/g, '')
        .trim();

      if (cleanName.length > 3) {
        let credits = 4;
        const crUnitMatch = line.match(/(\d+)\s*(?:cr|créditos|cred|crédito)\b/i);
        const hoursUnitMatch = line.match(/(\d+)\s*(?:h|horas|ch)\b/i);
        if (crUnitMatch) {
          credits = Math.max(parseInt(crUnitMatch[1], 10), 1);
        } else if (hoursUnitMatch) {
          credits = Math.max(Math.round(parseInt(hoursUnitMatch[1], 10) / 15), 1);
        }

        const grade = gradeMatch ? parseFloat(gradeMatch[1].replace(',', '.')) : undefined;

        parsedSubjects.push({
          id: generateId(),
          name: cleanName,
          credits,
          grade: !isNaN(grade as any) ? grade : undefined,
          isCompleted: isApproved || (!isReproved && typeof grade === 'number' && grade >= 5.0)
        });
      }
    });

    const base = existingData || DEFAULT_CURRICULUM_TEMPLATE;
    if (parsedSubjects.length === 0 && !extractedCR) return base;

    // Distribute into semesters or update existing subjects with matching names
    const updatedSemesters = [...base.semesters];
    if (parsedSubjects.length > 0) {
      if (updatedSemesters.length > 0) {
        updatedSemesters[0] = {
          ...updatedSemesters[0],
          subjects: [...updatedSemesters[0].subjects, ...parsedSubjects]
        };
      }
    }

    const progress = this.calculateDegreeProgress({ ...base, semesters: updatedSemesters });
    return {
      ...base,
      baselineCR: typeof extractedCR === 'number' ? extractedCR : base.baselineCR,
      semesters: updatedSemesters,
      completedCredits: progress.completedCredits,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Parses a full Curriculum Flowchart (Fluxograma / Matriz Curricular) organized by semesters.
   */
  static parseCurriculumMatrixText(rawText: string, existingData?: CourseProgressData): CourseProgressData {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsedSemesters: CourseSemester[] = [];
    let currentSemesterNumber = 1;
    let currentSubjects: CourseHistorySubject[] = [];

    lines.forEach(line => {
      // Check if line represents a Semester Header (e.g. "1º Semestre", "Semestre 2", "3º Período", "Fase 4", "Modulo 5")
      const semesterHeaderMatch = line.match(/(?:(\d+)[ºª°]?\s*(?:semestre|periodo|período|fase|modulo|módulo|etapa)|(?:semestre|periodo|período|fase|modulo|módulo|etapa)\s*(\d+))/i);

      if (semesterHeaderMatch) {
        if (currentSubjects.length > 0) {
          parsedSemesters.push({
            semesterNumber: currentSemesterNumber,
            title: `${currentSemesterNumber}º Semestre`,
            subjects: currentSubjects
          });
          currentSubjects = [];
        }
        const parsedNum = parseInt(semesterHeaderMatch[1] || semesterHeaderMatch[2], 10);
        currentSemesterNumber = !isNaN(parsedNum) && parsedNum > 0 ? parsedNum : currentSemesterNumber + 1;
        return;
      }

      // Check for subject line
      const isApproved = /aprovado|aprovada|concluído|concluída|feito|feita|dispensado|isento|aprov/i.test(line);

      const cleanName = line
        .replace(/MAT\d+|FIS\d+|CC\d+|ENG\d+|[A-Z]{2,4}\d{3,4}/g, '')
        .replace(/\b\d+\s*(h|horas|ch|cr|créditos)\b/gi, '')
        .replace(/aprovado|aprovada|concluído|concluída|reprovado|reprovada|trancado|isento/gi, '')
        .replace(/[0-9.,]+/g, '')
        .replace(/[-|–:()]/g, '')
        .trim();

      if (cleanName.length >= 3) {
        let credits = 4;
        const crUnitMatch = line.match(/(\d+)\s*(?:cr|créditos|cred|crédito)\b/i);
        const hoursUnitMatch = line.match(/(\d+)\s*(?:h|horas|ch)\b/i);
        if (crUnitMatch) {
          credits = Math.max(parseInt(crUnitMatch[1], 10), 1);
        } else if (hoursUnitMatch) {
          credits = Math.max(Math.round(parseInt(hoursUnitMatch[1], 10) / 15), 1);
        }

        currentSubjects.push({
          id: generateId(),
          name: cleanName,
          credits,
          hours: credits * 15,
          isCompleted: isApproved
        });
      }
    });

    if (currentSubjects.length > 0) {
      parsedSemesters.push({
        semesterNumber: currentSemesterNumber,
        title: `${currentSemesterNumber}º Semestre`,
        subjects: currentSubjects
      });
    }

    const base = existingData || DEFAULT_CURRICULUM_TEMPLATE;
    if (parsedSemesters.length === 0) return base;

    // Sort semesters by number
    parsedSemesters.sort((a, b) => a.semesterNumber - b.semesterNumber);

    const progress = this.calculateDegreeProgress({ ...base, semesters: parsedSemesters });
    return {
      ...base,
      semesters: parsedSemesters,
      completedCredits: progress.completedCredits,
      totalRequiredCredits: progress.totalRequiredCredits,
      lastUpdated: new Date().toISOString()
    };
  }

  // Persistence helpers
  static async loadCourseProgress(): Promise<CourseProgressData> {
    try {
      const stored = await AsyncStorage.getItem(COURSE_PROGRESS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Erro ao carregar progresso do curso:', e);
    }
    return DEFAULT_CURRICULUM_TEMPLATE;
  }

  static async saveCourseProgress(data: CourseProgressData): Promise<void> {
    try {
      await AsyncStorage.setItem(COURSE_PROGRESS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar progresso do curso:', e);
    }
  }
}
