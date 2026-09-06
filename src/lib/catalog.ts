import type { Client, Product, Service, Staff, WeekHours } from "./types";

export const SALON = {
  name: "Enlightened Beauty",
  house: "Enlightened Beauty",
  mark: "E",
  tagline: "Hair, skin, and quiet luxury.",
  address: "1226 Merryman St",
  city: "Marinette, WI 54143",
  phone: "(715) 330-5084",
  email: "desk@enlightenedbeauty.salon",
  instagram: "@enlightenedbeauty",
};

export const CATEGORIES = [
  { id: "hair", label: "Cut & finish", image: "/images/hair.jpg" },
  { id: "color", label: "Color", image: "/images/color.jpg" },
  { id: "nails", label: "Nails", image: "/images/nails.jpg" },
  { id: "skin", label: "Skin", image: "/images/spa.jpg" },
  { id: "makeup", label: "Makeup", image: "/images/makeup.jpg" },
] as const;

export const STAFF: Staff[] = [
  {
    id: "elena",
    name: "Elena Voss",
    role: "Owner, master colorist",
    bio: "Lived-in color, precise placement, and the kind of gloss that photographs well in lake light. Fifteen years behind the chair.",
    initials: "EV",
    specialties: ["color", "hair"],
    chip: "appt-elena",
    startHour: 9,
    endHour: 18,
  },
  {
    id: "marcus",
    name: "Marcus Chen",
    role: "Cut director",
    bio: "Architecture in hair. Dry-cut texture, sharp men's work, and blowouts that last through a Wisconsin wind.",
    initials: "MC",
    specialties: ["hair"],
    chip: "appt-marcus",
    startHour: 10,
    endHour: 19,
  },
  {
    id: "amara",
    name: "Amara Okoye",
    role: "Nails & lash",
    bio: "Clean architecture, quiet nudes, and lash work that looks like you woke up with it. Detail is the whole point.",
    initials: "AO",
    specialties: ["nails", "makeup"],
    chip: "appt-amara",
    startHour: 9,
    endHour: 17,
  },
  {
    id: "sofie",
    name: "Sofie Berg",
    role: "Skin therapist",
    bio: "Results without theater. Custom facials, calm rooms, and a brow map that actually suits your face.",
    initials: "SB",
    specialties: ["skin"],
    chip: "appt-sofie",
    startHour: 11,
    endHour: 19,
  },
  {
    id: "jules",
    name: "Jules Park",
    role: "Makeup & brows",
    bio: "Event skin that still looks like skin. Soft glam, lash lifts, and brows that frame rather than shout.",
    initials: "JP",
    specialties: ["makeup", "skin"],
    chip: "appt-jules",
    startHour: 10,
    endHour: 18,
  },
];

