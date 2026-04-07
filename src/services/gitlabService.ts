import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { GitLabIssue, GitLabConfig, IssuesByUser } from '../types/gitlab';

class GitLabService {
  private client: AxiosInstance | null = null;
  private config: GitLabConfig | null = null;

  private normalizeLabel(label: string): string {
    return label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private hasMatchingLabel(labels: string[] | undefined, labelText: string): boolean {
    if (!labels || labels.length === 0) {
      return false;
    }

    const normalizedLabelText = this.normalizeLabel(labelText);
    return labels.some(label => this.normalizeLabel(label).includes(normalizedLabelText));
  }

  setConfig(config: GitLabConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: `${config.instanceUrl}/api/v4`,
      headers: {
        'PRIVATE-TOKEN': config.personalAccessToken,
      },
    });
  }

  async getOpenIssuesByProjects(): Promise<{ regularIssues: IssuesByUser[]; productionIssues: GitLabIssue[] }> {
    if (!this.client || !this.config) {
      throw new Error('GitLab service not configured');
    }

    try {
      const allIssues: GitLabIssue[] = [];
      const projectCache = new Map<string, { id: number; name: string; path_with_namespace: string }>();

      // Fetch issues for each project
      for (const projectId of this.config.projectIds) {
        // Fetch project details to get project name
        let projectDetails = projectCache.get(projectId);
        if (!projectDetails) {
          try {
            const projectResponse = await this.client.get(
              `/projects/${projectId}`
            );
            projectDetails = {
              id: projectResponse.data.id,
              name: projectResponse.data.name,
              path_with_namespace: projectResponse.data.path_with_namespace,
            };
            projectCache.set(projectId, projectDetails);
          } catch (err) {
            console.warn(`Failed to fetch project ${projectId}:`, err);
            projectDetails = {
              id: parseInt(projectId),
              name: projectId,
              path_with_namespace: projectId,
            };
          }
        }

        const response = await this.client.get<GitLabIssue[]>(
          `/projects/${projectId}/issues`,
          {
            params: {
              state: 'opened',
              per_page: 100,
              pagination: 'keyset',
              order_by: 'created_at',
              sort: 'desc',
            },
          }
        );

        // Filter out issues with excluded labels (case-insensitive, punctuation-insensitive)
        const filteredIssues = response.data.filter(issue => {
          if (!issue.labels || issue.labels.length === 0) {
            return true; // Include issues without labels
          }

          return !this.hasMatchingLabel(issue.labels, 'on hold') &&
            !this.hasMatchingLabel(issue.labels, 'service request') &&
            !this.hasMatchingLabel(issue.labels, 'error type data issue');
        });

        // Add project info to each issue
        const issuesWithProject = filteredIssues.map(issue => ({
          ...issue,
          project: {
            id: projectDetails.id,
            name: projectDetails.name,
            path_with_namespace: projectDetails.path_with_namespace,
          },
        }));

        allIssues.push(...issuesWithProject);
      }

      // Separate production issues from regular issues
      const allProductionIssues = allIssues.filter(issue =>
        this.hasMatchingLabel(issue.labels, 'production issue') &&
        !this.hasMatchingLabel(issue.labels, 'error type core issues')
      );

      // Apply assignee filtering to production issues
      const productionIssues = this.filterIssuesByAssignees(allProductionIssues);

      const regularIssues = allIssues.filter(issue =>
        !this.hasMatchingLabel(issue.labels, 'production issue')
      );

      // Group regular issues by assignee
      const regularIssuesByUser = this.groupIssuesByAssignee(regularIssues);

      // Sort by number of issues (descending)
      return {
        regularIssues: regularIssuesByUser.sort((a, b) => b.issues.length - a.issues.length),
        productionIssues: productionIssues.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      };
    } catch (error) {
      console.error('Error fetching issues:', error);
      throw error;
    }
  }

  private filterIssuesByAssignees(issues: GitLabIssue[]): GitLabIssue[] {
    const filterUsernames = this.config?.assigneeUsernames;
    
    // If no filter is specified, return all issues
    if (!filterUsernames || filterUsernames.length === 0) {
      return issues;
    }

    // Users to exclude if shared with specific others
    const excludeIfSharedWith = ['baskar', 'shriguru'];
    const sharedWithUsers = ['JesuarulsamyArockia-Jenitha', 'RamappaAkshay', 'ManickamBalakrishnan'];

    return issues.filter(issue => {
      // Handle unassigned issues
      if (!issue.assignees || issue.assignees.length === 0) {
        return filterUsernames.includes('unassigned');
      }

      // Check if any assignee matches the filter
      return issue.assignees.some(assignee => {
        // Check if this is a user we should exclude if shared with others
        const shouldExclude = 
          excludeIfSharedWith.includes(assignee.username) &&
          issue.assignees &&
          issue.assignees.some(a => sharedWithUsers.includes(a.username));

        if (shouldExclude) {
          return false; // Exclude this issue for baskar/shriguru if shared with others
        }

        // Check if the assignee is in the filter list
        return filterUsernames.includes(assignee.username);
      });
    });
  }

  private groupIssuesByAssignee(issues: GitLabIssue[]): IssuesByUser[] {
    const groupedMap = new Map<string, IssuesByUser>();
    const filterUsernames = this.config?.assigneeUsernames;
    
    // Users to exclude if shared with specific others
    const excludeIfSharedWith = ['baskar', 'shriguru'];
    const sharedWithUsers = ['JesuarulsamyArockia-Jenitha', 'RamappaAkshay', 'ManickamBalakrishnan'];

    issues.forEach(issue => {
      // If issue has assignees, find the first valid assignee to group under
      if (issue.assignees && issue.assignees.length > 0) {
        let issueAssigned = false;
        
        for (const assignee of issue.assignees) {
          if (issueAssigned) break; // Only assign to first matching assignee
          
          // Check if this is a user we should exclude if shared with others
          const shouldExclude = 
            excludeIfSharedWith.includes(assignee.username) &&
            issue.assignees &&
            issue.assignees.some(a => sharedWithUsers.includes(a.username));

          if (shouldExclude) {
            continue; // Skip this assignee but check others
          }

          // Filter by username if specified
          if (filterUsernames && filterUsernames.length > 0) {
            if (!filterUsernames.includes(assignee.username)) {
              continue; // Skip this assignee if not in filter list
            }
          }

          const key = assignee.username;
          if (!groupedMap.has(key)) {
            groupedMap.set(key, {
              user: assignee,
              issues: [],
            });
          }
          groupedMap.get(key)!.issues.push(issue);
          issueAssigned = true; // Mark as assigned to prevent duplicates
        }
      } else {
        // Handle unassigned issues - only show if no filter or if 'unassigned' is in filter
        if (filterUsernames && filterUsernames.length > 0) {
          if (!filterUsernames.includes('unassigned')) {
            return; // Skip unassigned if not in filter
          }
        }

        const unassignedUser = { id: 0, name: 'Unassigned', username: 'unassigned', avatar_url: '' };
        const key = 'unassigned';
        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            user: unassignedUser,
            issues: [],
          });
        }
        groupedMap.get(key)!.issues.push(issue);
      }
    });

    return Array.from(groupedMap.values());
  }
}

export default new GitLabService();
