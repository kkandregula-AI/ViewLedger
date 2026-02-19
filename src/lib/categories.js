// src/lib/categories.js
export const CATEGORIES = {
  Food:          { icon: "🍔", color: "#f97316" },
  Shopping:      { icon: "🛍️", color: "#8b5cf6" },
  Transport:     { icon: "🚗", color: "#0ea5e9" },
  Subscriptions: { icon: "📺", color: "#ec4899" },
  Health:        { icon: "🏥", color: "#10b981" },
  Utilities:     { icon: "💡", color: "#f59e0b" },
  Income:        { icon: "💼", color: "#22c55e" },
  Cash:          { icon: "💵", color: "#6b7280" },
  Education:     { icon: "📚", color: "#a855f7" },
  Entertainment: { icon: "🎬", color: "#f43f5e" },
  Other:         { icon: "📌", color: "#9ca3af" },
};

export const CATEGORY_NAMES = Object.keys(CATEGORIES);

export function getCategoryData(name) {
  return CATEGORIES[name] || CATEGORIES.Other;
}
