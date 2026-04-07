import React from 'react';
import type { GitLabIssue } from '../types/gitlab';
import './IssueTable.css';

interface IssueTableProps {
  issues: GitLabIssue[];
  userName: string;
}

export const IssueTable: React.FC<IssueTableProps> = ({ issues, userName }) => {
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (seconds: number | undefined) => {
    if (!seconds || seconds === 0) return '0h';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0 && minutes === 0) return '0h';
    if (minutes === 0) return `${hours}h`;
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const getDaysOpen = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getClientLabel = (labels?: string[]) => {
    if (!labels || labels.length === 0) return 'N/A';
    const clientLabel = labels.find(label => label.toLowerCase().includes('client'));
    return clientLabel || 'N/A';
  };

  return (
    <div className="issue-section">
      <h3 className="section-title">{userName}</h3>
      <table className="issue-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Project</th>
            <th>Assigned To</th>
            <th>Start Date</th>
            <th>Due Date</th>
            <th>Created</th>
            <th>Days Open</th>
            <th>Estimated</th>
            <th>Tracked</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {issues.map(issue => (
            <tr key={issue.id}>
              <td className="title-cell">
                <a href={issue.web_url} target="_blank" rel="noopener noreferrer">
                  {issue.title}
                </a>
              </td>
              <td className="project-cell">
                <span className="client-label-badge">{getClientLabel(issue.labels)}</span>
              </td>
              <td className="assignees-cell">
                {issue.assignees && issue.assignees.length > 0
                  ? issue.assignees.map(a => a.name).join(', ')
                  : 'Unassigned'}
              </td>
              <td className="date-cell">{formatDate(issue.start_date)}</td>
              <td className="date-cell">{formatDate(issue.due_date)}</td>
              <td className="date-cell">{formatDate(issue.created_at)}</td>
              <td className="days-open">{getDaysOpen(issue.created_at)} days</td>
              <td className="time-cell">{formatTime(issue.time_stats?.time_estimate)}</td>
              <td className="time-cell">{formatTime(issue.time_stats?.total_time_spent)}</td>
              <td className={`status-cell status-${issue.state}`}>
                {issue.state}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface IssuesByUserTableProps {
  issuesByUser: Array<{
    user: { id: number; name: string; username: string; avatar_url: string };
    issues: GitLabIssue[];
  }>;
}

export const IssuesByUserDisplay: React.FC<IssuesByUserTableProps> = ({ issuesByUser }) => {
  if (issuesByUser.length === 0) {
    return (
      <div className="no-data">
        <table className="issue-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Project</th>
              <th>Assigned To</th>
              <th>Start Date</th>
              <th>Due Date</th>
              <th>Created</th>
              <th>Days Open</th>
              <th>Estimated</th>
              <th>Tracked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={10} className="no-data-cell">
                No open issues found
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="issues-container">
      {issuesByUser.map(userGroup => (
        <IssueTable
          key={userGroup.user.username}
          issues={userGroup.issues}
          userName={`${userGroup.user.name} (${userGroup.issues.length} issues)`}
        />
      ))}
    </div>
  );
};

interface ProductionIssueTableProps {
  issues: GitLabIssue[];
}

export const ProductionIssueTable: React.FC<ProductionIssueTableProps> = ({ issues }) => {
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysOpen = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatTime = (seconds: number | undefined) => {
    if (!seconds || seconds === 0) return '0h';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0 && minutes === 0) return '0h';
    if (minutes === 0) return `${hours}h`;
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const getPriorityClass = (daysOpen: number) => {
    if (daysOpen >= 7) return 'critical';
    if (daysOpen >= 3) return 'high';
    return 'medium';
  };

  if (issues.length === 0) {
    return (
      <div className="production-issues-container">
        <table className="issue-table production-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Project</th>
              <th>Assigned To</th>
              <th>Start Date</th>
              <th>Due Date</th>
              <th>Created</th>
              <th>Days Open</th>
              <th>Priority</th>
              <th>Estimated</th>
              <th>Tracked</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={11} className="no-data-cell">
                No production issues found without the Error Type Core Issues label
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="production-issues-container">
      <table className="issue-table production-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Project</th>
            <th>Assigned To</th>
            <th>Start Date</th>
            <th>Due Date</th>
            <th>Created</th>
            <th>Days Open</th>
            <th>Priority</th>
            <th>Estimated</th>
            <th>Tracked</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {issues.map(issue => {
            const daysOpen = getDaysOpen(issue.created_at);
            const priorityClass = getPriorityClass(daysOpen);
            
            return (
              <tr key={issue.id} className={`priority-${priorityClass}`}>
                <td className="title-cell">
                  <a href={issue.web_url} target="_blank" rel="noopener noreferrer">
                    {issue.title}
                  </a>
                </td>
                <td className="project-cell">
                  {issue.project?.name || 'Unknown Project'}
                </td>
                <td className="assignees-cell">
                  {issue.assignees && issue.assignees.length > 0
                    ? issue.assignees.map(a => a.name).join(', ')
                    : 'Unassigned'}
                </td>
                <td className="date-cell">{formatDate(issue.start_date)}</td>
                <td className="date-cell">{formatDate(issue.due_date)}</td>
                <td className="date-cell">{formatDate(issue.created_at)}</td>
                <td className={`days-open priority-${priorityClass}`}>
                  {daysOpen} days
                </td>
                <td className={`priority-badge priority-${priorityClass}`}>
                  {priorityClass.toUpperCase()}
                </td>
                <td className="time-cell">{formatTime(issue.time_stats?.time_estimate)}</td>
                <td className="time-cell">{formatTime(issue.time_stats?.total_time_spent)}</td>
                <td className={`status-cell status-${issue.state}`}>
                  {issue.state}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
