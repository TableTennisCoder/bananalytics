/** A project (analytics workspace). */
export interface Project {
  id: string;
  name: string;
  write_key: string;
  secret_key: string;
  created_at: string;
  updated_at: string;
}

/** Response from GET /api/projects. */
export interface ProjectsListResponse {
  projects: Project[];
}

/** Response from POST /api/projects. */
export type CreateProjectResponse = Project;

/** Response from POST /api/projects/[id]/keys/rotate. */
export interface RotatedKeys {
  write_key: string;
  secret_key: string;
}
