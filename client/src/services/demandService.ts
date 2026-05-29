import { DemandData, BuyerIntent, HeatMapPoint, DemandTrendPoint } from "@/types/demand";

const MOCK_INTENTS: BuyerIntent[] = [
  {
    id: "1",
    buyer_name: "GrainCorp",
    buyer_rating: 4.8,
    product_name: "Maize",
    category: "Grains",
    quantity: "500",
    unit: "bag",
    location: {
      region: "North Central",
      coordinates: [9.082, 7.533],
    },
    created_at: new Date().toISOString(),
    timeline: "Within 1 week",
    budget_range: "₦85,000 – ₦100,000",
    quality_requirements: "Grade A, moisture content below 14%, no aflatoxin",
    delivery_preference: "Farm pickup",
    is_recurring: true,
  },
  {
    id: "2",
    buyer_name: "AgroExport Ltd",
    buyer_rating: 4.2,
    product_name: "Cassava",
    category: "Tubers",
    quantity: "1200",
    unit: "kg",
    location: {
      region: "South West",
      coordinates: [7.3775, 3.947],
    },
    created_at: new Date(Date.now() - 86400000).toISOString(),
    timeline: "Within 2 weeks",
    budget_range: "₦50,000 – ₦70,000",
    quality_requirements: "High starch content, fresh harvest",
    delivery_preference: "Warehouse delivery",
    is_recurring: false,
  },
  {
    id: "3",
    buyer_name: "FreshFoods",
    buyer_rating: 3.9,
    product_name: "Tomatoes",
    category: "Vegetables",
    quantity: "300",
    unit: "crate",
    location: {
      region: "North West",
      coordinates: [10.5105, 7.4165],
    },
    created_at: new Date(Date.now() - 172800000).toISOString(),
    timeline: "Within 3 days",
    budget_range: "₦3,500 – ₦4,200 per crate",
    quality_requirements: "Ripe, no bruising, uniform size",
    delivery_preference: "Market delivery",
    is_recurring: true,
  },
  {
    id: "4",
    buyer_name: "NutriHarvest",
    buyer_rating: 4.5,
    product_name: "Soybeans",
    category: "Grains",
    quantity: "800",
    unit: "kg",
    location: {
      region: "South South",
      coordinates: [4.8156, 7.0498],
    },
    created_at: new Date(Date.now() - 259200000).toISOString(),
    timeline: "Within 2 weeks",
    budget_range: "₦180,000 – ₦220,000",
    quality_requirements: "Protein content above 35%, sun-dried",
    delivery_preference: "Farm pickup",
    is_recurring: false,
  },
  {
    id: "5",
    buyer_name: "OrganicProduce Co.",
    buyer_rating: 4.7,
    product_name: "Plantain",
    category: "Fruits",
    quantity: "600",
    unit: "bunch",
    location: {
      region: "South West",
      coordinates: [6.5244, 3.3792],
    },
    created_at: new Date(Date.now() - 345600000).toISOString(),
    timeline: "Within 5 days",
    budget_range: "₦1,200 – ₦1,800 per bunch",
    quality_requirements: "Mature but unripe, no black spots",
    delivery_preference: "Warehouse delivery",
    is_recurring: true,
  },
];

const MOCK_HEATMAP: HeatMapPoint[] = [
  { coordinates: [9.082, 7.533], intensity: 0.8, label: "Abuja" },
  { coordinates: [6.5244, 3.3792], intensity: 0.9, label: "Lagos" },
  { coordinates: [12.0022, 8.592], intensity: 0.6, label: "Kano" },
  { coordinates: [4.8156, 7.0498], intensity: 0.7, label: "Port Harcourt" },
];

function buildTrend(): DemandTrendPoint[] {
  const points: DemandTrendPoint[] = [];
  const base = 20000;
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 86400000);
    const noise = Math.floor((Math.random() - 0.4) * 3000);
    points.push({
      date: date.toISOString().split("T")[0],
      volume: Math.max(0, base + noise + (29 - i) * 200),
    });
  }
  return points;
}

export async function getDemandData(): Promise<DemandData> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    volume: {
      total_volume: "25400",
      unit: "kg",
      category_breakdown: {
        Grains: "12000",
        Tubers: "8000",
        Vegetables: "3000",
        Fruits: "1500",
        Livestock: "900",
        Other: "0",
      },
      growth_pct: 12.4,
      category_growth: {
        Grains: 18.2,
        Tubers: 9.7,
        Vegetables: -3.1,
        Fruits: 22.5,
        Livestock: 5.0,
      },
    },
    intents: MOCK_INTENTS,
    heatMap: MOCK_HEATMAP,
    trend: buildTrend(),
  };
}
