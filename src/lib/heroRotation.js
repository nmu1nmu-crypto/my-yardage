// Rotates the login/home hero illustration each time the app is opened.
// Sequential + wrapping (not random) so the set is seen in full before repeating.
// No server involved — images ship in the app bundle, index lives in localStorage.
import sunrise from "../assets/hero/hero-sunrise.svg";
import sunshine from "../assets/hero/hero-sunshine.svg";
import dramatic from "../assets/hero/hero-dramatic.svg";
import goldenHour from "../assets/hero/hero-golden-hour.svg";
import overcast from "../assets/hero/hero-overcast.svg";
import dusk from "../assets/hero/hero-dusk.svg";

export const HERO_IMAGES = [
  { id: "sunrise", src: sunrise, label: "Sunrise" },
  { id: "sunshine", src: sunshine, label: "Sunshine" },
  { id: "dramatic", src: dramatic, label: "Dramatic sky" },
  { id: "golden-hour", src: goldenHour, label: "Golden hour" },
  { id: "overcast", src: overcast, label: "Overcast" },
  { id: "dusk", src: dusk, label: "Dusk" },
];

const KEY = "my-yardage-hero-index";

// Called once per app launch (module-level = once per page load / cold start).
export function nextHeroImage() {
  let index = 0;
  try {
    const stored = Number(localStorage.getItem(KEY));
    index = Number.isInteger(stored) ? (stored + 1) % HERO_IMAGES.length : 0;
    localStorage.setItem(KEY, String(index));
  } catch {
    index = Math.floor(Math.random() * HERO_IMAGES.length);
  }
  return HERO_IMAGES[index];
}
