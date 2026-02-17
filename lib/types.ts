export interface PollOption {
  id: string;
  label: string;
  sort_order: number;
}

export interface Poll {
  id: string;
  question: string;
  created_at: string;
  expires_at: string | null;
  options?: PollOption[];
}
