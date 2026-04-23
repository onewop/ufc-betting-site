/**
 * KeyNotes.jsx
 *
 * Displays key fight notes. Hidden entirely when no fightContext prop is provided.
 * To show notes, pass a fightContext array to this component.
 */

const KeyNotes = ({ fightContext }) => {
  // Don't render if no real notes are provided
  if (!fightContext || fightContext.length === 0) {
    return null;
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
        {fightContext.map((note, index) => (
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
