// Stable values shared by onboarding, child profiles and dashboard preferences.
export const JOURNEY_STAGES = [
  {
    value: "not_started",
    label: "We haven't started",
    detail: "Getting ready for those first tastes",
    emoji: "🌱",
  },
  {
    value: "starting",
    label: "We're getting started",
    detail: "A few first tastes, one day at a time",
    emoji: "🥄",
  },
  {
    value: "exploring",
    label: "We're exploring different foods",
    detail: "Discovering new flavours and textures",
    emoji: "🥦",
  },
  {
    value: "variety",
    label: "We're eating a wide variety",
    detail: "Building on favourites and trying more",
    emoji: "🌈",
  },
];
export const FEEDING_APPROACHES = [
  {
    value: "blw",
    label: "Baby-led weaning",
    detail: "Self-feeding with finger foods",
  },
  { value: "purees", label: "Purées & spoon-feeding" },
  { value: "mixed", label: "A mixture of both" },
  { value: "unsure", label: "Not sure yet" },
];
export const PRIORITIES = [
  {
    value: "food",
    label: "Food tracking",
    detail: "Remember first tastes and favourites",
    emoji: "🥑",
    page: "add",
    action: "Log a first taste",
  },
  {
    value: "milk",
    label: "Milk tracking",
    detail: "Keep feeds together in one place",
    emoji: "🍼",
    page: "bottle",
    action: "Track a milk feed",
  },
  {
    value: "allergens",
    label: "Allergen tracking",
    detail: "Keep a clear record of introductions",
    emoji: "🛡️",
    page: "allergens",
    action: "Open your allergen tracker",
  },
  {
    value: "recipes",
    label: "Recipe inspiration",
    detail: "Find ideas for your little one",
    emoji: "🍽️",
    page: "meals",
    action: "Explore meal ideas",
  },
];
export function validateChildProfile(data, today = new Date()) {
  if (!data.name?.trim()) return "Please enter your little one's name.";
  const parse = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
    const d = new Date(`${value}T12:00:00`);
    return !Number.isNaN(+d) &&
      d.getFullYear() === Number(value.slice(0, 4)) &&
      d.getMonth() + 1 === Number(value.slice(5, 7)) &&
      d.getDate() === Number(value.slice(8, 10))
      ? d
      : null;
  };
  const dob = parse(data.dob);
  const endToday = new Date(today);
  endToday.setHours(23, 59, 59, 999);
  if (!dob || dob > endToday)
    return "Please choose a valid date of birth that is not in the future.";
  if (data.weaningStart) {
    const start = parse(data.weaningStart);
    if (!start || start < dob)
      return "The weaning start date must be on or after the date of birth.";
  }
  return null;
}
export function dashboardPreferences(data) {
  return {
    showMilk: data.trackMilk === true || data.priority === "milk",
    showAllergens:
      data.weaningStage !== "not_started" ||
      data.allergyStatus === "yes" ||
      data.priority === "allergens",
  };
}

export function completionMessage(priority, childName) {
  const name = childName?.trim() || "your little sprout";
  const messages = {
    food: {
      title: "Let's make every\nlittle taste count",
      body: `From first bites to firm favourites, you're ready to follow ${name}'s food journey.`,
      emoji: "🥑",
    },
    milk: {
      title: "Let's keep track of\nthose little feeds",
      body: `A little less remembering, a little more enjoying. Keep ${name}'s milk feeds together in one place.`,
      emoji: "🍼",
    },
    allergens: {
      title: "Let's take it\none little taste at a time",
      body: `Your space to record ${name}'s allergen introductions and keep track of their journey is ready.`,
      emoji: "🛡️",
    },
    recipes: {
      title: "Let's find their\nnext favourite",
      body: `A little inspiration for ${name}'s next meal. Explore ideas and discover new family favourites.`,
      emoji: "🍽️",
    },
  };
  return (
    messages[priority] || {
      title: "Let's grow\ntogether",
      body: `Your little corner of MunchSprouts is ready for ${name}'s journey.`,
      emoji: "🌱",
    }
  );
}
