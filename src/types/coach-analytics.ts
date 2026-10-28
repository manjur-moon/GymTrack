
export type CoachOverviewMetrics = {
  activeClients: number;
  pendingInvitations: number;
  activeAssignments: number;
  completedAssignedSessionsLast7Days: number;
  scheduledDueThisWeek: number;
  scheduledCompletedThisWeek: number;
  adherencePercent: number | null;
  overdueScheduledSessions: number;
};

export type ClientAttentionItem = {
  clientId: string;
  clientName: string;
  overdueScheduledSessions: number;
  lastCompletedWorkoutAt: string | null;
};

export type CoachWeeklyActivity = {
  date: string;
  completedSessions: number;
  scheduledSessions: number;
};

export type CoachOverviewData = {
  metrics: CoachOverviewMetrics;
  attentionClients: ClientAttentionItem[];
  weeklyActivity: CoachWeeklyActivity[];
};
