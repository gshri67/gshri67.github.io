import React, { useState } from 'react';
import type { GitLabConfig } from '../types/gitlab';
import './ConfigForm.css';

interface ConfigFormProps {
  onConfigSubmit: (config: GitLabConfig) => void;
  loading?: boolean;
}

export const ConfigForm: React.FC<ConfigFormProps> = ({ onConfigSubmit, loading = false }) => {
  const GITLAB_TOKEN = 'TtqP-ZCqXt062zb2boaVIm86MQp1OjZsCA.01.0y0befe6t'; // Hardcoded token
  const GITLAB_INSTANCE = 'https://gitlab.biw-services.com';
  const [projectIds, setProjectIds] = useState(localStorage.getItem('gitlab_project_ids') || '2072,2073,2074');
  const [assigneeUsernames, setAssigneeUsernames] = useState(localStorage.getItem('gitlab_assignee_usernames') || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectIds) {
      alert('Please fill in project IDs');
      return;
    }

    // Save to localStorage for convenience
    localStorage.setItem('gitlab_instance_url', GITLAB_INSTANCE);
    localStorage.setItem('gitlab_project_ids', projectIds);
    localStorage.setItem('gitlab_assignee_usernames', assigneeUsernames);

    const config: GitLabConfig = {
      instanceUrl: GITLAB_INSTANCE,
      personalAccessToken: GITLAB_TOKEN,
      projectIds: projectIds.split(',').map(id => id.trim()).filter(id => id),
      assigneeUsernames: assigneeUsernames
        ? assigneeUsernames.split(',').map(user => user.trim()).filter(user => user)
        : undefined,
    };

    onConfigSubmit(config);
  };

  return (
    <form className="config-form" onSubmit={handleSubmit}>
      <h2>GitLab Configuration</h2>
      
      <div className="form-group">
        <label>GitLab Instance URL</label>
        <p style={{ margin: '5px 0', color: '#666' }}>{GITLAB_INSTANCE}</p>
      </div>

      <div className="form-group">
        <label htmlFor="projectIds">Project IDs (comma-separated)</label>
        <input
          id="projectIds"
          type="text"
          placeholder="1, 2, 3"
          value={projectIds}
          onChange={(e) => setProjectIds(e.target.value)}
          disabled={loading}
        />
        <small>Enter project IDs separated by commas</small>
      </div>

      <div className="form-group">
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

      <button type="submit" disabled={loading}>
        {loading ? 'Loading...' : 'Load Issues'}
      </button>
    </form>
  );
};