export const SERVICES: Service[] = [
  {
    id: "cut",
    name: "Signature cut & shape",
    category: "hair",
    durationMin: 60,
    price: 85,
    description: "Consultation, precision cut, and a lasting blowout. Bring a photo if you like; we still start with your hair.",
    staffIds: ["elena", "marcus"],
    image: "/images/hair.jpg",
  },
  {
    id: "blowout",
    name: "Express blowout",
    category: "hair",
    durationMin: 45,
    price: 55,
    description: "Smooth, movement, and a finish that survives humidity. Add on after color or book it on its own.",
    staffIds: ["elena", "marcus"],
    image: "/images/hair.jpg",
  },
  {
    id: "mens",
    name: "Precision men's cut",
    category: "hair",
    durationMin: 45,
    price: 55,
    description: "Clean lines, textured crop, or a classic taper. Includes a hot-towel finish.",
    staffIds: ["marcus"],
    image: "/images/hair.jpg",
  },
  {
    id: "balayage",
    name: "Lived-in balayage",
    category: "color",
    durationMin: 180,
    price: 285,
    description: "Hand-painted dimension, toner, and a gloss that grows out softly. Includes a blowout.",
    staffIds: ["elena"],
    image: "/images/color.jpg",
  },
  {
    id: "full-color",
    name: "Full color",
    category: "color",
    durationMin: 120,
    price: 165,
    description: "Even, rich coverage from root to end. Formulation is mixed to your history, not a swatch wall.",
    staffIds: ["elena"],
    image: "/images/color.jpg",
  },
  {
    id: "gloss",
    name: "Gloss & tone",
    category: "color",
    durationMin: 75,
    price: 95,
    description: "A refresh between bigger color days. Shine, tone correction, and a blowout.",
    staffIds: ["elena"],
    image: "/images/color.jpg",
  },
  {
    id: "roots",
    name: "Root refresh",
    category: "color",
    durationMin: 90,
    price: 125,
    description: "Grow-out coverage blended through the mid-lengths so it doesn't look like a helmet.",
    staffIds: ["elena"],
    image: "/images/color.jpg",
  },
  {
    id: "gel-mani",
    name: "Gel manicure",
    category: "nails",
    durationMin: 60,
    price: 48,
    description: "Shape, care, and a long-wear nude or color. We keep the cuticle work honest.",
    staffIds: ["amara"],
    image: "/images/nails.jpg",
  },
  {
    id: "pedi",
    name: "Spa pedicure",
    category: "nails",
    durationMin: 75,
    price: 62,
    description: "Soak, callus work, massage, and polish. The chair is quiet; the finish is clean.",
    staffIds: ["amara"],
    image: "/images/nails.jpg",
  },
  {
    id: "soft-gel",
    name: "Soft gel extensions",
    category: "nails",
    durationMin: 90,
    price: 95,
    description: "Natural length with structure. Built for people who type, cook, and actually use their hands.",
    staffIds: ["amara"],
    image: "/images/nails.jpg",
  },
  {
    id: "facial",
    name: "Signature facial",
    category: "skin",
    durationMin: 75,
    price: 140,
    description: "A custom 75 minutes: cleanse, treat, sculpt, and seal. No gadget theater.",
    staffIds: ["sofie"],
    image: "/images/spa.jpg",
  },
  {
    id: "glow",
    name: "Express glow facial",
    category: "skin",
    durationMin: 45,
    price: 85,
    description: "A shorter treatment before an event or a long week. Skin looks rested, not shiny.",
    staffIds: ["sofie", "jules"],
    image: "/images/spa.jpg",
  },
  {
    id: "brows",
    name: "Brow sculpt",
    category: "skin",
    durationMin: 30,
    price: 42,
    description: "Map, wax or tweeze, and a tint if you want it. Architecture first.",
    staffIds: ["sofie", "jules"],
    image: "/images/makeup.jpg",
  },
  {
    id: "event-mu",
    name: "Event makeup",
    category: "makeup",
    durationMin: 75,
    price: 120,
    description: "Skin, eyes, and a mouth that last through dinner and photographs. Trial recommended for weddings.",
    staffIds: ["jules"],
    image: "/images/makeup.jpg",
  },
  {
    id: "lash",
    name: "Lash lift & tint",
    category: "makeup",
    durationMin: 60,
    price: 78,
    description: "A curl and a tint that replace mascara for a few weeks. Pairs well with brows.",
    staffIds: ["amara", "jules"],
    image: "/images/makeup.jpg",
  },
];

export const PRODUCTS: Product[] = [
  {
    id: "oil",
    name: "Salon hair oil",
    category: "Hair",
    price: 42,
    stock: 18,
    sku: "EB-OIL",
    description: "A weightless oil for ends and shine. Amber, quiet scent.",
    image: "/images/products.jpg",
  },
  {
    id: "wash",
    name: "Daily wash",
    category: "Hair",
    price: 32,
    stock: 24,
    sku: "EB-WSH",
    description: "Gentle cleanse that doesn't strip color. For most hair, most days.",
    image: "/images/products.jpg",
  },
  {
    id: "mask",
    name: "Repair mask",
    category: "Hair",
    price: 38,
    stock: 11,
    sku: "EB-MSK",
    description: "Weekly moisture for color-treated or heat-styled hair.",
    image: "/images/products.jpg",
  },
  {
    id: "polish-nude",
    name: "Studio nude polish",
    category: "Nails",
    price: 22,
    stock: 16,
    sku: "EB-NUD",
    description: "The in-house nude. Creamy, not chalky.",
    image: "/images/nails.jpg",
  },
  {
    id: "serum",
    name: "Calm serum",
    category: "Skin",
    price: 54,
    stock: 9,
    sku: "EB-SRM",
    description: "A simple, fragrance-light serum for post-facial days.",
    image: "/images/spa.jpg",
  },
  {
    id: "balm",
    name: "All-over balm",
    category: "Skin",
    price: 28,
    stock: 4,
    sku: "EB-BLM",
    description: "Cheeks, cuticles, ends of hair. One tin, many uses. Low stock.",
    image: "/images/spa.jpg",
  },
  {
    id: "gift-75",
    name: "Gift card · $75",
    category: "Gift",
    price: 75,
    stock: 99,
    sku: "GIFT-75",
    description: "A card for someone who already knows what they want.",
    image: "/images/gift.jpg",
  },
  {
    id: "gift-150",
    name: "Gift card · $150",
    category: "Gift",
    price: 150,
    stock: 99,
    sku: "GIFT-150",
    description: "Enough for a facial, a cut, or a very good color gloss.",
    image: "/images/gift.jpg",
  },
];

