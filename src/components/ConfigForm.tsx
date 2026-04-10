import React, { useEffect, useMemo, useState } from 'react';
import type { GitLabConfig, GitLabProject, GitLabUser } from '../types/gitlab';
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

  const parseStoredList = (storageKey: string, fallback = ''): string[] =>
    (localStorage.getItem(storageKey) || fallback)
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>(
    parseStoredList('gitlab_project_ids', '2072,2073,2074')
  );
  const [selectedAssigneeUsernames, setSelectedAssigneeUsernames] = useState<string[]>(
    parseStoredList('gitlab_assignee_usernames')
  );
  const [selectedAuthorUsernames, setSelectedAuthorUsernames] = useState<string[]>(
    parseStoredList('gitlab_author_usernames')
  );

  const [availableProjects, setAvailableProjects] = useState<GitLabProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [availableUsers, setAvailableUsers] = useState<GitLabUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [authorSearch, setAuthorSearch] = useState('');
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenDraft, setTokenDraft] = useState('');
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);

  const openTokenSettings = () => {
    setTokenDraft(personalAccessToken);
    setShowTokenModal(true);
  };

  const saveToken = () => {
    const cleaned = tokenDraft.trim();
    if (!cleaned) {
      alert('Please enter a valid GitLab personal access token.');
      return;
    }

    setPersonalAccessToken(cleaned);
    localStorage.setItem(TOKEN_STORAGE_KEY, cleaned);
    setProjectsError(null);
    setShowTokenModal(false);
  };

  useEffect(() => {
    if (!personalAccessToken.trim()) {
      setShowTokenModal(true);
      setTokenDraft('');
    }
  }, [personalAccessToken]);

  useEffect(() => {
    const handleTokenInvalid = () => {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setPersonalAccessToken('');
      setAvailableProjects([]);
      setProjectsError('Token expired or invalid. Update the token from settings.');
      setTokenDraft('');
      setShowTokenModal(true);
    };

    window.addEventListener('gitlab-token-invalid', handleTokenInvalid);
    return () => window.removeEventListener('gitlab-token-invalid', handleTokenInvalid);
  }, []);

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

  useEffect(() => {
    const token = personalAccessToken.trim();

    if (!token || selectedProjectIds.length === 0) {
      setAvailableUsers([]);
      setUsersError(null);
      setUsersLoading(false);
      return;
    }

    let cancelled = false;
    setUsersLoading(true);
    setUsersError(null);

    const timer = window.setTimeout(async () => {
      try {
        const users = await gitlabService.getProjectUsers(GITLAB_INSTANCE, token, selectedProjectIds);
        if (cancelled) {
          return;
        }
        setAvailableUsers(users);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (axios.isAxiosError(error) && error.response?.status === 401) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          setPersonalAccessToken('');
          setAvailableUsers([]);
          setUsersError('Token expired or invalid. Update the token from settings.');
          return;
        }

        console.error('Unable to load users', error);
        setAvailableUsers([]);
        setUsersError('Unable to load users from selected projects.');
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [GITLAB_INSTANCE, personalAccessToken, selectedProjectIds]);

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

  const filteredAssigneeOptions = useMemo(() => {
    const query = assigneeSearch.trim().toLowerCase();

    if (!query) {
      return [];
    }

    const users = availableUsers.filter(user => {
      const haystack = `${user.username} ${user.name}`.toLowerCase();
      return haystack.includes(query);
    });

    if ('unassigned'.includes(query)) {
      return [{ id: 0, username: 'unassigned', name: 'Unassigned', avatar_url: '' }, ...users];
    }

    return users;
  }, [assigneeSearch, availableUsers]);

  const filteredAuthorOptions = useMemo(() => {
    const query = authorSearch.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return availableUsers.filter(user => {
      const haystack = `${user.username} ${user.name}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [authorSearch, availableUsers]);

  const shouldShowAssigneeResults = assigneeSearch.trim().length > 0;
  const shouldShowAuthorResults = authorSearch.trim().length > 0;

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

  const getUserLabel = (username: string): string => {
    if (username === 'unassigned') {
      return 'Unassigned';
    }

    const found = availableUsers.find(user => user.username === username);
    if (!found) {
      return username;
    }

    return `${found.name} (${found.username})`;
  };

  const toggleAssigneeSelection = (username: string) => {
    setSelectedAssigneeUsernames(current => {
      if (current.includes(username)) {
        return current.filter(item => item !== username);
      }
      return [...current, username];
    });
  };

  const toggleAuthorSelection = (username: string) => {
    setSelectedAuthorUsernames(current => {
      if (current.includes(username)) {
        return current.filter(item => item !== username);
      }
      return [...current, username];
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
    localStorage.setItem('gitlab_assignee_usernames', selectedAssigneeUsernames.join(','));
    localStorage.setItem('gitlab_author_usernames', selectedAuthorUsernames.join(','));

    const config: GitLabConfig = {
      instanceUrl: GITLAB_INSTANCE,
      personalAccessToken: personalAccessToken.trim(),
      projectIds: selectedProjectIds,
      assigneeUsernames: selectedAssigneeUsernames.length > 0 ? selectedAssigneeUsernames : undefined,
      authorUsernames: selectedAuthorUsernames.length > 0 ? selectedAuthorUsernames : undefined,
    };

    setFiltersCollapsed(true);
    onConfigSubmit(config);
  };

  return (
    <>
      <form className="config-form" onSubmit={handleSubmit}>
        <div className="filter-actions">
          <button
            type="button"
            className="token-settings-btn"
            onClick={openTokenSettings}
            title="Update GitLab token"
            aria-label="Update GitLab token"
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.57.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.54c.57-.22 1.12-.53 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
            </svg>
            <span>Token Settings</span>
          </button>

          <button
            type="button"
            className="toggle-filters-btn"
            onClick={() => setFiltersCollapsed(prev => !prev)}
            disabled={loading}
          >
            {filtersCollapsed ? 'Show Filters' : 'Hide Filters'}
          </button>
        </div>

        {!filtersCollapsed && (
          <>
            <div className="form-group projects-group">
              <label htmlFor="projectSearch">Projects (autocomplete multi-select)</label>
              <input
                id="projectSearch"
                type="text"
                placeholder={personalAccessToken.trim() ? 'Search project name, path, or ID' : 'Set token from settings to load projects'}
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
              <label htmlFor="assigneeSearch">Assignees (autocomplete multi-select)</label>
              <input
                id="assigneeSearch"
                type="text"
                placeholder={personalAccessToken.trim() ? 'Search assignee name or username' : 'Set token from settings first'}
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
                disabled={loading || !personalAccessToken.trim() || selectedProjectIds.length === 0}
                autoComplete="off"
              />

              {selectedAssigneeUsernames.length > 0 && (
                <div className="selected-projects">
                  {selectedAssigneeUsernames.map(username => (
                    <button
                      key={username}
                      type="button"
                      className="selected-project-chip"
                      onClick={() => toggleAssigneeSelection(username)}
                      disabled={loading}
                      title="Click to remove"
                    >
                      {getUserLabel(username)} x
                    </button>
                  ))}
                </div>
              )}

              {shouldShowAssigneeResults && (
                <div className="project-autocomplete-results">
                  {usersLoading && <p className="project-autocomplete-hint">Loading users...</p>}
                  {!usersLoading && usersError && <p className="project-autocomplete-error">{usersError}</p>}
                  {!usersLoading && !usersError && filteredAssigneeOptions.length === 0 && (
                    <p className="project-autocomplete-hint">No assignees matched your search.</p>
                  )}
                  {!usersLoading && !usersError && filteredAssigneeOptions.slice(0, 50).map(user => {
                    const checked = selectedAssigneeUsernames.includes(user.username);

                    return (
                      <label key={`assignee-${user.username}`} className="project-option">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAssigneeSelection(user.username)}
                          disabled={loading}
                        />
                        <span>{user.name} ({user.username})</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <small>Start typing to filter and select assignees. Add "unassigned" if needed.</small>
            </div>

            <div className="form-group authors-group">
              <label htmlFor="authorSearch">Authors (autocomplete multi-select)</label>
              <input
                id="authorSearch"
                type="text"
                placeholder={personalAccessToken.trim() ? 'Search author name or username' : 'Set token from settings first'}
                value={authorSearch}
                onChange={(e) => setAuthorSearch(e.target.value)}
                disabled={loading || !personalAccessToken.trim() || selectedProjectIds.length === 0}
                autoComplete="off"
              />

              {selectedAuthorUsernames.length > 0 && (
                <div className="selected-projects">
                  {selectedAuthorUsernames.map(username => (
                    <button
                      key={username}
                      type="button"
                      className="selected-project-chip"
                      onClick={() => toggleAuthorSelection(username)}
                      disabled={loading}
                      title="Click to remove"
                    >
                      {getUserLabel(username)} x
                    </button>
                  ))}
                </div>
              )}

              {shouldShowAuthorResults && (
                <div className="project-autocomplete-results">
                  {usersLoading && <p className="project-autocomplete-hint">Loading users...</p>}
                  {!usersLoading && usersError && <p className="project-autocomplete-error">{usersError}</p>}
                  {!usersLoading && !usersError && filteredAuthorOptions.length === 0 && (
                    <p className="project-autocomplete-hint">No authors matched your search.</p>
                  )}
                  {!usersLoading && !usersError && filteredAuthorOptions.slice(0, 50).map(user => {
                    const checked = selectedAuthorUsernames.includes(user.username);

                    return (
                      <label key={`author-${user.username}`} className="project-option">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAuthorSelection(user.username)}
                          disabled={loading}
                        />
                        <span>{user.name} ({user.username})</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <small>Start typing to filter and select issue authors.</small>
            </div>
          </>
        )}

        <button type="submit" className="load-issues-btn" disabled={loading}>
          {loading ? 'Loading...' : filtersCollapsed ? 'Refresh Issues' : 'Load Issues'}
        </button>
      </form>

      {showTokenModal && (
        <div className="token-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="token-modal-title">
          <div className="token-modal">
            <h3 id="token-modal-title">GitLab Token Settings</h3>
            <p>Enter your personal access token to load accessible projects and issues.</p>
            <label htmlFor="tokenModalInput">Personal Access Token</label>
            <input
              id="tokenModalInput"
              type="password"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="glpat-..."
              autoComplete="off"
            />
            <div className="token-modal-actions">
              <button type="button" className="token-save-btn" onClick={saveToken}>Save Token</button>
              <button
                type="button"
                className="token-cancel-btn"
                onClick={() => setShowTokenModal(false)}
                disabled={!personalAccessToken.trim()}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
