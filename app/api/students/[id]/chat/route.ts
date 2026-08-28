import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import {
  getDailyAccuracy,
  getAssignmentHistory,
  getRecentSessions,
  getSessionEvents,
  getBookCandidates,
  getClassDailyAverage,
  getEngagementPattern,
} from '@/lib/queries';
import { chatWithTools, type ToolDefinition } from '@/lib/agent';
import { studentToEmbedding } from '@/lib/embeddings';
import { recordProposalEvent } from '@/lib/proposalLog';
import type { ChatMessage, Proposal } from '@/lib/types';

// Multi-round tool use (up to 6 sequential Anthropic calls, see lib/agent.ts) can
// take longer than a serverless platform's default function timeout. Request the
// longest duration the deployment's plan allows rather than silently truncating
// mid-stream on a slow multi-tool-call turn.
export const maxDuration = 60;

const NOTE_MAX_LENGTH = 500;

const TOOLS: ToolDefinition[] = [
  {
    name: 'get_accuracy_trend',
    description: "This student's full daily reading-accuracy history for the last several weeks.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_reading_history',
    description:
      "This student's book assignment history — which books they've been assigned and when, with each book's reading level and topic tags.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_sessions',
    description:
      "A summary of this student's most recent reading sessions — one row per session with its date, word count, and accuracy. Use this to find a session_id before calling get_session_detail.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many recent sessions to return. Defaults to 5.' },
      },
    },
  },
  {
    name: 'get_session_detail',
    description:
      "The word-by-word breakdown (correct/incorrect, hesitation time per word) for ONE specific reading session. Requires a session_id — get one from get_recent_sessions first.",
    input_schema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'The session_id to inspect, from get_recent_sessions.' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'get_book_recommendations',
    description:
      "The top 3 candidate books currently recommended for this student, matched by reading level and interests, each with a similarity distance score (lower is a better match).",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_class_context',
    description: "The whole class's daily average reading accuracy, to compare this student against their peers.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_engagement_pattern',
    description:
      "How often this student has actually been reading — every session date and the gap in days since their previous session. Use this for questions about whether they're still reading regularly, separate from whether their accuracy is good — a student can be accurate but reading less often, or vice versa.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'propose_intervention',
    description:
      "Draft a suggestion to pair this student with a specific book and log an intervention. Does NOT write anything — surfaces a confirm/dismiss card in the UI. bookId must be a real book from get_book_recommendations.",
    input_schema: {
      type: 'object',
      properties: {
        bookId: { type: 'number', description: 'The book to pair the student with, from get_book_recommendations.' },
        note: { type: 'string', description: 'A short note on why (e.g. what the intervention entails).' },
      },
      required: ['bookId', 'note'],
    },
  },
  {
    name: 'propose_book_reassignment',
    description:
      "Draft a suggestion to change this student's current book assignment to a different book. Does NOT write anything — surfaces a confirm/dismiss card in the UI. newBookId must be a real book from get_book_recommendations.",
    input_schema: {
      type: 'object',
      properties: {
        newBookId: { type: 'number', description: 'The book to reassign the student to, from get_book_recommendations.' },
        reason: { type: 'string', description: 'A short reason for the reassignment.' },
      },
      required: ['newBookId', 'reason'],
    },
  },
  {
    name: 'propose_followup_flag',
    description:
      "Draft a suggestion to flag this student for a human (teacher) to personally check in on — for situations a book swap won't fix on its own. Does NOT write anything — surfaces a confirm/dismiss card in the UI.",
    input_schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'A short reason for the follow-up flag.' },
      },
      required: ['reason'],
    },
  },
];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const studentId = Number(params.id);
  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  const [student] = await sql`
    SELECT name, reading_level_start, interests FROM students WHERE id = ${studentId}
  `;
  if (!student) {
    return new Response(JSON.stringify({ type: 'error', message: 'Student not found' }) + '\n', {
      status: 404,
      headers: { 'Content-Type': 'application/x-ndjson' },
    });
  }

  async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'get_accuracy_trend':
        return getDailyAccuracy(studentId);
      case 'get_reading_history':
        return getAssignmentHistory(studentId);
      case 'get_recent_sessions': {
        const limit = typeof input.limit === 'number' ? input.limit : 5;
        return getRecentSessions(studentId, limit);
      }
      case 'get_session_detail':
        return getSessionEvents(String(input.session_id));
      case 'get_book_recommendations': {
        const embedding = studentToEmbedding(student.interests);
        return getBookCandidates(embedding, student.reading_level_start - 0.5, student.reading_level_start + 0.5);
      }
      case 'get_class_context':
        return getClassDailyAverage();
      case 'get_engagement_pattern':
        return getEngagementPattern(studentId);
      case 'propose_intervention': {
        const bookId = Number(input.bookId);
        const note = String(input.note ?? '').slice(0, NOTE_MAX_LENGTH);
        const [book] = await sql`SELECT title FROM books WHERE id = ${bookId}`;
        const proposal: Proposal = { type: 'intervention', studentId, bookId, bookTitle: book?.title ?? null, note };
        recordProposalEvent({
          studentId,
          proposalType: 'intervention',
          detail: `book=${bookId} (${book?.title ?? 'unknown'}) note="${note}"`,
          outcome: 'proposed',
        });
        return proposal;
      }
      case 'propose_book_reassignment': {
        const newBookId = Number(input.newBookId);
        const reason = String(input.reason ?? '').slice(0, NOTE_MAX_LENGTH);
        const [book] = await sql`SELECT title FROM books WHERE id = ${newBookId}`;
        const proposal: Proposal = {
          type: 'reassignment',
          studentId,
          newBookId,
          bookTitle: book?.title ?? null,
          reason,
        };
        recordProposalEvent({
          studentId,
          proposalType: 'reassignment',
          detail: `newBook=${newBookId} (${book?.title ?? 'unknown'}) reason="${reason}"`,
          outcome: 'proposed',
        });
        return proposal;
      }
      case 'propose_followup_flag': {
        const reason = String(input.reason ?? '').slice(0, NOTE_MAX_LENGTH);
        const proposal: Proposal = { type: 'followup', studentId, reason };
        recordProposalEvent({ studentId, proposalType: 'followup', detail: `reason="${reason}"`, outcome: 'proposed' });
        return proposal;
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: unknown) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      try {
        const { reply, proposals } = await chatWithTools(student.name, TOOLS, messages, executeTool, (toolName, input) => {
          send({ type: 'tool_call', name: toolName, input });
        });
        send({ type: 'final', reply, proposals });
      } catch (err) {
        console.error('POST /api/students/[id]/chat failed', err);
        send({ type: 'error', message: 'Chat failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
}
