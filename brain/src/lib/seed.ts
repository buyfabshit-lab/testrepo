import type { Kind, Thought } from "./types";

/**
 * A starter brain, so the first thing you see is a canvas with shape to it
 * rather than an empty void that needs twenty notes before it does anything.
 * Wipe it from settings once your own thoughts have taken over.
 */
type Sketch = [days: number, kind: Kind, tags: string, title: string, text: string];

const SKETCHES: Sketch[] = [
  [22, "idea", "second-brain product", "Bubbles beat folders",
    "Folders make you decide where a thing goes before you know what it is. Bubbles let it float until it finds its own neighbours. Capture first, structure later — the structure should be a consequence, not a prerequisite."],
  [21, "note", "second-brain product", "Capture has to be one box",
    "Every note app I have abandoned died at the same place: the form. Title, folder, tags, type. Four decisions before a thought is saved. One box, one keystroke, or it will not get used at a bus stop."],
  [19, "fact", "second-brain research", "Spaced repetition beats rereading",
    "Retrieval practice beats rereading by a wide margin in the memory literature. Reading a note again feels like learning and mostly is not. The app should ask me things, not just show me things."],
  [14, "idea", "second-brain product", "Ask the canvas, not a chatbot",
    "The question box should light up the bubbles it answered from. An answer with no visible source is just a nicer-sounding guess, and I will trust it exactly once."],
  [30, "task", "mortgage house", "Get the fixed-rate quote before the 30th",
    "The tracker rolls onto the standard variable rate at the end of the month. Call the broker, ask for the two-year fixed and the five-year fixed side by side, including fees."],
  [28, "fact", "mortgage house", "Early repayment charge is 1% until March",
    "1% of the outstanding balance if we remortgage before March. On the current balance that is about £2,400, which eats most of the saving from switching early."],
  [12, "note", "mortgage house", "Survey flagged the flat roof",
    "Homebuyer report: flat roof over the kitchen extension has maybe five years left. Not urgent, not nothing. Get two quotes before the winter so it is a decision and not an emergency."],
  [26, "person", "hiring team", "Priya — staff engineer candidate",
    "Third interview. Strongest systems thinker we have seen this round; walked through the queue backpressure design without notes. Wants to know who she would be working with day to day before she decides."],
  [25, "task", "hiring team", "Write the take-home rubric before the next loop",
    "We are grading the take-home on vibes and it shows — two interviewers gave the same submission a 2 and a 4. Write down what a 3 actually is."],
  [9, "idea", "hiring team", "Pair on real code instead of a take-home",
    "Ninety minutes on an actual open ticket in our repo, with them driving. Closer to the job, less unpaid homework, and we find out what it is like to disagree with them."],
  [18, "note", "sleep health", "The 2pm slump is a sleep debt, not a coffee shortage",
    "Two weeks of data: the afternoon crash tracks nights under seven hours almost exactly, and does not track caffeine at all. More coffee is treating the symptom and wrecking the cause."],
  [16, "task", "sleep health", "No screens after 22:30 for two weeks",
    "Testing it properly this time. Phone charges in the kitchen. Two weeks, then compare against the same fortnight of sleep data."],
  [7, "fact", "sleep health", "Caffeine half-life is about five hours",
    "A 4pm coffee is still half in you at 9pm. That is the whole mechanism of the bad night, and it never feels like the cause at 4pm."],
  [20, "link", "writing craft", "On Writing Well — the clutter chapter",
    "https://example.com/on-writing-well-clutter — the argument is that every sentence you cut makes the surviving ones louder. The examples are better than the rule."],
  [11, "idea", "writing craft second-brain", "Notes should be written for the stranger I will be",
    "In six months I will not remember the meeting, the room, or why it mattered. Write the note for that person: what I concluded and why, not what was said."],
  [5, "note", "writing craft", "Verbs carry the sentence",
    "Every draft gets faster when I take the adverbs out and pick a better verb instead. Rewriting for verbs is the highest-leverage editing pass I know."],
  [4, "task", "second-brain product", "Try it on a real week before showing anyone",
    "Dogfood for a full week of actual notes. If I do not reach for it at a bus stop, the capture flow is still wrong and no amount of canvas polish fixes that."],
  [2, "idea", "sleep health writing craft", "Best sentences arrive on the walk, not at the desk",
    "Consistently. The desk is where they get typed up. Which means the capture box on the phone is doing more work than the editor on the laptop."],
];

const DAY = 86_400_000;

export function SEED(): Thought[] {
  const now = Date.now();
  return SKETCHES.map(([days, kind, tags, title, text]) => {
    const createdAt = now - days * DAY;
    const url = text.match(/https?:\/\/\S+/);
    return {
      id: crypto.randomUUID(),
      text,
      title,
      tags: tags.split(" "),
      kind,
      summary: "",
      source: url ? url[0] : "",
      pinned: false,
      createdAt,
      updatedAt: createdAt,
      enriched: false,
    };
  });
}
