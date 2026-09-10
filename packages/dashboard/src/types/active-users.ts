/** Active-people counts for a single day. */
export interface ActiveUsersPoint {
  /** ISO date. */
  bucket: string;
  /** People active on this day. */
  dau: number;
  /** People active in the 7 days ending on this day. */
  wau: number;
  /** People active in the 30 days ending on this day. */
  mau: number;
  /** DAU as a percentage of MAU — how much of the monthly audience shows up daily. */
  stickiness: number;
}

/** Response shape of the active-users endpoint. */
export interface ActiveUsersResponse {
  active_users: ActiveUsersPoint[];
}
