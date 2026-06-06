export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const LOW_CONFIDENCE_THRESHOLD = 0.68;

export const careOptions = {
  light: ['full_sun', 'partial_sun', 'partial_shade', 'shade'],
  water: ['dry', 'moderate', 'wet'],
  soil: ['well_draining', 'sandy', 'loamy', 'clay_tolerant'],
  difficulty: ['easy', 'moderate', 'fussy'],
  californiaSuitability: ['excellent', 'good', 'caution', 'poor'],
  petSafety: ['safe', 'caution', 'toxic', 'unknown'],
};

export const traitCopy = {
  full_sun: {
    label: 'Full sun',
    description: 'Thrives with 6+ hours of direct light.',
    tone: 'amber',
    icon: 'full_sun',
  },
  partial_sun: {
    label: 'Partial sun',
    description: 'Likes bright light with some break from harsh sun.',
    tone: 'amber',
    icon: 'partial_sun',
  },
  partial_shade: {
    label: 'Part shade',
    description: 'Prefers filtered light or gentle morning sun.',
    tone: 'emerald',
    icon: 'partial_shade',
  },
  shade: {
    label: 'Shade',
    description: 'Best in indirect or low direct light.',
    tone: 'slate',
    icon: 'shade',
  },
  dry: {
    label: 'Dry',
    description: 'Let soil dry well between waterings.',
    tone: 'orange',
    icon: 'dry',
  },
  moderate: {
    label: 'Moderate water',
    description: 'Water when the top layer begins to dry.',
    tone: 'sky',
    icon: 'moderate_water',
  },
  wet: {
    label: 'Moist',
    description: 'Keep evenly moist without sitting in stagnant water.',
    tone: 'cyan',
    icon: 'wet',
  },
  well_draining: {
    label: 'Well-draining',
    description: 'Use a mix that drains quickly.',
    tone: 'stone',
    icon: 'well_draining_soil',
  },
  sandy: {
    label: 'Sandy soil',
    description: 'Tolerates gritty, fast-draining soil.',
    tone: 'yellow',
    icon: 'sandy_soil',
  },
  loamy: {
    label: 'Loamy soil',
    description: 'Prefers balanced, organic soil.',
    tone: 'lime',
    icon: 'loamy_soil',
  },
  clay_tolerant: {
    label: 'Clay tolerant',
    description: 'Can handle heavier soil if drainage is managed.',
    tone: 'rose',
    icon: 'clay_tolerant',
  },
  easy: {
    label: 'Beginner friendly',
    description: 'Forgiving care needs for newer growers.',
    tone: 'green',
    icon: 'beginner_friendly',
  },
  fussy: {
    label: 'Fussy',
    description: 'Needs closer attention to conditions.',
    tone: 'rose',
    icon: 'beginner_friendly',
  },
  excellent: {
    label: 'Great for California',
    description: 'Usually well suited to many California gardens.',
    tone: 'green',
    icon: 'california_suitable',
  },
  good: {
    label: 'California friendly',
    description: 'Often suitable with the right placement.',
    tone: 'emerald',
    icon: 'california_suitable',
  },
  caution: {
    label: 'Use caution',
    description: 'Check local climate, pets, or handling needs.',
    tone: 'amber',
    icon: 'pet_caution',
  },
  poor: {
    label: 'Poor fit',
    description: 'May struggle without special care.',
    tone: 'rose',
    icon: 'partial_shade',
  },
  safe: {
    label: 'Pet safer',
    description: 'Generally considered safer, but confirm before exposure.',
    tone: 'green',
    icon: 'pet_safe',
  },
  toxic: {
    label: 'Pet toxic',
    description: 'Keep away from pets and children until confirmed.',
    tone: 'rose',
    icon: 'toxic_pets',
  },
  unknown: {
    label: 'Pet safety unknown',
    description: 'Confirm safety before pets or children can reach it.',
    tone: 'slate',
    icon: 'pet_caution',
  },
};

export const sectionLabels = {
  overview: 'Overview',
  sunlight: 'Sunlight',
  watering: 'Watering',
  soil: 'Soil',
  californiaNotes: 'California notes',
  commonProblems: 'Common problems',
  propagation: 'Propagation',
  funFact: 'Fun fact',
};

export const resultSectionLabels = {
  overview: 'Overview',
  californiaNotes: 'California notes',
  commonProblems: 'Common problems',
  propagation: 'Propagation',
};
