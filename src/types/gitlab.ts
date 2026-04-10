export interface GitLabIssue {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  description: string;
  state: string;
  created_at: string;
  updated_at: string;
  due_date?: string;
  start_date?: string;
  assignees: GitLabUser[];
  author: GitLabUser;
  web_url: string;
  labels?: string[];
  time_stats?: {
    time_estimate: number;
    total_time_spent: number;
  };
  project?: {
    id: number;
    name: string;
    path_with_namespace: string;
  };
}

export interface GitLabUser {
  id: number;
  name: string;
  username: string;
  avatar_url: string;
}

export interface GitLabConfig {
  instanceUrl: string;
  personalAccessToken: string;
  projectIds: string[];
  assigneeUsernames?: string[];
  authorUsernames?: string[];
}

export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
}

export interface IssuesByUser {
  user: GitLabUser;
  issues: GitLabIssue[];
}
