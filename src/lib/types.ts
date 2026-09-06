export type ServiceCategory = "hair" | "color" | "nails" | "skin" | "makeup";

export type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "arrived"
  | "in-service"
  | "completed"
  | "cancelled"
  | "no-show";

export type PayMethod = "card" | "cash" | "gift" | "affirm";

export type HourRange = [number, number];
export type WeekHours = (HourRange | null)[];

export type Staff = {
  id: string;
  name: string;
  role: string;
  bio: string;
  initials: string;
  specialties: ServiceCategory[];
  chip: string;
  startHour: number;
  endHour: number;
};

export type Service = {
  id: string;
  name: string;
  category: ServiceCategory;
  durationMin: number;
  price: number;
  description: string;
  staffIds: string[];
  image: string;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  sku: string;
  description: string;
  image: string;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  loyaltyPoints: number;
  createdAt: string;
};

export type Appointment = {
  id: string;
  clientId: string;
  staffId: string;
  serviceId: string;
  start: string;
  durationMin: number;
  status: AppointmentStatus;
  notes: string;
  depositPaid: boolean;
  createdAt: string;
};

export type SaleItem = {
  kind: "service" | "product" | "gift";
  refId: string;
  name: string;
  qty: number;
  price: number;
};

export type Sale = {
  id: string;
  at: string;
  clientId?: string;
  appointmentId?: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  method: PayMethod;
  stripeId?: string;
};

export type GiftCard = {
  id: string;
  code: string;
  balance: number;
  original: number;
  from: string;
  to: string;
  createdAt: string;
};

export type Visitor = {
  name: string;
  phone: string;
  email: string;
};

export type CartLine = SaleItem;

export type BookInput = {
  serviceId: string;
  staffId: string;
  start: string;
  name: string;
  phone: string;
  email: string;
  notes?: string;
  depositPaid?: boolean;
};

export type CheckoutInput = {
  clientId?: string;
  appointmentId?: string;
  items: CartLine[];
  tip: number;
  method: PayMethod;
  giftCode?: string;
  stripeId?: string;
  fulfill?: boolean;
};

export type PendingPay = {
  id: string;
  kind: "deposit" | "pos" | "shop" | "gift";
  amount: number;
  description: string;
  cancelPath: string;
  provider?: "stripe" | "affirm";
  book?: BookInput;
  checkout?: CheckoutInput;
  productId?: string;
  gift?: { amount: number; from: string; to: string };
};

