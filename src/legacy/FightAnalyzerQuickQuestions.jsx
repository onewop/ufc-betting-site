/**
 * ARCHIVED — Quick Question Buttons (removed from FightAnalyzer UI for cleaner layout)
 * Removed: April 15, 2026
 * Restore by: adding generalQuestions array back before the component, handleQuestionButton
 * inside the component, and the JSX block back into the analyzer section of FightAnalyzer.jsx.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. DATA — paste before the FightAnalyzer component definition
 * ─────────────────────────────────────────────────────────────────────────────
 */

const generalQuestions = [
  "Who has the striking advantage?",
  "Who lands more strikes per minute?",
  "Compare striking accuracy.",
  "Who has better striking defense?",
  "Who has the grappling / wrestling edge?",
  "How does each fighter's takedown offense compare to the other's defense?",
  "Analyze takedown defense statistics.",
  "Who has more submission wins?",
  "Compare their win/loss records.",
  "Who has the better finish rate?",
  "Who wins by KO/TKO more often?",
  "Who is on the better win streak?",
  "Compare reach and physical attributes.",
  "What is the DFS salary value breakdown?",
  "Who wins? Overall fight prediction.",
];

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. HANDLER — paste inside the FightAnalyzer component body
 * ─────────────────────────────────────────────────────────────────────────────
 */

// const handleQuestionButton = (q) => {
//   setQuestion(q);
//   // Pass `q` directly — React state updates are async, so the `question`
//   // state variable would still hold the old value if we called processQuestion()
//   // without an argument here.
//   processQuestion(q);
// };

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. JSX — paste inside the analyzer section, after the <details> block and
 *    before the Full Fight Record modal
 * ─────────────────────────────────────────────────────────────────────────────
 */

/*
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-yellow-700/30" />
          <h2 className="text-xs font-bold tracking-[0.4em] uppercase text-yellow-600">
            ◈ QUICK QUESTION BUTTONS
          </h2>
          <div className="h-px flex-1 bg-yellow-700/30" />
        </div>

        <div className="md:hidden pb-6">
          <details className="rounded-lg border border-stone-700 bg-stone-900/80">
            <summary className="px-4 py-3 text-xs font-bold uppercase tracking-widest text-yellow-500">
              Show Quick Questions
            </summary>
            <div className="grid grid-cols-1 gap-3 p-3 border-t border-stone-700">
              {generalQuestions.map((question, index) => (
                <button
                  key={`mobile-q-${index}`}
                  onClick={() => handleQuestionButton(question)}
                  className="bg-stone-900 border border-yellow-700/40 text-stone-300 text-xs font-bold tracking-wide py-3 px-4 rounded-lg hover:bg-stone-800 hover:border-yellow-600/60 hover:text-yellow-400 transition duration-200 text-left min-h-[44px]"
                >
                  {question}
                </button>
              ))}
            </div>
          </details>
        </div>

        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 pb-10">
          {generalQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => handleQuestionButton(question)}
              className="bg-stone-900 border border-yellow-700/40 text-stone-300 text-xs font-bold tracking-wide py-3 px-4 rounded-lg hover:bg-stone-800 hover:border-yellow-600/60 hover:text-yellow-400 transition duration-200 text-left"
            >
              {question}
            </button>
          ))}
        </div>
*/
