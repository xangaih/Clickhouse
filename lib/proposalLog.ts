// In-memory log of every agent-generated proposal and what happened to it
// (confirmed/dismissed). Resets on server restart — this is demo visibility for the
// human-in-the-loop pattern, not an audit trail; nothing here is a source of truth.
export interface ProposalLogEntry {
  at: string;
  studentId: number;
  proposalType: string;
  detail: string;
  outcome: 'proposed' | 'confirmed' | 'dismissed';
}

const log: ProposalLogEntry[] = [];

export function recordProposalEvent(entry: Omit<ProposalLogEntry, 'at'>) {
  const full: ProposalLogEntry = { at: new Date().toISOString(), ...entry };
  log.push(full);
  console.log(`[proposal:${full.outcome}]`, full);
  console.table(log.slice(-10));
  return full;
}

export function getProposalLog() {
  return log;
}
