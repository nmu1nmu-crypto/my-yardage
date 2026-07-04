// Rotates the login/home hero photo each time the app is opened.
// Sequential + wrapping (not random) so the set is seen in full before repeating.
// No server involved — images ship in the app bundle, index lives in localStorage.
import sunsetGreen from "../assets/hero-photos/hero-photo-1.jpg";
import ballAtHole from "../assets/hero-photos/hero-photo-2.jpg";
import teeByThePond from "../assets/hero-photos/hero-photo-3.jpg";
import aerialBunkers from "../assets/hero-photos/hero-photo-4.jpg";
import dunesAndMountains from "../assets/hero-photos/hero-photo-6.jpg";

export const HERO_IMAGES = [
  { id: "sunset-green", src: sunsetGreen, label: "Sunset green" },
  { id: "ball-at-hole", src: ballAtHole, label: "Ball at the hole" },
  { id: "tee-by-the-pond", src: teeByThePond, label: "Tee by the pond" },
  { id: "aerial-bunkers", src: aerialBunkers, label: "Aerial bunkers" },
  { id: "dunes-and-mountains", src: dunesAndMountains, label: "Dunes and mountains" },
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