export const SEED_CLIENTS: Client[] = [
  {
    id: "c1",
    name: "Jordan Hale",
    phone: "(715) 555-0142",
    email: "jordan.hale@mail.test",
    notes: "Prefers cooler gloss. Sensitive scalp — no mint.",
    loyaltyPoints: 240,
    createdAt: "2024-11-02T15:00:00.000Z",
  },
  {
    id: "c2",
    name: "Priya Shah",
    phone: "(715) 555-0190",
    email: "priya.shah@mail.test",
    notes: "Bridal trial on file. Loves a soft wing.",
    loyaltyPoints: 410,
    createdAt: "2025-01-18T15:00:00.000Z",
  },
  {
    id: "c3",
    name: "Chris Novak",
    phone: "(920) 555-0118",
    email: "c.novak@mail.test",
    notes: "Every 4 weeks. Texture crop.",
    loyaltyPoints: 90,
    createdAt: "2025-03-09T15:00:00.000Z",
  },
  {
    id: "c4",
    name: "Maya Ellison",
    phone: "(715) 555-0166",
    email: "maya.e@mail.test",
    notes: "Allergic to latex. Gel only.",
    loyaltyPoints: 155,
    createdAt: "2025-04-22T15:00:00.000Z",
  },
  {
    id: "c5",
    name: "Owen Briggs",
    phone: "(906) 555-0133",
    email: "owen.b@mail.test",
    notes: "First-time color in 2025. Keep it subtle.",
    loyaltyPoints: 60,
    createdAt: "2025-06-01T15:00:00.000Z",
  },
  {
    id: "c6",
    name: "Hannah Cole",
    phone: "(715) 555-0177",
    email: "hannah.cole@mail.test",
    notes: "Facials monthly. Avoid fragrance.",
    loyaltyPoints: 320,
    createdAt: "2024-08-14T15:00:00.000Z",
  },
  {
    id: "c7",
    name: "Theo Marin",
    phone: "(715) 555-0121",
    email: "theo.m@mail.test",
    notes: "Walks over from the mill. Always cash tip.",
    loyaltyPoints: 45,
    createdAt: "2025-07-11T15:00:00.000Z",
  },
  {
    id: "c8",
    name: "Sasha Quinn",
    phone: "(920) 555-0184",
    email: "sasha.q@mail.test",
    notes: "Balayage twice a year. Loves Elena.",
    loyaltyPoints: 580,
    createdAt: "2023-10-05T15:00:00.000Z",
  },
];

export const REVIEWS = [
  {
    name: "Sasha Q.",
    service: "Lived-in balayage",
    quote:
      "Elena treated my grow-out like architecture. I left with color that looks expensive in a grocery-store parking lot, which is the real test.",
  },
  {
    name: "Chris N.",
    service: "Precision men's cut",
    quote:
      "Marcus cuts fast and talks less than most barbers. The crop actually sits right a week later. That's rare.",
  },
  {
    name: "Hannah C.",
    service: "Signature facial",
    quote:
      "The room is quiet, the products don't sting, and my skin looked like I had slept — I had not. Booking online took a minute.",
  },
];

