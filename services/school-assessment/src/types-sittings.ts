export type AttemptStatus = 'in_progress' | 'submitted';

export interface ExamSitting {
  id: string;
  tenantId: string;
  examId: string;
  roomLabel: string;
  startsOn: string;
  endsOn: string;
  invigilatorMemberRef: string | null;
  createdAt: string;
}

export interface SeatAssignment {
  id: string;
  tenantId: string;
  sittingId: string;
  studentId: string;
  seatCode: string;
}

export interface HallTicket {
  id: string;
  tenantId: string;
  examId: string;
  studentId: string;
  sittingId: string;
  ticketCode: string;
  issuedAt: string;
}

export interface ExamAttempt {
  id: string;
  tenantId: string;
  sittingId: string;
  studentId: string;
  paperId: string;
  startedAt: string;
  submittedAt: string | null;
  answers: Record<string, unknown>;
  status: AttemptStatus;
}

export interface CreateSittingInput {
  roomLabel: string;
  startsOn: string;
  endsOn: string;
  invigilatorMemberRef?: string | null;
  studentIds: string[];
}

export interface HallTicketPrintView {
  ticketCode: string;
  studentId: string;
  examId: string;
  examDate: string | null;
  roomLabel: string;
  seatCode: string | null;
  startsOn: string;
  endsOn: string;
  subjectCode: string | null;
  classLabel: string | null;
}
