const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function generate(systemPrompt, userPrompt) {
  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  return message.content[0].text;
}

module.exports = { generate };