export const POLICIES = [
  {
    title: "Arrive",
    body: "Give us ten minutes. Late arrivals over 15 minutes may be shortened or moved so the next chair stays on time.",
  },
  {
    title: "Cancel",
    body: "Free up to 12 hours before. Inside that window we keep a 50% deposit so the specialist isn't sitting empty.",
  },
  {
    title: "Color",
    body: "A patch test is required for new color guests. We will not rush a formulation to fit a lunch break.",
  },
];

/** 0 Sun … 6 Sat. null = closed. hours are [open, close) in 24h. */
export const WEEK_HOURS: WeekHours = [
  [10, 16],
  null,
  [9, 19],
  [9, 19],
  [9, 19],
  [9, 19],
  [9, 17],
];

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function cloneHours(week: WeekHours = WEEK_HOURS): WeekHours {
  return week.map((h) => (h ? ([h[0], h[1]] as [number, number]) : null));
}

export function normalizeHours(raw: unknown): WeekHours | null {
  if (!Array.isArray(raw) || raw.length !== 7) return null;
  return raw.map((h) => {
    if (h == null) return null;
    if (Array.isArray(h) && typeof h[0] === "number" && typeof h[1] === "number") {
      return [h[0], h[1]] as [number, number];
    }
    return null;
  });
}

export function formatClock(h: number) {
  const n = h % 12 || 12;
  return `${n}:00 ${h < 12 ? "am" : "pm"}`;
}

export function formatRange(range: [number, number] | null) {
  if (!range) return "Closed";
  return `${formatClock(range[0])} – ${formatClock(range[1])}`;
}

export function hoursLabels(week: WeekHours) {
  const rows: { day: string; hours: string }[] = [];
  let i = 0;
  while (i < 7) {
    const key = JSON.stringify(week[i] ?? null);
    let j = i;
    while (j + 1 < 7 && JSON.stringify(week[j + 1] ?? null) === key) j += 1;
    const day = i === j ? DAY_NAMES[i] : `${DAY_NAMES[i]}–${DAY_NAMES[j]}`;
    rows.push({ day, hours: formatRange(week[i] ?? null) });
    i = j + 1;
  }
  return rows;
}

export const PRODUCT_CATEGORIES = ["Hair", "Nails", "Skin", "Makeup", "Body"] as const;

export function imageForProduct(category: string) {
  if (category === "Nails") return "/images/nails.jpg";
  if (category === "Skin") return "/images/spa.jpg";
  if (category === "Makeup") return "/images/makeup.jpg";
  if (category === "Gift") return "/images/gift.jpg";
  return "/images/products.jpg";
}

export function skuFromName(name: string) {
  const slug = name.replace(/[^a-z0-9]+/gi, "").slice(0, 6).toUpperCase() || "ITEM";
  return `EB-${slug}`;
}

export const TAX_RATE = 0.055;
export const DEPOSIT_RATE = 0.5;
export const DEPOSIT_MIN_DEFAULT = 100;

export const STAFF_CHIPS = [
  "appt-elena",
  "appt-marcus",
  "appt-amara",
  "appt-sofie",
  "appt-jules",
  "appt-rose",
  "appt-sage",
  "appt-ink",
  "appt-teal",
  "appt-copper",
  "appt-sky",
  "appt-lilac",
  "appt-wine",
  "appt-amber",
  "appt-mint",
] as const;

export type StaffChip = (typeof STAFF_CHIPS)[number];

export function isStaffChip(value: string): value is StaffChip {
  return (STAFF_CHIPS as readonly string[]).includes(value);
}

export function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "EB";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function chipForStaff(existing: Staff[]) {
  const used = new Set(existing.map((s) => s.chip));
  return STAFF_CHIPS.find((c) => !used.has(c)) ?? STAFF_CHIPS[existing.length % STAFF_CHIPS.length];
}

export function imageForCategory(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.image ?? "/images/hair.jpg";
}

export function serviceById(id: string) {
  return SERVICES.find((s) => s.id === id);
}
export function staffById(id: string) {
  return STAFF.find((s) => s.id === id);
}
export function productById(id: string) {
  return PRODUCTS.find((p) => p.id === id);
}
export function categoryLabel(id: string) {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
export function staffForService(serviceId: string) {
  const svc = serviceById(serviceId);
  if (!svc) return [];
  return STAFF.filter((s) => svc.staffIds.includes(s.id));
}
