import React, { useState } from "react";

// ----------------------------------------------------------------
// Fighter name → CC-licensed image credit strings.
// Format: "Photo by [Author], [License], Wikimedia Commons"
// Add a new entry whenever you add a real headshot.
// ----------------------------------------------------------------
const CREDITS = {
  // CC0 = public domain, no attribution required — credit shown as courtesy
  "michael-page":
    "Michael Venom Page.png by Hrhr prph, CC0 1.0 Public Domain, Wikimedia Commons",
  // CC-BY 4.0 — attribution required; verify exact uploader on Commons file page
  "movsar-evloev":
    "Photo from Wikimedia Commons, CC-BY 4.0 (verify uploader on file page)",
};

// Palette of UFC-themed colors cycled per fighter
const AVATAR_COLORS = [
  ["#7f1d1d", "#fca5a5"], // red
  ["#1e3a5f", "#93c5fd"], // blue
  ["#14532d", "#86efac"], // green
  ["#3b0764", "#d8b4fe"], // purple
  ["#7c2d12", "#fdba74"], // orange
  ["#134e4a", "#5eead4"], // teal
  ["#1e1b4b", "#a5b4fc"], // indigo
  ["#4a1942", "#f0abfc"], // fuchsia
];

// Derive a consistent color pair from the fighter's name
const getAvatarColors = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// "Movsar Evloev" → "ME"
const getInitials = (name) => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Convert "First Last" → "first-last" to match filenames in /images/fighters/
export const toKebabCase = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

/**
 * FighterImage — displays a fighter headshot with:
 *   • YouTube highlight thumbnail as primary source (when youtubeThumbnailId is provided)
 *   • Automatic path derivation from name (/images/fighters/first-last.jpg)
 *   • Initials avatar fallback (no external API — unique color per fighter)
 *   • Hover tooltip showing CC credit (if available)
 *   • Accessible alt text
 *
 * Props:
 *   name               {string}  Fighter's full name (required)
 *   src                {string}  Override image URL (optional)
 *   youtubeThumbnailId {string}  YouTube video ID — uses hqdefault.jpg thumbnail (optional)
 *   size               {string}  Tailwind sizing classes (default: "w-16 h-16 sm:w-20 sm:h-20")
 *   className          {string}  Additional classes
 *   showName           {bool}    Show name label below image (default: false)
 */
const FighterImage = ({
  name,
  src,
  youtubeThumbnailId,
  size = "w-16 h-16 sm:w-20 sm:h-20",
  className = "",
  rounded = "rounded-full",
  imgStyle = {},
  showName = false,
}) => {
  const key = toKebabCase(name);
  // Fallback chain: explicit src → YouTube thumb → local jpg → local png → initials
  const primarySrc =
    src ||
    (youtubeThumbnailId
      ? `https://img.youtube.com/vi/${youtubeThumbnailId}/hqdefault.jpg`
      : null) ||
    `/images/fighters/${key}.jpg`;
  const credit = CREDITS[key] || null;
  const altText = `${name} UFC fighter portrait`;

  const [imgSrc, setImgSrc] = useState(primarySrc);
  const [triedPng, setTriedPng] = useState(false);
  const [showInitials, setShowInitials] = useState(false);

  const handleError = () => {
    if (imgSrc.includes("youtube.com")) {
      // YouTube thumb failed → fall back to local jpg
      setImgSrc(`/images/fighters/${key}.jpg`);
    } else if (!triedPng && imgSrc.endsWith(".jpg")) {
      // Local jpg failed → try .png variant
      setImgSrc(`/images/fighters/${key}.png`);
      setTriedPng(true);
    } else {
      // All image sources exhausted — show initials avatar
      setShowInitials(true);
    }
  };

  const [bgColor, textColor] = getAvatarColors(name);
  const initials = getInitials(name);

  const sharedRingClass = className;

  return (
    <div className="relative inline-flex flex-col items-center group">
      {showInitials ? (
        // Initials avatar — rendered purely in React, no image needed
        <div
          className={`${size} ${sharedRingClass} ${rounded} flex items-center justify-center font-bold select-none`}
          style={{ backgroundColor: bgColor, color: textColor, ...imgStyle }}
          title={altText}
          role="img"
          aria-label={altText}
        >
          <span className="text-[0.9em] leading-none">{initials}</span>
        </div>
      ) : (
        <img
          src={imgSrc}
          alt={altText}
          title={credit ? `${altText} — ${credit}` : altText}
          className={`${size} ${sharedRingClass} ${rounded} object-cover bg-gray-700`}
          style={imgStyle}
          onError={handleError}
        />
      )}

      {/* Credit tooltip — only for real photos with known license */}
      {credit && !showInitials && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full mt-1 hidden group-hover:block bg-gray-900/95 text-gray-400 text-xs px-2 py-1 rounded whitespace-nowrap z-20 pointer-events-none border border-gray-700"
        >
          {credit}
        </span>
      )}

      {showName && (
        <span className="mt-1 text-xs text-gray-300 font-medium text-center leading-tight max-w-[5rem] truncate">
          {name}
        </span>
      )}
    </div>
  );
};

export default FighterImage;
