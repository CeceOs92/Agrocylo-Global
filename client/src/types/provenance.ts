export type ProvenanceMilestoneStatus = "completed" | "current" | "upcoming";

export interface ProvenanceMilestone {
  id: string;
  label: string;
  description?: string;
  date?: string | null;
  status: ProvenanceMilestoneStatus;
}

export interface ProvenanceRecord {
  orderId?: string;
  productId?: string;
  farmerAddress?: string | null;
  farmerName?: string | null;
  batchId?: string | null;
  harvestDate?: string | null;
  originLocation?: string | null;
  milestones: ProvenanceMilestone[];
  /** Public URL encoded into the QR code */
  shareUrl: string;
  tracked: boolean;
}

export const EMPTY_PROVENANCE_MILESTONES: ProvenanceMilestone[] = [
  {
    id: "farm",
    label: "Farm origin",
    description: "Source farm registered",
    status: "upcoming",
  },
  {
    id: "harvest",
    label: "Harvest",
    description: "Batch harvested",
    status: "upcoming",
  },
  {
    id: "pack",
    label: "Packed",
    description: "Prepared for shipment",
    status: "upcoming",
  },
  {
    id: "ship",
    label: "Shipped",
    description: "In transit",
    status: "upcoming",
  },
  {
    id: "deliver",
    label: "Delivered",
    description: "Received by buyer",
    status: "upcoming",
  },
];
