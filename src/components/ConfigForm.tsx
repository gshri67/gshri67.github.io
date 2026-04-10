import React, { useEffect, useMemo, useState } from 'react';
import type { GitLabConfig, GitLabProject } from '../types/gitlab';
import gitlabService from '../services/gitlabService';
import './ConfigForm.css';
import axios from 'axios';

interface ConfigFormProps {
  onConfigSubmit: (config: GitLabConfig) => void;
  loading?: boolean;
}

export const ConfigForm: React.FC<ConfigFormProps> = ({ onConfigSubmit, loading = false }) => {
  const GITLAB_INSTANCE = 'https://gitlab.biw-services.com';
  const [personalAccessToken, setPersonalAccessToken] = useState(localStorage.getItem('gitlab_personal_access_token') || '');
  const TOKEN_STORAGE_KEY = 'gitlab_personal_access_token';
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    (localStorage.getItem('gitlab_project_ids') || '2072,2073,2074')
      .split(',')
      .map(id => id.trim())
      .filter(id => id)
  );
  const [assigneeUsernames, setAssigneeUsernames] = useState(localStorage.getItem('gitlab_assignee_usernames') || '');
  const [availableProjects, setAvailableProjects] = useState<GitLabProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');

  const promptForToken = (message: string) => {
    const enteredToken = window.prompt(message, personalAccessToken || '');
    if (!enteredToken || !enteredToken.trim()) {
      return;
    }

    const cleaned = enteredToken.trim();
    setPersonalAccessToken(cleaned);
    localStorage.setItem(TOKEN_STORAGE_KEY, cleaned);
    setProjectsError(null);
  };

  useEffect(() => {
    if (!personalAccessToken.trim()) {
      promptForToken('Enter your GitLab personal access token to load projects.');
    }
  }, [personalAccessToken]);

  useEffect(() => {
    const token = personalAccessToken.trim();

    if (!token) {
      setAvailableProjects([]);
      setProjectsError(null);
      setProjectsLoading(false);
      return;
    }

    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError(null);

    const timer = window.setTimeout(async () => {
      try {
        const projects = await gitlabService.getAccessibleProjects(GITLAB_INSTANCE, token);
        if (cancelled) {
          return;
        }
        setAvailableProjects(projects);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (axios.isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setPersonalAccessToken('');
          setAvailableProjects([]);
          setProjectsError('Token expired or invalid. Please enter a new token.');
          return;
        }

        console.error('Unable to fetch projects', error);
        setAvailableProjects([]);
        setProjectsError('Unable to load projects for this token. Verify token access and try again.');
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [GITLAB_INSTANCE, personalAccessToken]);

  const filteredProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return availableProjects.filter(project => {
      const haystack = `${project.id} ${project.name} ${project.path_with_namespace}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [availableProjects, projectSearch]);

  const shouldShowProjectResults = projectSearch.trim().length > 0;

  const getProjectLabel = (projectId: string): string => {
    const found = availableProjects.find(project => String(project.id) === projectId);

    if (!found) {
      return `Project ${projectId}`;
    }

    return `${found.path_with_namespace} (${found.id})`;
  };

  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjectIds(current => {
      if (current.includes(projectId)) {
        return current.filter(id => id !== projectId);
      }

      return [...current, projectId];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!personalAccessToken.trim()) {
      alert('Please enter your GitLab personal access token');
      return;
    }

    if (selectedProjectIds.length === 0) {
      alert('Please select at least one project');
      return;
    }

    // Save to localStorage for convenience
    localStorage.setItem('gitlab_instance_url', GITLAB_INSTANCE);
    localStorage.setItem('gitlab_personal_access_token', personalAccessToken.trim());
    localStorage.setItem('gitlab_project_ids', selectedProjectIds.join(','));
    localStorage.setItem('gitlab_assignee_usernames', assigneeUsernames);

    const config: GitLabConfig = {
      instanceUrl: GITLAB_INSTANCE,
      personalAccessToken: personalAccessToken.trim(),
      projectIds: selectedProjectIds,
      assigneeUsernames: assigneeUsernames
        ? assigneeUsernames.split(',').map(user => user.trim()).filter(user => user)
        : undefined,
    };

    onConfigSubmit(config);
  };

  return (
    <form className="config-form" onSubmit={handleSubmit}>
      <div className="form-group token-group">
        <label htmlFor="personalAccessToken">Personal Access Token</label>
        <input
          id="personalAccessToken"
          type="password"
          placeholder="glpat-..."
          value={personalAccessToken}
          onChange={(e) => setPersonalAccessToken(e.target.value)}
          disabled={loading}
          autoComplete="off"
        />
        <small>Token is used only for API calls and stored in your browser local storage.</small>
      </div>

      <div className="form-group projects-group">
        <label htmlFor="projectSearch">Projects (autocomplete multi-select)</label>
        <input
          id="projectSearch"
          type="text"
          placeholder={personalAccessToken.trim() ? 'Search project name, path, or ID' : 'Enter token to load projects'}
          value={projectSearch}
          onChange={(e) => setProjectSearch(e.target.value)}
          disabled={loading || !personalAccessToken.trim()}
          autoComplete="off"
        />

        {selectedProjectIds.length > 0 && (
          <div className="selected-projects">
            {selectedProjectIds.map(projectId => (
              <button
                key={projectId}
                type="button"
                className="selected-project-chip"
                onClick={() => toggleProjectSelection(projectId)}
                disabled={loading}
                title="Click to remove"
              >
                {getProjectLabel(projectId)} x
              </button>
            ))}
          </div>
        )}

        {shouldShowProjectResults && (
          <div className="project-autocomplete-results">
            {projectsLoading && <p className="project-autocomplete-hint">Loading projects...</p>}
            {!projectsLoading && projectsError && <p className="project-autocomplete-error">{projectsError}</p>}
            {!projectsLoading && !projectsError && personalAccessToken.trim() && filteredProjects.length === 0 && (
              <p className="project-autocomplete-hint">No projects matched your search.</p>
            )}
            {!projectsLoading && !projectsError && filteredProjects.slice(0, 50).map(project => {
              const projectId = String(project.id);
              const checked = selectedProjectIds.includes(projectId);

              return (
                <label key={projectId} className="project-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleProjectSelection(projectId)}
                    disabled={loading}
                  />
                  <span>{project.path_with_namespace} ({project.id})</span>
                </label>
              );
            })}
          </div>
        )}
        <small>Start typing to search projects and select multiple entries.</small>
      </div>

      <div className="form-group assignees-group">
        <label htmlFor="assigneeUsernames">Filter by Assignees (comma-separated, optional)</label>
        <input
          id="assigneeUsernames"
          type="text"
          placeholder="username1, username2, username3"
          value={assigneeUsernames}
          onChange={(e) => setAssigneeUsernames(e.target.value)}
          disabled={loading}
        />
        <small>Leave empty to show all assignees. Enter usernames separated by commas to filter.</small>
      </div>

      <button type="submit" className="load-issues-btn" disabled={loading}>
        {loading ? 'Loading...' : 'Load Issues'}
      </button>
    </form>
  );
};
