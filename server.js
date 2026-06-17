require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3001;
const MODEL = 'claude-sonnet-4-6';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());

// Helper: call Claude and parse JSON from the response
async function callClaude(systemPrompt, userPrompt) {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const text = message.content[0].text;
  // Extract JSON from markdown code block if present
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(match ? match[1].trim() : text.trim());
}

// POST /api/flashcards
app.post('/api/flashcards', async (req, res) => {
  const { subject, notes } = req.body;
  if (!subject || !notes) {
    return res.status(400).json({ error: 'subject and notes are required' });
  }
  try {
    const system = `You are an expert educator. Generate exactly 8 flashcards from the provided study notes.
Return ONLY a valid JSON object in this exact format:
{
  "cards": [
    { "id": 1, "q": "question text", "a": "answer text", "topic": "subtopic label" }
  ]
}`;
    const user = `Subject: ${subject}\n\nNotes:\n${notes}`;
    const data = await callClaude(system, user);
    res.json(data);
  } catch (err) {
    console.error('/api/flashcards error:', err.message);
    res.status(500).json({ error: 'Failed to generate flashcards' });
  }
});

// POST /api/quiz
app.post('/api/quiz', async (req, res) => {
  const { subject, notes } = req.body;
  if (!subject || !notes) {
    return res.status(400).json({ error: 'subject and notes are required' });
  }
  try {
    const system = `You are an expert educator. Generate exactly 6 quiz questions from the provided study notes.
Alternate strictly: question 1 MCQ, question 2 open, question 3 MCQ, question 4 open, question 5 MCQ, question 6 open.
Return ONLY a valid JSON object in this exact format:
{
  "questions": [
    {
      "id": 1,
      "type": "mcq",
      "q": "question text",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "answer": "A) ...",
      "topic": "subtopic label"
    },
    {
      "id": 2,
      "type": "open",
      "q": "question text",
      "options": null,
      "answer": "expected answer text",
      "topic": "subtopic label"
    }
  ]
}`;
    const user = `Subject: ${subject}\n\nNotes:\n${notes}`;
    const data = await callClaude(system, user);
    res.json(data);
  } catch (err) {
    console.error('/api/quiz error:', err.message);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// POST /api/grade
app.post('/api/grade', async (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) {
    return res.status(400).json({ error: 'question and answer are required' });
  }
  try {
    const system = `You are a strict academic grader. Evaluate the student's answer to the given question.
Be rigorous: partial or vague answers should not receive full marks.
Return ONLY a valid JSON object in this exact format:
{
  "correct": true,
  "feedback": "Detailed feedback explaining what was right or wrong",
  "score": 85
}
Where "correct" is true if the answer is substantially correct, and "score" is 0-100.`;
    const user = `Question: ${question}\n\nStudent's Answer: ${answer}`;
    const data = await callClaude(system, user);
    res.json(data);
  } catch (err) {
    console.error('/api/grade error:', err.message);
    res.status(500).json({ error: 'Failed to grade answer' });
  }
});

// POST /api/professor
app.post('/api/professor', async (req, res) => {
  const { question, notes } = req.body;
  if (!question || !notes) {
    return res.status(400).json({ error: 'question and notes are required' });
  }
  try {
    const system = `You are a knowledgeable professor. Answer the student's question using ONLY the information provided in the notes below.
If the answer cannot be found in the notes, say so explicitly — do not invent information.
Return ONLY a valid JSON object in this exact format:
{
  "answer": "Your detailed answer based on the notes"
}`;
    const user = `Notes:\n${notes}\n\nStudent Question: ${question}`;
    const data = await callClaude(system, user);
    res.json(data);
  } catch (err) {
    console.error('/api/professor error:', err.message);
    res.status(500).json({ error: 'Failed to answer question' });
  }
});

// POST /api/examplan
app.post('/api/examplan', async (req, res) => {
  const { subject, date, days } = req.body;
  if (!subject || !date || !days) {
    return res.status(400).json({ error: 'subject, date, and days are required' });
  }
  try {
    const system = `You are an expert academic coach. Create a detailed day-by-day study plan.
The plan must span exactly ${days} day(s), ending on the exam date.
Return ONLY a valid JSON object in this exact format:
{
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "focus": "Main topic for the day",
      "tasks": ["Task 1", "Task 2", "Task 3"]
    }
  ]
}`;
    const user = `Subject: ${subject}\nExam Date: ${date}\nDays available to study: ${days}`;
    const data = await callClaude(system, user);
    res.json(data);
  } catch (err) {
    console.error('/api/examplan error:', err.message);
    res.status(500).json({ error: 'Failed to generate study plan' });
  }
});

// POST /api/claude - direct proxy to the Anthropic Messages API
app.post('/api/claude', async (req, res) => {
  const { messages, system, max_tokens, model } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }
  try {
    const message = await client.messages.create({
      model: model || MODEL,
      max_tokens: Math.min(max_tokens || 2048, 4096),
      system,
      messages,
    });
    res.json(message);
  } catch (err) {
    console.error('/api/claude error:', err.message);
    res.status(500).json({ error: 'Failed to call Anthropic API' });
  }
});

app.listen(PORT, () => {
  console.log(`Lectio backend running on port ${PORT}`);
});
