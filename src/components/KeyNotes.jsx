/**
 * KeyNotes.jsx
 *
 * Component for displaying conditional key notes.
 * Only renders if there is content to show, with prominent red styling and animation.
 */

const KeyNotes = ({ fightContext }) => {
  // Placeholder data for testing - replace with real data source
  const placeholderContext = [
    {
      type: "major",
      text: "Fighter A dealing with recent injury concerns from training camp",
    },
    {
      type: "moderate",
      text: "Short notice fight - less than 2 weeks preparation time",
    },
    { type: "minor", text: "Fighter B on personal event schedule conflict" },
    {
      type: "moderate",
      text: "Style advantage: Fighter A's wrestling vs Fighter B's stand-up",
    },
  ];

  const contextToShow = fightContext || placeholderContext;

  if (!contextToShow || contextToShow.length === 0) {
    return null; // Don't render if no content
  }

  const getColorClasses = (type) => {
    switch (type) {
      case "major":
        return "border-red-500/50 bg-red-950/20 text-red-300";
      case "moderate":
        return "border-orange-500/50 bg-orange-950/20 text-orange-300";
      case "minor":
        return "border-yellow-500/50 bg-yellow-950/20 text-yellow-300";
      default:
        return "border-stone-500/50 bg-stone-950/20 text-stone-300";
    }
  };

  return (
    <div className="mt-6 border-t border-red-600 pt-6">
      <h3 className="text-red-300 text-xl font-bold mb-4 uppercase tracking-wide flex items-center gap-2 animate-pulse">
        <span className="text-red-500">⚠️</span>
        Key Notes
        <span className="bg-red-600 text-white text-xs px-2 py-1 rounded font-semibold">
          Important
        </span>
      </h3>
      <div className="space-y-3">
        {contextToShow.map((note, index) => (
          <div
            key={index}
            className={`border-l-4 pl-4 py-2 rounded-r ${getColorClasses(note.type)}`}
          >
            <p className="text-sm">{note.text}</p>
          </div>
        ))}
      </div>
      <p className="text-stone-600 text-xs mt-3 italic">
        These notes are for informational purposes only and may affect fight
        outcomes.
      </p>
    </div>
  );
};

export default KeyNotes;
