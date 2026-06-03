const OpenAI = require('openai');
const { TOOL_DEFINITIONS } = require('../tools/definitions');
const { executeTool }      = require('../tools/implementations');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function createRepetitionDetector() {
  const seen = new Set();
  return (name, input) => {
    const key = `${name}:${JSON.stringify(input)}`;
    if (seen.has(key)) throw new Error(`Loop detected: '${name}' called twice with identical input`);
    seen.add(key);
  };
}

async function runAgent(userGoal, options = {}) {
  const {
    maxIterations = 15,
    timeLimitMs   = 120000,           // 2 minutes
    model         = 'gpt-4o-mini'     // cheapest, fast enough
  } = options;

  const messages     = [{ role: 'user', content: userGoal }];
  const startTime    = Date.now();
  const detectRepeat = createRepetitionDetector();
  let iterations     = 0;

  while (true) {

    // ── GUARDS ─────────────────────────────────────────────
    iterations++;

    if (iterations > maxIterations)
      return `\n[Stopped: max iterations (${maxIterations}) reached]`;

    if (Date.now() - startTime > timeLimitMs)
      return `\n[Stopped: time limit exceeded (${timeLimitMs / 1000}s)]`;
    // ───────────────────────────────────────────────────────

    process.stdout.write(`\n[${iterations}] Thinking...`);

    const response = await openai.chat.completions.create({
      model,
      max_tokens: 4096,
      tools: TOOL_DEFINITIONS,
      messages
    });

    const message = response.choices[0].message;

    // ── DECIDE ─────────────────────────────────────────────
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content || '[Done — no text output]';
    }

    const toolCalls = message.tool_calls;

    // Print what the agent is doing (Claude Code-style)
    toolCalls.forEach(tc => {
      const name  = tc.function.name;
      const input = JSON.parse(tc.function.arguments);
      process.stdout.write(`\n  ⟶  ${name}(${JSON.stringify(input)})`);
    });

    // Repetition guard
    for (const tc of toolCalls) {
      const name  = tc.function.name;
      const input = JSON.parse(tc.function.arguments);
      try { detectRepeat(name, input); }
      catch (e) { return `\n[Stopped: ${e.message}]`; }
    }

    // ── ACT — execute all tools (parallel) ────────────────
    const toolResults = await Promise.all(
      toolCalls.map(async tc => {
        const name  = tc.function.name;
        const input = JSON.parse(tc.function.arguments);
        return {
          role:         'tool',
          tool_call_id: tc.id,
          content:      await executeTool(name, input)
        };
      })
    );

    messages.push(message);
    messages.push(...toolResults);
  }
}

module.exports = { runAgent };
