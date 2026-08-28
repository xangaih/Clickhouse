import Anthropic from '@anthropic-ai/sdk';
import type { BookCandidate, AgentAlert, ChatMessage, WeeklyDigestInput, Proposal } from './types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an assistant that helps elementary school teachers
understand reading fluency data. You will be given one student's recent reading
accuracy trend and a short list of candidate books already filtered to their
reading level.

Write:
1. A one-sentence, plain-language alert for the teacher explaining what's happening
   with this student — use the student's first name naturally (e.g. "Maya has read
   steadily around 85% for weeks, but the last few days show a real dip"), and
   describe the trend, not a diagnosis or label. Never use clinical or diagnostic
   language (no "learning disability", "dyslexia", "ADHD", etc.) — you are not
   qualified to diagnose and the data doesn't support it. Stick to describing the
   reading data itself.
2. Which ONE of the provided candidate books you'd recommend and a one-sentence
   reason, grounded in their interests and reading level — do not recommend a book
   that isn't in the candidate list.

Respond as JSON only: { "alert_text": string, "recommended_book_id": number, "reason": string }`;

export async function generateAlert(
  studentId: number,
  studentName: string,
  dailyAccuracy: { day: string; accuracy: number }[],
  recentAccuracy: number,
  baselineAccuracy: number,
  candidates: BookCandidate[]
): Promise<AgentAlert> {
  const userContent = JSON.stringify({ studentName, dailyAccuracy, recentAccuracy, baselineAccuracy, candidateBooks: candidates });
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });
  const textBlock = response.content.find((b) => b.type === 'text');
  const rawText = textBlock?.type === 'text' ? textBlock.text : '{}';
  // Models sometimes wrap JSON in a ```json ... ``` fence despite "JSON only" —
  // strip it before parsing rather than relying on the instruction alone.
  const jsonText = rawText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(jsonText);
  const matchedBook = candidates.find((c) => c.bookId === parsed.recommended_book_id) ?? null;
  return {
    studentId,
    alertText: parsed.alert_text,
    recommendedBookId: parsed.recommended_book_id,
    recommendedBook: matchedBook
      ? { title: matchedBook.title, readingLevel: matchedBook.readingLevel, topicTags: matchedBook.topicTags }
      : null,
    reason: parsed.reason,
  };
}

const CHAT_TOOLS_SYSTEM_PROMPT = (studentName: string) => `You are an assistant helping an
elementary school teacher understand ONE student's (${studentName}'s) reading data. You do
NOT have this student's data pre-loaded — you have live tools to look it up: their accuracy
trend, their book/reading assignment history, summaries of recent sessions, a word-by-word
breakdown of any specific session, current book recommendations, how often they've actually
been reading (separate from how well), and how the whole class is trending.

Accuracy and engagement are different signals — a student can read accurately but less
often, or read constantly but with declining accuracy. If asked whether a student is
"still reading regularly" or similar, use get_engagement_pattern rather than inferring
engagement from the accuracy trend alone.

Call whichever tools are actually relevant to the teacher's question before answering —
you have real, live access to this data, so look it up rather than guessing or saying you
don't have it. Don't call tools for data the question doesn't need. If a question needs a
specific session's detail (e.g. "what did a bad session look like"), call
get_recent_sessions first to find the right session_id, then get_session_detail.

Ground every answer in what the tools actually return. Describe trends in plain language
(e.g. "steady around 85% for weeks, dipping the last few days") rather than diagnosing —
never use clinical or diagnostic language (no "learning disability", "dyslexia", "ADHD",
etc.), you are not qualified to diagnose and the data doesn't support it. Only recommend a
book if it's in what get_book_recommendations returned — never invent one.

You also have three PROPOSAL tools: propose_intervention, propose_book_reassignment, and
propose_followup_flag. When the teacher asks what to do next (e.g. "what should we do
about this?"), don't just describe the situation — actually call one of these tools
before you finish answering, so a concrete draft shows up for them to review. Gather only
enough context to make a reasonable proposal (usually accuracy trend + book
recommendations is plenty) rather than exhaustively calling every tool first — you have a
limited number of tool-call rounds, and a proposal is more useful than an exhaustive
essay. Calling a proposal tool does NOT take any real action — it drafts a suggestion that
appears in the UI as a card the teacher must explicitly confirm or dismiss. So in your text
reply, describe it as a draft you've put together for their review ("I've drafted an
intervention below") — never say the action has already been taken. Only propose an
intervention or reassignment using a book that actually came from
get_book_recommendations.

If asked something the data genuinely can't answer, say so plainly. Keep answers short —
a few sentences, not an essay. Respond in plain text, not JSON.`;

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
}

const MAX_TOOL_ROUNDS = 4;

export async function chatWithTools(
  studentName: string,
  tools: ToolDefinition[],
  history: ChatMessage[],
  executeTool: (name: string, input: Record<string, unknown>) => Promise<unknown>,
  onToolCall?: (name: string, input: Record<string, unknown>) => void
): Promise<{ reply: string; proposals: Proposal[] }> {
  const conversation: Anthropic.MessageParam[] = history.map((m) => ({ role: m.role, content: m.content }));
  const proposals: Proposal[] = [];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1200,
      system: CHAT_TOOLS_SYSTEM_PROMPT(studentName),
      tools: tools as Anthropic.Tool[],
      messages: conversation,
    });

    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find((b) => b.type === 'text');
      return { reply: textBlock?.type === 'text' ? textBlock.text : '', proposals };
    }

    conversation.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const input = (block.input ?? {}) as Record<string, unknown>;
        onToolCall?.(block.name, input);
        const result = await executeTool(block.name, input);
        // Proposal tools are named with a 'propose_' prefix by convention (see the
        // TOOLS array in the chat route) — their result IS the structured proposal,
        // surfaced to the frontend as a confirmation card, not just chat text.
        if (block.name.startsWith('propose_')) {
          proposals.push(result as Proposal);
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
    }
    conversation.push({ role: 'user', content: toolResults });
  }

  return {
    reply: "I wasn't able to finish looking that up — try asking again, maybe with a narrower question.",
    proposals,
  };
}

const DIGEST_SYSTEM_PROMPT = `You are an assistant writing a Monday-morning briefing for
an elementary school teacher, covering ALL students currently flagged for a quiet
reading-accuracy decline, plus anyone who recently recovered.

You'll be given: the class-wide average accuracy this week vs last week, students newly
flagged this week (not flagged as of a week ago), students still flagged from before
(ongoing), and students who recovered (had an intervention on file and are no longer
flagged).

Write ONE short paragraph — readable in about 15 seconds before class starts. Cover, in
whatever order reads most naturally: the overall class trend, who's new to the flagged
list this week (by first name), and who's recovering. If a list is empty, don't mention
it or say something awkward like "no one" — just leave it out. Describe trends in plain
language, never diagnose — no clinical or diagnostic language (no "learning disability",
"dyslexia", "ADHD", etc.), you are not qualified to diagnose and the data doesn't support
it. Respond in plain text, not JSON — just the paragraph, no preamble.`;

export async function generateWeeklyDigest(input: WeeklyDigestInput): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 400,
    system: DIGEST_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });
  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock?.type === 'text' ? textBlock.text : '';
}
